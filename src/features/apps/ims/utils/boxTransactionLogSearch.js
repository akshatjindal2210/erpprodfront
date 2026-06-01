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

  let details = row?.details;
  if (typeof details === "string") {
    add(details);
    try {
      details = JSON.parse(details);
    } catch {
      details = null;
    }
  }
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
    try {
      add(JSON.stringify(details));
    } catch {
      /* ignore */
    }
  }

  return parts.join(" ").toLowerCase();
}

/** Client-side filter for box transaction logs (type labels, sticker nos, box kind, etc.). */
export function filterBoxTransactionLogs(rows = [], query = "", typeLabels = {}) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    const haystack = boxTransactionSearchText(row, typeLabels);
    return tokens.every((token) => haystack.includes(token));
  });
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
