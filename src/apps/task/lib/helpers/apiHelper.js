import { API_BASE_URL } from "@/platform/utils/core/lib";
import {
  isNetworkReachabilityError,
  isNetworkMarkedDown,
  markNetworkReachableFromApi,
  notifyNetworkUnreachable,
} from "@/platform/utils/auth/companyNetwork";

function buildUrl(path, params) {
  if (!path) {
    console.error("apiHelper: path is undefined", { path, params });
    throw new Error("API path is required");
  }
  const base = String(API_BASE_URL || "").replace(/\/$/, "");
  const segment = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${segment}`);
  if (params && typeof params === "object") {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }
  return url.toString();
}

function isFormData(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function request(method, path, { params, data, headers = {}, signal } = {}) {
  const url = buildUrl(path, params);
  const init = {
    method,
    credentials: "include",
    headers: { ...headers },
    ...(signal ? { signal } : {}),
  };

  if (data != null && method !== "GET" && method !== "HEAD") {
    if (isFormData(data)) {
      init.body = data;
      delete init.headers["Content-Type"];
      delete init.headers["content-type"];
    } else {
      init.headers["Content-Type"] =
        init.headers["Content-Type"] || "application/json";
      init.body = JSON.stringify(data);
    }
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (isNetworkReachabilityError(err)) notifyNetworkUnreachable();
    throw err;
  }
  const contentType = res.headers.get("content-type") || "";
  let parsed = null;

  if (contentType.includes("application/json")) {
    parsed = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => "");
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { message: text };
      }
    }
  }

  if (isNetworkMarkedDown()) markNetworkReachableFromApi();

  if (!res.ok) {
    const error = new Error(
      parsed?.message || `Request failed with status ${res.status}`,
    );
    error.status = res.status;
    error.response = { data: parsed, status: res.status };
    throw error;
  }

  return { data: parsed, status: res.status };
}

/** Fetch client with axios-like `{ data }` responses for existing task services. */
const api = {
  get: (path, config = {}) =>
    request("GET", path, { params: config.params, signal: config.signal }),
  post: (path, data, config = {}) =>
    request("POST", path, {
      data,
      headers: config.headers,
      signal: config.signal,
    }),
  put: (path, data, config = {}) =>
    request("PUT", path, {
      data,
      headers: config.headers,
      signal: config.signal,
    }),
  patch: (path, data, config = {}) =>
    request("PATCH", path, {
      data,
      headers: config.headers,
      signal: config.signal,
    }),
  delete: (path, config = {}) =>
    request("DELETE", path, {
      params: config.params,
      data: config.data,
      headers: config.headers,
      signal: config.signal,
    }),
};

export default api;

