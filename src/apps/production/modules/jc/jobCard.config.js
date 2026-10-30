/**
 * Production time only (not calendar columns).
 * Calendar shift codes + per-day count come from Settings → Shifts.
 *
 *   SHIFT_HOURS = 8  → hours per shift (est. time / Qty·hours)
 */

export const SHIFT_HOURS = 8;

/** Valid shift index: 1…shiftsPerDay (from Settings). If max omitted, any n >= 1. */
export function isValidShift(n, shiftsPerDay) {
  const v = Number(n);
  if (!Number.isFinite(v) || !Number.isInteger(v) || v < 1) return false;
  if (shiftsPerDay == null || shiftsPerDay === "") return true;
  return v <= Math.max(1, Number(shiftsPerDay) || 1);
}
