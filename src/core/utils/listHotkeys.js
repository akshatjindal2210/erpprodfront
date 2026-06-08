/** Inputs / contenteditable — list chrome hotkeys must not steal keys. */
export function isHotkeyTypingTarget(target) {
  if (!target?.tagName) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return !!target.isContentEditable;
}

/**
 * List “chrome” chords (DataTable / Drawer / shortcuts panel):
 * - Ctrl+Alt+N / E / P in browser tabs
 * - Ctrl+N / E / P in PWA (and anywhere the list handler accepts plain Ctrl+* )
 */
export function isListChromeHotkeyChord(e) {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.shiftKey) return false;

  const key = (e.key || "").toLowerCase();

  // 1. NEW: Ctrl+Alt+N or Ctrl+N
  if (key === "n") return true;

  // 2. EDIT: Ctrl+Alt+E or Ctrl+E
  if (key === "e") return true;

  // 3. PRINT: Ctrl+P
  if (key === "p") return true;

  // 4. APPROVE: Ctrl+A
  if (key === "a") return true;

  // 5. DELETE: Ctrl+D
  if (key === "d") return true;

  if (e.key === "Insert" || e.key === "F2" || e.key === "Delete") return true;
  return false;
}
