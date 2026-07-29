const FOCUSABLE_SELECTOR = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function resolveFocusable(el) {
  if (!el) return null;
  if (el.matches?.(FOCUSABLE_SELECTOR)) return el;
  return el.querySelector?.(FOCUSABLE_SELECTOR) || null;
}

export function focusAndScroll(el, options = {}) {
  if (!el || typeof el.scrollIntoView !== "function") return false;

  const { behavior = "smooth", block = "center" } = options;
  el.scrollIntoView({ behavior, block });

  const focusable = resolveFocusable(el);
  if (focusable?.focus) {
    try {
      focusable.focus({ preventScroll: true });
    } catch {
      focusable.focus();
    }
    return true;
  }
  return false;
}

export function focusFirstError(errors, fieldOrder, getElement) {
  if (!errors || !fieldOrder?.length) return null;

  for (const key of fieldOrder) {
    if (!errors[key]) continue;
    const el = getElement(key);
    if (el) {
      focusAndScroll(el);
      return key;
    }
  }
  return null;
}
