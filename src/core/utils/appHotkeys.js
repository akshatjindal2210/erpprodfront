import { isPanelEditableTarget } from "@/core/utils/panelEditableTarget";

/** Inputs / contenteditable — do not steal keys meant for typing. */
export function isHotkeyTypingTarget(target) {
  if (!target?.tagName) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return !!target.isContentEditable;
}

export function isModChord(e) {
  const mod = e.ctrlKey || e.metaKey;
  return mod && !e.altKey && !e.shiftKey;
}

/**
 * List New / Edit / Print (DataTable / Drawer):
 * Ctrl+Alt+N|E|P in browser; Ctrl+N|E|P in PWA / plain Ctrl chord.
 */
export function isListChromeHotkeyChord(e) {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.shiftKey) return false;

  const key = (e.key || "").toLowerCase();
  const isAlt = e.altKey;

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

export function isAppSaveChord(e) {
  return isModChord(e) && (e.key || "").toLowerCase() === "s";
}

export function isAppCopyChord(e) {
  return isModChord(e) && (e.key || "").toLowerCase() === "c";
}

export function isAppAuthorizeChord(e) {
  return isModChord(e) && (e.key || "").toLowerCase() === "a";
}

export function isAppFilterFocusChord(e) {
  return isModChord(e) && (e.key || "").toLowerCase() === "f";
}

export function hasUserTextSelection() {
  if (typeof window === "undefined") return false;
  const selection = window.getSelection();
  return !!selection && selection.toString().length > 0;
}

export function isAppOverlayOpen() {
  if (typeof document === "undefined") return false;
  if (document.documentElement.hasAttribute("data-app-drawer-open")) return true;
  if (document.querySelector("[data-app-drawer-root]")) return true;
  if (document.querySelector('[role="dialog"]')) return true;
  return false;
}

/**
 * Block browser defaults for app shortcuts when no handler applies.
 */
export function shouldSwallowAppShortcut(e) {
  if (isListChromeHotkeyChord(e)) {
    return !isHotkeyTypingTarget(e.target);
  }

  if (isAppSaveChord(e)) {
    return !isHotkeyTypingTarget(e.target);
  }

  if (isAppAuthorizeChord(e)) {
    return !isPanelEditableTarget(e.target);
  }

  if (isAppFilterFocusChord(e)) {
    return !isHotkeyTypingTarget(e.target);
  }

  if (isAppCopyChord(e)) {
    if (isHotkeyTypingTarget(e.target)) return false;
    if (hasUserTextSelection()) return false;
    return true;
  }

  return false;
}
