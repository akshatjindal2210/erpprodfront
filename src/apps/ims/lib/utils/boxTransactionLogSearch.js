import { resolveBoxTxTypeLabel } from "@/apps/ims/lib/utils/boxTransactionVisuals";
import { getBoxStickerEntries, stripUniqueScopeRow } from "@/apps/ims/lib/utils/boxTransactionStickerEntries";
import { docNoFromStandardBoxNoUid } from "@/platform/utils/global/boxUid.js";

export const BOX_TX_DISPLAY_MODES = {
  SUMMARY: "summary",
  UNIQUE: "unique",
};

function parseDetails(raw) {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

function resolvePerBoxQty(row, entryCount) {
  const details = parseDetails(row?.details);
  if (details.per_box_qty != null && Number.isFinite(Number(details.per_box_qty))) {
    return Number(details.per_box_qty);
  }
  const count = Number(row?.box_count) || entryCount || 0;
  const total = Number(row?.total_qty);
  if (Number.isFinite(total) && count > 0) return total / count;
  return Number.isFinite(total) ? total : null;
}

function resolveEntryQty(row, entry, entryCount) {
  const direct = Number(entry?.qty);
  if (Number.isFinite(direct)) return Math.round(direct * 1000) / 1000;

  const details = parseDetails(row?.details);
  const uid = String(entry?.box_no_uid ?? "").trim();
  const fromDetails = Array.isArray(details.box_sticker_entries)
    ? details.box_sticker_entries.find((e) => String(e?.box_no_uid ?? "").trim() === uid)
    : null;
  const fromDetailQty = Number(fromDetails?.qty);
  if (Number.isFinite(fromDetailQty)) return Math.round(fromDetailQty * 1000) / 1000;

  return resolvePerBoxQty(row, entryCount);
}

/** One transaction log row scoped to a single box sticker (unique view). */
export function cloneTransactionRowForBox(row, entry, sourceRow = null) {
  const baseRow = stripUniqueScopeRow(sourceRow ?? row);
  const sourceCount = getBoxStickerEntries(baseRow).length || Number(baseRow?.box_count) || 1;
  const qty = resolveEntryQty(baseRow, entry, sourceCount);
  const uid = String(entry?.box_no_uid ?? "").trim();
  const detailsRaw = baseRow?.details;
  let details = detailsRaw;
  if (detailsRaw != null && uid) {
    const parsed = parseDetails(detailsRaw);
    const scoped = scopeDetailsToMatchedUids(parsed, [uid]);
    details = typeof detailsRaw === "string" ? JSON.stringify(scoped) : scoped;
  }

  return {
    ...row,
    id: `${row.id}::${uid}`,
    _sourceLogId: row.id,
    _uniqueBoxUid: uid,
    _displayMode: BOX_TX_DISPLAY_MODES.UNIQUE,
    details,
    box_sticker_entries: [{ ...entry, box_no_uid: uid }],
    box_no_uids_display: uid,
    box_count: 1,
    total_qty: qty != null && Number.isFinite(qty) ? qty : row.total_qty ?? null,
    box_kind: entry?.is_loose ? "Loose" : "Standard",
  };
}

/** Searchable text for one sticker inside a log row (box UID only — not row packing fields). */
export function boxStickerSearchText(entry) {
  const parts = [];
  const uid = String(entry?.box_no_uid ?? "").trim();
  if (uid) parts.push(uid);
  if (entry?.is_loose) parts.push("loose");
  return parts.join(" ").toLowerCase();
}

/** Packing / doc segment from sticker UID (e.g. 26_34462_SA330_11_1 → 34462). */
export function packingNumberFromBoxStickerUid(uid) {
  const doc = docNoFromStandardBoxNoUid(uid);
  return doc != null && String(doc).trim() !== "" ? String(doc).trim() : null;
}

/** Per-box packing / doc keys from sticker UID (exact match values). */
export function entryPackingKeys(entry) {
  const uid = String(entry?.box_no_uid ?? "").trim();
  const keys = new Set();
  if (!uid) return keys;

  const doc = packingNumberFromBoxStickerUid(uid);
  if (doc) keys.add(doc.toLowerCase());

  const saMatch = uid.match(/_SA(\d+)/i);
  if (saMatch?.[1]) {
    const sa = saMatch[1].toLowerCase();
    keys.add(sa);
    keys.add(`sa${sa}`);
  }

  return keys;
}

/** Exact packing / SA ref match on the UID middle segment (not substring in other parts). */
export function entryMatchesPackingSearch(entry, query = "") {
  const q = String(query ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return true;

  const uid = String(entry?.box_no_uid ?? "").trim();
  if (!uid) return false;

  const saQuery = q.match(/^sa?(\d+)$/i);
  if (saQuery) {
    const saMatch = uid.match(/_SA(\d+)/i);
    return saMatch?.[1]?.toLowerCase() === saQuery[1];
  }

  const packingNo = packingNumberFromBoxStickerUid(uid);
  if (!packingNo) return false;
  return packingNo.toLowerCase() === q;
}

function normalizeSearchTokens(query) {
  return String(query ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function tokensMatchHaystack(tokens, haystack) {
  if (!tokens.length) return true;
  const h = String(haystack ?? "").toLowerCase();
  return tokens.every((token) => h.includes(token));
}

/** Full box sticker UID search (e.g. 26_34462_SA330_11_1). */
function isFullBoxUidSearch(query = "") {
  const q = String(query ?? "").trim();
  return q.includes("_") && q.split("_").filter(Boolean).length >= 3;
}

/** Packing / doc number or SA ref (not a full box sticker UID). e.g. 34462, sa330 */
function isPackingNumberSearch(query = "") {
  const q = String(query ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!q || isFullBoxUidSearch(q)) return false;
  if (/^sa\d+$/i.test(q)) return true;
  if (/^\d+$/.test(q)) return true;
  return false;
}

/** Unique view: one table row per log (scope matching stickers). False = expand one row per sticker. */
export function isUniquePerLogSearch(query = "") {
  return isPackingNumberSearch(query);
}

/** Match search on box sticker UID — exact when full UID given. */
export function boxStickerMatchesSearch(entry, query = "") {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return true;
  const uid = String(entry?.box_no_uid ?? "").trim().toLowerCase();
  if (isFullBoxUidSearch(q)) return uid === q;
  return tokensMatchHaystack(normalizeSearchTokens(q), boxStickerSearchText(entry));
}

/** Full / partial box UID search — not packing-number-only search. */
function isLikelyBoxStickerSearch(query = "", entries = []) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return false;
  if (isFullBoxUidSearch(q)) return true;
  if (entries.some((e) => String(e?.box_no_uid ?? "").trim().toLowerCase() === q)) return true;
  return false;
}

/** Searchable text for one sticker inside a log row (legacy — includes row fields). */
export function boxEntrySearchText(entry, row, typeLabels = {}) {
  const parts = [];
  const add = (v) => {
    if (v == null || v === "") return;
    parts.push(String(v));
  };

  add(entry?.box_no_uid);
  if (entry?.is_loose) add("loose");
  add(row?.transaction_type);
  add(typeLabels[row?.transaction_type]);
  add(resolveBoxTxTypeLabel(row?.transaction_type, row, typeLabels));
  add(row?.transaction_type?.replace(/_/g, " "));
  add(row?.source_module);
  add(row?.source_module?.replace(/_/g, " "));
  add(row?.source_id);
  add(row?.packing_number);
  add(row?.user_name);
  add(row?.id);
  add(row?.box_kind);
  add(row?.box_count);
  add(row?.total_qty);
  add(row?.created_at);

  return parts.join(" ").toLowerCase();
}

export function boxEntryMatchesSearch(entry, row, query = "", typeLabels = {}) {
  const q = String(query ?? "").trim();
  if (!q) return true;
  if (isLikelyBoxStickerSearch(q, [entry])) return boxStickerMatchesSearch(entry, q);
  return entryMatchesPackingSearch(entry, q);
}

function matchEntriesForSearch(entries, query) {
  const q = String(query ?? "").trim();
  if (!q) return entries;
  if (isLikelyBoxStickerSearch(q, entries)) {
    return entries.filter((entry) => boxStickerMatchesSearch(entry, q));
  }
  return entries.filter((entry) => entryMatchesPackingSearch(entry, q));
}

function scopeDetailsToMatchedUids(details, matchedUids) {
  if (!details || typeof details !== "object") return details;
  const uidSet = new Set(matchedUids.map((u) => String(u).trim().toLowerCase()));
  const keepUid = (uid) => uidSet.has(String(uid ?? "").trim().toLowerCase());

  const next = { ...details };

  if (Array.isArray(next.box_sticker_entries)) {
    next.box_sticker_entries = next.box_sticker_entries.filter((e) => keepUid(e?.box_no_uid));
  }

  if (Array.isArray(next.box_no_uids)) {
    next.box_no_uids = next.box_no_uids.filter(keepUid);
  } else if (typeof next.box_no_uids === "string") {
    next.box_no_uids = next.box_no_uids
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(keepUid);
  }

  if (Array.isArray(next.box_uids)) {
    next.box_uids = next.box_uids.filter(keepUid);
  }

  if (next.box_no_uid && !keepUid(next.box_no_uid)) {
    delete next.box_no_uid;
  }

  return next;
}

/** Summary row — only matching stickers, updated count & qty. */
export function scopeSummaryRowToMatchingEntries(row, query = "", typeLabels = {}) {
  const q = String(query ?? "").trim();
  if (!q) return row;

  const sourceRow = stripUniqueScopeRow(row);
  const allEntries = getBoxStickerEntries(sourceRow);

  if (!allEntries.length) {
    return filterBoxTransactionLogs([row], q, typeLabels).length ? row : null;
  }

  const matched = matchEntriesForSearch(allEntries, q);
  if (!matched.length) {
    if (isLikelyBoxStickerSearch(q, allEntries) || isPackingNumberSearch(q)) return null;
    return tokensMatchHaystack(normalizeSearchTokens(q), boxTransactionSearchText(row, typeLabels))
      ? row
      : null;
  }

  const sourceCount = allEntries.length || Number(row?.box_count) || 1;
  let totalQty = 0;
  let qtyKnown = false;
  for (const entry of matched) {
    const qv = resolveEntryQty(row, entry, sourceCount);
    if (qv != null && Number.isFinite(qv)) {
      totalQty += qv;
      qtyKnown = true;
    }
  }

  const uids = matched.map((e) => String(e.box_no_uid ?? "").trim()).filter(Boolean);
  const looseCount = matched.filter((e) => e.is_loose).length;

  let details = row?.details;
  if (details != null && uids.length) {
    const parsed = parseDetails(details);
    const scoped = scopeDetailsToMatchedUids(parsed, uids);
    details = typeof row.details === "string" ? JSON.stringify(scoped) : scoped;
  }

  return {
    ...row,
    _searchScoped: true,
    details,
    box_sticker_entries: matched,
    box_no_uids_display: uids.join(", "),
    box_count: matched.length,
    total_qty: qtyKnown ? Math.round(totalQty * 1000) / 1000 : row.total_qty ?? null,
    box_kind:
      looseCount === 0
        ? "Standard"
        : looseCount === matched.length
          ? "Loose"
          : "Standard + Loose",
  };
}

/** Split log rows — one table row per matching box sticker. */
export function expandBoxTransactionLogsToUnique(rows = [], query = "", typeLabels = {}) {
  const q = String(query ?? "").trim();
  const out = [];

  for (const row of rows) {
    const sourceRow = stripUniqueScopeRow(row);
    const entries = getBoxStickerEntries(sourceRow);

    if (!entries.length) {
      if (!q) {
        out.push(row);
        continue;
      }
      if (isPackingNumberSearch(q) || isFullBoxUidSearch(q)) continue;
      if (filterBoxTransactionLogs([row], q, typeLabels).length) out.push(row);
      continue;
    }

    const matchedEntries = matchEntriesForSearch(entries, q);
    if (!matchedEntries.length) continue;

    for (const entry of matchedEntries) {
      out.push(cloneTransactionRowForBox(row, entry, sourceRow));
    }
  }

  return out;
}

/** Unique + packing search: one log row, only stickers for that packing, updated count/qty. */
function scopeUniqueRowToMatchingPackings(row, query = "", typeLabels = {}) {
  return scopeSummaryRowToMatchingEntries(row, query, typeLabels);
}

/** Summary + search: keep the full log row (all stickers). Unique + search: matching stickers only. */
export function applyBoxTransactionLogView(rows = [], { query = "", typeLabels = {}, mode = "summary", skipSort = false } = {}) {
  const key = String(mode || BOX_TX_DISPLAY_MODES.SUMMARY).toLowerCase();
  const q = String(query ?? "").trim();

  if (!q) {
    if (key === BOX_TX_DISPLAY_MODES.UNIQUE) {
      return expandBoxTransactionLogsToUnique(rows, query, typeLabels);
    }
    return rows;
  }

  const filtered = filterBoxTransactionLogs(rows, query, typeLabels, { skipSort });

  if (key === BOX_TX_DISPLAY_MODES.UNIQUE) {
    // Packing number (e.g. 34462): max one row per log, only matching stickers + qty.
    if (isUniquePerLogSearch(q)) {
      return filtered
        .map((row) => scopeUniqueRowToMatchingPackings(row, query, typeLabels))
        .filter(Boolean);
    }
    // Full box UID: one table row per matching sticker.
    return expandBoxTransactionLogsToUnique(filtered, query, typeLabels);
  }

  // Summary: only filter which logs appear — sticker list, counts, and qty stay as loaded.
  return filtered.map((row) => stripUniqueScopeRow(row));
}

/** Build searchable text for one box transaction log row (all UI + JSON fields). */
export function boxTransactionSearchText(row, typeLabels = {}) {
  const parts = [];
  const add = (v) => {
    if (v == null || v === "") return;
    parts.push(String(v));
  };

  add(row?.id);
  add(row?.user_name);
  add(row?.transaction_type);
  add(typeLabels[row?.transaction_type]);
  add(resolveBoxTxTypeLabel(row?.transaction_type, row, typeLabels));
  add(row?.transaction_type?.replace(/_/g, " "));
  add(row?.source_module);
  add(row?.source_module?.replace(/_/g, " "));
  add(row?.source_id);
  add(row?.packing_number);
  add(row?.box_no_uids_display);
  add(row?.box_kind);
  add(row?.box_count);
  add(row?.total_qty);
  add(row?.created_at);

  const details = typeof row?.details === "string" ? parseDetails(row.details) : (row?.details || {});
  if (details && typeof details === "object") {
    add(details.box_kind);
    add(details.count);
    add(details.total_qty);
    add(details.qty);
    add(details.per_box_qty);
    add(details.standard_count);
    add(details.loose_count);
    add(details.entry_type);
    add(details.in_uid);
    add(details.out_uid);
    add(details.adjustment_id);
    add(details.location_id);
    if (Array.isArray(details.box_no_uids)) {
      details.box_no_uids.forEach(add);
    } else if (typeof details.box_no_uids === "string") {
      details.box_no_uids.split(/[\s,;]+/).forEach((s) => add(s.trim()));
    }
    if (Array.isArray(details.box_sticker_entries)) {
      details.box_sticker_entries.forEach((e) => add(e?.box_no_uid));
    }
    if (Array.isArray(details.box_uids)) {
      details.box_uids.forEach(add);
    }
    if (Array.isArray(details.packing_numbers)) {
      details.packing_numbers.forEach(add);
    }
  }

  return parts.join(" ").toLowerCase();
}

/** Client-side filter for box transaction logs (type labels, sticker nos, box kind, etc.). */
export function filterBoxTransactionLogs(rows = [], query = "", typeLabels = {}, options = {}) {
  const q = String(query ?? "").trim();
  if (!q) return rows;
  const tokens = normalizeSearchTokens(q);

  const filtered = rows.filter((row) => {
    const sourceRow = stripUniqueScopeRow(row);
    const entries = getBoxStickerEntries(sourceRow);

    if (entries.length) {
      const matched = matchEntriesForSearch(entries, q);
      if (matched.length > 0) return true;
      if (isLikelyBoxStickerSearch(q, entries) || isPackingNumberSearch(q)) return false;
    }

    if (isPackingNumberSearch(q) || isFullBoxUidSearch(q)) return false;

    return tokensMatchHaystack(tokens, boxTransactionSearchText(row, typeLabels));
  });

  if (options.skipSort) return filtered;

  return filtered; // Original sort preserved or handled by caller
}

function compareBoxTransactionRows(a, b, sortKey) {
  if (sortKey === "id") {
    return (Number(a?.id) || 0) - (Number(b?.id) || 0);
  }
  if (sortKey === "created_at") {
    const ta = new Date(a?.created_at).getTime() || 0;
    const tb = new Date(b?.created_at).getTime() || 0;
    if (ta !== tb) return ta - tb;
    return (Number(a?.id) || 0) - (Number(b?.id) || 0);
  }
  const va = String(a?.[sortKey] ?? "").toLowerCase();
  const vb = String(b?.[sortKey] ?? "").toLowerCase();
  if (va < vb) return -1;
  if (va > vb) return 1;
  return (Number(a?.id) || 0) - (Number(b?.id) || 0);
}

/** Keep list order aligned with table sort (default: newest first). */
export function sortBoxTransactionLogs(
  rows = [],
  sortKey = "created_at",
  sortDir = "desc"
) {
  const dir = String(sortDir).toLowerCase() === "asc" ? 1 : -1;
  const key = sortKey || "created_at";
  return [...rows].sort((a, b) => compareBoxTransactionRows(a, b, key) * dir);
}
