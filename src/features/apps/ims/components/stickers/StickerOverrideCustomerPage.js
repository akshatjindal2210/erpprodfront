"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCcw, Shield, X, FileText, Printer } from "lucide-react";
import { toast } from "react-toastify";
import { boxService } from "@/features/apps/ims/services/box";
import { useViewMode } from "@/core/hooks/useViewMode";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";

import ActionButton from "@/core/components/ui/ActionButton";
import PrintActionButton from "@/core/components/ui/PrintActionButton";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import DataTable from "@/core/components/ui/DataTable";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import StickerOverrideModal from "@/features/apps/ims/components/stickers/StickerOverrideModal";

import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";

import { STICKER_DOWNLOAD_SOURCE_KEYS } from "@/core/utils/global";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { useAppliedListSearch } from "@/features/apps/ims/helpers/useAppliedListSearch";
import { printFromBackendHtml } from "@/features/apps/ims/utils/printHtmlDocument";
import {
  OVERRIDE_CUSTOMER_CARD_CONFIG,
  OVERRIDE_CUSTOMER_HEADERS,
  OVERRIDE_STATUS_FILTER_OPTIONS,
  buildOverrideApiFilters,
  overrideSearchParts,
  resolveOverrideRowStatus,
} from "./overrideCustomerColumns";

const LIST_PAGE_SIZE = 1000;
const DISPLAY_CHUNK = 100;

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? "mobile" : "desktop";
}

