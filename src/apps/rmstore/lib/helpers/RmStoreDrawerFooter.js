"use client";

import { Check, Loader2, Shield } from "lucide-react";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_BTN_KEEP_PENDING, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";

/**
 * IMS-style drawer footer for RM Store modals.
 * Approve flow: Cancel → Keep Pending → Approve (emerald).
 */
export default function RmStoreDrawerFooter({
  onClose,
  loading = false,
  disabled = false,
  readOnly = false,
  cancelOnly = false,
  isApprove = false,
  onSave,
  onKeepPending,
  onApprove,
  saveLabel = "Save",
  approveLabel = "Approve",
  loadingLabel = "Processing",
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

  const handleKeepPending = onKeepPending ?? (() => onSave?.(false));
  const handleApprove = onApprove ?? (() => onSave?.(true));
  const handleSave = () => onSave?.();

  return (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={onClose} disabled={loading} className={IMS_DRAWER_BTN_CANCEL}>
        Cancel
      </button>
      {isApprove ? (
        <>
          <button
            type="button"
            onClick={handleKeepPending}
            disabled={loading || disabled}
            className={IMS_DRAWER_BTN_KEEP_PENDING}
          >
            Keep Pending
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading || disabled}
            className={IMS_DRAWER_BTN_APPROVE}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
            {approveLabel}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || disabled}
          className={IMS_DRAWER_BTN_PRIMARY}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> {loadingLabel}
            </>
          ) : (
            <>
              <Check size={18} /> {saveLabel}
            </>
          )}
        </button>
      )}
    </div>
  );
}
