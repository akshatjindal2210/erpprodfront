"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  FIELDS_WITH_OPTIONS,
  newFormField,
  getFieldTypeMeta,
  getDefaultFieldWidth,
  validateFormSchemaFields,
  optionsToText,
  parseOptionsText,
  cleanFieldOptions,
} from "@/features/apps/task/helpers/clTaskFormHelper";
import { inputBase, textareaBase, ClFormError, ClFormHint } from "./clTaskFormUi";
import ClTaskFormOptionEditor from "./ClTaskFormOptionEditor";

/** Primary types — what most CL forms need */
const TYPE_GROUPS = [
  {
    title: "Answers",
    types: [
      { value: "short_text", label: "Short text", hint: "One line" },
      { value: "text", label: "Long text", hint: "Paragraph" },
      { value: "numeric", label: "Number", hint: "Quantity / score" },
      { value: "date", label: "Date", hint: "Pick a day" },
    ],
  },
  {
    title: "Choices",
    types: [
      { value: "checkbox", label: "Checkbox", hint: "Yes / No" },
      { value: "radio", label: "Radio", hint: "Pick one" },
      { value: "dropdown", label: "Dropdown", hint: "Select from list" },
      { value: "multiselect", label: "Multi-select", hint: "Pick many" },
    ],
  },
  {
    title: "Upload & more",
    types: [
      { value: "attachment", label: "File upload", hint: "Photo / PDF" },
      { value: "email", label: "Email", hint: "" },
      { value: "phone", label: "Phone", hint: "" },
      { value: "time", label: "Time", hint: "" },
      { value: "query_dropdown", label: "Searchable list", hint: "Type to find" },
      { value: "section", label: "Section title", hint: "Group heading" },
    ],
  },
];

const ALL_TYPES = TYPE_GROUPS.flatMap((g) => g.types);

function optionsLabelFor(type) {
  if (type === "radio") return "Radio options";
  if (type === "multiselect") return "Multi-select options";
  return "Dropdown options";
}

function optionsHintFor(type) {
  if (type === "radio") return "Assignee picks exactly one. Add your own labels below.";
  if (type === "multiselect") return "Assignee can select several. Add your own labels below.";
  return "Assignee picks one from this list. Add or edit options before you create the task.";
}

/**
 * Inline field editor — no nested drawer.
 * Schema-compatible with form_schema / validateFormSchemaFields.
 */
