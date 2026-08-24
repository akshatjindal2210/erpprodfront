/**
 * Stock Adjustment "Update" — qty change plan stored in removed_box_ids JSON.
 * Mirror of backend stockAdjustmentUpdatePayload.js (parse only).
 */

export function parseQtyUpdatePayload(raw) {
  if (raw == null || raw === "") return null;
  try {
    let parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (String(parsed.kind ?? "").trim() !== "qty_update") return null;

    const box_uid = Number(parsed.box_uid);
    if (!Number.isFinite(box_uid) || box_uid < 1) return null;

    const update_action = String(parsed.update_action ?? "").trim().toLowerCase();
    if (update_action !== "add" && update_action !== "minus") return null;

    const update_qty = parseInt(String(parsed.update_qty ?? ""), 10);
    if (!Number.isFinite(update_qty) || update_qty < 1) return null;

    const snapshot_qty = parseInt(String(parsed.snapshot_qty ?? ""), 10);
    const applied_delta =
      parsed.applied_delta != null && parsed.applied_delta !== ""
        ? parseInt(String(parsed.applied_delta), 10)
        : null;
    const applied_from_qty =
      parsed.applied_from_qty != null && parsed.applied_from_qty !== ""
        ? parseInt(String(parsed.applied_from_qty), 10)
        : null;
    const applied_to_qty =
      parsed.applied_to_qty != null && parsed.applied_to_qty !== ""
        ? parseInt(String(parsed.applied_to_qty), 10)
        : null;

    return {
      kind: "qty_update",
      box_uid,
      box_no_uid:
        parsed.box_no_uid != null && String(parsed.box_no_uid).trim() !== ""
          ? String(parsed.box_no_uid).trim()
          : null,
      packing_number:
        parsed.packing_number != null && String(parsed.packing_number).trim() !== ""
          ? String(parsed.packing_number).trim()
          : null,
      snapshot_qty: Number.isFinite(snapshot_qty) ? snapshot_qty : null,
      update_action,
      update_qty,
      applied_delta: Number.isFinite(applied_delta) ? applied_delta : null,
      applied_from_qty: Number.isFinite(applied_from_qty) ? applied_from_qty : null,
      applied_to_qty: Number.isFinite(applied_to_qty) ? applied_to_qty : null,
    };
  } catch {
    return null;
  }
}

export function projectedQtyAfterUpdate(currentQty, updateAction, updateQty) {
  const current = parseInt(String(currentQty ?? ""), 10);
  const qty = parseInt(String(updateQty ?? ""), 10);
  const action = String(updateAction ?? "").trim().toLowerCase();
  if (!Number.isFinite(current) || current < 0) return null;
  if (!Number.isFinite(qty) || qty < 1) return null;
  if (action !== "add" && action !== "minus") return null;
  return action === "add" ? current + qty : current - qty;
}
