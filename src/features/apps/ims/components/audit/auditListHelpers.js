"use client";

import { expandLocationAssignmentRows, getAuditPlanUsers, formatAuditParticipantNames, filterLocationListRows, computeAuditBatchScore, isLocationSubmittedRow, formatLocationScorePct, getLocationStatusLabel, getLocationStatusBadgeClass } from "./auditScanHelpers";
import { getAuditExecutionStatusLabel } from "./auditStatusHelpers";

export function auditMasterSearchParts(row) {
  const parts = [
    row?.audit_id,
    row?.remarks,
    row?.status,
    getAuditExecutionStatusLabel(row?.status),
    row?.assigned_user_names,
    getAssignedUsersLabel(row),
    row?.created_by_name,
    row?.approved_by_name,
    row?.approved ? "AUTHORIZED" : "PENDING",
  ];
  if (Array.isArray(row?.locations)) {
    for (const loc of row.locations) {
      parts.push(
        loc?.location_no,
        loc?.assigned_user_name,
        loc?.plan_assigned_user_name,
        loc?.status,
        getLocationStatusLabel(loc?.status)
      );
    }
  }
  const batch = computeAuditBatchScore(row);
  if (batch?.score_pct != null) parts.push(formatLocationScorePct(batch.score_pct));
  return parts.filter((p) => p != null && p !== "");
}

export function auditLocationSearchParts(row) {
  const parts = [
    row?.audit_id,
    row?.location_no,
    row?.assigned_user_name,
    row?.plan_assigned_user_name,
    row?.location_status,
    getLocationStatusLabel(row?.location_status),
    row?.remarks,
    row?.scanned_count,
    row?.expected_count,
    row?.score_pct != null ? formatLocationScorePct(row.score_pct) : null,
  ];
  return parts.filter((p) => p != null && p !== "");
}

export function buildAuditApiFilters({ status, authorization }) {
  return {
    ...(status !== "all" && { status }),
    ...(authorization === "pending" && { approved: false }),
    ...(authorization === "authorized" && { approved: true }),
  };
}

export function getAssignedUsersLabel(audit) {
  if (audit?.assigned_user_names) return audit.assigned_user_names;
  return formatAuditParticipantNames(audit);
}

export function canSeeAllAuditLocations(audit, userId, isSuperAdmin, canManageAudit) {
  if (isSuperAdmin || canManageAudit) return true;
  return userId != null && Number(audit?.created_by) === Number(userId);
}

export function getDefaultLocationUserFilter(userId, isSuperAdmin = false) {
  if (isSuperAdmin) return "all";
  return userId != null ? String(userId) : "all";
}

export function flattenAuditLocations(audits = [], { userId = null, isSuperAdmin = false, canManageAudit = false } = {}) {
  const rows = [];
  for (const audit of audits) {
    const seeAllForAudit = canSeeAllAuditLocations(audit, userId, isSuperAdmin, canManageAudit);
    for (const loc of audit.locations || []) {
      rows.push(...expandLocationAssignmentRows(audit, loc, { seeAllForAudit, userId }));
    }
  }
  return rows;
}

export function filterAuditLocationRows(rows, filters, searchFn) {
  return filterLocationListRows(rows, filters, searchFn);
}

export function buildLocationUserFilterOptions(allRows, { currentUser, isSuperAdmin, canFilterAllAuditUsers }) {
  const byId = new Map();
  for (const audit of allRows) {
    for (const user of getAuditPlanUsers(audit)) {
      if (!byId.has(user.user_id)) byId.set(user.user_id, user.user_name);
    }
  }

  const options = [];
  const myId = currentUser?.id != null ? Number(currentUser.id) : null;

  if (canFilterAllAuditUsers) options.push({ label: "All Users", value: "all" });
  if (myId != null && !isSuperAdmin) {
    options.push({ label: byId.get(myId) || currentUser?.name || `User #${myId}`, value: String(myId) });
  }
  if (canFilterAllAuditUsers) {
    [...byId.entries()]
      .filter(([id]) => myId == null || Number(id) !== myId)
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
      .forEach(([id, name]) => options.push({ label: name, value: String(id) }));
  }

  return options.length ? options : [{ label: "All Users", value: "all" }];
}

export function buildLocationAuditFilterOptions(flattenedRows) {
  const ids = new Set(flattenedRows.map((r) => r.audit_id));
  const options = [{ label: "All", value: "all" }];
  [...ids].sort((a, b) => b - a).forEach((id) => options.push({ label: `#${id}`, value: String(id) }));
  return options;
}

export function indexAuditsById(audits = []) {
  const map = new Map();
  for (let i = 0; i < audits.length; i++) {
    const audit = audits[i];
    map.set(audit.audit_id, audit);
  }
  return map;
}

export function indexLocationRowsById(rows = []) {
  const map = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    map.set(row.row_id, row);
  }
  return map;
}

function scoreBadgeClass(n) {
  if (!Number.isFinite(n)) return "bg-slate-100 text-slate-500 border-slate-200";
  if (n >= 100) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (n >= 80) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

export function renderLocationStatusBadge(status) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${getLocationStatusBadgeClass(status)}`}>
      {getLocationStatusLabel(status)}
    </span>
  );
}

export function renderLocationUsersCell(row) {
  const name = row.assigned_user_name || "—";
  if (!row.is_history_row) {
    return <span className="font-bold text-slate-800 text-[11px]">{name}</span>;
  }
  return (
    <div className="min-w-0">
      <span className="font-bold text-slate-600 text-[11px]">{name}</span>
      <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide">Previous assignee</span>
    </div>
  );
}

export function renderLocationBoxesCell(row) {
  return (
    <span className="text-[10px] font-bold text-slate-700 tabular-nums">
      {row.scanned_count ?? 0} / {row.expected_count ?? 0}
    </span>
  );
}

export function renderLocationScoreCell(row) {
  if (!isLocationSubmittedRow(row)) {
    return <span className="text-[10px] text-slate-400">After submit</span>;
  }
  const n = Number(row.score_pct);
  if (!Number.isFinite(n)) return <span className="text-[10px] text-slate-400">—</span>;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-black tabular-nums border ${scoreBadgeClass(n)}`}>
      {formatLocationScorePct(n)}
    </span>
  );
}

export function renderAuditBatchScoreCell(audit) {
  const batch = computeAuditBatchScore(audit);
  if (!batch) return <span className="text-[10px] text-slate-400">Pending</span>;
  const n = Number(batch.score_pct);
  const partial = batch.scored_location_count < batch.location_count;
  return (
    <div className="flex flex-col items-start gap-0.5" title={`${batch.scored_location_count} of ${batch.location_count} locations scored`}>
      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-black tabular-nums border ${scoreBadgeClass(n)}`}>
        {formatLocationScorePct(n)}
      </span>
      <span className="text-[8px] font-bold text-slate-400 tabular-nums">
        {partial ? `${batch.scored_location_count}/${batch.location_count} loc` : `${batch.location_count} loc`}
      </span>
    </div>
  );
}
