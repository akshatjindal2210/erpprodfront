import { boxService } from "@/features/apps/ims/services/box";
import { STICKER_DOWNLOAD_SOURCE_KEYS } from "@/core/utils/global";
import { printFromBackendHtml } from "@/features/apps/ims/utils/printHtmlDocument";
import { loadBoxesBySaId } from "./stockAdjustmentViewBoxes";

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? "mobile" : "desktop";
}

export { printFromBackendHtml, getDeviceType };

/** Sticker HTML meta for stock-adjustment add boxes (same shape as packing sticker creation). */
export function buildStockAdjustmentStickerPrintMeta(detailRow, packingPreview, stickerRow) {
  const st = packingPreview?.stickerRow;
  const dp = packingPreview?.dailyprod;
  const pn = String(detailRow?.packing_number ?? stickerRow?.package_no ?? dp?.doc_no ?? st?.doc_no ?? "").trim();
  return {
    packing_number: pn || null,
    doc_no: pn || null,
    itemdcode: dp?.itemdcode ?? st?.itemdcode ?? detailRow?.item_dcode,
    item_code: detailRow?.item_code ?? dp?.item_code ?? st?.item_code,
    itemdesc: detailRow?.item_desc ?? dp?.item_desc ?? st?.itemdesc ?? st?.item_desc ?? "",
    description: detailRow?.item_desc ?? dp?.item_desc ?? st?.itemdesc ?? st?.item_desc ?? "",
    acc_name: dp?.acc_name ?? st?.acc_name ?? detailRow?.acc_name,
    acc_code: dp?.acc_code ?? st?.acc_code ?? detailRow?.acc_code,
    ...(dp?.party_rate_cust_code?.trim?.() || st?.party_rate_cust_code?.trim?.()
      ? {
          party_rate_cust_code: String(
            dp?.party_rate_cust_code?.trim?.() || st?.party_rate_cust_code?.trim?.() || ""
          ),
        }
      : {}),
    job_card_no: dp?.job_card_no ?? st?.job_card_no ?? "",
    fg_location: st?.fg_location ?? dp?.fg_location ?? "",
    ...(stickerRow?.box_no != null ? { box_no: stickerRow.box_no } : {}),
    ...(stickerRow?.total_boxes != null ? { total_boxes: stickerRow.total_boxes } : {}),
  };
}

/** Print one SA box sticker. */
export async function printSingleStockAdjustmentSticker({ boxUid, stickerMeta }) {
  const uid = Number(boxUid);
  if (!Number.isFinite(uid) || uid <= 0) return { ok: false, reason: "no_input" };

  const res = await boxService.renderSingleSticker({
    box_uid: uid,
    device_type: getDeviceType(),
    download_source: STICKER_DOWNLOAD_SOURCE_KEYS.stock_adjustment,
    sticker_meta: stickerMeta,
  });
  const opened = printFromBackendHtml(res?.html, { title: res?.print_title });
  if (!opened) return { ok: false, reason: "popup_blocked" };
  return { ok: true };
}

/** Print SA boxes — label fields resolved on backend from packing number + IMS. */
export async function printStockAdjustmentAddStickers({ adjustmentId, packingNo, boxUids, stickerMeta }) {
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
    ...(stickerMeta ? { sticker_meta: stickerMeta } : {}),
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

