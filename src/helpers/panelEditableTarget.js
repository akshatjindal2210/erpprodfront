/** True when the event target is (or is inside) a field where text select / Ctrl+A should work. */
export function isPanelEditableTarget(target) {
  if (!target || typeof target !== "object") return false;
  const el = target;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (typeof el.closest === "function") {
    return !!el.closest(
      'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable]:not([contenteditable="false"])'
    );
  }
  return false;
}
