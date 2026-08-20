"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Loader2, Shield, QrCode, ScanLine, X, Package, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "react-toastify";

import { qcHoldMaterialService } from "@/apps/ims/lib/services/qcHoldMaterial";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import Snackbar from "@/ui/primitives/Snackbar";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { detectQrType, parseBoxScanRaw, boxNoUidDisplayLabel } from "@/apps/ims/lib/helpers/qrScan";
import { prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { SCAN_SNACK_MSG, notifyDecodeSuppressedScan, markRecentScanSuccess, shouldSilenceScanDuplicate, useScanSnackbarActions } from "@/platform/utils/global";
import { OK_INPUT, ERR_INPUT, FORM_LABEL_CLASS } from "@/ui/common/Constants";
import { activeQcHoldModePickerOptions, activeQcHoldPendingScanOptions, QC_HOLD_PICKER_ACCENT, QC_HOLD_PICKER_ICONS, QC_HOLD_MODE_PENDING, QC_HOLD_MODE_PARTIAL, QC_HOLD_MODE_FULL, QC_HOLD_MODE_REVERT, QC_HOLD_SCAN_PARTIAL, QC_HOLD_SCAN_FULL, defaultQcHoldScanMode, formatQcHoldActiveHoldLabel, getQcHoldPickerOption, isPendingHoldMode, isSubmitMode, isFullSubmitMode, isRevertSubmitMode, isFullPendingScanMode, mapQcHoldSelectRow, QC_HOLD_PARTIAL_ENABLED, submissionTypeForPickerMode, pickerIdFromSubmissionType } from "@/apps/ims/lib/utils/qcHoldTypes";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import TypeableSuggestField from "@/ui/common/forms/TypeableSuggestField";

const SCANNER_ID = "qc-hold-material-scanner";
const SNACK_DUR = { short: 3200, med: 4000 };
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: SNACK_DUR.med };

const INITIAL_FORM = {
  reason: "",
  remarks: "",
  status: "pending",
  approved: false,
};

