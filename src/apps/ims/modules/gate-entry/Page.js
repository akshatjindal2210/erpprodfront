"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2, Eye, Pencil, Truck, CheckCircle2, X } from "lucide-react";
import { toast } from "react-toastify";

import { gateEntryService } from "@/apps/ims/lib/services/gateEntry";
import GateEntryModal from "@/apps/ims/modules/gate-entry/GateEntryModal";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";

import ActionButton from "@/ui/primitives/ActionButton";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import DataTable from "@/ui/primitives/DataTable";
import DeleteModal from "@/ui/common/modals/DeleteModal";

const PAGE_TABS = {
  COMPLETE: "complete",
  PENDING: "pending",
};

const IMS_BILL_META_HEADERS = [
  ["Customer", "acc_name", (v) => (
    <span className="text-[10px] font-medium text-slate-500 uppercase italic whitespace-normal break-words leading-snug block" title={v || ""}>
      {v || "—"}
    </span>
  ), { width: "260px", wrap: true }],
  ["Boxes", "boxes", (v) => <span className="text-[10px] font-bold text-slate-700 uppercase">{v || "—"}</span>, { width: "100px" }],
  ["Total Qty", "totalqty", (v) => <span className="font-black text-slate-700 text-[11px] tabular-nums">{v ?? "—"}</span>, { width: "90px" }],
  ["Items", "total_item_count", (v) => <span className="font-bold text-slate-700 text-[11px] tabular-nums">{v ?? "—"}</span>, { width: "80px" }],
];

const PENDING_HEADERS = [
  ["Bill Number", "billno", (v, row) => (
    <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v || row?.bill_no || "—"}</span>
  ), { fixed: true, width: "160px" }],
  ["Bill Date", "billdt", (v, row) => (
    <span className="text-[10px] text-slate-500 font-medium">{v || row?.bill_dt || "—"}</span>
  ), { width: "140px" }],
  ...IMS_BILL_META_HEADERS,
];

const COMPLETE_HEADERS = [
  ["ID", "uid", (v, row) => (
    <span className="font-mono text-indigo-600 font-bold text-[10px]">
      {`${String(row?.type || "out").toLowerCase() === "in" ? "IN" : "OUT"}-${v}`}
    </span>
  ), { fixed: true, width: "80px" }],
  // ["Type", "type", (v) => (<span className="text-[10px] font-bold text-slate-700 uppercase">{v || "out"}</span>), { width: "70px" }],
  ["Bill Number", "bill_no", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v || "—"}</span>, { width: "160px" }],
  ["Bill Date", "bill_dt", (v) => <span className="text-[10px] text-slate-500 font-medium">{v || "—"}</span>, { width: "140px" }],
  ...IMS_BILL_META_HEADERS,
  ["Transporter", "transporter_name", (v) => <span className="text-[10px] font-medium text-slate-600 uppercase">{v || "—"}</span>, { width: "180px" }],
  ["Vehicle", "vehicle_number", (v) => <span className="text-[10px] font-bold text-slate-700 uppercase">{v || "—"}</span>, { width: "120px" }],
  ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 truncate block italic">{v || "—"}</span>, { width: "180px" }],
  ["Created By", "created_by", (v) => <span className="text-[10px] text-slate-500 ">{v || "—"}</span>, { width: "110px" }],
  ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Updated By", "updated_by", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
  ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
];

