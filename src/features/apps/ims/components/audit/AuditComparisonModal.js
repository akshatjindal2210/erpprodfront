"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, MapPin, PackageX, PackagePlus, SlidersHorizontal, XCircle, CheckCheck } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import Drawer from "@/core/components/ui/Drawer";
import { selectRole } from "@/core/store/slices/authSlice";
import { auditService } from "@/features/apps/ims/services/audit";
import { getAuditExecutionStatusLabel, renderAuditLocationResultBadge } from "./auditStatusHelpers";
import { buildLocationComparisonReport, getLocationStatusLabel, getLocationStatusBadgeClass, normalizeLocationStatusKey, isLocationSubmittedRow, computeLocationScoreFromCounts, formatLocationScorePct, resolveBoxAccName } from "./auditScanHelpers";

function DifferenceTypeBadge({ type }) {
  const isExtra = type === "extra_scan";
  const isMatched = type === "matched_scan";
  if (isMatched) {
    return (
      <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase border bg-emerald-100 text-emerald-800 border-emerald-200">
        Matched
      </span>
    );
  }
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
        isExtra
          ? "bg-rose-100 text-rose-700 border-rose-200"
          : "bg-amber-100 text-amber-800 border-amber-200"
      }`}
    >
      {isExtra ? "Extra" : "Missing"}
    </span>
  );
}

function BoolBadge({ value, trueLabel, falseLabel }) {
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
        value
          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
          : "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {value ? trueLabel : falseLabel}
    </span>
  );
}

function BoxDetailTable({ rows, showLocation = false, emptyMessage = "None", variant = "difference" }) {
  if (!rows?.length) {
    return (
      <div className="py-5 text-center text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
        {emptyMessage}
      </div>
    );
  }

  const rowBg =
    variant === "matched"
      ? "bg-emerald-50/60"
      : variant === "extra"
        ? "bg-rose-50/50"
        : "bg-amber-50/40";

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[360px] overflow-y-auto">
      <table className="w-full min-w-[980px] text-left border-collapse">
        <thead className="sticky top-0 z-[1] bg-slate-50 border-b border-slate-200">
          <tr>
            {showLocation && (
              <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Audit location</th>
            )}
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Type</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Expected</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Scanned</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Packing no.</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Box UID</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Acc name</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Item code</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500 w-16">Qty</th>
            <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Box location</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`${row.box_no_uid}-${row.difference_type}-${idx}`}
              className={`border-b border-slate-100 ${rowBg}`}
            >
              {showLocation && (
                <td className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase">
                  {row.audit_location_no || row.location_no || "—"}
                </td>
              )}
              <td className="px-3 py-2">
                <DifferenceTypeBadge type={row.difference_type} />
              </td>
              <td className="px-3 py-2">
                <BoolBadge value={row.expected ?? row.difference_type !== "extra_scan"} trueLabel="Yes" falseLabel="No" />
              </td>
              <td className="px-3 py-2">
                <BoolBadge value={row.scanned ?? row.difference_type !== "not_scanned"} trueLabel="Yes" falseLabel="No" />
              </td>
              <td className="px-3 py-2 text-[10px] font-medium text-slate-700">{row.packing_number ?? "—"}</td>
              <td className="px-3 py-2 text-[10px] font-mono font-bold text-slate-800">{row.box_no_uid}</td>
              <td className="px-3 py-2 text-[10px] text-slate-700">{row.acc_name || resolveBoxAccName(row) || "—"}</td>
              <td className="px-3 py-2 text-[10px] text-slate-700">{row.item_code ?? "—"}</td>
              <td className="px-3 py-2 text-[10px] font-bold text-slate-800">{row.qty ?? "—"}</td>
              <td className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase">{row.location_no ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchedBoxesCollapse({ rows, showLocation, totalMatched }) {
  if (!rows?.length) return null;

  return (
    <details className="rounded-xl border border-emerald-200 bg-emerald-50/30">
      <summary className="px-3 py-2.5 text-[10px] font-black uppercase text-emerald-800 cursor-pointer select-none flex items-center gap-2">
        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
        Matched boxes ({totalMatched}) — expected &amp; scanned align
      </summary>
      <div className="p-2 border-t border-emerald-100 bg-white/80">
        <BoxDetailTable
          rows={rows}
          showLocation={showLocation}
          emptyMessage="No matched boxes"
          variant="matched"
        />
      </div>
    </details>
  );
}

function InlineStat({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
  };
  return (
    <span
      className={`inline-flex flex-col items-center justify-center min-w-[4.5rem] px-2 py-1 rounded border text-center ${tones[tone] || tones.slate}`}
    >
      <span className="text-[8px] font-black uppercase text-slate-500 leading-tight">{label}</span>
      <span className="text-[11px] font-black tabular-nums leading-tight">{value}</span>
    </span>
  );
}

function DifferenceSection({ title, count, icon: Icon, tone, rows, showLocation, emptyMessage, variant }) {
  const headerTone = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
  };

  return (
    <section className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2.5 border-b ${headerTone[tone] || headerTone.amber}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={15} className="shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wide truncate">
            {title} ({count})
          </span>
        </div>
      </div>
      <div className="p-2 bg-white">
        <BoxDetailTable rows={rows} showLocation={showLocation} emptyMessage={emptyMessage} variant={variant} />
      </div>
    </section>
  );
}

function ScoreBadge({ value, size = "md" }) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  const cls =
    n >= 100
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : n >= 80
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-rose-100 text-rose-800 border-rose-200";
  const sizeCls = size === "lg" ? "text-base px-3 py-1" : "text-[11px] px-2 py-0.5";
  return (
    <span className={`inline-flex font-black tabular-nums border rounded ${cls} ${sizeCls}`}>
      {formatLocationScorePct(n)}
    </span>
  );
}

function locScorePct(loc) {
  return computeLocationScoreFromCounts(
    loc.system_count,
    loc.matched_scanned_count ?? 0,
    loc.extra_scan_count ?? loc.extra_boxes?.length ?? 0
  );
}

function LocationStatusBadge({ status }) {
  const label = getLocationStatusLabel(status);
  const cls = getLocationStatusBadgeClass(status);
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase border ${cls}`}>
      {label}
    </span>
  );
}

