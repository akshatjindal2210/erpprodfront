"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Eye, FileText, Loader2, Shield, Upload, X } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { invoiceReceivingService } from "@/apps/ims/lib/services/invoiceReceiving";
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { FormLabel, OK_INPUT } from "@/ui/common/Constants";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { formatImsErpScalar, formatIrBillDate, formatIrDateTime, irReceivingFilePath, isImsErpNullLiteral, isIrApproved, normalizeInvoiceReceivingRow, pickIrRemarks, publicUploadHref, receivingFileLabel } from "./invoiceReceivingUtils";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf";
const DISABLED = `${OK_INPUT} !bg-slate-100 !text-slate-600 border-slate-200 shadow-none focus:!ring-0 cursor-not-allowed disabled:opacity-100`;
const FILE_LINK =
  "flex items-center gap-2 w-full min-h-9 px-3 py-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-left";

const BTN_CANCEL =
  "px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white disabled:opacity-50";
const BTN_APPROVE =
  "min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50";
const BTN_PRIMARY =
  "min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50";
const BTN_KEEP =
  "px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50";

/** @deprecated import formatIrBillDate from invoiceReceivingUtils */
export const formatBillDate = formatIrBillDate;

function StoredFileLink({ path }) {
  const href = publicUploadHref(path);
  const name = receivingFileLabel(path);
  if (!href || !name) return null;
  return (
    <FilePreviewLink href={href} fileName={name} className={FILE_LINK} title={name}>
      <Eye size={14} className="shrink-0 text-indigo-600" />
      <span className="truncate text-[11px] font-semibold text-indigo-700">{name}</span>
    </FilePreviewLink>
  );
}

