"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, ClipboardCheck, RefreshCcw, Edit3, Trash2, X, Info, Play, User, MapPin, GitCompare, ClipboardList, RotateCcw, UserRoundCog } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime, formatDate } from "@/core/utils/utilHelper";
import { auditService } from "@/features/apps/ims/services/audit";
import { useViewMode } from "@/core/hooks/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";

// Components
import ActionButton from "@/core/components/ui/ActionButton";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import DeleteModal from "@/core/components/common/DeleteModal";
import DataTable from "@/core/components/ui/DataTable";
import AuditModal from "./AuditModal";
import AuditExecutionModal from "./AuditExecutionModal";
import AuditComparisonModal from "./AuditComparisonModal";
import AuditReassignModal from "./AuditReassignModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ImsSegmentedTabs from "@/features/apps/ims/components/common/ImsSegmentedTabs";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages } from "@/features/apps/ims/helpers/clientListSearch";
import { useSelector } from "react-redux";
import { selectUser, selectRole } from "@/core/store/slices/authSlice";
import { getAuditExecutionStatusLabel, renderAuditExecutionStatusBadge, renderAuditLocationResultBadge, getAuditLocationResultLabel } from "./auditStatusHelpers";
import { isLocationClosed, getLocationStatusLabel, getLocationStatusBadgeClass, matchesLocationStatusFilter, expandLocationAssignmentRows, isLocationSubmittedRow, getAuditPlanUsers, formatAuditParticipantNames, formatLocationScorePct, computeAuditBatchScore, canExecuteAuditLocationRow, filterLocationListRows, findNextExecutableLocationRow } from "./auditScanHelpers";

const PAGE_TABS = {
  LOCATION: "location",
  MASTER: "master",
};

function renderLocationStatusBadge(status) {
  const label = getLocationStatusLabel(status);
  const cls = getLocationStatusBadgeClass(status);
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${cls}`}>
      {label}
    </span>
  );
}

function getAssignedUsersLabel(audit) {
  if (audit?.assigned_user_names) return audit.assigned_user_names;
  return formatAuditParticipantNames(audit);
}

function canSeeAllAuditLocations(audit, userId, isSuperAdmin, canManageAudit) {
  if (isSuperAdmin || canManageAudit) return true;
  return userId != null && Number(audit?.created_by) === Number(userId);
}

function getDefaultLocationUserFilter(userId, isSuperAdmin = false) {
  if (isSuperAdmin) return "all";
  return userId != null ? String(userId) : "all";
}

function flattenAuditLocations(
  audits = [],
  { userId = null, isSuperAdmin = false, canManageAudit = false } = {}
) {
  const rows = [];
  for (const audit of audits) {
    const seeAllForAudit = canSeeAllAuditLocations(audit, userId, isSuperAdmin, canManageAudit);
    const locs = Array.isArray(audit.locations) ? audit.locations : [];
    for (const loc of locs) {
      rows.push(
        ...expandLocationAssignmentRows(audit, loc, { seeAllForAudit, userId })
      );
    }
  }
  rows.sort((a, b) => {
    if (a.audit_id !== b.audit_id) return b.audit_id - a.audit_id;
    if (a.location_no !== b.location_no) {
      return String(a.location_no).localeCompare(String(b.location_no));
    }
    if (a.is_history_row !== b.is_history_row) return a.is_history_row ? -1 : 1;
    return (a.assignment_id ?? 0) - (b.assignment_id ?? 0);
  });
  return rows;
}

function renderLocationUsersCell(row) {
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

function renderLocationBoxesCell(row) {
  const expected = row.expected_count ?? 0;
  const scanned = row.scanned_count ?? 0;

  return (
    <span className="text-[10px] font-bold text-slate-700 tabular-nums">
      {scanned} / {expected}
    </span>
  );
}

function scoreBadgeClass(n) {
  if (!Number.isFinite(n)) return "bg-slate-100 text-slate-500 border-slate-200";
  if (n >= 100) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (n >= 80) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

function renderLocationScoreCell(row) {
  if (!isLocationSubmittedRow(row)) {
    return <span className="text-[10px] text-slate-400">After submit</span>;
  }
  const n = Number(row.score_pct);
  if (!Number.isFinite(n)) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-black tabular-nums border ${scoreBadgeClass(n)}`}>
      {formatLocationScorePct(n)}
    </span>
  );
}

