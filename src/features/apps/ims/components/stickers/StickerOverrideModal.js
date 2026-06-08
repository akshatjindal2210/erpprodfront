"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ScanLine, QrCode, X, Trash2, Info, Shield, Check, AlertCircle, Plus } from "lucide-react";
import { toast } from "react-toastify";

import { boxService } from "@/features/apps/ims/services/box";
import { masterService } from "@/features/apps/ims/services/master";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import RemarksTextarea from "@/core/components/common/RemarksTextarea";
import Drawer from "@/core/components/ui/Drawer";
import ModuleSopAcknowledgment from "@/core/components/common/ModuleSopAcknowledgment";
import Snackbar from "@/core/components/ui/Snackbar";
import { OK_INPUT } from "@/core/components/common/Constants";
import { SCAN_SNACK_MSG, getBoxNoUidPrefix, parseStandardBoxNoUid, useScanSnackbarActions } from "@/core/utils/global";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { isMobileDevice } from "@/core/utils/pwa";
import { detectQrType, parseBoxScanRaw, parseStickerScan } from "@/features/apps/ims/helpers/qrScan";
import { prepareQrScanSession } from "@/features/apps/ims/helpers/scanFeedback";
import { pickBoxFromViewsResponse } from "@/features/apps/ims/helpers/boxViewsLookup";
import {
  isBoxEligibleForOverrideCustomer,
  overrideCustomerScanRejectMessage,
} from "@/features/apps/ims/utils/boxInventory";
import { useHtml5QrScanner } from "@/core/hooks/useHtml5QrScanner";
import QrScannerOverlay from "@/core/components/common/QrScannerOverlay";
import { focusFirstError } from "@/core/utils/formFocus";

const FIELD_ORDER = ["to_customer_code"];

const INITIAL_FORM = {
  to_customer_code: "",
  to_customer_name: "",
  remarks: "",
  approved: false,
};

function itemCodeForOverrideRow(row) {
  const direct = row?.itemdcode ?? row?.item_dcode;
  if (direct != null && String(direct).trim() !== "") {
    return String(direct).trim().toUpperCase();
  }
  if (parseStandardBoxNoUid(row?.box_no_uid, getBoxNoUidPrefix())) return "";
  return String(row?.box_no_uid || "").split("_")[0]?.trim().toUpperCase() || "";
}
const normalizeCode = (value = "") => String(value).trim().toUpperCase();

function isAccNameSameAsCustCode(row, name) {
  const code = row?.override_cust ?? row?.acc_code ?? row?.from_customer;
  const label = name != null ? String(name).trim() : "";
  if (code == null || !label) return false;
  return label === String(code).trim();
}

/** Current customer on the box — ledger name, not account code. */
const currentCustomerDisplay = (row) => {
  const candidates = [
    row?.from_customer_name,
    row?.acc_name,
    row?.override_customer_name,
  ];
  for (const c of candidates) {
    const label = c?.trim();
    if (!label || isAccNameSameAsCustCode(row, label)) continue;
    return label;
  }
  return "Stock";
};

async function enrichOverrideBoxCustomer(box, permissionAction = "view") {
  if (!box) return null;
  const custCode = box.override_cust ?? box.acc_code;
  let accName = box.acc_name?.trim() || "";
  if (custCode && (!accName || isAccNameSameAsCustCode(box, accName))) {
    try {
      const res = await masterService.getLedgerViewById(String(custCode), {
        permission_module: "change_override_customer",
        permission_action: permissionAction,
      });
      if (res?.data?.acc_name?.trim()) {
        accName = res.data.acc_name.trim();
      }
    } catch {
      /* keep existing */
    }
  }
  return {
    ...box,
    acc_name: accName || null,
  };
}

/** DOM id for scanner — must not clash with Inward modal's `#reader` */
const STICKER_SCANNER_ELEMENT_ID = "override-sticker-reader";
const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: SNACK_DUR.med };

