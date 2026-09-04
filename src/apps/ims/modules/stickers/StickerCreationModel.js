"use client";
import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, Loader2, CheckCircle2, User, Layers, ClipboardList, RefreshCw, Box, Eye, X } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { boxService } from "@/apps/ims/lib/services/box";
import { packingStandardService } from "@/apps/ims/lib/services/packingStandard";
import { masterService } from "@/apps/ims/lib/services/master";
import { STICKER_DOWNLOAD_SOURCE_KEYS, formatStandardBoxNoUid, parseStandardBoxNoUid, getBoxNoUidPrefix } from "@/platform/utils/global";
import { printFromBackendHtml } from "@/apps/ims/lib/utils/printHtmlDocument";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { sortSelectRowsAsc } from "@/platform/utils/form/sortSelectOptions";
import { fetchItemScopedLedgerById } from "@/apps/ims/lib/helpers/packingEntryCustomerSelect";
import { useEscapeKey } from "@/platform/hooks/system/useEscapeKey";
import { formatDocDate } from "@/platform/utils/core/utilHelper";

/** Physical sticker card size in CSS px (96px/in) — matches backend `buildStickerCardHtml` 5.7in × 3.6in. */
const STICKER_PREVIEW_W_PX = 5.7 * 96;
const STICKER_PREVIEW_H_PX = 3.6 * 96;

function resolvePackingStandardId(row) {
  if (!row) return null;
  const candidates = [
    row.packing_standard_id,
    row.standard_id,
    row.packing_details?.standard_id,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== "") return String(c).trim();
  }
  return null;
}

/** Live production snapshot for sticker/packing-standard match (no `dailyprod` row required beforehand). */
function packRowForStickerApi(row, { categoryId = null } = {}) {
  if (!row?.doc_no || row.itemdcode == null || String(row.itemdcode).trim() === "") return null;
  const packingStandardId = resolvePackingStandardId(row);
  const rowType = row.type != null ? String(row.type).trim() : "";
  const catId = categoryId != null ? String(categoryId).trim() : "";
  const includeStdId =
    packingStandardId && (!catId || !rowType || catId === rowType);
  return {
    doc_no: row.doc_no,
    doc_dt: row.doc_dt,
    job_card_no: row.job_card_no,
    itemdcode: row.itemdcode,
    item_code: row.item_code,
    total_qty: row.total_qty,
    acc_code: row.acc_code,
    sticker_generated: row.sticker_generated,
    ...(includeStdId ? { packing_standard_id: packingStandardId } : {}),
  };
}

function stickerFetchBody(row, overrides = {}) {
  const prod = packRowForStickerApi(row, { categoryId: overrides.category_id ?? null });
  const body = {
    permission_module: "packing_entry",
    permission_action: "view",
    ...overrides,
  };
  if (body.itemdcode == null && row?.itemdcode != null) body.itemdcode = row.itemdcode;
  if (body.doc_no == null && row?.doc_no != null) body.doc_no = row.doc_no;
  if (prod) body.production = prod;
  return body;
}

/**
 * After stickers exist, packing list row is source of truth (ims_dailyprod snapshot).
 * While creating stickers, keep the customer currently selected in the modal.
 */
function withPackingEntryCustomer(row, packingEntry, { lockToPackingList = false } = {}) {
  if (!row || !lockToPackingList) return row;
  const acc = packingEntry?.acc_code;
  if (acc == null || String(acc).trim() === "") return row;
  return {
    ...row,
    acc_code: String(acc).trim(),
    acc_name: packingEntry?.acc_name?.trim() ? packingEntry.acc_name : row.acc_name,
  };
}

/** Packing-entry customer (selected at generate). Modal row wins; then packing list / dailyprod. */
function packingEntryCustomerRow(packingListRow, modalRow) {
  const fromModal =
    modalRow?.acc_code != null && String(modalRow.acc_code).trim() !== ""
      ? String(modalRow.acc_code).trim()
      : "";
  const fromList =
    packingListRow?.acc_code != null && String(packingListRow.acc_code).trim() !== ""
      ? String(packingListRow.acc_code).trim()
      : "";
  const acc_code = fromModal || fromList;
  const acc_name =
    (fromModal && modalRow?.acc_name?.trim() ? modalRow.acc_name : "") ||
    (fromList && packingListRow?.acc_name?.trim() ? packingListRow.acc_name : "") ||
    modalRow?.acc_name ||
    packingListRow?.acc_name ||
    "";
  return {
    ...(modalRow || packingListRow || {}),
    acc_code,
    acc_name,
  };
}

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  return isMobile ? "mobile" : "desktop";
}

/** Cust. code = party-rate narr1 for (customer acc_code + item dcode) only; else — */
async function enrichRowPartyRateCustCode(row, accCode) {
  const code = accCode != null ? String(accCode).trim() : "";
  if (!row?.itemdcode || !code) {
    return { ...row, party_rate_cust_code: null };
  }

  let party_rate_cust_code = null;
  try {
    const res = await masterService.resolvePartyRateCustCode({
      acc_code: code,
      itemdcode: row.itemdcode,
      item_code: row.item_code,
    });
    if (res?.success && res.party_rate_cust_code?.trim()) {
      party_rate_cust_code = res.party_rate_cust_code.trim();
    }
  } catch {
    /* no narr1 for this customer + item */
  }

  return {
    ...row,
    acc_code: code,
    party_rate_cust_code,
  };
}

function buildStickerPrintMeta(packingRow, sticker) {
  const packingAcc = packingRow?.acc_code;
  const packingName = packingRow?.acc_name;
  // Sticker creation: always packing-entry customer selected at generate (ignore box override_cust).
  const accCode = packingAcc ?? sticker?.acc_code;
  const accName = packingName ?? sticker?.acc_name;
  const packingNo =
    packingRow?.doc_no != null && String(packingRow.doc_no).trim() !== ""
      ? String(packingRow.doc_no).trim()
      : sticker?.packing_number != null && String(sticker.packing_number).trim() !== ""
        ? String(sticker.packing_number).trim()
        : null;
  return {
    packing_number: packingNo,
    doc_no: packingNo,
    itemdcode: packingRow?.itemdcode,
    item_code: packingRow?.item_code,
    itemdesc: packingRow?.itemdesc || packingRow?.description || "",
    description: packingRow?.itemdesc || packingRow?.description || "",
    acc_name: accName,
    acc_code: accCode,
    ...(packingRow?.party_rate_cust_code?.trim()
      ? { party_rate_cust_code: packingRow.party_rate_cust_code.trim() }
      : {}),
    job_card_no: packingRow?.job_card_no || "",
    fg_location: packingRow?.fg_location || "",
    ...(sticker?.box_no != null ? { box_no: sticker.box_no } : {}),
    ...(sticker?.total_boxes != null ? { total_boxes: sticker.total_boxes } : {}),
  };
}

function uniqueCategoriesFromStandards(allStandards, itemdcode, accCode) {
  const itemStandards = (allStandards || []).filter(
    (std) => String(std.item_dcode) === String(itemdcode)
  );
  const validStandards = itemStandards.filter(
    (std) => !std.acc_code || String(std.acc_code) === String(accCode)
  );
  const uniqueCats = [];
  const seenCatIds = new Set();
  validStandards.forEach((std) => {
    const catId = std.type != null ? String(std.type) : "";
    if (catId && !seenCatIds.has(catId)) {
      seenCatIds.add(catId);
      uniqueCats.push({
        id: catId,
        name: std.category_name || `Category #${catId}`,
      });
    }
  });
  return sortSelectRowsAsc(uniqueCats, "name");
}

