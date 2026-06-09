"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, ClipboardCheck, RefreshCcw, Edit3, Trash2, X, Info, Play, User, MapPin, GitCompare, ClipboardList, RotateCcw, UserRoundCog } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime, formatDate } from "@/core/utils/utilHelper";
import { auditService } from "@/features/apps/ims/services/audit";
import { useViewMode } from "@/core/hooks/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";

// Components
import ActionButton from "@/core/components/ui/ActionButton";
import ViewToggle from "@/core/components/ui/ViewToggle";
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
import { getAuditExecutionStatusLabel, renderAuditExecutionStatusBadge, canStartAuditExecution } from "./auditStatusHelpers";
import { isLocationEditable, isLocationClosed, getLocationStatusLabel, getLocationStatusBadgeClass, matchesLocationStatusFilter, expandLocationAssignmentRows, isLocationSubmittedRow, getAuditPlanUsers, formatAuditParticipantNames } from "./auditScanHelpers";

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
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonContext, setComparisonContext] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const canViewAudit = viewAccess?.allowed;
  const canManageAudit = Boolean(
    viewAccess?.allowed || editAccess?.allowed || authorizeAccess?.allowed
  );

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
    } catch (err) {
      toast.error(err?.message || "Failed to load audits");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.status, params.authorization]);

  const handleVerify = async (id) => {
    if (!window.confirm("Are you sure you want to finalize this audit? Only Super Admin can change it after this.")) return;
    setVerifying(true);
    try {
      const res = await auditService.verify(id);
      if (res.success) {
        toast.success(res.message || "Audit completed successfully");
        fetchAudits();
        setSelected(null);
      } else {
        toast.error(res.message || "Failed to complete audit");
      }
    } catch (err) {
      toast.error(err.message || "Error completing audit");
    } finally {
      setVerifying(false);
    }
  };

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

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) return applyClientSearch(allRows, tempSearch);
    return [...allRows];
  }, [allRows, tempSearch]);

  const locationRows = useMemo(
    () => flattenAuditLocations(allRows, { userId: currentUser?.id, isSuperAdmin, canManageAudit }),
    [allRows, currentUser?.id, isSuperAdmin, canManageAudit]
  );

  const locationUserFilterOptions = useMemo(() => {
    const byId = new Map();

    for (const audit of allRows) {
      for (const user of getAuditPlanUsers(audit)) {
        if (!byId.has(user.user_id)) byId.set(user.user_id, user.user_name);
      }
    }

    const options = [{ label: "All Users", value: "all" }];
    [...byId.entries()]
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
      .forEach(([id, name]) => {
        options.push({ label: name, value: String(id) });
      });

    return options;
  }, [allRows]);

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

  const filteredLocationRows = useMemo(() => {
    let rows = [...locationRows];

    if (params.locationAuditFilter !== "all") {
      const auditId = Number(params.locationAuditFilter);
      rows = rows.filter((r) => r.audit_id === auditId);
    }

    if (params.locationUserFilter !== "all") {
      const filterUserId = Number(params.locationUserFilter);
      rows = rows.filter((r) => Number(r.assigned_user_id) === filterUserId);
    }

    if (params.locationStatusFilter !== "all") {
      rows = rows.filter((r) =>
        matchesLocationStatusFilter(r.location_status, params.locationStatusFilter)
      );
    }

    const q = String(tempSearch || "").trim();
    if (q) return applyClientSearch(rows, tempSearch);
    return rows;
  }, [locationRows, params.locationAuditFilter, params.locationUserFilter, params.locationStatusFilter, tempSearch]);

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
      locationUserFilter: "all",
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
  }, []);

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
    ), { width: "180px" }],
    ["Locations", "locations", (v) => (
      <div className="flex flex-wrap gap-1 py-1">
        {v?.map(loc => (
          <span key={loc.location_id} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getLocationStatusBadgeClass(loc.status)}`}>
            {loc.location_no}
          </span>
        ))}
      </div>
    ), { width: "250px", wrap: true }],
    ["Status", "status", (v) => renderAuditExecutionStatusBadge(v), {
      width: "130px",
      copyValue: (item) => getAuditExecutionStatusLabel(item.status),
    }],
    ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 italic whitespace-normal break-words leading-tight">{v || "—"}</span>, { width: "180px", wrap: true }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const LOCATION_HEADERS = [
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
    ["Boxes", "expected_count", (v, row) => renderLocationBoxesCell(row), { width: "130px", wrap: true }],
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
              title="Not scanned"
            >
              {uid}
            </span>
          ))}
          {extra.map((uid) => (
            <span
              key={`e-${uid}`}
              className="px-1 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-800 border border-rose-200"
              title="Extra scan"
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
    }, { width: "200px", wrap: true }],
    ["Date Range", "start_date", (v, row) => (
      <span className="text-[10px] font-bold text-slate-700">{formatDate(row.start_date)} — {formatDate(row.end_date)}</span>
    ), { width: "170px" }],
    ["Status", "location_status", (v) => renderLocationStatusBadge(v), {
      width: "110px",
      copyValue: (item) => getLocationStatusLabel(item.location_status),
    }],
    ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 italic whitespace-normal break-words leading-tight">{v || "—"}</span>, { width: "160px", wrap: true }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "140px" }],
  ];

  const tableHeaders = isLocationView ? LOCATION_HEADERS : HEADERS;

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

  const canExecute = useMemo(() => {
    if (!isLocationView || !selectedLocationRow || !selectedRecord) return false;
    if (selectedLocationRow.is_history_row) return false;

    if (!isLocationEditable({ status: selectedLocationRow.location_status })) return false;
    if (!selectedLocationRow.approved) return false;

    const isAssigned =
      currentRole?.toLowerCase() === "super_admin" ||
      Number(selectedLocationRow.assigned_user_id) === Number(currentUser?.id);
    if (!isAssigned) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const start = new Date(selectedRecord.start_date);
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const end = new Date(selectedRecord.end_date);
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
    const isWithinDateRange = today >= startDate && today <= endDate;

    const isSubmitted = selectedRecord.status === "submitted";
    const isVerified = selectedRecord.status === "verified";

    return canStartAuditExecution(selectedRecord) && !isSubmitted && !isVerified && isWithinDateRange;
  }, [isLocationView, selectedLocationRow, selectedRecord, currentUser, currentRole]);

  const canViewComparison = useMemo(() => {
    if (!canViewAudit) return false;
    if (isLocationView && selectedLocationRow) {
      return isLocationSubmittedRow(selectedLocationRow);
    }
    if (!selectedRecord || isLocationView) return false;
    return ["submitted", "verified"].includes(selectedRecord.status);
  }, [canViewAudit, isLocationView, selectedLocationRow, selectedRecord]);

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
                disabled={!selected || !canExecute} 
                onClick={async () => {
                  if (!isLocationView || !selectedLocationRow) {
                    toast.info("Select your location row on the Location Wise tab, then click Start Audit");
                    return;
                  }
                  const row = await loadExecutionAudit(selectedAuditId);
                  if (row) setExecutionOpen(true);
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

              {currentRole?.toLowerCase() === 'super_admin' && (
                <button 
                  disabled={!selected || selectedRecord?.status !== 'submitted' || verifying}
                  onClick={() => handleVerify(selectedAuditId)}
                  className="h-9 px-4 border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none"
                >
                  {verifying ? <RefreshCcw size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
                  Final Approve
                </button>
              )}

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
            viewToggle={<ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />}
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
      
      {executionOpen && executionAudit && selectedLocationRow && (
        <AuditExecutionModal 
          open={executionOpen} 
          onClose={() => {
            setExecutionOpen(false);
            setExecutionAudit(null);
          }} 
          onSuccess={async (keepOpen) => { 
            await fetchAudits();
            if (keepOpen && selectedAuditId) {
              await loadExecutionAudit(selectedAuditId);
            } else {
              setSelected(null); 
              setExecutionOpen(false);
              setExecutionAudit(null);
            }
          }} 
          auditData={executionAudit}
          fixedLocationId={selectedLocationRow.location_id}
        />
      )}

      {comparisonOpen && comparisonContext && (
        <AuditComparisonModal
          open={comparisonOpen}
          onClose={() => {
            setComparisonOpen(false);
            setComparisonContext(null);
          }}
          auditId={comparisonContext.auditId}
          auditLabel={comparisonContext.auditLabel}
          locationRow={comparisonContext.locationRow}
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
