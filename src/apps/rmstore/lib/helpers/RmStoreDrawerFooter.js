"use client";

import { Check, Loader2, Shield } from "lucide-react";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_BTN_KEEP_PENDING, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";

export function isRowApproved(row) {
  if (!row) return false;
  if (row.approval_status === "authorized") return true;
  const v = row.approved;
  return v === true || v === "true" || v === 1 || v === "1";
}

export function resolveFinalApproved({ formApproved, statusOverride, isEdit, wasApproved }) {
  if (statusOverride != null) return statusOverride;
  if (isEdit && wasApproved) return false;
  return Boolean(formApproved);
}

export default function RmStoreDrawerFooter({
  onClose,
  loading = false,
  disabled = false,
  readOnly = false,
  cancelOnly = false,
  isApprove = false,
  isEdit = false,
  canApprove = false,
  activeSubmit = null,
  onSave,
  saveLabel = "Save",
  approveLabel = "Approve",
  saveAndApproveLabel = "Save & Approve",
  loadingLabel = "Saving...",
}) {
  if (readOnly) {
    return (
      <div className={IMS_DRAWER_FOOTER_WRAP}>
        <button type="button" onClick={onClose} className={IMS_DRAWER_BTN_CLOSE}>
          Close
        </button>
      </div>
    );
  }

  if (cancelOnly) {
    return (
      <div className={IMS_DRAWER_FOOTER_WRAP}>
        <button type="button" onClick={onClose} className={IMS_DRAWER_BTN_CANCEL}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={onClose} disabled={loading} className={IMS_DRAWER_BTN_CANCEL}>
        Cancel
      </button>

      {isApprove ? (
        <>
          <button
            type="button"
            onClick={() => onSave?.(false, "keep_pending")}
            disabled={loading || disabled}
            className={IMS_DRAWER_BTN_KEEP_PENDING}
          >
            {loading && activeSubmit === "keep_pending" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> {loadingLabel}
              </span>
            ) : (
              "Keep Pending"
            )}
          </button>
          <button
            type="button"
            onClick={() => onSave?.(true, "approve")}
            disabled={loading || disabled}
            title="Ctrl+S"
            className={IMS_DRAWER_BTN_APPROVE}
          >
            {loading && activeSubmit === "approve" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Shield size={18} />
            )}
            {approveLabel}
          </button>
        </>
      ) : (
        <>
          {isEdit && canApprove ? (
            <button
              type="button"
              onClick={() => onSave?.(true, "approve")}
              disabled={loading || disabled}
              className={IMS_DRAWER_BTN_APPROVE}
            >
              {loading && activeSubmit === "approve" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Shield size={18} />
              )}
              {saveAndApproveLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onSave?.(null, "save")}
            disabled={loading || disabled}
            title="Ctrl+S"
            className={IMS_DRAWER_BTN_PRIMARY}
          >
            {loading && activeSubmit === "save" ? (
              <>
                <Loader2 size={18} className="animate-spin" /> {loadingLabel}
              </>
            ) : (
              <>
                <Check size={18} /> {saveLabel}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
