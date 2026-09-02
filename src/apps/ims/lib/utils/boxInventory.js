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

/**
 * Case 2 — stock adjustment minus.
 * `out_uid === sa_id` is a legacy minus marker, but SA *add* boxes keep `sa_id`
 * from stock_in. If they later dispatch and out-entry id collides with that sa_id
 * (e.g. sticker SA366 + OUT-366), treat as dispatch, not minus.
 */
export function isBoxStockAdjustmentOut(box) {
  if (!box || box.is_deleted) return false;
  if (isStockAdjustmentOut(box)) return true;
  if (isStockAdjustmentIn(box)) return false;
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

export function isBoxOnQcHold(box) {
  const id = box?.qc_hold_id;
  return id != null && String(id).trim() !== "";
}

export function isBoxSellable(box) {
  return isBoxInHand(box) && !isBoxOnQcHold(box);
}

/** In-hand or outward OK; deleted / SA minus (removed) not OK. */
export function isBoxEligibleForOverrideCustomer(box) {
  if (!box || box.is_deleted) return false;
  if (isStockAdjustmentOut(box) || isBoxStockAdjustmentOut(box)) return false;
  return true;
}

export function overrideCustomerScanRejectMessage(box) {
  if (!box || box.is_deleted) return "Box not found or was removed.";
  if (isStockAdjustmentOut(box) || isBoxStockAdjustmentOut(box)) {
    return "This box was removed via stock adjustment (minus) and cannot be used for customer override.";
  }
  return "Box is not available for customer override.";
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

function isMinusMarkedForAdjustment(box, adjustmentId) {
  const adjId = adjustmentId != null ? Number(adjustmentId) : null;
  if (!Number.isFinite(adjId) || adjId <= 0) return false;
  const sa = getStockAdjustmentId(box);
  if (sa === adjId && isBoxStockAdjustmentOut(box)) return true;
  const out = Number(box?.out_uid);
  return Number.isFinite(out) && out === adjId;
}

export function isValidMinusDrawerBoxRow(box) {
  const uid = Number(box?.box_uid);
  const label = String(box?.box_no_uid ?? "").trim();
  return Number.isFinite(uid) && uid > 0 && label !== "";
}

/** One row per box_uid; prefer the row that has box_no_uid. */
export function dedupeMinusDrawerBoxRows(boxes) {
  const byUid = new Map();
  for (const row of boxes || []) {
    const uid = Number(row?.box_uid);
    if (!Number.isFinite(uid) || uid <= 0) continue;
    const existing = byUid.get(uid);
    if (!existing) {
      byUid.set(uid, row);
      continue;
    }
    const exLabel = String(existing?.box_no_uid ?? "").trim();
    const newLabel = String(row?.box_no_uid ?? "").trim();
    if (!exLabel && newLabel) byUid.set(uid, row);
  }
  return [...byUid.values()].sort((a, b) => Number(a.box_uid) - Number(b.box_uid));
}

export function isBoxVisibleForStockAdjustmentMinus(box, { adjustmentId = null } = {}) {
  if (!box || box.is_deleted) return false;
  if (isBoxInHand(box)) return true;
  return isMinusMarkedForAdjustment(box, adjustmentId);
}

export function isBoxAvailableForMinus(box, { adjustmentId = null } = {}) {
  if (!box || box.is_deleted) return false;
  const adjId = adjustmentId != null ? Number(adjustmentId) : null;
  if (Number.isFinite(adjId) && adjId > 0) {
    const sa = getStockAdjustmentId(box);
    if (sa === adjId && isBoxInHand(box)) return true;
    if (isMinusMarkedForAdjustment(box, adjId)) return true;
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
