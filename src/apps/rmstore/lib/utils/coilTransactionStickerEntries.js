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

function isUniqueScopedRow(row) {
  return (
    Boolean(String(row?._uniqueCoilUid ?? "").trim()) ||
    String(row?._displayMode ?? "").toLowerCase() === "unique"
  );
}

export function stripUniqueScopeRow(row) {
  if (!row || typeof row !== "object") return row;
  const next = { ...row };
  delete next._uniqueCoilUid;
  delete next._displayMode;
  delete next._sourceLogId;
  delete next._searchScoped;
  return next;
}

/** Resolve coil sticker entries from enriched row / details JSON. */
export function getCoilStickerEntries(row) {
  if (!row) return [];

  if (isUniqueScopedRow(row) && String(row._uniqueCoilUid || "").trim()) {
    const uid = String(row._uniqueCoilUid).trim();
    const fromRow = Array.isArray(row.coil_sticker_entries) ? row.coil_sticker_entries : [];
    const hit = fromRow.find((e) => String(e?.coil_no_uid ?? "").trim() === uid);
    if (hit) {
      return [{
        coil_no_uid: uid,
        ...(Number.isFinite(Number(hit.qty)) ? { qty: Number(hit.qty) } : {}),
      }];
    }
    return [{ coil_no_uid: uid }];
  }

  if (Array.isArray(row.coil_sticker_entries) && row.coil_sticker_entries.length) {
    return row.coil_sticker_entries
      .map((e) => ({
        coil_no_uid: String(e?.coil_no_uid ?? "").trim(),
        ...(Number.isFinite(Number(e?.qty)) ? { qty: Number(e.qty) } : {}),
      }))
      .filter((e) => e.coil_no_uid);
  }

  if (row.coil_no_uids_display) {
    return splitUidTokens(row.coil_no_uids_display).map((uid) => ({ coil_no_uid: uid }));
  }

  const d = parseDetails(row.details);
  if (Array.isArray(d.coil_sticker_entries) && d.coil_sticker_entries.length) {
    return d.coil_sticker_entries
      .map((e) => ({
        coil_no_uid: String(e?.coil_no_uid ?? "").trim(),
        ...(Number.isFinite(Number(e?.qty)) ? { qty: Number(e.qty) } : {}),
      }))
      .filter((e) => e.coil_no_uid);
  }

  const uids = [];
  if (Array.isArray(d.coil_no_uids)) uids.push(...d.coil_no_uids.flatMap(splitUidTokens));
  else if (typeof d.coil_no_uids === "string") uids.push(...splitUidTokens(d.coil_no_uids));
  if (d.coil_no_uid) uids.push(String(d.coil_no_uid).trim());

  return [...new Set(uids.filter(Boolean))].map((uid) => ({ coil_no_uid: uid }));
}
