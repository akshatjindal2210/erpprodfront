import { Pencil, Trash2, User, Calendar, FileText } from "lucide-react";

const BAR_COLOR = "#f43f5e";

export default function RedTicketCard({ row, index, onEdit, onDelete, canEdit, canDelete }) {
  const description = String(row.description ?? "").trim();

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full"
      style={{ backgroundColor: `${BAR_COLOR}0d` }}
    >
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: BAR_COLOR }} />

      <div className="px-3 py-3 flex flex-col gap-2.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-slate-400 font-mono">#{index}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                -{row.score_penalty || 0} MIS
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <User size={13} className="text-rose-400 shrink-0" />
              <h3 className="font-semibold text-slate-800 text-sm truncate" title={row.person_name}>
                {row.person_name ?? "—"}
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {[row.department_name, row.designation_name].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit?.(row)}
                className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete?.(row)}
                className="p-1.5 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {description && (
          <div className="flex items-start gap-1.5 min-w-0 bg-slate-50/80 rounded-lg px-2.5 py-2 border border-slate-100">
            <FileText size={11} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed min-w-0" title={description}>
              {description}
            </p>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-auto pt-1">
          <Calendar size={11} />
          <span>{row.ticket_date ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}
