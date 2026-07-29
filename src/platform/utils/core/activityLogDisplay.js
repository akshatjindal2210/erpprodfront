const SKIP_KEYS = new Set([
  "success",
  "action",
  "entity",
  "entity_ref",
  "ref",
  "summary",
  "more",
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "deleted_by",
  "password",
  "token",
]);

function parsePayload(data) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return { raw: data };
    }
  }
  return data;
}

function normalizeQtyForMinus(info) {
  if (!info || typeof info !== "object") return info;
  const type = String(info.Type || info.type || info["Entry type"] || info.entry_type || "").toLowerCase();
  const qtyKey = info.Qty != null ? "Qty" : info.qty != null ? "qty" : null;
  if (!qtyKey || type !== "minus") return info;

  const q = Number(info[qtyKey]);
  if (!Number.isFinite(q)) return info;
  return { ...info, [qtyKey]: String(Math.abs(q)) };
}

function normalizeLegacyStockAdjustment(data) {
  if (!data || typeof data !== "object") return data;
  const out = { ...data };

  if (out.info) out.info = normalizeQtyForMinus(out.info);
  if (out.more) out.more = normalizeQtyForMinus(out.more);

  for (const key of ["details", "delete_context", "update_context", "approval_context", "created_fields", "record"]) {
    if (out[key] && typeof out[key] === "object") {
      const block = { ...out[key] };
      if (String(block.entry_type || block.Type || "").toLowerCase() === "minus" && block.qty != null) {
        const q = Number(block.qty);
        if (Number.isFinite(q)) block.qty = Math.abs(q);
      }
      if (block.Qty != null && String(block.Type || block.entry_type || "").toLowerCase() === "minus") {
        const q = Number(block.Qty);
        if (Number.isFinite(q)) block.Qty = Math.abs(q);
      }
      out[key] = block;
    }
  }

  return out;
}

function renderBlock(block) {
  if (!block || typeof block !== "object") return null;
  const entries = Object.entries(block).filter(([key]) => !SKIP_KEYS.has(key));
  return entries.length ? entries : null;
}

/** Main details — short summary (Type, Qty, Packing, etc.). */
export function getActivityLogSections(data) {
  const payload = normalizeLegacyStockAdjustment(parsePayload(data));
  if (!payload || typeof payload !== "object") return [];

  if (payload.info && typeof payload.info === "object" && Object.keys(payload.info).length) {
    return [{ title: "Summary", data: payload.info, kind: "fields" }];
  }

  const legacyKeys = [
    "deleted_record",
    "created_record",
    "updated_record",
    "approved_record",
    "record",
    "details",
    "delete_context",
    "update_context",
    "approval_context",
    "created_fields",
    "body",
    "meta",
  ];

  const sections = [];
  for (const key of legacyKeys) {
    const value = payload[key];
    if (value == null || typeof value !== "object" || !Object.keys(value).length) continue;
    sections.push({ title: "Summary", data: normalizeQtyForMinus(value), kind: "fields" });
    break;
  }

  if (!sections.length) {
    const fallback = {};
    for (const [key, value] of Object.entries(payload)) {
      if (SKIP_KEYS.has(key)) continue;
      fallback[key] = value;
    }
    if (Object.keys(fallback).length) {
      sections.push({ title: "Summary", data: fallback, kind: "fields" });
    }
  }

  return sections;
}

/** Extra details — shown only when user expands (box ids, remarks, etc.). */
export function getActivityLogMoreSections(data) {
  const payload = normalizeLegacyStockAdjustment(parsePayload(data));
  if (!payload?.more || typeof payload.more !== "object" || !Object.keys(payload.more).length) {
    return [];
  }
  return [{ title: "More details", data: payload.more, kind: "fields" }];
}

export function hasActivityLogDetails(data) {
  const payload = parsePayload(data);
  if (!payload || typeof payload !== "object") return false;
  if (payload.info && Object.keys(payload.info).length) return true;
  if (payload.more && Object.keys(payload.more).length) return true;
  return getActivityLogSections(data).length > 0;
}

export function formatActivityLogValue(value) {
  if (value === true || value === 1 || value === "1") return "Yes";
  if (value === false || value === 0 || value === "0") return "No";
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    if (value.from !== undefined || value.to !== undefined) {
      return `${formatActivityLogValue(value.from)} → ${formatActivityLogValue(value.to)}`;
    }
    return "—";
  }
  return String(value);
}

/** Module/Entity REF: entity_id, else log_data.ref. */
export function resolveActivityLogRef(row) {
  const direct = row?.entity_id;
  if (direct != null && String(direct).trim() !== "") return String(direct).trim();
  const payload = parsePayload(row?.log_data);
  const ref = payload?.ref;
  if (ref != null && String(ref).trim() !== "") return String(ref).trim();
  return null;
}

export function renderActivityLogFields(data) {
  return renderBlock(data);
}
