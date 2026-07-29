import { boxService } from "@/apps/ims/lib/services/box";
import { qcHoldMaterialService } from "@/apps/ims/lib/services/qcHoldMaterial";
import { STICKER_DOWNLOAD_SOURCE_KEYS } from "@/platform/utils/global";
import { printFromBackendHtml } from "@/apps/ims/lib/utils/printHtmlDocument";

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? "mobile" : "desktop";
}

export { printFromBackendHtml, getDeviceType };

export function buildQcHoldStickerPrintMeta(holdRow, packingMeta, stickerRow) {
  const pn = String(holdRow?.packing_number ?? packingMeta?.packing_number ?? "").trim();
  return {
    packing_number: pn || null,
    doc_no: pn || null,
    itemdcode: holdRow?.item_dcode ?? packingMeta?.itemdcode ?? packingMeta?.item_dcode,
    item_code: holdRow?.item_code ?? packingMeta?.item_code,
    itemdesc: holdRow?.item_desc ?? packingMeta?.item_desc ?? "",
    description: holdRow?.item_desc ?? packingMeta?.item_desc ?? "",
    acc_name: holdRow?.acc_name ?? packingMeta?.acc_name,
    acc_code: holdRow?.acc_code ?? packingMeta?.acc_code,
    ...(packingMeta?.party_rate_cust_code?.trim?.()
      ? { party_rate_cust_code: String(packingMeta.party_rate_cust_code).trim() }
      : {}),
    job_card_no: packingMeta?.job_card_no ?? stickerRow?.job_card_no ?? "",
    fg_location: stickerRow?.fg_location ?? "",
    ...(stickerRow?.box_no != null ? { box_no: stickerRow.box_no } : {}),
    ...(stickerRow?.total_boxes != null ? { total_boxes: stickerRow.total_boxes } : {}),
  };
}

export async function loadQcHoldCompletionStickerView({ hold_id, submission_id } = {}) {
  const res = await qcHoldMaterialService.getCompletionBoxes({ hold_id, submission_id });
  const data = res?.data || {};
  return {
    hold: data.hold || null,
    submission: data.submission || null,
    boxes: Array.isArray(data.boxes) ? data.boxes : [],
    packingMeta: data.packing_meta || null,
  };
}

export async function printSingleQcHoldSticker({ boxUid, stickerMeta }) {
  const uid = Number(boxUid);
  if (!Number.isFinite(uid) || uid <= 0) return { ok: false, reason: "no_input" };

  const res = await boxService.renderSingleSticker({
    box_uid: uid,
    device_type: getDeviceType(),
    download_source: STICKER_DOWNLOAD_SOURCE_KEYS.qc_hold_material,
    sticker_meta: stickerMeta,
  });
  const opened = printFromBackendHtml(res?.html, { title: res?.print_title });
  if (!opened) return { ok: false, reason: "popup_blocked" };
  return { ok: true };
}

export async function printQcHoldCompletionStickers({ packingNo, boxUids, stickerMeta }) {
  const pn = String(packingNo ?? "").trim();
  const uids = (Array.isArray(boxUids) ? boxUids : [])
    .map((u) => Number(u))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!pn || !uids.length) return { ok: false, reason: "no_input" };

  const res = await boxService.renderBulkStickers({
    packing_number: pn,
    box_uids: uids,
    device_type: getDeviceType(),
    download_source: STICKER_DOWNLOAD_SOURCE_KEYS.qc_hold_material,
    ...(stickerMeta ? { sticker_meta: stickerMeta } : {}),
  });
  const opened = printFromBackendHtml(res?.html, { title: res?.print_title });
  if (!opened) return { ok: false, reason: "popup_blocked" };
  return { ok: true };
}
