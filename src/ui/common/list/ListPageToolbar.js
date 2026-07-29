"use client";

/** Toolbar shell below list page header (tabs, actions, view toggle). */
export function ListPageToolbar({ children }) {
  return (
    <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
      {children}
    </div>
  );
}

/**
 * Phone: tabs + actions + view toggle wrap together (no horizontal scroll).
 * Laptop (md+): tabs/actions on the left, list/table toggle pinned on the right.
 */
export function ListPageToolbarLayout({ tabs, subTabs, actions, viewToggle }) {
  return (
    <div className="flex flex-wrap items-center gap-2 w-full min-w-0 md:justify-between">
      <div className="contents md:flex md:flex-wrap md:items-center md:gap-2 md:min-w-0 md:flex-1">
        {tabs}
        {subTabs}
        {actions}
      </div>
      {viewToggle ? <div className="shrink-0 relative z-[80]">{viewToggle}</div> : null}
    </div>
  );
}

/** Optional shared button height — pages may keep their original className instead. */
export const LIST_PAGE_ACTION_CLASS =
  "rounded-none h-9 shrink-0 text-[11px] font-bold uppercase shadow-none";
