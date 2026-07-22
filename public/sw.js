const CACHE_NAME = "jfl-erp-static-v25";
const DELIVERY_RETRY_MS = [0, 1500, 4000, 10000, 25000];
const API_BASE_CACHE = "jfl-push-api-base-v1";
const PENDING_DELIVERY_CACHE = "jfl-pending-push-delivery-v1";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.png",
  "/offline-vpn-reminder.html",
  "/push-icons/task.svg",
  "/push-icons/ims.svg",
  "/push-icons/core.svg",
  "/push-icons/home.svg",
];

let cachedApiBase = null;
let cachedCompanyBackendUrl = null;
let cachedInternalFrontendHost = null;
let cachedExternalFrontendHost = null;
let cachedDeliveryApiBases = [];

async function loadApiConfig() {
  if (cachedApiBase) {
    return {
      apiBase: cachedApiBase,
      companyBackendUrl: cachedCompanyBackendUrl,
      internalFrontendHost: cachedInternalFrontendHost,
      externalFrontendHost: cachedExternalFrontendHost,
      deliveryApiBases: cachedDeliveryApiBases,
    };
  }
  try {
    const cache = await caches.open(API_BASE_CACHE);
    const res = await cache.match("api-config");
    if (res) {
      const cfg = await res.json();
      cachedApiBase = String(cfg.apiBase || "").trim() || null;
      cachedCompanyBackendUrl = String(cfg.companyBackendUrl || "").trim() || null;
      cachedInternalFrontendHost = String(cfg.internalFrontendHost || "").trim() || null;
      cachedExternalFrontendHost = String(cfg.externalFrontendHost || "").trim() || null;
      cachedDeliveryApiBases = Array.isArray(cfg.deliveryApiBases)
        ? cfg.deliveryApiBases.map((v) => String(v || "").trim()).filter(Boolean)
        : [];
    } else {
      const legacy = await cache.match("api-base");
      if (legacy) {
        cachedApiBase = (await legacy.text()).trim() || null;
      }
    }
  } catch {
    /* ignore */
  }
  return {
    apiBase: cachedApiBase,
    companyBackendUrl: cachedCompanyBackendUrl,
    internalFrontendHost: cachedInternalFrontendHost,
    externalFrontendHost: cachedExternalFrontendHost,
    deliveryApiBases: cachedDeliveryApiBases,
  };
}

async function saveApiConfig({ apiBase, companyBackendUrl, internalFrontendHost, externalFrontendHost, deliveryApiBases } = {}) {
  if (apiBase) cachedApiBase = String(apiBase).replace(/\/$/, "");
  if (companyBackendUrl) cachedCompanyBackendUrl = String(companyBackendUrl).replace(/\/$/, "");
  if (internalFrontendHost !== undefined) cachedInternalFrontendHost = String(internalFrontendHost || "").trim();
  if (externalFrontendHost !== undefined) cachedExternalFrontendHost = String(externalFrontendHost || "").trim();
  if (Array.isArray(deliveryApiBases)) {
    const merged = [...cachedDeliveryApiBases];
    deliveryApiBases.forEach((value) => {
      const base = String(value || "").trim().replace(/\/$/, "");
      if (base && !merged.includes(base)) merged.push(base);
    });
    cachedDeliveryApiBases = merged;
  }

  try {
    const cache = await caches.open(API_BASE_CACHE);
    await cache.put(
      "api-config",
      new Response(
        JSON.stringify({
          apiBase: cachedApiBase || "",
          companyBackendUrl: cachedCompanyBackendUrl || "",
          internalFrontendHost: cachedInternalFrontendHost || "",
          externalFrontendHost: cachedExternalFrontendHost || "",
          deliveryApiBases: cachedDeliveryApiBases,
        })
      )
    );
  } catch {
    /* ignore */
  }
}

function mergePushMeta(meta = {}) {
  const apiBase = String(meta.api_base || cachedApiBase || "").replace(/\/$/, "");
  const companyBackendUrl = String(meta.company_backend_url || cachedCompanyBackendUrl || "").replace(/\/$/, "");
  const internalFrontendHost = String(meta.internal_frontend_host || cachedInternalFrontendHost || "").trim();
  const externalFrontendHost = String(meta.external_frontend_host || cachedExternalFrontendHost || "").trim();
  const deliveryApiBases = collectDeliveryApiBases(meta);
  return { apiBase, companyBackendUrl, internalFrontendHost, externalFrontendHost, deliveryApiBases };
}

async function ensureApiConfig(fromMeta = {}) {
  const merged = mergePushMeta(fromMeta);
  if (merged.apiBase || merged.companyBackendUrl || merged.internalFrontendHost || merged.externalFrontendHost || merged.deliveryApiBases.length) {
    await saveApiConfig({
      apiBase: merged.apiBase,
      companyBackendUrl: merged.companyBackendUrl,
      internalFrontendHost: merged.internalFrontendHost,
      externalFrontendHost: merged.externalFrontendHost,
      deliveryApiBases: merged.deliveryApiBases,
    });
  } else {
    await loadApiConfig();
  }
  return mergePushMeta(fromMeta);
}

