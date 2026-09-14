"use client";

import { useState, useRef } from "react";
import { Loader2, Shield } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { trayService } from "@/apps/ims/lib/services/tray";
import { isTrayApproved } from "@/apps/ims/lib/helpers/trayHelper";

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">{label}</span>
      <span className="text-[11px] font-bold text-slate-800 text-right break-all">{value ?? "—"}</span>
    </div>
  );
}

export default function TrayAuthorizeModal({ open, onClose, onSuccess, data, stackLevel = 0 }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess("tray_master", "authorize").allowed;
  const sopAckRef = useRef(null);
  const [loading, setLoading] = useState(false);

  if (!data) return null;

  const runApprove = async () => {
    if (isTrayApproved(data)) {
      toast.info("This tray is already authorized.");
      onClose?.();
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setLoading(true);
    try {
      const res = await trayService.update(data.id, { approved: true });
      toast.success(res?.message || "Tray authorized successfully");
      onSuccess?.(res?.data);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const drawerFooter = (
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
      >
        Keep Pending
      </button>
      <button
        type="button"
        onClick={() => void runApprove()}
        disabled={loading || !canApprove}
        className="w-full sm:w-auto sm:min-w-[140px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
        Approve
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Approve Tray"
      description="Tray authorization"
      footer={drawerFooter}
      maxWidth="max-w-lg"
      stackLevel={stackLevel}
    >
      <div className="space-y-4 pb-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <SummaryRow label="Code" value={data.code} />
          <SummaryRow label="Type" value={data.type} />
          <SummaryRow label="S.No." value={data.serial_number} />
          <SummaryRow label="Batch" value={data.batch_id} />
          <SummaryRow label="Status" value={isTrayApproved(data) ? "AUTHORIZED" : "PENDING"} />
        </div>

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`approve-${data.id}-${String(open)}`}
          moduleSlug="tray_master"
          permissionType="authorize"
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}
