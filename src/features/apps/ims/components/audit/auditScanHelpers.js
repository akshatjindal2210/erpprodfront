function parseJsonBoxList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Parse expected_boxes JSON array on a location row. */
export function parseExpectedBoxes(loc) {
  const raw =
    loc != null && typeof loc === "object" && !Array.isArray(loc) && !("expected_boxes" in loc)
      ? parseJsonBoxList(loc)
      : parseJsonBoxList(loc?.expected_boxes);
  return raw.map(normalizeExpectedBox).filter((row) => row?.box_no_uid);
}

function normalizeExpectedBox(row) {
  if (!row || typeof row !== "object") return null;
  const box_no_uid = String(row.box_no_uid || "").trim().toUpperCase();
  if (!box_no_uid) return null;
  const acc_name = resolveBoxAccName(row);
  return {
    ...row,
    box_no_uid,
    ...(acc_name ? { acc_name } : {}),
  };
}

/** Parse scanned_boxes JSON array on a location row. */
export function parseScannedBoxes(loc) {
  if (loc != null && typeof loc === "object" && !Array.isArray(loc) && !("scanned_boxes" in loc)) {
    return parseJsonBoxList(loc);
  }
  const list = parseJsonBoxList(loc?.scanned_boxes);
  return list
    .map((row) => ({
      box_no_uid: String(row?.box_no_uid || "").trim().toUpperCase(),
      scanned_at: row?.scanned_at ?? null,
      scanned_by: row?.scanned_by ?? null,
    }))
    .filter((row) => row.box_no_uid);
}

/** Previous assignees' full assignment clones (on reassign). */
export function parseAssignmentHistory(loc) {
  const raw = loc?.assignment_history;
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) list = [];
  return list
    .map((entry) => {
      const boxes = Array.isArray(entry?.scanned_boxes) ? entry.scanned_boxes : [];
      return {
        assignment_clone_id: entry?.assignment_clone_id ?? null,
        user_id: entry?.user_id != null ? Number(entry.user_id) : null,
        user_name: entry?.user_name ?? null,
        location_status: entry?.location_status ?? null,
        reassigned_at: entry?.reassigned_at ?? null,
        expected_boxes: Array.isArray(entry?.expected_boxes) ? entry.expected_boxes : [],
        scanned_boxes: boxes,
        scan_count: Number(entry?.scan_count) || boxes.length,
      };
    })
    .filter((entry) => entry.user_id != null);
}

/** Clone history + active scans merged (unique by box uid). */
export function getMergedScannedBoxes(loc) {
  const byUid = new Map();

  for (const entry of parseAssignmentHistory(loc)) {
    for (const row of entry.scanned_boxes || []) {
      const uid = String(row?.box_no_uid || "").trim().toUpperCase();
      if (uid) byUid.set(uid, row);
    }
  }
  for (const row of parseScannedBoxes(loc)) {
    const uid = String(row?.box_no_uid || "").trim().toUpperCase();
    if (uid) byUid.set(uid, row);
  }

  return [...byUid.values()];
}

export function isActiveAuditLocation(loc) {
  return loc?.is_active !== false;
}

/** Original audit-plan assignee (set at create; unchanged on reassign). */
export function getOriginalAssignedUserId(loc) {
  if (loc?.plan_assigned_user_id != null) {
    return Number(loc.plan_assigned_user_id);
  }
  return loc?.assigned_user_id != null ? Number(loc.assigned_user_id) : null;
}

export function getOriginalAssignedUserName(loc) {
  const originalId = getOriginalAssignedUserId(loc);
  if (loc?.plan_assigned_user_name) return loc.plan_assigned_user_name;
  if (originalId != null && Number(loc?.assigned_user_id) === Number(originalId)) {
    return loc?.assigned_user_name || `User #${originalId}`;
  }
  return originalId != null ? `User #${originalId}` : "—";
}