function LocationResultBadge({ rejected }) {
  return renderAuditLocationResultBadge(rejected, { pendingLabel: "Pending" });
}

export default function AuditComparisonModal({
  open,
  onClose,
  auditId,
  auditLabel,
  locationRow = null,
  onSuccess,
  canManage = false,
}) {
  const currentRole = useSelector(selectRole);
  const isSuperAdmin = currentRole?.toLowerCase() === "super_admin";
  const canAdjust = canManage || isSuperAdmin;

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resultRejected, setResultRejected] = useState(false);
  const singleLocation = Boolean(locationRow);

  const loadReport = useCallback(async () => {
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

    let data = loadLocalReport();
    try {
      const apiData = await loadFromApi();
      if (apiData) data = apiData;
    } catch (apiErr) {
      if (!data) throw apiErr;
    }
    if (!data) throw new Error("No comparison data available");
    setReport(data);
    return data;
  }, [auditId, locationRow]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setReport(null);
    setResultRejected(false);

    (async () => {
      try {
        await loadReport();
      } catch (err) {
        if (!cancelled) toast.error(err?.message || "Failed to load comparison report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, loadReport]);

  const summary = report?.summary;
  const locations = report?.locations || [];
  const showLocationCol = !singleLocation && locations.length > 1;

  const matchedRows = useMemo(() => {
    if (report?.matched_rows?.length) return report.matched_rows;
    return locations.flatMap((loc) =>
      (loc.matched_rows || []).map((row) => ({ ...row, audit_location_no: loc.location_no }))
    );
  }, [report, locations]);

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
  const auditVerified = report?.status === "verified";

  const activeLocationStatus =
    locationRow?.location_status ?? locations[0]?.location_status ?? (allMatched ? "completed" : "mismatch");
  const locationStatusKey = normalizeLocationStatusKey(activeLocationStatus);
  const isLocationComplete = locationStatusKey === "complete";

  const savedResultRejected = useMemo(() => {
    if (singleLocation) {
      if (locationRow?.result_rejected != null) return Boolean(locationRow.result_rejected);
      const loc = locations.find((l) => Number(l.location_id) === Number(resolvedLocationId));
      if (loc?.result_rejected != null) return Boolean(loc.result_rejected);
    }
    return null;
  }, [singleLocation, locationRow?.result_rejected, locations, resolvedLocationId]);

  const stats = {
    expected: summary?.total_expected ?? locations.reduce((n, l) => n + (l.system_count || 0), 0),
    scanned: summary?.total_scanned ?? locations.reduce((n, l) => n + (l.scanned_count || 0), 0),
    matched: summary?.total_matched ?? locations.reduce((n, l) => n + (l.matched_scanned_count || 0), 0),
    notScanned: summary?.total_not_scanned ?? notScannedRows.length,
    extra: summary?.total_extra_scans ?? extraRows.length,
  };

  const displayScore = useMemo(
    () => computeLocationScoreFromCounts(stats.expected, stats.matched, stats.extra),
    [stats.expected, stats.matched, stats.extra]
  );

  const userScores = report?.scores?.user_scores || [];

  const handleCompleteLocation = async () => {
    if (!resolvedAuditId || !resolvedLocationId || !canManage) return;
    if (
      !window.confirm(
        `Mark location ${locationRow?.location_no || ""} as Complete?\n\nStatus will update only — no inventory adjustment.`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await auditService.completeLocation({
        audit_id: Number(resolvedAuditId),
        location_id: Number(resolvedLocationId),
        result_rejected: resultRejected,
      });
      if (!res?.success) throw new Error(res?.message || "Failed to complete location");
      toast.success(res.message || "Location marked Complete");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Could not complete location");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustment = async () => {
    if (!resolvedAuditId || !canAdjust) return;
    const scope = singleLocation ? `location ${locationRow?.location_no}` : "all mismatched locations";
    const completeNote = isLocationComplete
      ? "\n\nLocation is already Complete — inventory will be synced now."
      : "";
    if (
      !window.confirm(
        `Apply adjustment for ${scope}?${completeNote}\n\n• Missing (${stats.notScanned}) — remove from location\n• Extra (${stats.extra}) — add to audit location\n• Recorded in Box Transaction log`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await auditService.applyComparisonAdjustment({
        audit_id: resolvedAuditId,
        location_id: resolvedLocationId,
        result_rejected: isLocationComplete ? Boolean(savedResultRejected) : resultRejected,
      });
      if (!res?.success) throw new Error(res?.message || "Failed to apply adjustment");
      toast.success(res.message || "Adjustment applied");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Could not apply adjustment");
    } finally {
      setActionLoading(false);
    }
  };

  const showCompleteLocation =
    singleLocation && canManage && !isLocationComplete && !auditVerified;
  const showAdjustment =
    canAdjust && !allMatched && (singleLocation ? Boolean(resolvedLocationId) : true);
  const showResultRejectToggle =
    !isLocationComplete &&
    (showCompleteLocation || showAdjustment) &&
    (isSuperAdmin || canManage || canAdjust);

  const hasFooterActions = showCompleteLocation || showAdjustment;
  const hasFooterStatus = singleLocation && (isLocationComplete || showResultRejectToggle);

  const footer =
    hasFooterActions || hasFooterStatus ? (
      <>
        {singleLocation && (
          <div className="flex items-center gap-2 mr-auto min-w-0 flex-wrap">
            <LocationStatusBadge status={activeLocationStatus} />
            {isLocationComplete && (
              <LocationResultBadge rejected={savedResultRejected ?? false} />
            )}
            {showResultRejectToggle && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer shrink-0 select-none">
                <input
                  type="checkbox"
                  checked={resultRejected}
                  onChange={(e) => setResultRejected(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-[9px] font-bold uppercase text-slate-600">Reject</span>
              </label>
            )}
          </div>
        )}

        {showCompleteLocation && (
          <button
            type="button"
            onClick={handleCompleteLocation}
            disabled={actionLoading}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            Complete
          </button>
        )}

        {showAdjustment && (
          <button
            type="button"
            onClick={handleAdjustment}
            disabled={actionLoading}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <SlidersHorizontal size={14} />}
            Adjustment
          </button>
        )}
      </>
    ) : null;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={singleLocation ? `Location comparison — ${locationRow?.location_no}` : "Audit comparison report"}
      description={auditLabel || (resolvedAuditId ? `Audit #${resolvedAuditId}` : "")}
      maxWidth="max-w-6xl"
      footer={footer}
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
            className={`px-2.5 py-2 rounded-lg border ${
              allMatched ? "bg-emerald-50/80 border-emerald-200" : "bg-amber-50/80 border-amber-200"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {allMatched ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              )}
              <p className={`text-[11px] font-bold shrink-0 ${allMatched ? "text-emerald-800" : "text-amber-800"}`}>
                {allMatched ? "All boxes match" : `${stats.notScanned} missing · ${stats.extra} extra`}
              </p>
              {singleLocation && locationRow && (
                <span className="text-[9px] text-slate-600 flex items-center gap-0.5">
                  <MapPin size={9} />
                  {locationRow.location_no} · {getLocationStatusLabel(locationRow.location_status)}
                </span>
              )}
              {!singleLocation && (
                <span className="text-[9px] text-slate-600">
                  {getAuditExecutionStatusLabel(report.status)} · {summary?.matched_locations || 0}/{summary?.total_locations || locations.length} loc
                </span>
              )}
              <div className="flex flex-wrap items-stretch gap-1.5 ml-auto">
                <InlineStat label="Expected" value={stats.expected} />
                <InlineStat label="Scanned" value={stats.scanned} tone="indigo" />
                <InlineStat label="Matched" value={stats.matched} tone="emerald" />
                <InlineStat label="Missing" value={stats.notScanned} tone="amber" />
                <InlineStat label="Extra" value={stats.extra} tone="rose" />
                <InlineStat label="Score" value={formatLocationScorePct(displayScore)} tone="indigo" />
              </div>
            </div>
          </div>

          {!singleLocation && userScores.length > 1 && (
            <div className="flex flex-wrap gap-2 px-1">
              <span className="text-[9px] font-black uppercase text-slate-500 self-center">User total:</span>
              {userScores.map((row) => (
                <span
                  key={row.assigned_user_id ?? row.assigned_user_name}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px]"
                >
                  <span className="font-bold text-slate-700">{row.assigned_user_name}</span>
                  <ScoreBadge value={row.score_pct} />
                </span>
              ))}
            </div>
          )}

          {!singleLocation && locations.length > 1 && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full min-w-[520px] text-left text-[10px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Location</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Expected</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Scanned</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Matched</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Missing</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Extra</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Score</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Result</th>
                    <th className="px-2 py-1.5 font-black uppercase text-slate-500">Audit</th>
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
                        <ScoreBadge value={locScorePct(loc)} />
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
                      <td className="px-2 py-1.5">
                        <LocationResultBadge
                          rejected={
                            loc.result_rejected != null
                              ? Boolean(loc.result_rejected)
                              : normalizeLocationStatusKey(loc.location_status) === "complete"
                                ? false
                                : null
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {notScannedRows.length > 0 && (
            <DifferenceSection
              title="Audit missing"
              count={notScannedRows.length}
              icon={PackageX}
              tone="amber"
              rows={notScannedRows}
              showLocation={showLocationCol}
              emptyMessage="No missing boxes"
              variant="missing"
            />
          )}

          {extraRows.length > 0 && (
            <DifferenceSection
              title="Audit extra"
              count={extraRows.length}
              icon={PackagePlus}
              tone="rose"
              rows={extraRows}
              showLocation={showLocationCol}
              emptyMessage="No extra boxes"
              variant="extra"
            />
          )}

          <MatchedBoxesCollapse
            rows={matchedRows}
            showLocation={showLocationCol}
            totalMatched={stats.matched}
          />
        </div>
      )}
    </Drawer>
  );
}
