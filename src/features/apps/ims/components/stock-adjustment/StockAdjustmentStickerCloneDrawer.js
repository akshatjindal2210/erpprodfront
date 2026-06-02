"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Check, AlertCircle, Loader2, Shield, MessageSquareQuote, Package, Layers } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/core/components/ui/Drawer";
import FormPanelLoader from "@/core/components/common/FormPanelLoader";
import ModuleSopAcknowledgment from "@/core/components/common/ModuleSopAcknowledgment";
import RemarksTextarea from "@/core/components/common/RemarksTextarea";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { stockAdjustmentService } from "@/features/apps/ims/services/stockAdjustment";
import { boxService } from "@/features/apps/ims/services/box";
import { STICKER_DOWNLOAD_SOURCE_KEYS, getBoxNoUidPrefix } from "@/core/utils/global";
import { loadPackingContext } from "./loadPackingContext";
import StockAdjustmentStickerDetailCards from "./StockAdjustmentStickerDetailCards";
import { masterService } from "@/features/apps/ims/services/master";
import { focusFirstError } from "@/core/utils/formFocus";
import { sortFilterOptionsAsc } from "@/core/utils/sortSelectOptions";
import { rowInIndianFinancialYear } from "@/core/utils/indianFinancialYear";

const FIELD_ORDER = ["addNumBoxes", "addExtraBoxes", "addPerBoxQty", "minusBoxes"];
import { formatStockAdjustmentBoxNoUid, isLooseBoxComparedToStandard, parseOptionalStandardQtyPerBox, parseStockAdjustmentBoxIndex } from "@/features/apps/ims/utils/stockAdjustmentPacking";
import { hydrateStockAdjustmentStickerView } from "./hydrateStockAdjustmentStickerView";
import {
  boxInventoryStatus,
  isBoxAvailableForMinus,
  isBoxVisibleForStockAdjustmentMinus,
  isValidMinusDrawerBoxRow,
  isStockAdjustmentIn,
  isStockAdjustmentOut,
} from "@/features/apps/ims/utils/boxInventory";
import { isMinusBoxUidSelected, parseRemovedBoxUids, normalizeMinusSelectedUidSet } from "./stockAdjustmentViewBoxes";
import { printFromBackendHtml } from "@/features/apps/ims/utils/printHtmlDocument";

const STOCK_ADJ_PERMS = { permission_module: "stock_adjustment", permission_action: "view" };

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
  "h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const FIELD_CONTROL_ERR = "border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-100";
const READOUT_BOX = "min-h-[2.5rem] rounded-lg border border-slate-200 bg-slate-50 px-2.5 flex flex-col justify-center shadow-sm";
const READOUT_BOX_MINUS = "min-h-[2.5rem] rounded-lg border border-rose-200/80 bg-rose-50/60 px-2.5 flex flex-col justify-center shadow-sm";

const INITIAL_FORM = {
  remarks: "",
  approved: false,
};

const GATE_ADD_MINUS = [
  { value: "add", label: "Add (+)" },
  { value: "minus", label: "Minus (-)" },
];

const FINANCIAL_YEAR_RANGE_PAST = 5;
/** 0 = no FY starting year after current calendar year (no "2027-2028" while CY is 2026). */
const FINANCIAL_YEAR_RANGE_FUTURE = 0;

/** e.g. 2025-2026 — driven by FINANCIAL_YEAR_RANGE_* above */
function getFinancialYearOptions() {
  const cy = new Date().getFullYear();
  const out = [];
  for (let y = cy - FINANCIAL_YEAR_RANGE_PAST; y <= cy + FINANCIAL_YEAR_RANGE_FUTURE; y++) {
    const v = `${y}-${y + 1}`;
    out.push({ value: v, label: v });
  }
  return out;
}

