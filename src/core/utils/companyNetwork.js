import { BACKEND_URL } from "@/core/utils/lib";

export const NETWORK_UNREACHABLE_EVENT = "imp:network-unreachable";
export const NETWORK_REACHABLE_EVENT = "imp:network-reachable";

const PING_TIMEOUT_MS = 8000;
const UNREACHABLE_NOTIFY_MS = 4000;

let networkDown = false;
let lastUnreachableAt = 0;
let pingInFlight = null;

/** Fetch failed before any HTTP response — typical on wrong network / mobile data. */
export function isNetworkReachabilityError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return false;
  if (err.status != null && Number.isFinite(Number(err.status))) return false;

  const msg = String(err.message || err.cause?.message || "").toLowerCase();
  return (
    err instanceof TypeError ||
    /failed to fetch|networkerror|network request failed|load failed|net::err|econnrefused|enotfound|timed out|timeout|unable to connect/i.test(
      msg
    )
  );
}

export function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isNetworkMarkedDown() {
  if (typeof window === "undefined") return false;
  return networkDown || window.__IMP_NETWORK_DOWN__ === true;
}

/** Show Wi‑Fi screen once when network errors start (throttled). */
export function notifyNetworkUnreachable() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (networkDown && now - lastUnreachableAt < UNREACHABLE_NOTIFY_MS) return;
  lastUnreachableAt = now;
  if (networkDown) return;

  networkDown = true;
  window.__IMP_NETWORK_DOWN__ = true;
  window.dispatchEvent(new CustomEvent(NETWORK_UNREACHABLE_EVENT));
}

/** Clear Wi‑Fi screen only when we were blocked — not on every API success. */
export function notifyNetworkReachable() {
  if (typeof window === "undefined") return;
  if (!networkDown) return;

  networkDown = false;
  window.__IMP_NETWORK_DOWN__ = false;
  window.dispatchEvent(new CustomEvent(NETWORK_REACHABLE_EVENT));
}

/** After a real API response succeeds while the gate was open. */
export function markNetworkReachableFromApi() {
  notifyNetworkReachable();
}

export async function pingCompanyBackend(signal) {
  const base = String(BACKEND_URL || "").replace(/\/$/, "");
  if (!base) return false;

  const res = await fetch(`${base}/api/version`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal,
  });
  return res.ok;
}

export async function checkCompanyBackendReachable(timeoutMs = PING_TIMEOUT_MS) {
  if (isBrowserOffline()) return false;

  if (pingInFlight) return pingInFlight;

  pingInFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const ok = await pingCompanyBackend(controller.signal);
      if (ok) notifyNetworkReachable();
      return ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
      pingInFlight = null;
    }
  })();

  return pingInFlight;
}
