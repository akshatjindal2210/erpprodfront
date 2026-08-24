"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Check, AlertCircle, Loader2, Shield, MessageSquareQuote, Package, Layers, QrCode, ScanLine } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import ScanEnterInput from "@/ui/common/scan/ScanEnterInput";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { stockAdjustmentService } from "@/apps/ims/lib/services/stockAdjustment";
import { boxService } from "@/apps/ims/lib/services/box";
import { STICKER_DOWNLOAD_SOURCE_KEYS, getBoxNoUidPrefix } from "@/platform/utils/global";
import { loadPackingContext } from "./loadPackingContext";
import StockAdjustmentStickerDetailCards from "./StockAdjustmentStickerDetailCards";
import { masterService } from "@/apps/ims/lib/services/master";
import { focusFirstError } from "@/platform/utils/form/formFocus";
import { sortFilterOptionsAsc } from "@/platform/utils/form/sortSelectOptions";
import { getCurrentIndianFinancialYearStartYear, rowInIndianFinancialYear } from "@/platform/utils/core/indianFinancialYear";
import { boxRowCustomerLabel, groupSelectedMinusBoxesByCustomer, parseMinusCustomerLinesFromRow, resolveMinusAccCodeFromSelection } from "@/apps/ims/lib/utils/minusCustomerBreakdown";

const FIELD_ORDER = ["addNumBoxes", "addExtraBoxes", "addPerBoxQty", "category", "minusBoxes", "updateQty", "updateAction"];
import { formatStockAdjustmentBoxNoUid, parseOptionalStandardQtyPerBox, parseStockAdjustmentBoxIndex, resolveDefaultStockAdjustmentCategoryId, resolveStockAdjustmentPackingNo, summarizeAddBoxBreakup, buildStockAdjustmentAddPreviewRows } from "@/apps/ims/lib/utils/stockAdjustmentPacking";
import { categoryService } from "@/apps/ims/lib/services/category";
import { hydrateStockAdjustmentStickerView } from "./hydrateStockAdjustmentStickerView";
import { boxInventoryStatus, isBoxAvailableForMinus, isBoxVisibleForStockAdjustmentMinus, isValidMinusDrawerBoxRow, isStockAdjustmentIn, isStockAdjustmentOut, isBoxInHand } from "@/apps/ims/lib/utils/boxInventory";
import { isMinusBoxUidSelected, parseRemovedBoxUids, normalizeMinusSelectedUidSet } from "./stockAdjustmentViewBoxes";
import { printFromBackendHtml } from "@/apps/ims/lib/utils/printHtmlDocument";
import { parseStickerScan, parseBoxScanRaw, detectQrType, boxNoUidDisplayLabel, extractBoxCode, normalizeScanInput } from "@/apps/ims/lib/helpers/qrScan";
import { pickBoxFromViewsResponse } from "@/apps/ims/lib/helpers/boxViewsLookup";
import { projectedQtyAfterUpdate, parseQtyUpdatePayload } from "@/apps/ims/lib/utils/stockAdjustmentQtyUpdate";
import { OK_INPUT } from "@/ui/common/Constants";

const STOCK_ADJ_PERMS = { permission_module: "stock_adjustment", permission_action: "view" };
const SA_UPDATE_STICKER_SCANNER_ID = "sa-update-sticker-reader";

function isSaAddBoxRow(row) {
  if (isStockAdjustmentIn(row)) return true;
  const uid = String(row?.box_no_uid ?? "");
  return /_SA\d+_/i.test(uid);
}

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? "mobile" : "desktop";
}

/**
 * After approved stock adjustment (add), load new box_uids by `sa_id` and open print.
 */
async function printBulkStickersAfterStockAdjustmentAdd({
  adjustmentId,
  packingNo,
  expectedBoxCount,
  stickerMeta,
}) {
  const adjId = Number(adjustmentId);
  if (!Number.isFinite(adjId) || adjId < 1) return { ok: false, reason: "no_adj" };
  const pn = String(packingNo ?? "").trim();
  if (!pn) return { ok: false, reason: "no_pn" };

  /** Server filter by `sa_id` — box list API only returns whitelisted columns; `sa_id` must be in BOX_STORE_LIST_FIELDS. */
  const listRes = await boxService.getAll({
    page: 1,
    limit: 1000,
    filters: { sa_id: adjId },
    sortBy: "box_uid",
    order: "ASC",
  });
  const rows = Array.isArray(listRes?.data) ? listRes.data : [];
  const matched = rows.filter((b) => Number(b.sa_id) === adjId);
  const exp = parseInt(String(expectedBoxCount), 10);
  if (Number.isFinite(exp) && exp > 0 && matched.length !== exp) {
    console.warn("[stock adjustment] sticker print: box count mismatch", {
      expected: exp,
      got: matched.length,
      adjustment_id: adjId,
    });
  }
  const uids = matched
    .map((b) => Number(b.box_uid))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!uids.length) return { ok: false, reason: "no_uids" };

  const res = await boxService.renderBulkStickers({
    packing_number: pn,
    box_uids: uids,
    device_type: getDeviceType(),
    download_source: STICKER_DOWNLOAD_SOURCE_KEYS.stock_adjustment,
    sticker_meta: stickerMeta,
  });
  const opened = printFromBackendHtml(res?.html, { title: res?.print_title });
  if (!opened) return { ok: false, reason: "popup_blocked" };
  return { ok: true };
}

/**
 * Minus (approved): print **selected** boxes **before** create — after save they become `stock_out`
 * and `/sticker/render-bulk` no longer includes them.
 */
async function printBulkStickersBeforeStockAdjustmentMinus({ packingNo, boxUids, stickerMeta }) {
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
    download_source: STICKER_DOWNLOAD_SOURCE_KEYS.stock_adjustment,
    sticker_meta: stickerMeta,
  });
  const opened = printFromBackendHtml(res?.html, { title: res?.print_title });
  if (!opened) return { ok: false, reason: "popup_blocked" };
  return { ok: true };
}

async function fetchItemMetaForStockDrawer(itemdcodeRaw) {
  const id = itemdcodeRaw != null ? String(itemdcodeRaw).trim() : "";
  if (!id) return null;
  const res = await masterService.getItemViewById(id, STOCK_ADJ_PERMS);
  const item = res?.data || res;
  return item?.itemdcode != null ? item : null;
}

/** Shared form chrome: labels + control height align across toolbar and adjustment row */
const FIELD_LABEL = "block text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 leading-none";
const FIELD_LABEL_ROW = "flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 leading-none";
const FIELD_CONTROL =
  "h-8 lg:h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 lg:px-2.5 text-[10px] font-semibold text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const FIELD_CONTROL_ERR = "border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-100";
const READOUT_BOX =
  "min-h-[2rem] lg:min-h-[2.5rem] rounded-lg border border-slate-200 bg-slate-50 px-2 lg:px-2.5 flex flex-col justify-center shadow-sm";
const READOUT_BOX_MINUS =
  "min-h-[2rem] lg:min-h-[2.5rem] rounded-lg border border-rose-200/80 bg-rose-50/60 px-2 lg:px-2.5 flex flex-col justify-center shadow-sm";

const INITIAL_FORM = {
  remarks: "",
  approved: false,
  acc_code: null,
  acc_name: null,
  party_rate_cust_code: null,
};

const GATE_ADD_MINUS = [
  { value: "update", label: "Update" },
  { value: "add", label: "Add (+)" },
  { value: "minus", label: "Minus (-)" },
];

/** Past FY options in Add gate dropdown (current FY + this many previous years). */
const FINANCIAL_YEAR_RANGE_PAST = 9;
/** 0 = no FY starting year after current Indian FY. */
const FINANCIAL_YEAR_RANGE_FUTURE = 0;

/** e.g. 2025-2026 — driven by FINANCIAL_YEAR_RANGE_* above */
function getFinancialYearOptions() {
  const currentFyStart = getCurrentIndianFinancialYearStartYear();
  const out = [];
  for (
    let y = currentFyStart - FINANCIAL_YEAR_RANGE_PAST;
    y <= currentFyStart + FINANCIAL_YEAR_RANGE_FUTURE;
    y++
  ) {
    const v = `${y}-${y + 1}`;
    out.push({ value: v, label: v });
  }
  return out;
}

function defaultFinancialYear() {
  const y = getCurrentIndianFinancialYearStartYear();
  return `${y}-${y + 1}`;
}

function minusBoxNoUidLabel(row) {
  const label = String(row?.box_no_uid ?? "").trim();
  return label || "—";
}

/** Minus: customer per box row; acc_code only when all selected boxes share one customer. */
function resolveMinusAccCode(form, packingPreview, minusSelectedUids) {
  return resolveMinusAccCodeFromSelection(
    packingPreview?.boxes,
    minusSelectedUids,
    form,
    packingPreview
  );
}

