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
