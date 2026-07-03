const CACHE_NAME = "jfl-erp-static-v16";
const API_BASE_CACHE = "jfl-push-api-base-v1";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.png",
  "/push-icons/task.svg",
  "/push-icons/ims.svg",
  "/push-icons/core.svg",
  "/push-icons/home.svg",
];

let cachedApiBase = null;

async function loadApiBase() {
  if (cachedApiBase) return cachedApiBase;
  try {
    const cache = await caches.open(API_BASE_CACHE);
    const res = await cache.match("api-base");
    if (res) {
      cachedApiBase = (await res.text()).trim() || null;
    }
  } catch {
    /* ignore */
  }
  return cachedApiBase;
}

async function saveApiBase(apiBase) {
  if (!apiBase || typeof apiBase !== "string") return;
  cachedApiBase = apiBase.replace(/\/$/, "");
  try {
    const cache = await caches.open(API_BASE_CACHE);
    await cache.put("api-base", new Response(cachedApiBase));
  } catch {
    /* ignore */
  }
}

function pushIconForAppType(appType) {
  const key = String(appType || "task").toLowerCase();
  if (key === "core" || key === "settings" || key === "admin") return "/push-icons/core.svg";
  if (key === "ims") return "/push-icons/ims.svg";
  if (key === "home") return "/push-icons/home.svg";
  if (key === "task") return "/push-icons/task.svg";
  return "/push-icons/task.svg";
}

function deliveryUrl(path) {
  return `${cachedApiBase}/core/push/delivery/${path}`;
}

async function postDeliveryStatus(path, tracking_id) {
  if (!tracking_id) return;
  await loadApiBase();
  if (!cachedApiBase) return;
  try {
    await fetch(deliveryUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracking_id }),
    });
  } catch {
    /* best effort */
  }
}

async function cacheStaticAssets(cache) {
  await Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cacheStaticAssets(cache)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME && key !== API_BASE_CACHE).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Hard refresh: always hit network
  if (request.cache === "reload" || request.cache === "no-store") {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first for page navigations
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticFile = /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname);
  const isNextStatic = url.pathname.startsWith("/_next/static/");
  
  const shouldCache = isSameOrigin && (isStaticFile || isNextStatic);

  if (!shouldCache) return;

  // Stale-While-Revalidate Strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Page → SW: native OS notification (Windows Action Center / phone tray)
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "SET_API_BASE" && data.apiBase) {
    event.waitUntil(saveApiBase(data.apiBase));
    return;
  }

  if (data.type === "TASK_SHOW_NOTIFICATION") {
    const p = data.payload || {};
    const meta = p.data || {};
    const appType = meta.app_type || p.app_type || "task";
    const title = p.title || "Task";
    const { body, icon, badge, tag, renotify, requireInteraction, silent } = p;
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body || "",
        icon: icon || pushIconForAppType(appType),
        badge: badge || pushIconForAppType(appType),
        tag: tag || `${appType}-notify`,
        renotify: renotify ?? true,
        requireInteraction: requireInteraction ?? false,
        silent: silent ?? false,
        data: { ...meta, url: meta.url || p.url || "/task/dashboard/tasks", app_type: appType },
      })
    );
  }
});

// Web Push Protocol — delivers notifications when app/tab is closed or user is logged out
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data?.text?.() || "JFL ERP" };
  }

  const title = payload.title || "JFL ERP";
  const meta = payload.data || {};
  const url = meta.url || payload.url || "/";
  const inboxId = meta.inbox_id ?? payload.inbox_id ?? "";
  const trackingId = meta.tracking_id ?? payload.tracking_id ?? "";
  const appType = meta.app_type ?? payload.app_type ?? "task";
  const fallbackIcon = pushIconForAppType(appType);

  event.waitUntil(
    loadApiBase()
      .then(() =>
        self.registration.showNotification(title, {
          body: payload.body || "",
          icon: payload.icon || fallbackIcon,
          badge: payload.badge || fallbackIcon,
          tag: payload.tag || `jfl-push-${appType}`,
          renotify: payload.renotify ?? true,
          requireInteraction: payload.requireInteraction ?? false,
          silent: payload.silent ?? false,
          data: { url, inbox_id: inboxId, tracking_id: trackingId, app_type: appType, app_label: meta.app_label || "" },
        })
      )
      .then(() => postDeliveryStatus("received", trackingId))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || "/task/dashboard/tasks";
  const inboxId = data.inbox_id;
  const trackingId = data.tracking_id;

  event.waitUntil(
    loadApiBase().then(() =>
      postDeliveryStatus("read", trackingId).then(() =>
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
          const msg = inboxId
            ? { type: "INBOX_READ", inbox_id: inboxId, tracking_id: trackingId }
            : trackingId
              ? { type: "PUSH_READ", tracking_id: trackingId }
              : null;

          for (const client of clientList) {
            if (client.url.includes(self.location.origin)) {
              if (msg) client.postMessage(msg);
              if ("focus" in client) {
                client.navigate(targetUrl);
                return client.focus();
              }
            }
          }
          if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        })
      )
    )
  );
});
