"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Award, RefreshCcw, Edit3, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime } from "@/core/utils/utilHelper";
import { designationService } from "@/features/admin/services/designationService";

import ActionButton from "@/core/components/ui/ActionButton";
import ViewToggle from "@/core/components/ui/ViewToggle";
import DeleteModal from "@/core/components/common/DeleteModal";
import DataTable from "@/core/components/ui/DataTable";
import DesignationModal from "./DesignationModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import { useViewMode } from "@/core/hooks/useViewMode";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, sortRowsByKey, fetchAllListPages } from "@/core/utils/listSearch";

export default function DesignationsPage() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  const [params, setParams] = useState({
    pageSize: 500,
    sortKey: "id",
    sortDir: "desc",
    fromDate: null,
    toDate: null,
  });

  const [tempSearch, setTempSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const displayRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    let data = allRows;
    if (q) {
      data = applyClientSearch(allRows, tempSearch, {
        tieBreaker: (a, b) => b.id - a.id, // Last created first if match strength is equal
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const fetchDesignations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, total } = await fetchAllListPages(
        async (page, limit) => {
          const body = await designationService.getAll({
            page,
            limit,
            filters: {
              ...(params.fromDate && { from_date: params.fromDate }),
              ...(params.toDate && { to_date: params.toDate }),
            },
            sortBy: params.sortKey,
            order: params.sortDir.toUpperCase(),
          });
          return { data: body.data || [], total: body.total || 0 };
        },
        params.pageSize
      );
      setAllRows(data);
      setTotalItems(total);
    } catch (err) {
      toast.error(err?.message || "Failed to load designations");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate]);

  useEffect(() => {
    fetchDesignations();
  }, [fetchDesignations]);

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      pageSize: 500,
      sortKey: "id",
      sortDir: "desc",
      fromDate: null,
      toDate: null,
    });
  };

  const selectedRow = useMemo(() => allRows.find((u) => u.id === selected), [allRows, selected]);

  const getSelectedRow = useCallback(
    () => allRows.find((u) => u.id === selected),
    [allRows, selected]
  );

  const handleLoadMore = useCallback(() => {}, []);

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "designations",
    modalOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      setEditItem(row);
      setModalOpen(true);
    }, []),
  });

  const headers = [
    ["ID", "id", (v) => <span className="text-xs font-mono text-slate-500">{v}</span>, { width: "80px" }],
    ["Name", "name", (v) => <span className="font-bold text-slate-800 uppercase text-xs">{v}</span>],
    ["Created At", "created_at", (v) => <span className="text-xs text-slate-500">{formatDateTime(v)}</span>, { width: "180px" }],
    ["Updated At", "updated_at", (v) => <span className="text-xs text-slate-500">{v ? formatDateTime(v) : "—"}</span>, { width: "180px" }],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <ActionButton module="designations" action="add" label="New" icon={Plus} onClick={openNewModal}
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none border-slate-300"
              />
              <ActionButton module="designations" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={selected === null} record={selectedRow} onClick={openEditModal}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none"
              />
              <ActionButton module="designations" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={selected === null} record={selectedRow} onClick={() => setDeleteItem(selectedRow)} 
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none"
              />

              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => fetchDesignations()}
                className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none"
              >
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="flex items-center">
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
            </div>
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic">
                Selected: {selectedRow?.name || "—"}
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
        </div>

        <ListPageFilterStrip>
          <DateRangeFilter
            fromDate={params.fromDate}
            toDate={params.toDate}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search designation name..."
            searchLabel="Quick filter"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={headers}
            getRowId={(row) => row.id}
            data={displayRows}
            loading={loading}
            viewMode={viewMode}
            allowCopy={true}
            {...tableHotkeyProps}
            showSelection={true}
            emptyIcon={Award}
            emptyMessage="No designations found"
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={(key) =>
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }))
            }
            selectedId={selected}
            onSelect={setSelected}
            onLoadMore={handleLoadMore}
            hasMore={false}
            totalItems={displayRows.length}
            cardConfig={{
              titleKey: "name",
              footerKey: "created_at",
              className: "rounded-none shadow-sm border border-slate-200 overflow-hidden",
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            {tempSearch.trim()
              ? `${displayRows.length} shown (search) · ${allRows.length} loaded`
              : `${displayRows.length} / ${totalItems} designations`}
          </span>
        </div>
      </div>

      {modalOpen && (
        <DesignationModal open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditItem(null);
          }}
          onSuccess={() => fetchDesignations()}
          editData={editItem}
        />
      )}
      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => fetchDesignations()}
          service={designationService}
          entityLabel="Designation"
          moduleSlug="designations"
        />
      )}
    </div>
  );
}

