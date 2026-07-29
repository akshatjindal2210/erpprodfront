/** Outer shell for list/report pages — fills content area so the table scrolls (sticky headers). */
export const IMS_LIST_PAGE_SHELL =
  "flex flex-col flex-1 min-h-0 h-full max-h-full w-full bg-slate-100 overflow-hidden";

/** Table body text — reports, activity log, box transaction log, schedule modals. */
export const IMS_TABLE_CELL_TEXT = "text-[11px] text-slate-700 font-medium";
export const IMS_TABLE_CELL_NUMBER = "text-[11px] font-semibold text-slate-800 tabular-nums";
export const IMS_TABLE_CELL_DATE = "text-[11px] text-slate-600 font-semibold tabular-nums";
export const IMS_MODAL_LABEL = "text-[10px] font-bold text-slate-600 uppercase tracking-wide";

/**
 * Neutral aliases for shared list chrome.
 * Prefer these in new apps (e.g. rmstore) — same classes, no IMS product coupling.
 * Legacy `IMS_*` names remain for existing IMS/Task imports.
 */
export const LIST_PAGE_SHELL = IMS_LIST_PAGE_SHELL;
export const TABLE_CELL_TEXT = IMS_TABLE_CELL_TEXT;
export const TABLE_CELL_NUMBER = IMS_TABLE_CELL_NUMBER;
export const TABLE_CELL_DATE = IMS_TABLE_CELL_DATE;
export const MODAL_LABEL = IMS_MODAL_LABEL;
