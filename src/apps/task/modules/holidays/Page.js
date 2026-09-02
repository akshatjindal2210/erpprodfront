"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, RefreshCcw, Edit3, X, CalendarDays } from "lucide-react";
import { toast } from "react-toastify";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";

import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import DataTable from "@/ui/primitives/DataTable";
import ActionButton from "@/ui/primitives/ActionButton";

import { holidayService } from "@/apps/task/lib/services/holidayApi";
import { formatDateTime } from "@/apps/task/lib/helpers/utilHelper";
import { filterRowsByViewDays, isOutsidePermissionDays } from "@/platform/utils/auth/permissionDays";
import { editTimeBlockedByAccess } from "@/platform/hooks/list/useListDrawerHotkeys";
import AddEditModal from "@/apps/task/lib/ui/common/AddEditModal";
import DeleteModal from "@/apps/task/lib/ui/common/DeleteModal";
import HolidayBulkUpload from "@/apps/task/modules/holidays/BulkUpload";

const MODULE = "holiday";

const formatHolidayDate = (val) => {
  if (!val) return "—";
  const parts = String(val).split("T")[0].split("-");
  if (parts.length !== 3) return String(val);
  const [year, month, day] = parts;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
};

export default function HolidaysPage() {
  const canAccess = useCanAccess();
  const canView = canAccess(MODULE, "view").allowed;
  const canAdd = canAccess(MODULE, "add").allowed;
  const canEdit = canAccess(MODULE, "edit").allowed;
  const canDelete = canAccess(MODULE, "delete").allowed;
  const viewAccess = canAccess(MODULE, "view");
  const editAccess = canAccess(MODULE, "edit");

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [tempSearch, setTempSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const [params, setParams] = useState({
    pageSize: 1000,
    sortKey: "date",
    sortDir: "asc",
    fromDate: null,
    toDate: null,
  });

  const fetchHolidays = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await holidayService.getAll({
        page: 1,
        limit: params.pageSize,
        sortBy: params.sortKey,
        order: params.sortDir,
        dateFrom: params.fromDate || undefined,
        dateTo: params.toDate || undefined,
      });
      const body = res?.data;
      const nested = body?.data;
      const list = Array.isArray(nested)
        ? nested
        : (nested?.data ?? nested?.items ?? body?.items ?? []);
      setAllRows(Array.isArray(list) ? list : []);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err.response?.data?.message || err?.message || "Failed to load holidays");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const filteredRows = useMemo(() => {
    let data = filterRowsByViewDays(allRows, viewAccess.days);
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir, viewAccess.days]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const selectedRecord = useMemo(
    () => filteredRows.find((r) => r.id === selected) || null,
    [filteredRows, selected],
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((r) => r.id === selected),
    [filteredRows, selected],
  );

  const openNewModal = useCallback(() => {
    if (!canAdd) return;
    setEditItem(null);
    setModalOpen(true);
  }, [canAdd]);

  const openEditModal = useCallback((row) => {
    if (!canEdit || !row) return;
    if (editTimeBlockedByAccess(row, editAccess)) {
      toast.info(`Edit time limit exceeded (${editAccess.days} days)`);
      return;
    }
    setEditItem(row);
    setModalOpen(true);
  }, [canEdit, editAccess]);

  const openDeleteModal = useCallback((row) => {
    if (!canDelete || !row) return;
    setDeleteItem(row);
  }, [canDelete]);

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || bulkOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: canAdd ? openNewModal : undefined,
    openEdit: canEdit ? openEditModal : undefined,
    openDelete: canDelete ? openDeleteModal : undefined,
    canDeleteSelection: useCallback(() => !!selected && canDelete, [selected, canDelete]),
  });

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate || null,
      toDate: data.toDate || null,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setSelected(null);
    setParams({
      pageSize: 1000,
      sortKey: "date",
      sortDir: "asc",
      fromDate: null,
      toDate: null,
    });
  };

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const HEADERS = [
    ["#", "id", (_v, _row, i) => <span className={IMS_TABLE_CELL_TEXT}>{i + 1}</span>, { fixed: true, width: "50px", align: "center" }],
    ["Name", "name", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v || "—"}</span>],
    ["Date", "date", (v) => <span className={IMS_TABLE_CELL_DATE}>{formatHolidayDate(v)}</span>, { width: "120px" }],
    ["Created At", "created_at", (v) => <span className={IMS_TABLE_CELL_DATE}>{v ? formatDateTime(v) : "—"}</span>, { width: "160px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Holiday",
    rows: filteredRows,
    headers: HEADERS,
  });

  if (!canView) return null;

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <ActionButton module={MODULE} action="add" label="New" icon={Plus} onClick={openNewModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                {canAdd ? (<HolidayBulkUpload onSuccess={fetchHolidays} onOpenChange={setBulkOpen} />) : null}
                <ActionButton module={MODULE} action="edit" variant="outline" label="Edit" icon={Edit3} 
                  disabled={!selectedRecord || isOutsidePermissionDays(selectedRecord, editAccess.days)}
                  record={selectedRecord} onClick={() => openEditModal(selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton module={MODULE} action="delete" variant="danger" label="Delete" icon={Trash2}
                  disabled={!selectedRecord} onClick={() => openDeleteModal(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button type="button" onClick={fetchHolidays} disabled={loading}
                  className="h-9 shrink-0 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center disabled:opacity-60"
                  aria-label="Refresh"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
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

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">
                Selected: {selectedRecord?.name || "—"}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            fromDate={params.fromDate}
            toDate={params.toDate}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search holiday name…"
            searchLabel="Search Holidays"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            showSelection
            idKey="id"
            getRowId={(row) => row.id}
            selectedId={selected}
            onSelect={setSelected}
            emptyIcon={CalendarDays}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={(key) => {
              setDisplayLimit(100);
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }));
            }}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            {...tableHotkeyProps}
            cardConfig={{
              titleKey: "name",
              detailIndices: [2, 3],
              footerKey: "created_at",
              className: "rounded-none border border-slate-200 shadow-none",
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Holidays
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <AddEditModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
        }}
        onSuccess={() => {
          fetchHolidays();
          setSelected(null);
        }}
        editItem={editItem}
        service={holidayService}
        entityLabel="Holiday"
        icon={CalendarDays}
        iconBg="bg-orange-50"
        iconBorder="border-orange-200"
        iconText="text-orange-600"
        focusColor="orange"
        buttonColor="orange"
        extraFields={[
          {
            key: "date",
            label: "Date",
            type: "date",
            required: true,
            transform: (val) => (val ? String(val).split("T")[0] : ""),
          },
        ]}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          fetchHolidays();
          setSelected(null);
        }}
        service={holidayService}
        entityLabel="Holiday"
      />
    </div>
  );
}
