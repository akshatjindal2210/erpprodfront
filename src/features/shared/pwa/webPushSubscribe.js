"use client";

import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS } from "@/core/api/endpoints";
import { API_BASE_URL, BACKEND_URL } from "@/core/utils/lib";
import { getCompanyPublicIp } from "@/core/utils/companyNetwork";
import { isIosDevice, isPwaStandalone } from "@/core/utils/pwa";

const DEVICE_ID_KEY = "jfl_push_device_id";
const PUSH_SYNC_KEY = "jfl_push_last_sync";
const PUSH_LINK_USER_KEY = "jfl_push_linked_user";
const PUSH_API_BASE_KEY = "jfl_push_api_base_sent";

export function getDeviceDisplayName() {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "Device";

  let device = platform;
  if (/iphone/i.test(ua)) device = "iPhone";
  else if (/ipad/i.test(ua)) device = "iPad";
  else if (/android/i.test(ua)) device = "Android";
  else if (/windows/i.test(ua)) device = "Windows";
  else if (/mac/i.test(ua)) device = "Mac";

  let browser = "Browser";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";

  const mode = isPwaStandalone() ? "PWA" : browser;
  return `${device} (${mode})`;
}

export function getPushDeviceId() {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function isWebPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS Safari: push subscription only works when PWA is added to home screen. */
export function getIosPushInstallHint() {
  if (!isIosDevice()) return null;
  if (isPwaStandalone()) return null;
  return "On iPhone/iPad, add JFL ERP to your Home Screen (Share → Add to Home Screen), then open the app from there to enable push alerts.";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function fetchVapidPublicKey() {
  const envKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (envKey) return envKey;
  const res = await api(CORE_ENDPOINTS.PUSH.VAPID_PUBLIC_KEY);
  return res?.data?.publicKey || null;
}

async function getPushRegistration() {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) throw new Error("Push notifications are not configured on the server");

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  return sub;
}

function subscriptionPayload(sub) {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
  };
}

function pushBody(extra = {}) {
  return {
    device_id: getPushDeviceId(),
    device_name: getDeviceDisplayName(),
    ...extra,
  };
}

export async function savePushSubscriptionToServer(subscription) {
  const device_id = getPushDeviceId();
  if (!device_id) return { ok: false, error: "Could not resolve device id" };

  await api(CORE_ENDPOINTS.PUSH.SUBSCRIBE, {
    method: "POST",
    body: pushBody({ subscription: subscriptionPayload(subscription) }),
  });

  try {
    sessionStorage.setItem(PUSH_SYNC_KEY, String(Date.now()));
  } catch {}

  return { ok: true, device_id };
}

export async function linkPushSubscriptionToUser({ userId } = {}) {
  const device_id = getPushDeviceId();
  if (!device_id || !isWebPushSupported()) return { ok: false, skipped: true };

  let subscription = null;
  try {
    const reg = await navigator.serviceWorker.ready;
    subscription = await reg.pushManager.getSubscription();
  } catch {
    /* no subscription yet */
  }

  if (userId && subscription) {
    try {
      if (sessionStorage.getItem(PUSH_LINK_USER_KEY) === String(userId)) {
        return { ok: true, skipped: true, cached: true };
      }
    } catch {}
  }

  await api(CORE_ENDPOINTS.PUSH.LINK, {
    method: "POST",
    body: pushBody({
      ...(subscription ? { subscription: subscriptionPayload(subscription) } : {}),
    }),
  });

  if (userId) {
    try {
      sessionStorage.setItem(PUSH_LINK_USER_KEY, String(userId));
    } catch {}
  }

  return { ok: true };
}

export function clearPushLinkSessionCache() {
  try {
    sessionStorage.removeItem(PUSH_LINK_USER_KEY);
  } catch {}
}

