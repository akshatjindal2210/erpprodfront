"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, MapPin, Package, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { auditService } from "@/features/apps/ims/services/audit";
import { getAuditExecutionStatusLabel } from "./auditStatusHelpers";

function BoxList({ boxes, tone = "slate", maxHeight = "max-h-28" }) {
  if (!boxes?.length) {
    return <span className="text-[10px] text-slate-400 italic">No boxes</span>;
  }

  const toneClasses = {
    slate: "bg-slate-50 text-slate-600 border-slate-200",
    emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
    rose: "bg-rose-100 text-rose-800 border-rose-300",
    amber: "bg-amber-100 text-amber-800 border-amber-300",
  };

  return (
    <div className={`flex flex-wrap gap-1 ${maxHeight} overflow-y-auto`}>
      {boxes.map((uid) => (
        <span
          key={uid}
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${toneClasses[tone] || toneClasses.slate}`}
        >
          {uid}
        </span>
      ))}
    </div>
  );
}

function SystemBoxList({ systemBoxes = [], matchedScannedBoxes = [] }) {
  if (!systemBoxes?.length) {
    return <span className="text-[10px] text-slate-400 italic">No boxes</span>;
  }

  const matchedSet = new Set(matchedScannedBoxes || []);

  return (
    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
      {systemBoxes.map((uid) => (
        <span
          key={uid}
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
            matchedSet.has(uid)
              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
              : "bg-amber-100 text-amber-800 border-amber-300"
          }`}
        >
          {uid}
        </span>
      ))}
    </div>
  );
}

function ScannedBoxList({ scannedBoxes = [], matchedScannedBoxes = [], allMatched = false }) {
  if (!scannedBoxes?.length) {
    return <span className="text-[10px] text-slate-400 italic">No boxes</span>;
  }

  const matchedSet = new Set(matchedScannedBoxes || []);

  return (
    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
      {scannedBoxes.map((uid) => {
        const isMatch = allMatched || matchedSet.has(uid);
        return (
          <span
            key={uid}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
              isMatch
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : "bg-rose-100 text-rose-800 border-rose-300"
            }`}
          >
            {uid}
          </span>
        );
      })}
    </div>
  );
}

function MismatchSummary({ row }) {
  const parts = [];
  if (row.mismatch_incomplete) {
    parts.push(`${row.missing_boxes?.length || 0} not scanned`);
  }
  if (row.mismatch_extra_scans) {
    parts.push(`${row.extra_boxes?.length || 0} wrong/extra scan(s)`);
  }
  if (!parts.length) return null;

  return (
    <p className="text-[9px] text-slate-500 mt-0.5">
      {parts.join(" · ")}
    </p>
  );
}

export default function AuditComparisonModal({ open, onClose, auditId, auditLabel }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!open || !auditId) return;

    let cancelled = false;
    setLoading(true);
    setReport(null);

    auditService
      .getComparisonReport(auditId)
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setReport(res.data ?? null);
        } else {
          toast.error(res?.message || "Failed to load comparison report");
        }
      })
      .catch((err) => {
        if (!cancelled) toast.error(err?.message || "Failed to load comparison report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, auditId]);

  const summary = report?.summary;
  const allMatched = summary?.mismatched_locations === 0;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Audit Comparison Report"
      description={auditLabel || (auditId ? `Audit #${auditId}` : "")}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex justify-end w-full">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
          >
            Close
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="animate-spin" size={28} />
          <span className="text-xs font-bold uppercase tracking-wider">Loading comparison...</span>
        </div>
      ) : !report ? (
        <div className="py-12 text-center text-sm text-slate-500">No comparison data available.</div>
      ) : (
        <div className="space-y-4 pb-4">
          <div className={`p-3 rounded-xl border flex items-start gap-3 ${allMatched ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
            {allMatched ? (
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-xs font-bold ${allMatched ? "text-emerald-800" : "text-amber-800"}`}>
                {allMatched
                  ? "All locations match — system inventory and audit scans are identical."
                  : `${summary?.mismatched_locations || 0} location(s) have mismatches.`}
              </p>
              <p className="text-[10px] text-slate-600 mt-1">
                Audit Status: {getAuditExecutionStatusLabel(report.status)} | Matched: {summary?.matched_locations || 0} / {summary?.total_locations || 0}
              </p>
              {!allMatched && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Green = matched · Amber = in system, not scanned · Red = scanned, not at this location
                </p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Location</th>
                  <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">
                    <span className="inline-flex items-center gap-1"><Package size={12} /> System Boxes</span>
                  </th>
                  <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">
                    <span className="inline-flex items-center gap-1"><Package size={12} /> Audit Scanned</span>
                  </th>
                  <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500 w-24">Result</th>
                </tr>
              </thead>
              <tbody>
                {(report.locations || []).map((row) => (
                  <tr
                    key={row.location_id}
                    className={`border-b border-slate-100 align-top ${
                      row.matched ? "bg-emerald-50/60" : "bg-rose-50/70"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className={row.matched ? "text-emerald-600" : "text-rose-600"} />
                        <div>
                          <p className="text-[11px] font-black uppercase text-slate-800">{row.location_no}</p>
                          <p className="text-[9px] text-slate-500 uppercase">{row.location_status}</p>
                          {!row.matched && <MismatchSummary row={row} />}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-black text-slate-800 mb-1.5">{row.system_count}</p>
                      <SystemBoxList
                        systemBoxes={row.system_boxes}
                        matchedScannedBoxes={row.matched_scanned_boxes}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-black text-slate-800 mb-1.5">
                        {row.scanned_count}
                        {!row.matched && row.system_count > 0 && (
                          <span className="text-[10px] font-bold text-slate-500 ml-1">
                            / {row.system_count}
                          </span>
                        )}
                      </p>
                      <ScannedBoxList
                        scannedBoxes={row.scanned_boxes}
                        matchedScannedBoxes={row.matched_scanned_boxes}
                        allMatched={row.matched}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {row.matched ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} /> Match
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200">
                          <XCircle size={12} /> Mismatch
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(report.locations || []).some((row) => !row.matched) && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Mismatch Details</p>
              {(report.locations || [])
                .filter((row) => !row.matched)
                .map((row) => (
                  <div key={`detail-${row.location_id}`} className="p-3 rounded-xl border border-rose-200 bg-white space-y-3">
                    <div>
                      <p className="text-[11px] font-bold text-rose-800 uppercase">{row.location_no}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Scanned {row.scanned_count} of {row.system_count} system boxes
                      </p>
                    </div>

                    {row.matched_scanned_boxes?.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase text-emerald-700 mb-1 flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          Correctly scanned — in system at this location ({row.matched_scanned_boxes.length})
                        </p>
                        <BoxList boxes={row.matched_scanned_boxes} tone="emerald" maxHeight="max-h-24" />
                      </div>
                    )}

                    {row.missing_boxes?.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase text-amber-700 mb-1 flex items-center gap-1">
                          <AlertTriangle size={11} />
                          In system but not scanned ({row.missing_boxes.length})
                        </p>
                        <BoxList boxes={row.missing_boxes} tone="amber" maxHeight="max-h-40" />
                      </div>
                    )}

                    {row.extra_boxes?.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase text-rose-700 mb-1 flex items-center gap-1">
                          <XCircle size={11} />
                          Scanned but not in system at this location ({row.extra_boxes.length})
                        </p>
                        <BoxList boxes={row.extra_boxes} tone="rose" maxHeight="max-h-24" />
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
