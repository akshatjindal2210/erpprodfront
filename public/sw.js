const CACHE_NAME = "jfl-erp-static-v9";
const STATIC_ASSETS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
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

  if (data.type === "TASK_SHOW_NOTIFICATION") {
    const p = data.payload || {};
    const title = p.title || "Task";
    const { body, icon, badge, tag, data: meta, renotify, requireInteraction, silent } = p;
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body || "",
        icon: icon || "/icon-192.png",
        badge: badge || "/icon-192.png",
        tag: tag || "task-notify",
        renotify: renotify ?? true,
        requireInteraction: requireInteraction ?? false,
        silent: silent ?? false,
        data: meta || { url: "/task/dashboard/tasks" },
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || "/task/dashboard/tasks";
  const inboxId = data.inbox_id;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const msg = inboxId ? { type: "INBOX_READ", inbox_id: inboxId } : null;

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
  );
});
