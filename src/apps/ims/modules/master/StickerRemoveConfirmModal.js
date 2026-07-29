"use client";

import { useRef, useState } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useEscapeKey } from "@/platform/hooks/system/useEscapeKey";

export default function StickerRemoveConfirmModal({ open, docNo, onClose, onConfirm, loading = false }) {
  const sopAckRef = useRef(null);
  const [sopGateReady, setSopGateReady] = useState(false);

  useEscapeKey(onClose, open);

  if (!open || !docNo) return null;

  const handleConfirm = () => {
    if (!sopAckRef.current?.assertAcknowledged()) return;
    onConfirm?.();
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4" data-app-drawer-root>
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
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center">
              <Trash2 size={14} className="text-rose-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Cancel stickers</h3>
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
            key={String(docNo)}
            moduleSlug="packing_entry"
            permissionType="delete"
            isOpen={open}
            requireAckWhenPresent
            onGateReadyChange={setSopGateReady}
          />

          <div className="flex gap-2.5 p-3 bg-rose-50 border border-rose-100 rounded-xl">
            <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700 leading-snug">
              Production stickers for packing <span className="font-bold">#{docNo}</span> will be
              deleted permanently. Stock adjustment boxes are not removed.
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
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !sopGateReady}
            title={!sopGateReady ? "Read and confirm the SOP above first" : undefined}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-60"
          >
            <Trash2 size={14} />
            {loading ? "Removing…" : "Remove stickers"}
          </button>
        </div>
      </div>
    </div>
  );
}