export default function GateEntryPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("gate_entry", "view"), [canAccess]);
  const addAccess = useMemo(() => canAccess("gate_entry", "add"), [canAccess]);
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [pageTab, setPageTab] = useState(PAGE_TABS.PENDING);
  const isPending = pageTab === PAGE_TABS.PENDING;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [pendingRows, setPendingRows] = useState([]);
  const [completeRows, setCompleteRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [sort, setSort] = useState({ key: "billno", dir: "desc" });
  const [typeFilter, setTypeFilter] = useState("all");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const { tempSearch, setTempSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setAppliedFromDate(dateFilterDefaults.from);
      setAppliedToDate(dateFilterDefaults.to);
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const fetchPending = useCallback(async () => {
    if (!viewAccess?.allowed) return;
    setLoading(true);
    try {
      const res = await gateEntryService.listPending();
      if (!res?.success) throw new Error(res?.message || "Failed to load pending bills.");
      setPendingRows(Array.isArray(res.data) ? res.data : []);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load pending bills.");
      setPendingRows([]);
    } finally {
      setLoading(false);
    }
  }, [viewAccess]);

  const fetchComplete = useCallback(async () => {
    if (!viewAccess?.allowed) return;
    setLoading(true);
    try {
      const filters = {};
      if (appliedFromDate) filters.from_date = `${appliedFromDate} 00:00:00`;
      if (appliedToDate) filters.to_date = `${appliedToDate} 23:59:59`;
      const res = await gateEntryService.list(Object.keys(filters).length ? { filters } : {});
      if (!res?.success) throw new Error(res?.message || "Failed to load gate entries.");
      setCompleteRows(Array.isArray(res.data) ? res.data : []);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load gate entries.");
      setCompleteRows([]);
    } finally {
      setLoading(false);
    }
  }, [viewAccess, appliedFromDate, appliedToDate]);

  useEffect(() => {
    if (isPending) fetchPending();
    else fetchComplete();
  }, [isPending, fetchPending, fetchComplete]);

  const sourceRows = isPending ? pendingRows : completeRows;

  const filteredRows = useMemo(() => {
    let rows = sourceRows;
    if (!isPending && typeFilter !== "all") {
      rows = rows.filter((r) => String(r?.type || "out").toLowerCase() === typeFilter);
    }
    rows = applyClientSearch(rows, tempSearch);
    return sortRowsByKey(rows, sort.key, sort.dir);
  }, [sourceRows, tempSearch, sort, isPending, typeFilter]);

  const totalItems = filteredRows.length;
  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);

  const getRowId = useCallback(
    (item) => (isPending ? item.billno || item.bill_no : item.uid),
    [isPending]
  );

  const selectedRecord = useMemo(
    () => filteredRows.find((i) => getRowId(i) === selected) || null,
    [filteredRows, selected, getRowId]
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((i) => getRowId(i) === selected) || null,
    [filteredRows, selected, getRowId]
  );

  const openModal = useCallback((row, mode = "add") => {
    setEditItem(row);
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const openNew = useCallback(() => {
    /*
    Commented out because we want to allow creating new gate entries even if gate entry register tab then create new or also in pending tab then create new.
    if (!isPending) {
      toast.info("Switch to Pending to create a new gate entry.");
      return;
    }
    */
    openModal(null, "add");
  }, [openModal]);

  const handleRowDoubleClick = useCallback(
    (row, id) => {
      setSelected(id);
      if (isPending) {
        if (!addAccess.allowed) {
          toast.info(addAccess.message || "No access to create gate entry.");
          return;
        }
        const bill = row?.billno || row?.bill_no;
        if (!bill) return;
        openModal({ billno: bill, bill_no: bill }, "add");
        return;
      }
      if (row?.uid) {
        openModal({ uid: row.uid }, "view");
      }
    },
    [isPending, addAccess, openModal]
  );

  const handleRefresh = useCallback(() => {
    if (isPending) fetchPending();
    else fetchComplete();
  }, [isPending, fetchPending, fetchComplete]);

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setSelected(null);
    resetSearch();
    setTypeFilter("all");
    if (tab === PAGE_TABS.COMPLETE) {
      setAppliedFromDate(dateFilterDefaults.from);
      setAppliedToDate(dateFilterDefaults.to);
    }
    setDisplayLimit(100);
    setSort({ key: tab === PAGE_TABS.PENDING ? "billno" : "uid", dir: "desc" });
  };

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
  }, [loading, items.length, totalItems]);

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "gate_entry",
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: openNew,
    openEdit: useCallback(
      (row) => {
        if (isPending) return;
        if (row?.uid) openModal({ uid: row.uid }, "edit");
      },
      [isPending, openModal]
    ),
    openDelete: useCallback((row) => {
      if (!isPending) setDeleteItem(row);
    }, [isPending]),
    canDeleteSelection: useCallback(() => !isPending && !!selected, [isPending, selected]),
  });

  const extraFilters = useMemo(() => {
    if (isPending) return [];
    return [
      /* 
      // This filter is temporarily disabled because gate entyr type out is now working in is future feature. So we are not allowing filtering by type for now.
      {
        label: "Type",
        key: "typeFilter",
        value: typeFilter,
        variant: "quick",
        options: [
          { label: "All Types", value: "all" },
          { label: "Out", value: "out" },
          { label: "In", value: "in" },
        ],
      },
      */
    ];
  }, [isPending, typeFilter]);

  const headers = isPending ? PENDING_HEADERS : COMPLETE_HEADERS;

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isPending ? "Gate Entry Pending" : "Gate Entry Complete",
    rows: filteredRows,
    headers,
  });

  const selectedLabel = isPending
    ? selectedRecord?.billno || selectedRecord?.bill_no || selected
    : `${String(selectedRecord?.type || "out").toLowerCase() === "in" ? "IN" : "OUT"}-${selectedRecord?.uid ?? selected}${selectedRecord?.bill_no ? ` · ${selectedRecord.bill_no}` : ""}`;

  if (!viewAccess?.allowed) {
    return <div className="p-6 text-sm text-slate-500">No access.</div>;
  }

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
                  { id: PAGE_TABS.COMPLETE, label: "Gate Entry Register", icon: CheckCircle2 },
                  { id: PAGE_TABS.PENDING, label: "Pending", icon: Truck },
                ]}
              />
            }
            actions={
              <>
                <ActionButton module="gate_entry" action="add" label="New" icon={Plus} onClick={openNewModal} className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`} />

                {!isPending ? (
                  <>
                  <ActionButton module="gate_entry" action="view" variant="outline" label="View" icon={Eye} disabled={!selectedRecord} record={selectedRecord}
                    onClick={() => {
                      if (selectedRecord?.uid) openModal({ uid: selectedRecord.uid }, "view");
                    }}
                    className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-slate-300`}
                  />
                  <ActionButton module="gate_entry" action="edit" variant="outline" label="Edit" icon={Pencil} disabled={!selectedRecord} record={selectedRecord}
                    onClick={() => {
                      if (selectedRecord?.uid) openModal({ uid: selectedRecord.uid }, "edit");
                    }}
                    className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-slate-300`}
                  />
                  <ActionButton module="gate_entry" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selectedRecord} onClick={() => setDeleteItem(selectedRecord)}
                    className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`}
                  />
                  </>
                ) : null}

                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-0.5 shrink-0" />

                <button
                  type="button"
                  onClick={handleRefresh}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`}
                  aria-label="Refresh"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
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

          {selected ? (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in fade-in duration-200">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">
                Selected: {selectedLabel}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Clear Selection
              </button>
            </div>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={pageTab}
            showDate={!isPending}
            fromDate={isPending ? "" : appliedFromDate}
            toDate={isPending ? "" : appliedToDate}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
            extraFilters={extraFilters}
            onApply={(data) => {
              if (isPending) return;
              setAppliedFromDate(data.fromDate || "");
              setAppliedToDate(data.toDate || "");
              setDisplayLimit(100);
            }}
            onExtraFilterChange={(key, value) => {
              if (!isPending && key === "typeFilter") {
                setTypeFilter(value || "all");
                setDisplayLimit(100);
              }
            }}
            onReset={() => {
              resetSearch();
              setTypeFilter("all");
              if (!isPending) {
                setAppliedFromDate(dateFilterDefaults.from);
                setAppliedToDate(dateFilterDefaults.to);
              }
              setDisplayLimit(100);
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={applySearchFromInput}
            applyOnSearchEnter={false}
            searchPlaceholder={isPending ? "Search bill, customer..." : "Search bill, customer, transporter, vehicle..."}
            searchLabel={isPending ? "Search Pending" : "Search Complete"}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            key={`${pageTab}-${viewMode}`}
            headers={headers}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy={true}
            showSelection={true}
            emptyIcon={isPending ? Truck : CheckCircle2}
            {...tableHotkeyProps}
            hotkeysDisabled={modalOpen || !!deleteItem || tableHotkeyProps.hotkeysDisabled}
            sortKey={sort.key ?? ""}
            sortDir={sort.dir}
            onSort={(key) => {
              setDisplayLimit(100);
              setSort((s) => ({
                key,
                dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
              }));
            }}
            selectedId={selected}
            onSelect={setSelected}
            onRowDoubleClick={handleRowDoubleClick}
            getRowId={getRowId}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={
              isPending
                ? {
                    titleKey: "billno",
                    detailIndices: [1, 2, 3, 4],
                    footerKey: "billdt",
                  }
                : {
                    titleKey: "bill_no",
                    badgeIndices: [0, 1],
                    detailIndices: [4, 5, 6, 7],
                    footerKey: "created_at",
                  }
            }
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} {isPending ? "Pending Bills" : "Complete Entries"}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <GateEntryModal
          open={modalOpen}
          mode={modalMode}
          initial={editItem}
          onClose={() => {
            setModalOpen(false);
            setEditItem(null);
          }}
          onSaved={() => {
            fetchPending();
            fetchComplete();
            setSelected(null);
            if (modalMode === "add") {
              handleTabChange(PAGE_TABS.COMPLETE);
            }
          }}
        />
      ) : null}

      {deleteItem ? (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            fetchComplete();
            fetchPending();
            setSelected(null);
          }}
          service={gateEntryService}
          entityLabel="Gate Entry"
          idKey="uid"
          titleKey="bill_no"
          moduleSlug="gate_entry"
        />
      ) : null}
    </div>
  );
}
