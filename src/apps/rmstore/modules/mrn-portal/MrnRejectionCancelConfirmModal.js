"use client";

import { useRef } from "react";
import { X, Undo2, AlertTriangle } from "lucide-react";
import { useEscapeKey } from "@/platform/hooks/system/useEscapeKey";
import OverlayModal from "@/ui/primitives/OverlayModal";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";

/** Confirm undo of MRN Portal rejection (before bill / Store Out). */
export default function MrnRejectionCancelConfirmModal({
  open,
  mrnNo,
  mrnUid,
  onClose,
  onConfirm,
  loading = false,
  moduleSlug = "rm_mrn_portal",
}) {
  const sopAckRef = useRef(null);

  useEscapeKey(onClose, open);

  if (!open) return null;

  const label = mrnNo != null && String(mrnNo).trim() !== "" ? `#${mrnNo}` : mrnUid || "this MRN";

  const handleConfirm = () => {
    if (!sopAckRef.current?.assertAcknowledged()) return;
    onConfirm?.();
  };

  return (
    <OverlayModal open={open} zIndex={1100}>
      <div
        role="presentation"
        className="absolute inset-0 bg-slate-900/50 touch-none"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Undo2 size={14} className="text-amber-700" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Cancel rejection</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={String(mrnUid || mrnNo || "cancel-rejection")}
            moduleSlug={moduleSlug}
            permissionType="delete"
            isOpen={open}
            requireAckWhenPresent
          />

          <div className="flex gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-snug">
              The RM Rejection register entry for MRN <span className="font-bold">{label}</span> will be
              permanently deleted from the database and the MRN will return to{" "}
              <span className="font-bold">ERP Pending</span>. Only allowed before a bill is attached or
              Store Out starts.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            Keep rejection
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-60"
          >
            <Undo2 size={14} />
            {loading ? "Cancelling…" : "Cancel rejection"}
          </button>
        </div>
      </div>
    </OverlayModal>
  );
}
