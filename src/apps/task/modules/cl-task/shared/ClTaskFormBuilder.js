"use client";

import { Plus, Trash2, ListChecks } from "lucide-react";
import { FIELDS_WITH_OPTIONS, newFormField, getDefaultFieldWidth, cleanFieldOptions } from "@/apps/task/lib/helpers/clTaskFormHelper";
import { inputBase, formMicroLabelClass, ClFormSection } from "./clTaskFormUi";

/** Basic → advanced form types */
const FORM_TYPES = [
  { value: "short_text", label: "Text" },
  { value: "numeric", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multiselect", label: "Multi Select" },
  { value: "attachment", label: "File Upload" },
];

/**
 * Form builder — types for basic to advanced forms.
 */
export default function ClTaskFormBuilder({ fields = [], onChange }) {
  const patch = (idx, partial) => {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...partial } : f)));
  };

  const setType = (idx, type) => {
    const field = fields[idx];
    const prevOpts = cleanFieldOptions(field.options);
    const keepOpts =
      FIELDS_WITH_OPTIONS.includes(type) &&
      FIELDS_WITH_OPTIONS.includes(field.type) &&
      prevOpts.length
        ? prevOpts
        : FIELDS_WITH_OPTIONS.includes(type)
          ? ["Option 1", "Option 2"]
          : [];
    patch(idx, {
      ...newFormField(type),
      id: field.id,
      label: field.label,
      help_text: field.help_text,
      required: field.required,
      placeholder: field.placeholder,
      width: getDefaultFieldWidth(type),
      ...(FIELDS_WITH_OPTIONS.includes(type) ? { options: keepOpts } : { options: [] }),
    });
  };

  const setOption = (idx, optIdx, value) => {
    const options = [...(fields[idx].options?.length ? fields[idx].options : [""])];
    options[optIdx] = value;
    patch(idx, { options });
  };

  const addOption = (idx) => {
    patch(idx, { options: [...(fields[idx].options || []), ""] });
  };

  const removeOption = (idx, optIdx) => {
    const options = (fields[idx].options || []).filter((_, i) => i !== optIdx);
    patch(idx, { options: options.length ? options : [""] });
  };

  const addQuestion = () => onChange([...fields, newFormField("short_text")]);
  const removeQuestion = (idx) => onChange(fields.filter((_, i) => i !== idx));

  return (
    <ClFormSection title="Form questions">
      <div className="space-y-3">
        {fields.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-2">
            No questions yet — add one below.
          </p>
        )}

        {fields.map((field, idx) => {
          const isSection = field.type === "section";
          const hasOptions = FIELDS_WITH_OPTIONS.includes(field.type);
          const showPlaceholder = ["short_text", "text", "numeric", "email", "phone"].includes(
            field.type,
          );
          const width = field.width || getDefaultFieldWidth(field.type);
          const typeOptions =
            field.type === "text"
              ? [
                  { value: "text", label: "Text" },
                  ...FORM_TYPES.filter((t) => t.value !== "short_text"),
                ]
              : FORM_TYPES.some((t) => t.value === field.type)
                ? FORM_TYPES
                : [...FORM_TYPES, { value: field.type, label: field.type }];

          const choiceOptions =
            hasOptions && cleanFieldOptions(field.options).length
              ? field.options
              : hasOptions
                ? ["Option 1", "Option 2"]
                : [];

          return (
            <div
              key={field.id}
              className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`${formMicroLabelClass} text-slate-400`}>
                  Question #{idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  {!isSection && (
                    <label
                      className={`inline-flex items-center gap-1.5 ${formMicroLabelClass} text-slate-500 cursor-pointer`}
                    >
                      <input
                        type="checkbox"
                        checked={!!field.required}
                        onChange={(e) => patch(idx, { required: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600"
                      />
                      Required
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="p-1 text-rose-400 hover:bg-rose-50 rounded-md"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                <div className="sm:col-span-2 min-w-0">
                  <label className={`block ${formMicroLabelClass} text-slate-500 mb-1`}>Type</label>
                  <select
                    className={inputBase}
                    value={field.type}
                    onChange={(e) => setType(idx, e.target.value)}
                  >
                    {typeOptions.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {!isSection && (
                  <div className="min-w-0">
                    <label className={`block ${formMicroLabelClass} text-slate-500 mb-1`}>
                      Width
                    </label>
                    <div className="flex gap-1">
                      {[
                        { value: "half", label: "Half" },
                        { value: "full", label: "Full" },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => patch(idx, { width: value })}
                          className={`flex-1 h-9 rounded-md text-[11px] font-bold border transition-colors ${
                            width === value
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={`block ${formMicroLabelClass} text-slate-500 mb-1`}>
                  {isSection ? "Section title" : "Label"}
                </label>
                <input
                  className={inputBase}
                  value={field.label || ""}
                  onChange={(e) => patch(idx, { label: e.target.value })}
                  placeholder={isSection ? "e.g. Safety checks" : "e.g. Name"}
                />
              </div>

              {!isSection && (
                <div
                  className={`grid gap-2 ${showPlaceholder ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
                >
                  <div className="min-w-0">
                    <label className={`block ${formMicroLabelClass} text-slate-500 mb-1`}>
                      Help text
                    </label>
                    <input
                      className={inputBase}
                      value={field.help_text || ""}
                      onChange={(e) => patch(idx, { help_text: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  {showPlaceholder && (
                    <div className="min-w-0">
                      <label className={`block ${formMicroLabelClass} text-slate-500 mb-1`}>
                        Placeholder
                      </label>
                      <input
                        className={inputBase}
                        value={field.placeholder || ""}
                        onChange={(e) => patch(idx, { placeholder: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                  )}
                </div>
              )}

              {field.type === "numeric" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block ${formMicroLabelClass} text-slate-500 mb-1`}>Min</label>
                    <input
                      type="number"
                      className={inputBase}
                      value={field.min ?? ""}
                      onChange={(e) =>
                        patch(idx, {
                          min: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={`block ${formMicroLabelClass} text-slate-500 mb-1`}>Max</label>
                    <input
                      type="number"
                      className={inputBase}
                      value={field.max ?? ""}
                      onChange={(e) =>
                        patch(idx, {
                          max: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {hasOptions && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <ListChecks size={12} className="text-indigo-500" />
                    <span className={`${formMicroLabelClass} text-slate-500`}>Choices</span>
                  </div>
                  {choiceOptions.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-1.5">
                      <input
                        className={`${inputBase} flex-1 !bg-white`}
                        value={opt}
                        onChange={(e) => {
                          if (!cleanFieldOptions(field.options).length) {
                            const seeded = [...choiceOptions];
                            seeded[optIdx] = e.target.value;
                            patch(idx, { options: seeded });
                          } else {
                            setOption(idx, optIdx, e.target.value);
                          }
                        }}
                        placeholder={`Choice ${optIdx + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!cleanFieldOptions(field.options).length) {
                            const seeded = choiceOptions.filter((_, i) => i !== optIdx);
                            patch(idx, { options: seeded.length ? seeded : [""] });
                          } else {
                            removeOption(idx, optIdx);
                          }
                        }}
                        disabled={choiceOptions.length <= 1}
                        className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-md disabled:opacity-30"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (!cleanFieldOptions(field.options).length) {
                        patch(idx, { options: [...choiceOptions, ""] });
                      } else {
                        addOption(idx);
                      }
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    + Add choice
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex justify-end pt-0.5">
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-md shadow-sm"
          >
            <Plus size={12} /> Add Question
          </button>
        </div>
      </div>
    </ClFormSection>
  );
}
