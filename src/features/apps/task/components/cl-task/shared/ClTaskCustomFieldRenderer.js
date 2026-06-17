import { useState } from "react";
import { parseFormSchema, parseOptionsText } from "@/features/apps/task/helpers/clTaskFormHelper";
import { FILE_BASE_URL } from "@/core/utils/lib";
import { inputBase } from "./clTaskFormUi";
import SearchableSelect from "../../common/SearchableSelect";

function QueryDropdownField({ field, value, onChange, disabled }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const options = parseOptionsText(field.queryOptions);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase()),
  );

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
        placeholder={field.placeholder || "Search or type value…"}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={() => { onChange(opt); setSearch(opt); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50"
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
      <div className="pt-2 pb-1 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-700 uppercase tracking-wide">{field.label}</p>
        {field.help_text && <p className="text-xs text-slate-500 mt-0.5">{field.help_text}</p>}
      </div>
    );
  }
  return (
    <>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {field.label}
        {field.required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {field.help_text && <p className="text-[11px] text-slate-400 mb-1.5">{field.help_text}</p>}
    </>
  );
}

function formatReadValue(field, val) {
  if (field.type === "checkbox") return val === true ? "Yes" : val === false ? "No" : "—";
  if (field.type === "multiselect") return Array.isArray(val) ? val.join(", ") : String(val ?? "—");
  if (field.type === "attachment" && val?.file_path) return val.file_name || "View attachment";
  return String(val ?? "—");
}

export default function ClTaskCustomFieldRenderer({ schema, values, onChange, disabled = false, readOnly = false }) {
  const fields = parseFormSchema(schema);

  if (!fields.length) return null;

  const set = (id, val) => onChange({ ...values, [id]: val });

  const toggleMulti = (id, opt) => {
    const current = Array.isArray(values[id]) ? values[id] : [];
    const next = current.includes(opt) ? current.filter((v) => v !== opt) : [...current, opt];
    set(id, next);
  };

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        if (field.type === "section") {
          return <FieldLabel key={field.id} field={field} />;
        }

        const val = values[field.id];

        return (
          <div key={field.id}>
            <FieldLabel field={field} />

            {readOnly ? (
              <div className="text-sm text-slate-700 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                {field.type === "attachment" && val?.file_path ? (
                  <a href={`${FILE_BASE_URL}/${val.file_path}`} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                    {val.file_name || "View attachment"}
                  </a>
                ) : (
                  formatReadValue(field, val)
                )}
              </div>
            ) : (
              <>
                {field.type === "short_text" && (
                  <input
                    type="text"
                    className={inputBase}
                    value={val || ""}
                    disabled={disabled}
                    placeholder={field.placeholder}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}

                {field.type === "text" && (
                  <textarea
                    className={`${inputBase} min-h-[60px] resize-y`}
                    value={val || ""}
                    disabled={disabled}
                    placeholder={field.placeholder}
                    onChange={(e) => set(field.id, e.target.value)}
                    rows={2}
                  />
                )}

                {field.type === "numeric" && (
                  <input
                    type="number"
                    className={inputBase}
                    value={val ?? ""}
                    min={field.min ?? undefined}
                    max={field.max ?? undefined}
                    disabled={disabled}
                    placeholder={field.placeholder}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}

                {field.type === "email" && (
                  <input
                    type="email"
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
                    className={inputBase}
                    value={val || ""}
                    disabled={disabled}
                    placeholder={field.placeholder || "+91 98765 43210"}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                )}

                {field.type === "date" && (
                  <input type="date" className={inputBase} value={val || ""} disabled={disabled} onChange={(e) => set(field.id, e.target.value)} />
                )}

                {field.type === "time" && (
                  <input type="time" className={inputBase} value={val || ""} disabled={disabled} onChange={(e) => set(field.id, e.target.value)} />
                )}

                {field.type === "checkbox" && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!val}
                      disabled={disabled}
                      onChange={(e) => set(field.id, e.target.checked)}
                      className="rounded border-slate-300 accent-indigo-600"
                    />
                    Yes
                  </label>
                )}

                {field.type === "radio" && (
                  <div className="space-y-1.5">
                    {(field.options || []).map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input
                          type="radio"
                          name={field.id}
                          checked={val === opt}
                          disabled={disabled}
                          onChange={() => set(field.id, opt)}
                          className="accent-indigo-600"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {field.type === "dropdown" && (
                  <SearchableSelect
                    options={(field.options || []).map((o) => ({ id: o, name: o }))}
                    value={val || ""}
                    onChange={(id) => set(field.id, id)}
                    placeholder={field.placeholder || "Select option"}
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            selected
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {field.type === "query_dropdown" && (
                  <QueryDropdownField field={field} value={val} onChange={(v) => set(field.id, v)} disabled={disabled} />
                )}

                {field.type === "attachment" && (
                  <div>
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      disabled={disabled}
                      onChange={(e) => set(field.id, e.target.files?.[0] || null)}
                      className="text-sm text-slate-600"
                    />
                    {val instanceof File && (
                      <p className="text-xs text-slate-400 mt-1">{val.name}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