export function syncPushApiBaseToServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const apiBase = String(API_BASE_URL || "").replace(/\/$/, "");
  const companyBackendUrl = String(
    process.env.NEXT_PUBLIC_BACKEND_URL_INSIDE || BACKEND_URL || ""
  ).replace(/\/$/, "");
  const companyPublicIp = getCompanyPublicIp();
  const outsideBase = process.env.NEXT_PUBLIC_BACKEND_URL_OUTSIDE
    ? `${String(process.env.NEXT_PUBLIC_BACKEND_URL_OUTSIDE).replace(/\/$/, "")}/api`
    : "";
  const insideBase = process.env.NEXT_PUBLIC_BACKEND_URL_INSIDE
    ? `${String(process.env.NEXT_PUBLIC_BACKEND_URL_INSIDE).replace(/\/$/, "")}/api`
    : "";
  const deliveryApiBases = [outsideBase, apiBase, insideBase].filter(
    (value, index, arr) => value && arr.indexOf(value) === index
  );
  if (!apiBase && !deliveryApiBases.length) return;

  const syncKey = `${deliveryApiBases.join("|")}|${companyBackendUrl}|${companyPublicIp}`;
  try {
    if (sessionStorage.getItem(PUSH_API_BASE_KEY) === syncKey) return;
  } catch {}

  navigator.serviceWorker.ready
    .then((reg) => {
      [reg.active, reg.waiting, reg.installing].filter(Boolean).forEach((worker) => {
        worker.postMessage({
          type: "SET_API_BASE",
          apiBase: apiBase || deliveryApiBases[0],
          companyBackendUrl,
          companyPublicIp,
          deliveryApiBases,
        });
      });
      try {
        sessionStorage.setItem(PUSH_API_BASE_KEY, syncKey);
      } catch {}
    })
    .catch(() => {});
}

export function flushPushDeliveryQueue() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      [reg.active, reg.waiting, reg.installing].filter(Boolean).forEach((worker) => {
        worker.postMessage({ type: "FLUSH_DELIVERY_QUEUE" });
      });
    })
    .catch(() => {});
}

/** Optional manual unlink — device stays linked on logout so push still works when logged out. */
export async function unlinkPushSubscriptionFromUser() {
  const device_id = getPushDeviceId();
  if (!device_id) return { ok: false, skipped: true };

  try {
    await api(CORE_ENDPOINTS.PUSH.UNLINK, {
      method: "POST",
      body: { device_id },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function reportPushDeliveryRead(tracking_id) {
  if (!tracking_id) return;
  try {
    await api(CORE_ENDPOINTS.PUSH.DELIVERY_READ, {
      method: "POST",
      body: { tracking_id },
    });
  } catch {
    /* best effort */
  }
}

export async function subscribeToWebPush({ requestPermission = true } = {}) {
  if (!isWebPushSupported()) {
    return { ok: false, error: "unsupported", message: "Push notifications are not supported in this browser" };
  }

  const iosHint = getIosPushInstallHint();
  if (iosHint) {
    return { ok: false, error: "ios_install_required", message: iosHint };
  }

  if (!window.isSecureContext) {
    return { ok: false, error: "insecure", message: "HTTPS is required for push notifications" };
  }

  if (requestPermission) {
    if (Notification.permission === "denied") {
      return { ok: false, error: "denied", message: "Notifications are blocked in browser settings" };
    }
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        return { ok: false, error: perm, message: "Notification permission was not granted" };
      }
    }
  } else if (Notification.permission !== "granted") {
    return { ok: false, error: "not_granted", message: "Notification permission not granted yet" };
  }

  const sub = await getPushRegistration();
  await savePushSubscriptionToServer(sub);
  syncPushApiBaseToServiceWorker();
  return { ok: true, permission: Notification.permission };
}

export async function syncPushSubscriptionIfGranted() {
  if (!isWebPushSupported() || Notification.permission !== "granted") return { ok: false, skipped: true };
  if (getIosPushInstallHint()) return { ok: false, skipped: true, error: "ios_install_required" };

  try {
    const last = Number(sessionStorage.getItem(PUSH_SYNC_KEY) || 0);
    if (last && Date.now() - last < 6 * 60 * 60 * 1000) {
      return { ok: true, skipped: true, cached: true };
    }
  } catch {}

  try {
    return await subscribeToWebPush({ requestPermission: false });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function unsubscribeFromWebPush() {
  if (!isWebPushSupported()) return;
  const device_id = getPushDeviceId();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api(CORE_ENDPOINTS.PUSH.UNSUBSCRIBE, {
      method: "POST",
      body: { device_id, endpoint: sub.endpoint },
    });
    await sub.unsubscribe();
  }
}
