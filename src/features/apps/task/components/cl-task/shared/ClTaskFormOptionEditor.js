import { Plus, Trash2, List } from "lucide-react";
import { inputBase } from "./clTaskFormUi";

export default function ClTaskFormOptionEditor({ label, hint, options = [], onChange, valueLabel = "Value" }) {
  const update = (idx, val) => {
    const next = [...options];
    next[idx] = val;
    onChange(next);
  };

  const add = () => onChange([...options, `Option ${options.length + 1}`]);

  const remove = (idx) => onChange(options.filter((_, i) => i !== idx));

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 overflow-hidden">
      <div className="px-3 py-2 border-b border-indigo-100 bg-white/80 flex items-center gap-2">
        <List size={14} className="text-indigo-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-indigo-800">{label}</p>
          {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
        </div>
      </div>
      <div className="p-3 space-y-2">
        {options.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-2">No values yet — add at least one</p>
        ) : (
          options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="shrink-0 w-6 h-6 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-400 flex items-center justify-center">
                {idx + 1}
              </span>
              <input
                className={`${inputBase} flex-1 !min-h-[36px] !py-2 text-sm`}
                value={opt}
                onChange={(e) => update(idx, e.target.value)}
                placeholder={`${valueLabel} ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={options.length <= 1}
                className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg"
                title="Remove value"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
        <button
          type="button"
          onClick={add}
          className="w-full py-2 rounded-lg border border-dashed border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-white flex items-center justify-center gap-1.5"
        >
          <Plus size={14} /> Add {valueLabel}
        </button>
      </div>
    </div>
  );
}
