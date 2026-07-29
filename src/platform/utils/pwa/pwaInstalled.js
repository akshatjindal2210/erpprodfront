const PWA_INSTALLED_KEY = "imp_pwa_installed";

export function markPwaInstalled() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PWA_INSTALLED_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function isPwaInstalledLocally() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

/** True when the PWA is on the device but this tab is still the browser. */
export async function detectPwaInstalledOnDevice() {
  if (typeof window === "undefined") return false;
  if (isPwaInstalledLocally()) return true;

  if (!("getInstalledRelatedApps" in navigator)) return false;

  try {
    const apps = await navigator.getInstalledRelatedApps();
    if (apps.length > 0) {
      markPwaInstalled();
      return true;
    }
  } catch {
    // API unavailable or manifest not linked yet
  }

  return false;
}

function buildPwaOpenUrl(path) {
  const url = path
    ? new URL(path, window.location.origin)
    : new URL(window.location.href);

  if (!url.hash.includes("pwa-open")) {
    url.hash = "pwa-open";
  }
  url.searchParams.set("pwa_click", Date.now().toString());
  return url.href;
}

/** Programmatic navigation that may route into the installed PWA (OS/browser dependent). */
function triggerInstalledPwaOpen(href, { sameTab = false } = {}) {
  // Hidden anchor + _blank: most reliable way to trigger the installed PWA intent.
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Optional same-tab navigation (user gesture only). Avoid on /launch auto-handoff —
  // it would leave the browser on /home instead of opening the PWA window.
  if (sameTab) {
    window.location.assign(href);
  }
}

/**
 * Open the installed PWA at `options.path` (default: current URL) instead of staying in the browser tab.
 */
export function openInstalledPwa(force = false, options = {}) {
  if (typeof window === "undefined") return;

  const href = buildPwaOpenUrl(options.path);

  if (!force && typeof window !== "undefined") {
    const current = new URL(window.location.href);
    if (current.hash.includes("pwa-open")) return;
  }

  triggerInstalledPwaOpen(href, { sameTab: Boolean(options.sameTab) });
}
