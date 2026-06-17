import { Pencil, Trash2, User, FileText } from "lucide-react";

const BAR_COLOR = "#f43f5e";

function blendWithWhite(hex, alpha = 0.09) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const br = Math.round(r * alpha + 255 * (1 - alpha));
  const bg = Math.round(g * alpha + 255 * (1 - alpha));
  const bb = Math.round(b * alpha + 255 * (1 - alpha));
  return `rgb(${br},${bg},${bb})`;
}

export default function RedTicketTableRow({ row, index, onEdit, onDelete, canEdit, canDelete }) {
  const stickyBg = blendWithWhite(BAR_COLOR, 0.09);
  const rowBg = { backgroundColor: `${BAR_COLOR}14` };
  const description = String(row.description ?? "").trim();

  return (
    <tr className="transition-colors hover:brightness-[0.98]" style={rowBg}>
      <td className="w-1 p-0 sticky left-0 z-[2]" style={{ backgroundColor: stickyBg }}>
        <div className="w-[5px] min-h-[52px]" style={{ backgroundColor: BAR_COLOR }} />
      </td>

      <td
        className="px-2 py-3 w-8 text-xs font-mono sticky left-[5px] z-[2] border-r border-slate-200 text-slate-400"
        style={{ backgroundColor: stickyBg }}
      >
        {index}
      </td>

      <td
        className="px-4 py-3 min-w-[140px] max-w-[180px] sticky left-[42px] z-[2] border-r border-slate-200"
        style={{ backgroundColor: stickyBg }}
      >
        <div className="flex items-start gap-2 min-w-0">
          <User size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate" title={row.person_name}>
              {row.person_name ?? "—"}
            </p>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              {[row.department_name, row.designation_name].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate hidden md:table-cell">
        {row.department_name || "—"}
      </td>
      <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate hidden lg:table-cell">
        {row.designation_name || "—"}
      </td>

      <td className="px-4 py-3 text-slate-600 min-w-[200px] max-w-[320px]">
        <div className="flex items-start gap-2 min-w-0">
          <FileText size={13} className="text-slate-400 shrink-0 mt-0.5 hidden sm:block" />
          <p className="text-sm line-clamp-2 leading-snug" title={description}>
            {description || "—"}
          </p>
        </div>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          -{row.score_penalty || 0}
        </span>
      </td>

      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
        {row.ticket_date ?? "—"}
      </td>

      {(canEdit || canDelete) && (
        <td
          className="px-3 py-3 sticky right-0 z-[2] border-l border-slate-200 whitespace-nowrap"
          style={{ backgroundColor: stickyBg }}
        >
          <div className="flex items-center justify-end gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit?.(row)}
                className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete?.(row)}
                className="p-2 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