/** Users from the original audit plan (add/edit + filters) — one entry per location from active rows. */
export function getAuditPlanUsers(audit) {
  const byId = new Map();
  const seenLocations = new Set();
  for (const loc of audit?.locations || []) {
    if (!isActiveAuditLocation(loc)) continue;
    const locKey = String(loc.location_id);
    if (seenLocations.has(locKey)) continue;
    seenLocations.add(locKey);
    const userId = getOriginalAssignedUserId(loc);
    if (userId == null) continue;
    if (!byId.has(userId)) {
      byId.set(userId, getOriginalAssignedUserName(loc));
    }
  }
  return [...byId.entries()]
    .map(([user_id, user_name]) => ({ user_id, user_name }))
    .sort((a, b) => String(a.user_name).localeCompare(String(b.user_name)));
}

/** Currently assigned + previous (clone) users on the audit. */
export function getAuditParticipantUsers(audit) {
  const byId = new Map();
  for (const loc of audit?.locations || []) {
    const id = loc?.assigned_user_id;
    if (id == null) continue;
    const key = Number(id);
    if (!byId.has(key)) {
      byId.set(key, loc?.assigned_user_name || `User #${key}`);
    }
  }
  return [...byId.entries()]
    .map(([user_id, user_name]) => ({ user_id, user_name }))
    .sort((a, b) => String(a.user_name).localeCompare(String(b.user_name)));
}

export function formatAuditParticipantNames(audit) {
  const names = getAuditParticipantUsers(audit).map((u) => u.user_name).filter(Boolean);
  return names.length ? names.join(", ") : "—";
}

function canSeeAssignmentUser(seeAllForAudit, userId, assignedUserId) {
  if (seeAllForAudit) return true;
  if (userId == null) return true;
  return Number(assignedUserId) === Number(userId);
}

function buildLocationListRow(audit, loc) {
  const isClone = !isActiveAuditLocation(loc);
  const closed = isLocationClosed(loc);
  const comparison = closed ? getLocationBoxComparison(loc) : null;
  const scans = parseScannedBoxes(loc);
  const assignmentId = loc.assignment_id ?? `${loc.location_id}-${isClone ? "clone" : "active"}`;

  return {
    row_id: `${audit.audit_id}-${assignmentId}`,
    assignment_id: loc.assignment_id ?? null,
    audit_id: audit.audit_id,
    location_id: loc.location_id,
    location_no: loc.location_no || "—",
    assignment_row_type: isClone ? "clone" : "current",
    is_history_row: isClone,
    is_active: !isClone,
    plan_assigned_user_id: getOriginalAssignedUserId(loc),
    plan_assigned_user_name: getOriginalAssignedUserName(loc),
    location_status: loc.status || "pending",
    assigned_user_name: loc.assigned_user_name || "—",
    assigned_user_id: loc.assigned_user_id,
    users_label: loc.assigned_user_name || "",
    expected_count: countExpectedBoxes(loc),
    scanned_count: scans.length,
    expected_boxes: loc.expected_boxes,
    scanned_boxes: loc.scanned_boxes,
    missing_boxes: closed ? comparison.missing : [],
    extra_boxes: closed ? comparison.extra : [],
    difference_boxes: closed ? [...comparison.missing, ...comparison.extra] : [],
    all_matched: closed ? comparison.allMatched : false,
    score_pct: closed ? computeLocationScoreFromComparison(comparison) : null,
    is_submitted: closed,
    reassigned_at: loc.reassigned_at ?? null,
    start_date: audit.start_date,
    end_date: audit.end_date,
    approved: audit.approved,
    status: audit.status,
    remarks: audit.remarks,
    created_by_name: audit.created_by_name,
    created_at: audit.created_at,
  };
}

