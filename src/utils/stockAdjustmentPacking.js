/**
 * Same rules as `backend/src/utils/stockAdjustmentPacking.js` (keep in sync).
 * Client-only: no DB, safe for "use client" bundles.
 */

import { normalizeBoxNoUidPrefix } from "@/global";

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

/*
export function isLooseBoxComparedToStandard(perBoxQty, standardQtyPerBox) {
  console.log(perBoxQty, standardQtyPerBox);
  const p = parseInt(String(perBoxQty ?? ""), 10);
  const s = parseInt(String(standardQtyPerBox ?? ""), 10);
  return Number.isFinite(p) && p > 0 && Number.isFinite(s) && s > 0 && p < s;
}
*/

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
