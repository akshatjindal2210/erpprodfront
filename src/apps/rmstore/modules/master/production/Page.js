"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Factory, RefreshCcw, Edit3, Trash2, CheckCircle, X } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { productionService } from "@/apps/rmstore/lib/services/production";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";

import ActionButton from "@/ui/primitives/ActionButton";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DataTable from "@/ui/primitives/DataTable";
import ProductionModal from "./ProductionModal";
import { enrichProductionRow, productionRmCopyValue, productionSearchParts } from "./productionRmHelpers";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";

import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";

const MODULE = "rm_production_master";

export default function ProductionMasterPage() {
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    sortKey: "production_id",
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

  const fetchProductions = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || "production_id",
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.status === "approved" && { approved: true }),
          ...(params.status === "pending" && { approved: false }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await productionService.getAll({ ...base, page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows((data ?? []).map(enrichProductionRow));
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the Item RM mappings. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.status]);

  useEffect(() => {
    fetchProductions();
  }, [fetchProductions]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    let data = allRows;
    if (q) {
      data = applyClientSearch(allRows, tempSearch, {
        getParts: productionSearchParts,
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows,
      }),
    [tempSearch, allRows, filteredRows]
  );

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      status: data.approvedStatus || prev.status,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      pageSize: 1000,
      status: "all",
      sortKey: "production_id",
      sortDir: "desc",
    });
  };

  const extraFilters = useMemo(
    () => [
      {
        label: "Status",
        key: "approvedStatus",
        value: params.status,
        options: [
          { label: "All Status", value: "all" },
          { label: "Authorized", value: "approved" },
          { label: "Pending", value: "pending" },
        ],
      },
    ],
    [params.status]
  );

  const selectedRecord = useMemo(
    () => filteredRows.find((u) => u.production_id === selected),
    [filteredRows, selected]
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((u) => u.production_id === selected),
    [filteredRows, selected]
  );

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || !!deleteItem,
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
      toast.info("Select a row to approve (Ctrl+A).");
    }, []),
    openDelete: useCallback((row) => {
      setDeleteItem(row);
    }, []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const HEADERS = useMemo(() => {
    const renderRmCodes = (v) => {
      const text = v != null && String(v).trim() !== "" ? String(v) : "—";
      return (
        <span
          className="font-semibold text-slate-800 uppercase text-[11px] tracking-tight block leading-tight"
          title={text}
        >
          {text}
        </span>
      );
    };

    const renderRmDescs = (v) => {
      const text = v != null && String(v).trim() !== "" ? String(v) : "—";
      return (
        <span className="text-[10px] text-slate-500 italic block leading-tight" title={text}>
          {text}
        </span>
      );
    };

    return [
      ["Production ID", "production_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "120px" }],
      ["Item Code", "item_code", 
        (v) => (
          <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">
            {v || "—"}
          </span>
        ),
        { width: "140px" },
      ],
      ["Item Description", "item_desc", (v) => (
          <span className="text-[10px] text-slate-500 truncate block italic" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "220px" },
      ],
      ["RM Item Code", "rm_item_code", renderRmCodes, {
        width: "250px",
        copyValue: (row) => productionRmCopyValue(row, "rm_item_code"),
      }],
      ["RM Item Description", "rm_item_desc", renderRmDescs, {
        width: "260px",
        copyValue: (row) => productionRmCopyValue(row, "rm_item_desc"),
      }],
      ["Approval Status", "approved", (v) => {
          const on = v === true || v === "true" || v === 1;
          return (
          <span
            className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
              on
                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                : "bg-amber-50 text-amber-600 border-amber-100"
            }`}
          >
            {on ? "● AUTHORIZED" : "○ PENDING"}
          </span>
          );
        },
        { width: "140px" },
      ],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => (
          <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>
        ),
        { width: "150px" },
      ],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v, row) => (
          <span className="text-[10px] text-slate-400 font-medium">
            {row?.updated_by_name ? formatDateTime(v) : "—"}
          </span>
        ),
        { width: "150px" },
      ],
      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>,{ width: "110px" }],
      ["Approved At", "approved_at", (v) => (
          <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>
        ),
        { width: "150px" },
      ],
    ];
  }, []);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Item RM Master",
    rows: filteredRows,
    headers: HEADERS,
  });

  return (
    <div className={LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <ActionButton module={MODULE} action="add" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                <ActionButton module={MODULE} action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord} onClick={openEditModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton module={MODULE} action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selected}
                  onClick={() => {
                    setEditItem(selectedRecord);
                    setModalMode("approve");
                    setModalOpen(true);
                  }}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                />
                <ActionButton module={MODULE} action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button
                  onClick={() => fetchProductions()}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle viewMode={viewMode} setMode={handleViewMode} exporting={exporting} disabled={loading || exportDisabled} onExport={handleExport} />
            }
          />

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">
                Selected: {selectedRecord?.item_code} → {selectedRecord?.rm_item_code || "—"}
              </span>
              <button
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
            showDate={false}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search by production item or any mapped RM"
            searchLabel="Search Production"
            searchVariant="quick"
            showSearchButton
            applyOnSearchEnter={false}
            applyExtrasOnChange={false}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy={true}
            {...tableHotkeyProps}
            showSelection={true}
            skeletonCount={params.pageSize}
            emptyIcon={Factory}
            sortKey={params.sortKey ?? ""}
            sortDir={params.sortDir}
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
            getRowId={(item) => item.production_id}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "item_code",
              tagsKeys: ["approved"],
              detailKeys: ["item_desc", "rm_item_code", "rm_item_desc"],
              footerKey: "created_at",
            }}
          />
        </div>

        <RmStoreListFooter
          shown={items.length}
          total={totalItems}
          label="Item RM Mappings"
          {...footerFilter}
        />
      </div>

      {modalOpen && (
        <ProductionModal open={modalOpen} onClose={() => setModalOpen(false)}
          onSuccess={() => {
            fetchProductions();
            setSelected(null);
          }}
          editData={editItem} mode={modalMode}
        />
      )}
      {deleteItem && (
        <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            fetchProductions();
            setSelected(null);
          }}
          service={productionService} entityLabel="Item RM Mapping" idKey="production_id" moduleSlug={MODULE}
        />
      )}
    </div>
  );
}
