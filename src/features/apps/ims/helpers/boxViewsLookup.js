/** Normalize POST /box/helper response — `data` may be one box object or a list. */
export function pickBoxFromViewsResponse(res) {
  const d = res?.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d[0] ?? null;
  if (typeof d === "object") return d;
  return null;
}