/** Minus: sticker-style table + checkbox (sticky # / sticky select) */
function MinusBreakdownTable({
  boxes,
  selectedUids,
  onToggle,
  packingNo,
  selectedQty,
  selectedCount,
  readOnly = false,
  allowSelect = true,
  adjustmentId = null,
  entryApproved = false,
  /** Update flow only — impact from typed qty (not full box remove). */
  updateImpact = null,
}) {
  const visibleBoxes = (boxes || []).filter(
    (b) =>
      isValidMinusDrawerBoxRow(b) &&
      (isBoxVisibleForStockAdjustmentMinus(b, { adjustmentId }) ||
        isMinusBoxUidSelected(selectedUids, b.box_uid))
  );

  let displayBoxes = visibleBoxes;
  let total = visibleBoxes.length;

  if (readOnly) {
    displayBoxes = visibleBoxes
      .filter((b) => isMinusBoxUidSelected(selectedUids, b.box_uid))
      .sort((a, b) => Number(a.box_uid) - Number(b.box_uid));
    total = displayBoxes.length;
  }

  const isUpdateImpact = updateImpact != null;
  const updateQtyNum = parseInt(String(updateImpact?.qty ?? ""), 10);
  const hasUpdateQty = Number.isFinite(updateQtyNum) && updateQtyNum > 0;
  const updateIsMinus = String(updateImpact?.action ?? "").toLowerCase() === "minus";

  const customerSummary = isUpdateImpact
    ? []
    : groupSelectedMinusBoxesByCustomer(
        displayBoxes.filter((b) => isMinusBoxUidSelected(selectedUids, b.box_uid)),
        selectedUids,
        packingNo
      );

  const bannerTitle = isUpdateImpact
    ? updateIsMinus
      ? "Box qty update — Minus (−)"
      : "Box qty update — Add (+)"
    : readOnly
      ? entryApproved
        ? "Boxes removed (minus)"
        : "Boxes selected for minus"
      : "Boxes to remove (minus)";

  const impactText = isUpdateImpact
    ? hasUpdateQty
      ? updateIsMinus
        ? `−${updateQtyNum.toLocaleString()}`
        : `+${updateQtyNum.toLocaleString()}`
      : "—"
    : `-${selectedQty}`;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0">
      <div
        className={`shrink-0 px-3 py-2 lg:px-4 border-b flex flex-wrap items-center justify-between gap-2 ${
          isUpdateImpact
            ? updateIsMinus
              ? "bg-rose-50 border-rose-100"
              : "bg-emerald-50 border-emerald-100"
            : "bg-rose-50 border-rose-100"
        }`}
      >
        <div className="min-w-0">
          <p
            className={`text-[9px] font-black uppercase tracking-wide ${
              isUpdateImpact
                ? updateIsMinus
                  ? "text-rose-700"
                  : "text-emerald-800"
                : "text-rose-700"
            }`}
          >
            {bannerTitle}
          </p>
          <p
            className={`text-[11px] font-bold ${
              isUpdateImpact
                ? updateIsMinus
                  ? "text-rose-900"
                  : "text-emerald-900"
                : "text-rose-900"
            }`}
          >
            {isUpdateImpact ? (
              <>
                <span className="tabular-nums">{total}</span> box
              </>
            ) : readOnly ? (
              <>
                <span className="tabular-nums">{total}</span> box
              </>
            ) : (
              <>
                Selected: <span className="tabular-nums">{selectedCount}</span> / {total} box
              </>
            )}
            <span className={`mx-2 ${isUpdateImpact && !updateIsMinus ? "text-emerald-300" : "text-rose-300"}`}>
              |
            </span>
            Qty impact: <span className="font-black tabular-nums">{impactText}</span> PCS
          </p>
          {customerSummary.length > 0 ? (
            <div className="mt-1.5 flex flex-col gap-1 w-full">
              {customerSummary.map((line) => (
                <div
                  key={`${line.acc_code}-${line.packing_number}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[9px] text-rose-950"
                >
                  <span className="font-mono font-bold tabular-nums">{line.packing_number || packingNo}</span>
                  <span className="font-black uppercase truncate max-w-[200px]" title={line.acc_name}>
                    {line.acc_name}
                  </span>
                  <span className="font-black tabular-nums text-rose-700">
                    −{line.qty.toLocaleString()} PCS
                  </span>
                  <span className="text-rose-400 font-bold">({line.box_count} box)</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto overscroll-contain p-0 lg:p-1 [-webkit-overflow-scrolling:touch]">
        {!displayBoxes?.length ? (
          <div className="bg-white border border-slate-200 px-3 py-8 text-center text-slate-400 text-[10px] font-bold uppercase">
            No boxes
          </div>
        ) : (
          <div className="bg-white border border-slate-200 w-full max-w-full min-w-0">
            <table className="w-full min-w-[640px] sm:min-w-[700px] lg:min-w-[820px] text-left border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-600 border-r border-slate-200 whitespace-nowrap"
                    >
                      #
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Box
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Packing
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Customer
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Status
                    </th>
                    {!readOnly && allowSelect ? (
                      <th
                        scope="col"
                        className="sticky right-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-600 text-center border-l border-slate-200 whitespace-nowrap"
                      >
                        Minus
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {displayBoxes.map((row, idx) => {
                    const id = String(row.box_uid);
                    const checked = isMinusBoxUidSelected(selectedUids, row.box_uid);
                    const boxNoUid = minusBoxNoUidLabel(row);
                    const canSelect =
                      isBoxAvailableForMinus(row, { adjustmentId }) || checked;
                    const isLoose = !!row.is_loose;
                    const unit = row.unit || "PCS";
                    const invStatus = boxInventoryStatus(row);
                    const isSaAdd = isSaAddBoxRow(row);
                    return (
                      <tr
                        key={id}
                        className={`group border-b border-slate-100 hover:bg-slate-50/70 ${!canSelect && !readOnly ? "opacity-50" : ""}`}
                      >
                        <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-700 min-w-0 max-w-[180px] lg:max-w-[240px]">
                          <div className="flex flex-col leading-snug min-w-0">
                            <span className="text-slate-800 font-bold text-[10px] break-all">
                              {boxNoUid}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-700 whitespace-nowrap tabular-nums">
                          {row.packing_number ?? packingNo}
                        </td>
                        <td
                          className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-700 min-w-0 max-w-[140px] lg:max-w-[180px] truncate"
                          title={boxRowCustomerLabel(row)}
                        >
                          {boxRowCustomerLabel(row)}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-800 whitespace-nowrap tabular-nums">
                          {Number(row.qty ?? 0).toLocaleString()} {unit}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                          <span
                            className={`text-[8px] font-black px-1 py-0.5 lg:px-1.5 lg:py-0.5 border whitespace-nowrap ${
                              isSaAdd
                                ? "bg-violet-50 text-violet-800 border-violet-200"
                                : isLoose
                                  ? "bg-orange-50 text-orange-700 border-orange-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {isSaAdd ? "SA ADD" : isLoose ? "LOOSE" : "FULL"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                          <span className="text-[9px] font-bold text-slate-600 uppercase whitespace-nowrap">
                            {readOnly
                              ? entryApproved || isStockAdjustmentOut(row)
                                ? "Removed"
                                : "Selected"
                              : checked && isStockAdjustmentOut(row)
                                ? "Removed"
                                : invStatus === "stock_adjustment"
                                  ? "SA removed"
                                  : canSelect
                                    ? "In stock"
                                    : "Not available"}
                          </span>
                        </td>
                        {!readOnly && allowSelect ? (
                          <td className="sticky right-0 z-10 py-1.5 px-2 lg:py-2 lg:px-3 text-center bg-white group-hover:bg-slate-50 border-l border-slate-100 align-middle">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canSelect}
                              onChange={() => onToggle(row.box_uid)}
                              className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:opacity-40"
                              aria-label={`Minus box ${boxNoUid}`}
                            />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Add: planned new boxes — same column feel as sticker breakdown (preview rows) */
function AddBreakdownTable({
  rows,
  perBoxQty,
  totalQty,
  savedView = false,
  editMode = false,
  allowRemove = true,
  removeUids,
  onToggleRemove,
  showBulkKindDropdown = false,
  bulkBoxKind = "full",
  onBulkBoxKindChange,
  viewMode = false,
}) {
  const n = rows?.length ?? 0;
  const removeSet = removeUids instanceof Set ? removeUids : new Set();
  const showRemoveColumn = editMode && allowRemove;
  const markedRemove = showRemoveColumn
    ? rows.filter((r) => r.box_uid != null && removeSet.has(String(r.box_uid))).length
    : 0;
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0">
      <div className="shrink-0 px-3 py-2 lg:px-4 bg-emerald-50 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase text-emerald-800 tracking-wide">
            {editMode
              ? "Saved boxes — select Remove to delete from the database"
              : viewMode
                ? "Stickers"
                : savedView
                  ? "Saved boxes (add)"
                  : "Box breakup — set Full or Loose for all boxes"}
          </p>
          <p className="text-[11px] font-bold text-emerald-900">
            <span className="tabular-nums">{n}</span> row{n === 1 ? "" : "s"}
            {showRemoveColumn && markedRemove > 0 ? (
              <>
                <span className="mx-2 text-emerald-200">|</span>
                <span className="text-rose-700">{markedRemove} to remove</span>
              </>
            ) : null}
            <span className="mx-2 text-emerald-200">|</span>
            Total <span className="font-black tabular-nums">+{Number(totalQty || 0).toLocaleString()}</span> PCS
          </p>
          {!savedView && !editMode && n > 0 ? (
            <p className="text-[8px] font-semibold text-emerald-700/90 mt-1 max-w-xl">
              Use <span className="font-bold">All boxes</span> dropdown — applies to every box in this entry.
            </p>
          ) : null}
          {!savedView && !editMode && !n ? (
            <p className="text-[8px] font-semibold text-emerald-700/90 mt-1 max-w-xl">
              Preview IDs use <span className="font-mono">SA?</span>; after save they become <span className="font-mono">SA</span> plus the new adjustment id (e.g.{" "}
              <span className="font-mono">32158_SA12_10_1</span>).
            </p>
          ) : null}
          {showRemoveColumn ? (
            <p className="text-[8px] font-semibold text-emerald-700/90 mt-1 max-w-xl">
              Use <span className="font-bold">Add more</span> above to add boxes. Select <span className="font-bold">Remove</span> on saved rows to delete them from the database.
            </p>
          ) : null}
        </div>
        {showBulkKindDropdown && n > 0 ? (
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <label htmlFor="sa-bulk-box-kind" className="text-[8px] font-bold uppercase text-emerald-700">
              All boxes
            </label>
            <select
              id="sa-bulk-box-kind"
              value={bulkBoxKind === "loose" ? "loose" : "full"}
              onChange={(e) => onBulkBoxKindChange?.(e.target.value)}
              className="h-8 min-w-[7.5rem] rounded-lg border border-emerald-200 bg-white px-2 text-[10px] font-bold uppercase text-slate-800 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="full">All Full</option>
              <option value="loose">All Loose</option>
            </select>
          </div>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 overflow-auto overscroll-contain p-0 lg:p-1 [-webkit-overflow-scrolling:touch]">
        {!n ? (
          <div className="bg-white border border-slate-200 px-3 py-8 text-center">
            <div className="flex flex-col items-center gap-1.5 text-slate-400">
              <Layers size={20} className="opacity-20" />
              <span className="text-[10px] font-bold uppercase tracking-wide px-1">
                {editMode
                  ? "Saved boxes appear here — select Remove or use Add more above"
                  : "Enter number of boxes and per-box quantity — the breakdown will appear here"}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 w-full max-w-full min-w-0">
            <table className="w-full min-w-[520px] sm:min-w-[580px] lg:min-w-[680px] text-left border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-600 border-r border-slate-200 whitespace-nowrap"
                    >
                      #
                    </th>
                    {showRemoveColumn ? (
                      <th
                        scope="col"
                        className="sticky left-[2.25rem] top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-rose-600 border-r border-slate-200 whitespace-nowrap"
                      >
                        Remove
                      </th>
                    ) : null}
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Box
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Packing
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const isMarkedRemove =
                      showRemoveColumn && row.box_uid != null && removeSet.has(String(row.box_uid));
                    const isRemovedRow = !!row.is_removed;
                    return (
                    <tr
                      key={`${row.box_no_uid}-${row.box_uid ?? "new"}-${idx}`}
                      className={`group border-b border-slate-100 hover:bg-slate-50/70 ${isMarkedRemove || isRemovedRow ? "bg-rose-50/60" : ""}`}
                    >
                      <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums">
                        {idx + 1}
                      </td>
                      {showRemoveColumn ? (
                        <td className="sticky left-[2.25rem] z-10 px-2 py-1.5 lg:px-3 lg:py-2 bg-white group-hover:bg-slate-50 border-r border-slate-100">
                          {row.box_uid != null ? (
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isMarkedRemove}
                                onChange={() => onToggleRemove?.(row.box_uid)}
                                className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-200"
                              />
                              <span className="text-[8px] font-bold uppercase text-rose-700">Remove</span>
                            </label>
                          ) : (
                            <span className="text-[8px] text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-700 min-w-0 max-w-[180px] lg:max-w-[240px]">
                        <div className="flex flex-col leading-snug min-w-0">
                          <span className="text-blue-700 font-bold text-[10px] break-all">{row.box_no_uid}</span>
                          <span className="text-[8px] text-slate-400 uppercase font-bold truncate">
                            Box {row.box_no} / {row.total_boxes}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-700 whitespace-nowrap tabular-nums">
                        {row.package_no}
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-800 whitespace-nowrap tabular-nums">
                        {Number(row.qty).toLocaleString()} {row.unit || "PCS"}
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                        {row.is_loose ? (
                          <span className="text-[8px] font-black px-1 py-0.5 lg:px-1.5 lg:py-0.5 border whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200">
                            LOOSE
                          </span>
                        ) : (
                          <span className="text-[8px] font-black px-1 py-0.5 lg:px-1.5 lg:py-0.5 border whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-200">
                            FULL
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                        <span
                          className={`text-[9px] font-bold uppercase whitespace-nowrap ${
                            isMarkedRemove
                              ? "text-rose-600"
                              : row.is_removed
                                ? "text-rose-600"
                                : row.is_new
                                  ? "text-blue-600"
                                  : savedView || row.is_saved
                                    ? "text-emerald-700"
                                    : "text-blue-600"
                          }`}
                        >
                          {isMarkedRemove
                            ? "Will remove"
                            : row.is_removed
                              ? "Removed"
                              : row.box_uid != null
                                ? viewMode
                                  ? "Generated"
                                  : "Saved"
                                : viewMode
                                  ? "Pending"
                                  : row.is_new
                                    ? "To create"
                                    : savedView || row.is_saved
                                      ? "Saved"
                                      : "To create"}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StockAdjustmentStickerCloneDrawer({
  open,
  onClose,
  onSuccess,
  mode = "add",
  editData = null,
}) {
  const canAccess = useCanAccess();
  const canApprove = canAccess("stock_adjustment", "authorize").allowed;
  const canRemoveStickerBoxes = useMemo(
    () =>
      canAccess("stock_adjustment", "add").allowed ||
      canAccess("stock_adjustment", "edit").allowed ||
      canAccess("stock_adjustment", "authorize").allowed ||
      canAccess("stock_adjustment", "delete").allowed,
    [canAccess]
  );
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const readOnly = isView || isApprove;
  const showApproval = canApprove && mode === "add";

  const [gateEntryType, setGateEntryType] = useState("");
  const [gateFinancialYear, setGateFinancialYear] = useState("");
  const [gatePackingNo, setGatePackingNo] = useState("");
  const [packLoading, setPackLoading] = useState(false);
  const [packingPreview, setPackingPreview] = useState(null);
  const [gatePassed, setGatePassed] = useState(false);

  const [addNumBoxes, setAddNumBoxes] = useState("");
  const [addPerBoxQty, setAddPerBoxQty] = useState("");
  const [addAllBoxesLoose, setAddAllBoxesLoose] = useState(false);
  const [savedAddBoxRows, setSavedAddBoxRows] = useState([]);
  const [addRemoveUids, setAddRemoveUids] = useState(() => new Set());
  const [addExtraBoxes, setAddExtraBoxes] = useState("0");
  const [minusSelectedUids, setMinusSelectedUids] = useState(() => new Set());
  const [itemMeta, setItemMeta] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [updateBox, setUpdateBox] = useState(null);
  const [updateAction, setUpdateAction] = useState("minus");
  const [updateQty, setUpdateQty] = useState("");
  const [isUpdateScannerOpen, setIsUpdateScannerOpen] = useState(false);
  const updateScanInputRef = useRef(null);
  const loadUpdateBoxFromScanRef = useRef(async () => {});
  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const showUpdateLaserUi = laserScan || isLaserScanEnabled();
  const updateScanBtnCount = (showPhoneQr ? 1 : 0) + (showUpdateLaserUi ? 1 : 0);
  const updateScanBtnFill =
    updateScanBtnCount > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  const closeUpdateScanner = useCallback(() => setIsUpdateScannerOpen(false), []);

  const loadCategoriesForItem = useCallback(async (preferredId = null) => {
    try {
      const res = await categoryService.getViews({
        permission_module: "stock_adjustment",
        permission_action: "view",
      });
      const cats = sortFilterOptionsAsc(
        (res?.data || []).map((c) => ({
          id: String(c.id),
          name: c.name || `Category #${c.id}`,
        })),
        "name"
      );
      setCategoryOptions(cats);
      setSelectedCategoryId(resolveDefaultStockAdjustmentCategoryId(cats, preferredId));
    } catch {
      setCategoryOptions([]);
      setSelectedCategoryId("");
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  /** Phone: switch between item cards and breakdown table */
  const [mobileBreakdownTab, setMobileBreakdownTab] = useState("details");
  const [viewAddRows, setViewAddRows] = useState([]);
  const [viewHydrating, setViewHydrating] = useState(false);
  const [savedRow, setSavedRow] = useState(null);
  const [customerChanging, setCustomerChanging] = useState(false);

  const structureLocked = isView || isApprove;
  const isAddEdit = isEdit && gateEntryType === "add";
  const hasDbAddBoxes = useMemo(
    () => savedAddBoxRows.some((r) => r.box_uid != null),
    [savedAddBoxRows]
  );
  const isAddEditRebuild = isAddEdit && hasDbAddBoxes;
  const adjIdForMinus = editData?.adjustment_id ?? savedRow?.adjustment_id;
  const minusEntryApproved = !!(savedRow?.approved ?? editData?.approved);
  const editingWasApproved = isEdit && !!(savedRow?.approved ?? editData?.approved);

  const sopPermissionType = useMemo(() => {
    if (isApprove) return "authorize";
    if (isEdit) return "edit";
    if (showApproval && form.approved) return "authorize";
    return "add";
  }, [isApprove, isEdit, showApproval, form.approved]);

  useEffect(() => {
    let t;
    let cancelled = false;

    const resetBlank = () => {
      setGateEntryType("");
      setGateFinancialYear("");
      setGatePackingNo("");
      setPackLoading(false);
      setPackingPreview(null);
      setGatePassed(false);
      setAddNumBoxes("");
      setAddPerBoxQty("");
      setAddAllBoxesLoose(false);
      setSavedAddBoxRows([]);
      setAddRemoveUids(new Set());
      setAddExtraBoxes("0");
      setMinusSelectedUids(new Set());
      setItemMeta(null);
      setCategoryOptions([]);
      setSelectedCategoryId("");
      setUpdateBox(null);
      setUpdateAction("minus");
      setUpdateQty("");
      setIsUpdateScannerOpen(false);
      setForm(INITIAL_FORM);
      setErrors({});
      setMobileBreakdownTab("details");
      setViewAddRows([]);
      setViewHydrating(false);
      setSavedRow(null);
    };

    if (open && (isView || isEdit || isApprove) && editData?.adjustment_id) {
      resetBlank();
      setViewHydrating(true);
      (async () => {
        try {
          const hydrated = await hydrateStockAdjustmentStickerView(editData, { forEdit: isEdit });
          if (cancelled) return;
          setGateEntryType(hydrated.gateEntryType);
          setGateFinancialYear(hydrated.gateFinancialYear);
          setGatePackingNo(hydrated.gatePackingNo);
          
          const rowAcc = hydrated.row?.acc_code;
          const dpAcc = hydrated.packingPreview?.dailyprod?.acc_code;
          const isMinusHydrate = hydrated.gateEntryType === "minus";
          const minusLines = isMinusHydrate
            ? parseMinusCustomerLinesFromRow(hydrated.row)
            : [];

          let finalAccCode = null;
          let finalAccName = null;
          let finalPartyRate = null;

          if (!isMinusHydrate) {
            if (rowAcc != null && String(rowAcc).trim() !== "") {
              finalAccCode = rowAcc;
              finalAccName = hydrated.row?.acc_name;
              finalPartyRate = hydrated.row?.party_rate_cust_code;
            } else if (dpAcc != null && String(dpAcc).trim() !== "") {
              finalAccCode = dpAcc;
              finalAccName = hydrated.packingPreview?.dailyprod?.acc_name;
              finalPartyRate = hydrated.packingPreview?.dailyprod?.party_rate_cust_code;
            }
          } else if (minusLines.length === 1) {
            finalAccCode = minusLines[0].acc_code;
            finalAccName = minusLines[0].acc_name;
          }

          setForm({ 
            ...INITIAL_FORM, 
            ...hydrated.form, 
            acc_code: finalAccCode, 
            acc_name: finalAccName, 
            party_rate_cust_code: finalPartyRate 
          });
          setAddNumBoxes(hydrated.addNumBoxes);
          setAddPerBoxQty(hydrated.addPerBoxQty);
          if (hydrated.gateEntryType === "add") {
            const savedRows = (hydrated.viewAddRows || []).filter((r) => r.box_uid != null);
            if (savedRows.length > 0) {
              const looseN = savedRows.filter((r) => r.is_loose).length;
              setAddAllBoxesLoose(looseN > 0 && looseN === savedRows.length);
            } else {
              setAddAllBoxesLoose(false);
            }
          } else {
            setAddAllBoxesLoose(false);
          }
          setMinusSelectedUids(normalizeMinusSelectedUidSet(hydrated.minusSelectedUids));
          setViewAddRows(hydrated.viewAddRows);
          setSavedAddBoxRows(hydrated.savedAddBoxRows ?? hydrated.viewAddRows ?? []);
          setAddRemoveUids(new Set());
          setAddExtraBoxes("0");
          setPackingPreview(hydrated.packingPreview);
          setItemMeta(hydrated.itemMeta);
          setSavedRow(hydrated.row);
          setUpdateBox(hydrated.updateBox ?? null);
          setUpdateAction(hydrated.updateAction || "minus");
          setUpdateQty(hydrated.updateQty || "");
          setGatePassed(true);
          setMobileBreakdownTab(
            hydrated.gateEntryType === "add" ? "boxes" : "details"
          );
          if (hydrated.gateEntryType === "add") {
            await loadCategoriesForItem(hydrated.row?.category_id);
          }
        } catch (err) {
          if (!cancelled) {
            toast.error(err?.message || "Failed to load adjustment");
            onCloseRef.current?.();
          }
        } finally {
          if (!cancelled) setViewHydrating(false);
        }
      })();
    } else if (open) {
      resetBlank();
    } else {
      t = setTimeout(resetBlank, 300);
    }

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, isView, isEdit, isApprove, editData?.adjustment_id]);

  const handleApprove = async () => {
    let pendingRemovals = 0;
    if (savedRow?.removed_box_ids) {
      try {
        const parsed =
          typeof savedRow.removed_box_ids === "string"
            ? JSON.parse(savedRow.removed_box_ids)
            : savedRow.removed_box_ids;
        pendingRemovals = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        pendingRemovals = 0;
      }
    }
    const needsDeleteToApprove =
      gateEntryType === "minus" || (gateEntryType === "add" && pendingRemovals > 0);
    if (needsDeleteToApprove && !canRemoveStickerBoxes) {
      toast.error("You do not have permission to remove boxes from inventory.");
      return;
    }
    const adjId = editData?.adjustment_id ?? savedRow?.adjustment_id;
    if (!isApprove || !adjId) return;
    if (savedRow?.approved) {
      toast.info("This adjustment is already approved.");
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setLoading(true);
    try {
      const payload = { approved: true };
      const approveAccCode =
        gateEntryType === "minus"
          ? resolveMinusAccCode(form, packingPreview, minusSelectedUids)
          : form.acc_code;
      if (approveAccCode) payload.acc_code = approveAccCode;
      if (form.acc_name != null && String(form.acc_name).trim() !== "") {
        payload.acc_name = String(form.acc_name).trim();
      }
      if (gateEntryType === "add") {
        payload.all_boxes_loose = addAllBoxesLoose;
      }
      
      await stockAdjustmentService.update(adjId, payload);
      toast.success(
        gateEntryType === "add"
          ? "Approved — boxes created in inventory. Print stickers from the list (Ctrl+P)."
          : gateEntryType === "update"
            ? "Approved — box quantity updated in inventory."
            : "Approved — selected boxes removed from inventory."
      );
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Approve failed");
    } finally {
      setLoading(false);
    }
  };

  const selectedRowLike = useMemo(() => {
    if (!packingPreview) {
      return {
        item_code: "—",
        itemdcode: null,
        itemdesc: "—",
        category: "—",
        acc_name: form.acc_name || "—",
        acc_code: form.acc_code || null,
        job_card_no: "—",
        total_qty: 0,
        unit: "PCS",
        doc_dt: null,
        doc_no: "",
      };
    }
    const st = packingPreview.stickerRow;
    const dp = packingPreview.dailyprod;
    const im = itemMeta;
    const pn = gatePackingNo.trim();

    // Form values take absolute priority for manual selection
    const formAccCode = form.acc_code;
    const formAccName = form.acc_name;
    const formPartyRate = form.party_rate_cust_code;

    const dpAccCode = dp?.acc_code ?? st?.acc_code ?? null;
    const dpAccName = im?.acc_name ?? st?.acc_name ?? dp?.acc_name ?? "—";
    const dpPartyRate = st?.party_rate_cust_code ?? dp?.party_rate_cust_code;

    // If form has a code, we MUST use form's name (or "—" if null) to avoid mismatch
    const finalAccCode = formAccCode !== null ? formAccCode : dpAccCode;
    const finalAccName = formAccCode !== null ? (formAccName ?? "—") : dpAccName;
    const finalPartyRate = formAccCode !== null ? formPartyRate : dpPartyRate;

    const itemDesc =
      dp?.item_desc ??
      dp?.itemdesc ??
      im?.itemdesc ??
      im?.description ??
      st?.itemdesc ??
      st?.item_desc ??
      "—";

    const rawTotal = st?.total_qty ?? dp?.total_qty;
    let totalQty = Number(rawTotal);
    if (!Number.isFinite(totalQty) || totalQty <= 0) {
      const boxRows = packingPreview?.boxes || [];
      if (boxRows.length) {
        totalQty = boxRows.reduce((s, b) => s + (parseInt(String(b.qty ?? ""), 10) || 0), 0);
      } else if (gateEntryType === "update" && updateBox?.qty != null) {
        totalQty = parseInt(String(updateBox.qty), 10) || 0;
      } else {
        totalQty = 0;
      }
    }

    return {
      item_code: dp?.item_code ?? im?.item_code ?? st?.item_code ?? "—",
      itemdcode: dp?.itemdcode ?? im?.itemdcode ?? st?.itemdcode ?? null,
      itemdesc: itemDesc,
      description: itemDesc,
      category: st?.category ?? st?.type_name ?? "—",
      acc_name: finalAccName,
      party_rate_cust_code: finalPartyRate,
      acc_code: finalAccCode,
      cust_code: st?.cust_code,
      job_card_no: dp?.job_card_no ?? st?.job_card_no ?? "—",
      total_qty: totalQty,
      unit: st?.unit ?? dp?.unit ?? "PCS",
      doc_dt: st?.doc_dt ?? dp?.doc_dt,
      doc_no: st?.doc_no ?? dp?.doc_no ?? pn,
    };
  }, [
    packingPreview,
    itemMeta,
    gatePackingNo,
    form.acc_name,
    form.acc_code,
    form.party_rate_cust_code,
    gateEntryType,
    updateBox,
  ]);

  const addTotalQty = useMemo(() => {
    const n = parseInt(String(addNumBoxes).trim(), 10);
    const p = parseInt(String(addPerBoxQty).trim(), 10);
    if (!Number.isFinite(n) || !Number.isFinite(p) || n < 1 || p < 1) return 0;
    return n * p;
  }, [addNumBoxes, addPerBoxQty]);

  const addPerBoxInt = useMemo(() => {
    const p = parseInt(String(addPerBoxQty).trim(), 10);
    return Number.isFinite(p) && p >= 1 ? p : 0;
  }, [addPerBoxQty]);

  const saPackingNo = useMemo(
    () => resolveStockAdjustmentPackingNo(gatePackingNo, packingPreview, savedRow ?? editData),
    [gatePackingNo, packingPreview, savedRow, editData]
  );

  const setAddBulkBoxKind = useCallback((kind) => {
    setAddAllBoxesLoose(String(kind).toLowerCase() === "loose");
  }, []);

  useEffect(() => {
    if (gateEntryType !== "add" || structureLocked) return;
    const n = parseInt(String(addNumBoxes).trim(), 10);
    if (Number.isFinite(n) && n >= 1 && addPerBoxInt >= 1) {
      setMobileBreakdownTab("boxes");
    }
  }, [gateEntryType, structureLocked, addNumBoxes, addPerBoxInt]);

  const packingLike = useMemo(() => {
    const pd = packingPreview?.stickerRow?.packing_details;
    if (pd != null && pd.qty_per_box != null && pd.qty_per_box !== "") {
      return {
        qty_per_box: Number(pd.qty_per_box) || 0,
        full_boxes_count: Number(pd.full_boxes_count) || 0,
        loose_box_qty: Number(pd.loose_box_qty) || 0,
      };
    }
    // Same left-panel breakdown summary as Minus (Update uses one box the same way).
    if (
      (gateEntryType === "minus" || gateEntryType === "update") &&
      packingPreview?.boxes?.length
    ) {
      const boxes = packingPreview.boxes;
      const full = boxes.filter((b) => !b.is_loose).length;
      const loose = boxes.filter((b) => b.is_loose).length;
      const q0 = boxes[0]?.qty;
      const qpb = q0 != null ? Number(q0) : 0;
      return { qty_per_box: qpb, full_boxes_count: full, loose_box_qty: loose };
    }
    return { qty_per_box: 0, full_boxes_count: 0, loose_box_qty: 0 };
  }, [packingPreview, gateEntryType]);

  const addBreakdownRows = useMemo(() => {
    const saToken =
      isEdit && editData?.adjustment_id ? editData.adjustment_id : "?";
    return buildStockAdjustmentAddPreviewRows({
      boxCount: addNumBoxes,
      perBoxQty: addPerBoxQty,
      packingNo: saPackingNo,
      saToken,
      defaultIsLoose: addAllBoxesLoose,
      boxNoUidPrefix: getBoxNoUidPrefix(),
    });
  }, [addNumBoxes, addPerBoxQty, saPackingNo, isEdit, editData?.adjustment_id, addAllBoxesLoose]);

  const toggleAddRemove = useCallback(
    (boxUid) => {
      if (!canRemoveStickerBoxes) {
        toast.error("You do not have permission to remove boxes from inventory.");
        return;
      }
      const key = String(boxUid);
      setAddRemoveUids((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [canRemoveStickerBoxes]
  );

  const addEditBreakdownRows = useMemo(() => {
    if (!isAddEditRebuild) return [];
    const pb = addPerBoxInt;
    const kept = savedAddBoxRows.filter(
      (r) => r.box_uid != null && !addRemoveUids.has(String(r.box_uid))
    );
    const pn =
      saPackingNo ||
      String(gatePackingNo ?? "").trim() ||
      String(savedRow?.packing_number ?? editData?.packing_number ?? "").trim() ||
      String(kept[0]?.package_no ?? "").trim();
    const extra = parseInt(String(addExtraBoxes ?? "").trim(), 10) || 0;
    if (!kept.length && extra < 1) return [];

    const adjId = editData?.adjustment_id;
    const rows = kept.map((r) => ({ ...r, is_saved: true }));
    if (!Number.isFinite(pb) || pb < 1 || !pn) return rows;

    const maxIdx = kept.reduce((m, r) => Math.max(m, parseStockAdjustmentBoxIndex(r.box_no_uid)), 0);
    const totalAfter = kept.length + extra;

    for (let i = 1; i <= extra; i++) {
      const boxIndex = maxIdx + i;
      rows.push({
        box_no: boxIndex,
        box_no_uid: formatStockAdjustmentBoxNoUid(pn, adjId, totalAfter, boxIndex, getBoxNoUidPrefix()),
        package_no: pn,
        total_boxes: totalAfter,
        qty: pb,
        unit: "PCS",
        is_loose: addAllBoxesLoose,
        is_new: true,
      });
    }
    return rows;
  }, [
    isAddEditRebuild,
    savedAddBoxRows,
    addRemoveUids,
    addExtraBoxes,
    addPerBoxInt,
    saPackingNo,
    gatePackingNo,
    savedRow,
    editData,
    packingPreview,
    editData?.adjustment_id,
    addAllBoxesLoose,
  ]);

  const editAddTotalQty = useMemo(() => {
    if (!isAddEditRebuild) return 0;
    const pb = addPerBoxInt;
    let sum = 0;
    for (const r of savedAddBoxRows) {
      if (r.box_uid != null && !addRemoveUids.has(String(r.box_uid))) {
        sum += parseInt(String(r.qty), 10) || pb;
      }
    }
    const extra = parseInt(String(addExtraBoxes ?? "").trim(), 10) || 0;
    if (extra > 0 && pb >= 1) sum += extra * pb;
    return sum;
  }, [isAddEditRebuild, savedAddBoxRows, addRemoveUids, addExtraBoxes, addPerBoxInt]);

  const savedAddBoxCount = parseInt(
    String(savedRow?.box_count_impact ?? editData?.box_count_impact ?? ""),
    10
  );
  const savedAddPerBox = parseInt(String(savedRow?.per_box_qty ?? editData?.per_box_qty ?? ""), 10);
  const currentAddBoxCount = parseInt(String(addNumBoxes).trim(), 10);
  const addCountsMatchSaved =
    Number.isFinite(savedAddBoxCount) &&
    savedAddBoxCount === currentAddBoxCount &&
    Number.isFinite(savedAddPerBox) &&
    savedAddPerBox === addPerBoxInt;

  const isAddEditPending =
    isAddEdit &&
    !isAddEditRebuild &&
    addCountsMatchSaved &&
    viewAddRows.length > 0 &&
    viewAddRows.length === currentAddBoxCount;

  const fallbackViewAddRows = useMemo(() => {
    if (gateEntryType !== "add" || viewAddRows.length > 0) return [];
    const row = savedRow ?? editData;
    const n = parseInt(String(row?.box_count_impact ?? addNumBoxes ?? ""), 10);
    const p = parseInt(String(row?.per_box_qty ?? addPerBoxQty ?? ""), 10);
    if (!Number.isFinite(n) || n < 1 || !Number.isFinite(p) || p < 1) return [];
    const adjId = row?.adjustment_id;
    const approved = !!(row?.approved ?? savedRow?.approved);
    return buildStockAdjustmentAddPreviewRows({
      boxCount: n,
      perBoxQty: p,
      packingNo: saPackingNo,
      saToken: adjId ?? "?",
      defaultIsLoose: addAllBoxesLoose,
      boxNoUidPrefix: getBoxNoUidPrefix(),
    }).map((r) => ({
      ...r,
      is_saved: approved,
    }));
  }, [
    gateEntryType,
    viewAddRows.length,
    savedRow,
    editData,
    addNumBoxes,
    addPerBoxQty,
    saPackingNo,
    addAllBoxesLoose,
  ]);

  const previewFromFormFields = useMemo(() => {
    if (gateEntryType !== "add") return [];
    const n = parseInt(String(addNumBoxes).trim(), 10);
    const p = parseInt(String(addPerBoxQty).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || !Number.isFinite(p) || p < 1) return [];
    const row = savedRow ?? editData;
    const adjId = row?.adjustment_id;
    const approved = !!(row?.approved ?? savedRow?.approved);
    return buildStockAdjustmentAddPreviewRows({
      boxCount: n,
      perBoxQty: p,
      packingNo:
        saPackingNo ||
        String(gatePackingNo ?? "").trim() ||
        String(row?.packing_number ?? "").trim(),
      saToken: adjId ?? "?",
      defaultIsLoose: addAllBoxesLoose,
      boxNoUidPrefix: getBoxNoUidPrefix(),
    }).map((r) => ({
      ...r,
      is_saved: approved || !!adjId,
    }));
  }, [
    gateEntryType,
    addNumBoxes,
    addPerBoxQty,
    savedRow,
    editData,
    saPackingNo,
    gatePackingNo,
    addAllBoxesLoose,
  ]);

  const savedAddBoxTableRows = useMemo(
    () => (savedAddBoxRows || []).map((r) => ({ ...r, is_saved: true })),
    [savedAddBoxRows]
  );

  const lockedAddRows = useMemo(() => {
    if (viewAddRows.length > 0) return viewAddRows;
    if (fallbackViewAddRows.length > 0) return fallbackViewAddRows;
    if (savedAddBoxTableRows.length > 0) return savedAddBoxTableRows;
    return previewFromFormFields;
  }, [viewAddRows, fallbackViewAddRows, savedAddBoxTableRows, previewFromFormFields]);

  const addTableRows = useMemo(() => {
    if (gateEntryType !== "add") return [];
    if (structureLocked) return lockedAddRows;
    if (isAddEditRebuild) {
      if (addEditBreakdownRows.length > 0) return addEditBreakdownRows;
      if (viewAddRows.length > 0) return viewAddRows;
      if (savedAddBoxTableRows.length > 0) return savedAddBoxTableRows;
      return previewFromFormFields;
    }
    if (isAddEditPending) return viewAddRows;
    if (addBreakdownRows.length > 0) return addBreakdownRows;
    if (viewAddRows.length > 0) return viewAddRows;
    if (lockedAddRows.length > 0) return lockedAddRows;
    return previewFromFormFields;
  }, [
    gateEntryType,
    structureLocked,
    lockedAddRows,
    viewAddRows,
    isAddEditRebuild,
    addEditBreakdownRows,
    savedAddBoxTableRows,
    isAddEditPending,
    addBreakdownRows,
    previewFromFormFields,
  ]);

  const addTableTotalQty = useMemo(() => {
    const sumRows = (rows) => (rows || []).reduce((s, r) => s + (parseInt(r.qty, 10) || 0), 0);
    if (structureLocked) return sumRows(lockedAddRows);
    if (isAddEditRebuild) {
      if (addEditBreakdownRows.length > 0) return editAddTotalQty;
      return sumRows(viewAddRows) || sumRows(savedAddBoxTableRows);
    }
    if (isAddEditPending) return sumRows(viewAddRows);
    if (addBreakdownRows.length > 0) return addTotalQty;
    return sumRows(lockedAddRows) || addTotalQty;
  }, [
    structureLocked,
    lockedAddRows,
    viewAddRows,
    isAddEditRebuild,
    addEditBreakdownRows.length,
    editAddTotalQty,
    savedAddBoxTableRows,
    isAddEditPending,
    addBreakdownRows.length,
    addTotalQty,
  ]);

  const packingLikeForCards = useMemo(() => {
    if (gateEntryType === "add" && addTableRows.length > 0) {
      return summarizeAddBoxBreakup(addTableRows, addPerBoxInt || addTableRows[0]?.qty);
    }
    if (gateEntryType === "add" && addPerBoxInt >= 1) {
      const n = parseInt(String(addNumBoxes).trim(), 10);
      if (Number.isFinite(n) && n >= 1) {
        return summarizeAddBoxBreakup(
          Array.from({ length: n }, () => ({ is_loose: addAllBoxesLoose })),
          addPerBoxInt
        );
      }
    }
    return packingLike;
  }, [gateEntryType, addTableRows, addPerBoxInt, addNumBoxes, addAllBoxesLoose, packingLike]);

  const minusImpactQty = useMemo(() => {
    if (!packingPreview?.boxes?.length) return 0;
    let sum = 0;
    for (const b of packingPreview.boxes) {
      if (isMinusBoxUidSelected(minusSelectedUids, b.box_uid)) {
        sum += parseInt(b.qty, 10) || 0;
      }
    }
    return sum;
  }, [packingPreview, minusSelectedUids]);

  const isMinusFlow = gateEntryType === "minus";

  const minusCustomerLinesDisplay = useMemo(() => {
    if (!isMinusFlow) return [];
    const stored = parseMinusCustomerLinesFromRow(savedRow);
    if (stored.length) return stored;
    const grouped = groupSelectedMinusBoxesByCustomer(
      packingPreview?.boxes,
      minusSelectedUids,
      gatePackingNo.trim()
    );
    if (grouped.length) return grouped;
    return [];
  }, [
    isMinusFlow,
    savedRow,
    packingPreview?.boxes,
    minusSelectedUids,
    gatePackingNo,
  ]);

  const minusViewMode = isMinusFlow && readOnly;

  const loadUpdateBoxFromScan = useCallback(async (rawInput) => {
    const raw = normalizeScanInput(rawInput);
    if (!raw) {
      toast.warn("Scan or enter a box sticker (box_no_uid)");
      return;
    }
    const qrType = detectQrType(raw);
    if (qrType === "location") {
      toast.error("That looks like a location QR — scan a box sticker instead.");
      return;
    }
    setPackLoading(true);
    setIsUpdateScannerOpen(false);
    try {
      const { box_no_uid: scanNoUid, box_uid: scanUid } = parseStickerScan(raw);
      const code = scanNoUid || scanUid || extractBoxCode(raw) || parseBoxScanRaw(raw);
      if (!code) {
        toast.error("Invalid box sticker");
        return;
      }
      const res = await boxService.getViews({
        ...(scanNoUid ? { box_no_uid: scanNoUid } : {}),
        ...(scanUid ? { box_uid: scanUid } : {}),
        id: code,
        ...STOCK_ADJ_PERMS,
      });
      let box = pickBoxFromViewsResponse(res);
      // Soft fallback: list search when exact sticker lookup misses (prefix / partial codes).
      if (!box?.box_uid && !box?.id) {
        const searchRes = await boxService.getViews({
          search: code,
          page: 1,
          limit: 25,
          ...STOCK_ADJ_PERMS,
        });
        const rows = Array.isArray(searchRes?.data) ? searchRes.data : [];
        const codeLc = String(code).toLowerCase();
        box =
          rows.find((r) => String(r?.box_no_uid ?? "").toLowerCase() === codeLc) ||
          rows.find((r) => String(r?.box_uid ?? "") === String(code)) ||
          rows.find((r) => {
            const no = String(r?.box_no_uid ?? "").toLowerCase();
            return no.length > codeLc.length && no.endsWith(`_${codeLc}`);
          }) ||
          null;
      }
      if (!box?.box_uid && !box?.id) {
        toast.error(res?.reject_reason || `Box sticker not found: ${code}`);
        return;
      }
      const normalized = {
        ...box,
        box_uid: box.box_uid ?? box.id,
      };
      if (!isBoxInHand(normalized)) {
        toast.error(
          "Box is not in hand — it may be dispatched or already removed via stock adjustment."
        );
        return;
      }
      const currentQty = parseInt(String(normalized.qty ?? ""), 10);
      if (!Number.isFinite(currentQty) || currentQty < 0) {
        toast.error("Box has an invalid quantity");
        return;
      }

      const packingNo = String(normalized.packing_number ?? "").trim();
      // Same left-side packing/item cards as Add / Minus — load full packing context when possible.
      let previewPayload = {
        dailyprod: {
          itemdcode: normalized.itemdcode ?? normalized.item_dcode ?? normalized.prod_item_dcode,
          item_code: normalized.item_code ?? normalized.prod_item_code,
          item_desc:
            normalized.item_desc ??
            normalized.itemdesc ??
            normalized.prod_item_desc,
          acc_code: normalized.acc_code ?? normalized.override_cust ?? normalized.prod_acc_code,
          acc_name: normalized.acc_name,
        },
        boxes: [normalized],
      };
      if (packingNo) {
        try {
          const ctx = await loadPackingContext(packingNo, {
            forMinus: false,
            fetchBoxes: false,
            itemDcode: previewPayload.dailyprod.itemdcode,
          });
          if (ctx) {
            previewPayload = {
              ...ctx,
              boxes: [normalized],
              dailyprod: {
                ...ctx.dailyprod,
                ...previewPayload.dailyprod,
                itemdcode:
                  previewPayload.dailyprod.itemdcode ?? ctx.dailyprod?.itemdcode,
                item_code:
                  previewPayload.dailyprod.item_code ?? ctx.dailyprod?.item_code,
                item_desc:
                  previewPayload.dailyprod.item_desc ?? ctx.dailyprod?.item_desc,
                acc_code:
                  previewPayload.dailyprod.acc_code ?? ctx.dailyprod?.acc_code,
                acc_name:
                  previewPayload.dailyprod.acc_name ?? ctx.dailyprod?.acc_name,
                // Keep production totals / doc fields from packing meta (box scan omits them).
                total_qty: ctx.dailyprod?.total_qty ?? previewPayload.dailyprod.total_qty,
                job_card_no:
                  ctx.dailyprod?.job_card_no ?? previewPayload.dailyprod.job_card_no,
                doc_dt: ctx.dailyprod?.doc_dt ?? previewPayload.dailyprod.doc_dt,
                doc_no: ctx.dailyprod?.doc_no ?? previewPayload.dailyprod.doc_no,
                party_rate_cust_code:
                  ctx.dailyprod?.party_rate_cust_code ??
                  previewPayload.dailyprod.party_rate_cust_code,
              },
            };
          }
        } catch {
          /* keep box-only preview */
        }
      }

      const idForItem =
        previewPayload.dailyprod?.itemdcode ??
        normalized.itemdcode ??
        normalized.item_dcode ??
        normalized.prod_item_dcode;
      const im = await fetchItemMetaForStockDrawer(idForItem);

      setUpdateBox(normalized);
      setUpdateAction("minus");
      setUpdateQty("");
      setGatePackingNo(String(normalized.box_no_uid || code).trim());
      setPackingPreview(previewPayload);
      setItemMeta(im);
      setForm((prev) => ({
        ...prev,
        acc_code:
          previewPayload.dailyprod?.acc_code ??
          normalized.acc_code ??
          normalized.override_cust ??
          null,
        acc_name:
          previewPayload.dailyprod?.acc_name ?? normalized.acc_name ?? null,
        party_rate_cust_code:
          previewPayload.dailyprod?.party_rate_cust_code ?? null,
      }));
      setCategoryOptions([]);
      setSelectedCategoryId("");
      setMinusSelectedUids(new Set());
      setGatePassed(true);
      setMobileBreakdownTab("details");
      if (updateScanInputRef.current) updateScanInputRef.current.value = "";
    } catch (err) {
      toast.error(err?.message || "Load failed");
    } finally {
      setPackLoading(false);
    }
  }, []);

  loadUpdateBoxFromScanRef.current = loadUpdateBoxFromScan;

  const handleUpdateStickerEnter = useCallback((code) => {
    void loadUpdateBoxFromScanRef.current(code);
  }, []);

  const handleUpdateLaserScan = useCallback((code) => {
    void loadUpdateBoxFromScanRef.current(code);
  }, []);

  const handleUpdateCameraDecoded = useCallback((decodedText) => {
    setIsUpdateScannerOpen(false);
    void loadUpdateBoxFromScanRef.current(decodedText);
  }, []);

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: open && isUpdateScannerOpen && gateEntryType === "update" && !gatePassed,
    elementId: SA_UPDATE_STICKER_SCANNER_ID,
    onDecoded: handleUpdateCameraDecoded,
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: () => {
      toast.error("Camera unavailable — allow camera access or type the sticker.");
      setIsUpdateScannerOpen(false);
    },
  });

  const startUpdateCameraScanner = useCallback(() => {
    void (async () => {
      const prep = await prepareQrScanSession();
      if (!prep.cameraOk) {
        toast.error(
          prep.cameraDenied
            ? "Camera permission denied — enable it in browser settings."
            : "Camera unavailable on this device."
        );
        return;
      }
      setIsUpdateScannerOpen(true);
    })();
  }, []);

  const updateStickerScanGate = !structureLocked && gateEntryType === "update" && !gatePassed ? (
    <div className="min-w-0 w-full sm:flex-1 sm:min-w-[280px] sm:max-w-xl space-y-1.5">
      <label className={FIELD_LABEL}>Box sticker (scan / type box_no_uid)</label>
      <div className="space-y-1.5 w-full min-w-0">
        {(showPhoneQr || showUpdateLaserUi) ? (
          <div className="flex items-stretch gap-1.5 w-full min-w-0">
            {showPhoneQr ? (
              <button
                type="button"
                onClick={startUpdateCameraScanner}
                disabled={packLoading || isUpdateScannerOpen}
                className={`h-8 lg:h-9 px-2.5 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${updateScanBtnFill}`}
                title="Open camera scanner"
              >
                <QrCode size={14} />
                <span className="text-[9px] font-black uppercase">QR</span>
              </button>
            ) : null}
            {showUpdateLaserUi ? (
              <LaserScanField
                active={open && gateEntryType === "update" && !gatePassed && showUpdateLaserUi}
                onScanned={handleUpdateLaserScan}
                keyboardInputRef={updateScanInputRef}
                formatPreview={boxNoUidDisplayLabel}
                compact
                heightClass="h-8 lg:h-9"
                fill={updateScanBtnCount > 0}
              />
            ) : null}
          </div>
        ) : null}
        {keyboardType ? (
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <div
              className={`flex flex-1 min-w-0 items-center gap-2 h-8 lg:h-9 px-2.5 ${OK_INPUT} border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-50/80 rounded-lg`}
            >
              <ScanLine className="shrink-0 text-indigo-400 pointer-events-none" size={14} />
              <ScanEnterInput
                ref={updateScanInputRef}
                onEnter={handleUpdateStickerEnter}
                placeholder={getScanInputPlaceholder() || "Type or scan box_no_uid"}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[10px] font-mono text-slate-700 placeholder:text-slate-400 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const code = String(updateScanInputRef.current?.value ?? "").trim();
                if (!code) {
                  toast.warn("Scan or enter a box sticker");
                  return;
                }
                void loadUpdateBoxFromScan(code);
              }}
              disabled={packLoading}
              className="h-8 lg:h-9 shrink-0 px-3 rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase shadow-sm hover:bg-indigo-700 disabled:opacity-55 inline-flex items-center justify-center gap-1.5"
            >
              {packLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Load
            </button>
          </div>
        ) : !showPhoneQr && !showUpdateLaserUi ? (
          <p className="text-[9px] text-slate-500 py-1">
            Enable Laser scanner or Keyboard type in Settings to scan stickers.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => {
              const code = String(updateScanInputRef.current?.value ?? "").trim();
              if (!code) {
                toast.warn("Scan a box sticker with QR or laser");
                return;
              }
              void loadUpdateBoxFromScan(code);
            }}
            disabled={packLoading}
            className="h-8 w-full rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase shadow-sm hover:bg-indigo-700 disabled:opacity-55 inline-flex items-center justify-center gap-1.5"
          >
            {packLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Load
          </button>
        )}
      </div>
    </div>
  ) : null;

  const handleGateLoad = async () => {
    if (!gateEntryType) {
      toast.warn("Select type — Add, Minus, or Update");
      return;
    }

    if (gateEntryType === "update") {
      const raw =
        String(updateScanInputRef.current?.value ?? "").trim() ||
        gatePackingNo.trim();
      await loadUpdateBoxFromScan(raw);
      return;
    }

    if (gateEntryType === "add") {
      const fy = gateFinancialYear.trim();
      if (!fy) {
        toast.warn("Select financial year from the list");
        return;
      }
    }
    const pn = gatePackingNo.trim();
    if (!pn) {
      toast.warn("Enter packing number");
      return;
    }
    setPackLoading(true);
    try {
      let imsRes = null;
      let fySelected = "";
      if (gateEntryType === "add") {
        fySelected = gateFinancialYear.trim();
        imsRes = await masterService.getPackByFinancialYearDoc({
          financial_year: fySelected,
          doc_no: pn,
          packing_number: pn,
          permission_module: "stock_adjustment",
          permission_action: "view",
        });
        let recs = Array.isArray(imsRes?.records) ? [...imsRes.records] : [];
        recs = recs.filter((r) => !r.doc_dt || rowInIndianFinancialYear(r, fySelected));
        if (!imsRes?.success || recs.length < 1) {
          const msg = imsRes?.message || "No pack data in IMS for this financial year and packing number.";
          if (imsRes?.soft_message === true) {
            toast.info(msg);
          } else {
            toast.error(msg);
          }
          return;
        }
        imsRes = { ...imsRes, records: recs };
      }

      let prefillMeta = null;
      if (gateEntryType === "add" && imsRes?.records?.length) {
        const first = imsRes.records[0];
        prefillMeta = {
          itemdcode: first.itemdcode ?? first.ItemDcode ?? null,
          acc_code: first.acc_code ?? null,
          acc_name: first.acc_name ?? null,
          item_code: first.item_code ?? null,
          item_desc: first.itemdesc ?? first.item_desc ?? null,
          job_card_no: first.jobcardno ?? first.job_card_no ?? null,
          total_qty: first.QTY != null ? String(first.QTY) : null,
          doc_dt: first.doc_dt || first.docdt || null,
          doc_no: first.docno != null ? String(first.docno) : pn,
          party_rate_cust_code:
            imsRes.party_rate_cust_code != null &&
            String(imsRes.party_rate_cust_code).trim() !== ""
              ? String(imsRes.party_rate_cust_code).trim()
              : null,
          standard_qty_per_box: parseOptionalStandardQtyPerBox(imsRes.standard_qty_per_box),
        };
      }

      const data = await loadPackingContext(pn, {
        forMinus: gateEntryType === "minus",
        financialYear: fySelected || undefined,
        prefillMeta,
        fetchBoxes: gateEntryType === "minus",
      });
      if (!data) {
        toast.error("Load failed");
        return;
      }

      let previewPayload;
      if (gateEntryType === "add") {
        if (data.dailyprod?.itemdcode == null) {
          toast.error("IMS pack row is missing an item code.");
          return;
        }
        previewPayload = data;
      } else {
        if (!data.boxes || data.boxes.length === 0) {
          toast.error("No in-hand boxes in inventory for this packing number");
          return;
        }
        previewPayload = data;
      }

      const idForItem = previewPayload.dailyprod?.itemdcode ?? previewPayload.stickerRow?.itemdcode;
      const im = await fetchItemMetaForStockDrawer(idForItem);

      if (previewPayload.dailyprod) {
        const dp = previewPayload.dailyprod;
        setForm((prev) => ({
          ...prev,
          acc_code: dp.acc_code ?? null,
          acc_name: dp.acc_name ?? null,
          party_rate_cust_code: dp.party_rate_cust_code ?? null,
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          acc_code: null,
          acc_name: null,
          party_rate_cust_code: null,
        }));
      }

      setPackingPreview(previewPayload);
      setItemMeta(im);
      setUpdateBox(null);
      setUpdateAction("minus");
      setUpdateQty("");
      if (gateEntryType === "add") {
        await loadCategoriesForItem();
      } else {
        setCategoryOptions([]);
        setSelectedCategoryId("");
      }
      setGatePassed(true);
      setMinusSelectedUids(new Set());
      setMobileBreakdownTab("details");
    } catch (err) {
      toast.error(err?.message || "Load failed");
      } finally {
      setPackLoading(false);
    }
  };

  const toggleMinusBox = useCallback(
    (boxUid) => {
      if (!canRemoveStickerBoxes) {
        toast.error("You do not have permission to remove boxes from inventory.");
        return;
      }
      const key = String(boxUid);
      setMinusSelectedUids((prev) => {
        const n = new Set(prev);
        if (n.has(key)) n.delete(key);
        else n.add(key);
        return n;
      });
    },
    [canRemoveStickerBoxes]
  );

  const handleInputChange = (k, value) => {
    setForm((prev) => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const handleCustomerChange = useCallback(
    (accCode, ledgerObj) => {
      if (!accCode) return;
      if (String(accCode) === String(form.acc_code || "")) return;

      // 1. Update name and code IMMEDIATELY (synchronously)
      const newName = ledgerObj?.acc_name || "";
      setForm((prev) => ({
        ...prev,
        acc_code: accCode,
        acc_name: newName,
      }));

      // 2. Resolve party rate / narration in the background
      void (async () => {
        setCustomerChanging(true);
        try {
          const itemDcode = selectedRowLike.itemdcode;
          const itemCode = selectedRowLike.item_code;

          let party_rate_cust_code = null;
          try {
            const res = await masterService.resolvePartyRateCustCode({
              acc_code: accCode,
              itemdcode: itemDcode,
              item_code: itemCode,
            });
            if (res?.success && res.party_rate_cust_code?.trim()) {
              party_rate_cust_code = res.party_rate_cust_code.trim();
            }
          } catch {
            /* no narr1 */
          }

          setForm((prev) => ({
            ...prev,
            party_rate_cust_code,
          }));
        } catch {
          // silent fail for narration
        } finally {
          setCustomerChanging(false);
        }
      })();
    },
    [form.acc_code, selectedRowLike.itemdcode, selectedRowLike.item_code]
  );

  const validate = () => {
    const e = {};
    if (gateEntryType === "add") {
      const pb = parseInt(String(addPerBoxQty).trim(), 10);
      if (!Number.isFinite(pb) || pb < 1) e.addPerBoxQty = "Per box qty ≥ 1";
      if (!selectedCategoryId) e.category = "Select packing category";
      if (isAddEditRebuild) {
        const extra = parseInt(String(addExtraBoxes).trim(), 10);
        if (!Number.isFinite(extra) || extra < 0) e.addExtraBoxes = "Add more must be 0 or more";
        const kept = savedAddBoxRows.filter(
          (r) => r.box_uid != null && !addRemoveUids.has(String(r.box_uid))
        ).length;
        if (kept + (Number.isFinite(extra) ? extra : 0) < 1) {
          e.addExtraBoxes = "Keep or add at least one box";
        }
      } else if (isAddEdit) {
        const nb = parseInt(String(addNumBoxes).trim(), 10);
        if (!Number.isFinite(nb) || nb < 1) e.addNumBoxes = "Total boxes ≥ 1";
      } else {
        const nb = parseInt(String(addNumBoxes).trim(), 10);
        if (!Number.isFinite(nb) || nb < 1) e.addNumBoxes = "No of boxes ≥ 1";
      }
    }
    if (gateEntryType === "minus") {
      if (minusSelectedUids.size < 1) {
        e.minusBoxes = "Select at least one box (minus)";
      } else {
        const adjId = editData?.adjustment_id ?? savedRow?.adjustment_id ?? null;
        const savedPlanSet = normalizeMinusSelectedUidSet(
          parseRemovedBoxUids(savedRow ?? editData ?? {})
        );
        const hasInvalid = [...minusSelectedUids].some((uid) => {
          const box = packingPreview?.boxes?.find((b) =>
            isMinusBoxUidSelected(new Set([uid]), b.box_uid)
          );
          if (!box) {
            return !(isEdit && isMinusBoxUidSelected(savedPlanSet, uid));
          }
          return !isBoxAvailableForMinus(box, { adjustmentId: adjId });
        });
        if (hasInvalid) {
          e.minusBoxes = "Some ticked boxes are outward or unavailable — uncheck them";
        }
      }
    }
    if (gateEntryType === "update") {
      if (!updateBox?.box_uid) e.updateAction = "Scan a box sticker first";
      if (updateAction !== "add" && updateAction !== "minus") {
        e.updateAction = "Select Add or Minus";
      }
      const uq = parseInt(String(updateQty).trim(), 10);
      if (!Number.isFinite(uq) || uq < 1) {
        e.updateQty = "Enter a positive quantity";
      } else if (updateAction === "minus") {
        const current = parseInt(String(updateBox?.qty ?? ""), 10);
        if (Number.isFinite(current) && current - uq < 0) {
          e.updateQty = `Cannot go below 0 (current ${current})`;
        }
      }
    }
    return e;
  };

  const handleSave = async () => {
    if (readOnly) return;
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error("Please fix the highlighted fields before saving.");
      focusFirstError(e, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;

    const wantsBoxRemoval =
      (gateEntryType === "minus" && minusSelectedUids.size > 0) ||
      (gateEntryType === "add" && isAddEditRebuild && addRemoveUids.size > 0);
    if (wantsBoxRemoval && !canRemoveStickerBoxes) {
      toast.error("You do not have permission to remove boxes from inventory.");
      return;
    }

    setLoading(true);
    try {
      const remarksForApi = (form.remarks && String(form.remarks).trim()) || "";

      if (isEdit && editData?.adjustment_id) {
        const wasApproved = !!(savedRow?.approved ?? editData?.approved);
        const payload = {
          remarks: remarksForApi,
          approved: false,
        };

        if (gateEntryType === "add") {
          const pb = parseInt(String(addPerBoxQty).trim(), 10);
          payload.per_box_qty = pb;
          payload.acc_code = form.acc_code;
          if (form.acc_name != null && String(form.acc_name).trim() !== "") {
            payload.acc_name = String(form.acc_name).trim();
          }
          payload.category_id = Number(selectedCategoryId);
          if (isAddEditRebuild) {
            payload.add_extra_boxes = parseInt(String(addExtraBoxes).trim(), 10) || 0;
            payload.remove_add_box_uids = [...addRemoveUids]
              .map((u) => parseInt(u, 10))
              .filter((n) => Number.isFinite(n));
          } else {
            const nb = parseInt(String(addNumBoxes).trim(), 10);
            payload.box_count_impact = nb;
            payload.no_of_boxes = nb;
          }
        } else if (gateEntryType === "minus") {
          payload.acc_code = resolveMinusAccCode(form, packingPreview, minusSelectedUids);
          payload.removed_box_uids = [...minusSelectedUids]
            .map((u) => parseInt(u, 10))
            .filter((n) => Number.isFinite(n));
        } else if (gateEntryType === "update") {
          payload.box_uid = Number(updateBox.box_uid);
          payload.update_action = updateAction;
          payload.update_qty = parseInt(String(updateQty).trim(), 10);
        }

        await stockAdjustmentService.update(editData.adjustment_id, payload);
        toast.success(
          wasApproved
            ? "Saved — status set to pending; Approve again to apply box changes"
            : gateEntryType === "update"
              ? "Saved — Approve to apply qty change to the box"
              : "Saved — Approve to create boxes and reflect in inventory"
        );
        onSuccess?.();
        onClose?.();
        return;
      }

      if (gateEntryType === "add") {
        const nb = parseInt(String(addNumBoxes).trim(), 10);
        const pb = parseInt(String(addPerBoxQty).trim(), 10);
        await stockAdjustmentService.create({
          entry_type: "add",
          packing_number: saPackingNo || gatePackingNo.trim(),
          financial_year: gateFinancialYear.trim(),
          per_box_qty: pb,
          box_count_impact: nb,
          no_of_boxes: nb,
          ...(showApproval && form.approved === true ? { all_boxes_loose: addAllBoxesLoose } : {}),
          unit: "PCS",
          remarks: remarksForApi,
          acc_code: form.acc_code,
          ...(form.acc_name != null && String(form.acc_name).trim() !== ""
            ? { acc_name: String(form.acc_name).trim() }
            : {}),
          category_id: Number(selectedCategoryId),
          approved: showApproval && form.approved === true,
        });
      } else if (gateEntryType === "minus") {
        const uids = [...minusSelectedUids].map((u) => parseInt(u, 10)).filter((n) => Number.isFinite(n));
        await stockAdjustmentService.create({
          entry_type: "minus",
          packing_number: gatePackingNo.trim(),
          removed_box_uids: uids,
          unit: "PCS",
          remarks: remarksForApi,
          acc_code: resolveMinusAccCode(form, packingPreview, minusSelectedUids),
          approved: showApproval && form.approved === true,
        });
      } else if (gateEntryType === "update") {
        await stockAdjustmentService.create({
          entry_type: "update",
          box_uid: Number(updateBox.box_uid),
          update_action: updateAction,
          update_qty: parseInt(String(updateQty).trim(), 10),
          unit: "PCS",
          remarks: remarksForApi,
          acc_code: form.acc_code,
          approved: showApproval && form.approved === true,
        });
      }
      toast.success(
        showApproval && form.approved
          ? gateEntryType === "update"
            ? "Stock adjustment saved and approved — box qty updated."
            : "Stock adjustment saved and approved — boxes are in inventory."
          : gateEntryType === "update"
            ? "Stock adjustment saved — use Approve to apply the qty change."
            : "Stock adjustment saved — use Approve to create boxes in inventory."
      );
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const previewSigned =
    gateEntryType === "add"
      ? isAddEditRebuild
        ? editAddTotalQty
        : addTotalQty
      : gateEntryType === "minus"
        ? -minusImpactQty
        : gateEntryType === "update"
          ? (() => {
              const uq = parseInt(String(updateQty).trim(), 10);
              if (!Number.isFinite(uq) || uq < 1) return 0;
              return updateAction === "minus" ? -uq : uq;
            })()
          : 0;

  const toolbarActionButtons = (
    <>
      {gatePassed && !readOnly && !isEdit ? (
        <button
          type="button"
          onClick={() => {
            setGatePassed(false);
            setPackingPreview(null);
            setItemMeta(null);
            setMinusSelectedUids(new Set());
            setUpdateBox(null);
            setUpdateAction("minus");
            setUpdateQty("");
            setIsUpdateScannerOpen(false);
            setMobileBreakdownTab("details");
          }}
          className="col-span-2 h-8 lg:h-9 w-full rounded-lg text-[9px] lg:text-[10px] font-black uppercase border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 px-3 transition-all sm:col-span-1 sm:w-auto"
        >
          Reset
        </button>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="h-8 lg:h-9 w-full inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-slate-50 px-3 lg:px-4 transition-all disabled:opacity-50 sm:w-auto"
      >
        Cancel
      </button>

      {gatePassed && !readOnly && !(isEdit && structureLocked) ? (
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="h-8 lg:h-9 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-white text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-black disabled:bg-slate-400 px-3 lg:px-4 transition-all sm:w-auto"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin shrink-0" aria-hidden />
          ) : (
            <Check className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" aria-hidden />
          )}
          {isEdit ? "Update" : "Save"}
        </button>
      ) : null}

      {gatePassed && isApprove ? (
        <button
          type="button"
          onClick={handleApprove}
          disabled={loading || !!(savedRow?.approved ?? editData?.approved)}
          className="col-span-2 h-8 lg:h-9 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-emerald-700 disabled:opacity-50 px-3 lg:px-4 transition-all sm:col-span-1 sm:w-auto"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin shrink-0" aria-hidden />
          ) : (
            <Shield className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" aria-hidden />
          )}
          Approve
        </button>
      ) : null}

      {readOnly && gatePassed && !isApprove ? (
        <button
          type="button"
          onClick={onClose}
          className="col-span-2 h-8 lg:h-9 w-full inline-flex items-center justify-center rounded-lg bg-slate-700 text-white text-[9px] lg:text-[10px] font-black uppercase shadow-sm hover:bg-slate-900 px-3 lg:px-4 transition-all sm:col-span-1 sm:w-auto"
        >
          Close
        </button>
      ) : null}
    </>
  );

  const topToolbar = (
    <>
    {/* Phone: compact gate or action bar only */}
    <div className="lg:hidden shrink-0 bg-white border-b border-slate-200 z-20 w-full min-w-0">
      <div className="px-2 py-1.5 w-full min-w-0">
        {!gatePassed ? (
          <div className="grid grid-cols-2 gap-2 w-full min-w-0">
            <div className="min-w-0 col-span-1">
              <label htmlFor="sa-gate-type-m" className={FIELD_LABEL}>Type</label>
              <select
                id="sa-gate-type-m"
                value={gateEntryType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setGateEntryType(nextType);
                  setGatePassed(false);
                  setPackingPreview(null);
                  setUpdateBox(null);
                  setUpdateAction("minus");
                  setUpdateQty("");
                  setIsUpdateScannerOpen(false);
                  setGateFinancialYear(nextType === "add" ? defaultFinancialYear() : "");
                }}
                disabled={structureLocked}
                className={FIELD_CONTROL}
              >
                <option value="">Select…</option>
                {GATE_ADD_MINUS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {gateEntryType === "add" ? (
              <div className="min-w-0 col-span-1">
                <label htmlFor="sa-gate-fy-m" className={FIELD_LABEL}>FY</label>
                <select
                  id="sa-gate-fy-m"
                  value={gateFinancialYear}
                  onChange={(e) => setGateFinancialYear(e.target.value)}
                  disabled={structureLocked}
                  className={FIELD_CONTROL}
                >
                  <option value="">Select…</option>
                  {getFinancialYearOptions().map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {gateEntryType === "update" ? (
              <div className="min-w-0 col-span-2">{updateStickerScanGate}</div>
            ) : (
              <>
            <div className="min-w-0 col-span-2">
              <label htmlFor="sa-gate-pack-m" className={FIELD_LABEL}>
                Packing
              </label>
              <input
                id="sa-gate-pack-m"
                type="text"
                value={gatePackingNo}
                onChange={(e) => setGatePackingNo(e.target.value)}
                disabled={structureLocked}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !structureLocked) {
                    e.preventDefault();
                    handleGateLoad();
                  }
                }}
                placeholder="Packing no."
                className={FIELD_CONTROL}
                autoComplete="off"
              />
            </div>
            {!structureLocked ? (
              <button
                type="button"
                onClick={handleGateLoad}
                disabled={packLoading}
                className="col-span-2 h-8 w-full rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase shadow-sm hover:bg-indigo-700 disabled:opacity-55 inline-flex items-center justify-center gap-1.5 border border-indigo-700/20"
              >
                {packLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden /> : null}
                Load
              </button>
            ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 w-full">{toolbarActionButtons}</div>
        )}
      </div>
    </div>

    {/* Desktop: full toolbar */}
    <div className="hidden lg:block shrink-0 bg-white border-b border-slate-200 shadow-sm z-20 w-full max-w-full min-w-0">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 max-w-[1800px] mx-auto w-full min-w-0">
        <div className="flex flex-col gap-3 w-full min-w-0 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="grid w-full min-w-0 grid-cols-1 gap-3 max-lg:gap-2.5 sm:grid-cols-2 sm:flex sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-3 flex-1">
            <div className="min-w-0 w-full sm:w-[148px]">
              <label htmlFor="sa-gate-type" className={FIELD_LABEL}>
                Type
              </label>
              <select
                id="sa-gate-type"
                value={gateEntryType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setGateEntryType(nextType);
                  setGatePassed(false);
                  setPackingPreview(null);
                  setUpdateBox(null);
                  setUpdateAction("minus");
                  setUpdateQty("");
                  setIsUpdateScannerOpen(false);
                  setGateFinancialYear(nextType === "add" ? defaultFinancialYear() : "");
                }}
                disabled={gatePassed || structureLocked}
                className={FIELD_CONTROL}
              >
                <option value="">Select…</option>
                {GATE_ADD_MINUS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {gateEntryType === "add" && (
              <div className="min-w-0 w-full sm:w-[158px]">
                <label htmlFor="sa-gate-fy" className={FIELD_LABEL}>
                  Financial year
                </label>
                <select
                  id="sa-gate-fy"
                  value={gateFinancialYear}
                  onChange={(e) => setGateFinancialYear(e.target.value)}
                  disabled={gatePassed || structureLocked}
                  className={FIELD_CONTROL}
                >
                  <option value="">Select…</option>
                  {getFinancialYearOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {gateEntryType === "update" ? (
              updateStickerScanGate
            ) : (
              <>
            <div className="min-w-0 w-full sm:flex-1 sm:min-w-[200px] sm:max-w-lg">
              <label htmlFor="sa-gate-pack" className={FIELD_LABEL}>
                Packing number
              </label>
              <input
                id="sa-gate-pack"
                type="text"
                value={gatePackingNo}
                onChange={(e) => setGatePackingNo(e.target.value)}
                disabled={gatePassed || structureLocked}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !structureLocked) {
                    e.preventDefault();
                    handleGateLoad();
                  }
                }}
                placeholder="e.g. 30819"
                className={FIELD_CONTROL}
                autoComplete="off"
              />
            </div>
            {!gatePassed && !structureLocked && (
              <button
                type="button"
                onClick={handleGateLoad}
                disabled={packLoading}
                className="h-9 w-full px-4 shrink-0 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide shadow-sm hover:bg-indigo-700 disabled:opacity-55 inline-flex items-center justify-center gap-2 sm:w-auto border border-indigo-700/20"
              >
                {packLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
                Load
              </button>
            )}
              </>
            )}
          </div>

          <div className="w-full shrink-0 lg:w-auto">
            <div className="grid w-full grid-cols-2 gap-1.5 rounded-xl bg-slate-50/90 p-1 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-1">
              {toolbarActionButtons}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );

  const inputsTopRowHints = (
    <>
      {isApprove ? (
        <p className="mx-3 mt-2 sm:mx-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-900">
          {gateEntryType === "update" ? (
            <>
              Review the box qty change below, then click <span className="font-black">Approve</span>. Qty is applied only on approve. To change values, close and use <span className="font-black">Edit</span> first.
            </>
          ) : (
            <>
              Review packing and boxes below, then click <span className="font-black">Approve</span>. Add creates boxes in inventory; minus removes selected boxes. To change counts, close this screen and use <span className="font-black">Edit</span> first.
            </>
          )}
        </p>
      ) : null}
      {editingWasApproved ? (
        <p className="mx-3 mt-2 sm:mx-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-900">
          This adjustment is <span className="font-black">Approved</span>. After you save, status becomes{" "}
          <span className="font-black">Pending</span> — use <span className="font-black">Approve</span> again to apply box changes to inventory.
        </p>
      ) : null}
      {isAddEditRebuild ? (
        <p className="mx-3 mt-2 sm:mx-4 text-[10px] text-slate-500">
          Select <span className="font-semibold">Remove</span> on saved rows, then use <span className="font-semibold">Add more</span> for extra boxes. On approve, removed boxes are deleted and the new total is created (new stickers).
        </p>
      ) : isAddEdit ? (
        <p className="mx-3 mt-2 sm:mx-4 text-[10px] text-slate-500">
          Set total boxes and per-box qty. Boxes and stickers are created only after Approve.
        </p>
      ) : isEdit && gateEntryType === "minus" && !structureLocked ? (
        <p className="mx-3 mt-2 sm:mx-4 text-[10px] text-slate-500">
          All packing boxes are listed. Select rows to remove. Unavailable rows are dispatched or already removed. Changes apply after approve.
        </p>
      ) : gateEntryType === "update" && gatePassed && !structureLocked ? (
        <p className="mx-3 mt-2 sm:mx-4 text-[10px] text-slate-500">
          One box at a time. Choose Add or Minus, enter qty, then Save. Inventory qty changes only after Approve.
        </p>
      ) : null}
    </>
  );

  const updateProjectedQty = useMemo(() => {
    if (gateEntryType !== "update" || !updateBox) return null;
    // Approved view/approve: show applied result — do not add the delta again on live qty.
    if ((isView || isApprove) && savedRow?.approved) {
      const plan =
        savedRow.qty_update_plan || parseQtyUpdatePayload(savedRow.removed_box_ids);
      if (plan?.applied_to_qty != null && Number.isFinite(Number(plan.applied_to_qty))) {
        return Number(plan.applied_to_qty);
      }
      const live = parseInt(String(updateBox.qty ?? ""), 10);
      return Number.isFinite(live) ? live : null;
    }
    return projectedQtyAfterUpdate(updateBox.qty, updateAction, updateQty);
  }, [gateEntryType, updateBox, updateAction, updateQty, isView, isApprove, savedRow]);

  const updateBreakdownForCards = useMemo(() => {
    if (gateEntryType !== "update" || !updateBox) return null;
    const current = parseInt(String(updateBox.qty ?? ""), 10);
    const uq = parseInt(String(updateQty ?? "").trim(), 10);
    return {
      currentQty: Number.isFinite(current) ? current : 0,
      action: updateAction === "minus" ? "minus" : "add",
      updateQty: Number.isFinite(uq) && uq > 0 ? uq : null,
      projectedQty: updateProjectedQty,
    };
  }, [gateEntryType, updateBox, updateAction, updateQty, updateProjectedQty]);

  const updateFieldsBlock = gateEntryType === "update" ? (
    <>
      <div className="flex flex-col justify-start min-w-0 max-lg:col-span-1 lg:col-span-3">
        <span className={FIELD_LABEL_ROW}>
          <Package className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
          Box sticker
        </span>
        <div className={READOUT_BOX}>
          <p className="text-[11px] font-mono font-bold text-slate-900 leading-tight truncate">
            {updateBox?.box_no_uid || gatePackingNo.trim() || "—"}
          </p>
          <p className="text-[9px] font-semibold text-slate-500 mt-0.5 truncate">
            Packing {updateBox?.packing_number || "—"}
          </p>
        </div>
      </div>
      <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
        <span className={FIELD_LABEL}>Current qty</span>
        <div className={READOUT_BOX}>
          <p className="text-[14px] font-black text-slate-900 tabular-nums leading-tight">
            {updateBox?.qty != null ? Number(updateBox.qty).toLocaleString() : "—"}
          </p>
          <p className="text-[9px] font-semibold text-slate-500 mt-0.5">PCS (read-only)</p>
        </div>
      </div>
      <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2" data-field="updateAction">
        <span className={FIELD_LABEL}>
          Action <span className="text-rose-500">*</span>
        </span>
        <div className="flex h-8 lg:h-9 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
          {[
            { value: "add", label: "Add (+)" },
            { value: "minus", label: "Minus (-)" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={structureLocked}
              onClick={() => {
                if (structureLocked) return;
                setUpdateAction(opt.value);
                if (errors.updateAction) setErrors((prev) => ({ ...prev, updateAction: "" }));
                if (errors.updateQty) setErrors((prev) => ({ ...prev, updateQty: "" }));
              }}
              className={`flex-1 text-[10px] font-black uppercase transition ${
                updateAction === opt.value
                  ? opt.value === "minus"
                    ? "bg-rose-600 text-white"
                    : "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              } disabled:opacity-70`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
        <label htmlFor="sa-update-qty" className={FIELD_LABEL}>
          Qty to {updateAction === "minus" ? "minus" : "add"} <span className="text-rose-500">*</span>
        </label>
        <input
          data-field="updateQty"
          id="sa-update-qty"
          type="number"
          min={1}
          value={updateQty}
          disabled={structureLocked}
          onChange={(e) => {
            setUpdateQty(e.target.value);
            if (errors.updateQty) setErrors((prev) => ({ ...prev, updateQty: "" }));
          }}
          placeholder="e.g. 5"
          className={`${FIELD_CONTROL} ${errors.updateQty ? FIELD_CONTROL_ERR : ""}`}
        />
      </div>
      <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
        <span className={FIELD_LABEL}>New qty (preview)</span>
        <div className={updateAction === "minus" ? READOUT_BOX_MINUS : READOUT_BOX}>
          <p
            className={`text-[14px] font-black tabular-nums leading-tight ${
              updateProjectedQty != null && updateProjectedQty < 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {updateProjectedQty == null ? "—" : updateProjectedQty.toLocaleString()}
          </p>
          <p className="text-[9px] font-semibold text-slate-500 mt-0.5">After approve</p>
        </div>
      </div>
    </>
  ) : null;

  const inputsTopRowFields = (
      <div className="max-w-[1800px] mx-auto w-full min-w-0 px-3 py-2 lg:py-2.5 sm:px-4 sm:py-3 max-lg:px-2 max-lg:py-2">
        <div className="grid w-full min-w-0 grid-cols-1 max-lg:grid-cols-3 sm:grid-cols-2 lg:grid-cols-12 gap-2 max-lg:gap-2 lg:gap-3 items-end">
          {updateFieldsBlock}
          {gateEntryType !== "update" ? (
          <>
          <div className="flex flex-col justify-start min-w-0 max-lg:col-span-1 lg:col-span-2">
            <span className={FIELD_LABEL_ROW}>
              <Package className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
              Packing
            </span>
            <div className={READOUT_BOX}>
              <p className="text-[11px] font-mono font-bold text-slate-900 leading-tight truncate tabular-nums">{gatePackingNo.trim() || "—"}</p>
              {gateEntryType === "add" ? (
                <p className="text-[9px] font-semibold text-slate-500 mt-0.5 truncate">FY {gateFinancialYear.trim() || "—"}</p>
              ) : null}
            </div>
          </div>

          {gateEntryType === "add" ? (
            isAddEditRebuild ? (
            <>
              <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
                <span className={FIELD_LABEL}>Saved in DB</span>
                <div className={READOUT_BOX}>
                  <p className="text-[11px] font-bold text-slate-900 tabular-nums leading-tight">
                    {savedAddBoxRows.length} box{savedAddBoxRows.length === 1 ? "" : "es"}
                  </p>
                  {addRemoveUids.size > 0 ? (
                    <p className="text-[9px] font-semibold text-rose-600 mt-0.5">−{addRemoveUids.size} to remove</p>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
                <label htmlFor="sa-add-extra" className={FIELD_LABEL}>
                  Add more <span className="text-rose-500">*</span>
                </label>
                <input
                  data-field="addExtraBoxes"
                  id="sa-add-extra"
                  type="number"
                  min={0}
                  value={addExtraBoxes}
                  onChange={(e) => {
                    setAddExtraBoxes(e.target.value);
                    if (errors.addExtraBoxes) setErrors((prev) => ({ ...prev, addExtraBoxes: "" }));
                  }}
                  placeholder="0"
                  className={`${FIELD_CONTROL} ${errors.addExtraBoxes ? FIELD_CONTROL_ERR : ""}`}
                />
              </div>
              <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
                <label htmlFor="sa-add-perbox-edit" className={FIELD_LABEL}>
                  Per box <span className="text-rose-500">*</span>
                </label>
                <input
                  data-field="addPerBoxQty"
                  id="sa-add-perbox-edit"
                  type="number"
                  min={1}
                  value={addPerBoxQty}
                  onChange={(e) => {
                    setAddPerBoxQty(e.target.value);
                    if (errors.addPerBoxQty) setErrors((prev) => ({ ...prev, addPerBoxQty: "" }));
                  }}
                  placeholder="100"
                  className={`${FIELD_CONTROL} ${errors.addPerBoxQty ? FIELD_CONTROL_ERR : ""}`}
                />
              </div>
            </>
            ) : (
            <>
              <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
                <label htmlFor="sa-add-boxes" className={FIELD_LABEL}>
                  Boxes <span className="text-rose-500">*</span>
                </label>
                <input
                  data-field="addNumBoxes"
                  id="sa-add-boxes"
                  type="number"
                  min={1}
                  value={addNumBoxes}
                  onChange={(e) => {
                    setAddNumBoxes(e.target.value);
                    if (errors.addNumBoxes) setErrors((prev) => ({ ...prev, addNumBoxes: "" }));
                  }}
                  placeholder="5"
                  disabled={structureLocked}
                  className={`${FIELD_CONTROL} ${errors.addNumBoxes ? FIELD_CONTROL_ERR : ""}`}
                />
              </div>
              <div className="min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
                <label htmlFor="sa-add-perbox" className={FIELD_LABEL}>
                  Per box <span className="text-rose-500">*</span>
                </label>
                <input
                  data-field="addPerBoxQty"
                  id="sa-add-perbox"
                  type="number"
                  min={1}
                  value={addPerBoxQty}
                  onChange={(e) => {
                    setAddPerBoxQty(e.target.value);
                    if (errors.addPerBoxQty) setErrors((prev) => ({ ...prev, addPerBoxQty: "" }));
                  }}
                  placeholder="100"
                  disabled={structureLocked}
                  className={`${FIELD_CONTROL} ${errors.addPerBoxQty ? FIELD_CONTROL_ERR : ""}`}
                />
              </div>
            </>
            )
          ) : (
            <div className="flex flex-col justify-start min-w-0 w-full max-lg:col-span-2 lg:col-span-3" data-field="minusBoxes" tabIndex={-1}>
              <span className={FIELD_LABEL_ROW}>
                <Layers className="w-3 h-3 text-rose-500/90 shrink-0" aria-hidden />
                Boxes
              </span>
              <div className={READOUT_BOX_MINUS}>
                <p className="text-[11px] font-bold text-rose-950 tabular-nums leading-tight">
                  {minusSelectedUids.size} Boxes
                </p>
              </div>
            </div>
          )}
          </>
          ) : null}

          <div className="min-w-0 w-full max-lg:col-span-2 lg:col-span-4">
            <FormTextarea
              label="Reason"
              labelIcon={<MessageSquareQuote size={12} className="text-indigo-500 shrink-0" />}
              value={form.remarks}
              onChange={(e) => handleInputChange("remarks", e.target.value)}
              placeholder="Note…"
              readOnly={readOnly}
              disabled={readOnly}
              error={errors.remarks}
              rows={1}
              labelClassName="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-0 flex flex-wrap items-center gap-1"
              className="[&_textarea]:!min-h-[2rem] [&_textarea]:!max-h-[2rem] lg:[&_textarea]:!min-h-[2.25rem] lg:[&_textarea]:!max-h-[2.25rem] [&_textarea]:!py-1 [&_textarea]:!text-[10px] lg:[&_textarea]:!text-[11px] [&_textarea]:resize-none [&_textarea]:rounded-lg [&_textarea]:border-slate-200 flex min-h-0 w-full flex-col"
            />
          </div>

          <div className="flex flex-col justify-start min-w-0 w-full max-lg:col-span-1 lg:col-span-2">
            <span className={FIELD_LABEL_ROW}>
              <Shield className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
              Approve
            </span>
            {showApproval || readOnly || isEdit || isApprove ? (
              <div
                className={`min-h-[2rem] lg:min-h-[2.25rem] rounded-lg border px-2 flex items-center justify-between gap-1.5 shadow-sm ${
                  (isApprove ? savedRow?.approved : isEdit ? editingWasApproved : form.approved)
                    ? "border-emerald-700 bg-emerald-600 text-white"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <p
                  className={`truncate text-[9px] font-black uppercase ${
                    (isApprove ? savedRow?.approved : isEdit ? editingWasApproved : form.approved)
                      ? "text-white"
                      : "text-amber-900"
                  }`}
                >
                  {isApprove
                    ? savedRow?.approved
                      ? "Authorized"
                      : "Pending"
                    : isEdit
                      ? editingWasApproved
                        ? "Approved"
                        : "Pending"
                      : form.approved
                        ? "Authorized"
                        : "Pending"}
                </p>
                {!readOnly && !isEdit && !isApprove ? (
                  <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={form.approved}
                      onChange={(e) => handleInputChange("approved", e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="pointer-events-none absolute inset-0 z-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-400 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300" />
                    <span className="pointer-events-none absolute left-[2px] top-[2px] z-10 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </label>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-[2.25rem] flex-row items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-1 shadow-sm">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <p className="text-[7px] font-semibold leading-tight text-slate-600">Not available</p>
              </div>
            )}
          </div>

          {/* Error Row (Full Width) */}
          {(errors.addExtraBoxes || errors.addPerBoxQty || errors.addNumBoxes || errors.minusBoxes || errors.updateQty || errors.updateAction) && (
            <div className="max-lg:col-span-3 lg:col-span-12 flex flex-col gap-0.5 mt-1">
              {[errors.addExtraBoxes, errors.addPerBoxQty, errors.addNumBoxes, errors.minusBoxes, errors.updateQty, errors.updateAction].filter(Boolean).map((err, eidx) => (
                <p key={eidx} className="text-[8px] text-rose-600 font-semibold leading-tight flex items-start gap-0.5">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> {err}
                </p>
              ))}
            </div>
          )}

          {(!readOnly || isApprove) && gatePassed ? (
            <div className="mt-2 w-full min-w-0 shrink-0 max-lg:col-span-3 lg:col-span-12">
              <ModuleSopAcknowledgment
                ref={sopAckRef}
                key={`${open}-${gatePassed}-${sopPermissionType}`}
                moduleSlug="stock_adjustment"
                permissionType={sopPermissionType}
                isOpen={open && gatePassed}
              />
            </div>
          ) : null}
        </div>
      </div>
  );

  const inputsTopRow = (
    <div ref={formRef} className="shrink-0 border-b border-slate-200 bg-slate-50/50 lg:bg-slate-50/50">
      <div className="lg:hidden border-b border-slate-200 bg-slate-50/90">
        {inputsTopRowHints}
        {inputsTopRowFields}
      </div>
      <div className="hidden lg:block">
        {inputsTopRowHints}
        {inputsTopRowFields}
      </div>
    </div>
  );

  const breakdownTableBlock = (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden bg-white">
      <div className="shrink-0 px-2 py-1.5 lg:px-4 lg:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0 flex-1">
          <Layers className="w-4 h-4 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-600" aria-hidden />
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight text-slate-800 truncate">
            {(structureLocked || isAddEditRebuild) && gateEntryType === "add" ? "Stickers" : "Breakdown"}
          </span>
        </div>
        <div className="flex items-baseline gap-2 shrink-0 pr-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase">Net</span>
          <span
            className={`text-[13px] font-black tabular-nums ${previewSigned < 0 ? "text-rose-600" : previewSigned > 0 ? "text-emerald-600" : "text-slate-400"}`}
          >
            {previewSigned === 0 ? "—" : previewSigned > 0 ? `+${previewSigned}` : previewSigned}{" "}
            <span className="text-[10px] font-bold text-slate-400 uppercase">PCS</span>
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {gateEntryType === "add" ? (
          <AddBreakdownTable
            rows={addTableRows}
            perBoxQty={addPerBoxInt}
            totalQty={addTableTotalQty}
            savedView={(structureLocked && !isAddEditRebuild) || isAddEditPending}
            viewMode={structureLocked || (isAddEditRebuild && editingWasApproved)}
            editMode={isAddEditRebuild}
            allowRemove={canRemoveStickerBoxes}
            removeUids={addRemoveUids}
            onToggleRemove={toggleAddRemove}
            showBulkKindDropdown={gateEntryType === "add" && !isView && !isEdit && (!structureLocked || isApprove)}
            bulkBoxKind={addAllBoxesLoose ? "loose" : "full"}
            onBulkBoxKindChange={setAddBulkBoxKind}
          />
        ) : gateEntryType === "update" ? (
          <MinusBreakdownTable
            boxes={updateBox ? [updateBox] : []}
            selectedUids={
              updateBox?.box_uid != null
                ? new Set([String(updateBox.box_uid)])
                : new Set()
            }
            onToggle={() => {}}
            packingNo={String(updateBox?.packing_number ?? "").trim()}
            selectedQty={0}
            selectedCount={updateBox ? 1 : 0}
            readOnly
            allowSelect={false}
            adjustmentId={null}
            entryApproved={false}
            updateImpact={{ action: updateAction, qty: updateQty }}
          />
        ) : (
          <MinusBreakdownTable
            boxes={packingPreview?.boxes}
            selectedUids={minusSelectedUids}
            onToggle={toggleMinusBox}
            packingNo={gatePackingNo.trim()}
            selectedQty={minusImpactQty}
            selectedCount={minusSelectedUids.size}
            readOnly={structureLocked}
            allowSelect={!structureLocked && (canRemoveStickerBoxes || isEdit)}
            adjustmentId={adjIdForMinus}
            entryApproved={minusEntryApproved}
          />
        )}
      </div>
    </div>
  );

  const breakdownPanel = (
    <div className="flex flex-1 min-h-0 flex flex-col overflow-hidden w-full min-w-0 min-h-[min(48dvh,380px)]">
      {/* Mobile / tablet: Details + Boxes tabs */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0 w-full overflow-hidden lg:hidden bg-slate-100/80 min-h-[min(52dvh,420px)]">
        <div
          role="tablist"
          aria-label="Stock details and breakdown"
          className="grid w-full grid-cols-2 gap-1 shrink-0 px-2 py-1 border-b border-slate-200 bg-white"
        >
          {[
            { id: "details", label: "Details" },
            { id: "boxes", label: "Boxes" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mobileBreakdownTab === tab.id}
              onClick={() => setMobileBreakdownTab(tab.id)}
              className={`rounded-md py-1.5 px-2 text-center text-[9px] font-black uppercase tracking-tight transition-all touch-manipulation active:opacity-90 min-h-[2rem] flex items-center justify-center ${
                mobileBreakdownTab === tab.id
                  ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                  : "bg-slate-200/70 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col mx-2 mb-2 mt-1.5 bg-white border border-slate-200 rounded-lg">
          {mobileBreakdownTab === "details" ? (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-50 p-2">
              <StockAdjustmentStickerDetailCards
                selectedRow={selectedRowLike}
                packing={packingLikeForCards}
                onCustomerChange={handleCustomerChange}
                customerSelectDisabled={isView || isApprove || gateEntryType === "update"}
                customerChanging={customerChanging}
                hideCustomerSection={isMinusFlow && !readOnly}
                minusViewMode={minusViewMode}
                minusCustomerLines={minusViewMode ? minusCustomerLinesDisplay : null}
                categories={categoryOptions}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={(id) => {
                  setSelectedCategoryId(id);
                  if (errors.category) setErrors((prev) => ({ ...prev, category: "" }));
                }}
                categorySelectDisabled={isView || isApprove || gateEntryType !== "add"}
                categoryError={errors.category || ""}
                updateBreakdown={updateBreakdownForCards}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">{breakdownTableBlock}</div>
          )}
        </div>
      </div>

      {/* Desktop: details sidebar + breakdown table */}
      <div className="hidden lg:flex lg:flex-row flex-1 min-h-0 w-full min-w-0 overflow-hidden bg-slate-50">
        <div className="shrink-0 lg:w-80 xl:w-96 border-r border-slate-200 bg-slate-50 overflow-y-auto overflow-x-hidden">
          <StockAdjustmentStickerDetailCards
            selectedRow={selectedRowLike}
            packing={packingLikeForCards}
            onCustomerChange={handleCustomerChange}
            customerSelectDisabled={isView || isApprove || gateEntryType === "update"}
            customerChanging={customerChanging}
            hideCustomerSection={isMinusFlow && !readOnly}
            minusViewMode={minusViewMode}
            minusCustomerLines={minusViewMode ? minusCustomerLinesDisplay : null}
            categories={categoryOptions}
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={(id) => {
              setSelectedCategoryId(id);
              if (errors.category) setErrors((prev) => ({ ...prev, category: "" }));
            }}
            categorySelectDisabled={isView || isApprove || gateEntryType !== "add"}
            categoryError={errors.category || ""}
            updateBreakdown={updateBreakdownForCards}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">{breakdownTableBlock}</div>
      </div>
    </div>
  );

  const drawerTitle = isView
    ? "View stock adjustment"
    : isApprove
      ? "Approve stock adjustment"
      : isEdit
        ? "Edit stock adjustment"
        : "Stock adjustment";

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={
        isApprove && gatePassed
          ? handleApprove
          : !readOnly && gatePassed && !isApprove
            ? handleSave
            : undefined
      }
      title={drawerTitle}
      description={
        isApprove
          ? "Same layout as View — confirm boxes, then Approve to update inventory."
          : undefined
      }
      maxWidth="max-w-full xl:max-w-7xl"
      noPadding
      bodyScrollable={false}
    >
      <QrScannerOverlay
        open={isUpdateScannerOpen}
        onClose={closeUpdateScanner}
        readerId={SA_UPDATE_STICKER_SCANNER_ID}
        hint="Scanning box sticker / QR"
        torchSupported={torchSupported}
        torchOn={torchOn}
        onToggleTorch={toggleTorch}
      />
      <div className="flex h-full min-h-0 flex-col w-full max-w-full min-w-0 overflow-hidden bg-slate-50 antialiased">
        {viewHydrating || packLoading ? (
          <FormPanelLoader
            className="flex-1 border-0 rounded-none min-h-0"
            minHeight="min-h-0 flex-1"
            label={viewHydrating ? "Loading stock adjustment..." : "Loading packing data..."}
            hint={
              viewHydrating
                ? "Preparing adjustment details and box list."
                : "Fetching packing and inventory context."
            }
          />
        ) : (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden w-full min-w-0">
        {topToolbar}

        {!gatePassed ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 px-4 text-center py-10">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {gateEntryType === "add"
                ? "Select financial year and packing number, then Load"
                : gateEntryType === "minus"
                  ? "Enter packing number, then Load"
                  : gateEntryType === "update"
                    ? "Scan or type box sticker (box_no_uid)"
                    : "Select type first"}
            </p>
            <p className="text-[10px] text-slate-400 max-w-md">
              {gateEntryType === "update"
                ? "Use QR / laser / keyboard — same sticker scan as elsewhere in IMS. One box per update."
                : <>
              After load, use Details / Boxes tabs on small screens
              {gateEntryType === "minus" ? " — tick boxes to remove in Boxes tab." : "."}
                </>}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 w-full max-w-full min-w-0 overflow-hidden">
            <div className="shrink-0 w-full min-w-0">{inputsTopRow}</div>
            <div className="flex flex-1 min-h-0 flex-col w-full min-w-0 overflow-hidden border-t border-slate-200/80 bg-slate-50">
              {breakdownPanel}
            </div>
          </div>
        )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

