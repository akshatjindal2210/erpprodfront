import { resolveCoilTxTypeLabel } from "@/apps/rmstore/lib/utils/coilTransactionVisuals";
import { getCoilStickerEntries, stripUniqueScopeRow } from "@/apps/rmstore/lib/utils/coilTransactionStickerEntries";

export const COIL_TX_DISPLAY_MODES = {
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

/** Full coil sticker UID e.g. 26_3701_1_05_02 */
function isFullCoilUidSearch(query = "") {
  const q = String(query ?? "").trim();
  return q.includes("_") && q.split("_").filter(Boolean).length >= 3;
}

/** MRN number search (digits only, not full UID). */
function isMrnNumberSearch(query = "") {
  const q = String(query ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!q || isFullCoilUidSearch(q)) return false;
  return /^\d+$/.test(q);
}

export function isUniquePerLogSearch(query = "") {
  return isMrnNumberSearch(query);
}

/** MRN segment from coil UID: prefix_mrn_serial_total_coli */
export function mrnFromCoilStickerUid(uid) {
  const parts = String(uid ?? "").trim().split("_").filter(Boolean);
  return parts.length >= 2 ? parts[1] : null;
}

function coilStickerSearchText(entry) {
  return String(entry?.coil_no_uid ?? "").trim().toLowerCase();
}

export function coilStickerMatchesSearch(entry, query = "") {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return true;
  const uid = String(entry?.coil_no_uid ?? "").trim().toLowerCase();
  if (isFullCoilUidSearch(q)) return uid === q;
  return tokensMatchHaystack(normalizeSearchTokens(q), coilStickerSearchText(entry));
}

export function entryMatchesMrnSearch(entry, query = "") {
  const q = String(query ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return true;
  const mrn = mrnFromCoilStickerUid(entry?.coil_no_uid);
  return mrn != null && String(mrn).toLowerCase() === q;
}

function isLikelyCoilStickerSearch(query = "", entries = []) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return false;
  if (isFullCoilUidSearch(q)) return true;
  return entries.some((e) => String(e?.coil_no_uid ?? "").trim().toLowerCase() === q);
}

function matchEntriesForSearch(entries, query) {
  const q = String(query ?? "").trim();
  if (!q) return entries;
  if (isLikelyCoilStickerSearch(q, entries)) {
    return entries.filter((entry) => coilStickerMatchesSearch(entry, q));
  }
  return entries.filter((entry) => entryMatchesMrnSearch(entry, q));
}

function resolveEntryQty(row, entry, entryCount) {
  const direct = Number(entry?.qty);
  if (Number.isFinite(direct)) return Math.round(direct * 1000) / 1000;
  const count = Number(row?.coil_count) || entryCount || 0;
  const total = Number(row?.total_qty);
  if (Number.isFinite(total) && count > 0) return Math.round((total / count) * 1000) / 1000;
  return Number.isFinite(total) ? total : null;
}

export function cloneTransactionRowForCoil(row, entry, sourceRow = null) {
  const baseRow = stripUniqueScopeRow(sourceRow ?? row);
  const sourceCount = getCoilStickerEntries(baseRow).length || Number(baseRow?.coil_count) || 1;
  const qty = resolveEntryQty(baseRow, entry, sourceCount);
  const uid = String(entry?.coil_no_uid ?? "").trim();

  return {
    ...row,
    id: `${row.id}::${uid}`,
    _sourceLogId: row.id,
    _uniqueCoilUid: uid,
    _displayMode: COIL_TX_DISPLAY_MODES.UNIQUE,
    coil_sticker_entries: [{ ...entry, coil_no_uid: uid }],
    coil_no_uids_display: uid,
    coil_count: 1,
    total_qty: qty != null && Number.isFinite(qty) ? qty : row.total_qty ?? null,
  };
}

export function coilTransactionSearchText(row, typeLabels = {}) {
  const parts = [];
  const add = (v) => {
    if (v == null || v === "") return;
    parts.push(String(v));
  };

  add(row?.id);
  add(row?.user_name);
  add(row?.transaction_type);
  add(typeLabels[row?.transaction_type]);
  add(resolveCoilTxTypeLabel(row?.transaction_type, row, typeLabels));
  add(row?.source_module);
  add(row?.source_id);
  add(row?.mrn_no);
  add(row?.coil_no_uids_display);
  add(row?.coil_count);
  add(row?.total_qty);
  add(row?.created_at);

  const details = parseDetails(row?.details);
  if (details && typeof details === "object") {
    add(details.coil_count);
    add(details.total_qty);
    if (Array.isArray(details.coil_no_uids)) details.coil_no_uids.forEach(add);
    if (Array.isArray(details.coil_sticker_entries)) {
      details.coil_sticker_entries.forEach((e) => add(e?.coil_no_uid));
    }
  }

  return parts.join(" ").toLowerCase();
}

export function filterCoilTransactionLogs(rows = [], query = "", typeLabels = {}) {
  const q = String(query ?? "").trim();
  if (!q) return rows;
  const tokens = normalizeSearchTokens(q);

  return rows.filter((row) => {
    const sourceRow = stripUniqueScopeRow(row);
    const entries = getCoilStickerEntries(sourceRow);

    if (entries.length) {
      const matched = matchEntriesForSearch(entries, q);
      if (matched.length > 0) return true;
      if (isLikelyCoilStickerSearch(q, entries) || isMrnNumberSearch(q)) return false;
    }

    if (isMrnNumberSearch(q) || isFullCoilUidSearch(q)) {
      const mrn = String(row?.mrn_no ?? "").trim().toLowerCase();
      if (isMrnNumberSearch(q) && mrn === q.toLowerCase()) return true;
      return false;
    }

    return tokensMatchHaystack(tokens, coilTransactionSearchText(row, typeLabels));
  });
}

export function scopeSummaryRowToMatchingEntries(row, query = "", typeLabels = {}) {
  const q = String(query ?? "").trim();
  if (!q) return row;

  const sourceRow = stripUniqueScopeRow(row);
  const allEntries = getCoilStickerEntries(sourceRow);

  if (!allEntries.length) {
    return filterCoilTransactionLogs([row], q, typeLabels).length ? row : null;
  }

  const matched = matchEntriesForSearch(allEntries, q);
  if (!matched.length) {
    if (isLikelyCoilStickerSearch(q, allEntries) || isMrnNumberSearch(q)) return null;
    return tokensMatchHaystack(normalizeSearchTokens(q), coilTransactionSearchText(row, typeLabels))
      ? row
      : null;
  }

  const sourceCount = allEntries.length || Number(row?.coil_count) || 1;
  let totalQty = 0;
  let qtyKnown = false;
  for (const entry of matched) {
    const qv = resolveEntryQty(row, entry, sourceCount);
    if (qv != null && Number.isFinite(qv)) {
      totalQty += qv;
      qtyKnown = true;
    }
  }

  const uids = matched.map((e) => String(e.coil_no_uid ?? "").trim()).filter(Boolean);

  return {
    ...row,
    _searchScoped: true,
    coil_sticker_entries: matched,
    coil_no_uids_display: uids.join(", "),
    coil_count: matched.length,
    total_qty: qtyKnown ? Math.round(totalQty * 1000) / 1000 : row.total_qty ?? null,
  };
}

export function expandCoilTransactionLogsToUnique(rows = [], query = "", typeLabels = {}) {
  const q = String(query ?? "").trim();
  const out = [];

  for (const row of rows) {
    const sourceRow = stripUniqueScopeRow(row);
    const entries = getCoilStickerEntries(sourceRow);

    if (!entries.length) {
      if (!q) {
        out.push(row);
        continue;
      }
      if (isMrnNumberSearch(q) || isFullCoilUidSearch(q)) continue;
      if (filterCoilTransactionLogs([row], q, typeLabels).length) out.push(row);
      continue;
    }

    const matchedEntries = matchEntriesForSearch(entries, q);
    if (!matchedEntries.length) continue;

    for (const entry of matchedEntries) {
      out.push(cloneTransactionRowForCoil(row, entry, sourceRow));
    }
  }

  return out;
}

export function applyCoilTransactionLogView(rows = [], { query = "", typeLabels = {}, mode = "summary" } = {}) {
  const key = String(mode || COIL_TX_DISPLAY_MODES.SUMMARY).toLowerCase();
  const q = String(query ?? "").trim();

  if (!q) {
    if (key === COIL_TX_DISPLAY_MODES.UNIQUE) {
      return expandCoilTransactionLogsToUnique(rows, query, typeLabels);
    }
    return rows;
  }

  const filtered = filterCoilTransactionLogs(rows, query, typeLabels);

  if (key === COIL_TX_DISPLAY_MODES.UNIQUE) {
    if (isUniquePerLogSearch(q)) {
      return filtered
        .map((row) => scopeSummaryRowToMatchingEntries(row, query, typeLabels))
        .filter(Boolean);
    }
    return expandCoilTransactionLogsToUnique(filtered, query, typeLabels);
  }

  return filtered.map((row) => stripUniqueScopeRow(row));
}
