const FOCUSABLE_SELECTOR = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Form fields only (skip buttons / close) — first enabled in DOM order. */
const FORM_FIELD_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

function resolveFocusable(el) {
  if (!el) return null;
  if (el.matches?.(FOCUSABLE_SELECTOR)) return el;
  return el.querySelector?.(FOCUSABLE_SELECTOR) || null;
}

/** Focus first enabled input/select/textarea under `root`. Skips tabindex=-1. */
export function focusFirstFormField(root) {
  if (!root?.querySelectorAll) return false;
  const active = document.activeElement;
  // Already on any enabled field in this drawer — never steal (delete/clean/re-render).
  if (
    active &&
    root.contains(active) &&
    active.matches?.(FORM_FIELD_SELECTOR) &&
    !active.disabled &&
    document.body.contains(active)
  ) {
    return true;
  }
  let first = null;
  for (const el of root.querySelectorAll(FORM_FIELD_SELECTOR)) {
    if (el.tabIndex < 0 || el.closest('[aria-hidden="true"]')) continue;
    first = el;
    break;
  }
  if (!first) return false;
  try {
    first.focus({ preventScroll: true });
  } catch {
    first.focus();
  }
  return true;
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
