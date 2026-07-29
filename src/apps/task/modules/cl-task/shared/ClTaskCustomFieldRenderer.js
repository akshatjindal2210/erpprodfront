"use client";

import { useState } from "react";
import { parseFormSchema, parseOptionsText, getFieldGridClass } from "@/apps/task/lib/helpers/clTaskFormHelper";
import { inputBase, textareaBase, formMicroLabelClass } from "./clTaskFormUi";
import SearchableSelect from "../../../lib/ui/common/SearchableSelect";
import ClTaskAttachmentsField, { parseAttachments } from "./ClTaskAttachmentBlock";

function AttachmentFieldInput({ fieldId, value, onChange, disabled, readOnly }) {
  const list = parseAttachments(value);
  if (readOnly || disabled) {
    if (!list.length) {
      return (
        <div className="text-sm text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
          —
        </div>
      );
    }
    return (
      <ClTaskAttachmentsField
        value={list}
        readOnly
        label=""
        inputId={`cl-form-upload-${fieldId}`}
      />
    );
  }
  return (
    <ClTaskAttachmentsField
      value={list}
      onChange={(next) => onChange(next?.length ? next : null)}
      label=""
      accept="image/*,.pdf,.doc,.docx"
      inputId={`cl-form-upload-${fieldId}`}
      maxFiles={10}
    />
  );
}

function QueryDropdownField({ field, value, onChange, disabled }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const options = parseOptionsText(field.queryOptions);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <input
        className={inputBase}
        value={value ?? search}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={field.placeholder || "Search or type…"}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={() => {
                onChange(opt);
                setSearch(opt);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 active:bg-indigo-100"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldLabel({ field }) {
  if (field.type === "section") {
    return (
      <div className="pt-1 pb-1 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-700">{field.label}</p>
        {field.help_text ? <p className="text-xs text-slate-500 mt-0.5">{field.help_text}</p> : null}
      </div>
    );
  }
  return (
    <>
      <label className={`block ${formMicroLabelClass} text-slate-600 mb-1.5`}>
        {field.label}
        {field.required ? <span className="text-rose-500 ml-0.5">*</span> : null}
      </label>
      {field.help_text ? (
        <p className="text-[11px] text-slate-400 mb-1.5 leading-snug">{field.help_text}</p>
      ) : null}
    </>
  );
}

function formatReadValue(field, val) {
  if (field.type === "checkbox") return val === true ? "Yes" : val === false ? "No" : "—";
  if (field.type === "multiselect") return Array.isArray(val) ? val.join(", ") : String(val ?? "—");
  if (field.type === "attachment") {
    const list = parseAttachments(val);
    if (!list.length) return "—";
    return list.map((a) => a.file_name || a.name || "file").join(", ");
  }
  return String(val ?? "—");
}

const choiceRowClass =
  "flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 cursor-pointer hover:border-indigo-300";

/**
 * Shared fill / edit / verify form fields — mobile-first, system UI density.
 */
export default function ClTaskCustomFieldRenderer({
  schema,
  values,
  onChange,
  disabled = false,
  readOnly = false,
}) {
  const fields = parseFormSchema(schema);

  if (!fields.length) return null;

  const set = (id, val) => onChange?.({ ...values, [id]: val });

  const toggleMulti = (id, opt) => {
    const current = Array.isArray(values[id]) ? values[id] : [];
    const next = current.includes(opt) ? current.filter((v) => v !== opt) : [...current, opt];
    set(id, next);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {fields.map((field) => {
        if (field.type === "section") {
          return (
            <div key={field.id} className="col-span-1 sm:col-span-2">
              <FieldLabel field={field} />
            </div>
          );
        }

        const val = values[field.id];

        return (
          <div key={field.id} className={`min-w-0 ${getFieldGridClass(field)}`}>
            <FieldLabel field={field} />

            {readOnly ? (
              field.type === "attachment" ? (
                <AttachmentFieldInput fieldId={field.id} value={val} readOnly />
              ) : (
                <div className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 min-h-[40px]">
                  {formatReadValue(field, val)}
                </div>
              )
            ) : (
              <>
                {field.type === "short_text" && (
                  <input
                    type="text"
                    className={inputBase}
                    value={val || ""}
                    disabled={disabled}
                    placeholder={field.placeholder || "Type here…"}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}

                {field.type === "text" && (
                  <textarea
                    className={textareaBase}
                    value={val || ""}
                    disabled={disabled}
                    placeholder={field.placeholder || "Type here…"}
                    onChange={(e) => set(field.id, e.target.value)}
                    rows={3}
                  />
                )}

                {field.type === "numeric" && (
                  <input
                    type="number"
                    inputMode="decimal"
                    className={inputBase}
                    value={val ?? ""}
                    min={field.min ?? undefined}
                    max={field.max ?? undefined}
                    disabled={disabled}
                    placeholder={field.placeholder || "0"}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}

                {field.type === "email" && (
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={inputBase}
                    value={val || ""}
                    disabled={disabled}
                    placeholder={field.placeholder || "name@company.com"}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}

                {field.type === "phone" && (
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={inputBase}
                    value={val || ""}
                    disabled={disabled}
                    placeholder={field.placeholder || "Phone number"}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}

                {field.type === "date" && (
                  <input
                    type="date"
                    className={inputBase}
                    value={val || ""}
                    disabled={disabled}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}

                {field.type === "time" && (
                  <input
                    type="time"
                    className={inputBase}
                    value={val || ""}
                    disabled={disabled}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}

                {field.type === "checkbox" && (
                  <label className={`${choiceRowClass} ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
                    <input
                      type="checkbox"
                      checked={!!val}
                      disabled={disabled}
                      onChange={(e) => set(field.id, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-indigo-600 shrink-0"
                    />
                    <span>Yes</span>
                  </label>
                )}

                {field.type === "radio" && (
                  <div className="space-y-2">
                    {(field.options || []).map((opt) => (
                      <label
                        key={opt}
                        className={`${choiceRowClass} ${disabled ? "opacity-60 pointer-events-none" : ""}`}
                      >
                        <input
                          type="radio"
                          name={field.id}
                          checked={val === opt}
                          disabled={disabled}
                          onChange={() => set(field.id, opt)}
                          className="h-4 w-4 accent-indigo-600 shrink-0"
                        />
                        <span className="leading-snug">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {field.type === "dropdown" && (
                  <SearchableSelect
                    options={(field.options || []).map((o) => ({ id: o, name: o }))}
                    value={val || ""}
                    onChange={(id) => set(field.id, id)}
                    placeholder={field.placeholder || "Select…"}
                    disabled={disabled}
                  />
                )}

                {field.type === "multiselect" && (
                  <div className="flex flex-wrap gap-2">
                    {(field.options || []).map((opt) => {
                      const selected = Array.isArray(val) && val.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleMulti(field.id, opt)}
                          className={`min-h-[40px] px-3.5 py-2 rounded-lg text-sm font-semibold border transition-all active:scale-[0.98] ${
                            selected
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {field.type === "query_dropdown" && (
                  <QueryDropdownField
                    field={field}
                    value={val}
                    onChange={(v) => set(field.id, v)}
                    disabled={disabled}
                  />
                )}

                {field.type === "attachment" && (
                  <AttachmentFieldInput
                    fieldId={field.id}
                    value={val}
                    onChange={(files) => set(field.id, files)}
                    disabled={disabled}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
