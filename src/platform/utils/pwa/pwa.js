/** Set in .env: NEXT_PUBLIC_APP_ENV=development | production */
export function isAppDevelopment() {
  return process.env.NEXT_PUBLIC_APP_ENV === "development";
}

const PWA_DISPLAY_MODES = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];

export function isPwaStandalone() {
  if (typeof window === "undefined") return false;
  if (window.navigator.standalone === true) return true;
  return PWA_DISPLAY_MODES.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobi|mini|tablet/i.test(navigator.userAgent.toLowerCase());
}

/** Development: skip install gate and allow DevTools in PWA. */
export function isPwaDevBypass() {
  return isAppDevelopment();
}

export function isPwaInstallRequired() {
  if (typeof window !== "undefined" && sessionStorage.getItem("pwa_gate_bypassed") === "1") {
    return false;
  }
  return !isAppDevelopment();
}

/** Quick Access / toolbar: Ctrl+Alt+key in browser, Ctrl+key in PWA. */
export function getListHotkeyParts(letter, isPwa) {
  const key = String(letter || "")
    .trim()
    .charAt(0)
    .toUpperCase();
  if (!key) return ["CTRL"];
  if (isPwa) return ["CTRL", key];
  return ["CTRL", "ALT", key];
}
