"use client";

const FOOTER_TEXT_CLASS =
  "text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0";

/**
 * Unified RM Store list footer copy.
 * - Default: Showing X of Y {label}
 * - Client/search filter: · filtered from N (or 0 match · N total)
 * - Journey: Showing X of Y {label} (all DB)
 */
export function formatRmStoreListFooterText({
  shown,
  total,
  label = "Entries",
  databaseTotal,
  isFiltered = false,
  journeyMode = false,
  prefix = "",
}) {
  const s = Math.max(0, Number(shown) || 0);
  const t = Math.max(0, Number(total) || 0);
  const db =
    databaseTotal != null ? Math.max(0, Number(databaseTotal) || 0) : null;
  const lead = prefix ? `${prefix} ` : "";

  if (journeyMode) {
    return `${lead}Showing ${s} of ${t} ${label} (all DB)`;
  }

  if (isFiltered && db != null && (db !== t || t === 0)) {
    if (t === 0) {
      return `${lead}0 ${label} Match · ${db} Total`;
    }
    return `${lead}Showing ${s} of ${t} ${label} · Filtered From ${db}`;
  }

  return `${lead}Showing ${s} of ${t} ${label}`;
}

/** Client-side search/filter helper for list pages. */
export function rmStoreFooterFromClientFilter({
  tempSearch,
  sourceRows,
  filteredRows,
  serverFiltered = false,
}) {
  const hasClientSearch = Boolean(String(tempSearch ?? "").trim());
  const sourceLen = Array.isArray(sourceRows) ? sourceRows.length : 0;
  const filteredLen = Array.isArray(filteredRows) ? filteredRows.length : 0;
  const narrowed = hasClientSearch || filteredLen !== sourceLen;

  return {
    isFiltered: narrowed || serverFiltered,
    databaseTotal: narrowed ? sourceLen : undefined,
  };
}

/**
 * IMS-style list footer — count (left), optional legend (center), live indicator (right).
 */
export default function RmStoreListFooter({
  shown,
  total,
  label = "Entries",
  databaseTotal,
  isFiltered = false,
  journeyMode = false,
  prefix = "",
  showLive = true,
  extra = null,
  children = null,
}) {
  const countText =
    children == null
      ? formatRmStoreListFooterText({
          shown,
          total,
          label,
          databaseTotal,
          isFiltered,
          journeyMode,
          prefix,
        })
      : null;

  return (
    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 shrink-0">
      <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-2">
        {children ?? <span className={FOOTER_TEXT_CLASS}>{countText}</span>}
        {extra ? (
          <span className="text-[9px] text-slate-500 text-center justify-self-center px-1">{extra}</span>
        ) : (
          <span className="hidden sm:block" aria-hidden />
        )}
        {showLive ? (
          <div className="flex items-center gap-2 shrink-0 sm:justify-self-end">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        ) : (
          <span className="hidden sm:block" aria-hidden />
        )}
      </div>
    </div>
  );
}

export { FOOTER_TEXT_CLASS };
