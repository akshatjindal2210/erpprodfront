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

  const listChord = mod && e.altKey && !e.shiftKey;
  const listChordPwa = mod && !e.altKey && !e.shiftKey;
  if (!listChord && !listChordPwa) return false;

  const key = (e.key || "").toLowerCase();
  return key === "n" || key === "e" || key === "p";
}
