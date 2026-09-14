/** Normalize POST /trays/helper response — `data` may be one tray object or a list. */
export function pickTrayFromViewsResponse(res) {
  const d = res?.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d[0] ?? null;
  if (typeof d === "object") return d;
  return null;
}

export function normalizeTrayViewRow(row) {
  if (!row || typeof row !== "object") return null;
  const id = row.id ?? null;
  const code = String(row.code || "").trim().toUpperCase();
  if (!id && !code) return null;
  return {
    id,
    code,
    type: row.type ?? null,
    serial_number: row.serial_number ?? null,
    batch_id: row.batch_id ?? null,
  };
}
