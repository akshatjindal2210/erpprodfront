"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "react-toastify";

import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";
import { qcRejectionService } from "@/apps/rmstore/lib/services/qcRejection";
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
 * Pending RM Rejection → review QC fail details → Submit creates Store Out (type RM Rejection).
 */
export default function GenerateStoreOutDrawer({ open, onClose, onSuccess, row }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
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
  }, [row?.qc_check_uid, row?.remarks, onClose]);

  useEffect(() => {
    if (open && row?.qc_check_uid) {
      void load();
    } else if (!open) {
      setDetail(null);
      setRemarks("");
    }
  }, [open, row?.qc_check_uid, load]);

  const handleSubmit = async () => {
    if (!row?.qc_check_uid) return;
    setSubmitting(true);
    try {
      const res = await qcRejectionService.generateStoreOut({
        qc_check_uid: row.qc_check_uid,
        reason: detail?.failure_reason || row?.failure_reason || row?.reason || undefined,
        remarks: remarks.trim() || undefined,
      });
      toast.success(res?.message || "Store Out created successfully.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not generate the store-out entry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const items = Array.isArray(detail?.items) ? detail.items : [];
  const failCount = items.filter((it) => String(it?.result || "").toLowerCase() === "fail").length;

  const footer = (
    <div className="flex items-center justify-end gap-3 w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="px-5 py-2.5 text-sm font-bold text-slate-500"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting || loading || !row?.qc_check_uid}
        className="min-w-[160px] px-6 py-2.5 text-sm font-bold text-white rounded-xl bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Saving…
          </>
        ) : (
          <>
            <LogOut size={18} /> Submit Store Out
          </>
        )}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={!loading && !submitting ? () => void handleSubmit() : undefined}
      title={`Generate Store Out — QC #${row?.qc_check_uid || ""}`}
      description="Review why this coil failed QC, then submit to create a Store Out (type RM Rejection)."
      footer={footer}
      maxWidth="max-w-3xl"
      bodyScrollable
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading QC details…
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
                    <p className="text-[11px] font-black uppercase tracking-wider text-rose-800">
                      Why rejected
                    </p>
                    <p className="text-[13px] font-bold text-rose-950 mt-0.5">
                      {nFail > 0
                        ? `${nFail} spec${nFail === 1 ? "" : "s"} failed QC`
                        : detail?.failure_reason || row?.failure_reason || row?.reason || "QC failed"}
                    </p>
                    {items.length > 0 && (
                      <p className="text-[10px] font-semibold text-rose-700/80 mt-0.5">
                        Checked {items.length} spec{items.length === 1 ? "" : "s"} · {items.length - nFail} passed
                      </p>
                    )}
                  </div>
                </div>

                {failedItems.length > 0 ? (
                  <ul className="divide-y divide-rose-100 bg-white/60">
                    {failedItems.map((it, idx) => {
                      const expected = it.expected_display || formatExpected(it);
                      const got =
                        it.actual_value != null && String(it.actual_value).trim() !== ""
                          ? String(it.actual_value)
                          : "—";
                      return (
                        <li
                          key={it.spec_id ?? `fail-${idx}`}
                          className="px-3 py-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1"
                        >
                          <span className="text-[10px] font-black text-rose-500 tabular-nums w-5 shrink-0">
                            {it.sno ?? idx + 1}.
                          </span>
                          <span className="text-[12px] font-bold text-slate-900">
                            {it.spec_name || `Spec ${it.spec_id}`}
                          </span>
                          {it.spec_type ? (
                            <span className="text-[9px] font-bold uppercase text-slate-400">
                              {it.spec_type}
                            </span>
                          ) : null}
                          <span className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                            <span className="text-slate-500">
                              Expected{" "}
                              <span className="font-mono font-bold text-slate-800">{expected}</span>
                            </span>
                            <span className="text-rose-300 font-bold">→</span>
                            <span className="text-rose-700">
                              Got{" "}
                              <span className="font-mono font-black text-rose-900">{got}</span>
                            </span>
                          </span>
                        </li>
                      );
                    })}
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
            <Info label="Inspected By" value={detail?.inspected_by_name || detail?.inspected_by || row?.inspected_by_name} />
            <Info
              label="Inspected At"
              value={
                detail?.inspected_at || row?.inspected_at
                  ? formatDateTime(detail?.inspected_at || row?.inspected_at)
                  : null
              }
            />
            <Info label="Status" value={detail?.status || row?.status || "failed"} />
          </div>

          {(detail?.item_desc || row?.item_desc) && (
            <Info label="Description" value={detail?.item_desc || row?.item_desc} />
          )}

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                All QC checks
              </p>
              <p className="text-[9px] font-bold uppercase text-slate-400">
                {items.length} line{items.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[520px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-white">
                    <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400 w-8">#</th>
                    <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Spec</th>
                    <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Expected</th>
                    <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Actual</th>
                    <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400 w-16">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[11px] text-slate-400">
                        No QC line details found
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr
                        key={it.spec_id ?? idx}
                        className={`border-b border-slate-50 ${
                          String(it.result || "").toLowerCase() === "fail" ? "bg-rose-50/40" : ""
                        }`}
                      >
                        <td className="px-2 py-1.5 text-[10px] font-bold text-slate-400 tabular-nums">
                          {it.sno ?? idx + 1}
                        </td>
                        <td className="px-2 py-1.5 text-[11px] font-bold text-slate-800">
                          {it.spec_name || `Spec ${it.spec_id}`}
                          {it.spec_type ? (
                            <span className="ml-1 text-[9px] font-bold uppercase text-slate-400">
                              {it.spec_type}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 text-[10px] font-mono text-slate-600">
                          {it.expected_display || formatExpected(it)}
                        </td>
                        <td className="px-2 py-1.5 text-[11px] font-mono font-bold text-slate-800">
                          {it.actual_value != null && String(it.actual_value).trim() !== ""
                            ? String(it.actual_value)
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          <ResultPill result={it.result} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-0.5">
            <FormLabel>Store Out Remarks</FormLabel>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              disabled={submitting}
              className={`${OK_INPUT} text-[11px] h-auto min-h-[44px] py-1.5 resize-none rounded-md`}
              placeholder="Enter remarks for this Store Out (optional)"
            />
          </div>
        </div>
      )}
    </Drawer>
  );
}
