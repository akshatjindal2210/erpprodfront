"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "react-toastify";

import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";
import { inProcessRequestService } from "@/apps/rmstore/lib/services/inProcessRequest";
import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import Drawer from "@/ui/primitives/Drawer";
import { OK_INPUT, FormLabel } from "@/ui/common/Constants";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

function formatExpected(spec) {
  const t = String(spec?.spec_type || "").toLowerCase();
  if (t === "min") return `≥ ${Number(spec?.min_value) || 0}`;
  if (t === "max") return `≤ ${Number(spec?.max_value) || 0}`;
  if (t === "range") return `${Number(spec?.min_value) || 0} – ${Number(spec?.max_value) || 0}`;
  if (t === "dropdown") {
    return (
      String(spec?.correct_option || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" | ") || "—"
    );
  }
  return "—";
}

function ResultPill({ result }) {
  const r = String(result || "").toLowerCase();
  if (r === "pass") {
    return (
      <span className="inline-flex px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
        Pass
      </span>
    );
  }
  if (r === "fail") {
    return (
      <span className="inline-flex px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-rose-50 text-rose-700 border border-rose-100">
        Fail
      </span>
    );
  }
  return <span className="text-[10px] text-slate-400">—</span>;
}

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
 * Pending RM Rejection → review details → Save creates register entry (Store Out after authorize).
 * Supports QC fail rows and approved in-process rejection rows.
 */
