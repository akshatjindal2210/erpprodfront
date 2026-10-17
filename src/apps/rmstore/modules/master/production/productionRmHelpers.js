/** Normalize rm_items from API row (JSONB array or legacy flat fields). */
export function normalizeRmItems(row) {
  if (!row) return [];
  const raw = row.rm_items;
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  if (row.rm_item_dcode != null || row.rm_item_code) {
    return [
      {
        rm_item_dcode: row.rm_item_dcode ?? null,
        rm_item_code: row.rm_item_code ?? null,
        rm_item_desc: row.rm_item_desc ?? null,
      },
    ];
  }
  return [];
}

export function rmDcodesFromRow(row) {
  return normalizeRmItems(row)
    .map((r) => r?.rm_item_dcode ?? r?.itemdcode ?? r?.id)
    .filter((v) => v != null && String(v).trim() !== "");
}

export function rmFieldList(row, key) {
  return normalizeRmItems(row).map((r) => r?.[key]).filter((v) => v != null && String(v).trim() !== "");
}

export function formatRmField(row, key, legacyKey = key) {
  const vals = rmFieldList(row, key);
  if (vals.length) return vals.join(", ");
  const legacy = row?.[legacyKey];
  return legacy != null && String(legacy).trim() !== "" ? String(legacy) : "";
}

/** Flatten rm_items onto row for list search, copy, sort, and export. */
export function enrichProductionRow(row) {
  if (!row) return row;
  const rmCodes = formatRmField(row, "rm_item_code");
  const rmDescs = formatRmField(row, "rm_item_desc");
  const approved = row.approved === true || row.approved === "true" || row.approved === 1;
  return {
    ...row,
    rm_items: normalizeRmItems(row),
    rm_item_code: rmCodes || row.rm_item_code || "",
    rm_item_desc: rmDescs || row.rm_item_desc || "",
    approved,
    created_by_name: row.created_by_name ?? row.created_by ?? "",
    updated_by_name: row.updated_by_name ?? row.updated_by ?? "",
    approved_by_name: row.approved_by_name ?? row.approved_by ?? "",
  };
}

/** Include nested RM fields in client-side search (rm_items is not plain text). */
export function productionSearchParts(row) {
  const parts = [];
  const enriched = enrichProductionRow(row);
  for (const v of Object.values(enriched || {})) {
    if (v == null) continue;
    const t = typeof v;
    if (t === "string" || t === "number") parts.push(v);
    else if (t === "boolean") parts.push(v ? "true" : "false");
  }
  for (const rm of normalizeRmItems(row)) {
    for (const v of Object.values(rm || {})) {
      if (v == null) continue;
      const t = typeof v;
      if (t === "string" || t === "number") parts.push(v);
    }
  }
  return parts;
}

export function productionRmCopyValue(row, key) {
  const text = formatRmField(row, key);
  return text || "—";
}
