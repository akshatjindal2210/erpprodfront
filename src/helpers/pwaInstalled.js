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

/** Open the installed PWA (same URL) instead of staying in the browser tab. */
export function openInstalledPwa() {
  if (typeof window === "undefined") return;
  const target = new URL(window.location.href);
  window.open(target.href, "_blank", "noopener,noreferrer");
}
