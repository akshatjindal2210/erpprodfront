/** Shared footer selection labels for Task / Settings (admin console) lists. */

function t(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

export const consoleListSelectionLabel = {
  name: (r) => `Selected: ${t(r?.name)}`,
  module: (r) => `Selected: ${t(r?.name ?? r?.label)}`,
  user: (r) => `Selected: ${t(r?.name ?? r?.username)}`,
  taskTitle: (r, idField = "task_id") => `Selected: ${t(r?.title) || `#${r?.[idField] ?? "—"}`}`,
  recurring: (r) => `Selected: ${t(r?.title) || `#${r?.recurring_id ?? "—"}`}`,
  redTicket: (r, id) => `Selected: ${t(r?.person_name) || `#${id ?? r?.id ?? "—"}`}`,
  clTaskMaster: (r) => `Selected: ${t(r?.title ?? r?.cl_task_id)}`,
  clTaskInstance: (r) => `Selected: ${t(r?.title ?? r?.instance_id)}`,
};

/** Center footer legend (task status colors, recurring stat chips, etc.). */
export function ListFooterColorLegend({ items, compact = false, scrollStrip = false }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const strip = compact && scrollStrip;
  return (
    <div
      className={
        strip
          ? "flex flex-nowrap items-center gap-x-2.5 w-max py-0.5"
          : compact
            ? "flex flex-wrap items-center justify-center max-w-full gap-x-2 gap-y-0.5 leading-tight"
            : "flex flex-nowrap sm:flex-wrap items-center justify-center max-w-full gap-x-3 sm:gap-x-4 gap-y-1"
      }
    >
      {items.map(({ label, barColor, color }) => (
        <div key={label} className={`flex items-center shrink-0 ${compact ? "gap-1" : "gap-1.5"}`}>
          {barColor != null ? (
            <span
              className={`rounded-full flex-shrink-0 ring-1 ring-black/10 ${compact ? "w-1.5 h-1.5" : "w-2 h-2"}`}
              style={{ backgroundColor: barColor }}
            />
          ) : color != null ? (
            <span
              className={`rounded-full flex-shrink-0 ring-1 ring-black/10 ${compact ? "w-1.5 h-1.5" : "w-2 h-2"}`}
              style={{ backgroundColor: color }}
            />
          ) : null}
          <span
            className={`text-slate-600 font-bold uppercase tracking-wide whitespace-nowrap ${
              compact ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[10px]"
            }`}
            title={label}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