function renderAuditBatchScoreCell(audit) {
  const batch = computeAuditBatchScore(audit);
  if (!batch) {
    return <span className="text-[10px] text-slate-400">Pending</span>;
  }
  const n = Number(batch.score_pct);
  const partial = batch.scored_location_count < batch.location_count;
  return (
    <div className="flex flex-col items-start gap-0.5" title={`${batch.scored_location_count} of ${batch.location_count} locations scored`}>
      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-black tabular-nums border ${scoreBadgeClass(n)}`}>
        {formatLocationScorePct(n)}
      </span>
      {partial ? (
        <span className="text-[8px] font-bold text-slate-400 tabular-nums">
          {batch.scored_location_count}/{batch.location_count} loc
        </span>
      ) : (
        <span className="text-[8px] font-bold text-slate-400 tabular-nums">{batch.location_count} loc</span>
      )}
    </div>
  );
}

export default function AuditPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("audit", "view"), [canAccess]);
  const authorizeAccess = useMemo(() => canAccess("audit", "authorize"), [canAccess]);
  const editAccess = useMemo(() => canAccess("audit", "edit"), [canAccess]);
  const currentUser = useSelector(selectUser);
  const currentRole = useSelector(selectRole);

  const isSuperAdmin = useMemo(() => {
    return currentRole?.toLowerCase() === "super_admin";
  }, [currentRole]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [pageTab, setPageTab] = useState(PAGE_TABS.LOCATION);
  const isLocationView = pageTab === PAGE_TABS.LOCATION;

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    authorization: "all",
    locationAuditFilter: "all",
    locationUserFilter: "all",
    locationStatusFilter: "pending",
    sortKey: "audit_id",
    sortDir: "desc",
  });

  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [executionAudit, setExecutionAudit] = useState(null);
  const [executionLocationRow, setExecutionLocationRow] = useState(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonContext, setComparisonContext] = useState(null);
  const [reopening, setReopening] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const locationUserFilterInitialized = useRef(false);

  const canViewAudit = viewAccess?.allowed;
  const canManageAudit = Boolean(editAccess?.allowed || authorizeAccess?.allowed);
  const defaultLocationUserFilter = getDefaultLocationUserFilter(currentUser?.id, isSuperAdmin);
  const canFilterAllAuditUsers = isSuperAdmin || canManageAudit;

  const openLocationComparison = useCallback((row) => {
    if (!row) return;
    if (!canViewAudit) {
      toast.error("Audit view permission is required to open comparison");
      return;
    }
    if (!isLocationSubmittedRow(row)) {
      toast.info("Submit the location first — comparison is available after submit");
      return;
    }
    setComparisonContext({
      auditId: row.audit_id,
      auditLabel: `Audit #${row.audit_id} | ${row.location_no}`,
      locationRow: row,
    });
    setComparisonOpen(true);
  }, [canViewAudit]);

  const loadExecutionAudit = useCallback(async (auditId) => {
    if (!auditId) return null;
    try {
      const res = await auditService.getById(auditId);
      const row = res?.data ?? null;
      if (row) setExecutionAudit(row);
      return row;
    } catch (err) {
      toast.error(err?.message || "Failed to load audit details");
      return null;
    }
  }, []);

  const locationExecutionContext = useMemo(
    () => ({ userId: currentUser?.id, role: currentRole }),
    [currentUser?.id, currentRole]
  );

  const openAuditExecution = useCallback(
    async (locationRow) => {
      if (!locationRow) return;
      if (!canExecuteAuditLocationRow(locationRow, locationExecutionContext)) {
        toast.info("You can start only your assigned location within the audit date range");
        return;
      }
      setSelected(locationRow.row_id);
      setExecutionLocationRow(locationRow);
      const row = await loadExecutionAudit(locationRow.audit_id);
      if (row) {
        setExecutionOpen(true);
      } else {
        setExecutionLocationRow(null);
      }
    },
    [loadExecutionAudit, locationExecutionContext]
  );

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || "audit_id",
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.status !== "all" && { status: params.status }),
          ...(params.authorization === "pending" && { approved: false }),
          ...(params.authorization === "authorized" && { approved: true }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await auditService.getAll({ ...base, page, limit });
        const list = body.data?.data ?? body.data ?? [];
        return { data: Array.isArray(list) ? list : [], total: body.data?.total ?? body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
      return data;
    } catch (err) {
      toast.error(err?.message || "Failed to load audits");
      setAllRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.status, params.authorization]);

  const buildFilteredLocationRows = useCallback(
    (audits = allRows) => {
      const flat = flattenAuditLocations(audits, {
        userId: currentUser?.id,
        isSuperAdmin,
        canManageAudit,
      });
      return filterLocationListRows(
        flat,
        {
          locationAuditFilter: params.locationAuditFilter,
          locationUserFilter: params.locationUserFilter,
          locationStatusFilter: params.locationStatusFilter,
          search: tempSearch,
        },
        applyClientSearch
      );
    },
    [
      allRows,
      currentUser?.id,
      isSuperAdmin,
      canManageAudit,
      params.locationAuditFilter,
      params.locationUserFilter,
      params.locationStatusFilter,
      tempSearch,
    ]
  );

  const advanceToNextExecutableLocation = useCallback(
    async (completedRowId = null) => {
      const data = await fetchAudits();
      const rows = filterLocationListRows(
        flattenAuditLocations(data, {
          userId: currentUser?.id,
          isSuperAdmin,
          canManageAudit,
        }),
        {
          locationAuditFilter: params.locationAuditFilter,
          locationUserFilter: params.locationUserFilter,
          locationStatusFilter: params.locationStatusFilter,
          search: tempSearch,
        },
        applyClientSearch
      );
      const nextRow = findNextExecutableLocationRow(rows, locationExecutionContext, {
        excludeRowId: completedRowId,
      });
      if (nextRow) {
        await openAuditExecution(nextRow);
        return true;
      }
      setSelected(null);
      setExecutionOpen(false);
      setExecutionAudit(null);
      setExecutionLocationRow(null);
      return false;
    },
    [
      fetchAudits,
      currentUser?.id,
      isSuperAdmin,
      canManageAudit,
      params.locationAuditFilter,
      params.locationUserFilter,
      params.locationStatusFilter,
      tempSearch,
      locationExecutionContext,
      openAuditExecution,
    ]
  );

  const handleReopenLocation = async () => {
    if (!selectedLocationRow) return;
    const label = selectedLocationRow.location_no || "location";
    if (!window.confirm(`Reopen ${label}? The assigned user will be able to scan again.`)) return;

    setReopening(true);
    try {
      const res = await auditService.reopenLocation({
        audit_id: selectedLocationRow.audit_id,
        location_id: selectedLocationRow.location_id,
      });
      if (res?.success) {
        toast.success(res.message || "Location reopened");
        await fetchAudits();
      } else {
        toast.error(res?.message || "Failed to reopen location");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to reopen location");
    } finally {
      setReopening(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  useEffect(() => {
    if (locationUserFilterInitialized.current) return;
    if (!isSuperAdmin && currentUser?.id == null) return;
    locationUserFilterInitialized.current = true;
    setParams((prev) => ({
      ...prev,
      locationUserFilter: getDefaultLocationUserFilter(currentUser?.id, isSuperAdmin),
    }));
  }, [currentUser?.id, isSuperAdmin]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) return applyClientSearch(allRows, tempSearch);
    return [...allRows];
  }, [allRows, tempSearch]);

  const locationUserFilterOptions = useMemo(() => {
    const byId = new Map();

    for (const audit of allRows) {
      for (const user of getAuditPlanUsers(audit)) {
        if (!byId.has(user.user_id)) byId.set(user.user_id, user.user_name);
      }
    }

    const options = [];
    const myId = currentUser?.id != null ? Number(currentUser.id) : null;

    if (canFilterAllAuditUsers) {
      options.push({ label: "All Users", value: "all" });
    }

    if (myId != null && !isSuperAdmin) {
      const meName = byId.get(myId) || currentUser?.name || `User #${myId}`;
      options.push({ label: meName, value: String(myId) });
    }

    if (canFilterAllAuditUsers) {
      [...byId.entries()]
        .filter(([id]) => myId == null || Number(id) !== myId)
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
        .forEach(([id, name]) => {
          options.push({ label: name, value: String(id) });
        });
    }

    return options.length ? options : [{ label: "All Users", value: "all" }];
  }, [allRows, currentUser?.id, currentUser?.name, canFilterAllAuditUsers, isSuperAdmin]);

  const locationAuditFilterOptions = useMemo(() => {
    const ids = new Set();

    for (const audit of allRows) {
      const seeAllForAudit = canSeeAllAuditLocations(
        audit,
        currentUser?.id,
        isSuperAdmin,
        canManageAudit
      );
      const locRows = (audit.locations || []).flatMap((loc) =>
        expandLocationAssignmentRows(audit, loc, { seeAllForAudit, userId: currentUser?.id })
      );
      if (locRows.length > 0) {
        ids.add(audit.audit_id);
      }
    }

    const options = [{ label: "All", value: "all" }];
    [...ids]
      .sort((a, b) => b - a)
      .forEach((id) => {
        options.push({ label: `#${id}`, value: String(id) });
      });

    return options;
  }, [allRows, currentUser?.id, isSuperAdmin, canManageAudit]);

  const filteredLocationRows = useMemo(
    () => buildFilteredLocationRows(),
    [buildFilteredLocationRows]
  );

  const activeRows = isLocationView ? filteredLocationRows : filteredRows;
  const items = useMemo(() => activeRows.slice(0, displayLimit), [activeRows, displayLimit]);
  const totalItems = activeRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      status: data.auditStatus ?? prev.status,
      authorization: data.authorization ?? prev.authorization,
      locationAuditFilter: data.locationAudit ?? prev.locationAuditFilter,
      locationUserFilter: data.locationUser ?? prev.locationUserFilter,
      locationStatusFilter: data.locationStatus ?? prev.locationStatusFilter,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      pageSize: 1000,
      status: "all",
      authorization: "all",
      locationAuditFilter: "all",
      locationUserFilter: defaultLocationUserFilter,
      locationStatusFilter: "pending",
      sortKey: "audit_id",
      sortDir: "desc",
    });
  };

  const extraFilters = useMemo(() => {
    if (isLocationView) {
      return [
        {
          label: "Audit ID",
          key: "locationAudit",
          value: params.locationAuditFilter,
          options: locationAuditFilterOptions,
        },
        {
          label: "User",
          key: "locationUser",
          value: params.locationUserFilter,
          options: locationUserFilterOptions,
        },
        {
          label: "Status",
          key: "locationStatus",
          value: params.locationStatusFilter,
          options: [
            { label: "Pending / Draft", value: "pending" },
            { label: "Complete", value: "complete" },
            { label: "Difference", value: "difference" },
            { label: "All", value: "all" },
          ],
        },
      ];
    }

    return [
      {
        label: "Status",
        key: "auditStatus",
        value: params.status,
        options: [
          { label: "All", value: "all" },
          { label: "Pending", value: "pending" },
          { label: "In Progress", value: "in_progress" },
          { label: "Approved", value: "verified" },
        ],
      },
    ];
  }, [
    isLocationView,
    params.status,
    params.locationAuditFilter,
    params.locationUserFilter,
    params.locationStatusFilter,
    locationAuditFilterOptions,
    locationUserFilterOptions,
  ]);

  const selectedAuditId = useMemo(() => {
    if (!selected) return null;
    if (isLocationView) {
      const row = filteredLocationRows.find((r) => r.row_id === selected);
      return row?.audit_id ?? null;
    }
    return selected;
  }, [selected, isLocationView, filteredLocationRows]);

  const selectedRecord = useMemo(
    () => allRows.find((u) => u.audit_id === selectedAuditId),
    [allRows, selectedAuditId]
  );

  const selectedLocationRow = useMemo(
    () => (isLocationView ? filteredLocationRows.find((r) => r.row_id === selected) : null),
    [isLocationView, filteredLocationRows, selected]
  );

  const getSelectedRow = useCallback(() => selectedRecord ?? null, [selectedRecord]);

  const handleTabChange = useCallback((tab) => {
    setPageTab(tab);
    setSelected(null);
    setTempSearch("");
    setDisplayLimit(100);
    if (tab === PAGE_TABS.LOCATION) {
      setParams((prev) => ({
        ...prev,
        locationUserFilter: defaultLocationUserFilter,
      }));
    }
  }, [defaultLocationUserFilter]);

  const { openNewModal, openEditModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "audit",
    modalOpen: modalOpen || executionOpen || comparisonOpen || reassignOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      if (row?.approved) {
        toast.error("Active audits cannot be edited. Delete and recreate if changes are needed.");
        return;
      }
      setEditItem(row);
      setModalMode("edit");
      setModalOpen(true);
    }, []),
    openDelete: useCallback((row) => {
      setDeleteItem(row);
    }, []),
    canDeleteSelection: useCallback(() => !!selectedAuditId, [selectedAuditId]),
  });

  const HEADERS = [
    ["Audit ID", "audit_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">#{v}</span>, { width: "80px" }],
    ["Assigned Users", "assigned_user_names", (v, row) => (
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
          <User size={12} />
        </div>
        <span className="font-bold text-slate-800 text-[11px] leading-snug whitespace-normal break-words">
          {v || getAssignedUsersLabel(row)}
        </span>
      </div>
    ), {
      width: "200px",
      wrap: true,
      copyValue: (item) => getAssignedUsersLabel(item),
    }],
    ["Date Range", "start_date", (v, row) => (
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-bold text-slate-700">{formatDate(row.start_date)} — {formatDate(row.end_date)}</span>
      </div>
    ), {
      width: "180px",
      copyValue: (item) =>
        `${formatDate(item.start_date)} — ${formatDate(item.end_date)}`,
    }],
    ["Locations", "locations", (v) => (
      <div className="flex flex-wrap gap-1 py-1">
        {v?.map(loc => (
          <span key={loc.location_id} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getLocationStatusBadgeClass(loc.status)}`}>
            {loc.location_no}
          </span>
        ))}
      </div>
    ), {
      width: "250px",
      wrap: true,
      copyValue: (item) => {
        const locs = Array.isArray(item.locations) ? item.locations : [];
        const names = locs.map((loc) => loc?.location_no).filter(Boolean);
        return names.length ? names.join(", ") : "—";
      },
    }],
    ["Status", "status", (v) => renderAuditExecutionStatusBadge(v), {
      width: "130px",
      copyValue: (item) => getAuditExecutionStatusLabel(item.status),
    }],
    [
      "Score",
      "audit_batch_score",
      (v, row) => renderAuditBatchScoreCell(row),
      {
        width: "90px",
        copyValue: (item) => {
          const batch = computeAuditBatchScore(item);
          return batch ? formatLocationScorePct(batch.score_pct) : "Pending";
        },
      },
    ],
    ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 italic whitespace-normal break-words leading-tight">{v || "—"}</span>, { width: "180px", wrap: true }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const LOCATION_HEADERS = useMemo(() => [
    ["Location", "location_no", (v, row) => {
      const submitted = isLocationSubmittedRow(row);
      const canOpen = submitted && canViewAudit;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (canOpen) openLocationComparison(row);
          }}
          disabled={!canOpen}
          className={`flex items-center gap-2 text-left group ${canOpen ? "cursor-pointer" : "cursor-default"}`}
          title={
            !canViewAudit
              ? "View permission required"
              : submitted
                ? "Click — comparison report"
                : "Comparison available after submit"
          }
        >
          <MapPin size={12} className={`shrink-0 ${canOpen ? "text-indigo-500 group-hover:text-indigo-700" : "text-slate-400"}`} />
          <span className={`font-black uppercase text-[11px] ${canOpen ? "text-slate-800 group-hover:text-indigo-700 group-hover:underline" : row.is_history_row ? "text-slate-500" : "text-slate-600"}`}>
            {v || "—"}
          </span>
          {row.is_history_row && (
            <span className="px-1 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
              Prev
            </span>
          )}
        </button>
      );
    }, { width: "120px" }],
    ["Audit ID", "audit_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">#{v}</span>, { width: "80px" }],
    ["Users", "assigned_user_name", (v, row) => renderLocationUsersCell(row), {
      width: "200px",
      wrap: true,
      copyValue: (item) => item.users_label || item.assigned_user_name,
    }],
    ["Boxes", "expected_count", (v, row) => renderLocationBoxesCell(row), {
      width: "130px",
      wrap: true,
      copyValue: (item) => `${item.scanned_count ?? 0} / ${item.expected_count ?? 0}`,
    }],
    ["Score", "score_pct", (v, row) => renderLocationScoreCell(row), {
      width: "80px",
      copyValue: (item) =>
        isLocationSubmittedRow(item) ? formatLocationScorePct(item.score_pct) : "—",
    }],
    ["Difference", "difference_boxes", (v, row) => {
      const submitted = isLocationSubmittedRow(row);
      const canOpen = submitted && canViewAudit;
      if (!submitted) {
        return <span className="text-[10px] text-slate-400 italic">After submit</span>;
      }
      const missing = Array.isArray(row.missing_boxes) ? row.missing_boxes : [];
      const extra = Array.isArray(row.extra_boxes) ? row.extra_boxes : [];
      const boxes = Array.isArray(v) && v.length ? v : [...missing, ...extra];
      const inner = !boxes.length ? (
        <span className="text-[10px] text-emerald-600 font-bold">All matched</span>
      ) : (
        <div className="flex flex-wrap gap-0.5 max-w-[220px] py-0.5">
          {missing.map((uid) => (
            <span
              key={`m-${uid}`}
              className="px-1 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
              title="Missing"
            >
              {uid}
            </span>
          ))}
          {extra.map((uid) => (
            <span
              key={`e-${uid}`}
              className="px-1 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-800 border border-rose-200"
              title="Extra"
            >
              {uid}
            </span>
          ))}
        </div>
      );

      if (!canOpen) return inner;

      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openLocationComparison(row);
          }}
          className="text-left w-full group"
          title="Click — full comparison report"
        >
          <span className="block text-[9px] font-bold text-indigo-500 uppercase mb-0.5 group-hover:underline">
            View comparison
          </span>
          {inner}
        </button>
      );
    }, {
      width: "200px",
      wrap: true,
      copyValue: (item) => {
        if (!isLocationSubmittedRow(item)) return "After submit";
        const missing = Array.isArray(item.missing_boxes) ? item.missing_boxes : [];
        const extra = Array.isArray(item.extra_boxes) ? item.extra_boxes : [];
        const boxes = [...missing, ...extra];
        return boxes.length ? boxes.join(", ") : "All matched";
      },
    }],
    ["Date Range", "start_date", (v, row) => (
      <span className="text-[10px] font-bold text-slate-700">{formatDate(row.start_date)} — {formatDate(row.end_date)}</span>
    ), {
      width: "170px",
      copyValue: (item) =>
        `${formatDate(item.start_date)} — ${formatDate(item.end_date)}`,
    }],
    ["Status", "location_status", (v) => renderLocationStatusBadge(v), {
      width: "110px",
      copyValue: (item) => getLocationStatusLabel(item.location_status),
    }],
    ["Audit result", "result_rejected", (v, row) =>
      isLocationSubmittedRow(row)
        ? renderAuditLocationResultBadge(v ?? false)
        : renderAuditLocationResultBadge(null),
      {
        width: "96px",
        align: "center",
        copyValue: (item) =>
          isLocationSubmittedRow(item) ? getAuditLocationResultLabel(Boolean(item.result_rejected)) : "—",
      },
    ],
    ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 italic whitespace-normal break-words leading-tight">{v || "—"}</span>, { width: "160px", wrap: true }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "140px" }],
  ], [canViewAudit, openLocationComparison]);

  const tableHeaders = isLocationView ? LOCATION_HEADERS : HEADERS;

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isLocationView ? "Audit Locations" : "Audit Master",
    rows: activeRows,
    headers: tableHeaders,
  });

  const canManageLocation = useMemo(() => {
    if (!isLocationView || !selectedLocationRow || !selectedRecord) return false;
    if (selectedLocationRow.is_history_row) return false;
    if (selectedRecord.status === "cancelled") return false;

    const isSuperAdmin = currentRole?.toLowerCase() === "super_admin";
    if (selectedRecord.status === "verified" && !isSuperAdmin) return false;

    const isCreator = Number(selectedRecord.created_by) === Number(currentUser?.id);

    return isSuperAdmin || editAccess?.allowed || authorizeAccess?.allowed || isCreator;
  }, [isLocationView, selectedLocationRow, selectedRecord, currentRole, currentUser?.id, editAccess, authorizeAccess]);

  const canReopenLocation = useMemo(() => {
    if (!canManageLocation || !selectedLocationRow) return false;
    return isLocationClosed({ status: selectedLocationRow.location_status });
  }, [canManageLocation, selectedLocationRow]);

  const canReassignLocation = canManageLocation;

  const nextExecutableLocationRow = useMemo(() => {
    if (!isLocationView) return null;
    return findNextExecutableLocationRow(filteredLocationRows, locationExecutionContext, {
      preferRow: selectedLocationRow,
    });
  }, [isLocationView, filteredLocationRows, locationExecutionContext, selectedLocationRow]);

  const canExecute = Boolean(nextExecutableLocationRow);

  const canViewComparison = useMemo(() => {
    if (!canViewAudit) return false;
    if (isLocationView && selectedLocationRow) {
      return isLocationSubmittedRow(selectedLocationRow);
    }
    if (!selectedRecord || isLocationView) return false;
    return ["submitted", "verified"].includes(selectedRecord.status);
  }, [canViewAudit, isLocationView, selectedLocationRow, selectedRecord]);

  const comparisonCanManage = useMemo(() => {
    const row = comparisonContext?.locationRow;
    if (!row) return false;
    const audit = allRows.find((a) => Number(a.audit_id) === Number(row.audit_id));
    if (!audit || row.is_history_row || audit.status === "cancelled") return false;
    if (audit.status === "verified" && currentRole?.toLowerCase() !== "super_admin") return false;
    const isCreator = Number(audit.created_by) === Number(currentUser?.id);
    return (
      currentRole?.toLowerCase() === "super_admin" ||
      editAccess?.allowed ||
      authorizeAccess?.allowed ||
      isCreator
    );
  }, [comparisonContext, allRows, currentRole, currentUser?.id, editAccess, authorizeAccess]);

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                active={pageTab}
                onChange={handleTabChange}
                tabs={[
                  { id: PAGE_TABS.LOCATION, label: "Location Wise", icon: MapPin },
                  { id: PAGE_TABS.MASTER, label: "Master Wise", icon: ClipboardList },
                ]}
              />
            }
            actions={
              <>
              <ActionButton module="audit" action="authorize" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              <ActionButton 
                module="audit" 
                action="edit" 
                variant="outline" 
                label="Edit" 
                icon={Edit3} 
                disabled={
                  !selected ||
                  selectedRecord?.approved ||
                  (selectedRecord?.status === "verified" && currentRole?.toLowerCase() !== "super_admin")
                }
                title={
                  selectedRecord?.approved
                    ? "Active audits cannot be edited. Delete and recreate if changes are needed."
                    : undefined
                }
                record={selectedRecord} 
                onClick={openEditModal} 
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none" 
              />
              
              <ActionButton 
                module="audit" 
                action="add" 
                variant="primary" 
                label="Start Audit" 
                icon={Play} 
                disabled={!isLocationView || !canExecute} 
                onClick={() => {
                  if (!nextExecutableLocationRow) {
                    toast.info("No location available to start for today");
                    return;
                  }
                  openAuditExecution(nextExecutableLocationRow);
                }} 
                className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none bg-indigo-600 hover:bg-indigo-700" 
              />

              {isLocationView && canReopenLocation && (
                <button
                  type="button"
                  disabled={!selected || reopening}
                  onClick={handleReopenLocation}
                  className="h-9 px-4 border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none"
                >
                  {reopening ? <RefreshCcw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  {reopening ? "Reopening..." : "Reopen"}
                </button>
              )}

              {isLocationView && canReassignLocation && (
                <button
                  type="button"
                  disabled={!selected}
                  onClick={() => setReassignOpen(true)}
                  className="h-9 px-4 border border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none"
                >
                  <UserRoundCog size={14} />
                  Reassign
                </button>
              )}

              <ActionButton
                module="audit"
                action="view"
                variant="outline"
                label="Comparison"
                icon={GitCompare}
                disabled={!selected || !canViewComparison}
                onClick={() => {
                  if (!selectedRecord) return;
                  if (isLocationView && selectedLocationRow) {
                    openLocationComparison(selectedLocationRow);
                    return;
                  }
                  setComparisonContext({
                    auditId: selectedRecord.audit_id,
                    auditLabel: `Audit #${selectedRecord.audit_id} | ${getAssignedUsersLabel(selectedRecord)}`,
                    locationRow: null,
                  });
                  setComparisonOpen(true);
                }}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-indigo-600 shadow-none"
              />

              <ActionButton 
                module="audit" 
                action="delete" 
                variant="danger" 
                label="Delete" 
                icon={Trash2} 
                disabled={!selected || (selectedRecord?.status === 'verified' && currentRole?.toLowerCase() !== 'super_admin')} 
                onClick={() => setDeleteItem(selectedRecord)} 
                className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" 
              />
              
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              
              <button onClick={() => fetchAudits()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || exportDisabled}
                onExport={handleExport}
              />
            }
          />

          {selected && selectedRecord && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 whitespace-normal break-words leading-snug text-left">
                <Info size={12} className="shrink-0" />
                <span>
                  {isLocationView && selectedLocationRow
                    ? `#${selectedRecord?.audit_id} | ${selectedLocationRow.location_no}${selectedLocationRow.is_history_row ? " (Previous)" : ""} | ${selectedLocationRow.assigned_user_name} | ${selectedLocationRow.scanned_count}/${selectedLocationRow.expected_count} | ${getLocationStatusLabel(selectedLocationRow.location_status)}`
                    : `#${selectedRecord?.audit_id} | ${getAssignedUsersLabel(selectedRecord)} | ${getAuditExecutionStatusLabel(selectedRecord?.status)}`}
                </span>
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={false}
            applyExtrasOnChange
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder={isLocationView ? "Search location, audit id, person..." : "Search remarks, person..."}
            searchLabel={isLocationView ? "Search Locations" : "Search Audits"}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
            <DataTable
              headers={tableHeaders} data={items} loading={loading}
              viewMode={viewMode} allowCopy={true} {...tableHotkeyProps} showSelection={true}
              emptyIcon={isLocationView ? MapPin : ClipboardCheck} sortKey={params.sortKey ?? ""} sortDir={params.sortDir}
              onSort={(key) => {
                setDisplayLimit(100);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              selectedId={selected} onSelect={setSelected}
              getRowId={(item) => (isLocationView ? item.row_id : item.audit_id)}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={
                isLocationView
                  ? {
                      titleKey: "location_no",
                      badgeIndices: [6],
                      detailIndices: [1, 2, 3, 4, 7],
                      footerKey: "created_at",
                      className: "rounded-none border border-slate-200 shadow-none",
                    }
                  : {
                      titleKey: "audit_id",
                      badgeIndices: [4],
                      detailIndices: [1, 2, 3, 5],
                      footerKey: "created_at",
                      className: "rounded-none border border-slate-200 shadow-none",
                    }
              }
            />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} {isLocationView ? "Locations" : "Audits"}
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <AuditModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={() => { fetchAudits(); setSelected(null); }} editData={editItem} mode={modalMode} />
      )}
      
      {executionOpen && executionAudit && executionLocationRow && (
        <AuditExecutionModal 
          open={executionOpen} 
          onClose={() => {
            setExecutionOpen(false);
            setExecutionAudit(null);
            setExecutionLocationRow(null);
          }} 
          onSuccess={async (keepOpen) => { 
            if (keepOpen && executionLocationRow?.audit_id) {
              await fetchAudits();
              await loadExecutionAudit(executionLocationRow.audit_id);
              return;
            }
            const completedRowId = executionLocationRow?.row_id ?? null;
            setExecutionOpen(false);
            setExecutionAudit(null);
            setExecutionLocationRow(null);
            const advanced = await advanceToNextExecutableLocation(completedRowId);
            if (!advanced) {
              toast.info("No more locations to start for today");
            }
          }} 
          auditData={executionAudit}
          fixedLocationId={executionLocationRow.location_id}
        />
      )}

      {comparisonOpen && comparisonContext && (
        <AuditComparisonModal
          open={comparisonOpen}
          onClose={() => {
            setComparisonOpen(false);
            setComparisonContext(null);
          }}
          onSuccess={() => fetchAudits()}
          auditId={comparisonContext.auditId}
          auditLabel={comparisonContext.auditLabel}
          locationRow={comparisonContext.locationRow}
          canManage={comparisonCanManage}
        />
      )}

      {reassignOpen && selectedLocationRow && (
        <AuditReassignModal
          open={reassignOpen}
          onClose={() => setReassignOpen(false)}
          onSuccess={() => fetchAudits()}
          locationRow={selectedLocationRow}
        />
      )}

      {deleteItem && (
        <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { fetchAudits(); setSelected(null); }} service={auditService} entityLabel="Audit" idKey="audit_id" moduleSlug="audit" />
      )}
    </div>
  );
}
