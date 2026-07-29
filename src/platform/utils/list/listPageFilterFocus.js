/** Focusable controls inside list-page filter strips (DOM order = first filter on page). */
export const LIST_PAGE_FILTER_FOCUSABLE_SELECTOR = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

export function getListPageFilterStrip() {
  if (typeof document === "undefined") return null;
  return document.querySelector("[data-list-page-filter-strip]");
}

export function getFirstListPageFilterControl(root = getListPageFilterStrip()) {
  if (!root) return null;
  const el = root.querySelector(LIST_PAGE_FILTER_FOCUSABLE_SELECTOR);
  return el instanceof HTMLElement ? el : null;
}

export function focusFirstListPageFilter() {
  const el = getFirstListPageFilterControl();
  if (!el) return false;
  el.focus();
  if (el instanceof HTMLInputElement && ["text", "search", ""].includes(el.type)) {
    try {
      el.select();
    } catch {
      // ignore if select is not supported
    }
  }
  return true;
}

export function isListPageFilterFocusBlocked(target) {
  if (typeof document === "undefined") return true;
  if (document.querySelector("[data-app-drawer-root]")) return true;
  if (document.querySelector('[role="dialog"]')) return true;
  if (target && typeof target.closest === "function") {
    if (target.closest("[data-app-drawer-root]")) return true;
    if (target.closest('[role="dialog"]')) return true;
  }
  return false;
}
