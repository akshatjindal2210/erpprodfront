import { API_BASE_URL } from "@/platform/utils/core/lib";
import { attendanceLogService } from "@/apps/hrms/lib/services/hrms";

const CACHE_MAX = 64;
const BLOB_MAX = 64;
const MAX_IN_FLIGHT = 2;
const QUEUE_MAX = 24;

const cache = new Map();
const blobCache = new Map();
const lru = [];
const blobLru = [];
let active = 0;
const q = [];

const rowKey = (r) => r?.id != null && r.id !== "" ? `id:${r.id}` : `${String(r?.employee_code ?? "").trim()}|${String(r?.event_timestamp ?? "").trim()}|${r?.sub_event_type ?? ""}`;

const absUrl = (p) => {
  const path = String(p ?? "").trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

function touchLru(key, order, max, map) {
  const i = order.indexOf(key);
  if (i >= 0) order.splice(i, 1);
  order.push(key);
  while (order.length > max) {
    const drop = order.shift();
    map.delete(drop);
  }
}

function touchBlobLru(httpUrl) {
  const i = blobLru.indexOf(httpUrl);
  if (i >= 0) blobLru.splice(i, 1);
  blobLru.push(httpUrl);
  while (blobLru.length > BLOB_MAX) {
    const drop = blobLru.shift();
    const blob = blobCache.get(drop);
    if (blob) URL.revokeObjectURL(blob);
    blobCache.delete(drop);
  }
}

async function toAuthBlobUrl(httpUrl) {
  if (blobCache.has(httpUrl)) {
    touchBlobLru(httpUrl);
    return blobCache.get(httpUrl);
  }
  const res = await fetch(httpUrl, { credentials: "include", mode: "cors" });
  if (!res.ok) throw new Error(`Image ${res.status}`);
  const blobUrl = URL.createObjectURL(await res.blob());
  blobCache.set(httpUrl, blobUrl);
  touchBlobLru(httpUrl);
  return blobUrl;
}

const NOT_FOUND = { displayUrl: "", proxyUrl: "", sourceUrl: "", notFound: true };

const parseRes = async (res) => {
  const proxyUrl = absUrl(String(res?.data?.image_proxy_url ?? res?.data?.image_url ?? "").trim());
  const sourceUrl = String(res?.data?.source_image_url ?? "").trim();
  const dataUrl = String(res?.data?.image_data_url ?? "").trim();
  if (dataUrl) return { displayUrl: dataUrl, proxyUrl, sourceUrl };
  if (!proxyUrl) return NOT_FOUND;
  try {
    return { displayUrl: await toAuthBlobUrl(proxyUrl), proxyUrl, sourceUrl };
  } catch {
    return NOT_FOUND;
  }
};

function pump() {
  while (active < MAX_IN_FLIGHT && q.length) {
    const [fn, ok, err] = q.shift();
    active += 1;
    Promise.resolve().then(fn).then(ok, err).finally(() => {
      active -= 1;
      pump();
    });
  }
}

const runQueued = (fn) =>
  new Promise((ok, err) => {
    if (q.length >= QUEUE_MAX) {
      ok(NOT_FOUND);
      return;
    }
    q.push([fn, ok, err]);
    pump();
  });

export function fetchAttendanceLogImage(row, force) {
  const key = rowKey(row);
  if (!force) {
    const hit = cache.get(key);
    if (hit) return typeof hit.then === "function" ? hit : Promise.resolve(hit);
  }
  const p = runQueued(() =>
    attendanceLogService
      .image({ employee_code: row?.employee_code, event_timestamp: row?.event_timestamp, sub_event_type: row?.sub_event_type })
      .then(parseRes)
  )
    .then((r) => {
      cache.set(key, r);
      touchLru(key, lru, CACHE_MAX, cache);
      return r;
    })
    .catch((e) => {
      cache.delete(key);
      throw e;
    });
  cache.set(key, p);
  return p;
}

export function peekAttendanceLogImage(row) {
  const hit = cache.get(rowKey(row));
  return hit && typeof hit.then !== "function" ? hit : null;
}