export default function StickerOverrideCustomerPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("change_override_customer", "view"), [canAccess]);

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_CHUNK);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: LIST_PAGE_SIZE,
    status: "all",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "request_id",
    sortDir: "desc",
  });

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams((prev) => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [printing, setPrinting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await boxService.getOverrideRequests({
          page,
          limit,
          sortBy: "request_id",
          order: "DESC",
          ...(appliedSearch && { search: appliedSearch }),
          filters: buildOverrideApiFilters(params),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(DISPLAY_CHUNK);
    } catch (err) {
      toast.error(err?.message || "Failed to load override requests");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, appliedSearch]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) {
      return applyClientSearch(allRows, tempSearch, { getParts: overrideSearchParts });
    }
    return sortRowsByKey(allRows, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  useEffect(() => {
    setDisplayLimit(DISPLAY_CHUNK);
  }, [tempSearch]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + DISPLAY_CHUNK);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    applySearchFromInput();
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.approvedStatus || prev.status,
    }));
  };

  const handleReset = () => {
    resetSearch();
    setParams({
      pageSize: LIST_PAGE_SIZE,
      status: "all",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "request_id",
      sortDir: "desc",
    });
  };

  const statusFilters = useMemo(
    () => [
      {
        label: "Status",
        key: "approvedStatus",
        value: params.status,
        options: OVERRIDE_STATUS_FILTER_OPTIONS,
      },
    ],
    [params.status]
  );

  const selectedRecord = useMemo(
    () => filteredRows.find((u) => u.request_id === selected) ?? allRows.find((u) => u.request_id === selected),
    [filteredRows, allRows, selected]
  );

  const selectedStatus = useMemo(() => resolveOverrideRowStatus(selectedRecord), [selectedRecord]);

  const getSelectedRow = useCallback(
    () => filteredRows.find((u) => u.request_id === selected) ?? allRows.find((u) => u.request_id === selected),
    [filteredRows, allRows, selected]
  );

  const handlePrintApproved = useCallback(async () => {
    if (!selectedRecord) return;
    if (selectedStatus !== "approved") {
      toast.info("Print is available only after request approval.");
      return;
    }

    const boxUids = Array.isArray(selectedRecord.box_uids)
      ? selectedRecord.box_uids.map((id) => Number(id)).filter((n) => Number.isFinite(n))
      : [];
    if (!boxUids.length) {
      toast.error("No boxes found in selected request.");
      return;
    }

    setPrinting(true);
    try {
      const res = await boxService.renderBulkStickers({
        packing_number: String(selectedRecord.packing_number || ""),
        box_uids: boxUids,
        device_type: getDeviceType(),
        download_source: STICKER_DOWNLOAD_SOURCE_KEYS.customer_override,
        sticker_meta: {
          itemdcode: selectedRecord.itemdcode || selectedRecord.item_name || "",
          acc_name: selectedRecord.to_customer_name || selectedRecord.to_customer || "",
        },
      });

      const ok = printFromBackendHtml(res?.html, { title: res?.print_title });
      if (!ok) {
        toast.error("Could not open print preview. Try again.");
      } else {
        toast.success("Print opened.");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to print stickers.");
    } finally {
      setPrinting(false);
    }
  }, [selectedRecord, selectedStatus]);

  const { openNewModal, openPrintModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "change_override_customer",
    modalOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    onPrint: useCallback(() => {
      handlePrintApproved();
    }, [handlePrintApproved]),
    canPrintSelection: useCallback(
      () => Boolean(selected) && selectedStatus === "approved" && !printing,
      [selected, selectedStatus, printing]
    ),
    onPrintBlocked: useCallback(() => {
      if (!selected) {
        toast.info("Select a row to print stickers (Ctrl+Alt+P).");
        return;
      }
      if (selectedStatus !== "approved") {
        toast.info("Print is available only after request approval.");
      }
    }, [selected, selectedStatus]),
    printModule: "change_override_customer",
    printAction: "view",
    openApprove: useCallback((row) => {
      setEditItem(row);
      setModalMode("approve");
      setModalOpen(true);
    }, []),
    canApproveSelection: useCallback(() => Boolean(selected && selectedRecord), [selected, selectedRecord]),
    onApproveBlocked: useCallback(() => {
      toast.info("Select a row to open approve (Ctrl+A).");
    }, []),
  });

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Sticker Customer Override",
    rows: filteredRows,
    headers: OVERRIDE_CUSTOMER_HEADERS,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <ActionButton
                    module="change_override_customer"
                    action="add"
                    label="New Request"
                    icon={Plus}
                    onClick={openNewModal}
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none"
                  />

                  <ActionButton
                    module="change_override_customer"
                    action="authorize"
                    variant="outline"
                    label="Approve"
                    icon={Shield}
                    disabled={!selected}
                    onClick={() => {
                      setEditItem(selectedRecord);
                      setModalMode("approve");
                      setModalOpen(true);
                    }}
                    className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none text-indigo-600"
                  />

                  <PrintActionButton
                    module="change_override_customer"
                    variant="outline"
                    label={printing ? "Printing..." : "Print Stickers"}
                    icon={Printer}
                    disabled={!selected || selectedStatus !== "approved" || printing}
                    onClick={openPrintModal}
                    title={
                      selectedStatus !== "approved"
                        ? "Print available after approval"
                        : "Print stickers (Ctrl+Alt+P / Ctrl+P in app)"
                    }
                    className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none text-emerald-600 disabled:text-slate-400 disabled:bg-slate-100"
                  />

                  <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />

                  <button
                    onClick={fetchRequests}
                    className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none"
                  >
                    <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                    <span className="hidden xs:inline">Refresh</span>
                  </button>
                </div>
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
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                Selected Request: #{selectedRecord?.request_id} ({selectedRecord?.packing_number})
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Clear Selection
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={statusFilters}
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
            searchPlaceholder="Type to filter — packing, item, box UID..."
            searchLabel="Quick Search"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              headers={OVERRIDE_CUSTOMER_HEADERS}
              data={items}
              loading={loading}
              getRowId={(item) => item.request_id}
              viewMode={viewMode}
              allowCopy={true}
              {...tableHotkeyProps}
              showSelection={true}
              skeletonCount={DISPLAY_CHUNK}
              emptyIcon={FileText}
              sortKey={params.sortKey}
              sortDir={params.sortDir}
              onSort={(key) => {
                setDisplayLimit(DISPLAY_CHUNK);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              selectedId={selected}
              onSelect={setSelected}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={OVERRIDE_CUSTOMER_CARD_CONFIG}
            />
          </div>
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Override Requests
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <StickerOverrideModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditItem(null);
          }}
          onSuccess={() => {
            fetchRequests();
            setSelected(null);
          }}
          editData={editItem}
          mode={modalMode}
        />
      )}
    </div>
  );
}