export default function ClTaskFormFieldEditor({
  initialField = null,
  onSave,
  onCancel,
}) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState("");

  useEffect(() => {
    const base = initialField
      ? { ...initialField, options: [...(initialField.options || [])] }
      : newFormField("short_text");
    setDraft(base);
    setError("");
    setBulkText(optionsToText(base.options));
    setShowBulkPaste(false);
    setShowAdvanced(!!(base.help_text || base.placeholder || base.min != null || base.max != null));
  }, [initialField]);

  if (!draft) return null;

  const isSection = draft.type === "section";
  const hasOptions = FIELDS_WITH_OPTIONS.includes(draft.type);
  const meta = getFieldTypeMeta(draft.type);
  const typeMeta = ALL_TYPES.find((t) => t.value === draft.type);

  const setType = (type) => {
    const next = newFormField(type);
    const keepOpts =
      FIELDS_WITH_OPTIONS.includes(type) &&
      FIELDS_WITH_OPTIONS.includes(draft.type) &&
      draft.options?.length
        ? draft.options
        : next.options;
    const merged = {
      ...next,
      id: draft.id,
      label: draft.label,
      help_text: draft.help_text,
      required: draft.required,
      width: getDefaultFieldWidth(type),
      ...(FIELDS_WITH_OPTIONS.includes(type) ? { options: keepOpts.length ? keepOpts : ["Option 1", "Option 2"] } : {}),
      ...(type === "query_dropdown"
        ? { queryOptions: draft.queryOptions || bulkText || "" }
        : {}),
    };
    setDraft(merged);
    setBulkText(optionsToText(merged.options));
    setError("");
  };

  const setOptions = (options) => {
    setDraft((d) => ({ ...d, options }));
    setBulkText(optionsToText(options));
  };

  const applyBulkPaste = () => {
    const parsed = cleanFieldOptions(parseOptionsText(bulkText));
    if (!parsed.length) {
      setError("Add at least one option");
      return;
    }
    setOptions(parsed);
    setShowBulkPaste(false);
    setError("");
  };

  const handleSave = () => {
    let next = { ...draft };
    if (FIELDS_WITH_OPTIONS.includes(next.type)) {
      next.options = cleanFieldOptions(next.options);
      if (!next.options.length && bulkText.trim()) {
        next.options = cleanFieldOptions(parseOptionsText(bulkText));
      }
    }
    if (next.type === "query_dropdown" && !next.queryOptions?.trim()) {
      next.queryOptions = bulkText.trim();
    }
    const err = validateFormSchemaFields([next]);
    if (err) {
      setError(err);
      return;
    }
    onSave?.(next);
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-indigo-100 bg-indigo-50/60">
        <p className="text-xs font-semibold text-indigo-900">
          {initialField ? "Edit question" : "New question"}
          <span className="ml-1.5 font-normal text-indigo-500">· {meta.label}</span>
        </p>
      </div>

      <div className="p-3 space-y-4">
        {/* Type picker — grouped */}
        <div className="space-y-3">
          {TYPE_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                {group.title}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {group.types.map(({ value, label, hint }) => {
                  const active = draft.type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setType(value)}
                      className={`px-2.5 py-2 rounded-lg text-left border transition-colors ${
                        active
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                      }`}
                    >
                      <span className="block text-[11px] font-semibold leading-tight">{label}</span>
                      {hint ? (
                        <span
                          className={`block text-[9px] mt-0.5 leading-tight ${
                            active ? "text-indigo-100" : "text-slate-400"
                          }`}
                        >
                          {hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {typeMeta?.hint ? (
          <ClFormHint>
            {draft.type === "attachment"
              ? "Assignee can upload a file (photo, PDF, etc.) when submitting."
              : draft.type === "checkbox"
                ? "Shows as a Yes / No checkbox on the submit form."
                : hasOptions
                  ? optionsHintFor(draft.type)
                  : null}
          </ClFormHint>
        ) : null}

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            {isSection ? "Section title" : "Question label"} *
          </label>
          <input
            className={inputBase}
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder={
              isSection
                ? "e.g. Safety checks"
                : draft.type === "attachment"
                  ? "e.g. Upload photo of machine"
                  : draft.type === "checkbox"
                    ? "e.g. Area cleaned?"
                    : draft.type === "radio" || draft.type === "dropdown"
                      ? "e.g. Condition"
                      : "e.g. Machine name"
            }
            autoFocus
          />
        </div>

        {!isSection && (
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!draft.required}
              onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
              className="rounded border-slate-300 accent-indigo-600"
            />
            Required
          </label>
        )}

        {/* Choice options — create before submit */}
        {hasOptions && (
          <div className="space-y-2">
            <ClTaskFormOptionEditor
              label={optionsLabelFor(draft.type)}
              hint={optionsHintFor(draft.type)}
              options={draft.options?.length ? draft.options : [""]}
              onChange={(opts) => setOptions(opts.length ? opts : [""])}
              valueLabel="Option"
            />
            <button
              type="button"
              onClick={() => {
                setBulkText(optionsToText(draft.options));
                setShowBulkPaste((v) => !v);
              }}
              className="text-[11px] font-medium text-slate-500 hover:text-indigo-600"
            >
              {showBulkPaste ? "Hide paste" : "Paste many options at once"}
            </button>
            {showBulkPaste ? (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                <textarea
                  className={`${textareaBase} text-sm`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Good\nFair\nPoor"}
                  rows={3}
                />
                <button
                  type="button"
                  onClick={applyBulkPaste}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  Apply pasted options
                </button>
              </div>
            ) : null}
          </div>
        )}

        {draft.type === "query_dropdown" && (
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              List values (one per line)
            </label>
            <textarea
              className={`${textareaBase} min-h-[88px] text-sm`}
              value={draft.queryOptions || ""}
              onChange={(e) => setDraft((d) => ({ ...d, queryOptions: e.target.value }))}
              placeholder={"Red\nBlue\nGreen"}
              rows={4}
            />
            <ClFormHint>Assignee can search these values when filling the form.</ClFormHint>
          </div>
        )}

        {draft.type === "attachment" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-700">File upload</p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              No extra setup needed — the assignee will see an upload control on submit.
            </p>
          </div>
        )}

        {draft.type === "checkbox" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-700">Checkbox (Yes / No)</p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              No option list needed — answers are Yes or No.
            </p>
          </div>
        )}

        {!isSection && (
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600"
            >
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              More options
            </button>
            {showAdvanced ? (
              <div className="mt-2 space-y-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Help text</label>
                  <input
                    className={inputBase}
                    value={draft.help_text || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, help_text: e.target.value }))}
                    placeholder="Optional hint under the question"
                  />
                </div>
                {(draft.type === "short_text" ||
                  draft.type === "text" ||
                  draft.type === "numeric" ||
                  draft.type === "email" ||
                  draft.type === "phone") && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Placeholder</label>
                    <input
                      className={inputBase}
                      value={draft.placeholder || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, placeholder: e.target.value }))}
                    />
                  </div>
                )}
                {draft.type === "numeric" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Min</label>
                      <input
                        type="number"
                        className={inputBase}
                        value={draft.min ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            min: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Max</label>
                      <input
                        type="number"
                        className={inputBase}
                        value={draft.max ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            max: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Width on form</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { value: "half", label: "Half row" },
                      { value: "full", label: "Full row" },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, width: value }))}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border ${
                          (draft.width || getDefaultFieldWidth(draft.type)) === value
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <ClFormError msg={error} />

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
          >
            {initialField ? "Save question" : "Add question"}
          </button>
        </div>
      </div>
    </div>
  );
}
