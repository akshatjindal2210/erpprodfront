/**
 * Production shifts — ONE place on the frontend (keep backend jobCard.config.js in sync).
 *
 *   SHIFTS_PER_DAY = 2 or 3  → board / calendar columns (S1…Sn)
 *   SHIFT_HOURS    = 8       → hours per shift (board Qty · hours)
 *
 * Change only these two numbers.
 */

export const SHIFTS_PER_DAY = 3;
export const SHIFT_HOURS = 8;

/** Valid schedule_shift ids: 1…SHIFTS_PER_DAY */
export const SHIFT_IDS = Array.from({ length: SHIFTS_PER_DAY }, (_, i) => i + 1);

export function isValidShift(n) {
  return SHIFT_IDS.includes(Number(n));
}

/** Board / calendar shift options. */
export const SHIFTS = SHIFT_IDS.map((id) => ({
  id,
  label: `Shift ${id}`,
  short: `S${id}`,
}));
