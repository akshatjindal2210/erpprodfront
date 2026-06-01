import { API_BASE_URL } from "../utils/lib";

/** Dedupe IMS warning toasts when many parallel API calls fail together */
const IMS_TOAST_THROTTLE_MS = 14000;
let __lastImsToastAt = 0;
let __lastImsToastMsg = "";

function maybeToastImsUnavailable(meta) {
  if (typeof window === "undefined" || !meta || meta.ok !== false) return;
  const msg = String(meta.message || "ERP (IMS) data could not be loaded.").trim();
  const now = Date.now();
  if (msg === __lastImsToastMsg && now - __lastImsToastAt < IMS_TOAST_THROTTLE_MS) return;
  __lastImsToastAt = now;
  __lastImsToastMsg = msg;
  queueMicrotask(() => {
    import("react-toastify")
      .then(({ toast }) => {
        toast.warning(msg, {
          autoClose: 9000,
          position: "top-center",
          toastId: "ims-unavailable",
        });
      })
      .catch(() => {});
  });
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

export async function api(endpoint, { method = "GET", body, headers = {}, signal } = {}) {
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

    if (!res.ok) {
      maybeToastImsUnavailable(data?.ims_meta);
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

    maybeToastImsUnavailable(data?.ims_meta);

    return data;
  } catch (err) {
    throw err;
  }
}
