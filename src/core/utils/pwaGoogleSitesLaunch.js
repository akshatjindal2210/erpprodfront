
import { isPwaStandalone } from "@/core/utils/pwa";

/** PWA handoff target — dev default; matches current site when in browser. */
export function getPwaHandoffUrl() {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_PWA_APP_ORIGIN || "https://dev.jflbharat.com";
  return `${String(origin).replace(/\/$/, "")}/`;
}

/** Google Sites / external portal entry points. */
export function isGoogleSitesLaunchEntry() {
  if (typeof window === "undefined") return false;
  const { pathname, search } = window.location;
  return pathname === "/launch" || search.includes("mode=g-sites");
}

/** Remove `mode=g-sites` from the URL without reloading. */
export function stripGoogleSitesLaunchParam() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("mode")) return;
  if (url.searchParams.get("mode") !== "g-sites") return;
  url.searchParams.delete("mode");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", next || "/");
}

/**
 * Manual PWA handoff — call only from a user click (e.g. Open PWA button).
 * Same logic as Google Sites snippet; no automatic URL triggers.
 */
export function runManualPwaHandoff() {
  if (typeof window === "undefined") return false;
  if (isPwaStandalone()) return false;

  if (!window.matchMedia("(display-mode: browser)").matches) {
    return false;
  }

  const target = getPwaHandoffUrl();

  if ("launchHandler" in navigator) {
    window.open(target, "_blank");
    try {
      window.close();
    } catch {
      // close() only works for script-opened tabs
    }
    return true;
  }

  window.location.replace(target);
  return true;
}

/**
 * Google Sites → PWA handoff (manual click from /launch "Open PWA" button).
 * Code matches the original snippet exactly.
 */
/*

export function runManualPwaHandoff() {
  if (typeof window === "undefined") return;

  // Check if the user arrived from your Google Sites link path
  if (window.location.pathname === "/launch" || window.location.search.includes("mode=g-sites")) {
    // Check if the app is currently stuck inside a standard browser tab
    if (window.matchMedia("(display-mode: browser)").matches) {
      // Attempt to silently hand off the URL to the PWA Engine
      if ("launchHandler" in navigator) {
        // Modern Chromium engine command to break out into standalone window
        window.open("https://dev.jflbharat.com/", "_blank");
        window.close(); // Closes the lingering blank browser tab automatically
      } else {
        // Fallback mechanism for older mobile browsers
        window.location.replace("https://dev.jflbharat.com/");
      }
    }
  }
}
*/