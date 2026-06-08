const CACHE_NAME = "jfl-erp-static-v6";
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

// Handle skip waiting message
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