/** Packing category (OEM / Market / …) — from standards DB, never from customer ledger name. */
function pickPackingCategoryId(uniqueCats, ...preferredIds) {
  if (!uniqueCats?.length) return "";
  if (uniqueCats.length === 1) return String(uniqueCats[0].id);
  for (const pref of preferredIds) {
    if (pref == null || pref === "") continue;
    const id = String(pref);
    if (uniqueCats.some((c) => String(c.id) === id)) return id;
  }
  return "";
}

/** Display name for packing category — never show raw id (e.g. "1") in UI or snapshot. */
function resolvePackingCategoryName(categories, categoryId, row = {}) {
  const id =
    categoryId != null && String(categoryId).trim() !== ""
      ? String(categoryId).trim()
      : row?.type != null
        ? String(row.type).trim()
        : "";
  const fromCats = (categories || []).find((c) => String(c.id) === id)?.name;
  const candidates = [row?.ims_category, row?.category, fromCats]
    .map((v) => (v != null ? String(v).trim() : ""))
    .filter(Boolean);
  for (const label of candidates) {
    if (!id || label !== id) return label;
  }
  return fromCats || "";
}

function applyPackingCategoryDisplay(row, categories, categoryId) {
  if (!row) return row;
  const typeId =
    categoryId != null && String(categoryId).trim() !== ""
      ? String(categoryId).trim()
      : row.type != null
        ? String(row.type).trim()
        : "";
  const displayName = resolvePackingCategoryName(categories, typeId, row);
  return {
    ...row,
    ...(typeId ? { type: typeId } : {}),
    ...(displayName
      ? { category: displayName, ims_category: displayName }
      : {}),
  };
}

function hasValidPackingDetails(details) {
  return (
    details &&
    Number(details.qty_per_box) > 0 &&
    Number(details.total_stickers) > 0
  );
}

/** Packing doc item — must not change when customer or category is updated. */
function preservePackingProductionIdentity(sourceRow, nextRow) {
  if (!sourceRow || !nextRow) return nextRow ?? sourceRow;
  const itemdesc =
    sourceRow.itemdesc ??
    sourceRow.description ??
    sourceRow.item_desc ??
    nextRow.itemdesc ??
    nextRow.description ??
    nextRow.item_desc;
  return {
    ...nextRow,
    itemdcode: sourceRow.itemdcode ?? nextRow.itemdcode,
    item_code: sourceRow.item_code ?? nextRow.item_code,
    itemdesc,
    description: itemdesc,
    item_desc: itemdesc,
    doc_no: sourceRow.doc_no ?? nextRow.doc_no,
    doc_dt: sourceRow.doc_dt ?? nextRow.doc_dt,
    job_card_no: sourceRow.job_card_no ?? nextRow.job_card_no,
    total_qty: sourceRow.total_qty ?? nextRow.total_qty,
    unit: sourceRow.unit ?? nextRow.unit,
    fg_location: sourceRow.fg_location ?? nextRow.fg_location,
  };
}

async function fetchStickerRowForCategory(row, catId, imsDatePayload) {
  return boxService.getStickers({
    ...stickerFetchBody(row, catId ? { category_id: String(catId) } : {}),
    ...(imsDatePayload ? { ims_date_filter: imsDatePayload } : {}),
  });
}

async function resolveStickerRowForCategory(row, catId, accCode, imsDatePayload) {
  const r = await fetchStickerRowForCategory(row, catId, imsDatePayload);
  if (!r.success || !r.data?.length) {
    return { ok: false, message: r.message || "No packing standard found for this category" };
  }
  const payload = r.data[0];
  if (!hasValidPackingDetails(payload.packing_details)) {
    return {
      ok: false,
      message: r.message || "No packing standard found for this category",
    };
  }
  const chosenAcc =
    accCode != null && String(accCode).trim() !== ""
      ? String(accCode).trim()
      : row?.acc_code != null
        ? String(row.acc_code).trim()
        : "";
  let newData = {
    ...payload,
    acc_code: chosenAcc || payload.acc_code,
    acc_name: row?.acc_name ?? payload.acc_name,
  };
  if (catId) newData.type = String(catId);
  newData.category =
    resolvePackingCategoryName([], catId, newData) ||
    newData.ims_category ||
    newData.category ||
    null;
  newData = await enrichRowPartyRateCustCode(newData, chosenAcc || row?.acc_code);
  newData = preservePackingProductionIdentity(row, newData);
  return { ok: true, data: newData };
}

