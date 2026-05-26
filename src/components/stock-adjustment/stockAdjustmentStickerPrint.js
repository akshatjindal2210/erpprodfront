import { boxService } from "@/services/box";
import { STICKER_DOWNLOAD_SOURCE_KEYS } from "@/global";
import { printFromBackendHtml } from "@/utils/printHtmlDocument";
import { loadBoxesBySaId } from "./stockAdjustmentViewBoxes";

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? "mobile" : "desktop";
}

export { printFromBackendHtml };

/** Print SA boxes — label fields resolved on backend from packing number + IMS. */
export async function printStockAdjustmentAddStickers({ adjustmentId, packingNo, boxUids }) {
  const adjId = Number(adjustmentId);
  const pn = String(packingNo ?? "").trim();
  const uids = (Array.isArray(boxUids) ? boxUids : [])
    .map((u) => Number(u))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!Number.isFinite(adjId) || adjId < 1 || !pn || !uids.length) {
    return { ok: false, reason: "no_input" };
  }

  const res = await boxService.renderBulkStickers({
    packing_number: pn,
    box_uids: uids,
    device_type: getDeviceType(),
    download_source: STICKER_DOWNLOAD_SOURCE_KEYS.stock_adjustment,
  });
  const opened = printFromBackendHtml(res?.html, { title: res?.print_title });
  if (!opened) return { ok: false, reason: "popup_blocked" };
  return { ok: true };
}

export async function printAllStickersForStockAdjustmentAdd(row) {
  const adjId = Number(row?.adjustment_id);
  const pn = String(row?.packing_number ?? "").trim();
  if (!Number.isFinite(adjId) || adjId < 1 || !pn) {
    return { ok: false, reason: "no_input" };
  }

  const boxes = await loadBoxesBySaId(adjId);
  const uids = boxes
    .map((b) => Number(b.box_uid))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!uids.length) {
    return { ok: false, reason: "no_boxes" };
  }

  return printStockAdjustmentAddStickers({
    adjustmentId: adjId,
    packingNo: pn,
    boxUids: uids,
  });
}

export async function loadBoxesForStockAdjustmentAdd(adjustmentId) {
  return loadBoxesBySaId(adjustmentId);
}

export { loadBoxesForAdjustmentView, loadBoxesBySaId } from "./stockAdjustmentViewBoxes";
