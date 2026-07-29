import { BACKEND_URL } from "@/platform/utils/core/lib";
import { isPwaStandalone } from "@/platform/utils/pwa/pwa";

export const NETWORK_UNREACHABLE_EVENT = "imp:network-unreachable";
export const NETWORK_REACHABLE_EVENT = "imp:network-reachable";

const PING_TIMEOUT_MS = 8000;
const UNREACHABLE_NOTIFY_MS = 4000;

let networkDown = false;
let lastUnreachableAt = 0;
let pingInFlight = null;

function hostPattern() {
  return String(process.env.NEXT_PUBLIC_BACKEND_URL_DOMAIN || "").trim().toLowerCase();
}

function externalHostPattern() {
  return String(process.env.NEXT_PUBLIC_BACKEND_URL2_DOMAIN || "").trim().toLowerCase();
}

function matchesHost(hostname, pattern) {
  const p = String(pattern || "").trim().toLowerCase();
  if (!p) return false;
  return String(hostname || "").trim().toLowerCase().includes(p);
}

/** Office / internal frontend — e.g. dev.jflbharat.com */
export function isInternalFrontendHost(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  return matchesHost(hostname, hostPattern());
}

/** External portal (Cloudflare OTP) — e.g. out.dev.jflbharat.com */
export function isExternalFrontendHost(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  return matchesHost(hostname, externalHostPattern());
}

/**
 * PWA only on the internal domain. External portal users are never blocked here.
 * Off internal domain + no route to backend — not when server responds (5xx).
 */
export async function shouldShowCompanyWifiGate({ offline = false, transportFailure = false } = {}) {
  if (!isPwaStandalone()) return false;
  if (isExternalFrontendHost()) return false;
  if (!isInternalFrontendHost()) return false;
  if (!offline && !transportFailure) return false;
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

/** Show office-network screen once when network errors start (throttled). */
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

/** Clear office-network screen only when we were blocked — not on every API success. */
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
  if (isExternalFrontendHost()) return true;

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
      if (!transportFailure) return true;
      return !(await shouldShowCompanyWifiGate({ transportFailure: true }));
    } finally {
      clearTimeout(timer);
      pingInFlight = null;
    }
  })();

  return pingInFlight;
}
