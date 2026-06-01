"use client";

/** Common padded strip below toolbar for filters / search on list pages. */
export default function ListPageFilterStrip({ children, className = "" }) {
  return (
    <div
      data-list-page-filter-strip
      className={`px-3 md:px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0 min-w-0 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
