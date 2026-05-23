/** Indian FY "2025-2026" → bounds for client-side checks (aligned with backend `ims.service.js`). */
export function parseIndianFinancialYearBounds(fyStr) {
  const m = String(fyStr ?? "")
    .trim()
    .match(/^(\d{4})-(\d{4})$/);
  if (!m) return null;
  const y1 = parseInt(m[1], 10);
  const y2 = parseInt(m[2], 10);
  if (!Number.isFinite(y1) || !Number.isFinite(y2) || y2 !== y1 + 1) return null;
  const from = new Date(y1, 3, 1);
  const to = new Date(y2, 2, 31);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return { from, to };
}

/** True if `doc_dt` is YYYY-MM-DD and lies inside Indian FY `fyStr`. */
export function rowInIndianFinancialYear(row, fyStr) {
  const iso = row?.doc_dt;
  if (iso == null || String(iso).trim() === "") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) return false;
  const rowT = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)).getTime();
  const bounds = parseIndianFinancialYearBounds(fyStr);
  if (!bounds) return false;
  return rowT >= bounds.from.getTime() && rowT <= bounds.to.getTime();
}
