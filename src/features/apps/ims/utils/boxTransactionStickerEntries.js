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

function splitUidTokens(value) {
  if (value == null || value === "") return [];
  return String(value)
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeBoxNoUidsField(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.flatMap((u) => splitUidTokens(u));
  return splitUidTokens(raw);
}

function isLooseFlag(flag) {
  return flag === true || flag === 1 || flag === "true";
}

function isLooseEntry(e) {
  return e?.is_loose === true || e?.is_loose === 1 || e?.is_loose === "true";
}

function isUniqueScopedRow(row) {
  return (
    Boolean(String(row?._uniqueBoxUid ?? "").trim()) ||
    String(row?._displayMode ?? "").toLowerCase() === "unique"
  );
}

function isSearchScopedRow(row) {
  return row?._searchScoped === true;
}

/** Remove unique-view / search-scope fields so full log sticker list can be resolved. */
export function stripUniqueScopeRow(row) {
  if (!row || typeof row !== "object") return row;
  const next = { ...row };
  delete next._uniqueBoxUid;
  delete next._displayMode;
  delete next._sourceLogId;
  delete next._searchScoped;
  return next;
}

function buildUniqueStickerEntry(row) {
  const uid = String(row?._uniqueBoxUid ?? "").trim();
  const fromRow = Array.isArray(row?.box_sticker_entries) ? row.box_sticker_entries : [];

  if (fromRow.length === 1 && fromRow[0]?.box_no_uid) {
    const e = fromRow[0];
    return [
      {
        box_no_uid: String(e.box_no_uid).trim(),
        is_loose: isLooseEntry(e),
        ...(Number.isFinite(Number(e.qty)) ? { qty: Number(e.qty) } : {}),
      },
    ];
  }

  if (uid && fromRow.length) {
    const hit = fromRow.find((e) => String(e?.box_no_uid ?? "").trim() === uid);
    if (hit) {
      return [
        {
          box_no_uid: uid,
          is_loose: isLooseEntry(hit),
          ...(Number.isFinite(Number(hit.qty)) ? { qty: Number(hit.qty) } : {}),
        },
      ];
    }
  }

  const displayUid = String(row?.box_no_uids_display ?? uid).trim().split(/[\s,;]+/)[0]?.trim();
  if (!displayUid) return [];

  return [
    {
      box_no_uid: displayUid,
      is_loose: row?.box_kind === "Loose",
      ...(Number.isFinite(Number(row?.total_qty)) ? { qty: Number(row.total_qty) } : {}),
    },
  ];
}

function boxIndexFromUid(uid) {
  const parts = String(uid ?? "")
    .trim()
    .split("_");
  const n = Number(parts[parts.length - 1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Dedupe while keeping first-seen order — union every source so the table shows all sticker UIDs. */
function mergeUidListsOrdered(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const uid of list) {
      const s = String(uid ?? "").trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function mergeLooseByUid(looseByUid, uid, isLoose) {
  if (!uid) return;
  if (!looseByUid.has(uid)) looseByUid.set(uid, isLoose);
  else if (isLoose) looseByUid.set(uid, true);
}

function applyFlagsToLooseMap(looseByUid, pnUids, flags) {
  if (!Array.isArray(flags) || !pnUids.length) return;
  pnUids.forEach((uid, i) => {
    if (flags[i] !== undefined) mergeLooseByUid(looseByUid, uid, isLooseFlag(flags[i]));
  });
}

function collectBoxNoUids(d, displayFallback = null) {
  const seen = new Set();
  const out = [];
  const add = (uid) => {
    const s = String(uid ?? "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  if (Array.isArray(d.box_sticker_entries)) {
    for (const e of d.box_sticker_entries) add(e?.box_no_uid);
  }
  normalizeBoxNoUidsField(d.box_no_uids).forEach(add);
  add(d.box_no_uid);
  if (displayFallback) splitUidTokens(displayFallback).forEach(add);
  return out;
}

function inferLooseAtIndex(i, total, d, looseByUid, uid, pnUids) {
  if (looseByUid.has(uid)) return looseByUid.get(uid);

  const flags = Array.isArray(d.is_loose_flags) ? d.is_loose_flags : [];
  const idxInPn = pnUids.indexOf(uid);
  if (idxInPn >= 0 && flags[idxInPn] !== undefined) return isLooseFlag(flags[idxInPn]);

  const kind = String(d.box_kind || "");
  if (kind === "Loose") return true;
  if (kind === "Standard") return false;

  const looseN = Number(d.loose_count) || 0;
  const stdN = Number(d.standard_count) || 0;
  const boxIdx = boxIndexFromUid(uid);

  if (looseN > 0 && stdN > 0) {
    const packTotal = Math.max(total, pnUids.length, boxIdx || 0);
    if (packTotal === looseN + stdN) {
      if (boxIdx != null) return boxIdx > stdN;
      return i >= stdN;
    }
  }
  if (looseN > 0 && total === looseN && stdN === 0) return true;
  return false;
}

function buildSearchScopedStickerEntries(row) {
  const fromRow = Array.isArray(row?.box_sticker_entries) ? row.box_sticker_entries : [];
  return fromRow
    .map((e) => {
      const uid = String(e?.box_no_uid ?? "").trim();
      if (!uid) return null;
      return {
        box_no_uid: uid,
        is_loose: isLooseEntry(e),
        ...(Number.isFinite(Number(e.qty)) ? { qty: Number(e.qty) } : {}),
      };
    })
    .filter(Boolean);
}

function buildStickerEntries(row) {
  const d = parseDetails(row?.details);
  const display = row?.box_no_uids_display ?? null;
  const pnUids = normalizeBoxNoUidsField(d.box_no_uids);
  const flags = Array.isArray(d.is_loose_flags) ? d.is_loose_flags : [];

  const fromApi = Array.isArray(row?.box_sticker_entries)
    ? row.box_sticker_entries
        .map((e) => String(e?.box_no_uid ?? "").trim())
        .filter(Boolean)
    : [];

  const fromEntries = Array.isArray(d.box_sticker_entries)
    ? d.box_sticker_entries
        .map((e) => String(e?.box_no_uid ?? "").trim())
        .filter(Boolean)
    : [];

  const fromCollect = collectBoxNoUids(d, display);
  const fromDisplay = normalizeBoxNoUidsField(display);
  const uids = mergeUidListsOrdered(fromApi, fromEntries, pnUids, fromCollect, fromDisplay);

  const looseByUid = new Map();
  const entrySources = [
    ...(Array.isArray(row?.box_sticker_entries) ? row.box_sticker_entries : []),
    ...(Array.isArray(d.box_sticker_entries) ? d.box_sticker_entries : []),
  ];
  for (const e of entrySources) {
    const uid = String(e?.box_no_uid ?? "").trim();
    if (uid) mergeLooseByUid(looseByUid, uid, isLooseEntry(e));
  }
  applyFlagsToLooseMap(looseByUid, pnUids, flags);

  return uids.map((uid, i) => {
    const fromDetail = entrySources.find((e) => String(e?.box_no_uid ?? "").trim() === uid);
    const qty = Number(fromDetail?.qty);
    return {
      box_no_uid: uid,
      is_loose: inferLooseAtIndex(i, uids.length, d, looseByUid, uid, pnUids),
      ...(Number.isFinite(qty) ? { qty } : {}),
    };
  });
}

/** Sticker UIDs + loose highlight flags for one transaction log row. */
export function getBoxStickerEntries(row) {
  if (isUniqueScopedRow(row)) return buildUniqueStickerEntry(row);
  if (isSearchScopedRow(row)) return buildSearchScopedStickerEntries(row);
  return buildStickerEntries(row);
}
