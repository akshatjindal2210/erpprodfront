/**
 * Same rules as backend boxLooseKind (keep in sync).
 * Client-only: no DB.
 * Sticker UID format → `@/apps/ims/lib/stickerUidFormat`
 */

import { formatSaBoxNoUid, STICKER } from "@/apps/ims/lib/stickerUidFormat";

export function isLooseBoxComparedToStandard(perBoxQty, standardQtyPerBox) {
  const p = parseInt(String(perBoxQty ?? ""), 10);
  const s = parseInt(String(standardQtyPerBox ?? ""), 10);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(s) || s <= 0) return false;
  return p !== s;
}

export function parseOptionalStandardQtyPerBox(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveStockAdjustmentPackingNo(gatePackingNo, packingPreview, savedRow = null) {
  const fromRow = String(savedRow?.packing_number ?? "").trim();
  const st = packingPreview?.stickerRow;
  return (
    String(gatePackingNo ?? "").trim() ||
    fromRow ||
    String(packingPreview?.dailyprod?.doc_no ?? "").trim() ||
    String(st?.doc_no ?? st?.package_no ?? "").trim() ||
    String(packingPreview?.boxes?.[0]?.packing_number ?? "").trim()
  );
}

export function resolveDefaultStockAdjustmentCategoryId(categories, preferredId) {
  const list = Array.isArray(categories) ? categories : [];
  if (!list.length) return "";
  const pref = preferredId != null ? String(preferredId).trim() : "";
  if (pref && list.some((c) => String(c.id) === pref)) return pref;
  return String(list[0]?.id ?? "");
}

/** Full / loose summary for add drawer cards. */
export function summarizeAddBoxBreakup(rows, perBoxQty) {
  const list = Array.isArray(rows) ? rows : [];
  const p = Math.max(0, parseInt(String(perBoxQty ?? ""), 10) || 0);
  let full_boxes_count = 0;
  let loose_box_qty = 0;
  for (const r of list) {
    if (r?.is_loose) {
      const q = Number(r.qty);
      loose_box_qty += Number.isFinite(q) && q > 0 ? q : p;
    } else {
      full_boxes_count += 1;
    }
  }
  return { qty_per_box: p, full_boxes_count, loose_box_qty };
}

export function buildStockAdjustmentAddPreviewRows({
  boxCount,
  perBoxQty,
  packingNo,
  saToken = "?",
  looseByBoxNo = {},
  defaultIsLoose = false,
  unit = "PCS",
  boxNoUidPrefix = "",
}) {
  const n = parseInt(String(boxCount ?? ""), 10);
  const p = parseInt(String(perBoxQty ?? ""), 10);
  const pn = String(packingNo ?? "").trim();
  if (!Number.isFinite(n) || n < 1 || !Number.isFinite(p) || p < 1) return [];
  const packageNo = pn || "—";
  const tok = saToken === "?" || saToken === "preview" ? "?" : String(saToken);
  return Array.from({ length: n }, (_, i) => {
    const boxNo = i + 1;
    const box_no_uid = pn
      ? formatSaBoxNoUid(pn, tok, n, boxNo, boxNoUidPrefix)
      : `PREVIEW_${STICKER.SA}${tok}_${n}_${boxNo}`;
    return {
      box_no: boxNo,
      box_no_uid,
      package_no: packageNo,
      total_boxes: n,
      qty: p,
      unit,
      is_loose: looseByBoxNo[boxNo] !== undefined ? !!looseByBoxNo[boxNo] : !!defaultIsLoose,
    };
  });
}