export default function InvoiceReceivingModal({ open, onClose, bill: billProp, mode = "add", onSuccess }) {
  const bill = useMemo(
    () => (billProp && typeof billProp === "object" ? normalizeInvoiceReceivingRow(billProp) : billProp),
    [billProp]
  );

  const canAccess = useCanAccess();
  const canAdd = canAccess("invoice_receiving", "add").allowed;
  const canEdit = canAccess("invoice_receiving", "edit").allowed;
  const canApprove = canAccess("invoice_receiving", "authorize").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const isAdd = mode === "add";
  const readOnly = mode === "view";
  const erpApproved = isIrApproved(bill);
  const showApprovalToggle = canApprove && isAdd;

  const [file, setFile] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSubmit, setActiveSubmit] = useState(null);

  const existingFile = irReceivingFilePath(bill);
  const hasStoredFile = Boolean(String(existingFile).trim());
  const fileRequired = isAdd || (isEdit && !hasStoredFile);
  const fileLocked = readOnly || isApprove;

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setSaving(false);
    setRemarks(pickIrRemarks(bill));
    setApproved(isApprove);
  }, [open, bill?.prnbillno, mode, bill, isApprove]);

  const hasAttachment = file instanceof File || hasStoredFile;
  const canSave =
    !readOnly && Boolean(bill?.prnbillno) && !saving && hasAttachment && (!fileRequired || file instanceof File);

  const save = async (wantApproved, actionKey) => {
    if (!canSave) return;

    let finalApproved = !!wantApproved;
    if (actionKey === "keep_pending") finalApproved = false;
    else if (actionKey === "approve") finalApproved = true;
    else if (actionKey === "save" && isEdit && erpApproved) finalApproved = false;
    else if (actionKey === "save" && isAdd) finalApproved = Boolean(showApprovalToggle && approved);

    setActiveSubmit(actionKey);
    setSaving(true);
    try {
      const res = await invoiceReceivingService.update({
        prnbillno: bill?.prnbillno,
        billdt: bill?.billdt,
        acc_name: bill?.acc_name,
        receivingfile: existingFile || undefined,
        uploaded_by: bill?.uploaded_by,
        uploaded_at: bill?.uploaded_at,
        remarks,
        approved: finalApproved,
        file,
        mode,
      });
      if (!res?.success) throw new Error(res?.message || "Update failed.");
      toast.success(res?.message || "Saved.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not save.");
    } finally {
      setSaving(false);
      setActiveSubmit(null);
    }
  };

  const footer = readOnly ? (
    <div className="flex justify-end w-full">
      <button type="button" onClick={onClose} className={BTN_CANCEL}>
        Close
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full">
      <button type="button" disabled={saving} onClick={onClose} className={BTN_CANCEL}>
        Cancel
      </button>

      {isApprove ? (
        <>
          <button type="button" disabled={!canSave || saving} onClick={() => void save(false, "keep_pending")} className={BTN_KEEP}>
            {saving && activeSubmit === "keep_pending" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Saving…
              </span>
            ) : (
              "Keep Pending"
            )}
          </button>
          <button type="button" disabled={!canSave || saving} onClick={() => void save(true, "approve")} className={BTN_APPROVE}>
            {saving && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
            Approve
          </button>
        </>
      ) : (
        <>
          {isEdit && canApprove ? (
            <button type="button" disabled={!canSave || saving} onClick={() => void save(true, "approve")} className={BTN_APPROVE}>
              {saving && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
              Save & Approve
            </button>
          ) : null}
          {(isEdit && canEdit) || (isAdd && canAdd) ? (
            <button type="button" disabled={!canSave || saving} onClick={() => void save(null, "save")} className={BTN_PRIMARY}>
              {saving && activeSubmit === "save" ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  {isAdd ? <Upload size={18} /> : <Check size={18} />}
                  {isAdd ? "Receive" : "Save"}
                </>
              )}
            </button>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={saving ? () => {} : onClose}
      title={
        isApprove ? "Approve Invoice" : isEdit ? "Edit Received Invoice" : isAdd ? "Receive Invoice" : "Invoice Receiving"
      }
      description={
        isApprove
          ? "Authorize this received invoice"
          : isEdit
            ? "Update attachment or remarks"
            : isAdd
              ? "Bill and receiving attachment"
              : "Received invoice details"
      }
      maxWidth="max-w-lg"
      headerVariant="form"
      footer={footer}
    >
      <div className="space-y-4 pb-4">
        {isEdit && erpApproved ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized invoice will reset its status to{" "}
              <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FormLabel>Bill number</FormLabel>
            <input readOnly disabled value={bill?.prnbillno || "—"} className={`${DISABLED} font-mono uppercase`} />
          </div>
          <div className="space-y-1">
            <FormLabel>Bill date</FormLabel>
            <input readOnly disabled value={formatIrBillDate(bill?.billdt)} className={DISABLED} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <FormLabel>Customer</FormLabel>
            <input readOnly disabled value={bill?.acc_name || "—"} className={DISABLED} title={bill?.acc_name || ""} />
          </div>
        </div>

        {!isAdd ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <FormLabel>Received by</FormLabel>
              <input readOnly disabled value={formatImsErpScalar(bill?.uploaded_by)} className={DISABLED} />
            </div>
            <div className="space-y-1">
              <FormLabel>Received at</FormLabel>
              <input readOnly disabled value={formatIrDateTime(bill?.uploaded_at)} className={DISABLED} />
            </div>
            <div className="space-y-1">
              <FormLabel>Approved by</FormLabel>
              <input
                readOnly
                disabled
                value={formatImsErpScalar(bill?.approved_by || bill?.approved_by_name)}
                className={DISABLED}
              />
            </div>
            <div className="space-y-1">
              <FormLabel>Approved at</FormLabel>
              <input readOnly disabled value={formatIrDateTime(bill?.approved_at)} className={DISABLED} />
            </div>
          </div>
        ) : null}

        <div className="space-y-1">
          <FormLabel required={!readOnly && !isApprove && fileRequired}>Attachment</FormLabel>
          {fileLocked ? (
            hasStoredFile ? (
              <StoredFileLink path={existingFile} />
            ) : isImsErpNullLiteral(bill?.receivingfile || bill?.file_path) ? (
              <input readOnly disabled value="null" className={DISABLED} />
            ) : (
              <input readOnly disabled value="—" className={DISABLED} />
            )
          ) : file ? (
            <div className="flex items-center gap-2 h-9 px-3 border border-slate-200 rounded-lg bg-white min-w-0">
              <FileText size={14} className="shrink-0 text-emerald-600" />
              <span className="truncate text-[11px] font-medium flex-1">{file.name}</span>
              <button type="button" disabled={saving} onClick={() => setFile(null)} className="text-slate-400 hover:text-rose-600">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {hasStoredFile ? <StoredFileLink path={existingFile} /> : null}
              <label className="flex items-center gap-2 h-9 px-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100">
                <Upload size={14} className="text-slate-500 shrink-0" />
                <span className="text-[11px] font-medium text-slate-600">{hasStoredFile ? "Replace file…" : "Choose file…"}</span>
                <input
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  disabled={saving}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
        </div>

        <FormTextarea
          label="Remarks"
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e?.target?.value ?? "")}
          placeholder="Optional notes"
          disabled={readOnly || isApprove}
        />

        {showApprovalToggle ? (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
                <p className={`text-[9px] uppercase font-bold ${approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {approved ? "Authorized" : "Pending"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