/** One UI row per DB assignment — active + clone (previous user) rows. */
export function expandLocationAssignmentRows(audit, loc, { seeAllForAudit = false, userId = null } = {}) {
  // Assigned users see locations only after creator activates the audit
  if (!audit?.approved && !seeAllForAudit) {
    return [];
  }
  if (!canSeeAssignmentUser(seeAllForAudit, userId, loc.assigned_user_id)) {
    return [];
  }
  return [buildLocationListRow(audit, loc)];
}

/** Per-user breakdown: cloned assignees + current assignee. */
export function getLocationUserScanSummary(loc) {
  const history = parseAssignmentHistory(loc);
  const clones = history.map((entry) => ({
    user_id: entry.user_id,
    user_name: entry.user_name || (entry.user_id != null ? `User #${entry.user_id}` : "—"),
    scan_count: entry.scan_count,
  }));

  const currentScans = parseScannedBoxes(loc);
  const cloneScanCount = clones.reduce((sum, entry) => sum + entry.scan_count, 0);

  return {
    clones,
    current: {
      user_id: loc?.assigned_user_id != null ? Number(loc.assigned_user_id) : null,
      user_name: loc?.assigned_user_name || "—",
      scan_count: currentScans.length,
    },
    clone_scan_count: cloneScanCount,
    current_scan_count: currentScans.length,
    total_scan_count: getMergedScannedBoxes(loc).length,
    has_reassign: clones.length > 0,
  };
}

export function countExpectedBoxes(loc) {
  return parseExpectedBoxes(loc).length;
}

export function countScannedBoxes(loc) {
  return parseScannedBoxes(loc).length;
}

export function isLocationDraft(loc) {
  return String(loc?.status ?? "").trim().toLowerCase() === "draft";
}

export function isLocationEditable(loc) {
  const key = String(loc?.status ?? "pending").trim().toLowerCase();
  return key === "pending" || key === "draft";
}

export function isWithinAuditDateRangeFromRow(row, now = new Date()) {
  if (!row?.start_date || !row?.end_date) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = new Date(row.start_date);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const end = new Date(row.end_date);
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
  return today >= startDate && today <= endDate;
}

/** Assigned user (or super admin) can open scan UI for this location row. */
export function canExecuteAuditLocationRow(locationRow, { userId = null, role = null } = {}) {
  if (!locationRow) return false;
  if (locationRow.is_history_row) return false;
  if (!isLocationEditable({ status: locationRow.location_status })) return false;
  if (!locationRow.approved) return false;

  const isSuperAdmin = String(role || "").toLowerCase() === "super_admin";
  const isAssigned =
    isSuperAdmin || Number(locationRow.assigned_user_id) === Number(userId);
  if (!isAssigned) return false;
  if (!isWithinAuditDateRangeFromRow(locationRow)) return false;

  const auditStatus = locationRow.status;
  if (auditStatus === "submitted" || auditStatus === "verified") return false;

  return (
    Boolean(locationRow.approved) &&
    (auditStatus === "pending" ||
      auditStatus === "approved" ||
      auditStatus === "in_progress")
  );
}

export function filterLocationListRows(
  rows = [],
  { locationAuditFilter = "all", locationUserFilter = "all", locationStatusFilter = "all", search = "" } = {},
  searchFn = null
) {
  let filtered = [...rows];

  if (locationAuditFilter !== "all") {
    const auditId = Number(locationAuditFilter);
    filtered = filtered.filter((r) => r.audit_id === auditId);
  }

  if (locationUserFilter !== "all") {
    const filterUserId = Number(locationUserFilter);
    filtered = filtered.filter((r) => Number(r.assigned_user_id) === filterUserId);
  }

  if (locationStatusFilter !== "all") {
    filtered = filtered.filter((r) =>
      matchesLocationStatusFilter(r.location_status, locationStatusFilter)
    );
  }

  const q = String(search ?? "").trim();
  if (q && typeof searchFn === "function") {
    filtered = searchFn(filtered, search);
  }

  return filtered;
}