export default function GenerateStoreOutDrawer({ open, onClose, onSuccess, row }) {
  const isIpr = row?.pending_source === "in_process" && row?.ipr_uid != null;
  const isQc = row?.pending_source === "qc_check" && row?.qc_check_uid != null;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    if (isIpr) {
      const id = row?.ipr_uid;
      if (!id) return;
      setLoading(true);
      try {
        const res = await inProcessRequestService.getById(id);
        const data = res?.data || null;
        setDetail(data);
        setRemarks(String(data?.remarks || row?.remarks || "").trim());
      } catch (err) {
        toast.error(err?.message || "Could not load the in-process rejection. Please try again.");
        onClose?.();
      } finally {
        setLoading(false);
      }
      return;
    }

    const id = row?.qc_check_uid;
    if (!id) return;
    setLoading(true);
    try {
      const res = await qcCheckService.getById(id);
      const data = res?.data || null;
      setDetail(data);
      setRemarks(String(data?.remarks || row?.remarks || "").trim());
    } catch (err) {
      toast.error(err?.message || "Could not load the QC details. Please try again.");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [isIpr, row?.ipr_uid, row?.qc_check_uid, row?.remarks, onClose]);

  useEffect(() => {
    if (open && (isQc || isIpr)) {
      void load();
    } else if (!open) {
      setDetail(null);
      setRemarks("");
    }
  }, [open, isQc, isIpr, load]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let res;
      if (isIpr) {
        if (!row?.ipr_uid) return;
        res = await rmRejectionService.generateStoreOutFromIpr({
          ipr_uid: row.ipr_uid,
          reason: detail?.reason || row?.reason || row?.failure_reason || undefined,
          remarks: remarks.trim() || undefined,
        });
      } else if (isQc) {
        if (!row?.qc_check_uid) return;
        res = await rmRejectionService.generateStoreOut({
          qc_check_uid: row.qc_check_uid,
          reason: detail?.failure_reason || row?.failure_reason || row?.reason || undefined,
          remarks: remarks.trim() || undefined,
        });
      }
      toast.success(res?.message || "Saved to RM Rejection register.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not generate the store-out entry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const items = Array.isArray(detail?.items) ? detail.items : [];
  const iprCoils = Array.isArray(detail?.coils) ? detail.coils : row?.coils || [];
  const failCount = items.filter((it) => String(it?.result || "").toLowerCase() === "fail").length;

  const footer = (
    <RmStoreDrawerFooter
      onClose={onClose}
      loading={submitting}
      disabled={loading || (!isQc && !isIpr)}
      onSave={handleSubmit}
      saveLabel="Save to Register"
      loadingLabel="Saving…"
    />
  );

  const drawerTitle = isIpr
    ? `Generate Store Out — IPR #${row?.ipr_uid || ""}`
    : `Generate Store Out — QC #${row?.qc_check_uid || ""}`;

  const drawerDescription = isIpr
    ? "Review the in-process rejection, then save to RM Rejection register. Authorize to queue Store Out."
    : "Review why this coil failed QC, then save to RM Rejection register. Authorize to queue Store Out.";

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={!loading && !submitting ? () => void handleSubmit() : undefined}
      title={drawerTitle}
      description={drawerDescription}
      footer={footer}
      maxWidth="max-w-3xl"
      bodyScrollable
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      ) : isIpr ? (
        <div className="space-y-3 pb-2">
          <div className="rounded-xl border border-violet-200 bg-violet-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-violet-100">
              <p className="text-[11px] font-black uppercase tracking-wider text-violet-800">
                In-process rejection
              </p>
              <p className="text-[13px] font-bold text-violet-950 mt-0.5">
                {detail?.rejection_type === "lot" ? "Whole lot" : "Coil-wise"} · {iprCoils.length} coil
                {iprCoils.length === 1 ? "" : "s"}
              </p>
              <p className="text-[12px] font-semibold text-violet-900 mt-1 break-words">
                {detail?.reason || row?.reason || "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <Info label="IPR #" value={detail?.ipr_uid ?? row?.ipr_uid} />
            <Info label="MRN / Lot" value={detail?.lot_no ?? detail?.mrn_no ?? row?.mrn_refs} />
            <Info label="Heat No." value={detail?.heat_no || row?.heat_nos} mono />
            <Info label="Item" value={detail?.item_code || row?.item_codes} />
            <Info
              label="Total Qty"
              value={
                detail?.total_qty != null || row?.total_qty != null
                  ? Number(detail?.total_qty ?? row?.total_qty).toLocaleString()
                  : null
              }
            />
            <Info label="Approved By" value={detail?.approved_by_name || row?.inspected_by_name} />
            <Info
              label="Approved At"
              value={
                detail?.approved_at || row?.inspected_at
                  ? formatDateTime(detail?.approved_at || row?.inspected_at)
                  : null
              }
            />
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
                  {iprCoils.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-[11px] text-slate-400">
                        No coils on this request
                      </td>
                    </tr>
                  ) : (
                    iprCoils.map((c) => (
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
              rows={2}
              disabled={submitting}
              className={`${OK_INPUT} text-[11px] h-auto min-h-[44px] py-1.5 resize-none rounded-md`}
              placeholder="Enter remarks for this rejection (optional)"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {(() => {
            const failedItems = items.filter((it) => String(it?.result || "").toLowerCase() === "fail");
            const nFail = failedItems.length || failCount;
            return (
              <div className="rounded-xl border border-rose-200 bg-rose-50 overflow-hidden">
                <div className="px-3 py-2.5 flex items-center gap-3 border-b border-rose-100">
                  <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex flex-col items-center justify-center shrink-0 shadow-sm">
                    <span className="text-lg font-black leading-none tabular-nums">{nFail || "—"}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wide opacity-90">Fail</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-rose-800">Why rejected</p>
                    <p className="text-[13px] font-bold text-rose-950 mt-0.5">
                      {nFail > 0
                        ? `${nFail} spec${nFail === 1 ? "" : "s"} failed QC`
                        : detail?.failure_reason || row?.failure_reason || row?.reason || "QC failed"}
                    </p>
                  </div>
                </div>
                {failedItems.length > 0 ? (
                  <ul className="divide-y divide-rose-100 bg-white/60">
                    {failedItems.map((it, idx) => (
                      <li key={it.spec_id ?? `fail-${idx}`} className="px-3 py-2 text-[11px] text-slate-800">
                        {it.spec_name || `Spec ${it.spec_id}`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-[12px] font-semibold text-rose-900 break-words">
                    {detail?.failure_reason || row?.failure_reason || row?.reason || "QC failed"}
                  </p>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <Info label="Coil UID" value={detail?.coil_no_uid || row?.coil_no_uid} mono />
            <Info label="MRN" value={detail?.mrn_no ?? row?.mrn_no} />
            <Info label="Heat No." value={detail?.heat_no || row?.heat_no} mono />
            <Info
              label="Qty"
              value={
                detail?.qty != null || row?.qty != null
                  ? Number(detail?.qty ?? row?.qty).toLocaleString()
                  : null
              }
            />
            <Info label="Item" value={detail?.item_code || row?.item_code} />
          </div>

          <div className="space-y-0.5">
            <FormLabel>Remarks</FormLabel>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              disabled={submitting}
              className={`${OK_INPUT} text-[11px] h-auto min-h-[44px] py-1.5 resize-none rounded-md`}
              placeholder="Enter remarks for this rejection (optional)"
            />
          </div>
        </div>
      )}
    </Drawer>
  );
}
