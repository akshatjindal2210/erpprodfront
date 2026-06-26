"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Plus, ClipboardCheck, RefreshCcw, Edit3, Trash2, X, Info, Play, MapPin, GitCompare, ClipboardList, RotateCcw, UserRoundCog } from "lucide-react";
import { toast } from "react-toastify";

import { auditService } from "@/features/apps/ims/services/audit";
import { useViewMode } from "@/core/hooks/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import { MasterListFooter, MasterRefreshButton } from "@/features/apps/ims/helpers/masterListUi";

import ActionButton from "@/core/components/ui/ActionButton";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import DeleteModal from "@/core/components/common/DeleteModal";
import DataTable from "@/core/components/ui/DataTable";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ImsSegmentedTabs from "@/features/apps/ims/components/common/ImsSegmentedTabs";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey, nextSortParams } from "@/features/apps/ims/helpers/clientListSearch";
import { useAppliedListSearch } from "@/features/apps/ims/helpers/useAppliedListSearch";
import { useSelector } from "react-redux";
import { selectUser, selectRole } from "@/core/store/slices/authSlice";
import { getAuditExecutionStatusLabel } from "./auditStatusHelpers";
import { isLocationClosed, getLocationStatusLabel, isLocationSubmittedRow, canExecuteAuditLocationRow, findNextExecutableLocationRow } from "./auditScanHelpers";
import {
  getAssignedUsersLabel,
  getDefaultLocationUserFilter,
  flattenAuditLocations,
  filterAuditLocationRows,
  buildLocationUserFilterOptions,
  buildLocationAuditFilterOptions,
  indexAuditsById,
  indexLocationRowsById,
  auditMasterSearchParts,
  auditLocationSearchParts,
  buildAuditApiFilters,
} from "./auditListHelpers";
import { AUDIT_MASTER_HEADERS, buildAuditLocationHeaders } from "./auditColumns";

const AuditModal = dynamic(() => import("./AuditModal"), { ssr: false });
const AuditExecutionModal = dynamic(() => import("./AuditExecutionModal"), { ssr: false });
const AuditComparisonModal = dynamic(() => import("./AuditComparisonModal"), { ssr: false });
const AuditReassignModal = dynamic(() => import("./AuditReassignModal"), { ssr: false });

const PAGE_TABS = {
  LOCATION: "location",
  MASTER: "master",
};

