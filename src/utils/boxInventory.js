/**
 * Mirror of backend/src/utils/boxInventory.js — out_uid + sa_id rules.
 */

export function isOutUidEmpty(box) {
  const out = box?.out_uid;
  return out == null || String(out).trim() === "";
}

export function isSaIdEmpty(box) {
  const raw = box?.stock_adjustment_id ?? box?.sa_id;
  if (raw == null || String(raw).trim() === "") return true;
  return false;
}

export function isStockAdjustmentOut(box) {
  return String(box?.sa_entry_type ?? "").trim() === "stock_out";
}

export function isStockAdjustmentIn(box) {
  return String(box?.sa_entry_type ?? "").trim() === "stock_in";
}

export function getStockAdjustmentId(box) {
  const raw = box?.stock_adjustment_id ?? box?.sa_id;
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Case 2 — stock adjustment minus. */
export function isBoxStockAdjustmentOut(box) {
  if (!box || box.is_deleted) return false;
  if (isStockAdjustmentOut(box)) return true;
  if (isOutUidEmpty(box)) return false;
  const sa = getStockAdjustmentId(box);
  if (sa == null) return false;
  const out = Number(box.out_uid);
  return Number.isFinite(out) && out === sa;
}

/** Case 3 — out entry dispatch. */
export function isBoxOutwardDispatch(box) {
  if (!box || box.is_deleted) return false;
  if (isOutUidEmpty(box)) return false;
  return !isBoxStockAdjustmentOut(box);
}

/** Case 1 — in hand. */
export function isBoxInHand(box) {
  if (!box || box.is_deleted) return false;
  if (!isOutUidEmpty(box)) return false;
  if (isStockAdjustmentOut(box)) return false;
  return true;
}

export function boxInventoryStatus(box) {
  if (!box || box.is_deleted) return "deleted";
  const fromApi = box.inventory_status;
  if (fromApi === "in_hand" || fromApi === "outward" || fromApi === "stock_adjustment") {
    return fromApi;
  }
  if (isBoxStockAdjustmentOut(box)) return "stock_adjustment";
  if (isBoxInHand(box)) return "in_hand";
  return "outward";
}

export function isBoxAvailableForOutEntryScan(box, { forOutUid = null } = {}) {
  if (!box || box.is_deleted) return false;
  if (isBoxStockAdjustmentOut(box)) return false;
  if (isBoxInHand(box)) return true;
  const scoped = forOutUid != null && String(forOutUid).trim() !== "" ? Number(forOutUid) : null;
  return Number.isFinite(scoped) && Number(box.out_uid) === scoped;
}

export function isBoxVisibleForStockAdjustmentMinus(box, { adjustmentId = null } = {}) {
  if (!box || box.is_deleted) return false;
  if (isBoxInHand(box)) return true;
  const adjId = adjustmentId != null ? Number(adjustmentId) : null;
  if (Number.isFinite(adjId) && adjId > 0) {
    const sa = getStockAdjustmentId(box);
    if (sa === adjId && isBoxStockAdjustmentOut(box)) return true;
  }
  return false;
}

export function isBoxAvailableForMinus(box, { adjustmentId = null } = {}) {
  if (!box || box.is_deleted) return false;
  const adjId = adjustmentId != null ? Number(adjustmentId) : null;
  if (Number.isFinite(adjId) && adjId > 0) {
    const sa = getStockAdjustmentId(box);
    if (sa === adjId) {
      if (isBoxStockAdjustmentOut(box)) return true;
      if (isBoxInHand(box)) return true;
    }
  }
  if (isBoxStockAdjustmentOut(box)) return false;
  return isBoxInHand(box);
}

export function outEntryBoxStatusLabel(box) {
  const status = boxInventoryStatus(box);
  if (status === "in_hand") {
    if (isStockAdjustmentIn(box)) return "In stock (stock adjustment)";
    return "In stock";
  }
  if (status === "stock_adjustment") {
    return "Not available (stock adjustment out)";
  }
  if (status === "outward") {
    return "Not available (already outward)";
  }
  return "Not available";
}
