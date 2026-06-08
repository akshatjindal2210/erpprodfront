"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, ClipboardCheck, RefreshCcw, Edit3, Trash2, CheckCircle, X, Info, Play, Calendar, User, MapPin, GitCompare } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime, formatDate } from "@/core/utils/utilHelper";
import { auditService } from "@/features/apps/ims/services/audit";
import { useViewMode } from "@/core/hooks/useViewMode";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";
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
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages } from "@/features/apps/ims/helpers/clientListSearch";
import { useSelector } from "react-redux";
import { selectUser, selectRole } from "@/core/store/slices/authSlice";
import { getAuditExecutionStatusLabel, getAuthorizationLabel, renderAuditExecutionStatusBadge, renderAuthorizationBadge, canStartAuditExecution } from "./auditStatusHelpers";

export default function AuditPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("audit", "view"), [canAccess]);
  const currentUser = useSelector(selectUser);
  const currentRole = useSelector(selectRole);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    authorization: "all",
    fromDate: null,
    toDate: null,
    sortKey: "audit_id",
    sortDir: "desc",
  });

  useEffect(() => {
    setParams(prev => ({
      ...prev,
      fromDate: null,
      toDate: null
    }));
  }, []);

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
  const [verifying, setVerifying] = useState(false);

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
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
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
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate, params.status, params.authorization]);

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

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) return applyClientSearch(allRows, tempSearch);
    return [...allRows];
  }, [allRows, tempSearch]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.auditStatus ?? prev.status,
      authorization: data.authorization ?? prev.authorization,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      pageSize: 1000,
      status: "all",
      authorization: "all",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "audit_id",
      sortDir: "desc",
    });
  };

  const extraFilters = useMemo(() => [
    {
      label: "Authorization",
      key: "authorization",
      value: params.authorization,
      options: [
        { label: "All", value: "all" },
        { label: "Pending Authorization", value: "pending" },
        { label: "Authorized", value: "authorized" },
      ],
    },
    {
      label: "Audit Status",
      key: "auditStatus",
      value: params.status,
      options: [
        { label: "All Status", value: "all" },
        { label: "Not Started", value: "pending" },
        { label: "In Progress", value: "in_progress" },
        { label: "Submitted", value: "submitted" },
        { label: "Final Approved", value: "verified" },
        { label: "Cancelled", value: "cancelled" },
      ],
    },
  ], [params.status, params.authorization]);

  const selectedRecord = useMemo(() => filteredRows.find((u) => u.audit_id === selected), [filteredRows, selected]);

  const getSelectedRow = useCallback(
    () => filteredRows.find((u) => u.audit_id === selected),
    [filteredRows, selected]
  );

  const { openNewModal, openEditModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "audit",
    modalOpen: modalOpen || executionOpen || comparisonOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      setEditItem(row);
      setModalMode("edit");
      setModalOpen(true);
    }, []),
    openApprove: useCallback((row) => {
      setEditItem(row);
      setModalMode("approve");
      setModalOpen(true);
    }, []),
    canApproveSelection: useCallback(
      () => Boolean(selected && selectedRecord),
      [selected, selectedRecord]
    ),
    onApproveBlocked: useCallback(() => {
      toast.info("Select a row to open approve (Ctrl+A).");
    }, []),
    openDelete: useCallback((row) => {
      setDeleteItem(row);
    }, []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const HEADERS = [
    ["Audit ID", "audit_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">#{v}</span>, { width: "80px" }],
    ["Assigned To", "assigned_user_name", (v) => (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <User size={12} />
        </div>
        <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>
      </div>
    ), { width: "180px" }],
    ["Date Range", "start_date", (v, row) => (
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-bold text-slate-700">{formatDate(row.start_date)} — {formatDate(row.end_date)}</span>
      </div>
    ), { width: "180px" }],
    ["Locations", "locations", (v) => (
      <div className="flex flex-wrap gap-1 py-1">
        {v?.map(loc => (
          <span key={loc.location_id} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${loc.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            {loc.location_no}
          </span>
        ))}
      </div>
    ), { width: "250px", wrap: true }],
    ["Authorization", "approved", (v) => renderAuthorizationBadge(Boolean(v)), {
      width: "150px",
      copyValue: (item) => getAuthorizationLabel(Boolean(item.approved)),
    }],
    ["Audit Status", "status", (v) => renderAuditExecutionStatusBadge(v), {
      width: "130px",
      copyValue: (item) => getAuditExecutionStatusLabel(item.status),
    }],
    ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 italic whitespace-normal break-words leading-tight">{v || "—"}</span>, { width: "180px", wrap: true }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const canExecute = useMemo(() => {
    if (!selectedRecord) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const start = new Date(selectedRecord.start_date);
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();

    const end = new Date(selectedRecord.end_date);
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();

    const isAssigned =
      String(selectedRecord.assigned_user_id) === String(currentUser?.id) ||
      currentRole?.toLowerCase() === "super_admin";

    const isWithinDateRange = today >= startDate && today <= endDate;
    const isSubmitted = selectedRecord.status === "submitted";
    const isVerified = selectedRecord.status === "verified";

    return isAssigned && canStartAuditExecution(selectedRecord) && !isSubmitted && !isVerified && isWithinDateRange;
  }, [selectedRecord, currentUser, currentRole]);

  const canAuthorizeAudit = useMemo(() => {
    if (!selectedRecord) return false;
    if (selectedRecord.approved) return false;
    return !["submitted", "verified"].includes(selectedRecord.status);
  }, [selectedRecord]);

  const canViewComparison = useMemo(() => {
    if (!selectedRecord) return false;
    return ["submitted", "verified"].includes(selectedRecord.status);
  }, [selectedRecord]);

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
              <ActionButton module="audit" action="authorize" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              <ActionButton 
                module="audit" 
                action="edit" 
                variant="outline" 
                label="Edit" 
                icon={Edit3} 
                disabled={!selected || (selectedRecord?.status === 'verified' && currentRole?.toLowerCase() !== 'super_admin')} 
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
                  const row = await loadExecutionAudit(selected);
                  if (row) setExecutionOpen(true);
                }} 
                className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none bg-indigo-600 hover:bg-indigo-700" 
              />

              <ActionButton
                module="audit"
                action="view"
                variant="outline"
                label="Comparison"
                icon={GitCompare}
                disabled={!selected || !canViewComparison}
                onClick={() => setComparisonOpen(true)}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-indigo-600 shadow-none"
              />

              <ActionButton 
                module="audit" 
                action="authorize" 
                variant="outline" 
                label="Approve" 
                icon={CheckCircle} 
                disabled={!selected || !canAuthorizeAudit} 
                onClick={() => { setEditItem(selectedRecord); setModalMode("approve"); setModalOpen(true); }} 
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none" 
              />

              {currentRole?.toLowerCase() === 'super_admin' && (
                <button 
                  disabled={!selected || selectedRecord?.status !== 'submitted' || verifying}
                  onClick={() => handleVerify(selected)}
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

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 whitespace-normal break-words leading-snug text-left">
                <Info size={12} className="shrink-0" />
                <span>
                  Selected Audit: #{selectedRecord?.audit_id} | Assigned to: {selectedRecord?.assigned_user_name} | Authorization: {getAuthorizationLabel(Boolean(selectedRecord?.approved))} | Audit Status: {getAuditExecutionStatusLabel(selectedRecord?.status)}
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
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search remarks, person..."
            searchLabel="Search Audits"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
            <DataTable
              headers={HEADERS} data={items} loading={loading}
              viewMode={viewMode} allowCopy={true} {...tableHotkeyProps} showSelection={true}
              emptyIcon={ClipboardCheck} sortKey={params.sortKey ?? ""} sortDir={params.sortDir}
              onSort={(key) => {
                setDisplayLimit(100);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              selectedId={selected} onSelect={setSelected}
              getRowId={(item) => item.audit_id}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{
                titleKey: "audit_id",
                badgeIndices: [4, 5],
                detailIndices: [1, 2, 3, 6],
                footerKey: "created_at",
                className: "rounded-none border border-slate-200 shadow-none"
              }}
            />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Audits
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
      
      {executionOpen && executionAudit && (
        <AuditExecutionModal 
          open={executionOpen} 
          onClose={() => {
            setExecutionOpen(false);
            setExecutionAudit(null);
          }} 
          onSuccess={async (keepOpen) => { 
            await fetchAudits();
            if (keepOpen && selected) {
              await loadExecutionAudit(selected);
            } else {
              setSelected(null); 
              setExecutionOpen(false);
              setExecutionAudit(null);
            }
          }} 
          auditData={executionAudit} 
        />
      )}

      {comparisonOpen && selectedRecord && (
        <AuditComparisonModal
          open={comparisonOpen}
          onClose={() => setComparisonOpen(false)}
          auditId={selectedRecord.audit_id}
          auditLabel={`Audit #${selectedRecord.audit_id} | ${selectedRecord.assigned_user_name || "—"}`}
        />
      )}

      {deleteItem && (
        <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { fetchAudits(); setSelected(null); }} service={auditService} entityLabel="Audit" idKey="audit_id" moduleSlug="audit" />
      )}
    </div>
  );
}