/** Next startable row: prefer selected, else first in list; skip just-finished row. */
export function findNextExecutableLocationRow(
  rows = [],
  context = {},
  { preferRow = null, excludeRowId = null } = {}
) {
  const eligible = rows.filter(
    (row) =>
      row?.row_id !== excludeRowId && canExecuteAuditLocationRow(row, context)
  );
  if (!eligible.length) return null;
  if (preferRow && eligible.some((row) => row.row_id === preferRow.row_id)) {
    return preferRow;
  }
  return eligible[0];
}

export function isLocationPending(loc) {
  return String(loc?.status ?? "pending").trim().toLowerCase() === "pending";
}

export function isLocationClosed(loc) {
  const key = String(loc?.status ?? "").trim().toLowerCase();
  return key === "completed" || key === "mismatch";
}

/** UI status key: pending | draft | complete | difference */
export function normalizeLocationStatusKey(status) {
  const key = String(status ?? "pending").trim().toLowerCase();
  if (key === "completed") return "complete";
  if (key === "mismatch") return "difference";
  if (key === "draft") return "draft";
  return "pending";
}

export function getLocationStatusLabel(status) {
  const key = normalizeLocationStatusKey(status);
  if (key === "complete") return "Complete";
  if (key === "difference") return "Difference";
  if (key === "draft") return "Draft";
  return "Pending";
}

