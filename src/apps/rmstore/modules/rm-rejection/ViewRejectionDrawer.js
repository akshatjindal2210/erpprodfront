"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText } from "lucide-react";
import { toast } from "react-toastify";

import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import Drawer from "@/ui/primitives/Drawer";
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

function stageLabel(row) {
  if (String(row?.bill_no || "").trim()) return "Complete";
  if (row?.store_out_approved === true || row?.store_out_approved === "t") return "Awaiting Bill";
  if (row?.approved === true || row?.approved === "t") {
    return row?.store_out_started === true || row?.store_out_started === "t"
      ? "Store Out In Progress"
      : "Store Out Pending";
  }
  return "Pending Authorization";
}

function rejectionSourceLabel(row) {
  if (row?.ipr_uid != null) return `In-Process · IPR-${row.ipr_uid}`;
  if (row?.qc_check_uid != null) return `QC Fail · QC-${row.qc_check_uid}`;
  if (row?.qc_reject_uid != null) return `Register · REJECT-${row.qc_reject_uid}`;
  if (row?.rejection_origin_label) return row.rejection_origin_label;
  return "-";
}

/**
 * Register entry — read-only view of rejection details.
 */
export default function ViewRejectionDrawer({ open, onClose, row }) {
  const rejectId = row?.qc_reject_uid;
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    if (!rejectId) return;
    setLoading(true);
    try {
      const res = await rmRejectionService.getById(rejectId);
      setDetail(res?.data || null);
    } catch (err) {
      toast.error(err?.message || "Could not load the rejection register. Please try again.");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [rejectId, onClose]);

  useEffect(() => {
    if (open && rejectId) {
      void load();
    } else if (!open) {
      setDetail(null);
    }
  }, [open, rejectId, load]);

  const data = detail || row;
  const coils = Array.isArray(detail?.coils) ? detail.coils : row?.coils || [];

  const footer = <RmStoreDrawerFooter onClose={onClose} readOnly />;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={`View Rejection — REJECT-${rejectId || ""}`}
      description="Register entry details (read-only)."
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 flex items-start gap-2">
              <FileText size={18} className="text-slate-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-600">Failure reason</p>
                <p className="text-[13px] font-bold text-slate-900 mt-0.5 break-words">
                  {data?.reason || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <Info label="Reject #" value={rejectId != null ? `REJECT-${rejectId}` : null} />
            <Info label="Source" value={rejectionSourceLabel(data)} />
            <Info label="Stage" value={stageLabel(data)} />
            <Info label="MRN Refs" value={data?.mrn_refs} />
            <Info label="Heat Nos." value={data?.heat_nos} mono />
            <Info label="Item Codes" value={data?.item_codes} />
            <Info
              label="Total Qty"
              value={data?.total_qty != null ? Number(data.total_qty).toLocaleString() : null}
            />
            <Info label="Coils" value={data?.coil_count ?? coils.length} />
            <Info label="Store Out" value={data?.out_uid != null ? `OUT-${data.out_uid}` : "—"} />
            <Info label="Bill Number" value={data?.bill_no || "—"} />
            <Info label="Registered By" value={data?.created_by_name} />
            <Info label="Registered At" value={data?.created_at ? formatDateTime(data.created_at) : null} />
            <Info label="Authorized By" value={data?.approved_by_name || "—"} />
            <Info
              label="Authorized At"
              value={data?.approved_at ? formatDateTime(data.approved_at) : "—"}
            />
            {data?.ipr_uid != null ? <Info label="IPR #" value={data.ipr_uid} /> : null}
          </div>

          {data?.remarks ? (
            <div className="border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Remarks</p>
              <p className="text-[11px] text-slate-700 mt-1 whitespace-pre-wrap break-words">{data.remarks}</p>
            </div>
          ) : null}

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
                      <td colSpan={4} className="px-3 py-4 text-[11px] text-slate-500">
                        No coils linked.
                      </td>
                    </tr>
                  ) : (
                    coils.map((c) => (
                      <tr key={c.coil_no_uid} className="border-b border-slate-50">
                        <td className="px-2 py-1.5 text-[10px] font-mono font-bold text-slate-800">
                          {c.coil_no_uid}
                          {c.ipr_uid != null ? (
                            <span className="block text-[8px] font-bold uppercase text-violet-600">
                              IPR-{c.ipr_uid}
                            </span>
                          ) : c.qc_check_uid != null ? (
                            <span className="block text-[8px] font-bold uppercase text-sky-600">
                              QC-{c.qc_check_uid}
                            </span>
                          ) : null}
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
        </div>
      )}
    </Drawer>
  );
}
