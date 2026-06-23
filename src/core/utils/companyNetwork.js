import { BACKEND_URL } from "@/core/utils/lib";
import { isPwaStandalone } from "@/core/utils/pwa";

export const NETWORK_UNREACHABLE_EVENT = "imp:network-unreachable";
export const NETWORK_REACHABLE_EVENT = "imp:network-reachable";

const PING_TIMEOUT_MS = 8000;
const PUBLIC_IP_TIMEOUT_MS = 5000;
const PUBLIC_IP_CACHE_MS = 60000;
const UNREACHABLE_NOTIFY_MS = 4000;

let networkDown = false;
let lastUnreachableAt = 0;
let pingInFlight = null;
let cachedPublicIp = null;
let cachedPublicIpAt = 0;
let publicIpInFlight = null;

export function getCompanyPublicIp() {
  return String(process.env.NEXT_PUBLIC_COMPANY_PUBLIC_IP || "").trim();
}

export function isOnCompanyPublicNetwork(ip) {
  const companyIp = getCompanyPublicIp();
  if (!companyIp || !ip) return false;
  return String(ip).trim() === companyIp;
}

/** Resolve the device public IP (cached). Used to tell company Wi‑Fi from mobile data. */
export async function resolveClientPublicIp(timeoutMs = PUBLIC_IP_TIMEOUT_MS) {
  if (typeof window === "undefined") return null;

  const now = Date.now();
  if (cachedPublicIp && now - cachedPublicIpAt < PUBLIC_IP_CACHE_MS) {
    return cachedPublicIp;
  }

  if (publicIpInFlight) return publicIpInFlight;

  publicIpInFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("https://api.ipify.org?format=json", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      const ip = String(data?.ip || "").trim();
      if (ip) {
        cachedPublicIp = ip;
        cachedPublicIpAt = Date.now();
      }
      return ip || null;
    } catch {
      return cachedPublicIp;
    } finally {
      clearTimeout(timer);
      publicIpInFlight = null;
    }
  })();

  return publicIpInFlight;
}

/**
 * PWA only. Off company public IP + no route to backend — not when server responds (5xx) or on company IP.
 */
export async function shouldShowCompanyWifiGate({ offline = false, transportFailure = false } = {}) {
  if (!isPwaStandalone()) return false;
  if (!offline && !transportFailure) return false;

  const ip = await resolveClientPublicIp();
  if (isOnCompanyPublicNetwork(ip)) return false;

  return true;
}

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

  void (async () => {
    if (!(await shouldShowCompanyWifiGate({ transportFailure: true }))) return;

    const now = Date.now();
    if (networkDown && now - lastUnreachableAt < UNREACHABLE_NOTIFY_MS) return;
    lastUnreachableAt = now;
    if (networkDown) return;

    networkDown = true;
    window.__IMP_NETWORK_DOWN__ = true;
    window.dispatchEvent(new CustomEvent(NETWORK_UNREACHABLE_EVENT));
  })();
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

/**
 * Ping the company backend. Any HTTP response (even 5xx) means the server was reached.
 * Only transport failures (wrong network, refused connection, DNS) count as unreachable.
 */
export async function pingCompanyBackend(signal) {
  const base = String(BACKEND_URL || "").replace(/\/$/, "");
  if (!base) return { reached: false, transportFailure: true };

  try {
    await fetch(`${base}/api/version`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal,
    });
    return { reached: true, transportFailure: false };
  } catch (err) {
    if (err?.name === "AbortError") return { reached: false, transportFailure: false };
    return { reached: false, transportFailure: isNetworkReachabilityError(err) };
  }
}

export async function checkCompanyBackendReachable(timeoutMs = PING_TIMEOUT_MS) {
  if (isBrowserOffline()) {
    return !(await shouldShowCompanyWifiGate({ offline: true }));
  }

  if (pingInFlight) return pingInFlight;

  pingInFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { reached, transportFailure } = await pingCompanyBackend(controller.signal);
      if (reached) {
        notifyNetworkReachable();
        return true;
      }
      // Timeout / inconclusive — do not show the Wi‑Fi gate.
      if (!transportFailure) return true;
      return !(await shouldShowCompanyWifiGate({ transportFailure: true }));
    } finally {
      clearTimeout(timer);
      pingInFlight = null;
    }
  })();

  return pingInFlight;
}
