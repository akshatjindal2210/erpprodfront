/**
 * Portal permission day windows (View days / Edit days).
 * 0 = unlimited. Matches ActionButton / IMS can_*_days behaviour.
 */

export function permissionDiffDays(record, dateKeys = ["created_at", "submitted_at", "timestamp", "updated_at"]) {
  if (!record) return null;
  let raw = null;
  for (const key of dateKeys) {
    if (record[key]) {
      raw = record[key];
      break;
    }
  }
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  return Math.ceil(Math.abs(Date.now() - at.getTime()) / (1000 * 60 * 60 * 24));
}

/** True when the row is older than the allowed day window. */
export function isOutsidePermissionDays(record, days, dateKeys) {
  const limit = Number(days) || 0;
  if (limit <= 0) return false;
  const diff = permissionDiffDays(record, dateKeys);
  if (diff == null) return false;
  return diff > limit;
}

/** Keep rows within view-days window (0 = all). */
export function filterRowsByViewDays(rows, viewDays, dateKeys) {
  const limit = Number(viewDays) || 0;
  if (limit <= 0 || !Array.isArray(rows)) return rows;
  return rows.filter((row) => !isOutsidePermissionDays(row, limit, dateKeys));
}