function StickerDetailCards({selectedRow, packing, generated, isMultiple, categories, selectedCategory, onCategoryChange, onCustomerChange, customerSelectDisabled, customerChanging}) {
  const categoriesAsc = useMemo(() => sortSelectRowsAsc(categories, "name"), [categories]);
  const isSavedSnapshot = generated.length > 0;
  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2">
          <Box className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-blue-600" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-slate-700">Item Details</span>
        </div>
        <div className="p-2 sm:p-3 lg:p-4 space-y-1.5 sm:space-y-2 lg:space-y-2.5">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Item Code</p>
              <p className="text-[11px] sm:text-[12px] lg:text-base font-black text-blue-600 leading-none">{selectedRow.item_code}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Description</p>
            <p className="text-[11px] lg:text-sm font-medium text-slate-600 leading-tight line-clamp-2">{selectedRow.itemdesc || selectedRow.description}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-amber-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-amber-50/50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-amber-100 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-amber-600" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-amber-800">
            {isSavedSnapshot ? "Packing Category (Saved)" : "Packing Category"}
          </span>
        </div>
        <div className="p-2 sm:p-3 lg:p-4 space-y-1.5 sm:space-y-2 lg:space-y-2.5">
          {generated.length > 0 ? (
            <div className="flex items-center justify-between bg-slate-50 px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-slate-100">
              <span className="text-[11px] sm:text-[12px] lg:text-sm font-black text-slate-700 uppercase tracking-tight">{selectedRow.category || "—"}</span>
              <CheckCircle2 className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] text-emerald-500 shrink-0" aria-hidden />
            </div>
          ) : (
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              disabled={!selectedRow?.acc_code}
              className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] lg:text-sm font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {!selectedRow?.acc_code ? (
                <option value="">Select customer first</option>
              ) : (
                <>
                  {isMultiple && <option value="">Select Category</option>}
                  {categoriesAsc.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </>
              )}
            </select>
          )}
          <div className="flex justify-between items-center text-[10px] lg:text-[11px] text-amber-600 font-bold italic">
            <span>{isSavedSnapshot ? "* Locked at generate" : generated.length > 0 ? "* Category Fixed" : null}</span>
            {generated.length === 0 && <span className="bg-amber-100 px-1 rounded">{selectedRow.category || "—"}</span>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2">
          <User className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-500" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-slate-700">
            {isSavedSnapshot ? "Customer (Saved)" : "Customer"}
          </span>
        </div>
        <div className="p-2 sm:p-3 lg:p-4 flex flex-col gap-2 sm:gap-3 min-w-0">
          {!customerSelectDisabled ? (
            <div className={`min-w-0 ${customerChanging ? "opacity-60 pointer-events-none" : ""}`}>
              <SearchableSelect
                label="Customer"
                value={selectedRow.acc_code || ""}
                onChange={onCustomerChange}
                fetchService={(params) =>
                  masterService.getLedgersViews({
                    ...params,
                    permission_module: "packing_entry",
                    permission_action: "view",
                    itemdcode: selectedRow?.itemdcode,
                  })
                }
                getByIdService={(id) =>
                  fetchItemScopedLedgerById(
                    id,
                    {
                      permission_module: "packing_entry",
                      permission_action: "view",
                      itemdcode: selectedRow?.itemdcode,
                    },
                    selectedRow
                  )
                }
                dataKey="id"
                labelKey="acc_name"
                labelOnlyDisplay
                placeholder="Search customer…"
                usePortal
              />
            </div>
          ) : null}

          <div className={`space-y-2 ${!customerSelectDisabled ? "pt-2 border-t border-slate-100" : ""}`}>
            <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
              {customerSelectDisabled ? "Customer" : "Selected customer"}
            </p>
            {selectedRow.acc_code ? (
              <>
                <div>
                  <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Name</p>
                  <p
                    className="text-[12px] lg:text-sm font-bold text-slate-700 leading-snug whitespace-normal break-words"
                    title={selectedRow.acc_name}
                  >
                    {customerChanging ? (
                      <span className="text-slate-400 italic font-medium">Loading…</span>
                    ) : selectedRow.acc_name?.trim() ? (
                      selectedRow.acc_name
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                    Cust. Code (Narration)
                  </p>
                  <p
                    className="text-[12px] lg:text-sm font-bold text-slate-700 leading-snug break-words"
                    title={selectedRow.party_rate_cust_code || undefined}
                  >
                    {customerChanging ? (
                      <span className="text-slate-400 italic font-medium">Loading…</span>
                    ) : selectedRow.party_rate_cust_code?.trim() ? (
                      selectedRow.party_rate_cust_code
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-[11px] lg:text-sm text-slate-400 italic">Select a customer above.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-500" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-slate-700">
            {isSavedSnapshot ? "Production Info (Saved)" : "Production Info"}
          </span>
        </div>
        <div className="p-2 sm:p-3 lg:p-4 grid grid-cols-2 gap-x-2 sm:gap-x-3 gap-y-1.5 sm:gap-y-2 lg:gap-y-3">
          <div>
            <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Job Card</p>
            <p className="text-[11px] lg:text-sm font-bold text-slate-700">{selectedRow.job_card_no}</p>
          </div>
          <div>
            <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Total Qty</p>
            <p className="text-[11px] lg:text-sm font-bold text-slate-700">{Number(selectedRow.total_qty).toLocaleString()} <span className="text-[9px] opacity-60">{selectedRow.unit || "PCS"}</span></p>
          </div>
          <div>
            <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Doc Date</p>
            <p className="text-[11px] lg:text-sm font-bold text-slate-700">{formatDocDate(selectedRow.doc_dt) || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Doc No.</p>
            <p className="text-[11px] lg:text-sm font-bold text-slate-700 truncate">{selectedRow.doc_no || "—"}</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50/30 border border-blue-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-blue-600 px-3 py-1.5 lg:px-4 lg:py-2 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] text-white shrink-0" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-white">
            {isSavedSnapshot ? "Breakdown (Saved)" : "Breakdown Summary"}
          </span>
        </div>
        <div className="p-2 sm:p-3 lg:p-4 space-y-1.5 sm:space-y-2 lg:space-y-2.5">
          <div className="flex justify-between items-center border-b border-blue-100 pb-1">
            <span className="text-[10px] sm:text-[11px] lg:text-[13px] font-bold text-blue-800 uppercase">Qty / Box</span>
            <span className="text-[12px] sm:text-[13px] lg:text-xl font-black text-blue-700 tabular-nums">
              {packing.qty_per_box || 0} <span className="text-[9px] sm:text-[10px] lg:text-xs opacity-60 uppercase">{selectedRow?.unit || "PCS"}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-0.5 lg:gap-3">
            <div className="bg-white border border-blue-100 rounded p-1 sm:p-1.5 lg:p-3 text-center">
              <p className="text-sm sm:text-base lg:text-xl font-black text-blue-600 leading-none">{packing.full_boxes_count || 0}</p>
              <p className="text-[8px] sm:text-[9px] lg:text-[11px] font-bold text-slate-400 uppercase mt-0.5 sm:mt-1">Full Boxes</p>
            </div>
            <div className="bg-white border border-orange-100 rounded p-1 sm:p-1.5 lg:p-3 text-center">
              <p className="text-sm sm:text-base lg:text-xl font-black text-orange-600 leading-none">{packing.loose_box_qty > 0 ? 1 : 0}</p>
              <p className="text-[9px] lg:text-[11px] font-bold text-slate-400 uppercase mt-1">Loose Box</p>
            </div>
          </div>
          {isSavedSnapshot ? (
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-1 border-t border-blue-100">
              <div className="text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Total Stickers</p>
                <p className="text-sm font-black text-indigo-700 tabular-nums">{packing.total_stickers ?? "—"}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Loose Qty</p>
                <p className="text-sm font-black text-orange-700 tabular-nums">
                  {packing.loose_box_qty > 0 ? Number(packing.loose_box_qty).toLocaleString() : "—"}
                </p>
              </div>
            </div>
          ) : null}
          {isSavedSnapshot && selectedRow.fg_location ? (
            <p className="text-[10px] text-blue-800/80 pt-1 border-t border-blue-100">
              <span className="font-bold uppercase">FG location:</span> {selectedRow.fg_location}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

function StickerBreakdownPanel({
  loadingGenerated,
  displayStickerRows,
  isMultiple,
  packingFullCount,
  isGeneratedStickerList,
  dlTracking,
  onDownloadOne,
  headerTitle = "Breakdown",
  showSwipeHint = false,
  canPrint = true,
  flowWithPage = false,
}) {
  const theadStickyClass = flowWithPage
    ? "sticky top-0 z-20 shadow-[0_1px_0_0_rgb(226_232_240)]"
    : "sticky top-0 z-20";

  return (
      <div
        className={
          flowWithPage
            ? "w-full min-w-0"
            : "h-full flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0"
        }
      >
      <div className={`px-2 py-1.5 lg:px-4 lg:py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-1.5 min-w-0 shrink-0 ${flowWithPage ? "lg:hidden" : ""}`}>
        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0 flex-1">
          <Box className="w-4 h-4 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-600" aria-hidden />
          <span className="text-[10px] sm:text-[11px] lg:text-sm font-black uppercase tracking-tight text-slate-800 truncate">{headerTitle}</span>
        </div>
      </div>

      <div
        className={
          flowWithPage
            ? "w-full p-0 lg:p-1"
            : "flex-1 h-full min-h-0 overflow-y-auto overscroll-contain p-0 lg:p-1 touch-pan-y"
        }
      >
        {loadingGenerated ? (
          <div className="h-full min-h-[160px] w-full flex items-center justify-center text-slate-500 gap-2 px-2">
            <Loader2 className="animate-spin shrink-0" size={14} />
            <span className="text-[10px] lg:text-xs font-bold uppercase text-center">Loading stickers…</span>
          </div>
        ) : (
          <>
            {displayStickerRows.length === 0 ? (
              <div className="bg-white border border-slate-200 px-3 py-8 text-center">
                <div className="flex flex-col items-center gap-1.5 text-slate-400">
                  <Layers size={20} className="opacity-20" />
                  <span className="text-[10px] lg:text-xs font-bold uppercase tracking-wide px-1">
                    {isMultiple
                      ? "Select customer and category in Details, then use Generate at the top."
                      : "No packing standard or data unavailable."}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 overflow-hidden w-full max-w-full min-w-0">
                {showSwipeHint ? (
                  <p className="sm:hidden px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
                    Swipe sideways →
                  </p>
                ) : null}
                <div className="overflow-x-auto overscroll-x-contain touch-pan-x max-w-full [-webkit-overflow-scrolling:touch]">
                  <table className="w-full min-w-[460px] sm:min-w-[540px] lg:min-w-[700px] text-left border-separate border-spacing-0">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th
                          scope="col"
                          className={`sticky left-0 top-0 z-[30] bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-600 border-r border-slate-200 whitespace-nowrap ${theadStickyClass}`}
                        >
                          #
                        </th>
                        <th scope="col" className={`${theadStickyClass} bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap`}>
                          Box
                        </th>
                        <th scope="col" className={`${theadStickyClass} bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap`}>
                          Packing
                        </th>
                        <th scope="col" className={`${theadStickyClass} bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap`}>
                          Qty
                        </th>
                        <th scope="col" className={`${theadStickyClass} bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap`}>
                          Type
                        </th>
                        <th scope="col" className={`${theadStickyClass} bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap`}>
                          Status
                        </th>
                        <th
                          scope="col"
                          className={`sticky right-0 top-0 z-[30] bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 text-right whitespace-nowrap border-l border-slate-200 ${theadStickyClass}`}
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayStickerRows.map((row, idx) => {
                        const rowKey = row.box_uid || `${row.box_no}_${idx}`;
                        const isPrinted =
                          row.box_uid != null && row.box_uid !== ""
                            ? !!dlTracking[String(row.box_uid)]
                            : false;

                        return (
                          <tr key={rowKey} className="group border-b border-slate-100 hover:bg-slate-50/70">
                            <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 min-w-0 max-w-[110px] sm:max-w-[180px] lg:max-w-[240px]">
                              <div className="flex flex-col leading-snug min-w-0">
                                <span className={`${isGeneratedStickerList ? "text-blue-700" : "text-slate-800"} font-bold text-[10px] lg:text-xs break-all`}>{row.box_no_uid}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 whitespace-nowrap tabular-nums">{row.package_no}</td>
                            <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-800 whitespace-nowrap tabular-nums">{Number(row.qty).toLocaleString()} {row.unit || "PCS"}</td>
                            <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                              <span className={`text-[8px] lg:text-[11px] font-black px-1 py-0.5 lg:px-1.5 lg:py-0.5 border whitespace-nowrap ${Number(row.box_no) <= packingFullCount ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
                                {Number(row.box_no) <= packingFullCount ? "FULL" : "LOOSE"}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                              {isGeneratedStickerList ? (
                                <span className={`text-[9px] lg:text-[12px] font-bold uppercase whitespace-nowrap ${isPrinted ? "text-emerald-600" : "text-blue-600"}`}>
                                  {isPrinted ? "Downloaded" : "Generated"}
                                </span>
                              ) : (
                                <span className="text-[9px] lg:text-[12px] font-bold text-slate-300 italic uppercase">Ready</span>
                              )}
                            </td>
                            <td className="sticky right-0 z-10 py-1 px-2 lg:py-2 lg:px-2 text-right bg-white group-hover:bg-slate-50 border-l border-slate-100 whitespace-nowrap w-px align-middle">
                              {isGeneratedStickerList && canPrint ? (
                                <button
                                  type="button"
                                  onClick={() => onDownloadOne(row)}
                                  aria-label={isPrinted ? "Re-print sticker" : "Print sticker"}
                                  title={isPrinted ? "Re-print" : "Print"}
                                  className={`touch-manipulation inline-flex items-center justify-center gap-0 border lg:gap-1.5 lg:px-2.5 lg:py-1.5 p-1 min-h-[28px] min-w-[28px] sm:min-h-[32px] sm:min-w-[32px] lg:min-h-0 lg:min-w-0 ${
                                    isPrinted
                                      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                      : "border-blue-400 bg-blue-50 text-blue-700"
                                  }`}
                                >
                                  <Printer className="w-4 h-4 shrink-0 lg:hidden" strokeWidth={2.25} aria-hidden />
                                  <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-black uppercase whitespace-nowrap">
                                    <Printer className="w-4 h-4 shrink-0" strokeWidth={2.25} aria-hidden />
                                    {isPrinted ? "Re-Print" : "Print"}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-[9px] lg:text-[12px] text-slate-300 font-bold px-0.5">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function StickerCreationModel({open, onClose, data, onSuccess, imsDateFilter, downloadSource = STICKER_DOWNLOAD_SOURCE_KEYS.sticker_creation}) {
  const [fetching, setFetching] = useState(false);
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEscapeKey(() => setPreviewOpen(false), previewOpen);
  const canAccess = useCanAccess();
  const canPrintStickers = useMemo(
    () => canAccess("packing_entry", "view").allowed,
    [canAccess]
  );
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLayout, setPreviewLayout] = useState({
    scale: 1,
    w: STICKER_PREVIEW_W_PX,
    h: STICKER_PREVIEW_H_PX,
  });
  const previewAreaRef = useRef(null);
  const sopAckRef = useRef(null);
  const sopSectionRef = useRef(null);
  const stickerBodyScrollRef = useRef(null);
  const [stickers, setStickers] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [generated, setGenerated] = useState([]);
  const [dlTracking, setDlTracking] = useState({});
  const [categories, setCategories] = useState([]);
  const [isMultiple, setIsMultiple] = useState(false);
  const [customerChanging, setCustomerChanging] = useState(false);
  const [stickerTab, setStickerTab] = useState("details"); // details | breakdown (mobile only)
  const imsDatePayload = useMemo(() => {
    if (!imsDateFilter || typeof imsDateFilter !== "object") return undefined;
    const from = imsDateFilter.from_date ?? imsDateFilter.fromDate;
    const to = imsDateFilter.to_date ?? imsDateFilter.toDate;
    if (!from && !to) return undefined;
    const o = {};
    if (from) o.from_date = from;
    if (to) o.to_date = to;
    return Object.keys(o).length ? o : undefined;
  }, [imsDateFilter]);

  const packing = useMemo(() => {
    if (!selectedRow) return {};
    return selectedRow.packing_details || {};
  }, [selectedRow]);

  const stickersByDocAsc = useMemo(
    () => sortSelectRowsAsc(stickers, "doc_no"),
    [stickers]
  );

  useLayoutEffect(() => {
    if (!previewOpen || !previewHtml || previewLoading) return undefined;
    const area = previewAreaRef.current;
    if (!area) return undefined;
    const run = () => {
      const availW = area.clientWidth;
      const availH = area.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      const s = Math.min(1, availW / STICKER_PREVIEW_W_PX, availH / STICKER_PREVIEW_H_PX);
      const scale = Number.isFinite(s) && s > 0 ? s : 1;
      setPreviewLayout({
        scale,
        w: Math.round(STICKER_PREVIEW_W_PX * scale),
        h: Math.round(STICKER_PREVIEW_H_PX * scale),
      });
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(area);
    return () => ro.disconnect();
  }, [previewOpen, previewHtml, previewLoading]);

  const previewRows = useMemo(() => {
    if (!packing.qty_per_box) return [];
    const { total_stickers, full_boxes_count, qty_per_box, loose_box_qty } = packing;
    const pNo = selectedRow?.doc_no || data?.doc_no || "0000";
    const unit = selectedRow?.unit || "PCS";
    return Array.from({ length: total_stickers }, (_, i) => {
      const n = i + 1;
      const isLoose = n > full_boxes_count;
      const previewUid = formatStandardBoxNoUid(pNo, total_stickers, n, getBoxNoUidPrefix());
      return { 
        box_no: n, 
        box_no_uid: previewUid, 
        package_no: pNo, 
        total_boxes: total_stickers, 
        qty: isLoose ? loose_box_qty : qty_per_box, 
        type: isLoose ? "LOOSE" : "FULL",
        unit: unit,
        acc_code: selectedRow?.acc_code,
        acc_name: selectedRow?.acc_name,
        is_customer_overridden: false,
      };
    });
  }, [packing, selectedRow, data]);

  /** Table or mobile cards share the same row source */
  const displayStickerRows = useMemo(
    () => (generated.length > 0 ? generated : previewRows),
    [generated, previewRows]
  );
  const isGeneratedStickerList = generated.length > 0;
  const packingFullCount = Number(packing?.full_boxes_count || 0);

  const hydrateGeneratedFromSummary = useCallback((summaryRows, sourceRow) => {
    if (!summaryRows?.length || !sourceRow) {
      setGenerated([]);
      setDlTracking({});
      return;
    }

    const packingAcc = String(sourceRow.acc_code || "").trim();
    const defaultAccName = sourceRow.acc_name || "";

    const enriched = summaryRows.map((row, idx) => {
      const uid = String(row.box_no_uid || "");
      const parsed = parseStandardBoxNoUid(uid, getBoxNoUidPrefix());
      const parts = uid.split("_");

      const boxNoFromUid = parsed?.boxIndex ?? (parts.length >= 3 ? Number(parts[parts.length - 1]) : null);
      const boxNo = Number.isFinite(boxNoFromUid) ? boxNoFromUid : idx + 1;

      const totalBoxesFromUid =
        parsed?.totalBoxes ?? (parts.length >= 3 ? Number(parts[parts.length - 2]) : summaryRows.length);

      const isLoose = row.is_loose === true || row.is_loose === "true";

      return {
        ...row,
        box_no: boxNo,
        total_boxes: totalBoxesFromUid,
        type: isLoose ? "LOOSE" : "FULL",
        itemdcode: sourceRow.itemdcode,
        acc_code: packingAcc,
        acc_name: defaultAccName,
        is_customer_overridden: false,
        description: sourceRow.description || sourceRow.itemdesc || "",
        job_card_no: sourceRow.job_card_no,
        doc_dt: sourceRow.doc_dt,
        package_no: sourceRow.doc_no,
        fg_location: sourceRow.fg_location || "",
        unit: sourceRow.unit || "PCS",
      };
    });

    const tracked = {};
    enriched.forEach((row) => {
      if (row.box_uid == null || row.box_uid === "") return;
      tracked[String(row.box_uid)] = Number(row.download_count || 0) > 0;
    });

    setGenerated(enriched);
    setDlTracking(tracked);
  }, []);

  const fetchGeneratedSummary = useCallback(async (row) => {
    if (!row?.doc_no) return;
    setLoadingGenerated(true);
    try {
      const res = await boxService.getDownloadSummary({ packing_number: String(row.doc_no) });
      const summaryRows = res.data || [];
      const sourceRow = packingEntryCustomerRow(data, row);

      hydrateGeneratedFromSummary(summaryRows, sourceRow);
      if (res?.sa_adjustment_boxes_exist && !summaryRows.length) {
        toast.info(
          "Stock adjustment stickers exist for this packing. Print or manage them from Stock Adjustment."
        );
      }
    } catch {
      setGenerated([]);
      setDlTracking({});
    } finally {
      setLoadingGenerated(false);
    }
  }, [hydrateGeneratedFromSummary, data]);

  const fetchStickerHistory = useCallback(async () => {
    if (!data?.itemdcode) return;
    setFetching(true);
    try {
      // 1. Fetch ALL approved packing standards for this item AND customer (or general)
      // This ensures categories only come from approved standards.
      // NOTE: use helper API so users without `packing_standard` can still create stickers.
      const standardsRes = await packingStandardService.getViews({
        permission_module: "packing_entry",
        permission_action: "view",
      });
      const allStandards = standardsRes.data || [];
      
      // Filter helper payload to this item only (helper is intentionally broad).
      // 2. Fetch sticker history for the specific document
      const r = await boxService.getStickers({
        ...stickerFetchBody(data),
        ...(imsDatePayload ? { ims_date_filter: imsDatePayload } : {}),
      });
      const raw = r.data || [];
      
      const packingListAcc =
        data?.acc_code != null && String(data.acc_code).trim() !== ""
          ? String(data.acc_code).trim()
          : "";
      const list = raw
        .filter((row) => {
          if (!packingListAcc) return true;
          const rowAcc = row.acc_code != null ? String(row.acc_code).trim() : "";
          return rowAcc === packingListAcc;
        })
        .filter((row, idx, arr) => {
          const key = `${row.doc_no}_${row.acc_code || ""}`;
          return idx === arr.findIndex((x) => `${x.doc_no}_${x.acc_code || ""}` === key);
        });
      setStickers(sortSelectRowsAsc(list, "doc_no"));
      
      if (list.length > 0) {
        const stickersExist = data?.sticker_generated === true;
        const packingAccFromList =
          stickersExist && data?.acc_code != null ? String(data.acc_code).trim() : "";
        const stickerRow =
          list.find((r) => String(r.doc_no) === String(data?.doc_no ?? "")) || list[0];
        const rowBase = stickersExist
          ? withPackingEntryCustomer(stickerRow, data, { lockToPackingList: true })
          : stickerRow;
        const effectiveAcc =
          packingAccFromList ||
          (rowBase?.acc_code != null ? String(rowBase.acc_code).trim() : "") ||
          (data?.acc_code != null ? String(data.acc_code).trim() : "");
        const uniqueCats = uniqueCategoriesFromStandards(
          allStandards,
          data.itemdcode,
          effectiveAcc
        );

        setCategories(sortSelectRowsAsc(uniqueCats, "name"));
        setIsMultiple(uniqueCats.length > 1);

        let firstRow = applyPackingCategoryDisplay(
          await enrichRowPartyRateCustCode(rowBase, effectiveAcc),
          uniqueCats,
          stickerRow.type
        );
        setSelectedRow(firstRow);

        const catId = pickPackingCategoryId(uniqueCats, firstRow.type, stickerRow.type);
        let autoSelected = false;

        // Generated + DB snapshot: use frozen packing_details (no extra category API).
        if (stickersExist && stickerRow?.packing_details?.qty_per_box) {
          const snapRow = applyPackingCategoryDisplay(
            {
              ...firstRow,
              packing_details: stickerRow.packing_details,
              fg_location: stickerRow.fg_location ?? data?.fg_location ?? firstRow.fg_location,
              full_boxes_count: stickerRow.packing_details?.full_boxes_count ?? data?.full_boxes_count,
              total_stickers: stickerRow.packing_details?.total_stickers ?? data?.total_stickers,
            },
            uniqueCats,
            catId || stickerRow.type
          );
          setSelectedRow(snapRow);
          if (catId) setSelectedCategory(catId);
          else if (stickerRow.type) setSelectedCategory(String(stickerRow.type));
          setIsMultiple(uniqueCats.length <= 1);
          autoSelected = true;
        } else if (catId && effectiveAcc) {
          setSelectedCategory(catId);
          autoSelected = true;

          const resolved = await resolveStickerRowForCategory(firstRow, catId, effectiveAcc, imsDatePayload);
          if (resolved.ok) {
            setSelectedRow(
              applyPackingCategoryDisplay(
                stickersExist
                  ? withPackingEntryCustomer(resolved.data, data, { lockToPackingList: true })
                  : resolved.data,
                uniqueCats,
                catId
              )
            );
            setIsMultiple(uniqueCats.length <= 1);
          } else {
            autoSelected = false;
            setSelectedCategory("");
          }
        } else if (firstRow.type) {
          setSelectedCategory(String(firstRow.type));
        }

        if (uniqueCats.length > 1 && !autoSelected) {
          toast.info("Select customer (if needed), then choose a packing category.");
        }
      }
    } catch (err) { 
      console.error("Error loading sticker history:", err);
      toast.error("Failed to load sticker data."); 
    }
    finally { setFetching(false); }
  }, [data, data?.itemdcode, data?.doc_no, data?.doc_dt, data?.total_qty, data?.acc_code, data?.acc_name, imsDatePayload]);

  useEffect(() => {
    if (!open) {
      setStickers([]);
      setSelectedRow(null);
      setGenerated([]);
      setDlTracking({});
      setIsMultiple(false);
      setStickerTab("details");
      setPreviewOpen(false);
      setPreviewHtml("");
      setPreviewLoading(false);
      setPreviewLayout({ scale: 1, w: STICKER_PREVIEW_W_PX, h: STICKER_PREVIEW_H_PX });
      setCustomerChanging(false);
      return;
    }
    void fetchStickerHistory();
  }, [open, data?.doc_no, fetchStickerHistory]);

  useEffect(() => {
    if (open && selectedRow?.doc_no) {
      fetchGeneratedSummary(selectedRow);
      
      // Sync dropdown with selectedRow.type ONLY when the record changes
      // and NOT if we are in a "Multiple Categories" state (where we want to force selection)
      const rowType = selectedRow.type ? String(selectedRow.type) : "";
      if (rowType && !isMultiple) {
        setSelectedCategory(rowType);
      }
    }
  }, [open, selectedRow?.doc_no, isMultiple, fetchGeneratedSummary]);

  const stickerTabDocRef = useRef(null);
  useEffect(() => {
    if (!open) {
      stickerTabDocRef.current = null;
      return;
    }
    if (!selectedRow?.doc_no) return;
    if (stickerTabDocRef.current === selectedRow.doc_no) return;
    stickerTabDocRef.current = selectedRow.doc_no;
    setStickerTab("details");
  }, [open, selectedRow?.doc_no]);

  const handleCustomerChange = useCallback(
    async (accCode, ledgerObj) => {
      if (!accCode || !selectedRow?.doc_no) return;
      if (String(accCode) === String(selectedRow.acc_code || "")) return;

      const accName = ledgerObj?.acc_name || selectedRow.acc_name || "";
      // Sync value immediately — SearchableSelect re-syncs on dropdown close; delayed acc_code
      // would revert the trigger to the previous customer until async enrich finishes.
      setSelectedRow((prev) =>
        prev ? { ...prev, acc_code: accCode, acc_name: accName } : prev
      );

      setCustomerChanging(true);
      try {
        const enriched = await enrichRowPartyRateCustCode(
          { ...selectedRow, acc_code: accCode, acc_name: accName },
          accCode
        );
        setSelectedRow((prev) =>
          prev
            ? {
                ...prev,
                acc_code: accCode,
                acc_name: enriched.acc_name ?? accName,
                party_rate_cust_code: enriched.party_rate_cust_code ?? null,
              }
            : prev
        );
        setGenerated((prev) =>
          prev.length
            ? prev.map((r) => ({
                ...r,
                acc_code: accCode,
                acc_name: enriched.acc_name ?? accName,
                party_rate_cust_code: enriched.party_rate_cust_code ?? null,
              }))
            : prev
        );
      } catch {
        toast.error("Failed to update customer");
      } finally {
        setCustomerChanging(false);
      }
    },
    [selectedRow]
  );

  const handleCategoryChange = async (catId) => {
    if (!catId || !selectedRow?.doc_no) return;
    if (!selectedRow?.acc_code) {
      toast.warn("Please select a customer before choosing a category.");
      return;
    }

    setSelectedCategory(String(catId));

    try {
      const resolved = await resolveStickerRowForCategory(
        selectedRow,
        catId,
        selectedRow.acc_code,
        imsDatePayload
      );

      if (resolved.ok) {
        setSelectedRow(applyPackingCategoryDisplay(resolved.data, categories, catId));
        setIsMultiple(false);
        return;
      }

      const cleared = await enrichRowPartyRateCustCode(
        {
          ...selectedRow,
          type: String(catId),
          packing_details: null,
          standard_id: null,
          packing_standard_id: null,
          standard_qty_per_box: null,
          ims_category: null,
          party_rate_cust_code: null,
        },
        selectedRow.acc_code
      );
      setSelectedRow(cleared);
      toast.warn(resolved.message || "No packing standard found for this category");
    } catch {
      toast.error("Failed to update breakdown");
    }
  };

  const handlePackingClick = async (record) => {
    setFetching(true);
    try {
      // Re-fetch the specific record to check for multiple categories
      const r = await boxService.getStickers({
        ...stickerFetchBody(record),
        ...(imsDatePayload ? { ims_date_filter: imsDatePayload } : {}),
      });
      
      const raw = r.data || [];
      if (raw.length > 0) {
        const fetchedRecord = await enrichRowPartyRateCustCode(raw[0], raw[0].acc_code);
        setIsMultiple(!!r.multiple_categories);
        setSelectedRow(fetchedRecord);
        
        if (r.multiple_categories) {
          setSelectedCategory(""); // Force selection
        } else if (fetchedRecord.type) {
          setSelectedCategory(String(fetchedRecord.type));
        }
      }
    } catch (err) {
      toast.error("Failed to switch packing record.");
    } finally {
      setFetching(false);
    }
  };

  const scrollToSopSection = useCallback(() => {
    requestAnimationFrame(() => {
      sopSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      sopAckRef.current?.focusAcknowledgment?.();
    });
  }, []);

  const assertSopOrScroll = useCallback(() => {
    if (sopAckRef.current?.assertAcknowledged()) return true;
    scrollToSopSection();
    return false;
  }, [scrollToSopSection]);

  const handleGenerate = async () => {
    if (!packing.total_stickers || !packing.qty_per_box) {
      return toast.error("Invalid Configuration: No packing standard found for this category.");
    }
    if (!selectedCategory) return toast.error("Please select a category before generating.");
    if (!assertSopOrScroll()) return;

    setSubmitting(true);
    try {
      const packingCustomer = packingEntryCustomerRow(data, selectedRow);
      const categoryName = resolvePackingCategoryName(categories, selectedCategory, selectedRow);
      const body = {
        doc_no: selectedRow.doc_no,
        itemdcode: selectedRow.itemdcode,
        item_code: selectedRow.item_code,
        acc_name: packingCustomer.acc_name,
        acc_code: packingCustomer.acc_code,
        party_rate_cust_code: packingCustomer.party_rate_cust_code,
        doc_dt: selectedRow.doc_dt,
        job_card_no: selectedRow.job_card_no,
        total_qty: selectedRow.total_qty,
        unit: selectedRow.unit,
        category_id: selectedCategory,
        category_name: categoryName,
        itemdesc: packingCustomer.itemdesc || packingCustomer.description || "",
        fg_location: packingCustomer.fg_location || "",
        internal_create_user:
          selectedRow.internal_create_user ||
          selectedRow.userc ||
          data?.internal_create_user ||
          data?.userc ||
          null,
        internal_create_date:
          selectedRow.internal_create_date ||
          selectedRow.datec ||
          data?.internal_create_date ||
          data?.datec ||
          null,
        packing_config: packing,
      };

      const res = await boxService.generateStickers(body);
      const enriched = (res.data || []).map((row) => ({
        ...row,
        itemdcode: packingCustomer.itemdcode,
        acc_code: packingCustomer.acc_code,
        acc_name: packingCustomer.acc_name,
        description: packingCustomer.itemdesc || packingCustomer.description || "",
        job_card_no: packingCustomer.job_card_no,
        doc_dt: packingCustomer.doc_dt,
        fg_location: packingCustomer.fg_location || "",
        is_customer_overridden: false,
      }));

      setGenerated(enriched);
      setDlTracking({});
      setSelectedRow((prev) =>
        prev
          ? applyPackingCategoryDisplay(
              {
                ...prev,
                ...packingCustomer,
                packing_details: packing,
              },
              categories,
              selectedCategory
            )
          : prev
      );
      await fetchGeneratedSummary({ ...selectedRow, ...packingCustomer, category: categoryName });
      toast.success("Stickers generated successfully.");
      setStickerTab("breakdown");
    } catch (err) {
      const p = err?.payload;
      if (p?.code === "MONTHLY_QTY_EXCEEDED") {
        const msg =
          p.message ||
          `Monthly packing qty (${p.projected_total}) exceeds allowed limit (${p.allowed_limit}).`;
        if (p.can_create_deviation) {
          toast.warning(msg, { autoClose: 9000 });
        } else {
          toast.info(msg, { autoClose: 9000 });
        }
      } else {
        toast.error(err.message || "Generation failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = async () => {
    if (!packing.total_stickers || !packing.qty_per_box) {
      return toast.error("Invalid Configuration: No packing standard found for this category.");
    }
    if (!selectedCategory) return toast.error("Please select a category before preview.");
    // if (!assertSopOrScroll()) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewHtml("");
    try {
      const res = await boxService.previewSticker({
        doc_no: selectedRow.doc_no,
        itemdcode: selectedRow.itemdcode,
        item_code: selectedRow.item_code,
        acc_name: selectedRow.acc_name,
        acc_code: selectedRow.acc_code,
        doc_dt: selectedRow.doc_dt,
        job_card_no: selectedRow.job_card_no,
        unit: selectedRow.unit,
        packing_config: packing,
      });
      setPreviewHtml(res.html || "");
    } catch (err) {
      toast.error(err?.message || "Preview failed");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePrintOne = async (sticker) => {
    if (!canPrintStickers) {
      toast.info("Sticker print requires Packing Entry view permission.");
      return;
    }
    try {
      const res = await boxService.renderSingleSticker({
        box_uid: Number(sticker.box_uid),
        device_type: getDeviceType(),
        download_source: downloadSource,
        permission_module: "packing_entry",
        permission_action: "view",
        sticker_meta: buildStickerPrintMeta(packingEntryCustomerRow(data, selectedRow), sticker),
      });
      printFromBackendHtml(res.html, {
        title:
          res.print_title ??
          (selectedRow?.doc_no ? `Packing No. ${String(selectedRow.doc_no).trim()}` : undefined),
      });
      setDlTracking((prev) => ({ ...prev, [String(sticker.box_uid)]: true }));
    } catch (err) {
      toast.error(err?.message || "Sticker print failed.");
    }
  };

  const handlePrintAll = useCallback(async () => {
    if (!canPrintStickers) {
      toast.info("Sticker print requires Packing Entry view permission.");
      return;
    }
    if (!selectedRow || !generated.length) return;
    if (downloadingAll) return;
    setDownloadingAll(true);
    try {
      const packingRow = packingEntryCustomerRow(data, selectedRow);
      const res = await boxService.renderBulkStickers({
        packing_number: String(selectedRow.doc_no),
        box_uids: generated.map(s => s.box_uid),
        device_type: getDeviceType(),
        download_source: downloadSource,
        permission_module: "packing_entry",
        permission_action: "view",
        sticker_meta: buildStickerPrintMeta(packingRow),
      });
      printFromBackendHtml(res.html, {
        title:
          res.print_title ??
          (selectedRow?.doc_no ? `Packing No. ${String(selectedRow.doc_no).trim()}` : undefined),
      });
      const all = {};
      generated.forEach((s) => {
        if (s.box_uid != null && s.box_uid !== "") all[String(s.box_uid)] = true;
      });
      setDlTracking(all);
    } catch (err) {
      toast.error(err?.message || "Bulk sticker print failed");
    } finally {
      setDownloadingAll(false);
    }
  }, [canPrintStickers, selectedRow, generated, downloadingAll, downloadSource, data]);

  const printAllHotkeyRef = useRef(handlePrintAll);
  printAllHotkeyRef.current = handlePrintAll;

  return (
    <Drawer 
      isOpen={open} 
      onClose={onClose} 
      onSubmit={generated.length === 0 ? handleGenerate : undefined}
      onPrintHotkey={
        canPrintStickers && generated.length > 0
          ? () => {
              void printAllHotkeyRef.current();
            }
          : undefined
      }
      canPrintHotkey={() => canPrintStickers && !downloadingAll && generated.length > 0 && !!selectedRow}
      title="Sticker Control" 
      maxWidth="max-w-full xl:max-w-7xl" 
      noPadding
      bodyScrollable={false}
    >
      <div className="w-full max-w-full flex-1 h-full min-h-0 flex flex-col bg-slate-50">
        {fetching ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : !selectedRow ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">No Production Records Found</div>
        ) : (
          <>
            <div className="shrink-0 z-20 bg-white border-b px-2 md:px-4 py-1.5 sm:py-2 md:py-3 flex flex-col md:flex-row items-stretch md:items-center gap-1.5 sm:gap-2 md:gap-3 shadow-sm w-full max-w-full min-w-0">
              
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:flex-1 min-w-0 pb-1 -mb-1">
                {stickersByDocAsc.map(s => (
                  <div 
                    key={`${s.doc_no}_${s.acc_code || ""}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handlePackingClick(s); } }}
                    className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-[11px] md:text-xs font-bold transition-all border shrink-0 text-left min-w-[96px] sm:min-w-[110px] md:min-w-[140px] cursor-pointer touch-manipulation select-none active:opacity-90 ${String(selectedRow.doc_no) === String(s.doc_no) ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : "bg-white border-slate-200 text-slate-500"}`}
                  >
                    <p className="text-[8px] uppercase font-bold opacity-70 mb-0.5">Packing No</p>
                    <span className="block text-[10px] md:text-[11px] font-black tracking-wide">#{s.doc_no}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto shrink-0 justify-end border-t md:border-t-0 pt-2 md:pt-0 min-w-0">
                <div className="flex flex-wrap items-stretch justify-end gap-1.5 flex-1 min-w-[120px] sm:min-w-[180px]">
                  {canPrintStickers && generated.length > 0 ? (
                    <button 
                      type="button"
                      onClick={() => void handlePrintAll()} 
                      disabled={downloadingAll}
                      title="Print all stickers (Ctrl+Alt+P / Ctrl+P in app)"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-md sm:shadow-lg whitespace-nowrap disabled:bg-emerald-300 touch-manipulation flex-1 sm:flex-initial min-h-[34px] sm:min-h-0"
                    >
                      {downloadingAll ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Printer size={14} className="shrink-0" />}
                      <span className="lg:hidden">{downloadingAll ? "…" : "ALL"}</span>
                      <span className="hidden lg:inline">{downloadingAll ? "PREPARING…" : "PRINT ALL"}</span>
                      {!downloadingAll && <span className="text-[9px] sm:text-[10px] opacity-90 tabular-nums">({Object.keys(dlTracking).length}/{generated.length})</span>}
                    </button>
                  ) : packing.total_stickers && packing.qty_per_box ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePreview}
                        disabled={submitting || previewLoading || (categories.length > 1 && !selectedCategory)}
                        className="bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-800 px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-sm whitespace-nowrap touch-manipulation flex-1 sm:flex-initial min-h-[34px] sm:min-h-0"
                        title="See how the first sticker will look (print layout); confirm SOP at the bottom if required"
                      >
                        {previewLoading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Eye size={14} className="shrink-0" />}
                        <span className="lg:hidden">Preview</span>
                        <span className="hidden lg:inline">PREVIEW (1)</span>
                      </button>
                    <button 
                      type="button"
                      onClick={handleGenerate} 
                      disabled={submitting || previewLoading || (categories.length > 1 && !selectedCategory)}
                      className="bg-slate-900 hover:bg-black disabled:bg-slate-400 text-white px-2 sm:px-6 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-md sm:shadow-lg whitespace-nowrap touch-manipulation flex-1 sm:flex-initial min-h-[34px] sm:min-h-0"
                      title="Confirm SOP at the bottom if required"
                    >
                      {submitting ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Printer size={14} className="shrink-0" />}
                      <span className="lg:hidden">Generate ({packing.total_stickers || 0})</span>
                      <span className="hidden lg:inline">GENERATE ({packing.total_stickers || 0})</span>
                    </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Sections"
              className="lg:hidden grid grid-cols-2 gap-1 shrink-0 px-2 pt-1.5 pb-1 bg-slate-100/90 border-b border-slate-200"
            >
              {[
                { id: "details", label: "Details" },
                { id: "breakdown", label: displayStickerRows.length ? `Boxes · ${displayStickerRows.length}` : "Boxes" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={stickerTab === tab.id}
                  onClick={() => setStickerTab(tab.id)}
                  className={`rounded-md py-1.5 px-2 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-tight transition-all touch-manipulation active:opacity-90 ${
                    stickerTab === tab.id
                      ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                      : "bg-slate-200/70 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div
              ref={stickerBodyScrollRef}
              className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden custom-scrollbar"
            >
              <div className="hidden lg:flex flex-col w-full bg-slate-50 border-t border-slate-200">
                <div className="flex flex-row items-start w-full">
                  <aside className="w-72 xl:w-80 shrink-0 border-r border-slate-200 bg-slate-50">
                    <div className="p-3 space-y-3">
                      <StickerDetailCards
                        selectedRow={selectedRow}
                        packing={packing}
                        generated={generated}
                        isMultiple={isMultiple}
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onCategoryChange={handleCategoryChange}
                        onCustomerChange={handleCustomerChange}
                        customerSelectDisabled={generated.length > 0}
                        customerChanging={customerChanging}
                      />
                    </div>
                  </aside>
                  <section className="flex-1 flex flex-col min-w-0 bg-white">
                    <StickerBreakdownPanel
                      loadingGenerated={loadingGenerated}
                      displayStickerRows={displayStickerRows}
                      isMultiple={isMultiple}
                      packingFullCount={packingFullCount}
                      isGeneratedStickerList={isGeneratedStickerList}
                      dlTracking={dlTracking}
                      onDownloadOne={handlePrintOne}
                      canPrint={canPrintStickers}
                      headerTitle="Breakdown"
                      showSwipeHint={false}
                      flowWithPage
                    />
                  </section>
                </div>
              </div>

              <div className="lg:hidden flex flex-col bg-slate-100/90 border-t border-slate-200">
                <div className="mx-1.5 sm:mx-2 mb-1.5 sm:mb-2 bg-white border border-slate-200 flex flex-col">
                  {stickerTab === "breakdown" ? (
                    <StickerBreakdownPanel
                      loadingGenerated={loadingGenerated}
                      displayStickerRows={displayStickerRows}
                      isMultiple={isMultiple}
                      packingFullCount={packingFullCount}
                      isGeneratedStickerList={isGeneratedStickerList}
                      dlTracking={dlTracking}
                      onDownloadOne={handlePrintOne}
                      canPrint={canPrintStickers}
                      headerTitle="Breakdown"
                      showSwipeHint
                      flowWithPage
                    />
                  ) : (
                    <div className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 bg-slate-50/50">
                      <StickerDetailCards
                        selectedRow={selectedRow}
                        packing={packing}
                        generated={generated}
                        isMultiple={isMultiple}
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onCategoryChange={handleCategoryChange}
                        onCustomerChange={handleCustomerChange}
                        customerSelectDisabled={generated.length > 0}
                        customerChanging={customerChanging}
                      />
                    </div>
                  )}
                </div>
              </div>

              {generated.length === 0 ? (
                <div
                  ref={sopSectionRef}
                  className="w-full px-2 sm:px-3 md:px-4 py-3 md:py-4 border-t border-amber-200 bg-amber-50/50"
                >
                  <ModuleSopAcknowledgment
                    ref={sopAckRef}
                    key={`${open}-add-${selectedRow?.doc_no}-${selectedRow?.itemdcode}`}
                    moduleSlug="packing_entry"
                    permissionType="add"
                    isOpen={open && !!selectedRow}
                    requireAckWhenPresent
                    showRejectToast={false}
                  />
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {typeof document !== "undefined" &&
        previewOpen &&
        createPortal(
        <div
          className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/55 p-1.5 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sticker-preview-title"
          onClick={() => !previewLoading && setPreviewOpen(false)}
        >
          <div
            className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
            style={{ width: "min(calc(5.7in + 2.5rem), calc(100vw - 1rem))", maxHeight: "92dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-2.5 sm:px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <h2 id="sticker-preview-title" className="text-[10px] sm:text-sm font-black text-slate-800 uppercase tracking-tight truncate">
                  Sticker preview
                </h2>
                <p className="text-[9px] sm:text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-2 sm:line-clamp-none">
                  Box 1 / {packing.total_stickers || "—"} — print layout
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                disabled={previewLoading}
                className="shrink-0 p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-50 touch-manipulation"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
            <div
              ref={previewAreaRef}
              className="flex flex-1 min-h-[calc(3.6in+2rem)] max-h-[calc(92dvh-3.25rem)] justify-center items-center p-4 sm:p-5 bg-slate-200/80 overflow-hidden"
            >
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 sm:py-12 text-slate-600">
                  <Loader2 className="animate-spin w-6 h-6 sm:w-8 sm:h-8" />
                  <span className="text-[10px] sm:text-xs font-bold uppercase">Loading…</span>
                </div>
              ) : previewHtml ? (
                <div
                  className="relative shrink-0 overflow-hidden bg-white shadow-lg"
                  style={{ width: previewLayout.w, height: previewLayout.h }}
                  title="Print layout (5.7in × 3.6in)"
                >
                  <iframe
                    title="Sticker print preview"
                    srcDoc={previewHtml}
                    scrolling="no"
                    className="block border-0 pointer-events-none bg-white"
                    style={{
                      width: STICKER_PREVIEW_W_PX,
                      height: STICKER_PREVIEW_H_PX,
                      transform: `scale(${previewLayout.scale})`,
                      transformOrigin: "top left",
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-12">No preview data.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </Drawer>
  );
}

