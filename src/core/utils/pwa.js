/** Set in .env: NEXT_PUBLIC_APP_ENV=development | production */
export function isAppDevelopment() {
  return process.env.NEXT_PUBLIC_APP_ENV === "development";
}

export function isPwaStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true
  );
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Development: skip install gate and allow DevTools in PWA. */
export function isPwaDevBypass() {
  return isAppDevelopment();
}

export function isPwaInstallRequired() {
  return !isAppDevelopment();
}

/** List hotkey display keys — matches DataTable / Drawer (Ctrl+Alt+* in browser, Ctrl+* in PWA). */
export function getListHotkeyParts(key, isPwa) {
  const letter = String(key || "").trim().charAt(0).toUpperCase();
  if (!letter) return ["CTRL"];
  if (isPwa) return ["CTRL", letter];
  return ["CTRL", "ALT", letter];
}
