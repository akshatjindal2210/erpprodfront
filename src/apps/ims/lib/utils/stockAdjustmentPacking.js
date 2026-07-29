/**
 * Same rules as `backend/src/apps/ims/utils/box/boxLooseKind.js` (keep in sync).
 * Client-only: no DB, safe for "use client" bundles.
 */

import { normalizeBoxNoUidPrefix } from "@/platform/utils/global";

export function parseStockAdjustmentBoxIndex(boxNoUid) {
  const parts = String(boxNoUid ?? "").trim().split("_");
  const last = parseInt(parts[parts.length - 1], 10);
  return Number.isFinite(last) && last > 0 ? last : 0;
}

export function formatStockAdjustmentBoxNoUid(packingNumber, saToken, totalBoxes, boxIndex, prefix = "") {
  const pn = String(packingNumber ?? "").trim();
  const tok = saToken === "?" || saToken === "preview" ? "?" : String(saToken);
  const tb = parseInt(String(totalBoxes), 10);
  const bi = parseInt(String(boxIndex), 10);
  if (!pn || !Number.isFinite(tb) || tb < 1 || !Number.isFinite(bi) || bi < 1) return "";
  const core = `${pn}_SA${tok}_${tb}_${bi}`;
  const pfx = normalizeBoxNoUidPrefix(prefix);
  return pfx ? `${pfx}_${core}` : core;
}

export function isLooseBoxComparedToStandard(perBoxQty, standardQtyPerBox) {
  const p = parseInt(String(perBoxQty ?? ""), 10);
  const s = parseInt(String(standardQtyPerBox ?? ""), 10);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(s) || s <= 0) return false;
  return p !== s; // equal → full, any difference → loose
}

/** API / form values → positive int or null */
export function parseOptionalStandardQtyPerBox(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Packing number for SA box UIDs — gate input, then dailyprod / in-hand boxes. */
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

/** Live add preview rows (new entry or after changing box / per-box counts). */
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
      ? formatStockAdjustmentBoxNoUid(pn, tok, n, boxNo, boxNoUidPrefix)
      : `PREVIEW_SA${tok}_${n}_${boxNo}`;
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

export function parseStockAdjustmentBoxBreakup(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isLooseFromStockAdjustmentBoxBreakup(raw, boxNo, defaultLoose = false) {
  const n = parseInt(String(boxNo), 10);
  if (!Number.isFinite(n) || n < 1) return !!defaultLoose;
  const entry = parseStockAdjustmentBoxBreakup(raw).find(
    (b) => parseInt(String(b?.box_no), 10) === n
  );
  return entry ? !!entry.is_loose : !!defaultLoose;
}

/** Breakdown rows → summary counts for the sidebar card. */
export function summarizeAddBoxBreakup(rows, perBoxQty) {
  const list = Array.isArray(rows) ? rows : [];
  const full = list.filter((r) => !r.is_loose).length;
  const loose = list.filter((r) => r.is_loose).length;
  const pb = parseInt(String(perBoxQty ?? ""), 10);
  return {
    qty_per_box: Number.isFinite(pb) && pb > 0 ? pb : 0,
    full_boxes_count: full,
    loose_box_qty: loose,
  };
}

/** Default OEM, else first category — stock adjustment category dropdown. */
export function resolveDefaultStockAdjustmentCategoryId(categories, preferredId = null) {
  const cats = Array.isArray(categories) ? categories : [];
  const pref = preferredId != null && String(preferredId).trim() !== "" ? String(preferredId) : "";
  if (pref && cats.some((c) => String(c.id) === pref)) return pref;
  const oem = cats.find((c) => String(c.name || "").trim().toLowerCase() === "oem");
  if (oem?.id != null) return String(oem.id);
  return cats[0]?.id != null ? String(cats[0].id) : "";
}
