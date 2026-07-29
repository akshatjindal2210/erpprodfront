/** IMS sticker-prefix coil UID: {prefix}_mrnno_serialno_totalno_colino e.g. 26_1001_3_10_03 */
export function formatCoilNoUid({ prefix, mrn_no, serial_no, total, index }) {
  const pfx = String(prefix ?? "").trim() || "0";
  const mrn = String(mrn_no ?? "").trim() || "0";
  const serial = String(serial_no ?? "").trim() || "0";
  const tb = String(Math.max(1, Number(total) || 1)).padStart(2, "0");
  const bi = String(Math.max(1, Number(index) || 1)).padStart(2, "0");
  return `${pfx}_${mrn}_${serial}_${tb}_${bi}`;
}

/** Whole-number qty. */
export function roundQty3(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v);
}

/**
 * Uneven integer split — total stays balanced; middle coils tend higher than ends.
 * Used when App Config "Auto-split coil quantities" is Enabled.
 */
export function splitQtyAcrossCoils(totalQty, coilCount) {
  const n = Math.max(1, Number(coilCount) || 1);
  const total = roundQty3(totalQty);
  if (n === 1) return [total];

  const base = Math.floor(total / n);
  const maxDelta = Math.max(1, Math.floor(base * 0.12));
  const qtys = [];
  let allocated = 0;
  for (let i = 0; i < n - 1; i++) {
    const t = n === 2 ? 0 : i / (n - 2);
    const wave = Math.round(Math.sin(t * Math.PI) * maxDelta);
    const q = Math.max(0, base + wave);
    qtys.push(q);
    allocated += q;
  }
  qtys.push(Math.max(0, total - allocated));
  return qtys;
}

/**
 * Equal integer split — as even as possible; remainder (+1) on first coils.
 * Used when Auto-split is Disabled and qty fields are locked.
 */
export function equalSplitQtyAcrossCoils(totalQty, coilCount) {
  const n = Math.max(1, Number(coilCount) || 1);
  const total = roundQty3(totalQty);
  if (n === 1) return [total];
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export const QTY_EPS = 0.001;
