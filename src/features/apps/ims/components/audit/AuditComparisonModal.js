"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  PackageX,
  PackagePlus,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { auditService } from "@/features/apps/ims/services/audit";
import { getAuditExecutionStatusLabel } from "./auditStatusHelpers";
import { buildLocationComparisonReport, getLocationStatusLabel, isLocationSubmittedRow } from "./auditScanHelpers";

function DifferenceTypeBadge({ type }) {
  const isExtra = type === "extra_scan";
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
        isExtra
          ? "bg-rose-100 text-rose-700 border-rose-200"
          : "bg-amber-100 text-amber-800 border-amber-200"
      }`}
    >
      {isExtra ? "Extra scan" : "Not scanned"}
    </span>
  );
}

function DifferenceDetailTable({ rows, showLocation = false, emptyMessage = "None" }) {
  if (!rows?.length) {
    return (
      <div className="py-5 text-center text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[320px] overflow-y-auto">
      <table className="w-full min-w-[900px] text-left border-collapse">
        <thead className="sticky top-0 z-[1] bg-slate-50 border-b border-slate-200">
          <tr>
            {showLocation && (
              <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Audit location</th>
            )}
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Type</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Packing no.</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Box UID</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Customer</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Item</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500 w-16">Qty</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Box location</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`${row.box_no_uid}-${row.difference_type}-${idx}`}
              className={`border-b border-slate-100 ${
                row.difference_type === "extra_scan" ? "bg-rose-50/50" : "bg-amber-50/40"
              }`}
            >
              {showLocation && (
                <td className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase">
                  {row.audit_location_no || row.location_no || "—"}
                </td>
              )}
              <td className="px-3 py-2">
                <DifferenceTypeBadge type={row.difference_type} />
              </td>
              <td className="px-3 py-2 text-[10px] font-medium text-slate-700">{row.packing_number ?? "—"}</td>
              <td className="px-3 py-2 text-[10px] font-mono font-bold text-slate-800">{row.box_no_uid}</td>
              <td className="px-3 py-2 text-[10px] text-slate-700">{row.customer ?? "—"}</td>
              <td className="px-3 py-2 text-[10px] text-slate-700">{row.item ?? "—"}</td>
              <td className="px-3 py-2 text-[10px] font-bold text-slate-800">{row.qty ?? "—"}</td>
              <td className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase">{row.location_no ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchedBoxesCollapse({ locations, singleLocation, totalMatched }) {
  const hasMatched = locations.some(
    (row) => (row.matched_scanned_boxes?.length ?? 0) > 0 || (row.matched_rows?.length ?? 0) > 0
  );
  if (!hasMatched) return null;

  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="px-3 py-2 text-[10px] font-black uppercase text-slate-500 cursor-pointer select-none">
        Matched boxes ({totalMatched})
      </summary>
      <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
        {locations.map((row) => {
          const uids =
            row.matched_scanned_boxes?.length > 0
              ? row.matched_scanned_boxes
              : (row.matched_rows || []).map((r) => r.box_no_uid);
          if (!uids?.length) return null;
          return (
            <div key={`matched-${row.location_id}`}>
              {!singleLocation && (
                <p className="text-[9px] font-bold uppercase text-emerald-700 mb-1">{row.location_no}</p>
              )}
              <p className="text-[10px] text-slate-600 leading-relaxed break-words">
                {row.matched_scanned_count ?? uids.length} matched — {uids.join(", ")}
              </p>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function StatCard({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
  };
  return (
    <div className={`rounded-lg border px-2 py-2 text-center min-w-0 ${tones[tone] || tones.slate}`}>
      <p className="text-[8px] font-black uppercase tracking-wide text-slate-500 truncate">{label}</p>
      <p className="text-lg font-black leading-tight tabular-nums">{value}</p>
    </div>
  );
}

function DifferenceSection({
  title,
  count,
  icon: Icon,
  tone,
  rows,
  showLocation,
  emptyMessage,
  adjustmentType,
  auditId,
  locationId,
}) {
  const [logging, setLogging] = useState(false);

  const handleAdjustment = async () => {
    if (!auditId || !adjustmentType) return;
    if (!rows?.length) {
      toast.info(`No ${title.toLowerCase()} boxes to adjust`);
      return;
    }
    setLogging(true);
    try {
      const res = await auditService.logComparisonAdjustment({
        audit_id: auditId,
        location_id: locationId,
        adjustment_type: adjustmentType,
        box_no_uids: rows.map((r) => r.box_no_uid),
      });
      if (!res?.success) throw new Error(res?.message || "Failed to log adjustment");
      toast.success(`${title}: adjustment logged (${rows.length} box${rows.length === 1 ? "" : "es"})`);
    } catch (err) {
      toast.error(err?.message || "Could not log adjustment");
    } finally {
      setLogging(false);
    }
  };

  const headerTone = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
  };

  return (
    <section className="rounded-xl border border-slate-200 overflow-hidden">
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${headerTone[tone] || headerTone.amber}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} className="shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wide truncate">
            {title} ({count})
          </span>
        </div>
        {adjustmentType ? (
          <button
            type="button"
            onClick={handleAdjustment}
            disabled={logging || !count}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded"
            title="Log adjustment intent (stock logic will be added later)"
          >
            <SlidersHorizontal size={11} />
            {logging ? "…" : "Adjustment"}
          </button>
        ) : null}
      </div>
      <div className="p-2 bg-white">
        <DifferenceDetailTable rows={rows} showLocation={showLocation} emptyMessage={emptyMessage} />
      </div>
    </section>
  );
}

export default function AuditComparisonModal({ open, onClose, auditId, auditLabel, locationRow = null }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const singleLocation = Boolean(locationRow);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadLocalReport = () => {
      if (!locationRow || !isLocationSubmittedRow(locationRow)) return null;
      return buildLocationComparisonReport(locationRow);
    };

    const loadFromApi = async () => {
      const id = locationRow?.audit_id ?? auditId;
      if (!id) return null;
      const locationId = locationRow?.location_id ?? null;
      const res = await auditService.getComparisonReport(id, locationId);
      if (!res?.success) {
        throw new Error(res?.message || "Failed to load comparison report");
      }
      return res.data ?? null;
    };

    setLoading(true);
    setReport(null);

    (async () => {
      try {
        let data = loadLocalReport();
        try {
          const apiData = await loadFromApi();
          if (apiData) data = apiData;
        } catch (apiErr) {
          if (!data) throw apiErr;
        }
        if (cancelled) return;
        if (!data) {
          toast.error("No comparison data available");
          return;
        }
        setReport(data);
      } catch (err) {
        if (!cancelled) toast.error(err?.message || "Failed to load comparison report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, auditId, locationRow]);

  const summary = report?.summary;
  const locations = report?.locations || [];
  const showLocationCol = !singleLocation && locations.length > 1;

  const notScannedRows = useMemo(() => {
    if (report?.not_scanned_rows?.length) return report.not_scanned_rows;
    return locations.flatMap((loc) =>
      (loc.not_scanned_rows || loc.difference_rows?.filter((r) => r.difference_type === "not_scanned") || []).map(
        (row) => ({ ...row, audit_location_no: loc.location_no })
      )
    );
  }, [report, locations]);

  const extraRows = useMemo(() => {
    if (report?.extra_scan_rows?.length) return report.extra_scan_rows;
    return locations.flatMap((loc) =>
      (loc.extra_scan_rows || loc.difference_rows?.filter((r) => r.difference_type === "extra_scan") || []).map(
        (row) => ({ ...row, audit_location_no: loc.location_no })
      )
    );
  }, [report, locations]);

  const resolvedAuditId = locationRow?.audit_id ?? auditId ?? report?.audit_id;
  const resolvedLocationId = singleLocation ? locationRow?.location_id ?? locations[0]?.location_id : null;

  const mismatchedCount =
    summary?.mismatched_locations ?? locations.filter((l) => !l.matched).length;
  const allMatched = notScannedRows.length === 0 && extraRows.length === 0 && mismatchedCount === 0;

  const stats = {
    expected: summary?.total_expected ?? locations.reduce((n, l) => n + (l.system_count || 0), 0),
    scanned: summary?.total_scanned ?? locations.reduce((n, l) => n + (l.scanned_count || 0), 0),
    matched: summary?.total_matched ?? locations.reduce((n, l) => n + (l.matched_scanned_count || 0), 0),
    notScanned: summary?.total_not_scanned ?? notScannedRows.length,
    extra: summary?.total_extra_scans ?? extraRows.length,
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={singleLocation ? `Location comparison — ${locationRow?.location_no}` : "Audit comparison report"}
      description={auditLabel || (resolvedAuditId ? `Audit #${resolvedAuditId}` : "")}
      maxWidth="max-w-6xl"
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
          <span className="text-xs font-bold uppercase tracking-wider">Loading comparison…</span>
        </div>
      ) : !report ? (
        <div className="py-12 text-center text-sm text-slate-500">No comparison data available.</div>
      ) : (
        <div className="space-y-3 pb-4">
          <div
            className={`p-3 rounded-xl border flex items-start gap-3 ${
              allMatched ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
            }`}
          >
            {allMatched ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className={`text-xs font-bold ${allMatched ? "text-emerald-800" : "text-amber-800"}`}>
                {allMatched
                  ? "All boxes match — expected inventory and audit scans align."
                  : `Differences found — ${stats.notScanned} not scanned, ${stats.extra} extra scan${stats.extra === 1 ? "" : "s"}.`}
              </p>
              {!singleLocation && (
                <p className="text-[10px] text-slate-600 mt-1">
                  Status: {getAuditExecutionStatusLabel(report.status)} · Locations matched{" "}
                  {summary?.matched_locations || 0}/{summary?.total_locations || locations.length}
                </p>
              )}
              {singleLocation && locationRow && (
                <p className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                  <MapPin size={10} />
                  {locationRow.location_no} · {getLocationStatusLabel(locationRow.location_status)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <StatCard label="Expected" value={stats.expected} />
            <StatCard label="Scanned" value={stats.scanned} tone="indigo" />
            <StatCard label="Matched" value={stats.matched} tone="emerald" />
            <StatCard label="Not scanned" value={stats.notScanned} tone="amber" />
            <StatCard label="Extra scan" value={stats.extra} tone="rose" />
          </div>

          {!singleLocation && locations.length > 1 && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full min-w-[520px] text-left text-[10px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Location</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Expected</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Scanned</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Matched</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Not scanned</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Extra</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.location_id} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 font-bold text-slate-800">{loc.location_no}</td>
                      <td className="px-2 py-1.5">{loc.system_count}</td>
                      <td className="px-2 py-1.5">{loc.scanned_count}</td>
                      <td className="px-2 py-1.5 text-emerald-700 font-bold">{loc.matched_scanned_count ?? 0}</td>
                      <td className="px-2 py-1.5 text-amber-700 font-bold">
                        {loc.not_scanned_count ?? loc.missing_boxes?.length ?? 0}
                      </td>
                      <td className="px-2 py-1.5 text-rose-700 font-bold">
                        {loc.extra_scan_count ?? loc.extra_boxes?.length ?? 0}
                      </td>
                      <td className="px-2 py-1.5">
                        {loc.matched ? (
                          <span className="text-emerald-700 font-bold uppercase text-[9px]">Complete</span>
                        ) : (
                          <span className="text-rose-700 font-bold uppercase text-[9px] flex items-center gap-0.5">
                            <XCircle size={10} /> Difference
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <MatchedBoxesCollapse
            locations={locations}
            singleLocation={singleLocation}
            totalMatched={stats.matched}
          />

          <DifferenceSection
            title="Not scanned"
            count={notScannedRows.length}
            icon={PackageX}
            tone="amber"
            rows={notScannedRows}
            showLocation={showLocationCol}
            emptyMessage="All expected boxes were scanned"
            adjustmentType="not_scanned"
            auditId={resolvedAuditId}
            locationId={resolvedLocationId}
          />

          <DifferenceSection
            title="Extra scan"
            count={extraRows.length}
            icon={PackagePlus}
            tone="rose"
            rows={extraRows}
            showLocation={showLocationCol}
            emptyMessage="No extra scans"
            adjustmentType="extra_scan"
            auditId={resolvedAuditId}
            locationId={resolvedLocationId}
          />
        </div>
      )}
    </Drawer>
  );
}