function pushIconForAppType(appType) {
  const key = String(appType || "task").toLowerCase();
  if (key === "core" || key === "settings" || key === "admin") return "/push-icons/core.svg";
  if (key === "ims") return "/push-icons/ims.svg";
  if (key === "home") return "/push-icons/home.svg";
  if (key === "task") return "/push-icons/task.svg";
  return "/push-icons/task.svg";
}

function deliveryUrl(apiBase, path) {
  return `${apiBase}/core/push/delivery/${path}`;
}

function collectDeliveryApiBases(meta = {}) {
  const bases = [];
  const add = (value) => {
    const base = String(value || "").trim().replace(/\/$/, "");
    if (base && !bases.includes(base)) bases.push(base);
  };

  if (Array.isArray(meta.delivery_api_bases)) meta.delivery_api_bases.forEach(add);
  add(meta.api_base);
  cachedDeliveryApiBases.forEach(add);
  add(cachedApiBase);

  return bases;
}

function matchesHost(hostname, pattern) {
  const p = String(pattern || "").trim().toLowerCase();
  if (!p) return false;
  return String(hostname || "").trim().toLowerCase().includes(p);
}

function isExternalFrontendHost(hostname, cfg = {}) {
  return matchesHost(hostname, cfg.externalFrontendHost);
}

function isInternalFrontendHost(hostname, cfg = {}) {
  return matchesHost(hostname, cfg.internalFrontendHost);
}

async function buildDeliveryBody(tracking_id, meta = {}, options = {}) {
  const body = { tracking_id };
  if (options.companyNetworkVerified) {
    body.company_network_verified = true;
    const host = self.location.hostname;
    const onInternal = isInternalFrontendHost(host, meta);
    body.on_internal_domain = onInternal;
    body.on_company_network = onInternal;
  }
  return body;
}

async function tryPostDeliveryOnce(path, meta, options) {
  const bases = collectDeliveryApiBases(meta);
  if (!bases.length) return false;
  const body = await buildDeliveryBody(meta.tracking_id || options.tracking_id, meta, options);
  const tracking_id = body.tracking_id;
  if (!tracking_id) return false;

  for (const apiBase of bases) {
    try {
      if (await postDeliveryToBase(apiBase, path, body)) return true;
    } catch {
      /* try next base */
    }
  }
  return false;
}

async function postDeliveryStatus(path, tracking_id, meta = {}, options = {}) {
  if (!tracking_id) return false;

  const payloadMeta = { ...meta, tracking_id };
  await ensureApiConfig(payloadMeta);

  for (let i = 0; i < DELIVERY_RETRY_MS.length; i += 1) {
    if (DELIVERY_RETRY_MS[i] > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELIVERY_RETRY_MS[i]));
    }
    if (await tryPostDeliveryOnce(path, payloadMeta, options)) {
      return true;
    }
  }

  await queuePendingDelivery(path, tracking_id, payloadMeta, options);
  return false;
}

async function postDeliveryToBase(apiBase, path, body) {
  const res = await fetch(deliveryUrl(apiBase, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
    signal: AbortSignal.timeout(12000),
  });
  return res.ok;
}

