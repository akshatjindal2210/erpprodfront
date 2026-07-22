import { API_BASE_URL } from "../utils/lib";
import { isNetworkReachabilityError, isNetworkMarkedDown, markNetworkReachableFromApi, notifyNetworkUnreachable } from "../utils/companyNetwork";

/** Dedupe IMS / network warning toasts when many parallel API calls fail together */
const IMS_TOAST_THROTTLE_MS = 14000;
let __lastImsToastAt = 0;
let __lastImsToastMsg = "";
let __lastNetworkToastAt = 0;

function showWarningToast(msg, toastId) {
  if (typeof window === "undefined") return;
  const text = String(msg || "").trim();
  if (!text) return;
  queueMicrotask(() => {
    import("react-toastify")
      .then(({ toast }) => {
        toast.warning(text, {
          autoClose: 9000,
          position: "top-center",
          toastId,
        });
      })
      .catch(() => {});
  });
}

const IMS_TOAST_FALLBACK = "ERP (IMS) data could not be loaded.";
const IMS_TECHNICAL_MSG =
  /database\s*query\s*failed|query\s*failed|sql\s*error|syntax\s*error|invalid\s*input\s*syntax|requested\s*data|requested\s*date|`requested|internal\s+server\s+error/i;

function publicImsToastMessage(meta) {
  const raw = String(meta?.message || "").trim();
  if (!raw || IMS_TECHNICAL_MSG.test(raw)) return IMS_TOAST_FALLBACK;
  return raw;
}

/**
 * Successful responses often still carry `ims_meta.ok = false` when a secondary IMS call
 * failed inside the same request (e.g. one hybrid widget failed while others returned rows).
 * Only toast when the client did not get usable primary data.
 */
function responseHasUsableData(data) {
  if (!data || typeof data !== "object") return false;
  if (data.success === false) return false;
  const payload = data.data;
  if (Array.isArray(payload)) {
    if (!payload.length) return false;
    // Dashboard widget payloads: toast only when no widget actually returned rows.
    const looksLikeWidgets = payload.some(
      (row) => row && typeof row === "object" && ("chart_config" in row || "has_query" in row || "previewData" in row),
    );
    if (looksLikeWidgets) {
      return payload.some((row) => {
        if (!row || typeof row !== "object") return false;
        const rows = row.data;
        return Array.isArray(rows) && rows.length > 0;
      });
    }
    return true;
  }
  if (payload != null && typeof payload === "object") {
    return Object.keys(payload).length > 0;
  }
  // Some IMS-backed endpoints put rows on `records` instead of `data`.
  if (Array.isArray(data.records) && data.records.length > 0) return true;
  return false;
}

/**
 * When backend attaches `ims_meta.ok = false` (internal IMS ERP API failed / no response),
 * show a friendly warning — never raw DB/SQL text like "Database query failed."
 * Skip the toast when the same response already delivered usable content.
 */
function maybeToastImsUnavailable(meta, data = null, { requestFailed = false } = {}) {
  if (typeof window === "undefined" || !meta || meta.ok !== false) return;
  if (!requestFailed && responseHasUsableData(data)) return;
  const msg = publicImsToastMessage(meta);
  const now = Date.now();
  if (msg === __lastImsToastMsg && now - __lastImsToastAt < IMS_TOAST_THROTTLE_MS) return;
  __lastImsToastAt = now;
  __lastImsToastMsg = msg;
  showWarningToast(msg, "ims-unavailable");
}

/** Our ERP backend fetch never got an HTTP response (down / network / CORS). */
function maybeToastBackendUnreachable(err) {
  if (typeof window === "undefined") return;
  if (!isNetworkReachabilityError(err)) return;
  const now = Date.now();
  if (now - __lastNetworkToastAt < IMS_TOAST_THROTTLE_MS) return;
  __lastNetworkToastAt = now;
  showWarningToast(
    "Server not responding. Check company network / backend and try again.",
    "backend-unreachable"
  );
}

/** Drop DOM, React synthetic events, functions, symbols, cycles — only JSON-safe data reaches the server. */
function sanitizeForJson(value, seen = new WeakSet()) {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  if (t === "undefined") return undefined;
  if (t === "bigint") return Number(value);
  if (t === "function" || t === "symbol") return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof File !== "undefined" && value instanceof File) {
    throw new Error("File in JSON body — use FormData instead.");
  }
  if (typeof Node !== "undefined" && value instanceof Node) return undefined;
  if (typeof Window !== "undefined" && value instanceof Window) return undefined;
  if (t === "object" && value != null && typeof value.nativeEvent === "object" && typeof value.preventDefault === "function") {
    return undefined;
  }
  if (t === "object" && typeof value.then === "function") return undefined;

  if (t === "object") {
    if (seen.has(value)) return undefined;
    seen.add(value);
    if (Array.isArray(value)) {
      const arr = value.map((item) => sanitizeForJson(item, seen)).filter((x) => x !== undefined);
      return arr;
    }
    const out = {};
    for (const k of Object.keys(value)) {
      const v = sanitizeForJson(value[k], seen);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return undefined;
}

export async function api(endpoint, { method = "GET", body, headers = {}, signal, expectStatuses = [] } = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  let serializedBody;
  if (body != null) {
    const cleaned = sanitizeForJson(body);
    if (cleaned === undefined) {
      throw new Error(
        "Request body is empty after removing non-JSON values (e.g. a click event was passed instead of a plain object)."
      );
    }
    serializedBody = JSON.stringify(cleaned);
  }

  const options = {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: serializedBody,
    ...(signal ? { signal } : {}),
  };

  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);

    if (typeof window !== "undefined" && res.status) {
      if (isNetworkMarkedDown()) markNetworkReachableFromApi();
    }

    if (!res.ok) {
      if (expectStatuses.includes(res.status)) {
        return {
          success: false,
          status: res.status,
          message: data?.message || `Request failed with status ${res.status}`,
          data: data?.data ?? null,
        };
      }

      maybeToastImsUnavailable(data?.ims_meta, data, { requestFailed: true });
      if (typeof window !== "undefined") {
        window.__LAST_API_ERROR__ = {
          status: res.status,
          message: data?.message || "",
          endpoint,
          ts: Date.now(),
        };
      }
      const error = new Error(data?.message || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.payload = data;
      throw error;
    }

    if (typeof window !== "undefined" && window.__LAST_API_ERROR__) {
      const last = window.__LAST_API_ERROR__;
      if (last?.endpoint === endpoint) {
        window.__LAST_API_ERROR__ = null;
      }
    }

    maybeToastImsUnavailable(data?.ims_meta, data, { requestFailed: false });

    return data;
  } catch (err) {
    if (isNetworkReachabilityError(err)) {
      maybeToastBackendUnreachable(err);
      notifyNetworkUnreachable();
    }
    throw err;
  }
}
