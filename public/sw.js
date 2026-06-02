const CACHE_NAME = "jfl-erp-static-v5";
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

  // Hard refresh (Ctrl+Shift+R / Ctrl+F5): always hit network, skip cache.
  if (request.cache === "reload" || request.cache === "no-store") {
    event.respondWith(fetch(request));
    return;
  }

  // Always use network-first for page/document navigations
  // to avoid blank route refresh issues in Next.js.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => new Response("Offline", { status: 503, statusText: "Offline" }))
    );
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticFile = /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname);
  const isNextStatic = url.pathname.startsWith("/_next/static/");
  const shouldCache = isSameOrigin && (isStaticFile || isNextStatic);

  if (!shouldCache) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
          return response;
        })
        .catch(() => cached);
    })
  );
});