export default function OverrideRequestDrawer({ open, onClose, onSuccess, editData, mode = "add" }) {
  // Authorization & Mode Hooks
  const canAccess = useCanAccess();
  const canApprove = canAccess("change_override_customer", "authorize").allowed;
  const canRemoveScannedSticker = canAccess("change_override_customer", "delete").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  const showApproval = canApprove && (mode === "add" || mode === "approve");

  // States
  const [loading, setLoading] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [scanRows, setScanRows] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const lastScanRef = useRef({ key: "", at: 0 });
  const onScanByCodeRef = useRef(async () => {});
  const inFlightScanRef = useRef(new Set());
  const scanToastRef = useRef({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);

  const openSnackbar = useCallback((payload) => {
    setSnackbar({
      open: true,
      variant: payload.variant ?? "info",
      title: payload.title ?? "",
      message: payload.message ?? "",
      duration: payload.duration ?? SNACK_DUR.med,
    });
  }, []);

  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);

  const closeScanner = useCallback(() => setIsScannerOpen(false), []);

  // Lifecycle: Sync Data on Open/Edit
  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        setForm({
          to_customer_code: editData.to_customer || "",
          to_customer_name: editData.to_customer_name || "",
          remarks: editData.remarks || "",
          approved: editData.status === "approved" || (editData.approved ?? false),
        });

        if (editData.details && editData.details.length > 0) {
          void Promise.all(
            editData.details.map((d) =>
              enrichOverrideBoxCustomer(
                { ...d, override_cust: d.override_cust ?? editData.from_customer },
                sopPermissionType
              )
            )
          ).then((rows) => setScanRows(rows.filter(Boolean)));
        } else if (editData.box_uids && Array.isArray(editData.box_uids)) {
          const mappedRows = editData.box_uids.map((id, index) => ({
              box_uid: id,
              box_no_uid: editData.box_no_uids ? editData.box_no_uids[index] : id,
              override_cust: editData.from_customer,
              packing_number: editData.packing_number,
          }));
          void Promise.all(
            mappedRows.map((r) => enrichOverrideBoxCustomer(r, sopPermissionType))
          ).then((rows) => setScanRows(rows.filter(Boolean)));
        } else if (editData.box_no_uid) {
          // Single box case
          setScanRows([editData]);
        }
      } else {
        setForm(INITIAL_FORM);
        setScanRows([]);
      }
      setErrors({});
    } else {
      timeoutId = setTimeout(() => {
        setForm(INITIAL_FORM);
        setScanRows([]);
        setErrors({});
        closeScanner();
      }, 300);
    }
    return () => {
      clearTimeout(timeoutId);
      closeScanner();
    };
  }, [open, editData?.request_id, isApprove, closeScanner]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
  };

  const resolveBoxFromInput = async (rawCode) => {
    const { box_no_uid, box_uid } = parseStickerScan(rawCode);
    const code = box_no_uid || box_uid || parseBoxScanRaw(rawCode);
    if (!code) return null;

    try {
      const res = await boxService.getViews({
        ...(box_no_uid ? { box_no_uid } : {}),
        ...(box_uid ? { box_uid } : {}),
        id: code,
        permission_module: "change_override_customer",
        permission_action: "view",
      });
      const box = pickBoxFromViewsResponse(res);
      if (box?.box_no_uid) {
        if (!isBoxEligibleForOverrideCustomer(box)) {
          return { rejected: res?.reject_reason || overrideCustomerScanRejectMessage(box) };
        }
        return enrichOverrideBoxCustomer(
          {
            ...box,
            box_uid: box.id ?? box.box_uid,
          },
          sopPermissionType === "authorize" ? "authorize" : sopPermissionType === "edit" ? "edit" : "view"
        );
      }
      if (res?.reject_reason) {
        return { rejected: res.reject_reason };
      }
    } catch {
      // continue
    }

    // Fallback to sticker management list (requires sticker_download_logs permission)
    try {
      const searchRes = await boxService.getStickerManagementList({
        page: 1,
        limit: 20,
        search: code,
        list_mode: "box",
      });
      const found = (searchRes.data || []).find(
        (r) =>
          String(r.box_no_uid).toLowerCase() === code.toLowerCase() ||
          String(r.box_uid) === code
      );
      if (!found) return null;
      if (!isBoxEligibleForOverrideCustomer(found)) {
        return { rejected: overrideCustomerScanRejectMessage(found) };
      }
      return enrichOverrideBoxCustomer(
        found,
        sopPermissionType === "authorize" ? "authorize" : sopPermissionType === "edit" ? "edit" : "view"
      );
    } catch {
      return null;
    }
  };

  const onScanByCode = async (rawCode, source = "manual") => {
    const qrType = detectQrType(rawCode);
    if (qrType === "location") {
      showScanToast("error", "generic-scan-override", SCAN_SNACK_MSG.REJECTED);
      setScanValue("");
      return;
    }

    const { box_no_uid: scanNoUid, box_uid: scanUid } = parseStickerScan(rawCode);
    const code = scanNoUid || scanUid || parseBoxScanRaw(rawCode);
    if (!code) {
      showScanToast("error", "generic-invalid-sticker", SCAN_SNACK_MSG.REJECTED);
      setScanValue("");
      return;
    }

    if (
      scanRows.some(
        (r) =>
          (scanNoUid && String(r.box_no_uid).toLowerCase() === scanNoUid.toLowerCase()) ||
          (scanUid && String(r.box_uid) === String(scanUid)) ||
          String(r.box_no_uid).toLowerCase() === code.toLowerCase() ||
          String(r.box_uid) === code
      )
    ) {
      setScanValue("");
      showScanToast("info", `duplicate-sticker-${code.toLowerCase()}`, SCAN_SNACK_MSG.BOX_DUPLICATE(code), 1400);
      return;
    }

    const lockKey = `${source}:${code.toLowerCase()}`;
    if (source === "scanner" && inFlightScanRef.current.has(lockKey)) return;
    if (source === "scanner") inFlightScanRef.current.add(lockKey);

    setLoading(true);
    try {
      const found = await resolveBoxFromInput(rawCode);

      if (found?.rejected) {
        showScanToast("error", "box-not-eligible", found.rejected);
        return;
      }

      if (!found) {
        showScanToast(
          "error",
          "box-not-found",
          "Box not found. Scan the sticker QR code or enter a valid box number."
        );
        return;
      }

      const itemCode = itemCodeForOverrideRow(found);
      if (scanRows.length > 0) {
        const first = scanRows[0];
        if (String(found.packing_number) !== String(first.packing_number)) {
          showScanToast("error", "packing-mismatch",
            `Same packing only: first sticker is packing #${first.packing_number}. This box is #${found.packing_number}.`
          );
          return;
        }
        const firstItemCode = itemCodeForOverrideRow(first);
        if (itemCode && firstItemCode && itemCode !== firstItemCode) {
          showScanToast("error", "item-mismatch", "Item code must match the first scanned sticker for this request.");
          return;
        }
      }

      setScanRows((prev) => {
        if (
          prev.some(
            (r) =>
              String(r.box_uid) === String(found.box_uid) ||
              String(r.box_no_uid).toLowerCase() === String(found.box_no_uid).toLowerCase()
          )
        ) {
          return prev;
        }
        return [...prev, found];
      });
      const addedCode = found.box_no_uid || code;
      if (source === "scanner") {
        showScanSuccess(
          `scan-added-${String(addedCode).toLowerCase()}`,
          SCAN_SNACK_MSG.BOX_ADDED(addedCode)
        );
      } else {
        showScanSuccess(
          `scan-added-${String(addedCode).toLowerCase()}`,
          SCAN_SNACK_MSG.BOX_ADDED(addedCode),
          1200
        );
      }
      setScanValue("");
    } catch (err) {
      showScanToast("error", "lookup-failed", SCAN_SNACK_MSG.LOOKUP_FAILED);
    } finally {
      if (source === "scanner") inFlightScanRef.current.delete(lockKey);
      setLoading(false);
    }
  };

  onScanByCodeRef.current = onScanByCode;

  function handleStickerCameraDecoded(decodedText) {
    if (detectQrType(decodedText) === "location") {
      showScanToast("error", "generic-scan-override", SCAN_SNACK_MSG.REJECTED);
      return;
    }
    const rawBox = parseBoxScanRaw(decodedText) || String(decodedText || "").trim();
    if (!rawBox) return;

    const now = Date.now();
    const scanKey = `box:${rawBox}`;
    if (scanKey === lastScanRef.current.key && now - lastScanRef.current.at < 2000) {
      return;
    }
    lastScanRef.current = { key: scanKey, at: now };

    void onScanByCodeRef.current(decodedText, "scanner");
  }

  useHtml5QrScanner({
    active: isScannerOpen,
    elementId: STICKER_SCANNER_ELEMENT_ID,
    onDecoded: handleStickerCameraDecoded,
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: () => {
      showScanToast(
        "error",
        "camera-permission",
        SCAN_SNACK_MSG.CAMERA_DENIED ?? SCAN_SNACK_MSG.CAMERA,
        4000
      );
      setIsScannerOpen(false);
    },
  });

  const handleSave = async (statusOverride = null) => {
    if (!scanRows.length) return toast.error("Please add at least one box");
    if (!form.to_customer_code) {
      const e = { to_customer_code: "Target customer is required" };
      setErrors(e);
      toast.error("Target customer is required");
      focusFirstError(e, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;

    setLoading(true);
    try {
      let finalApproved = form.approved;

      if (statusOverride !== null) {
        finalApproved = statusOverride;
      } 
      else if (isEdit && !canApprove) {
        finalApproved = false; 
      }

      const payload = {
        request_id: editData?.request_id,
        box_uids: scanRows.map((r) => r.box_uid || r.id), 
        from_customer: scanRows[0].override_cust || scanRows[0].acc_code || editData?.from_customer,
        to_customer: form.to_customer_code,
        packing_number: scanRows[0].packing_number,
        remarks: form.remarks,
        approved: finalApproved,
      };

      const request = (isEdit || isApprove) 
        ? boxService.updateOverrideRequest(editData?.request_id, payload) 
        : boxService.createOverrideRequest(payload);
      
      const res = await request;
      toast.success(res?.message || "Successfully processed");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const footerContent = (
    <div className="flex items-center justify-end gap-3 w-full">
      <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-slate-500">
        Cancel
      </button>

      {isApprove ? (
        <>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Keep Pending
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={
              loading ||
              editData?.status === "approved" ||
              editData?.approved === true
            }
            className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
          </button>
        </>
      ) : (
        <button
          onClick={() => handleSave()}
          disabled={loading}
          className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Processing</>
          ) : (
            <><Check size={18} /> Save</>
          )}
        </button>
      )}
    </div>
  );

  return (
    <>
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => (isApprove ? handleSave(true) : handleSave())}
      title={isApprove ? "Approve Override" : isEdit ? "Edit Override" : "Customer Override"}
      description={
        isApprove
          ? "Review and authorize request"
          : "Update box customer assignment"
      }
      footer={footerContent}
      maxWidth="max-w-2xl"
    >
      <div ref={formRef} className="space-y-6 pb-6">
        <QrScannerOverlay
          open={isScannerOpen}
          onClose={closeScanner}
          readerId={STICKER_SCANNER_ELEMENT_ID}
          hint="Scanning sticker / box QR"
        />

        {/* Warning Alert */}
        {isApprove &&
          (editData?.status === "approved" || editData?.approved === true) && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <AlertCircle size={18} className="text-slate-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-700 font-medium">
                This request is already <span className="font-bold text-slate-900">approved</span>. Use{" "}
                <span className="font-bold">Edit</span> to change boxes or customer (status will go back to pending).
              </p>
            </div>
          )}
        {isEdit && editData?.status === "approved" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
              Editing this authorized request will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        {/* Sticker input — same row pattern as Inventory Inward (Scan + manual + Add) */}
        <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 space-y-1.5">
          <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide ml-1 flex justify-between items-center gap-2">
            <span>Sticker input (box table)</span>
            <span className={scanRows.length > 0 ? "text-indigo-800 font-black" : "text-indigo-400"}>
              Packing: {scanRows[0]?.packing_number || "—"}
            </span>
          </label>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            {isMobileDevice() && (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const prep = await prepareQrScanSession();
                    if (!prep.cameraOk) {
                      showScanToast(
                        "error",
                        "camera-permission",
                        prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
                        4000
                      );
                      return;
                    }
                    setIsScannerOpen(true);
                  })();
                }}
                disabled={loading || isScannerOpen}
                className="h-9 w-full sm:w-auto sm:shrink-0 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Open camera scanner"
              >
                <QrCode size={16} />
                <span className="text-[10px] font-black uppercase">Scan</span>
              </button>
            )}
            <div className={`flex flex-1 min-w-0 w-full items-center gap-2 ${OK_INPUT} border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-50/80`}>
              <ScanLine className="shrink-0 text-indigo-400 pointer-events-none" size={14} />
              <input
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onScanByCode(scanValue, "manual")}
                placeholder="Type box_no_uid (sticker) or paste QR text — Enter…"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[11px] font-normal font-mono text-slate-700 placeholder:font-normal placeholder:text-slate-400 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => onScanByCode(scanValue, "manual")}
              disabled={!scanValue?.trim() || loading}
              className="h-9 w-full sm:w-auto sm:shrink-0 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Selected Rows Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
              Selected Boxes ({scanRows.length})
            </h4>
            {canRemoveScannedSticker && scanRows.length > 0 ? (
              <button
                type="button"
                onClick={() => setScanRows([])}
                className="text-[10px] text-rose-500 font-bold hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors"
              >
                REMOVE ALL
              </button>
            ) : null}
          </div>

          <div className="max-h-60 overflow-y-auto overflow-x-auto">
            {scanRows.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Info size={20} className="text-slate-300" />
                </div>
                <p className="text-xs text-slate-400 font-medium">Ready for scan. Please add stickers.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-400 z-10 shadow-sm">
                  <tr className="border-b border-slate-100">
                    <th className="text-left p-3 font-semibold">Sticker (box_no_uid)</th>
                    <th className="text-left p-3 font-semibold">Current Customer</th>
                    <th className="text-right p-3 pr-5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {scanRows.map((row, idx) => (
                    <tr key={row.box_uid || idx} className="group hover:bg-indigo-50/30 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-700 font-mono text-[10px]">{row.box_no_uid}</span>
                      </td>
                      <td className="p-3 text-slate-700 min-w-0 max-w-[240px]">
                        <span className="block truncate font-medium" title={currentCustomerDisplay(row)}>
                          {currentCustomerDisplay(row)}
                        </span>
                      </td>
                      <td className="p-3 text-right pr-4">
                        {canRemoveScannedSticker ? (
                          <button
                            type="button"
                            onClick={() => setScanRows((prev) => prev.filter((_, i) => i !== idx))}
                            title="Remove from list"
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Destination: target customer full row, internal remarks full row below */}
        <div className="space-y-3 border-t border-slate-100 pt-5 sm:pt-6">
          <div className="w-full min-w-0" data-field="to_customer_code">
            <SearchableSelect
              label="Target Customer (To)"
              value={form.to_customer_code}
              onChange={(id, obj) => {
                handleChange("to_customer_code", id);
                handleChange("to_customer_name", obj?.acc_name || "");
              }}
              fetchService={(params) =>
                masterService.getLedgersViews({
                  ...params,
                  permission_module: "change_override_customer",
                  permission_action: sopPermissionType,
                })
              }
              getByIdService={(id) =>
                masterService.getLedgerViewById(id, {
                  permission_module: "change_override_customer",
                  permission_action: sopPermissionType,
                })
              }
              dataKey="id"
              labelKey="acc_name"
              placeholder="Search customer name…"
              required
            />
          </div>
          <RemarksTextarea
            label="Internal Remarks"
            value={form.remarks}
            onChange={(e) => handleChange("remarks", e.target.value)}
            placeholder="Reason, reference no., instructions…"
            rows={4}
          />
        </div>

        <div className="h-px bg-slate-100" />

        {showApproval ? (
          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${form.approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${form.approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${form.approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
                <p className={`text-[9px] uppercase font-bold tracking-tight ${form.approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {form.approved ? "Authorized" : "Pending Approval"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.approved}
                onChange={(e) => handleChange("approved", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">Override will be marked as &apos;Pending&apos; until authorized by an admin.</p>
          </div>
        )}

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${sopPermissionType}`}
          moduleSlug="change_override_customer"
          permissionType={sopPermissionType}
          isOpen={open}
        />
      </div>
    </Drawer>
    <Snackbar
      open={snackbar.open}
      variant={snackbar.variant}
      title={snackbar.title}
      message={snackbar.message}
      duration={snackbar.duration}
      onClose={closeSnackbar}
    />
    </>
  );
}
