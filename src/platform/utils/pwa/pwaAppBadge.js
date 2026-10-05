import { fetchInboxUnreadCount } from "@/common/pwa/task/taskInboxApi";

let globalIconGen = 0;

function normalizeBadgeCount(count) {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function postBadgeCountToServiceWorkers(count) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const n = normalizeBadgeCount(count);
  navigator.serviceWorker.ready
    .then((reg) => {
      [reg.active, reg.waiting, reg.installing].filter(Boolean).forEach((worker) => {
        worker.postMessage({ type: "SET_APP_BADGE_COUNT", count: n });
      });
    })
    .catch(() => {});
}

export function syncIconBadge(count) {
  const n = normalizeBadgeCount(count);
  if (typeof navigator !== "undefined") {
    try {
      if (n <= 0) {
        if (typeof navigator.clearAppBadge === "function") void navigator.clearAppBadge();
      } else if (typeof navigator.setAppBadge === "function") {
        void navigator.setAppBadge(n);
      }
    } catch {
      /* unsupported */
    }
  }
  postBadgeCountToServiceWorkers(n);
  return n;
}

/** PWA taskbar icon — always all apps combined (bell stays per-screen). */
export async function syncGlobalIconBadge() {
  if (typeof window === "undefined") return null;
  const gen = ++globalIconGen;
  try {
    const count = await fetchInboxUnreadCount(null);
    if (gen !== globalIconGen) return null;
    return syncIconBadge(count);
  } catch {
    return null;
  }
}