function minusBoxNoUidLabel(row) {
  const label = String(row?.box_no_uid ?? "").trim();
  return label || "—";
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
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0">
      <div className="shrink-0 px-3 py-2 lg:px-4 bg-rose-50 border-b border-rose-100 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase text-rose-700 tracking-wide">
            {readOnly
              ? entryApproved
                ? "Boxes removed (minus)"
                : "Boxes selected for minus"
              : "Boxes to remove (minus)"}
          </p>
          <p className="text-[11px] font-bold text-rose-900">
            {readOnly ? (
              <>
                <span className="tabular-nums">{total}</span> box
              </>
            ) : (
              <>
                Selected: <span className="tabular-nums">{selectedCount}</span> / {total} box
              </>
            )}
            <span className="mx-2 text-rose-300">|</span>
            Qty impact: <span className="font-black tabular-nums">-{selectedQty}</span> PCS
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-0 lg:p-1">
        {!displayBoxes?.length ? (
          <div className="bg-white border border-slate-200 px-3 py-8 text-center text-slate-400 text-[10px] font-bold uppercase">
            No boxes
          </div>
        ) : (
          <div className="bg-white border border-slate-200 overflow-hidden w-full max-w-full min-w-0">
            <div className="overflow-x-auto overscroll-x-contain touch-pan-x max-w-full [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[560px] sm:min-w-[620px] lg:min-w-[720px] text-left border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-600 border-r border-slate-200 whitespace-nowrap"
                    >
                      #
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Box
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Packing
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Status
                    </th>
                    {!readOnly && allowSelect ? (
                      <th
                        scope="col"
                        className="sticky right-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-600 text-center border-l border-slate-200 whitespace-nowrap"
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
                        <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 min-w-0 max-w-[180px] lg:max-w-[240px]">
                          <div className="flex flex-col leading-snug min-w-0">
                            <span className="text-slate-800 font-bold text-[10px] lg:text-xs break-all">
                              {boxNoUid}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 whitespace-nowrap tabular-nums">
                          {row.packing_number ?? packingNo}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-800 whitespace-nowrap tabular-nums">
                          {Number(row.qty ?? 0).toLocaleString()} {unit}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                          <span
                            className={`text-[8px] lg:text-[11px] font-black px-1 py-0.5 lg:px-1.5 lg:py-0.5 border whitespace-nowrap ${
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
                          <span className="text-[9px] lg:text-[12px] font-bold text-slate-600 uppercase whitespace-nowrap">
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
              : savedView
                ? "Saved boxes (add)"
                : "New boxes (after stickers)"}
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
          {!savedView && !editMode ? (
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
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-0 lg:p-1">
        {!n ? (
          <div className="bg-white border border-slate-200 px-3 py-8 text-center">
            <div className="flex flex-col items-center gap-1.5 text-slate-400">
              <Layers size={20} className="opacity-20" />
              <span className="text-[10px] lg:text-[11px] font-bold uppercase tracking-wide px-1">
                {editMode
                  ? "Saved boxes appear here — select Remove or use Add more above"
                  : "Enter number of boxes and per-box quantity — the breakdown will appear here"}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 overflow-hidden w-full max-w-full min-w-0">
            <div className="overflow-x-auto overscroll-x-contain touch-pan-x max-w-full [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[520px] sm:min-w-[580px] lg:min-w-[680px] text-left border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-600 border-r border-slate-200 whitespace-nowrap"
                    >
                      #
                    </th>
                    {showRemoveColumn ? (
                      <th
                        scope="col"
                        className="sticky left-[2.25rem] top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-rose-600 border-r border-slate-200 whitespace-nowrap"
                      >
                        Remove
                      </th>
                    ) : null}
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Box
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Packing
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
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
                      <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums">
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
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 min-w-0 max-w-[180px] lg:max-w-[240px]">
                        <div className="flex flex-col leading-snug min-w-0">
                          <span className="text-blue-700 font-bold text-[10px] lg:text-xs break-all">{row.box_no_uid}</span>
                          <span className="text-[8px] lg:text-[10px] text-slate-400 uppercase font-bold truncate">
                            Box {row.box_no} / {row.total_boxes}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 whitespace-nowrap tabular-nums">
                        {row.package_no}
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-800 whitespace-nowrap tabular-nums">
                        {Number(row.qty).toLocaleString()} {row.unit || "PCS"}
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                        {row.is_loose ? (
                          <span className="text-[8px] lg:text-[11px] font-black px-1 py-0.5 lg:px-1.5 lg:py-0.5 border whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200">
                            LOOSE
                          </span>
                        ) : (
                          <span className="text-[8px] lg:text-[11px] font-black px-1 py-0.5 lg:px-1.5 lg:py-0.5 border whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-200">
                            FULL
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                        <span
                          className={`text-[9px] lg:text-[12px] font-bold uppercase whitespace-nowrap ${
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
  const [savedAddBoxRows, setSavedAddBoxRows] = useState([]);
  const [addRemoveUids, setAddRemoveUids] = useState(() => new Set());
  const [addExtraBoxes, setAddExtraBoxes] = useState("0");
  const [minusSelectedUids, setMinusSelectedUids] = useState(() => new Set());
  const [itemMeta, setItemMeta] = useState(null);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);
  /** Phone: switch between item cards and breakdown table */
  const [mobileBreakdownTab, setMobileBreakdownTab] = useState("boxes");
  const [viewAddRows, setViewAddRows] = useState([]);
  const [viewHydrating, setViewHydrating] = useState(false);
  const [savedRow, setSavedRow] = useState(null);

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
      setSavedAddBoxRows([]);
      setAddRemoveUids(new Set());
      setAddExtraBoxes("0");
      setMinusSelectedUids(new Set());
      setItemMeta(null);
      setForm(INITIAL_FORM);
      setErrors({});
      setMobileBreakdownTab("boxes");
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
          setForm({ ...INITIAL_FORM, ...hydrated.form });
          setAddNumBoxes(hydrated.addNumBoxes);
          setAddPerBoxQty(hydrated.addPerBoxQty);
          setMinusSelectedUids(normalizeMinusSelectedUidSet(hydrated.minusSelectedUids));
          setViewAddRows(hydrated.viewAddRows);
          setSavedAddBoxRows(hydrated.savedAddBoxRows ?? hydrated.viewAddRows ?? []);
          setAddRemoveUids(new Set());
          setAddExtraBoxes("0");
          setPackingPreview(hydrated.packingPreview);
          setItemMeta(hydrated.itemMeta);
          setSavedRow(hydrated.row);
          setGatePassed(true);
          setMobileBreakdownTab("boxes");
        } catch (err) {
          if (!cancelled) {
            toast.error(err?.message || "Failed to load adjustment");
            onClose?.();
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
  }, [open, isView, isEdit, isApprove, editData?.adjustment_id, onClose]);

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
      await stockAdjustmentService.update(adjId, { approved: true });
      toast.success(
        gateEntryType === "add"
          ? "Approved — boxes created in inventory. Print stickers from the list (Ctrl+P)."
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
        itemdesc: "—",
        category: "—",
        acc_name: "—",
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
    return {
      item_code: im?.item_code ?? st?.item_code ?? dp?.item_code ?? "—",
      itemdesc: im?.itemdesc ?? im?.description ?? st?.itemdesc ?? st?.item_desc ?? dp?.item_desc ?? "—",
      category: st?.category ?? st?.type_name ?? "—",
      acc_name: im?.acc_name ?? st?.acc_name ?? dp?.acc_name ?? "—",
      party_rate_cust_code: st?.party_rate_cust_code ?? dp?.party_rate_cust_code,
      acc_code: dp?.acc_code ?? st?.acc_code ?? null,
      cust_code: st?.cust_code,
      job_card_no: dp?.job_card_no ?? st?.job_card_no ?? "—",
      total_qty: st?.total_qty ?? dp?.total_qty ?? 0,
      unit: st?.unit ?? dp?.unit ?? "PCS",
      doc_dt: st?.doc_dt ?? dp?.doc_dt,
      doc_no: st?.doc_no ?? dp?.doc_no ?? pn,
    };
  }, [packingPreview, itemMeta, gatePackingNo]);

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

  const packingLike = useMemo(() => {
    const pd = packingPreview?.stickerRow?.packing_details;
    if (pd != null && pd.qty_per_box != null && pd.qty_per_box !== "") {
      return {
        qty_per_box: Number(pd.qty_per_box) || 0,
        full_boxes_count: Number(pd.full_boxes_count) || 0,
        loose_box_qty: Number(pd.loose_box_qty) || 0,
      };
    }
    if (gateEntryType === "add" && addPerBoxInt >= 1) {
      const n = parseInt(String(addNumBoxes).trim(), 10);
      if (Number.isFinite(n) && n >= 1) {
        return { qty_per_box: addPerBoxInt, full_boxes_count: n, loose_box_qty: 0 };
      }
    }
    if (gateEntryType === "minus" && packingPreview?.boxes?.length) {
      const boxes = packingPreview.boxes;
      const full = boxes.filter((b) => !b.is_loose).length;
      const loose = boxes.some((b) => b.is_loose) ? 1 : 0;
      const q0 = boxes[0]?.qty;
      const qpb = q0 != null ? Number(q0) : 0;
      return { qty_per_box: qpb, full_boxes_count: full, loose_box_qty: loose ? 1 : 0 };
    }
    return { qty_per_box: 0, full_boxes_count: 0, loose_box_qty: 0 };
  }, [packingPreview, gateEntryType, addPerBoxInt, addNumBoxes]);

  const addBreakdownRows = useMemo(() => {
    const n = parseInt(String(addNumBoxes ?? "").trim(), 10);
    const p = parseInt(String(addPerBoxQty ?? "").trim(), 10);
    const pn =
      String(gatePackingNo ?? "").trim() ||
      String(packingPreview?.boxes?.[0]?.packing_number ?? packingPreview?.dailyprod?.doc_no ?? "").trim();
    if (!Number.isFinite(n) || n < 1 || !Number.isFinite(p) || p < 1 || !pn) return [];
    const unit = "PCS";
    const stdNum = parseOptionalStandardQtyPerBox(packingPreview?.standard_qty_per_box);
    const isLoose = isLooseBoxComparedToStandard(p, stdNum);
    const saToken =
      isEdit && editData?.adjustment_id ? editData.adjustment_id : "?";
    return Array.from({ length: n }, (_, i) => {
      const boxNo = i + 1;
      const box_no_uid = formatStockAdjustmentBoxNoUid(pn, saToken, n, boxNo, getBoxNoUidPrefix());
      return {
        box_no: boxNo,
        box_no_uid,
        package_no: pn,
        total_boxes: n,
        qty: p,
        unit,
        is_loose: isLoose,
      };
    });
  }, [addNumBoxes, addPerBoxQty, gatePackingNo, packingPreview, isEdit, editData?.adjustment_id]);

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
    const pn =
      String(gatePackingNo ?? "").trim() ||
      String(packingPreview?.boxes?.[0]?.packing_number ?? packingPreview?.dailyprod?.doc_no ?? "").trim();
    const extra = parseInt(String(addExtraBoxes ?? "").trim(), 10) || 0;
    if (!pn || !Number.isFinite(pb) || pb < 1) return [];

    const stdNum = parseOptionalStandardQtyPerBox(packingPreview?.standard_qty_per_box);
    const isLoose = isLooseBoxComparedToStandard(pb, stdNum);
    const adjId = editData?.adjustment_id;
    const kept = savedAddBoxRows.filter(
      (r) => r.box_uid != null && !addRemoveUids.has(String(r.box_uid))
    );
    const rows = kept.map((r) => ({ ...r, is_saved: true }));
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
        is_loose: isLoose,
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
    gatePackingNo,
    packingPreview,
    editData?.adjustment_id,
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

  const isAddEditPending =
    isAddEdit &&
    !isAddEditRebuild &&
    viewAddRows.length > 0 &&
    viewAddRows.length === (parseInt(String(addNumBoxes).trim(), 10) || 0);

  const addTableRows = useMemo(() => {
    if (gateEntryType !== "add") return [];
    if (structureLocked) return viewAddRows;
    if (isAddEditRebuild) return addEditBreakdownRows;
    if (isAddEditPending) return viewAddRows;
    return addBreakdownRows;
  }, [
    gateEntryType,
    structureLocked,
    viewAddRows,
    isAddEditRebuild,
    addEditBreakdownRows,
    isAddEditPending,
    addBreakdownRows,
  ]);

  const addTableTotalQty = useMemo(() => {
    const sumRows = (rows) => (rows || []).reduce((s, r) => s + (parseInt(r.qty, 10) || 0), 0);
    if (structureLocked) return sumRows(viewAddRows);
    if (isAddEditRebuild) return editAddTotalQty;
    if (isAddEditPending) return sumRows(viewAddRows);
    return addTotalQty;
  }, [
    structureLocked,
    viewAddRows,
    isAddEditRebuild,
    editAddTotalQty,
    isAddEditPending,
    addTotalQty,
  ]);

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

  const handleGateLoad = async () => {
    if (!gateEntryType) {
      toast.warn("Select type — Add or Minus");
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

      setPackingPreview(previewPayload);
      setItemMeta(im);
      setGatePassed(true);
      setMinusSelectedUids(new Set());
      setMobileBreakdownTab("boxes");
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

  const validate = () => {
    const e = {};
    if (gateEntryType === "add") {
      const pb = parseInt(String(addPerBoxQty).trim(), 10);
      if (!Number.isFinite(pb) || pb < 1) e.addPerBoxQty = "Per box qty ≥ 1";
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
          payload.removed_box_uids = [...minusSelectedUids]
            .map((u) => parseInt(u, 10))
            .filter((n) => Number.isFinite(n));
        }

        await stockAdjustmentService.update(editData.adjustment_id, payload);
        toast.success(
          wasApproved
            ? "Saved — status set to pending; Approve again to apply box changes"
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
          packing_number: gatePackingNo.trim(),
          financial_year: gateFinancialYear.trim(),
          per_box_qty: pb,
          box_count_impact: nb,
          no_of_boxes: nb,
          unit: "PCS",
          remarks: remarksForApi,
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
          approved: showApproval && form.approved === true,
        });
      }
      toast.success(
        showApproval && form.approved
          ? "Stock adjustment saved and approved — boxes are in inventory."
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
        : 0;

  const topToolbar = (
    <div className="shrink-0 bg-white border-b border-slate-200 shadow-sm z-20 w-full max-w-full min-w-0">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 max-w-[1800px] mx-auto w-full min-w-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6 w-full min-w-0">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:flex sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-3 flex-1 min-w-0">
            <div className="min-w-0 col-span-1 sm:w-[148px]">
              <label htmlFor="sa-gate-type" className={FIELD_LABEL}>
                Type
              </label>
              <select
                id="sa-gate-type"
                value={gateEntryType}
                onChange={(e) => {
                  setGateEntryType(e.target.value);
                  setGatePassed(false);
                  setPackingPreview(null);
                }}
                disabled={gatePassed || structureLocked}
                className={FIELD_CONTROL}
              >
                <option value="">Select…</option>
                {sortFilterOptionsAsc(GATE_ADD_MINUS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {gateEntryType === "add" && (
              <div className="min-w-0 col-span-1 sm:w-[158px]">
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
            <div className={`min-w-0 col-span-2 sm:col-span-1 sm:flex-1 sm:min-w-[200px] sm:max-w-lg ${gateEntryType === "add" ? "" : "col-span-2"}`}>
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
                className="col-span-2 h-9 px-4 shrink-0 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide shadow-sm hover:bg-indigo-700 disabled:opacity-55 inline-flex items-center justify-center gap-2 sm:col-span-1 sm:w-auto w-full border border-indigo-700/20"
              >
                {packLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
                Load
              </button>
            )}
          </div>

          <div className="flex w-full shrink-0 items-end lg:w-auto lg:justify-end">
            <div
              className={`w-full rounded-xl bg-slate-50/90 p-1 gap-1 flex items-center justify-end`}
            >
              {gatePassed && !readOnly && !isEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setGatePassed(false);
                    setPackingPreview(null);
                    setItemMeta(null);
                    setMinusSelectedUids(new Set());
                    setMobileBreakdownTab("boxes");
                  }}
                  className="h-9 rounded-lg text-[10px] font-black uppercase border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 px-3 transition-all"
                >
                  Reset
                </button>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 text-[10px] font-black uppercase shadow-sm hover:bg-slate-50 px-4 transition-all disabled:opacity-50"
              >
                Cancel
              </button>

              {gatePassed && !readOnly && !(isEdit && structureLocked) ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase shadow-sm hover:bg-black disabled:bg-slate-400 px-4 transition-all"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                  ) : (
                    <Check className="w-4 h-4 shrink-0" aria-hidden />
                  )}
                  {isEdit ? "Update" : "Save"}
                </button>
              ) : null}

              {gatePassed && isApprove ? (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading || !!(savedRow?.approved ?? editData?.approved)}
                  className="h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase shadow-sm hover:bg-emerald-700 disabled:opacity-50 px-4 transition-all"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                  ) : (
                    <Shield className="w-4 h-4 shrink-0" aria-hidden />
                  )}
                  Approve
                </button>
              ) : null}

              {readOnly && gatePassed && !isApprove ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 inline-flex items-center justify-center rounded-lg bg-slate-700 text-white text-[10px] font-black uppercase shadow-sm hover:bg-slate-900 px-4 transition-all"
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const inputsTopRow = (
    <div ref={formRef} className="shrink-0 border-b border-slate-200 bg-slate-50/50 max-lg:border-t max-lg:border-slate-200/90">
      {isApprove ? (
        <p className="mx-3 mt-2 sm:mx-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-900">
          Review packing and boxes below, then click <span className="font-black">Approve</span>. Add creates boxes in inventory; minus removes selected boxes. To change counts, close this screen and use <span className="font-black">Edit</span> first.
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
      ) : null}
      <div className="max-w-[1800px] mx-auto w-full min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="flex flex-col justify-start min-w-0 lg:col-span-2">
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
              <div className="min-w-0 lg:col-span-2">
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
              <div className="min-w-0 lg:col-span-2">
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
              <div className="min-w-0 lg:col-span-2">
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
              <div className="min-w-0 lg:col-span-2">
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
              <div className="min-w-0 lg:col-span-2">
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
            <div className="flex flex-col justify-start min-w-0 lg:col-span-3" data-field="minusBoxes" tabIndex={-1}>
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

          <div className="min-w-0 lg:col-span-4">
            <RemarksTextarea
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
              className="[&_textarea]:!min-h-[2.25rem] [&_textarea]:!max-h-[2.25rem] [&_textarea]:!py-1.5 [&_textarea]:!text-[11px] [&_textarea]:resize-none [&_textarea]:rounded-lg [&_textarea]:border-slate-200 flex min-h-0 w-full flex-col"
            />
          </div>

          <div className="flex flex-col justify-start min-w-0 lg:col-span-2">
            <span className={FIELD_LABEL_ROW}>
              <Shield className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
              Approve
            </span>
            {showApproval || readOnly || isEdit || isApprove ? (
              <div
                className={`min-h-[2.25rem] rounded-lg border px-2 flex items-center justify-between gap-1.5 shadow-sm ${
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
          {(errors.addExtraBoxes || errors.addPerBoxQty || errors.addNumBoxes || errors.minusBoxes) && (
            <div className="lg:col-span-12 flex flex-col gap-0.5 mt-1">
              {[errors.addExtraBoxes, errors.addPerBoxQty, errors.addNumBoxes, errors.minusBoxes].filter(Boolean).map((err, eidx) => (
                <p key={eidx} className="text-[8px] text-rose-600 font-semibold leading-tight flex items-start gap-0.5">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> {err}
                </p>
              ))}
            </div>
          )}

          {(!readOnly || isApprove) && gatePassed ? (
            <div className="mt-2 w-full min-w-0 shrink-0 lg:col-span-12">
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
    </div>
  );

  const breakdownTableBlock = (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden bg-white">
      <div className="shrink-0 px-2 py-1.5 lg:px-4 lg:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0 flex-1">
          <Layers className="w-4 h-4 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-600" aria-hidden />
          <span className="text-[10px] sm:text-[11px] lg:text-sm font-black uppercase tracking-tight text-slate-800 truncate">
            Breakdown
          </span>
        </div>
        <div className="flex items-baseline gap-2 shrink-0 pr-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase">Net</span>
          <span
            className={`text-base lg:text-lg font-black tabular-nums ${previewSigned < 0 ? "text-rose-600" : previewSigned > 0 ? "text-emerald-600" : "text-slate-400"}`}
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
            editMode={isAddEditRebuild}
            allowRemove={canRemoveStickerBoxes}
            removeUids={addRemoveUids}
            onToggleRemove={toggleAddRemove}
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
    <>
      {/* Mobile / tablet: tabs so breakdown table gets full height */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden lg:hidden bg-slate-100/80">
        <div
          role="tablist"
          aria-label="Stock details and breakdown"
          className="grid grid-cols-2 gap-1.5 shrink-0 px-2 pt-1.5 pb-1.5 border-b border-slate-200 bg-white"
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
              className={`rounded-lg py-2 px-2 text-center text-[10px] font-black uppercase tracking-tight transition-all touch-manipulation active:opacity-90 min-h-[2.25rem] flex items-center justify-center ${
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
              <StockAdjustmentStickerDetailCards selectedRow={selectedRowLike} packing={packingLike} />
            </div>
          ) : (
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">{breakdownTableBlock}</div>
          )}
        </div>
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden lg:flex lg:flex-row flex-1 min-h-0 w-full min-w-0 overflow-hidden bg-slate-50">
        <div className="shrink-0 lg:w-80 xl:w-96 border-r border-slate-200 bg-slate-50 overflow-y-auto overflow-x-hidden">
          <StockAdjustmentStickerDetailCards selectedRow={selectedRowLike} packing={packingLike} />
        </div>
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">{breakdownTableBlock}</div>
      </div>
    </>
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
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-full min-w-0 overflow-hidden bg-slate-50 antialiased overscroll-contain">
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
          <>
        {topToolbar}

        {!gatePassed ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 px-4 text-center py-10">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {gateEntryType === "add"
                ? "Select financial year and packing number, then Load"
                : gateEntryType === "minus"
                  ? "Enter packing number, then Load"
                  : "Select type first"}
            </p>
            <p className="text-[10px] text-slate-400 max-w-md">After load, use Details / Boxes tabs on small screens.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 w-full max-w-full min-w-0 overflow-hidden">
            <div className="order-1 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-slate-200/80 bg-slate-50 max-lg:border-t-0 lg:order-2 lg:border-t-0">
              {breakdownPanel}
            </div>
            <div className="order-2 shrink-0 lg:order-1">{inputsTopRow}</div>
          </div>
        )}
          </>
        )}
      </div>
    </Drawer>
  );
}