const LIST_PAGE_SIZE = 1000;
const DISPLAY_CHUNK = 100;

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
    pageSize: LIST_PAGE_SIZE,
    status: "all",
    authorization: "all",
    locationAuditFilter: "all",
    locationUserFilter: "all",
    locationStatusFilter: "pending",
    sortKey: "audit_id",
    sortDir: "desc",
  });

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_CHUNK);
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
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await auditService.getAll({
          page,
          limit,
          ...(appliedSearch && { search: appliedSearch }),
          filters: buildAuditApiFilters(params),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(DISPLAY_CHUNK);
      return data;
    } catch (err) {
      toast.error(err?.message || "Failed to load audits");
      setAllRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.status, params.authorization, appliedSearch]);

  const flattenContext = useMemo(
    () => ({ userId: currentUser?.id, isSuperAdmin, canManageAudit }),
    [currentUser?.id, isSuperAdmin, canManageAudit]
  );

  const locationListFilters = useMemo(
    () => ({
      locationAuditFilter: params.locationAuditFilter,
      locationUserFilter: params.locationUserFilter,
      locationStatusFilter: params.locationStatusFilter,
    }),
    [params.locationAuditFilter, params.locationUserFilter, params.locationStatusFilter]
  );

  const filterLocationRowsWithSearch = useCallback(
    (rows) => {
      let filtered = filterAuditLocationRows(rows, locationListFilters);
      const q = String(tempSearch || "").trim();
    if (q) {
      filtered = applyClientSearch(filtered, tempSearch, {
        getParts: (row) => auditLocationSearchParts(row),
        skipSort: !!params.sortKey,
      });
    }
    return filtered;
    },
    [locationListFilters, tempSearch, params.sortKey]
  );

  const flattenedLocationRows = useMemo(
    () => flattenAuditLocations(allRows, flattenContext),
    [allRows, flattenContext]
  );

  const auditById = useMemo(() => indexAuditsById(allRows), [allRows]);

  const advanceToNextExecutableLocation = useCallback(
    async (completedRowId = null) => {
      const data = await fetchAudits();
      const rows = filterLocationRowsWithSearch(flattenAuditLocations(data, flattenContext));
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
    [fetchAudits, flattenContext, filterLocationRowsWithSearch, locationExecutionContext, openAuditExecution]
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
    let data = allRows;
    if (q) {
      data = applyClientSearch(allRows, tempSearch, {
        getParts: (row) => auditMasterSearchParts(row),
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey || "audit_id", params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  useEffect(() => {
    setDisplayLimit(DISPLAY_CHUNK);
  }, [tempSearch, pageTab]);

  const locationUserFilterOptions = useMemo(
    () =>
      buildLocationUserFilterOptions(allRows, {
        currentUser,
        isSuperAdmin,
        canFilterAllAuditUsers,
      }),
    [allRows, currentUser, isSuperAdmin, canFilterAllAuditUsers]
  );

  const locationAuditFilterOptions = useMemo(
    () => buildLocationAuditFilterOptions(flattenedLocationRows),
    [flattenedLocationRows]
  );

  const filteredLocationRows = useMemo(() => {
    const filtered = filterLocationRowsWithSearch(flattenedLocationRows);
    return sortRowsByKey(filtered, params.sortKey || "audit_id", params.sortDir);
  }, [flattenedLocationRows, filterLocationRowsWithSearch, params.sortKey, params.sortDir]);

  const locationRowById = useMemo(
    () => indexLocationRowsById(filteredLocationRows),
    [filteredLocationRows]
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
    applySearchFromInput();
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
    resetSearch();
    setParams({
      pageSize: LIST_PAGE_SIZE,
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
      return locationRowById.get(selected)?.audit_id ?? null;
    }
    return selected;
  }, [selected, isLocationView, locationRowById]);

  const selectedRecord = useMemo(
    () => (selectedAuditId != null ? auditById.get(selectedAuditId) ?? null : null),
    [auditById, selectedAuditId]
  );

  const selectedLocationRow = useMemo(
    () => (isLocationView && selected ? locationRowById.get(selected) ?? null : null),
    [isLocationView, selected, locationRowById]
  );

  const getSelectedRow = useCallback(() => selectedRecord ?? null, [selectedRecord]);

  const handleTabChange = useCallback((tab) => {
    setPageTab(tab);
    setSelected(null);
    resetSearch();
    setDisplayLimit(DISPLAY_CHUNK);
    if (tab === PAGE_TABS.LOCATION) {
      setParams((prev) => ({
        ...prev,
        locationUserFilter: defaultLocationUserFilter,
      }));
    }
  }, [defaultLocationUserFilter, resetSearch]);

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

  const LOCATION_HEADERS = useMemo(
    () => buildAuditLocationHeaders({ canViewAudit, openLocationComparison }),
    [canViewAudit, openLocationComparison]
  );

  const tableHeaders = isLocationView ? LOCATION_HEADERS : AUDIT_MASTER_HEADERS;

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
    const audit = auditById.get(Number(row.audit_id));
    if (!audit || row.is_history_row || audit.status === "cancelled") return false;
    if (audit.status === "verified" && currentRole?.toLowerCase() !== "super_admin") return false;
    const isCreator = Number(audit.created_by) === Number(currentUser?.id);
    return (
      currentRole?.toLowerCase() === "super_admin" ||
      editAccess?.allowed ||
      authorizeAccess?.allowed ||
      isCreator
    );
  }, [comparisonContext, auditById, currentRole, currentUser?.id, editAccess, authorizeAccess]);

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
              
              <MasterRefreshButton loading={loading} onClick={fetchAudits} />
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
            onSearchEnter={() =>
              handleFilterApply({
                auditStatus: params.status,
                authorization: params.authorization,
                locationAudit: params.locationAuditFilter,
                locationUser: params.locationUserFilter,
                locationStatus: params.locationStatusFilter,
              })
            }
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
                setDisplayLimit(DISPLAY_CHUNK);
                setParams((p) => nextSortParams(p, key));
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

        <MasterListFooter
          shown={items.length}
          total={totalItems}
          noun={isLocationView ? "Locations" : "Audits"}
        />
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
