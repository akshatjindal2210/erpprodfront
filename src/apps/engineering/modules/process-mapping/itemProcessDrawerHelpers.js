"use client";

import { Check, Loader2, Shield, AlertCircle } from "lucide-react";
import {
  IMS_DRAWER_FOOTER_WRAP,
  IMS_DRAWER_BTN_CANCEL,
  IMS_DRAWER_BTN_PRIMARY,
  IMS_DRAWER_BTN_APPROVE,
  IMS_DRAWER_BTN_KEEP_PENDING,
} from "@/apps/ims/lib/helpers/masterListUi";
import { validateStages, buildProcessPayload } from "@/apps/engineering/modules/process-mapping/ProcessStagesBlock";

const TOGGLE =
  "w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600";

const HINT = "p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2 text-[10px] text-slate-500 italic";

export function useItemProcessDrawerMode(mode) {
  const isEdit = mode === "edit";
  const isView = mode === "view";
  const isApprove = mode === "approve";
  const isForm = !isView;
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  return { isEdit, isView, isApprove, isForm, sopPermissionType, itemLocked: isEdit || isApprove };
}

export function ItemProcessEditBanner({ show }) {
  if (!show) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
      <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
      <p className="text-[11px] text-amber-700 font-medium">
        Editing this authorized plan will reset status to <span className="font-bold uppercase">Pending</span>.
      </p>
    </div>
  );
}

export function ItemProcessViewMeta({ row }) {
  if (!row) return null;
  const approved = row.is_approved === true;
  return (
    <div className="flex flex-wrap items-center gap-2 px-0.5">
      <span
        className={`px-2 py-0.5 text-[9px] font-black uppercase border ${approved ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}
      >
        {approved ? "● Approved" : "○ Pending"}
      </span>
      {row.approved_by_name ? (
        <span className="text-[10px] text-slate-500">
          by {row.approved_by_name}
          {row.approved_at ? ` · ${String(row.approved_at).slice(0, 16).replace("T", " ")}` : ""}
        </span>
      ) : null}
    </div>
  );
}

export function ItemProcessApprovalPanel({ showApproval, isApprove, isEdit, canApprove, approved, onApprovedChange }) {
  if (showApproval) {
    return (
      <div className={`p-3 rounded-xl border flex items-center justify-between ${approved ? "bg-emerald-600 border-emerald-700" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
            <Shield size={16} />
          </div>
          <div>
            <p className={`text-xs font-bold ${approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
            <p className={`text-[9px] uppercase font-bold ${approved ? "text-emerald-100" : "text-slate-400"}`}>
              {approved ? "Final & Locked" : "Draft Mode"}
            </p>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer">
          <input type="checkbox" checked={!!approved} onChange={(e) => onApprovedChange(e.target.checked)} className="sr-only peer" />
          <div className={TOGGLE} />
        </label>
      </div>
    );
  }
  const hint =
    isApprove ? "Use Keep Pending to save as draft, or Approve to authorize."
    : isEdit && canApprove ? "Use Save to keep as draft, or Save & Approve to authorize."
    : null;
  if (!hint) return null;
  return (
    <div className={HINT}>
      <AlertCircle size={16} className="text-slate-400 shrink-0 not-italic" />
      {hint}
    </div>
  );
}

function FooterBtn({ loading, active, action, onClick, className, children }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className={className}>
      {loading && active ? <Loader2 size={18} className="animate-spin" /> : children}
    </button>
  );
}

export function ItemProcessDrawerFooter({ isView, isApprove, isEdit, canApprove, loading, activeSubmit, onClose, onSave }) {
  if (isView) {
    return (
      <div className={IMS_DRAWER_FOOTER_WRAP}>
        <button type="button" onClick={onClose} className={IMS_DRAWER_BTN_CANCEL}>Close</button>
      </div>
    );
  }
  return (
    <div className={`${IMS_DRAWER_FOOTER_WRAP} flex-wrap sm:flex-nowrap gap-2 sm:gap-3`}>
      <button type="button" onClick={onClose} disabled={loading} className={IMS_DRAWER_BTN_CANCEL}>Cancel</button>
      {isApprove ? (
        <>
          <FooterBtn loading={loading} active={activeSubmit === "keep_pending"} className={IMS_DRAWER_BTN_KEEP_PENDING} onClick={() => onSave(false, "keep_pending")}>
            {loading && activeSubmit === "keep_pending" ? "Saving..." : "Keep Pending"}
          </FooterBtn>
          <FooterBtn loading={loading} active={activeSubmit === "approve"} className={IMS_DRAWER_BTN_APPROVE} onClick={() => onSave(true, "approve")}>
            <Shield size={18} /> Approve
          </FooterBtn>
        </>
      ) : (
        <>
          {isEdit && canApprove ? (
            <FooterBtn loading={loading} active={activeSubmit === "approve"} className={IMS_DRAWER_BTN_APPROVE} onClick={() => onSave(true, "approve")}>
              <Shield size={18} /> Save &amp; Approve
            </FooterBtn>
          ) : null}
          <FooterBtn loading={loading} active={activeSubmit === "save"} className={IMS_DRAWER_BTN_PRIMARY} onClick={() => onSave(null, "save")}>
            <Check size={18} /> Save
          </FooterBtn>
        </>
      )}
    </div>
  );
}

export async function persistItemProcessPlan({ service, editData, isEdit, isApprove, itemDcode, stages, connectingProcessId, statusOverride, draftApproved, wasAuthorized, canApprove }) {
  const invalid = validateStages(stages) || (connectingProcessId !== undefined && !Number(connectingProcessId) ? "Select a connecting stage." : null);
  if (invalid) {
    const err = new Error(invalid);
    err.isValidation = true;
    throw err;
  }
  let finalApproved = !!draftApproved;
  if (statusOverride !== null) finalApproved = statusOverride;
  else if (isEdit && wasAuthorized) finalApproved = false;

  const process = buildProcessPayload(stages, itemDcode);
  if (connectingProcessId !== undefined) process.connecting_process_id = connectingProcessId || null;
  const body = { item_dcode: itemDcode, process };
  const isUpdate = isEdit || isApprove;
  const res = isUpdate ? await service.update(editData.id, body) : await service.create(body);
  const id = Number(isUpdate ? editData.id : res?.data?.id);
  if (finalApproved && id && canApprove) await service.approve(id, true);
  return res;
}

const TITLES = {
  prime: { noun: "Prime Process", new: "New Prime Process Master" },
  fg: { noun: "Finish Process", new: "New Finish Process Master" },
};

export function itemProcessDrawerTitle(kind, mode) {
  const t = TITLES[kind] || TITLES.prime;
  if (mode === "approve") return `Approve ${t.noun}`;
  if (mode === "view") return `View ${t.noun}`;
  if (mode === "edit") return `Edit ${t.noun}`;
  return t.new;
}
