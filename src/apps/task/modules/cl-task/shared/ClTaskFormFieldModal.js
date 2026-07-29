"use client";

import { useEffect, useState } from "react";
import Drawer from "@/ui/primitives/Drawer";
import { CL_FORM_FIELD_TYPES, FIELDS_WITH_OPTIONS, newFormField, getDefaultFieldWidth, validateFormSchemaFields } from "@/apps/task/lib/helpers/clTaskFormHelper";
import { inputBase, textareaBase } from "./clTaskFormUi";

/** Tiny add/edit question popup — question, type, choices only. */
export default function ClTaskFormFieldModal({ open, initialField = null, onClose, onSave }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setDraft(
      initialField
        ? { ...initialField, options: [...(initialField.options || [])] }
        : newFormField("short_text"),
    );
  }, [open, initialField]);

  const isSection = draft?.type === "section";
  const hasOptions = draft ? FIELDS_WITH_OPTIONS.includes(draft.type) : false;

  const setType = (type) => {
    if (!draft) return;
    const next = newFormField(type);
    setDraft({
      ...next,
      id: draft.id,
      label: draft.label,
      required: draft.required,
      width: getDefaultFieldWidth(type),
      ...(FIELDS_WITH_OPTIONS.includes(type)
        ? { options: draft.options?.length ? draft.options : next.options }
        : {}),
      ...(type === "query_dropdown" ? { queryOptions: draft.queryOptions || "" } : {}),
    });
  };

  const setOption = (idx, value) => {
    const options = [...(draft.options?.length ? draft.options : [""])];
    options[idx] = value;
    setDraft((d) => ({ ...d, options }));
  };

  const addOption = () => {
    setDraft((d) => ({ ...d, options: [...(d.options || []), ""] }));
  };

  const removeOption = (idx) => {
    const options = (draft.options || []).filter((_, i) => i !== idx);
    setDraft((d) => ({ ...d, options: options.length ? options : [""] }));
  };

  const handleOk = () => {
    if (!draft) return;
    const err = validateFormSchemaFields([draft]);
    if (err) {
      setError(err);
      return;
    }
    onSave?.(draft);
    onClose?.();
  };

  return (
    <Drawer
      isOpen={open && !!draft}
      onClose={onClose}
      onSubmit={handleOk}
      closeOnOutside={false}
      stackLevel={1}
      title={initialField ? "Edit question" : "Add a question"}
      description="Write the question and how people should answer"
      headerVariant="form"
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOk}
            className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700"
          >
            {initialField ? "Save" : "Add to form"}
          </button>
        </>
      }
    >
      {draft && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {isSection ? "Section heading" : "Question"}
            </label>
            <input
              className={inputBase}
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="e.g. Area cleaned?"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Answer type</label>
            <select
              className={inputBase}
              value={draft.type}
              onChange={(e) => setType(e.target.value)}
            >
              {CL_FORM_FIELD_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {!isSection && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={!!draft.required}
                onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
                className="rounded border-slate-300 accent-indigo-600"
              />
              Required
            </label>
          )}

          {hasOptions && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600">Choices</p>
              {(draft.options?.length ? draft.options : [""]).map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    className={`${inputBase} flex-1`}
                    value={opt}
                    onChange={(e) => setOption(idx, e.target.value)}
                    placeholder={`Choice ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    disabled={(draft.options || []).length <= 1}
                    className="text-xs text-slate-400 hover:text-rose-600 disabled:opacity-30 px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addOption}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                + Add choice
              </button>
            </div>
          )}

          {draft.type === "query_dropdown" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Choices (one per line)
              </label>
              <textarea
                className={`${textareaBase} text-sm`}
                value={draft.queryOptions || ""}
                onChange={(e) => setDraft((d) => ({ ...d, queryOptions: e.target.value }))}
                rows={3}
                placeholder={"Good\nFair\nPoor"}
              />
            </div>
          )}

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
      )}
    </Drawer>
  );
}
