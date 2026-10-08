"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Cpu, RefreshCcw, Edit3, Trash2, CheckCircle, Copy } from "lucide-react";
import AppListFooter from "@/ui/common/list/listPageFooter";
import { toast } from "react-toastify";

import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { machineMasterService } from "@/apps/engineering/lib/services/machineMaster";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import ActionButton from "@/ui/primitives/ActionButton";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DataTable from "@/ui/primitives/DataTable";
import MachineModal from "./MachineModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";

const MODULE = ENG_MODULES.MACHINE_MASTER;

function formatDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s)) return "—";
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600} Hour`;
  if (s >= 60 && s % 60 === 0) return `${s / 60} Min`;
  return `${s} Sec`;
}

export default function MachineMasterPage() {
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [params, setParams] = useState({ pageSize: 1000, status: "all", sortKey: "id", sortDir: "desc" });
  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || "id",
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.status !== "all" && { approved: params.status === "approved" }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await machineMasterService.getAll({ ...base, page, limit });
        const list = body.data?.data ?? body.data ?? [];
        return { data: Array.isArray(list) ? list : [], total: body.data?.total ?? body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
    } catch (err) {
      toast.error(err?.message || "Failed to load machines");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.status]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { setDisplayLimit(100); }, [tempSearch, params.status]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(allRows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const selectedRecord = useMemo(() => filteredRows.find((u) => u.id === selected), [filteredRows, selected]);
  const getSelectedRow = useCallback(() => filteredRows.find((u) => u.id === selected), [filteredRows, selected]);

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => { setEditItem(null); setModalMode("add"); setModalOpen(true); }, []),
    openEdit: useCallback((row) => { setEditItem(row); setModalMode("edit"); setModalOpen(true); }, []),
    openApprove: useCallback((row) => {
      if (row?.approved) { toast.info("Already approved. Edit before approving again."); return; }
      setEditItem(row); setModalMode("approve"); setModalOpen(true);
    }, []),
    canApproveSelection: useCallback(() => Boolean(selected && selectedRecord && !selectedRecord.approved), [selected, selectedRecord]),
    onApproveBlocked: useCallback(() => {
      if (selectedRecord?.approved) toast.info("Already approved. Edit before approving again.");
      else toast.info("Select a pending row to open approve (Ctrl+A).");
    }, [selectedRecord]),
    openDelete: useCallback((row) => setDeleteItem(row), []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const HEADERS = [
    ["Number", "number", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px] uppercase">{v || "—"}</span>, { fixed: true, width: "110px", copyValue: (row) => row.number || "—" }],
    ["Name", "name", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v || "—"}</span>, { width: "160px", copyValue: (row) => row.name || "—" }],
    ["Process", "process_name", (v) => (
      <span className="text-[10px] font-bold text-slate-600 uppercase whitespace-normal break-words leading-snug" title={v}>{v || "—"}</span>
    ), { width: "160px", wrap: true, copyValue: (row) => row.process_name || "—" }],
    ["Speed", "speed", (v) => (
      <span className="font-black text-slate-700 text-[11px]">{v != null && String(v).trim() !== "" ? String(v) : "—"}</span>
    ), { width: "80px", align: "center" }],
    ["Duration", "duration", (v) => (
      <span className="font-black text-slate-700 text-[11px]">{formatDuration(v)}</span>
    ), { width: "100px", align: "center", copyValue: (row) => formatDuration(row.duration) }],
    ["Make", "make", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
    ["Model", "model", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
    ["Status", "approved", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
        {v ? "● AUTHORIZED" : "○ PENDING"}
      </span>
    ), { width: "120px" }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Machine Master",
    rows: filteredRows,
    headers: HEADERS,
  });

  const extraFilters = useMemo(() => [{
    label: "Status", key: "approvedStatus", value: params.status,
    options: [
      { label: "All Status", value: "all" },
      { label: "Authorized", value: "approved" },
      { label: "Pending", value: "pending" },
    ],
  }], [params.status]);

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <ActionButton module={MODULE} action="add" label="New" icon={Plus} onClick={openNewModal} title="Ctrl+Alt+N" className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
                <ActionButton module={MODULE} action="add" variant="outline" label="Clone" icon={Copy} disabled={!selected}
                  onClick={() => { if (!selectedRecord) return; setEditItem(selectedRecord); setModalMode("add"); setModalOpen(true); }}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none" />
                <ActionButton module={MODULE} action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord} onClick={openEditModal} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none" />
                <ActionButton module={MODULE} action="authorize" variant="outline" label="Approve" icon={CheckCircle}
                  disabled={!selected || !!selectedRecord?.approved}
                  onClick={() => {
                    if (selectedRecord?.approved) { toast.info("Already approved. Edit before approving again."); return; }
                    setEditItem(selectedRecord); setModalMode("approve"); setModalOpen(true);
                  }}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none" />
                <ActionButton module={MODULE} action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />

                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />

                <button
                  onClick={() => fetchRows()}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none"
                >
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
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={false}
            extraFilters={extraFilters}
            onApply={(data) => setParams((p) => ({ ...p, status: data.approvedStatus || p.status }))}
            onReset={() => { setTempSearch(""); setParams({ pageSize: 1000, status: "all", sortKey: "id", sortDir: "desc" }); }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search number, name, process..."
            searchLabel="Search Database"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
          <DataTable
            headers={HEADERS} data={items} loading={loading}
            viewMode={viewMode} allowCopy={true} {...tableHotkeyProps} showSelection={true}
            emptyIcon={Cpu} sortKey={params.sortKey ?? ""} sortDir={params.sortDir}
            onSort={(key) => {
              setDisplayLimit(100);
              setParams((p) => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc" }));
            }}
            selectedId={selected} onSelect={setSelected}
            getRowId={(item) => item.id}
            onLoadMore={() => { if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100); }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
          />
        </div>

        <AppListFooter
          shown={items.length}
          total={totalItems}
          noun="Machines"
          selected={selected}
          selectedRecord={selectedRecord}
          selectionLabel={(row) => row?.number || row?.name || "—"}
          onClearSelection={() => setSelected(null)}
        />
      </div>

      {modalOpen && (
        <MachineModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={() => { fetchRows(); setSelected(null); }} editData={editItem} mode={modalMode} />
      )}
      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => { fetchRows(); setSelected(null); }}
          service={machineMasterService}
          entityLabel="Machine"
          idKey="id"
          titleKey="number"
          moduleSlug={MODULE}
        />
      )}
    </div>
  );
}