export function getLocationStatusBadgeClass(status) {
  const key = normalizeLocationStatusKey(status);
  if (key === "complete") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (key === "difference") return "bg-rose-50 text-rose-700 border-rose-200";
  if (key === "draft") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

/** Location list filter — default pending includes draft rows too. */
export function matchesLocationStatusFilter(locationStatus, filterValue) {
  if (filterValue === "all") return true;
  const key = normalizeLocationStatusKey(locationStatus);
  if (filterValue === "pending") return key === "pending" || key === "draft";
  if (filterValue === "missing") return key === "difference";
  return key === filterValue;
}

/** Build { [location_id]: box_no_uid[] } from location scanned_boxes JSON. */
export function buildScannedDataFromAudit(audit) {
  const data = {};

  for (const loc of audit?.locations || []) {
    const locId = Number(loc.location_id);
    if (!Number.isFinite(locId)) continue;

    data[locId] = parseScannedBoxes(loc)
      .map((row) => String(row?.box_no_uid || "").trim())
      .filter(Boolean);
  }

  return data;
}

export function getLocationFromAudit(audit, locationId) {
  if (!audit?.locations || locationId == null) return null;
  const id = Number(locationId);
  const matches = audit.locations.filter((l) => Number(l.location_id) === id);
  return matches.find((l) => isActiveAuditLocation(l)) || matches[0] || null;
}

/** Last pending location for this worker (or all users when allUsers). */
export function isLastPendingExecutionLocation(audit, locationId, { userId, allUsers = false } = {}) {
  let locs = audit?.locations || [];
  if (!allUsers && userId != null) {
    locs = locs.filter((l) => Number(l.assigned_user_id) === Number(userId));
  }
  const pending = locs.filter((l) => isLocationEditable(l));
  return pending.length === 1 && Number(pending[0].location_id) === Number(locationId);
}

export function getExpectedBoxCount(audit, locationId) {
  const loc = getLocationFromAudit(audit, locationId);
  return loc ? countExpectedBoxes(loc) : 0;
}

export function getScannedBoxCount(audit, locationId) {
  const loc = getLocationFromAudit(audit, locationId);
  return loc ? countScannedBoxes(loc) : 0;
}

const normalizeUid = (uid) => String(uid || "").trim().toUpperCase();

/** Compare expected vs scanned JSON on a location row. */
export function getLocationBoxComparison(loc) {
  const expected = new Set(
    parseExpectedBoxes(loc).map((b) => normalizeUid(b.box_no_uid)).filter(Boolean)
  );
  const scanned = new Set(
    parseScannedBoxes(loc).map((s) => normalizeUid(s.box_no_uid)).filter(Boolean)
  );

  const missing = [...expected].filter((uid) => !scanned.has(uid)).sort();
  const extra = [...scanned].filter((uid) => !expected.has(uid)).sort();
  const matched = [...scanned].filter((uid) => expected.has(uid)).sort();

  return {
    missing,
    extra,
    matched,
    expected_count: expected.size,
    scanned_count: scanned.size,
    allMatched: missing.length === 0 && extra.length === 0 && expected.size === scanned.size,
  };
}

/** Score % = (matched − extra) ÷ expected × 100 */
export function computeLocationScoreFromComparison(cmp) {
  if (!cmp) return null;
  return computeLocationScoreFromCounts(
    cmp.expected_count,
    cmp.matched?.length ?? 0,
    cmp.extra?.length ?? 0
  );
}

export function computeLocationScoreFromCounts(expected, matched, extra = 0) {
  const exp = Number(expected) || 0;
  const mat = Number(matched) || 0;
  const ext = Number(extra) || 0;
  const net = Math.max(0, mat - ext);
  if (exp <= 0) return net > 0 ? 0 : 100;
  return Math.round((net / exp) * 10000) / 100;
}

export function formatLocationScorePct(scorePct) {
  if (scorePct == null || scorePct === "") return "—";
  const n = Number(scorePct);
  if (!Number.isFinite(n)) return "—";
  return n % 1 === 0 ? `${n}%` : `${n.toFixed(1)}%`;
}

/**
 * Master-wise audit score — all active locations combined (batch total).
 * e.g. 2 users × 3+2 locations → one score from 5 locations' expected/matched/extra.
 */
export function computeAuditBatchScore(audit) {
  const locs = (audit?.locations || []).filter(isActiveAuditLocation);
  if (!locs.length) return null;

  let expected = 0;
  let matched = 0;
  let extra = 0;
  let scoredCount = 0;

  for (const loc of locs) {
    const closed = isLocationClosed(loc);
    if (!closed && loc.score_at == null) continue;

    const cmp = getLocationBoxComparison(loc);
    expected += cmp.expected_count;
    matched += cmp.matched.length;
    extra += cmp.extra.length;
    scoredCount += 1;
  }

  if (scoredCount === 0) return null;

  return {
    score_pct: computeLocationScoreFromCounts(expected, matched, extra),
    location_count: locs.length,
    scored_location_count: scoredCount,
    expected_count: expected,
    matched_count: matched,
    extra_count: extra,
  };
}

export function isLocationSubmittedRow(row) {
  if (!row) return false;
  return Boolean(row.is_submitted) || isLocationClosed({ status: row.location_status });
}

export function resolveBoxAccName(row) {
  if (!row) return null;
  const existing = row.acc_name != null ? String(row.acc_name).trim() : "";
  if (existing && existing !== "-") return existing;

  const override = row.override_cust != null ? String(row.override_cust).trim() : "";
  if (override && override !== "-") return override;

  for (const candidate of [row.acc_code, row.sa_acc_code, row.packing_acc_code]) {
    const code = candidate != null ? String(candidate).trim() : "";
    if (code && code !== "-" && !/^\d+$/.test(code)) return code;
  }
  return null;
}

function formatBoxCustomer(detail) {
  if (!detail) return "—";
  return detail.acc_name || resolveBoxAccName(detail) || "—";
}

function formatBoxItem(detail) {
  if (!detail) return "—";
  return detail.item_code || "—";
}

function buildDifferenceRowsFromComparison(row, cmp) {
  const expected = parseExpectedBoxes(row);
  const byUid = new Map(
    expected.map((b) => [normalizeUid(b.box_no_uid), b]).filter(([uid]) => uid)
  );
  const auditLocationNo = row.location_no || "—";

  const rows = [];
  for (const uid of cmp.missing) {
    const det = byUid.get(uid);
    rows.push({
      difference_type: "not_scanned",
      box_no_uid: uid,
      packing_number: det?.packing_number ?? "—",
      acc_name: formatBoxCustomer(det),
      item_code: formatBoxItem(det),
      qty: det?.qty ?? "—",
      location_no: auditLocationNo,
      audit_location_no: auditLocationNo,
      expected: true,
      scanned: false,
    });
  }
  for (const uid of cmp.extra) {
    const det = byUid.get(uid);
    rows.push({
      difference_type: "extra_scan",
      box_no_uid: uid,
      packing_number: det?.packing_number ?? "—",
      acc_name: formatBoxCustomer(det),
      item_code: formatBoxItem(det),
      qty: det?.qty ?? "—",
      location_no: det?.location_no || auditLocationNo,
      audit_location_no: auditLocationNo,
      expected: false,
      scanned: true,
    });
  }
  return rows;
}

function buildMatchedRowsFromComparison(row, cmp) {
  const expected = parseExpectedBoxes(row);
  const byUid = new Map(
    expected.map((b) => [normalizeUid(b.box_no_uid), b]).filter(([uid]) => uid)
  );
  const auditLocationNo = row.location_no || "—";
  return cmp.matched.map((uid) => {
    const det = byUid.get(uid);
    return {
      difference_type: "matched_scan",
      box_no_uid: uid,
      packing_number: det?.packing_number ?? "—",
      acc_name: formatBoxCustomer(det),
      item_code: formatBoxItem(det),
      qty: det?.qty ?? "—",
      location_no: auditLocationNo,
      audit_location_no: auditLocationNo,
      expected: true,
      scanned: true,
    };
  });
}

/** Single-location comparison report from list row (no API). */
export function buildLocationComparisonReport(row) {
  const cmp = getLocationBoxComparison(row);
  const diffRows = buildDifferenceRowsFromComparison(row, cmp);
  const not_scanned_rows = diffRows.filter((r) => r.difference_type === "not_scanned");
  const extra_scan_rows = diffRows.filter((r) => r.difference_type === "extra_scan");
  const matched_rows = buildMatchedRowsFromComparison(row, cmp);
  const difference_rows = [...not_scanned_rows, ...extra_scan_rows];
  const system_boxes = parseExpectedBoxes(row)
    .map((b) => normalizeUid(b.box_no_uid))
    .filter(Boolean)
    .sort();
  const scanned_boxes = parseScannedBoxes(row)
    .map((s) => normalizeUid(s.box_no_uid))
    .filter(Boolean)
    .sort();

  return {
    audit_id: row.audit_id,
    status: row.status,
    locations: [
      {
        location_id: row.location_id,
        location_no: row.location_no,
        location_status: row.location_status,
        system_count: cmp.expected_count,
        scanned_count: cmp.scanned_count,
        matched_scanned_count: cmp.matched.length,
        not_scanned_count: cmp.missing.length,
        extra_scan_count: cmp.extra.length,
        matched: cmp.allMatched,
        missing_boxes: cmp.missing,
        extra_boxes: cmp.extra,
        matched_scanned_boxes: cmp.matched,
        matched_rows,
        not_scanned_rows,
        extra_scan_rows,
        system_boxes,
        scanned_boxes,
        mismatch_incomplete: cmp.missing.length > 0,
        mismatch_extra_scans: cmp.extra.length > 0,
        difference_rows,
      },
    ],
    difference_rows,
    matched_rows,
    not_scanned_rows,
    extra_scan_rows,
    summary: {
      total_locations: 1,
      matched_locations: cmp.allMatched ? 1 : 0,
      mismatched_locations: cmp.allMatched ? 0 : 1,
      total_differences: difference_rows.length,
      total_not_scanned: cmp.missing.length,
      total_extra_scans: cmp.extra.length,
      total_matched: cmp.matched.length,
      total_expected: cmp.expected_count,
      total_scanned: cmp.scanned_count,
    },
  };
}
