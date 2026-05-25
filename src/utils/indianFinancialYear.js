/**
 * Indian financial year (FY): 1 April → 31 March (not calendar Jan–Dec).
 *
 * FY is named by its start year. Example: FY 2026-2027 runs 1 Apr 2026 – 31 Mar 2027.
 *
 * @example Date → FY start year (`getCurrentIndianFinancialYearStartYear`)
 * | Today (calendar)   | FY label      | Start year returned |
 * |--------------------|---------------|---------------------|
 * | 15 May 2026        | 2026-2027     | 2026                |
 * | 31 Mar 2027        | 2026-2027     | 2026                |
 * | 1 Apr 2027         | 2027-2028     | 2027                |
 * | 10 Feb 2026        | 2025-2026     | 2025 (before 1 Apr) |
 *
 * @example Sticker `box_no_uid` prefix (`getBoxNoUidPrefixFromFinancialYear`)
 * Prefix = last 2 digits of FY start year (auto changes on 1 Apr each year).
 * | FY        | Prefix | Full UID example (packing 30637, 50 boxes, #3) |
 * |-----------|--------|--------------------------------------------------|
 * | 2026-2027 | "26"   | 26_30637_50_3                                    |
 * | 2027-2028 | "27"   | 27_30637_50_3                                    |
 *
 * @example FY bounds for filters (`parseIndianFinancialYearBounds`)
 * "2026-2027" → from 1 Apr 2026, to 31 Mar 2027 (inclusive, local midnight).
 *
 * No env/config — always uses real current date (or the `date` argument you pass).
 */

function toDate(value) {
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Calendar date → Indian FY start year.
 *
 * @example new Date(2026, 4, 15) → 2026   // 15 May 2026, FY 2026-2027
 * @example new Date(2026, 1, 10) → 2025   // 10 Feb 2026, FY 2025-2026
 * @example new Date(2027, 3, 1)  → 2027   // 1 Apr 2027, FY 2027-2028
 */
export function getCurrentIndianFinancialYearStartYear(date = new Date()) {
  const d = toDate(date);
  const y = d.getFullYear();
  const m = d.getMonth();
  return m >= 3 ? y : y - 1;
}

/**
 * Human-readable FY label for a date.
 *
 * @example new Date(2026, 4, 15) → "2026-2027"
 */
export function getCurrentIndianFinancialYearLabel(date = new Date()) {
  const y = getCurrentIndianFinancialYearStartYear(date);
  return `${y}-${y + 1}`;
}

/**
 * Sticker `box_no_uid` prefix from current FY (used in preview before save).
 *
 * @example new Date(2026, 4, 15) → "26"  → UID 26_30637_50_3
 * @example new Date(2027, 3, 1)  → "27"  → UID 27_30637_50_3
 */
export function getBoxNoUidPrefixFromFinancialYear(date = new Date()) {
  const y = getCurrentIndianFinancialYearStartYear(date);
  return String(y % 100).padStart(2, "0");
}

/**
 * Parse FY string "YYYY-YYYY" into inclusive date bounds (1 Apr – 31 Mar).
 *
 * @example parseIndianFinancialYearBounds("2026-2027")
 *   → { from: 1 Apr 2026 00:00, to: 31 Mar 2027 00:00 }
 * @example parseIndianFinancialYearBounds("bad") → null
 */
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

/**
 * True if row `doc_dt` (YYYY-MM-DD) falls inside Indian FY `fyStr`.
 *
 * @example rowInIndianFinancialYear({ doc_dt: "2026-05-15" }, "2026-2027") → true
 * @example rowInIndianFinancialYear({ doc_dt: "2026-02-01" }, "2026-2027") → false (still FY 2025-2026)
 * @example rowInIndianFinancialYear({ doc_dt: "2027-03-31" }, "2026-2027") → true
 */
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
