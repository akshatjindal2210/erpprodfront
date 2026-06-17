import { Plus, Trash2, GripVertical, LayoutTemplate, ChevronUp, ChevronDown } from "lucide-react";
import { CL_FORM_FIELD_TYPES, FIELDS_WITH_OPTIONS, newFormField, getFieldTypeMeta } from "@/features/apps/task/helpers/clTaskFormHelper";
import { inputBase } from "./clTaskFormUi";
import ClTaskFormOptionEditor from "./ClTaskFormOptionEditor";
import ClTaskFormFieldPreview from "./ClTaskFormFieldPreview";

const GROUPS = [...new Set(CL_FORM_FIELD_TYPES.map((t) => t.group))];

function FieldBuilderCard({ field, idx, total, onUpdate, onRemove, onMove, compact }) {
  const meta = getFieldTypeMeta(field.type);
  const isSection = field.type === "section";
  const hasOptions = FIELDS_WITH_OPTIONS.includes(field.type);

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${compact ? "border-slate-200" : "border-2 border-slate-200 shadow-sm rounded-2xl"}`}>
      <div className={`flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 ${compact ? "bg-slate-50" : "bg-gradient-to-r from-slate-50 to-indigo-50/40"}`}>
        {!compact && <GripVertical size={14} className="text-slate-300 shrink-0" />}
        <span className="text-[9px] font-bold text-slate-400">#{idx + 1}</span>
        <span className="text-[9px] font-bold uppercase text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
          {meta.label}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" disabled={idx === 0} onClick={() => onMove(idx, -1)} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
            <ChevronUp size={13} />
          </button>
          <button type="button" disabled={idx === total - 1} onClick={() => onMove(idx, 1)} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
            <ChevronDown size={13} />
          </button>
          <button type="button" onClick={onRemove} className="p-0.5 text-rose-400 hover:text-rose-600">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className={`space-y-2 ${compact ? "p-2" : "p-3 sm:p-4 space-y-3"}`}>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {isSection ? "Section Title *" : "Field Label *"}
          </label>
          <input
            className={inputBase}
            placeholder={isSection ? "e.g. Machine Details" : "e.g. Select Machine"}
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {isSection ? "Section Description" : "Help Text (shown to user)"}
          </label>
          <input
            className={inputBase}
            placeholder="Optional hint below the label"
            value={field.help_text || ""}
            onChange={(e) => onUpdate({ help_text: e.target.value })}
          />
        </div>

        {(field.type === "short_text" || field.type === "text" || field.type === "numeric" || field.type === "email" || field.type === "phone") && (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Placeholder</label>
            <input
              className={inputBase}
              placeholder="Shown inside the input"
              value={field.placeholder || ""}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
            />
          </div>
        )}

        {field.type === "numeric" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Min</label>
              <input type="number" className={inputBase} value={field.min ?? ""} onChange={(e) => onUpdate({ min: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Max</label>
              <input type="number" className={inputBase} value={field.max ?? ""} onChange={(e) => onUpdate({ max: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
          </div>
        )}

        {hasOptions && (
          <ClTaskFormOptionEditor
            label={field.type === "radio" ? "Radio Options" : field.type === "multiselect" ? "Multi-Select Values" : "Dropdown Values"}
            hint="User will pick from these values — add one per row"
            options={field.options || []}
            onChange={(options) => onUpdate({ options })}
            valueLabel={field.type === "dropdown" ? "Dropdown Value" : "Option"}
          />
        )}

        {field.type === "query_dropdown" && (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search Suggestions</label>
            <textarea
              className={`${inputBase} min-h-[72px] resize-y font-mono text-xs`}
              placeholder={"Machine A\nMachine B\nMachine C\n(one per line)"}
              value={field.queryOptions || ""}
              onChange={(e) => onUpdate({ queryOptions: e.target.value })}
              rows={4}
            />
            <p className="text-[10px] text-slate-400 mt-1">User can search these or type a custom value</p>
          </div>
        )}

        {field.type === "attachment" && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
            User will upload image, PDF or document when filling this task
          </div>
        )}

        {!isSection && (
          <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={!!field.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              className="rounded border-slate-300 accent-indigo-600"
            />
            Required
          </label>
        )}

        {!compact && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Live Preview</p>
            <ClTaskFormFieldPreview field={field} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClTaskFormBuilder({ fields, onChange, compact = false }) {
  const updateField = (idx, patch) => {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx) => onChange(fields.filter((_, i) => i !== idx));

  const addField = (type) => onChange([...fields, newFormField(type)]);

  const moveField = (idx, dir) => {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className={compact ? "rounded-lg border border-slate-200 bg-slate-50/80 p-2" : "rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4"}>
        {compact ? (
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Add field</p>
            <span className="text-[10px] font-bold text-indigo-600">{fields.length} field(s)</span>
          </div>
        ) : (
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <LayoutTemplate size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Form Builder</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Add fields below — configure labels, dropdown values & preview how users will see it
              </p>
            </div>
            <span className="ml-auto text-xs font-bold text-indigo-600 bg-white border border-indigo-100 px-2.5 py-1 rounded-lg shrink-0">
              {fields.length} {fields.length === 1 ? "field" : "fields"}
            </span>
          </div>
        )}

        <div className={compact ? "space-y-1.5" : "space-y-3"}>
          {GROUPS.map((group) => (
            <div key={group}>
              <p className={`font-bold text-slate-400 uppercase tracking-wider mb-1 ${compact ? "text-[9px]" : "text-[10px] mb-1.5"}`}>{group}</p>
              <div className="flex flex-wrap gap-1">
                {CL_FORM_FIELD_TYPES.filter((t) => t.group === group).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => addField(value)}
                    className={`inline-flex items-center gap-0.5 font-bold border bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-all ${
                      compact
                        ? "px-1.5 py-0.5 rounded text-[9px] border-slate-200"
                        : "px-2.5 py-1.5 rounded-lg text-[10px] border-white shadow-sm"
                    }`}
                  >
                    <Plus size={compact ? 8 : 10} /> {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {fields.length === 0 ? (
        <div className={`text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 ${compact ? "py-4" : "py-10 rounded-2xl border-2"}`}>
          {!compact && <LayoutTemplate size={32} className="mx-auto text-slate-300 mb-2" />}
          <p className={`font-medium text-slate-500 ${compact ? "text-xs" : "text-sm"}`}>No fields yet</p>
        </div>
      ) : (
        <div className={compact ? "space-y-2" : "space-y-4"}>
          {fields.map((field, idx) => (
            <FieldBuilderCard
              key={field.id}
              field={field}
              idx={idx}
              total={fields.length}
              compact={compact}
              onUpdate={(patch) => updateField(idx, patch)}
              onRemove={() => removeField(idx)}
              onMove={moveField}
            />
          ))}
        </div>
      )}
    </div>
  );
}
