function escapeRegExp(s) {
  return String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @returns {null|0|1|2|3} null = no match; lower = stronger (exact → startsWith → word → substring)
 */
export function matchTier(str, qRaw) {
  const q = String(qRaw ?? "").trim().toLowerCase();
  if (!q) return 0;
  const s = String(str ?? "").toLowerCase();
  if (!s.includes(q)) return null;
  if (s === q) return 0;
  if (s.startsWith(q)) return 1;
  if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(q)}`, "i").test(s)) return 2;
  return 3;
}

/** Best (lowest) tier across fields; 4 = no field matched. */
export function bestTierForStrings(qRaw, parts) {
  const q = String(qRaw ?? "").trim().toLowerCase();
  if (!q) return 0;
  let best = 99;
  for (const x of parts) {
    const t = matchTier(x, q);
    if (t != null) best = Math.min(best, t);
  }
  return best === 99 ? 4 : best;
}
