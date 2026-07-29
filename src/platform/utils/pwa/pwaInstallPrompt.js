import { isPwaInstallRequired } from "@/platform/utils/pwa/pwa";
import { markPwaInstalled } from "@/platform/utils/pwa/pwaInstalled";

/** Module singleton — beforeinstallprompt fires once per session; survives React remounts. */
let deferredPrompt = null;
let captureInitialized = false;
const listeners = new Set();

function notify() {
  for (const listener of listeners) {
    listener(deferredPrompt);
  }
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function setDeferredInstallPrompt(event) {
  deferredPrompt = event;
  notify();
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null;
  notify();
}

/** @param {(event: BeforeInstallPromptEvent | null) => void} listener */
export function subscribeDeferredInstallPrompt(listener) {
  listeners.add(listener);
  listener(deferredPrompt);
  return () => listeners.delete(listener);
}

/** Register once for the page lifetime (never unbind — React Strict Mode would drop the event). */
export function ensureInstallPromptCapture() {
  if (typeof window === "undefined" || captureInitialized) return;
  captureInitialized = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    if (!isPwaInstallRequired()) return;
    e.preventDefault();
    setDeferredInstallPrompt(e);
  });

  window.addEventListener("appinstalled", () => {
    markPwaInstalled();
    clearDeferredInstallPrompt();
  });
}

