"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Expand, FileText, Loader2, Shield, Upload, X } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { invoiceReceivingService } from "@/apps/ims/lib/services/invoiceReceiving";
import { FormLabel, OK_INPUT } from "@/ui/common/Constants";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import FilePreviewLink, { getFilePreviewKind } from "@/ui/common/system/FilePreviewLink";
import {
  formatImsErpScalar, formatIrBillDate, formatIrDateTime, irReceivingFilePaths, isImsErpNullLiteral, isIrApproved, normalizeInvoiceReceivingRow, pickIrRemarks, publicUploadHref, receivingFileLabel } from "./invoiceReceivingUtils";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf";
const DISABLED = `${OK_INPUT} !bg-slate-100 !text-slate-600 border-slate-200 shadow-none focus:!ring-0 cursor-not-allowed disabled:opacity-100`;

const BTN_CANCEL =
  "px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white disabled:opacity-50";
const BTN_APPROVE =
  "min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50";
const BTN_PRIMARY =
  "min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50";
const BTN_KEEP =
  "px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50";

function IrQuickPreview({ path }) {
  const href = publicUploadHref(path);
  const name = receivingFileLabel(path);
  const kind = getFilePreviewKind(name);
  if (!href || !name) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="h-[88px] bg-slate-50 overflow-hidden">
        {kind === "image" ? (
          <img src={href} alt={name} className="w-full h-full object-cover" />
        ) : kind === "pdf" ? (
          <iframe src={`${href.split("#")[0]}#toolbar=0`} title={name} className="w-full h-full border-0 pointer-events-none" />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            <FileText size={20} />
          </div>
        )}
      </div>
      <div className="px-2 py-1 border-t flex items-center gap-1 min-w-0">
        <span className="text-[9px] truncate flex-1">{name}</span>
        <FilePreviewLink href={href} fileName={name} className="text-indigo-600 p-0.5">
          <Expand size={12} />
        </FilePreviewLink>
      </div>
    </div>
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
  const canUpload = canAdd || canEdit || canApprove;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const isAdd = mode === "add";
  const readOnly = mode === "view";
  const erpApproved = isIrApproved(bill);
  const showApprovalToggle = canApprove && isAdd;

  const [storedPaths, setStoredPaths] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [remarks, setRemarks] = useState("");
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSubmit, setActiveSubmit] = useState(null);

  const fileLocked = readOnly;
  const totalAttachments = storedPaths.length + newFiles.length;
  const showDocPreview = totalAttachments > 0 && (readOnly || isApprove || isEdit || isAdd);

  useEffect(() => {
    if (!open) return;
    setNewFiles([]);
    setSaving(false);
    setStoredPaths(irReceivingFilePaths(bill));
    setRemarks(pickIrRemarks(bill));
    setApproved(isApprove);
  }, [open, bill?.prnbillno, mode, bill, isApprove]);

  const canSave =
    !readOnly && canUpload && Boolean(bill?.prnbillno) && !saving && totalAttachments > 0;

  const save = async (wantApproved, actionKey) => {
    if (!canSave) {
      if (!canUpload && !readOnly) toast.info("No permission to upload.");
      return;
    }
    if (isApprove && !canApprove) {
      toast.info("No permission to approve.");
      return;
    }

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
        uploaded_by: bill?.uploaded_by,
        uploaded_at: bill?.uploaded_at,
        remarks,
        approved: finalApproved,
        existing_paths: storedPaths,
        files: newFiles,
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

  const drawerFooter = readOnly ? (
    <div className="flex justify-end w-full">
      <button type="button" onClick={onClose} className={`${BTN_CANCEL} w-full sm:w-auto`}>
        Close
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full">
      <button type="button" disabled={saving} onClick={onClose} className={`${BTN_CANCEL} w-full sm:w-auto`}>
        Cancel
      </button>

      {isApprove ? (
        <>
          <button
            type="button"
            disabled={!canSave || saving || !canApprove}
            onClick={() => void save(false, "keep_pending")}
            className={`${BTN_KEEP} w-full sm:w-auto`}
          >
            {saving && activeSubmit === "keep_pending" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Saving…
              </span>
            ) : (
              "Keep Pending"
            )}
          </button>
          <button
            type="button"
            disabled={!canSave || saving || !canApprove}
            onClick={() => void save(true, "approve")}
            className={`${BTN_APPROVE} w-full sm:w-auto`}
          >
            {saving && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
            Approve
          </button>
        </>
      ) : (
        <>
          {isEdit && canApprove ? (
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={() => void save(true, "approve")}
              className={`${BTN_APPROVE} w-full sm:w-auto sm:min-w-[160px]`}
            >
              {saving && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
              Save & Approve
            </button>
          ) : null}
          {(isAdd || isEdit) && canUpload ? (
            <button
              type="button"
              disabled={!canSave || saving}
              title="Ctrl+S"
              onClick={() => void save(null, "save")}
              className={`${BTN_PRIMARY} w-full sm:w-auto sm:min-w-[160px]`}
            >
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

  const handleDrawerSubmit = () => {
    if (readOnly || saving || !canSave) return;
    if (isApprove) void save(true, "approve");
    else void save(null, "save");
  };

  return (
    <Drawer
      isOpen={open}
      onClose={saving ? () => {} : onClose}
      onSubmit={readOnly ? undefined : handleDrawerSubmit}
      title={
        isApprove ? "Approve Invoice" : isEdit ? "Edit Received Invoice" : isAdd ? "Receive Invoice" : "Invoice Receiving"
      }
      description={
        isApprove
          ? "Authorize this received invoice"
          : isEdit
            ? "Update attachments or remarks"
            : isAdd
              ? "Bill and receiving attachments"
              : "Received invoice details"
      }
      maxWidth="max-w-lg"
      headerVariant="form"
      footer={drawerFooter}
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
          <div className="space-y-1">
            <FormLabel>Transport</FormLabel>
            <input readOnly disabled value={bill?.transport || "—"} className={`${DISABLED} uppercase`} />
          </div>
          <div className="space-y-1">
            <FormLabel>Vehicle No</FormLabel>
            <input readOnly disabled value={bill?.vehicleno || "—"} className={`${DISABLED} uppercase`} />
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

        {showDocPreview ? (
          <div className="space-y-2">
            <FormLabel>Document preview</FormLabel>
            <div className="grid grid-cols-2 gap-2">
              {storedPaths.map((p) => (
                <IrQuickPreview key={p} path={p} />
              ))}
              {newFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/50 p-2 h-[88px] flex flex-col justify-center">
                  <FileText size={16} className="text-emerald-600 mx-auto mb-1" />
                  <span className="text-[9px] font-medium text-emerald-800 text-center line-clamp-2">{f.name}</span>
                  <span className="text-[8px] text-emerald-600 text-center mt-0.5">New — save to upload</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <FormLabel required={!readOnly && !isApprove && isAdd}>Attachments</FormLabel>
          {isImsErpNullLiteral(bill?.receivingfile || bill?.file_path) && !storedPaths.length && !newFiles.length ? (
            <input readOnly disabled value="null" className={DISABLED} />
          ) : null}

          {storedPaths.length > 0 ? (
            <ul className="space-y-1">
              {storedPaths.map((p) => {
                const name = receivingFileLabel(p);
                const href = publicUploadHref(p);
                return (
                  <li key={p} className="flex items-center gap-2 min-h-9 px-3 border border-slate-200 rounded-lg bg-white">
                    <FileText size={14} className="shrink-0 text-indigo-600" />
                    {href ? (
                      <FilePreviewLink href={href} fileName={name} className="truncate text-[11px] font-semibold text-indigo-700 flex-1 text-left">
                        {name}
                      </FilePreviewLink>
                    ) : (
                      <span className="truncate text-[11px] flex-1">{name}</span>
                    )}
                    {!fileLocked ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setStoredPaths((prev) => prev.filter((x) => x !== p))}
                        className="text-slate-400 hover:text-rose-600 shrink-0"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {newFiles.length > 0 ? (
            <ul className="space-y-1">
              {newFiles.map((f, idx) => (
                <li key={`${f.name}-${idx}`} className="flex items-center gap-2 h-9 px-3 border border-emerald-200 rounded-lg bg-emerald-50/40">
                  <FileText size={14} className="shrink-0 text-emerald-600" />
                  <span className="truncate text-[11px] font-medium flex-1">{f.name}</span>
                  {!fileLocked ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {!fileLocked ? (
            <label className="flex items-center gap-2 min-h-9 px-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100">
              <Upload size={14} className="text-slate-500 shrink-0" />
              <span className="text-[11px] font-medium text-slate-600">Add file(s)…</span>
              <input
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                disabled={saving}
                onChange={(e) => {
                  const picked = [...(e.target.files || [])];
                  if (picked.length) setNewFiles((prev) => [...prev, ...picked]);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}

          {!fileLocked && totalAttachments === 0 && !isImsErpNullLiteral(bill?.receivingfile) ? (
            <p className="text-[10px] text-slate-400">Add at least one PDF or image.</p>
          ) : null}
        </div>

        <FormTextarea
          label="Remarks"
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e?.target?.value ?? "")}
          placeholder="Optional notes"
          disabled={readOnly}
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