async function loadPendingDeliveries() {
  try {
    const cache = await caches.open(PENDING_DELIVERY_CACHE);
    const res = await cache.match("pending");
    if (!res) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function savePendingDeliveries(rows) {
  try {
    const cache = await caches.open(PENDING_DELIVERY_CACHE);
    if (!rows.length) {
      await cache.delete("pending");
      return;
    }
    await cache.put("pending", new Response(JSON.stringify(rows)));
  } catch {
    /* ignore */
  }
}

async function queuePendingDelivery(path, tracking_id, meta = {}, options = {}) {
  const rows = await loadPendingDeliveries();
  const key = `${path}:${tracking_id}`;
  if (rows.some((row) => row.key === key)) return;
  rows.push({
    key,
    path,
    tracking_id,
    meta,
    options,
    queued_at: Date.now(),
  });
  await savePendingDeliveries(rows.slice(-50));
}

async function flushPendingDeliveries() {
  const rows = await loadPendingDeliveries();
  if (!rows.length) return;

  const remaining = [];
  for (const row of rows) {
    const ok = await postDeliveryStatus(row.path, row.tracking_id, row.meta || {}, row.options || {});
    if (!ok) remaining.push(row);
  }
  await savePendingDeliveries(remaining);
}

async function pingCompanyBackend(backendUrl, timeoutMs = 4000) {
  const base = String(backendUrl || "").replace(/\/$/, "");
  if (!base) return false;
  try {
    await fetch(`${base}/api/version`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return true;
  } catch {
    return false;
  }
}

async function canOpenAppFromOrigin(cfg = {}) {
  const host = self.location.hostname;

  // External portal (Cloudflare OTP) — open from any network.
  if (isExternalFrontendHost(host, cfg)) return true;

  const backendCandidates = [
    cfg.companyBackendUrl,
    cfg.apiBase?.replace(/\/api\/?$/, ""),
    ...(Array.isArray(cfg.deliveryApiBases) ? cfg.deliveryApiBases.map((b) => b.replace(/\/api\/?$/, "")) : []),
  ]
    .map((v) => String(v || "").replace(/\/$/, ""))
    .filter(Boolean);

  for (const base of [...new Set(backendCandidates)]) {
    if (await pingCompanyBackend(base)) return true;
  }

  return false;
}

function offlineReminderUrl(targetUrl, cfg = {}, trackingId = "") {
  const params = new URLSearchParams();
  params.set("return", targetUrl);
  if (trackingId) params.set("tracking_id", String(trackingId));
  if (cfg.companyBackendUrl) params.set("backend", cfg.companyBackendUrl);
  else if (cfg.apiBase) params.set("backend", cfg.apiBase.replace(/\/api\/?$/, ""));
  if (cfg.externalFrontendHost) params.set("external_host", cfg.externalFrontendHost);
  if (cfg.deliveryApiBases?.length) params.set("api_bases", cfg.deliveryApiBases.join(","));
  else if (cfg.apiBase) params.set("api_base", cfg.apiBase);
  return `/offline-vpn-reminder.html?${params.toString()}`;
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
      .then(() => flushPendingDeliveries())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.cache === "reload" || request.cache === "no-store") {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticFile = /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|html)$/i.test(url.pathname);
  const isNextStatic = url.pathname.startsWith("/_next/static/");

  const shouldCache = isSameOrigin && (isStaticFile || isNextStatic);

  if (!shouldCache) return;

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

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "SET_API_BASE" && data.apiBase) {
    event.waitUntil(
      saveApiConfig({
        apiBase: data.apiBase,
        companyBackendUrl: data.companyBackendUrl,
        internalFrontendHost: data.internalFrontendHost,
        externalFrontendHost: data.externalFrontendHost,
        deliveryApiBases: data.deliveryApiBases,
      }).then(() => flushPendingDeliveries())
    );
    return;
  }

  if (data.type === "FLUSH_DELIVERY_QUEUE") {
    event.waitUntil(flushPendingDeliveries());
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
  const notifyBody = String(payload.body || "").trim();

  const notifyData = {
    url,
    inbox_id: inboxId,
    tracking_id: trackingId,
    app_type: appType,
    app_label: meta.app_label || "",
    api_base: meta.api_base || "",
    delivery_api_bases: Array.isArray(meta.delivery_api_bases) ? meta.delivery_api_bases : [],
    company_backend_url: meta.company_backend_url || "",
    internal_frontend_host: meta.internal_frontend_host || "",
    external_frontend_host: meta.external_frontend_host || "",
  };

  // Show the notification immediately — works whether the app is open or closed.
  // Defer network checks to delivery receipt only (do not block on a slow ping).
  event.waitUntil(
    ensureApiConfig(notifyData)
      .then(() =>
        self.registration.showNotification(title, {
          body: notifyBody,
          icon: payload.icon || fallbackIcon,
          badge: payload.badge || fallbackIcon,
          tag: payload.tag || (trackingId ? `jfl-push-${trackingId}` : `jfl-push-${appType}`),
          renotify: payload.renotify ?? true,
          requireInteraction: payload.requireInteraction ?? false,
          silent: payload.silent ?? false,
          data: notifyData,
        })
      )
      .then(() => postDeliveryStatus("received", trackingId, notifyData))
      .then(() => flushPendingDeliveries())
  );
});

async function openOrFocusClient(targetUrl) {
  const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clientList) {
    if (client.url.includes(self.location.origin)) {
      if ("focus" in client) {
        if ("navigate" in client) await client.navigate(targetUrl);
        return client.focus();
      }
    }
  }
  if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || "/task/dashboard/tasks";
  const inboxId = data.inbox_id;
  const trackingId = data.tracking_id;

  event.waitUntil(
    ensureApiConfig(data)
      .then(() => mergePushMeta(data))
      .then(async (cfg) => {
        const canOpen = await canOpenAppFromOrigin(cfg);
        const meta = { ...data, ...cfg };

        if (canOpen && trackingId) {
          await postDeliveryStatus("read", trackingId, meta, { companyNetworkVerified: true });
        }

        const openUrl = canOpen
          ? targetUrl
          : offlineReminderUrl(targetUrl, cfg, trackingId);

        const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const msg =
          canOpen && inboxId
            ? { type: "INBOX_READ", inbox_id: inboxId, tracking_id: trackingId }
            : canOpen && trackingId
              ? { type: "PUSH_READ", tracking_id: trackingId }
              : null;

        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            if (msg) client.postMessage(msg);
            if ("focus" in client) {
              if ("navigate" in client) client.navigate(openUrl);
              return client.focus();
            }
          }
        }
        return openOrFocusClient(openUrl);
      })
  );
});
