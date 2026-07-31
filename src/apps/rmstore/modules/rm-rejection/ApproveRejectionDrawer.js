"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "react-toastify";

import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import Drawer from "@/ui/primitives/Drawer";
import { OK_INPUT, FormLabel } from "@/ui/common/Constants";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

function Info({ label, value, mono }) {
  return (
    <div className="bg-slate-50 border border-slate-200 px-2 py-1.5 min-w-0">
      <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-none">{label}</div>
      <div className={`text-[11px] font-bold text-slate-800 truncate mt-0.5 ${mono ? "font-mono" : ""}`}>
        {value != null && String(value).trim() !== "" ? String(value) : "—"}
      </div>
    </div>
  );
}

/**
 * Pending Authorization row → review / update remarks → Approve queues Store Out.
 */
export default function ApproveRejectionDrawer({ open, onClose, onSuccess, row }) {
  const rejectId = row?.qc_reject_uid;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    if (!rejectId) return;
    setLoading(true);
    try {
      const res = await rmRejectionService.getById(rejectId);
      const data = res?.data || null;
      setDetail(data);
      setRemarks(String(data?.remarks || row?.remarks || "").trim());
    } catch (err) {
      toast.error(err?.message || "Could not load the rejection register. Please try again.");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [rejectId, row?.remarks, onClose]);

  useEffect(() => {
    if (open && rejectId) {
      void load();
    } else if (!open) {
      setDetail(null);
      setRemarks("");
    }
  }, [open, rejectId, load]);

  const handleSubmit = async () => {
    if (!rejectId) return;
    setSubmitting(true);
    try {
      const res = await rmRejectionService.approveRegister({
        qc_reject_uid: rejectId,
        remarks: remarks.trim() || null,
      });
      toast.success(res?.message || "Rejection authorized. Store Out → Pending mein dikhega.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not authorize the rejection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const coils = Array.isArray(detail?.coils) ? detail.coils : row?.coils || [];
  const coilUids = coils.map((c) => String(c?.coil_no_uid || "").trim()).filter(Boolean);
  const coilLabel =
    coilUids.length === 1
      ? coilUids[0]
      : coilUids.length > 1
        ? coilUids.join(", ")
        : row?.coil_no_uid || "—";

  const footer = (
    <RmStoreDrawerFooter
      onClose={onClose}
      loading={submitting}
      disabled={loading || !rejectId}
      onSave={handleSubmit}
      saveLabel="Approve"
      loadingLabel="Approving…"
    />
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={!loading && !submitting ? () => void handleSubmit() : undefined}
      title={`Approve Rejection — REJECT-${rejectId || ""}`}
      description="Review rejection details, update remarks if needed, then approve to queue Store Out."
      footer={footer}
      maxWidth="max-w-3xl"
      bodyScrollable
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-amber-100 flex items-start gap-2">
              <CheckCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                  Pending authorization
                </p>
                <p className="text-[13px] font-bold text-amber-950 mt-0.5 break-words">
                  {detail?.reason || row?.reason || row?.failure_reason || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <Info label="Reject #" value={rejectId != null ? `REJECT-${rejectId}` : null} />
            <Info
              label="Source"
              value={
                detail?.rejection_origin_label ||
                (detail?.ipr_uid != null
                  ? `In-Process · IPR-${detail.ipr_uid}`
                  : detail?.qc_check_uid != null
                    ? `QC Fail · QC-${detail.qc_check_uid}`
                    : row?.ipr_uid != null
                      ? `In-Process · IPR-${row.ipr_uid}`
                      : "—")
              }
            />
            <Info label="MRN Refs" value={detail?.mrn_refs ?? row?.mrn_refs} />
            <Info label="Heat Nos." value={detail?.heat_nos ?? row?.heat_nos} mono />
            <Info label="Item Codes" value={detail?.item_codes ?? row?.item_codes} />
            <Info
              label="Total Qty"
              value={
                detail?.total_qty != null || row?.total_qty != null
                  ? Number(detail?.total_qty ?? row?.total_qty).toLocaleString()
                  : null
              }
            />
            <Info label="Coils" value={detail?.coil_count ?? row?.coil_count ?? coils.length} />
            <Info label="Registered By" value={detail?.created_by_name || row?.created_by_name} />
            <Info
              label="Registered At"
              value={
                detail?.created_at || row?.created_at
                  ? formatDateTime(detail?.created_at || row?.created_at)
                  : null
              }
            />
            {row?.ipr_uid != null || detail?.ipr_uid != null ? (
              <Info label="IPR #" value={detail?.ipr_uid ?? row?.ipr_uid} />
            ) : null}
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Rejected coils</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[480px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-white">
                    <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Coil UID</th>
                    <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Heat</th>
                    <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Item</th>
                    <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400 w-20">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {coils.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-[11px] font-mono text-slate-700">
                        {coilLabel}
                      </td>
                    </tr>
                  ) : (
                    coils.map((c) => (
                      <tr key={c.coil_no_uid} className="border-b border-slate-50">
                        <td className="px-2 py-1.5 text-[10px] font-mono font-bold text-slate-800">
                          {c.coil_no_uid}
                        </td>
                        <td className="px-2 py-1.5 text-[10px] font-mono text-amber-700">{c.heat_no || "—"}</td>
                        <td className="px-2 py-1.5 text-[10px] uppercase text-slate-700">{c.item_code || "—"}</td>
                        <td className="px-2 py-1.5 text-[11px] font-black text-emerald-600 tabular-nums">
                          {Number(c.qty || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-0.5">
            <FormLabel>Remarks</FormLabel>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              disabled={submitting}
              className={`${OK_INPUT} text-[11px] h-auto min-h-[52px] py-1.5 resize-none rounded-md`}
              placeholder="Update remarks before approving (optional)"
            />
          </div>
        </div>
      )}
    </Drawer>
  );
}