function parseStoredBoxUids(editData) {
  if (!editData) return [];
  if (Array.isArray(editData.scanned_box_uids_list)) return editData.scanned_box_uids_list;
  if (Array.isArray(editData.scanned_box_uids)) return editData.scanned_box_uids;
  try {
    const parsed = JSON.parse(editData.scanned_box_uids || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const INITIAL_SUBMIT_FORM = {
  completed_qty: "",
  rejected_qty: "0",
  reason: "",
  remarks: "",
};

function fmtQty(qty) {
  return `${Number(qty || 0).toLocaleString()} qty`;
}

function holdBalanceSnapshot(hold) {
  if (!hold) return null;
  return {
    totalQty: Number(hold.total_qty ?? hold.qty ?? 0),
    completedQty: Number(hold.completed_qty ?? 0),
    rejectedQty: Number(hold.rejected_qty ?? 0),
    balanceQty: Number(hold.balance_qty ?? 0),
  };
}

function calcFullSubmitDerived(snap, completedQtyRaw) {
  const parsed = completedQtyRaw === "" ? 0 : Math.max(0, parseInt(completedQtyRaw, 10) || 0);
  const rejectedQty = Math.max(0, snap.balanceQty - parsed);
  return { rejected_qty: String(rejectedQty) };
}

function buildFullSubmitFields(hold) {
  const snap = holdBalanceSnapshot(hold);
  if (!snap) return { completed_qty: "", rejected_qty: "0" };
  const completedQtyRaw = String(snap.balanceQty);
  return {
    completed_qty: completedQtyRaw,
    ...calcFullSubmitDerived(snap, completedQtyRaw),
  };
}

function parseSubmitNumbers(submitForm) {
  return {
    completedQty: Math.max(0, parseInt(submitForm.completed_qty, 10) || 0),
    rejectedQty: Math.max(0, parseInt(submitForm.rejected_qty, 10) || 0),
  };
}

function getSubmitFieldLimits(snap, submitForm) {
  const { completedQty, rejectedQty } = parseSubmitNumbers(submitForm);
  return {
    completedQtyMax: Math.max(0, snap.balanceQty - rejectedQty),
    rejectedQtyMax: Math.max(0, snap.balanceQty - completedQty),
  };
}

function validateSubmitQtyAgainstBalance(snap, submitForm, { isFullFlow = false } = {}) {
  if (!snap) return null;
  const { completedQty, rejectedQty } = parseSubmitNumbers(submitForm);

  if (isFullFlow) {
    if (completedQty <= 0 && rejectedQty <= 0) {
      return "Enter completed quantity for this full submit.";
    }
    if (completedQty > snap.balanceQty) {
      return `Completed quantity (${completedQty.toLocaleString()}) cannot exceed the hold balance (${snap.balanceQty.toLocaleString()}).`;
    }
    if (rejectedQty > snap.balanceQty) {
      return `Rejected quantity (${rejectedQty.toLocaleString()}) cannot exceed the hold balance (${snap.balanceQty.toLocaleString()}).`;
    }
    return null;
  }

  if (completedQty <= 0) {
    return "Enter completed quantity to request approval.";
  }
  if (rejectedQty > 0) {
    return "Rejected quantity is only allowed on final submit.";
  }
  if (completedQty > snap.balanceQty) {
    return `Completed quantity (${completedQty.toLocaleString()}) cannot exceed the hold balance (${snap.balanceQty.toLocaleString()}).`;
  }
  return null;
}

function fetchQcHoldReasonSuggestions(search = "") {
  return qcHoldMaterialService.getReasons({ search }).then((res) =>
    Array.isArray(res?.data) ? res.data : []
  );
}

function HoldSubmitBalancePanel({ hold, submitForm, onFieldChange, isFullFlow, errors = {}, readOnly = false, authorizeEdit = false }) {
  const [open, setOpen] = useState(true);
  const snap = holdBalanceSnapshot(hold);

  useEffect(() => {
    setOpen(true);
  }, [hold?.hold_id]);

  if (!snap) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-500">
        Select a hold above to see balance and enter this submission.
      </div>
    );
  }

  const { completedQty, rejectedQty } = parseSubmitNumbers(submitForm);
  const limits = getSubmitFieldLimits(snap, submitForm);
  const thisSubmitQty = isFullFlow ? completedQty + rejectedQty : completedQty;
  const afterApproveQty = Math.max(0, snap.balanceQty - thisSubmitQty);
  const exceedsQty = thisSubmitQty > snap.balanceQty;
  const completedQtyExceeds = completedQty > snap.balanceQty || completedQty > limits.completedQtyMax;
  const hasQtyError = exceedsQty || completedQtyExceeds;
  const rejectIsAuto = isFullFlow && !readOnly;

  const panelAccent = isFullFlow
    ? "border-yellow-200 bg-yellow-50/30"
    : "border-indigo-200 bg-indigo-50/30";
  const panelTitle = isFullFlow ? "text-yellow-900" : "text-indigo-900";
  const panelBadge = isFullFlow
    ? "bg-yellow-100 text-yellow-900 border-yellow-200"
    : "bg-indigo-100 text-indigo-900 border-indigo-200";

  return (
    <div className={`rounded-lg border overflow-hidden ${panelAccent}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        className="w-full px-2.5 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-left hover:bg-white/50 transition-colors border-b border-slate-100/80 min-h-[40px]"
      >
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
          Hold summary
        </span>
        <span className="text-[11px] font-semibold text-slate-800 truncate min-w-0">
          #{hold.hold_id} · #{hold.packing_number || "—"}
        </span>
        <span className={`shrink-0 px-2 py-0.5 text-[8px] font-black uppercase border rounded ${panelBadge}`}>
          Bal {fmtQty(snap.balanceQty)}
        </span>
        <ChevronRight
          className={`text-slate-400 shrink-0 ml-auto transition-transform ${open ? "rotate-90" : ""}`}
          size={16}
        />
      </button>

      {open ? (
        <div className="bg-white/80">
          <div className="px-2.5 py-2 border-b border-slate-100">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] leading-snug">
              <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <dt className="text-[8px] font-bold text-slate-400 uppercase">Total hold</dt>
                <dd className="font-semibold text-slate-800 tabular-nums">{fmtQty(snap.totalQty)}</dd>
              </div>
              <div className="min-w-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5">
                <dt className="text-[8px] font-bold text-amber-700 uppercase">Balance left</dt>
                <dd className="font-black text-amber-800 tabular-nums">{fmtQty(snap.balanceQty)}</dd>
              </div>
              <div className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50/80 px-2 py-1.5">
                <dt className="text-[8px] font-bold text-emerald-600 uppercase">Completed</dt>
                <dd className="font-semibold text-emerald-700 tabular-nums">{fmtQty(snap.completedQty)}</dd>
              </div>
              <div className="min-w-0 rounded-md border border-rose-200 bg-rose-50/80 px-2 py-1.5">
                <dt className="text-[8px] font-bold text-rose-500 uppercase">Rejected</dt>
                <dd className="font-semibold text-rose-700 tabular-nums">{fmtQty(snap.rejectedQty)}</dd>
              </div>
            </dl>
          </div>

          <div className="px-2.5 py-2 space-y-3">
            <p className={`text-[9px] font-black uppercase tracking-wide ${panelTitle}`}>
              {authorizeEdit
                ? isFullFlow
                  ? "Adjust completed qty before authorizing"
                  : "Adjust passed qty before authorizing"
                : readOnly
                  ? "Submission for approval"
                  : isFullFlow
                    ? "Full submit — enter completed qty only"
                    : "Partial submit — enter passed qty to approve"}
            </p>

            {isFullFlow ? (
              <div className="space-y-2">
                <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/60 overflow-hidden">
                  <div className="px-2.5 py-2 border-b border-emerald-200/80 bg-emerald-100/50 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase text-emerald-800 leading-tight">Completed qty</p>
                      <p className="text-[8px] font-semibold text-emerald-700/90 leading-tight">QC passed — conforming material</p>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      max={snap.balanceQty}
                      value={submitForm.completed_qty}
                      onChange={(e) => onFieldChange("completed_qty", e.target.value)}
                      placeholder={String(snap.balanceQty)}
                      readOnly={readOnly}
                      disabled={readOnly}
                      className={`${OK_INPUT} border-emerald-200 focus:border-emerald-400 ${
                        completedQtyExceeds ? "border-rose-400 bg-rose-50" : ""
                      } ${readOnly ? "bg-slate-50 cursor-default" : ""}`}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-rose-200 bg-rose-50/50 px-2.5 py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <XCircle size={15} className="text-rose-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase text-rose-800 leading-tight">Rejected qty</p>
                      <p className="text-[8px] font-semibold text-rose-700/90 leading-tight">
                        {rejectIsAuto ? "Auto — balance minus completed" : "QC failed — non-conforming material"}
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-black text-rose-800 tabular-nums shrink-0">
                    {rejectedQty.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/60 overflow-hidden">
                <div className="px-2.5 py-2 border-b border-emerald-200/80 bg-emerald-100/50 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-emerald-800 leading-tight">Completed qty</p>
                    <p className="text-[8px] font-semibold text-emerald-700/90 leading-tight">
                      QC passed — request approval for this quantity
                    </p>
                  </div>
                </div>
                <div className="p-2.5">
                  <input
                    type="number"
                    min="0"
                    max={snap.balanceQty}
                    value={submitForm.completed_qty}
                    onChange={(e) => onFieldChange("completed_qty", e.target.value)}
                    placeholder={String(snap.balanceQty)}
                    readOnly={readOnly}
                    disabled={readOnly}
                    className={`${OK_INPUT} border-emerald-200 focus:border-emerald-400 ${
                      completedQtyExceeds ? "border-rose-400 bg-rose-50" : ""
                    } ${readOnly ? "bg-slate-50 cursor-default" : ""}`}
                  />
                </div>
                {completedQty > 0 ? (
                  <p className="px-2.5 pb-2 text-[9px] font-bold text-emerald-800 tabular-nums">
                    Requesting approval for {completedQty.toLocaleString()} qty
                  </p>
                ) : null}
              </div>
            )}

            <div
              className={`rounded-lg border px-2.5 py-2 text-[10px] leading-snug space-y-1 ${
                hasQtyError || errors.submit_qty
                  ? "border-rose-300 bg-rose-50 text-rose-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <p>
                  <span className="font-bold text-emerald-700">Completed</span>{" "}
                  {completedQty.toLocaleString()} qty
                </p>
                {isFullFlow ? (
                  <p>
                    <span className="font-bold text-rose-700">Rejected</span>{" "}
                    {rejectedQty.toLocaleString()} qty
                    {rejectIsAuto ? (
                      <span className="text-rose-600/80 font-semibold"> (auto)</span>
                    ) : null}
                  </p>
                ) : null}
                <p>
                  <span className="font-bold text-slate-700">Total this submit</span>{" "}
                  {thisSubmitQty.toLocaleString()} qty
                  <span className="text-slate-500">
                    {" "}
                    (max {snap.balanceQty.toLocaleString()})
                  </span>
                </p>
              </div>
              {!exceedsQty && thisSubmitQty > 0 ? (
                <p className="text-amber-800 border-t border-slate-200/80 pt-1">
                  <span className="font-bold">Balance after approval:</span>{" "}
                  {fmtQty(afterApproveQty)}
                </p>
              ) : null}
              {hasQtyError ? (
                <p className="text-[10px] font-bold text-rose-700 border-t border-rose-200/80 pt-1">
                  Cannot exceed the hold balance of {fmtQty(snap.balanceQty)}.
                </p>
              ) : null}
              {readOnly ? (
                <p className="text-[9px] text-slate-500 border-t border-slate-200/80 pt-1">
                  {isFullFlow
                    ? "Review the completed and rejected quantities before authorizing."
                    : "Review the completed quantity before authorizing."}
                </p>
              ) : authorizeEdit ? (
                <p className={`text-[9px] font-bold uppercase border-t border-slate-200/80 pt-1 ${panelTitle}`}>
                  {isFullFlow
                    ? "Change completed qty if needed — rejected stays as balance minus completed."
                    : "Change passed qty or reason/remark, then authorize."}
                </p>
              ) : isFullFlow ? (
                <p className={`text-[9px] font-bold uppercase border-t border-slate-200/80 pt-1 ${panelTitle}`}>
                  Enter completed qty — rejected is calculated as balance left minus completed.
                </p>
              ) : (
                <p className="text-[9px] text-slate-500 border-t border-slate-200/80 pt-1">
                  Partial submit: enter only passed qty for approval. Reject remaining balance at final submit.
                </p>
              )}
            </div>

            {errors.submit_qty ? (
              <p className="text-[10px] font-bold text-rose-600">{errors.submit_qty}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function packingMetaFromHold(hold, packingMeta) {
  if (packingMeta?.packing_number) return packingMeta;
  if (!hold?.packing_number) return null;
  return {
    packing_number: hold.packing_number,
    item_code: hold.item_code,
    itemdcode: hold.item_dcode,
    item_desc: hold.item_desc,
  };
}

function CollapsiblePackingContext({
  meta,
  scannedCount = 0,
  scannedTotalQty = 0,
  badgeText = null,
  headerQty = null,
}) {
  const [packingOpen, setPackingOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);

  const packingNumber = meta?.packing_number;
  const dispatchLines = meta?.dispatch_lines || [];
  const dispatched = Number(meta?.dispatched_total_qty ?? meta?.dispatch_stock_qty ?? 0);
  const hasDispatch = dispatchLines.length > 0 && dispatched > 0;

  useEffect(() => {
    setPackingOpen(false);
    setDispatchOpen(false);
  }, [packingNumber]);

  if (!packingNumber) return null;

  const item = meta.item_code || meta.itemdcode || "—";
  const stock = Number(meta.in_hand_qty ?? meta.total_stock_qty ?? 0);
  const dispatchOutCount = dispatchLines.length;
  const dispatchCustomerCount =
    Number(meta.dispatch_customer_count) ||
    new Set(
      dispatchLines.map((l) => String(l.acc_name ?? "").trim().toLowerCase()).filter(Boolean)
    ).size;
  const headerQtyLabel =
    headerQty != null && Number(headerQty) > 0
      ? Number(headerQty).toLocaleString()
      : stock.toLocaleString();

  return (
    <div className="space-y-2">
      {/* Packing / in-hand — open independently */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <button
          type="button"
          aria-expanded={packingOpen}
          onClick={() => setPackingOpen((p) => !p)}
          className={`w-full px-2.5 py-2 flex items-center gap-1.5 text-left hover:bg-slate-50 transition-colors min-h-[42px] ${packingOpen ? "border-b border-slate-100" : ""}`}
        >
          <span className="text-[11px] flex-1 truncate min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5">
            <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wide">In-hand stock</span>
            <span className="font-bold text-slate-800">#{meta.packing_number}</span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="font-bold text-slate-800">{item}</span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="font-bold text-emerald-700 tabular-nums">{headerQtyLabel}</span>
            {dispatched > 0 ? (
              <>
                <span className="text-slate-300 hidden sm:inline">·</span>
                <span className="text-[9px] font-semibold text-sky-500 uppercase tracking-wide">Dispatched</span>
                <span className="font-bold text-sky-700 tabular-nums">{dispatched.toLocaleString()}</span>
              </>
            ) : null}
          </span>
          {badgeText ? (
            <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 rounded">
              {badgeText}
            </span>
          ) : scannedCount > 0 ? (
            <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 rounded">
              {scannedCount} scanned · {scannedTotalQty.toLocaleString()}
            </span>
          ) : (
            <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
              {stock.toLocaleString()} qty
            </span>
          )}
          <ChevronRight
            className={`text-slate-400 shrink-0 transition-transform ${packingOpen ? "rotate-90" : ""}`}
            size={14}
          />
        </button>

        {packingOpen ? (
          <div className="px-2.5 py-2.5 bg-slate-50/40">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 text-[11px] leading-snug">
              <div className="min-w-0">
                <dt className="text-[8px] font-bold text-slate-400 uppercase">Packing no.</dt>
                <dd className="font-semibold text-slate-800 break-words">{meta.packing_number}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[8px] font-bold text-slate-400 uppercase">Item</dt>
                <dd className="font-semibold text-slate-800 uppercase break-words">{item}</dd>
              </div>
              <div className="min-w-0 col-span-2 sm:col-span-1">
                <dt className="text-[8px] font-bold text-slate-400 uppercase">Description</dt>
                <dd className="font-semibold text-slate-800 break-words line-clamp-2" title={meta.item_desc || ""}>
                  {meta.item_desc || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[8px] font-bold text-slate-400 uppercase">Store in loc.</dt>
                <dd className="font-semibold text-slate-800 break-words">{meta.store_in_location || "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[8px] font-bold text-slate-400 uppercase">In-hand stock</dt>
                <dd className="font-semibold text-emerald-700 tabular-nums">{stock.toLocaleString()}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[8px] font-bold text-slate-400 uppercase">Dispatch qty</dt>
                <dd className={`font-semibold tabular-nums ${dispatched > 0 ? "text-sky-700" : "text-slate-500"}`}>
                  {dispatched > 0 ? dispatched.toLocaleString() : "—"}
                </dd>
              </div>
              <div className="min-w-0 col-span-2 sm:col-span-3">
                <dt className="text-[8px] font-bold text-slate-400 uppercase">Packing customer</dt>
                <dd className="font-semibold text-slate-800 break-words" title={meta.acc_name || ""}>
                  {meta.acc_name || "—"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>

      {hasDispatch ? (
      <div className="rounded-lg border border-sky-200 bg-white overflow-hidden shadow-sm">
        <button
          type="button"
          aria-expanded={dispatchOpen}
          onClick={() => setDispatchOpen((p) => !p)}
          className={`w-full px-2.5 py-2 flex items-center gap-1.5 text-left hover:bg-sky-50/60 transition-colors min-h-[42px] ${dispatchOpen ? "border-b border-sky-100" : ""}`}
        >
          <span className="text-[11px] flex-1 truncate min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5">
            <span className="text-[9px] font-bold text-sky-600 uppercase tracking-wide">Dispatch</span>
            <span className="font-bold text-slate-800">#{meta.packing_number}</span>
            {dispatchCustomerCount > 1 ? (
              <>
                <span className="text-slate-300 hidden sm:inline">·</span>
                <span className="font-semibold text-violet-700 tabular-nums">
                  {dispatchCustomerCount} customers
                </span>
              </>
            ) : null}
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="font-bold text-sky-700 tabular-nums">{dispatched.toLocaleString()} qty</span>
          </span>
          <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-sky-50 text-sky-800 border border-sky-200 rounded">
            {dispatchOutCount} out
          </span>
          <ChevronRight
            className={`text-sky-400 shrink-0 transition-transform ${dispatchOpen ? "rotate-90" : ""}`}
            size={14}
          />
        </button>

        {dispatchOpen ? (
          <div className="px-2.5 py-2.5 max-h-[min(32dvh,260px)] overflow-y-auto custom-scrollbar bg-sky-50/20">
            <div className="space-y-2">
              {dispatchLines.map((line, idx) => {
                  const lineItem = line.item_code || line.item_dcode || item;
                  const key = `${line.out_uid ?? "out"}-${line.fuid ?? "fn"}-${line.acc_name ?? idx}`;
                  const customerLabel = line.acc_name || "—";
                  return (
                    <div
                      key={key}
                      className="rounded-md border border-sky-100 bg-white overflow-hidden shadow-sm"
                    >
                      <div className="px-2 py-1.5 bg-sky-50 border-b border-sky-100 flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-sky-600 text-white text-[9px] font-black flex items-center justify-center tabular-nums">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[10px] font-bold text-slate-800 leading-snug break-words"
                            title={customerLabel}
                          >
                            {customerLabel}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[8px] text-slate-600 mt-0.5">
                            {line.fuid ? <span className="font-semibold">FUID #{line.fuid}</span> : null}
                            {line.out_uid ? <span className="font-semibold">Out #{line.out_uid}</span> : null}
                            <span className="text-slate-300">·</span>
                            <span className="font-bold text-slate-800 tabular-nums">
                              {Number(line.total_qty || 0).toLocaleString()} qty
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="tabular-nums">{line.box_count || 0} boxes</span>
                          </div>
                        </div>
                      </div>
                      <p className="px-2 py-1 text-[9px] text-slate-500 leading-snug break-words">
                        <span className="font-bold uppercase text-slate-600">{lineItem}</span>
                        {line.item_desc || meta.item_desc ? (
                          <> — {line.item_desc || meta.item_desc}</>
                        ) : null}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

function boxScanKeys(boxOrCode) {
  if (boxOrCode == null) return [];
  if (typeof boxOrCode === "string" || typeof boxOrCode === "number") {
    const v = String(boxOrCode).trim().toLowerCase();
    return v ? [v] : [];
  }
  const keys = [];
  if (boxOrCode.box_no_uid != null && String(boxOrCode.box_no_uid).trim()) {
    keys.push(String(boxOrCode.box_no_uid).trim().toLowerCase());
  }
  if (boxOrCode.box_uid != null && String(boxOrCode.box_uid).trim()) {
    keys.push(String(boxOrCode.box_uid).trim().toLowerCase());
  }
  return keys;
}

function buildScannedIdSet(boxes = []) {
  const ids = new Set();
  for (const box of boxes) {
    for (const key of boxScanKeys(box)) ids.add(key);
  }
  return ids;
}

function isBoxAlreadyScanned(code, boxes = [], idSet = null) {
  const keys = boxScanKeys(code);
  if (!keys.length) return false;
  const set = idSet || buildScannedIdSet(boxes);
  return keys.some((k) => set.has(k));
}

function boxesFromHoldRecord(record) {
  if (Array.isArray(record?.scanned_boxes) && record.scanned_boxes.length) {
    return record.scanned_boxes.map((b) => ({
      box_no_uid: b.box_no_uid,
      box_uid: b.box_uid ?? null,
      packing_number: b.packing_number ?? record.packing_number ?? null,
      qty: Number(b.qty) || 0,
      location_no: b.location_no ?? null,
    }));
  }
  const uids = parseStoredBoxUids(record);
  const totalQty = Number(record?.qty) || 0;
  const fallbackQty = uids.length ? Math.round(totalQty / uids.length) : 0;
  return uids.map((uid) => ({
    box_no_uid: uid,
    packing_number: record?.packing_number ?? null,
    qty: fallbackQty,
  }));
}

function holdSelectLabel(hold) {
  return formatQcHoldActiveHoldLabel(hold);
}

function submitFormFromSubmission(sub) {
  if (!sub) return INITIAL_SUBMIT_FORM;
  return {
    completed_qty: String(sub.completed_qty ?? ""),
    rejected_qty: String(sub.rejected_qty ?? "0"),
    reason: sub.reason || "",
    remarks: sub.remarks || "",
  };
}

function pickerIdFromSubmission(sub) {
  return pickerIdFromSubmissionType(sub?.submission_type);
}

export default function QcHoldMaterialModal({ open, onClose, onSuccess, onApprovedForPrint, editData, mode = "add" }) {
  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const readOnly = mode === "view";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";

  const [loading, setLoading] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [holdMode, setHoldMode] = useState(null);
  const [pendingScanMode, setPendingScanMode] = useState(null);
  const [pickerChoiceId, setPickerChoiceId] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [packingMeta, setPackingMeta] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [scannedBoxes, setScannedBoxes] = useState([]);
  const [pendingScanCount, setPendingScanCount] = useState(0);
  const [manualBoxId, setManualBoxId] = useState("");
  const [manualPackingNo, setManualPackingNo] = useState("");
  const [loadingFullHold, setLoadingFullHold] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [parentHold, setParentHold] = useState(null);
  const [submitForm, setSubmitForm] = useState(INITIAL_SUBMIT_FORM);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [holdRecord, setHoldRecord] = useState(null);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

  const sopAckRef = useRef(null);
  const formRef = useRef(null);
  const keyboardInputRef = useRef(null);
  const scanToastRef = useRef({});
  const scannedIdsRef = useRef(new Set());
  const recentSuccessRef = useRef(new Map());
  const lockedPackingRef = useRef("");

  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);
  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const showLaserUi = isLaserScanEnabled() || laserScan;
  const scanBtnCount = (showPhoneQr ? 1 : 0) + (laserScan ? 1 : 0);
  const scanBtnFill = scanBtnCount > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  const closeSnackbar = useCallback(() => setSnackbar((s) => ({ ...s, open: false })), []);

  const activePicker = useMemo(
    () => getQcHoldPickerOption(pickerChoiceId),
    [pickerChoiceId]
  );
  const accent = QC_HOLD_PICKER_ACCENT[activePicker?.accent || "amber"] || QC_HOLD_PICKER_ACCENT.amber;

  const showModePicker = !isEdit && !isApprove && !readOnly && holdMode == null;
  const showPendingScanPicker =
    QC_HOLD_PARTIAL_ENABLED &&
    !isEdit &&
    !isApprove &&
    !readOnly &&
    isPendingHoldMode(pickerChoiceId) &&
    pendingScanMode == null &&
    holdMode != null;
  const isPendingMode = isPendingHoldMode(pickerChoiceId);
  const isLegacyPartialHold =
    isEdit &&
    String(holdRecord?.hold_scan_mode || editData?.hold_scan_mode || "")
      .trim()
      .toLowerCase() === QC_HOLD_SCAN_PARTIAL;
  const isFullPendingScan =
    isFullPendingScanMode(pendingScanMode) || (!QC_HOLD_PARTIAL_ENABLED && !isLegacyPartialHold);
  const isSubmitFlow = isSubmitMode(pickerChoiceId);
  const isFullFlow = isFullSubmitMode(pickerChoiceId);
  const isRevertFlow = isRevertSubmitMode(pickerChoiceId);
  const pendingApprovalSubmission = useMemo(
    () => pendingSubmissions[0] || null,
    [pendingSubmissions]
  );
  const approveIsFullFlow = useMemo(
    () =>
      isApprove
        ? String(pendingApprovalSubmission?.submission_type || "").toLowerCase() === "full"
        : isFullFlow,
    [isApprove, pendingApprovalSubmission?.submission_type, isFullFlow]
  );
  const approveIsRevertFlow = useMemo(
    () =>
      isApprove
        ? String(pendingApprovalSubmission?.submission_type || "").toLowerCase() === "revert"
        : isRevertFlow,
    [isApprove, pendingApprovalSubmission?.submission_type, isRevertFlow]
  );
  const showScanUi = !isApprove && !readOnly && (isPendingMode || isEdit) && (isEdit || pendingScanMode != null);
  const showPartialScanUi = showScanUi && !isFullPendingScan;
  const showFullHoldPackingUi = showScanUi && isFullPendingScan;

  useEffect(() => {
    if (!open) {
      setHoldMode(null);
      setPendingScanMode(null);
      setPickerChoiceId(null);
      setIsConfirmed(false);
      setPackingMeta(null);
      setForm(INITIAL_FORM);
      setErrors({});
      setScannedBoxes([]);
      setPendingScanCount(0);
      setManualBoxId("");
      setManualPackingNo("");
      setLoadingFullHold(false);
      setIsScannerOpen(false);
      scannedIdsRef.current = new Set();
      lockedPackingRef.current = "";
      setParentHold(null);
      setSubmitForm(INITIAL_SUBMIT_FORM);
      setPendingSubmissions([]);
      setHoldRecord(null);
      setFormReady(false);
      return;
    }

    if ((isEdit || isApprove) && editData?.hold_id) {
      setFormReady(false);
      setHoldMode(isApprove ? "approve" : "edit");
      setIsConfirmed(true);
      if (isEdit) setPickerChoiceId(QC_HOLD_MODE_PENDING);

      qcHoldMaterialService
        .getById(editData.hold_id)
        .then((res) => {
          const data = res?.data || editData;
          setHoldRecord(data);

          if (isApprove) {
            setParentHold(data);
            const pending = (data.submissions || data.pending_submissions || []).filter((s) => !s.approved);
            setPendingSubmissions(pending.length ? pending : data.pending_submissions || []);
            const sub = pending[0] || (data.pending_submissions || [])[0] || null;
            if (sub) {
              setPickerChoiceId(pickerIdFromSubmission(sub));
              setSubmitForm(submitFormFromSubmission(sub));
            }
            if (data.packing_number) {
              return qcHoldMaterialService
                .getPackingMeta(data.packing_number)
                .then((metaRes) => setPackingMeta(metaRes?.data || null));
            }
            setPackingMeta(packingMetaFromHold(data, null));
            return;
          }

          setForm({
            reason: data.reason || "",
            remarks: data.remarks || "",
            status: data.status || "pending",
            approved: false,
          });
          const boxes = boxesFromHoldRecord(data);
          setScannedBoxes(boxes);
          scannedIdsRef.current = buildScannedIdSet(boxes);
          lockedPackingRef.current = String(data.packing_number || "").trim();
          setPendingScanMode(data.hold_scan_mode || defaultQcHoldScanMode());

          if (data.packing_number) {
            return qcHoldMaterialService
              .getPackingMeta(data.packing_number)
              .then((metaRes) => setPackingMeta(metaRes?.data || null));
          }
          setPackingMeta(null);
        })
        .catch(() => {
          setHoldRecord(editData);
          if (isApprove) {
            setParentHold(editData);
            const pending = (editData.pending_submissions || editData.submissions || []).filter((s) => !s.approved);
            setPendingSubmissions(pending.length ? pending : editData.pending_submissions || []);
            const sub = pending[0] || (editData.pending_submissions || [])[0] || null;
            if (sub) {
              setPickerChoiceId(pickerIdFromSubmission(sub));
              setSubmitForm(submitFormFromSubmission(sub));
            }
            setPackingMeta(packingMetaFromHold(editData, null));
            return;
          }
          setForm({
            reason: editData.reason || "",
            remarks: editData.remarks || "",
            status: editData.status || "pending",
            approved: false,
          });
          const boxes = boxesFromHoldRecord(editData);
          setScannedBoxes(boxes);
          scannedIdsRef.current = buildScannedIdSet(boxes);
          lockedPackingRef.current = String(editData.packing_number || "").trim();
        })
        .finally(() => setFormReady(true));
      return;
    }

    setFormReady(true);
  }, [open, editData?.hold_id, isEdit, isApprove]);

  const selectHoldMode = (option) => {
    setHoldMode(option.id);
    setPickerChoiceId(option.id);
    setIsConfirmed(true);
    setPendingScanMode(
      isPendingHoldMode(option.id)
        ? QC_HOLD_PARTIAL_ENABLED
          ? null
          : QC_HOLD_SCAN_FULL
        : null
    );
    setParentHold(null);
    setSubmitForm(INITIAL_SUBMIT_FORM);
    if (isSubmitMode(option.id)) {
      setForm(INITIAL_FORM);
      setScannedBoxes([]);
      scannedIdsRef.current = new Set();
      lockedPackingRef.current = "";
      setPackingMeta(null);
    }
  };

  const handleChangeHoldType = () => {
    setHoldMode(null);
    setPendingScanMode(null);
    setPickerChoiceId(null);
    setIsConfirmed(false);
    setPackingMeta(null);
    setParentHold(null);
    setSubmitForm(INITIAL_SUBMIT_FORM);
    setScannedBoxes([]);
    scannedIdsRef.current = new Set();
    lockedPackingRef.current = "";
    setManualPackingNo("");
    setLoadingFullHold(false);
    setForm(INITIAL_FORM);
    setErrors({});
  };

  const selectPendingScanMode = (option) => {
    setPendingScanMode(option.id);
    setScannedBoxes([]);
    scannedIdsRef.current = new Set();
    lockedPackingRef.current = "";
    setPackingMeta(null);
    setManualPackingNo("");
    setManualBoxId("");
    setLoadingFullHold(false);
    setErrors((prev) => ({ ...prev, scan: "" }));
  };

  const loadParentHold = useCallback(async (holdId, { autoFull = false } = {}) => {
    if (!holdId) {
      setParentHold(null);
      setPackingMeta(null);
      setSubmitForm(INITIAL_SUBMIT_FORM);
      return;
    }
    try {
      const res = await qcHoldMaterialService.getById(holdId);
      const data = res?.data || null;
      setParentHold(data);
      setPackingMeta(null);

      if (data?.packing_number) {
        try {
          const metaRes = await qcHoldMaterialService.getPackingMeta(data.packing_number);
          setPackingMeta(metaRes?.data || null);
        } catch {
          setPackingMeta(null);
        }
      }

      if (data && autoFull) {
        setSubmitForm((prev) => ({
          ...prev,
          ...buildFullSubmitFields(data),
        }));
      } else {
        setSubmitForm((prev) => ({
          ...INITIAL_SUBMIT_FORM,
          reason: prev.reason,
          remarks: prev.remarks,
        }));
      }
    } catch {
      setParentHold(null);
      setPackingMeta(null);
      setSubmitForm(INITIAL_SUBMIT_FORM);
      toast.error("Could not load hold details");
    }
  }, []);

  const syncBoxes = useCallback((boxes) => {
    setScannedBoxes(boxes);
    scannedIdsRef.current = buildScannedIdSet(boxes);
  }, []);

  const loadFullHoldByPacking = useCallback(
    async (rawPackingNo) => {
      if (readOnly || !isFullPendingScan) return;
      const pn = String(rawPackingNo ?? manualPackingNo ?? "").trim();
      if (!pn) {
        setErrors((prev) => ({ ...prev, scan: "Packing number is required." }));
        return;
      }

      setLoadingFullHold(true);
      setErrors((prev) => ({ ...prev, scan: "" }));
      try {
        const expandRes = await qcHoldMaterialService.expandFullHold({ packing_number: pn });
        const expanded = expandRes?.data?.boxes;
        if (!expandRes?.success || !Array.isArray(expanded) || !expanded.length) {
          throw new Error(expandRes?.message || "No in-hand stock for this packing");
        }

        lockedPackingRef.current = pn;
        setManualPackingNo(pn);
        if (expandRes.data.packing_meta) setPackingMeta(expandRes.data.packing_meta);
        else {
          const meta = (await qcHoldMaterialService.getPackingMeta(pn))?.data;
          setPackingMeta(meta || null);
        }
        syncBoxes(expanded);
        showScanSuccess(
          `qc-hold-full-${pn}`,
          `Full hold: ${expanded.length} in-hand stock boxes (${expanded.reduce((s, b) => s + (Number(b.qty) || 0), 0).toLocaleString()} qty)`
        );
      } catch (err) {
        syncBoxes([]);
        lockedPackingRef.current = "";
        setPackingMeta(null);
        const msg = err?.message || "Could not load boxes for full hold";
        setErrors((prev) => ({ ...prev, scan: msg }));
        showScanToast("error", `qc-hold-full-fail-${pn}`, msg, 2800);
      } finally {
        setLoadingFullHold(false);
      }
    },
    [readOnly, isFullPendingScan, manualPackingNo, syncBoxes, showScanSuccess, showScanToast]
  );

  /** Full hold: scan any one box → load all in-hand boxes for that packing. */
  const tryFullHoldByBoxScan = useCallback(
    async (rawScanValue) => {
      if (readOnly || !isFullPendingScan || scannedBoxes.length > 0 || loadingFullHold) return;
      const qrType = detectQrType(rawScanValue);
      if (qrType === "location") {
        showScanToast("error", "qc-hold-loc", SCAN_SNACK_MSG.REJECTED);
        return;
      }
      const code = parseBoxScanRaw(rawScanValue)?.trim();
      if (!code) {
        showScanToast("error", "qc-hold-invalid", SCAN_SNACK_MSG.REJECTED);
        return;
      }

      try {
        const res = await qcHoldMaterialService.verifyBox({
          box_no_uid: code,
          full_hold_resolve: true,
        });
        const pn = String(res?.data?.packing_number ?? "").trim();
        if (!res?.success || !pn) {
          throw new Error(res?.message || "Could not read packing number from this box");
        }
        await loadFullHoldByPacking(pn);
        setIsScannerOpen(false);
      } catch (err) {
        showScanToast(
          "error",
          `qc-hold-full-scan-${code}`,
          err?.message || SCAN_SNACK_MSG.REJECTED,
          2800
        );
      }
    },
    [
      readOnly,
      isFullPendingScan,
      scannedBoxes.length,
      loadingFullHold,
      loadFullHoldByPacking,
      showScanToast,
    ]
  );

  const tryAddBox = useCallback(
    async (rawScanValue) => {
      if (readOnly || isFullPendingScan) return;
      const qrType = detectQrType(rawScanValue);
      if (qrType === "location") {
        showScanToast("error", "qc-hold-loc", SCAN_SNACK_MSG.REJECTED);
        return;
      }
      const code = parseBoxScanRaw(rawScanValue)?.trim();
      if (!code) {
        showScanToast("error", "qc-hold-invalid", SCAN_SNACK_MSG.REJECTED);
        return;
      }
      const codeKey = String(code).trim().toLowerCase();
      if (isBoxAlreadyScanned(code, scannedBoxes, scannedIdsRef.current)) {
        if (!shouldSilenceScanDuplicate(recentSuccessRef, code)) {
          showScanToast("error", "qc-hold-dup", SCAN_SNACK_MSG.BOX_DUPLICATE(code), 1200);
        }
        return;
      }

      scannedIdsRef.current.add(codeKey);

      setPendingScanCount((n) => n + 1);
      const editHoldId = holdRecord?.hold_id ?? editData?.hold_id ?? null;
      try {
        const res = await qcHoldMaterialService.verifyBox({
          box_no_uid: code,
          packing_number: lockedPackingRef.current || undefined,
          hold_id: editHoldId || undefined,
        });
        const data = res?.data;
        if (!res?.success || !data?.box_no_uid) {
          throw new Error(res?.message || "Box verification failed");
        }

        const resolvedKeys = boxScanKeys({
          box_no_uid: data.box_no_uid,
          box_uid: data.box_uid,
        });
        const duplicateResolved = scannedBoxes.some((b) => {
          const existing = boxScanKeys(b);
          return resolvedKeys.some((k) => existing.includes(k));
        });
        if (duplicateResolved) {
          scannedIdsRef.current.delete(codeKey);
          if (!shouldSilenceScanDuplicate(recentSuccessRef, data.box_no_uid)) {
            showScanToast("error", "qc-hold-dup", SCAN_SNACK_MSG.BOX_DUPLICATE(data.box_no_uid), 1200);
          }
          return;
        }

        const pn = String(data.packing_number || "").trim();
        if (!lockedPackingRef.current && pn) {
          lockedPackingRef.current = pn;
          const meta = data.packing_meta || (await qcHoldMaterialService.getPackingMeta(pn))?.data;
          setPackingMeta(meta || null);
        }

        const nextBox = {
          box_no_uid: data.box_no_uid,
          box_uid: data.box_uid,
          packing_number: pn,
          qty: Number(data.qty) || 0,
          location_no: data.location_no,
        };
        const next = [...scannedBoxes, nextBox];
        syncBoxes(next);
        markRecentScanSuccess(recentSuccessRef, data.box_no_uid);
        showScanSuccess(
          `qc-hold-ok-${codeKey}`,
          SCAN_SNACK_MSG.BOX_SCANNED_TOTAL(data.box_no_uid, next.length)
        );
      } catch (err) {
        scannedIdsRef.current.delete(codeKey);
        showScanToast("error", `qc-hold-fail-${codeKey}`, err?.message || SCAN_SNACK_MSG.REJECTED, 2800);
      } finally {
        setPendingScanCount((n) => Math.max(0, n - 1));
      }
    },
    [readOnly, scannedBoxes, showScanSuccess, showScanToast, syncBoxes, isFullPendingScan, holdRecord?.hold_id, editData?.hold_id]
  );

  const handleRemoveBox = (boxNoUid) => {
    if (readOnly || isFullPendingScan) return;
    const next = scannedBoxes.filter((b) => b.box_no_uid !== boxNoUid);
    syncBoxes(next);
    if (next.length === 0) {
      lockedPackingRef.current = "";
      setPackingMeta(null);
    }
  };

  const handleQrDecoded = useCallback(
    (text) => {
      if (isFullPendingScan) {
        void tryFullHoldByBoxScan(text);
        return;
      }
      void tryAddBox(text);
    },
    [isFullPendingScan, tryFullHoldByBoxScan, tryAddBox]
  );

  const handleDecodeSuppressed = useCallback(() => {
    notifyDecodeSuppressedScan();
  }, []);

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen && open,
    elementId: SCANNER_ID,
    onDecoded: handleQrDecoded,
    onDecodeSuppressed: handleDecodeSuppressed,
    fps: 15,
    qrbox: { width: 250, height: 250 },
    decodeCooldownMs: 1200,
    onCameraFailed: () => {
      showScanToast("error", "qc-hold-camera", SCAN_SNACK_MSG.CAMERA_DENIED ?? SCAN_SNACK_MSG.CAMERA, 4000);
      setIsScannerOpen(false);
    },
  });

  const startScanner = () => {
    void (async () => {
      const prep = await prepareQrScanSession();
      if (!prep.cameraOk) {
        showScanToast(
          "error",
          "qc-hold-camera",
          prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
          4000
        );
        return;
      }
      setIsScannerOpen(true);
    })();
  };

  const validatePending = () => {
    const e = {};
    if (!String(form.reason).trim()) e.reason = "Reason is required.";
    if (scannedBoxes.length === 0) {
      e.scan = isFullPendingScan
        ? "Scan one box or enter packing number to load all in-hand stock boxes."
        : "Scan at least one in-hand stock box (not outward/dispatch).";
    }
    return e;
  };

  const validateSubmit = () => {
    const e = {};
    if (!parentHold?.hold_id) e.hold_id = "Select a pending hold.";
    if (parentHold?.has_pending_submission) {
      e.hold_id = "This hold already has a submission awaiting approval.";
    }
    if (!String(submitForm.reason).trim()) e.submit_reason = "Reason is required.";

    if (isRevertFlow) return e;

    const snap = holdBalanceSnapshot(parentHold);
    const qtyError = validateSubmitQtyAgainstBalance(snap, submitForm, { isFullFlow });
    if (qtyError) e.submit_qty = qtyError;
    else if (snap && isFullFlow) {
      const { completedQty, rejectedQty } = parseSubmitNumbers(submitForm);
      if (completedQty + rejectedQty !== snap.balanceQty) {
        e.submit_qty = `Full submit must use the entire balance: ${snap.balanceQty.toLocaleString()} qty.`;
      }
    }
    return e;
  };

  const validateApprove = () => {
    const e = {};
    const hold = parentHold || editData;
    if (!String(submitForm.reason).trim()) e.submit_reason = "Reason is required.";

    if (approveIsRevertFlow) return e;

    const snap = holdBalanceSnapshot(hold);
    const qtyError = validateSubmitQtyAgainstBalance(snap, submitForm, { isFullFlow: approveIsFullFlow });
    if (qtyError) e.submit_qty = qtyError;
    else if (snap && approveIsFullFlow) {
      const { completedQty, rejectedQty } = parseSubmitNumbers(submitForm);
      if (completedQty + rejectedQty !== snap.balanceQty) {
        e.submit_qty = `Full submit must use the entire balance: ${snap.balanceQty.toLocaleString()} qty.`;
      }
    }
    return e;
  };

  const handleSubmitFieldChange = useCallback((key, value, fullFlowOverride) => {
    if (key === "rejected_qty") {
      return;
    }
    const fullFlow = fullFlowOverride ?? isFullFlow;
    setSubmitForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "completed_qty") {
        if (fullFlow && parentHold) {
          const snap = holdBalanceSnapshot(parentHold);
          if (snap) Object.assign(next, calcFullSubmitDerived(snap, value));
        } else if (!fullFlow) {
          next.rejected_qty = "0";
        }
      }
      return next;
    });
    if (errors.submit_qty || errors.submit_reason) {
      setErrors((prev) => ({ ...prev, submit_qty: "", submit_reason: prev.submit_reason }));
    }
  }, [errors.submit_qty, errors.submit_reason, isFullFlow, parentHold]);

  const handleApproveFieldChange = useCallback(
    (key, value) => handleSubmitFieldChange(key, value, approveIsFullFlow),
    [handleSubmitFieldChange, approveIsFullFlow]
  );

  const handleSavePending = async () => {
    const e = validatePending();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error(e.scan || "Please fix highlighted fields.");
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;

    const boxUids = scannedBoxes.map((b) => b.box_no_uid);
    const qty = scannedBoxes.reduce((s, b) => s + (Number(b.qty) || 0), 0);
    const itemDcode =
      packingMeta?.itemdcode ??
      packingMeta?.item_dcode ??
      holdRecord?.item_dcode ??
      editData?.item_dcode;

    setLoading(true);
    try {
      const payload = {
        packing_number: lockedPackingRef.current || packingMeta?.packing_number || holdRecord?.packing_number,
        item_dcode: itemDcode,
        qty,
        remarks: form.remarks?.trim() || null,
        reason: String(form.reason).trim(),
        scanned_box_uids: boxUids,
        hold_scan_mode: pendingScanMode || defaultQcHoldScanMode(),
      };

      if (isEdit) {
        const holdId = holdRecord?.hold_id ?? editData?.hold_id;
        const res = await qcHoldMaterialService.update(holdId, payload);
        toast.success(res?.message || "Hold updated — inventory synced with QC Hold");
      } else {
        const res = await qcHoldMaterialService.create(payload);
        toast.success(res?.message || "Hold saved — boxes moved from inventory to QC Hold");
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPartialFull = async () => {
    const e = validateSubmit();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error(Object.values(e)[0]);
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;

    setLoading(true);
    try {
      const snap = holdBalanceSnapshot(parentHold);
      const completedQty = isRevertFlow
        ? snap?.balanceQty ?? 0
        : parseInt(submitForm.completed_qty, 10) || 0;
      let rejectedQty = isRevertFlow ? 0 : parseInt(submitForm.rejected_qty, 10) || 0;
      if (isFullFlow && snap) {
        rejectedQty = Math.max(0, snap.balanceQty - completedQty);
      } else if (!isRevertFlow) {
        rejectedQty = 0;
      }

      await qcHoldMaterialService.submit({
        hold_id: parentHold.hold_id,
        submission_type: submissionTypeForPickerMode(pickerChoiceId),
        completed_qty: completedQty,
        rejected_qty: rejectedQty,
        remarks: submitForm.remarks?.trim() || null,
        reason: String(submitForm.reason).trim(),
      });
      toast.success(
        isRevertFlow
          ? "Revert submitted — waiting for super admin approval"
          : "Submitted — waiting for super admin approval"
      );
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSubmission = async () => {
    const e = validateApprove();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error(Object.values(e)[0]);
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;
    const submissionId = pendingSubmissions[0]?.submission_id ?? editData?.pending_submission_id;
    const holdId = editData?.hold_id ?? parentHold?.hold_id;
    if (!submissionId && !holdId) {
      toast.error("No pending submission to approve");
      return;
    }

    setLoading(true);
    try {
      const hold = parentHold || editData;
      const snap = holdBalanceSnapshot(hold);
      const completedQty = approveIsRevertFlow
        ? snap?.balanceQty ?? 0
        : parseInt(submitForm.completed_qty, 10) || 0;
      let rejectedQty = approveIsRevertFlow ? 0 : parseInt(submitForm.rejected_qty, 10) || 0;
      if (approveIsFullFlow && snap) {
        rejectedQty = Math.max(0, snap.balanceQty - completedQty);
      } else if (!approveIsRevertFlow) {
        rejectedQty = 0;
      }

      const res = await qcHoldMaterialService.approveSubmission({
        submission_id: submissionId || undefined,
        hold_id: holdId,
        completed_qty: completedQty,
        rejected_qty: rejectedQty,
        reason: String(submitForm.reason).trim(),
        remarks: submitForm.remarks?.trim() || null,
      });
      toast.success(approveIsRevertFlow ? "Revert approved — boxes back in stock" : "Submission approved");
      onSuccess?.();
      const stickers = res?.data?.completion_stickers;
      if (Array.isArray(stickers) && stickers.length && onApprovedForPrint) {
        onApprovedForPrint({
          hold: res?.data?.hold,
          submission: res?.data?.submission,
          stickers,
        });
      }
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Approval failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!parentHold?.hold_id || !isFullFlow || isApprove) return;
    setSubmitForm((prev) => ({
      ...prev,
      ...buildFullSubmitFields(parentHold),
    }));
  }, [parentHold?.hold_id, parentHold?.balance_qty, isFullFlow, isApprove]);

  const scannedCount = scannedBoxes.length;
  const scannedTotalQty = useMemo(
    () => scannedBoxes.reduce((sum, box) => sum + (Number(box.qty) || 0), 0),
    [scannedBoxes]
  );

  const submitHoldSnap = useMemo(() => holdBalanceSnapshot(parentHold), [parentHold]);
  const submitPackingMeta = useMemo(
    () => packingMetaFromHold(parentHold, packingMeta),
    [parentHold, packingMeta]
  );
  const approveAccent = useMemo(() => {
    if (!isApprove) return accent;
    const picker = getQcHoldPickerOption(pickerChoiceId);
    return QC_HOLD_PICKER_ACCENT[picker?.accent || "indigo"] || QC_HOLD_PICKER_ACCENT.indigo;
  }, [isApprove, pickerChoiceId, accent]);
  const drawerTitle = isApprove
    ? "Authorize Submission"
    : isConfirmed
      ? activePicker?.title || "QC Hold"
      : "New QC Hold";

  const drawerDescription = showModePicker ? (
    "Select action"
  ) : (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 normal-case tracking-normal font-semibold">
      <span className="uppercase tracking-tight font-bold">
        {isApprove
          ? "Adjust qty, reason or remark — then authorize"
          : isSubmitFlow
            ? "Submit completed / rejected qty"
            : isFullPendingScan
              ? "Enter packing number & save pending hold"
              : "Scan boxes & save pending hold"}
      </span>
      {!isEdit && !isApprove ? (
        <>
          <span className="text-slate-300 font-normal" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={handleChangeHoldType}
            className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 font-bold"
          >
            Change type
          </button>
        </>
      ) : null}
    </span>
  );

  const handlePrimaryAction = () => {
    if (isApprove) return handleApproveSubmission();
    if (isSubmitFlow) return handleSubmitPartialFull();
    return handleSavePending();
  };

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={onClose}
        onSubmit={handlePrimaryAction}
        title={drawerTitle}
        description={drawerDescription}
        maxWidth="max-w-5xl"
        footer={
          !showModePicker && !readOnly ? (
            <div className="flex justify-end gap-3 w-full">
              <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-500">
                Cancel
              </button>
              {isApprove ? (
                <button
                  type="button"
                  onClick={handleApproveSubmission}
                  disabled={loading || pendingSubmissions.length === 0}
                  className="min-w-[140px] px-6 py-2 text-sm font-bold text-white bg-emerald-600 rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                  Authorize
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={
                    loading ||
                    loadingFullHold ||
                    pendingScanCount > 0 ||
                    (showScanUi && scannedCount === 0) ||
                    (isSubmitFlow && !parentHold?.hold_id)
                  }
                  className={`min-w-[140px] px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg disabled:bg-slate-300 ${accent.submit}`}
                >
                  {loading
                    ? "Saving…"
                    : isSubmitFlow
                      ? isRevertFlow
                        ? "Submit Revert"
                        : "Submit"
                      : `Save Hold (${scannedCount})`}
                </button>
              )}
            </div>
          ) : null
        }
      >
        <div ref={formRef} className="space-y-2 pb-1">
          <QrScannerOverlay
            open={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            readerId={SCANNER_ID}
            hint={
              showPartialScanUi
                ? "Scan each in-hand stock box — same packing. Camera stays open; close when done."
                : showFullHoldPackingUi
                  ? "Scan any box to identify packing — all in-hand stock boxes will load (not outward)."
                  : "Scanning sticker / box QR"
            }
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
          />

          {!formReady ? (
            <FormPanelLoader label="Loading QC hold…" hint="Preparing form." />
          ) : showModePicker ? (
            <div className="space-y-3 py-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Select hold type</p>
              <div className={`grid grid-cols-1 gap-3 ${activeQcHoldModePickerOptions().length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {activeQcHoldModePickerOptions().map((option) => {
                  const cardAccent = QC_HOLD_PICKER_ACCENT[option.accent] || QC_HOLD_PICKER_ACCENT.amber;
                  const Icon = QC_HOLD_PICKER_ICONS[option.icon] || Package;
                  const cardTitle = option.cardTitle || option.title;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectHoldMode(option)}
                      className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] min-w-0 h-full flex flex-col ${cardAccent.card}`}
                    >
                      <div className={`flex items-start gap-2 min-w-0 ${cardAccent.title}`}>
                        <span className="inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-white/70 border border-current/10">
                          <Icon size={16} />
                        </span>
                        <span className="text-xs font-black uppercase tracking-tight leading-snug break-words min-w-0 pt-1.5">
                          {cardTitle}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-2 leading-snug flex-1">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : showPendingScanPicker ? (
            <div className="space-y-3 py-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">On Hold — scan type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeQcHoldPendingScanOptions().map((option) => {
                  const cardAccent = QC_HOLD_PICKER_ACCENT[option.accent] || QC_HOLD_PICKER_ACCENT.amber;
                  const Icon = QC_HOLD_PICKER_ICONS[option.icon] || Package;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectPendingScanMode(option)}
                      className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] min-w-0 h-full flex flex-col ${cardAccent.card}`}
                    >
                      <div className={`flex items-start gap-2 min-w-0 ${cardAccent.title}`}>
                        <span className="inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-white/70 border border-current/10">
                          <Icon size={16} />
                        </span>
                        <span className="text-xs font-black uppercase tracking-tight leading-snug break-words min-w-0 pt-1.5">
                          {option.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-2 leading-snug flex-1">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2 animate-in fade-in duration-300">
              {isApprove ? (
                <>
                  <div className="space-y-1" data-field="hold_id">
                    <label className={FORM_LABEL_CLASS}>Pending Hold</label>
                    <input
                      readOnly
                      disabled
                      value={holdSelectLabel(parentHold || editData)}
                      className={`${OK_INPUT} rounded-lg border-slate-200 bg-slate-50 cursor-default w-full min-w-0`}
                    />
                  </div>
                  {pendingApprovalSubmission ? (
                    <p className={`text-[8px] font-bold uppercase px-1.5 py-1 rounded border leading-tight ${approveAccent.banner}`}>
                      {approveIsRevertFlow
                        ? "Revert (no change)"
                        : approveIsFullFlow
                          ? "Full submit"
                          : "Partial submit"}{" "}
                      · Submission #{pendingApprovalSubmission.submission_id}
                    </p>
                  ) : null}
                  {submitPackingMeta ? (
                    <CollapsiblePackingContext
                      meta={submitPackingMeta}
                      badgeText={
                        submitHoldSnap
                          ? `On hold · ${fmtQty(submitHoldSnap.totalQty)}`
                          : null
                      }
                      headerQty={submitHoldSnap?.totalQty ?? null}
                    />
                  ) : null}
                  {approveIsRevertFlow ? (
                    <div className={`rounded-xl border px-3 py-2.5 space-y-1 ${approveAccent.banner}`}>
                      <p className="text-xs font-bold uppercase tracking-wide">No change revert</p>
                      <p className="text-[11px] leading-snug opacity-90">
                        Authorize to remove QC hold only — stickers and locations stay as they are.
                      </p>
                      {submitHoldSnap ? (
                        <p className="text-[11px] font-semibold tabular-nums pt-1">
                          Balance to release: {fmtQty(submitHoldSnap.balanceQty)} qty
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <HoldSubmitBalancePanel
                      hold={parentHold || editData}
                      submitForm={submitForm}
                      onFieldChange={handleApproveFieldChange}
                      isFullFlow={approveIsFullFlow}
                      errors={errors}
                      authorizeEdit
                    />
                  )}
                  <TypeableSuggestField
                    label="Reason"
                    required
                    value={submitForm.reason}
                    onChange={(v) => handleApproveFieldChange("reason", v)}
                    error={errors.submit_reason}
                    dataField="submit_reason"
                    fetchSuggestions={fetchQcHoldReasonSuggestions}
                    optionLabelKey="reason"
                    optionIdKey="reason"
                    active={open && formReady && isApprove}
                    onClearError={() => {
                      if (errors.submit_reason) {
                        setErrors((prev) => ({ ...prev, submit_reason: "" }));
                      }
                    }}
                  />
                  <FormTextarea
                    label="Remark"
                    value={submitForm.remarks}
                    onChange={(e) => handleApproveFieldChange("remarks", e.target.value)}
                    placeholder="Optional notes…"
                    rows={2}
                  />
                  {pendingSubmissions.length === 0 ? (
                    <p className="text-[10px] font-bold text-rose-600">No pending submission to authorize.</p>
                  ) : (
                    <p className={`text-[8px] font-bold uppercase px-1.5 py-1 rounded border leading-tight ${approveAccent.banner}`}>
                      Adjust if needed, then click Authorize to approve.
                    </p>
                  )}
                </>
              ) : isSubmitFlow ? (
                <>
                  <div data-field="hold_id">
                    <SearchableSelect
                      label="Pending Hold"
                      value={parentHold?.hold_id ?? ""}
                      onChange={(id) => {
                        void loadParentHold(id, { autoFull: isFullFlow });
                        if (errors.hold_id) setErrors((prev) => ({ ...prev, hold_id: "" }));
                      }}
                      fetchService={async (params) => {
                        const res = await qcHoldMaterialService.getActiveHolds(params?.search);
                        const rows = (res?.data || [])
                          .filter((row) => !row.has_pending_submission && Number(row.balance_qty ?? 0) > 0)
                          .map((row) => mapQcHoldSelectRow(row));
                        return { data: rows, total: rows.length };
                      }}
                      getByIdService={async (id) => {
                        const res = await qcHoldMaterialService.getById(id);
                        const row = res?.data;
                        return row ? mapQcHoldSelectRow(row) : null;
                      }}
                      dataKey="hold_id"
                      labelKey="label"
                      placeholder="Search hold # or packing…"
                      error={errors.hold_id}
                      required
                      usePortal={false}
                    />
                  </div>
                  {submitPackingMeta ? (
                    <CollapsiblePackingContext
                      meta={submitPackingMeta}
                      badgeText={
                        submitHoldSnap
                          ? `On hold · ${fmtQty(submitHoldSnap.totalQty)}`
                          : null
                      }
                      headerQty={submitHoldSnap?.totalQty ?? null}
                    />
                  ) : null}
                  {isRevertFlow ? (
                    <div className={`rounded-xl border px-3 py-2.5 space-y-1 ${accent.banner}`}>
                      <p className="text-xs font-bold uppercase tracking-wide">No change revert</p>
                      <p className="text-[11px] leading-snug opacity-90">
                        On approval: <strong>no new stickers</strong>, <strong>no location change</strong>. Boxes stay
                        where they are — only <strong>QC hold is removed</strong> and a log is recorded.
                      </p>
                      {submitHoldSnap ? (
                        <p className="text-[11px] font-semibold tabular-nums pt-1">
                          Full balance to release: {fmtQty(submitHoldSnap.balanceQty)} qty
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <HoldSubmitBalancePanel
                      hold={parentHold}
                      submitForm={submitForm}
                      onFieldChange={handleSubmitFieldChange}
                      isFullFlow={isFullFlow}
                      errors={errors}
                    />
                  )}
                  <TypeableSuggestField
                    label="Reason"
                    required
                    value={submitForm.reason}
                    onChange={(v) => setSubmitForm((prev) => ({ ...prev, reason: v }))}
                    error={errors.submit_reason}
                    dataField="submit_reason"
                    fetchSuggestions={fetchQcHoldReasonSuggestions}
                    optionLabelKey="reason"
                    optionIdKey="reason"
                    active={open && formReady && isSubmitFlow}
                    onClearError={() => {
                      if (errors.submit_reason) {
                        setErrors((prev) => ({ ...prev, submit_reason: "" }));
                      }
                    }}
                  />
                  <FormTextarea
                    label="Remark"
                    value={submitForm.remarks}
                    onChange={(e) => setSubmitForm((prev) => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Optional notes…"
                    rows={2}
                  />
                  <p className={`text-[8px] font-bold uppercase px-1.5 py-1 rounded border leading-tight ${accent.banner}`}>
                    Requires super admin approval.
                  </p>
                </>
              ) : (
                <div className="space-y-3 animate-in fade-in duration-300">
              <CollapsiblePackingContext
                meta={packingMeta}
                scannedCount={scannedCount}
                scannedTotalQty={scannedTotalQty}
              />

              <TypeableSuggestField
                label="Reason"
                required
                value={form.reason}
                onChange={(v) => setForm((prev) => ({ ...prev, reason: v }))}
                error={errors.reason}
                readOnly={readOnly}
                dataField="reason"
                fetchSuggestions={fetchQcHoldReasonSuggestions}
                optionLabelKey="reason"
                optionIdKey="reason"
                active={open && formReady && !isSubmitFlow && !isApprove}
                onClearError={() => {
                  if (errors.reason) setErrors((prev) => ({ ...prev, reason: "" }));
                }}
              />

              {showFullHoldPackingUi && !isEdit && scannedBoxes.length === 0 ? (
                <div className="space-y-2 bg-yellow-50/40 p-2 rounded-lg border border-yellow-200 shadow-sm">
                  <p className="text-[10px] font-bold text-yellow-900 uppercase px-0.5">Full hold — packing</p>
                  {(showPhoneQr || showLaserUi) ? (
                    <div className="flex items-stretch gap-2 w-full min-w-0 p-1.5 bg-white border border-yellow-100 rounded-lg">
                      {showPhoneQr && (
                        <button
                          type="button"
                          onClick={startScanner}
                          disabled={isScannerOpen || loadingFullHold}
                          className={`h-9 px-3 bg-yellow-600 border border-yellow-700 text-white hover:bg-yellow-700 rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
                        >
                          <QrCode size={14} />
                          <span className="text-[10px] font-black uppercase">Scan box</span>
                        </button>
                      )}
                      {showLaserUi && (
                        <LaserScanField
                          active={open && isConfirmed}
                          onScanned={(code) => void tryFullHoldByBoxScan(code)}
                          keyboardInputRef={keyboardInputRef}
                          formatPreview={boxNoUidDisplayLabel}
                          compact
                          heightClass="h-9"
                          fill={scanBtnCount > 0}
                          armButtonLabel="Scan"
                        />
                      )}
                    </div>
                  ) : null}
                  <div className="flex w-full min-w-0 gap-1.5 p-1.5 bg-white border border-yellow-100 rounded-lg">
                    <input
                      type="text"
                      value={manualPackingNo}
                      onChange={(e) => {
                        setManualPackingNo(e.target.value);
                        if (errors.scan) setErrors((prev) => ({ ...prev, scan: "" }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (manualPackingNo.trim()) void loadFullHoldByPacking(manualPackingNo);
                        }
                      }}
                      placeholder="Type packing number…"
                      disabled={loadingFullHold}
                      className={`${OK_INPUT} flex-1 min-w-0 font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => void loadFullHoldByPacking(manualPackingNo)}
                      disabled={loadingFullHold || !manualPackingNo.trim()}
                      className="h-9 px-3 bg-yellow-600 text-white rounded-lg text-[10px] font-bold uppercase shrink-0 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {loadingFullHold ? <Loader2 size={14} className="animate-spin" /> : null}
                      Load
                    </button>
                  </div>
                </div>
              ) : null}

              {showFullHoldPackingUi && !isEdit && scannedBoxes.length > 0 ? (
                <p className={`text-[8px] font-bold uppercase px-1.5 py-1 rounded border leading-tight ${accent.banner}`}>
                  Full hold · Packing #{lockedPackingRef.current || manualPackingNo} · {scannedCount} in-hand stock boxes
                </p>
              ) : null}

              {showPartialScanUi && scannedBoxes.length > 0 ? (
                <p className={`text-[8px] font-bold uppercase px-1.5 py-1 rounded border leading-tight ${accent.banner}`}>
                  Partial hold · Packing #{lockedPackingRef.current || "—"} · {scannedCount} in-hand stock boxes
                </p>
              ) : null}

              {showPartialScanUi && (
                <div className="space-y-2 bg-amber-50/30 p-2 rounded-lg border border-amber-100 shadow-sm">
                  {showPartialScanUi ? (
                    <div className="space-y-2 p-1.5 bg-white border border-amber-100 rounded-lg w-full min-w-0">
                      {scannedBoxes.length === 0 ? (
                        <p className="text-[9px] font-semibold text-amber-800/80 px-0.5 leading-snug">
                          Scan only boxes in stock (in-hand). Outward/dispatch or already on QC hold cannot be added.
                        </p>
                      ) : null}
                      {(showPhoneQr || showLaserUi) ? (
                        <div className="flex items-stretch gap-2 w-full min-w-0">
                          {showPhoneQr && (
                            <button
                              type="button"
                              onClick={startScanner}
                              disabled={isScannerOpen}
                              className={`h-9 px-3 bg-amber-600 border border-amber-700 text-white hover:bg-amber-700 rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
                            >
                              <QrCode size={14} />
                              <span className="text-[10px] font-black uppercase">QR</span>
                            </button>
                          )}
                          {showLaserUi && (
                            <LaserScanField
                              active={open && isConfirmed}
                              onScanned={(code) => void tryAddBox(code)}
                              keyboardInputRef={keyboardInputRef}
                              formatPreview={boxNoUidDisplayLabel}
                              compact
                              heightClass="h-9"
                              fill={scanBtnCount > 0}
                              armButtonLabel="Scan"
                            />
                          )}
                        </div>
                      ) : null}
                      {keyboardType ? (
                        <div className="flex w-full min-w-0 gap-1.5">
                          <input
                            type="text"
                            value={manualBoxId}
                            onChange={(e) => setManualBoxId(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (manualBoxId.trim()) {
                                  void tryAddBox(manualBoxId);
                                  setManualBoxId("");
                                }
                              }
                            }}
                            placeholder="Type or paste box_no_uid…"
                            className={`${OK_INPUT} flex-1 min-w-0 font-mono`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (manualBoxId.trim()) {
                                void tryAddBox(manualBoxId);
                                setManualBoxId("");
                              }
                            }}
                            className="h-9 px-3 bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      ) : !showPhoneQr && !showLaserUi && !keyboardType ? (
                        <p className="text-[10px] text-slate-500 px-1">Enable scan mode in Settings.</p>
                      ) : null}
                    </div>
                  ) : null}

                  {pendingScanCount > 0 && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-white border border-amber-100 rounded-lg">
                      <Loader2 size={12} className="animate-spin text-amber-600" />
                      <p className="text-[9px] font-bold text-amber-700 uppercase">
                        Confirming {pendingScanCount} box{pendingScanCount === 1 ? "" : "es"}…
                      </p>
                    </div>
                  )}

                  {errors.scan && !isFullPendingScan ? (
                    <p className="text-[10px] font-bold text-rose-600 px-0.5">{errors.scan}</p>
                  ) : null}
                </div>
              )}

              {showScanUi && (
                <div className="space-y-2">
                  {loadingFullHold && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-white border border-yellow-100 rounded-lg">
                      <Loader2 size={12} className="animate-spin text-yellow-600" />
                      <p className="text-[9px] font-bold text-yellow-800 uppercase">Loading in-hand stock boxes…</p>
                    </div>
                  )}

                  {errors.scan && isFullPendingScan ? (
                    <p className="text-[10px] font-bold text-rose-600 px-0.5">{errors.scan}</p>
                  ) : null}

                  <div className="bg-white/60 rounded-lg border border-amber-50 overflow-hidden">
                    <div className="px-3 py-1.5 bg-amber-100/50 border-b border-amber-100 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-amber-800 uppercase">
                        {isFullPendingScan ? "In-hand stock (full hold)" : "In-hand stock (partial hold)"}
                      </span>
                      <span className="text-[9px] font-black text-amber-800/50 uppercase">{scannedCount} total</span>
                    </div>
                    <div className="max-h-[min(40dvh,280px)] overflow-y-auto overscroll-y-contain p-2 custom-scrollbar">
                      {scannedBoxes.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {scannedBoxes.map((box) => (
                            <div
                              key={box.box_no_uid}
                              className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between shadow-sm"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0">
                                  B
                                </div>
                                <div className="flex flex-col leading-tight min-w-0">
                                  <span className="text-[11px] font-mono font-black text-slate-700 truncate">
                                    {box.box_no_uid}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase truncate">
                                    #{box.packing_number || "—"} · Qty: {Number(box.qty ?? 0).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                              {!readOnly && !isFullPendingScan ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBox(box.box_no_uid)}
                                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
                                >
                                  <X size={16} />
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                          <ScanLine size={32} className="opacity-20 mb-3" />
                          <p className="text-[10px] font-black uppercase tracking-widest">
                            {isFullPendingScan ? "Enter packing number above" : "Scan in-hand stock boxes"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <FormTextarea
                label="Remark"
                value={form.remarks}
                onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                disabled={readOnly}
                placeholder="Optional notes…"
                rows={3}
              />
                </div>
              )}

              <ModuleSopAcknowledgment
                ref={sopAckRef}
                moduleSlug="qc_hold_material"
                permissionType={sopPermissionType}
                isOpen={open}
              />
            </div>
          )}
        </div>
      </Drawer>

      <Snackbar {...snackbar} onClose={closeSnackbar} />
    </>
  );
}
