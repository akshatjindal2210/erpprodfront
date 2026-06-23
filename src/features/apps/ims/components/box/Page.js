"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCcw, Box, Edit3, Trash2, CheckCircle, X, Locate } from "lucide-react";
import { toast } from "react-toastify";
import { boxService } from "@/features/apps/ims/services/box";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";

// Components
import ActionButton from "@/core/components/ui/ActionButton";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import DeleteModal from "@/core/components/common/DeleteModal";
import DataTable from "@/core/components/ui/DataTable";
import BoxModal from "./BoxModal";
import BoxFinderDrawer from "./BoxFinderDrawer";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";

import { useViewMode } from "@/core/hooks/useViewMode";
import { formatDateTime } from "@/core/utils/utilHelper";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchListFirstPage, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { useAppliedListSearch } from "@/features/apps/ims/helpers/useAppliedListSearch";
import { getBoxRowClassName, getBoxStockZone, getBoxClientSearchParts, renderBoxForwardNoteCustomerCell, renderBoxLocationCell, renderBoxQcHoldIdCell, resolveBoxLocationLabel } from "./boxTableVisuals";

export default function BoxTablePage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("boxes", "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    packingNumber: "",
    fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "box_uid", sortDir: "desc"
  });

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    setParams((prev) => {
      if (prev.fromDate === dateFilterDefaults.from && prev.toDate === dateFilterDefaults.to) {
        return prev;
      }
      return {
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      };
    });
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [packingSearchInput, setPackingSearchInput] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);

  const fetchBoxes = useCallback(async () => {
    if (!params.fromDate && !params.toDate) return;
    setLoading(true);
    try {
      const base = {
        order: "DESC",
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.packingNumber && { packing_number: params.packingNumber }),
        },
        ...(appliedSearch && { search: appliedSearch }),
      };
      const { data } = await fetchListFirstPage(async (page, limit) => {
        const body = await boxService.getAll({ ...base, page, limit });
        const list = body.data?.data ?? body.data ?? [];
        return { data: Array.isArray(list) ? list : [], total: body.data?.total ?? body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load box records");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.packingNumber, appliedSearch]);

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) {
      return applyClientSearch(allRows, tempSearch, { getParts: getBoxClientSearchParts });
    }
    return sortRowsByKey(allRows, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const applyPackingFilter = useCallback(() => {
    const pn = String(packingSearchInput || "").trim();
    setDisplayLimit(100);
    setParams((prev) => ({ ...prev, packingNumber: pn }));
  }, [packingSearchInput]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    applySearchFromInput();
    const pn = String(packingSearchInput || "").trim();
    setDisplayLimit(100);
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.approvedStatus || prev.status,
      packingNumber: pn,
    }));
  };

  const handleReset = () => {
    resetSearch();
    setPackingSearchInput("");
    setParams({
      pageSize: 1000,
      status: "all",
      packingNumber: "",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "box_uid",
      sortDir: "desc",
    });
  };

  const extraFilters = useMemo(
    () => [
      {
        type: "text",
        label: "Packing No",
        placeholder: "Exact packing only",
        value: packingSearchInput,
        onChange: setPackingSearchInput,
        onEnter: applyPackingFilter,
      },
    ],
    [packingSearchInput, applyPackingFilter]
  );

  const selectedRecord = useMemo(() => filteredRows.find((u) => u.box_uid === selected), [filteredRows, selected]);

  const getSelectedRow = useCallback(() => filteredRows.find((u) => u.box_uid === selected), [filteredRows, selected]);

  const { openNewModal, openEditModal, tableHotkeyProps, openDeleteModal } = useListDrawerHotkeys({
    module: "boxes",
    modalOpen: modalOpen || finderOpen || !!deleteItem,
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
    openDelete: useCallback((row) => {
      setDeleteItem(row);
    }, []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const HEADERS = [
    ["Box No", "box_no_uid", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { fixed: true, width: "120px" }],
    ["Packing No", "packing_number", (v) => <span className="font-semibold text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "110px" }],

    ["Item Code", "item_code", (v) => <span className="font-mono text-[10px] font-bold tracking-tighter">{v}</span>, { width: "150px" }],
    ["Description", "itemdesc", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>, { width: "240px" }],

    ["Qty", "qty", (v, row) => {
      const zone = getBoxStockZone(row);
      const qtyClass =
        zone === "qc_hold"
          ? "text-amber-800"
          : zone === "dispatched"
            ? "text-blue-800"
            : zone === "in_store"
              ? "text-emerald-800"
              : zone === "packing_area"
                ? "text-green-900"
                : "text-emerald-600";
      return <span className={`font-black text-[11px] tabular-nums ${qtyClass}`}>{v ?? "0"}</span>;
    }, { width: "70px", align: "center" }],

    ["Location", "location_no", renderBoxLocationCell, {
      width: "120px",
      copyValue: (row) => resolveBoxLocationLabel(row),
    }],

    ["QC Hold ID", "qc_hold_id", renderBoxQcHoldIdCell, {
      width: "96px",
      align: "center",
      copyValue: (row) => (row.qc_hold_id != null ? String(row.qc_hold_id) : "—"),
    }],

    ["Inward UID", "in_uid", (v, row) => {
      const zone = getBoxStockZone(row);
      return (
        <span className={`text-[10px] ${zone === "in_store" ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
          {v || "—"}
        </span>
      );
    }, { width: "120px" }],
    
    ["Customer", "forward_note_customer_name", renderBoxForwardNoteCustomerCell, {
      width: "180px",
      wrap: true,
      copyValue: (row) => (getBoxStockZone(row) === "dispatched" ? row.forward_note_customer_name || "—" : "—"),
    }],

    ["Outward UID", "out_uid", (v, row) => {
      const zone = getBoxStockZone(row);
      return (
        <span className={`text-[10px] ${zone === "dispatched" ? "text-blue-800 font-bold" : "text-slate-400"}`}>
          {v || "—"}
        </span>
      );
    }, { width: "120px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Box Records",
    rows: filteredRows,
    headers: HEADERS,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
              <button
                type="button"
                onClick={() => setFinderOpen(true)}
                className="h-9 px-4 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none shrink-0"
              >
                <Locate size={14} className="text-indigo-600" />
                <span>Finder</span>
              </button>

              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              
              <button onClick={() => fetchBoxes()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
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
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Selected: {selectedRecord?.box_no_uid}</span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${params.fromDate}-${params.toDate}-${params.packingNumber}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={() =>
              handleFilterApply({
                fromDate: params.fromDate,
                toDate: params.toDate,
                approvedStatus: params.status,
              })
            }
              searchPlaceholder="Search box UID, box no, packing, location..."
            searchLabel="Search Box Records"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              headers={HEADERS} 
              data={items} 
              loading={loading}
              viewMode={viewMode} 
              {...tableHotkeyProps}
              sortKey={params.sortKey} 
              sortDir={params.sortDir}
              allowCopy={true}
              getRowClassName={getBoxRowClassName}
              onSort={(key) => {
                setDisplayLimit(100);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              selectedId={selected} 
              onSelect={setSelected}
              getRowId={(item) => item.box_uid}
              emptyIcon={Box}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{
                titleKey: "box_no_uid",
                badgeIndices: [5],
                detailKeys: [
                  "packing_number",
                  "item_code",
                  "item_desc",
                  "forward_note_customer_name",
                  "location_no",
                  "qc_hold_id",
                  "in_uid",
                  "out_uid",
                ],
                footerKey: "forward_note_customer_name",
              }}
            />
          </div>
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Box Records
          </span>
          <span className="text-[9px] text-slate-500">
            <span className="text-amber-700 font-bold">Yellow row</span> QC hold ·{" "}
            <span className="text-blue-700 font-bold">Blue row</span> dispatched ·{" "}
            Location: <span className="text-emerald-700 font-bold">in store</span> /{" "}
            <span className="text-green-900 font-bold">packing area</span> /{" "}
            <span className="text-amber-700 font-bold">QC area</span> /{" "}
            <span className="text-blue-800 font-bold">dispatch</span>
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <BoxModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={() => { fetchBoxes(); setSelected(null); }} editData={editItem} mode={modalMode} />
      {finderOpen && <BoxFinderDrawer open={finderOpen} onClose={() => setFinderOpen(false)} />}
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { fetchBoxes(); setSelected(null); }} service={boxService} entityLabel="Box Record" idKey="box_uid" moduleSlug="boxes" />
    </div>
  );
}
