import { fetchInboxUnreadCount } from "@/common/pwa/task/taskInboxApi";

function normalizeBadgeCount(count) {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/** Home-screen icon badge: 1, 2, 3… (Badging API). No-op when unsupported. */
export function applyAppBadgeCount(count) {
  if (typeof navigator === "undefined") return;
  try {
    const n = normalizeBadgeCount(count);
    if (n <= 0) {
      if (typeof navigator.clearAppBadge === "function") void navigator.clearAppBadge();
      return;
    }
    if (typeof navigator.setAppBadge === "function") void navigator.setAppBadge(n);
  } catch {
    /* unsupported or denied */
  }
}

export function clearAppBadge() {
  applyAppBadgeCount(0);
}

/** Total unread across all apps — icon badge is never filtered by task/ims scope. */
export async function syncAppBadgeFromServer() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || Notification.permission !== "granted") {
    clearAppBadge();
    return;
  }
  try {
    const count = await fetchInboxUnreadCount(null);
    applyAppBadgeCount(count);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.active?.postMessage({ type: "SET_APP_BADGE_COUNT", count: normalizeBadgeCount(count) });
        })
        .catch(() => {});
    }
  } catch {
    /* keep current badge */
  }
}
