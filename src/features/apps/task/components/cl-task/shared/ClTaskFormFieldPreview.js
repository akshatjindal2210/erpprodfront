import {
  Type, AlignLeft, Hash, Mail, Phone, Calendar, Clock, CheckSquare,
  CircleDot, ChevronDown, ListChecks, Search, Paperclip, Minus,
} from "lucide-react";
import { getFieldTypeMeta } from "@/features/apps/task/helpers/clTaskFormHelper";
import { inputBase } from "./clTaskFormUi";

const ICONS = {
  short_text: Type,
  text: AlignLeft,
  numeric: Hash,
  email: Mail,
  phone: Phone,
  date: Calendar,
  time: Clock,
  checkbox: CheckSquare,
  radio: CircleDot,
  dropdown: ChevronDown,
  multiselect: ListChecks,
  query_dropdown: Search,
  attachment: Paperclip,
  section: Minus,
};

export default function ClTaskFormFieldPreview({ field }) {
  const meta = getFieldTypeMeta(field.type);
  const Icon = ICONS[field.type] || Type;
  const label = field.label?.trim() || "Untitled field";
  const opts = (field.options || []).filter((o) => String(o).trim());

  if (field.type === "section") {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{label}</p>
        {field.help_text && <p className="text-[11px] text-slate-400 mt-0.5">{field.help_text}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 opacity-90 pointer-events-none select-none">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={12} className="text-indigo-400" />
        <span className="text-[10px] font-bold uppercase text-slate-400">{meta.label} · Preview</span>
      </div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}
        {field.required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {field.help_text && <p className="text-[11px] text-slate-400 mb-1.5">{field.help_text}</p>}

      {field.type === "short_text" && (
        <input className={inputBase} placeholder={field.placeholder || "Short answer…"} disabled />
      )}
      {field.type === "text" && (
        <textarea className={`${inputBase} min-h-[48px]`} placeholder={field.placeholder || "Long answer…"} disabled rows={2} />
      )}
      {(field.type === "numeric" || field.type === "email" || field.type === "phone") && (
        <input className={inputBase} placeholder={field.placeholder || meta.label} disabled />
      )}
      {field.type === "date" && <input type="date" className={inputBase} disabled />}
      {field.type === "time" && <input type="time" className={inputBase} disabled />}
      {field.type === "checkbox" && (
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" disabled className="rounded" /> Yes
        </label>
      )}
      {field.type === "radio" && (
        <div className="space-y-1">
          {(opts.length ? opts : ["Option 1"]).map((o) => (
            <label key={o} className="flex items-center gap-2 text-xs text-slate-500">
              <input type="radio" disabled /> {o}
            </label>
          ))}
        </div>
      )}
      {field.type === "dropdown" && (
        <div className={`${inputBase} flex items-center justify-between text-slate-400`}>
          <span>{opts[0] || "Select…"}</span>
          <ChevronDown size={14} />
        </div>
      )}
      {field.type === "multiselect" && (
        <div className="flex flex-wrap gap-1">
          {(opts.length ? opts.slice(0, 3) : ["Option 1"]).map((o) => (
            <span key={o} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">{o}</span>
          ))}
        </div>
      )}
      {field.type === "query_dropdown" && (
        <div className={`${inputBase} flex items-center gap-2 text-slate-400`}>
          <Search size={14} /> Search or type…
        </div>
      )}
      {field.type === "attachment" && (
        <div className="border border-dashed border-slate-200 rounded-lg py-3 text-center text-xs text-slate-400">
          <Paperclip size={14} className="inline mr-1" /> Upload file
        </div>
      )}
    </div>
  );
}
