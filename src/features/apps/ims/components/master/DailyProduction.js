"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { Package, Eye, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { formatDateTime, formatDocDate } from "@/core/utils/utilHelper";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";
import { masterService } from "@/features/apps/ims/services/master";
import { boxService } from "@/features/apps/ims/services/box";
import { useViewMode } from "@/core/hooks/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import DataTable from "@/core/components/ui/DataTable";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ActionButton from "@/core/components/ui/ActionButton";
import GlobalDetailModal from "@/core/components/common/GlobalDetailModal";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection, MasterDetailGrid, MasterDetailKV, MasterDetailProse } from "./MasterDetailLayout";
import StickerRemoveConfirmModal from "./StickerRemoveConfirmModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { useMasterClientList } from "@/features/apps/ims/helpers/useMasterClientList";
import { MasterSelectionBanner, MasterListFooter, MasterRefreshButton } from "@/features/apps/ims/helpers/masterListUi";
import { DAILY_PRODUCTION_HEADERS, STICKER_STATUS_FILTER_OPTIONS, DAILY_PROD_CARD_CONFIG, dailyProdRowKey, dailyProdSearchParts, filterDailyProdByStickerStatus } from "./masterColumns";

const StickerCreationModel = dynamic(
  () => import("@/features/apps/ims/components/stickers/StickerCreationModel"),
  { ssr: false }
);

export default function DailyProductionPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("packing_entry", "view"), [canAccess]);
  const canRemoveGeneratedStickers = useMemo(() => canAccess("packing_entry", "delete").allowed, [canAccess]);
  const canNewSticker = useMemo(
    () => canAccess("packing_entry", "add").allowed || canAccess("packing_entry", "edit").allowed,
    [canAccess]
  );

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);
  const [viewMode, handleViewMode] = useViewMode();
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
  const [removeStickersLoading, setRemoveStickersLoading] = useState(false);
  const [removeStickersConfirmOpen, setRemoveStickersConfirmOpen] = useState(false);
  const [listParams, setListParams] = useState({
    stickerStatus: "pending",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
  });

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setListParams((prev) => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const loadData = useCallback(async () => {
    const res = await masterService.getDailyProd({
      filters: {
        ...(listParams.fromDate ? { from_date: listParams.fromDate } : {}),
        ...(listParams.toDate ? { to_date: listParams.toDate } : {}),
      },
    });
    return res.data ?? [];
  }, [listParams.fromDate, listParams.toDate]);

  const preFilter = useCallback(
    (rows) => filterDailyProdByStickerStatus(rows, listParams.stickerStatus),
    [listParams.stickerStatus]
  );

  const {
    loading,
    reload,
    tempSearch,
    setTempSearch,
    params,
    selected,
    setSelected,
    selectedRecord,
    rowByKey,
    filteredData,
    items,
    totalItems,
    handleLoadMore,
    toggleSort,
    resetDisplayLimit,
    refreshAndKeepSelection,
  } = useMasterClientList({
    loadData,
    errorMessage: "Failed to load production data",
    getSearchParts: dailyProdSearchParts,
    preFilter,
    getRowKey: dailyProdRowKey,
  });

  const handleReset = useCallback(() => {
    setTempSearch("");
    setListParams({
      stickerStatus: "pending",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
    });
    setSelected(null);
    resetDisplayLimit();
  }, [dateFilterDefaults.from, dateFilterDefaults.to, resetDisplayLimit, setSelected, setTempSearch]);

  const extraFilters = useMemo(
    () => [{ label: "Sticker Status", key: "stickerStatus", value: listParams.stickerStatus, options: STICKER_STATUS_FILTER_OPTIONS }],
    [listParams.stickerStatus]
  );

  const imsDateFilter = useMemo(
    () => ({ from_date: listParams.fromDate || undefined, to_date: listParams.toDate || undefined }),
    [listParams.fromDate, listParams.toDate]
  );

  const openStickerModal = useCallback(() => setIsStickerModalOpen(true), []);
  const openRemoveConfirm = useCallback(() => setRemoveStickersConfirmOpen(true), []);
  const getSelectedRow = useCallback(() => (selected ? rowByKey?.get(selected) ?? null : null), [selected, rowByKey]);

  const { openNewModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "packing_entry",
    addActions: ["add", "edit"],
    modalOpen: isStickerModalOpen || isDetailModalOpen || removeStickersConfirmOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: openStickerModal,
    canOpenNew: () => Boolean(selected),
    newBlockedMessage: "Select a row in the list first — New Sticker opens only after a row is selected.",
    openDelete: openRemoveConfirm,
    canDeleteSelection: () => Boolean(selected && selectedRecord?.sticker_generated),
  });

  const handleRemoveGeneratedStickersForRow = async () => {
    if (!canRemoveGeneratedStickers) {
      toast.error("You do not have permission to remove stickers. Delete permission is required.");
      return;
    }
    if (!selectedRecord?.doc_no || !selectedRecord?.sticker_generated || !selected) return;

    setRemoveStickersLoading(true);
    try {
      const res = await boxService.removeGeneratedStickers({ doc_no: selectedRecord.doc_no });
      if (!res?.success) throw new Error(res?.message || "Remove failed");
      toast.success(res.message || "Stickers removed.");
      setRemoveStickersConfirmOpen(false);
      await refreshAndKeepSelection(selected);
    } catch (err) {
      toast.error(err.message || "Remove failed");
    } finally {
      setRemoveStickersLoading(false);
    }
  };

  const handleStickerSuccess = useCallback(async () => {
    await refreshAndKeepSelection(selected);
    setIsStickerModalOpen(false);
    toast.success("Sticker created successfully!");
  }, [selected, refreshAndKeepSelection]);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Daily Production",
    rows: filteredData,
    headers: DAILY_PRODUCTION_HEADERS,
  });

  return (
    <div className={`${IMS_LIST_PAGE_SHELL} font-sans`}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <div className="flex items-center gap-2">
                {canNewSticker ? (
                  <button
                    type="button"
                    disabled={!selected}
                    onClick={openNewModal}
                    title="Select a row in the list first to open New Sticker. Shortcut: Ctrl+Alt+N (browser) or Ctrl+N (PWA)."
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={16} strokeWidth={2} />
                    <span>New Sticker</span>
                  </button>
                ) : null}

                <ActionButton
                  variant="outline"
                  label="View Profile"
                  icon={Eye}
                  disabled={!selected}
                  onClick={() => setIsDetailModalOpen(true)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none"
                />

                {canRemoveGeneratedStickers && selectedRecord?.sticker_generated ? (
                  <button
                    type="button"
                    onClick={openRemoveConfirm}
                    disabled={!selected || removeStickersLoading || loading}
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 flex items-center justify-center gap-2 shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Delete production stickers for this packing (stock adjustment boxes stay)"
                  >
                    {removeStickersLoading ? (
                      <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
                    ) : (
                      <Trash2 size={14} className="shrink-0" aria-hidden />
                    )}
                    Cancel stickers
                  </button>
                ) : null}

                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
                <MasterRefreshButton loading={loading} onClick={() => reload(true)} />
              </div>
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
            <MasterSelectionBanner onClear={() => setSelected(null)}>
              Selected Document: {selectedRecord?.doc_no} | Job: {selectedRecord?.job_card_no}
            </MasterSelectionBanner>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${listParams.fromDate}-${listParams.toDate}`}
            fromDate={listParams.fromDate}
            toDate={listParams.toDate}
            extraFilters={extraFilters}
            onApply={(data) => {
              setListParams((prev) => ({
                ...prev,
                fromDate: data.fromDate,
                toDate: data.toDate,
                stickerStatus: data.stickerStatus,
              }));
              resetDisplayLimit();
            }}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search Doc or Job Card..."
            searchLabel="Production Search"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={DAILY_PRODUCTION_HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            {...tableHotkeyProps}
            showSelection
            allowCopy
            onSort={toggleSort}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            getRowId={dailyProdRowKey}
            selectedId={selected}
            onSelect={setSelected}
            emptyIcon={Package}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={DAILY_PROD_CARD_CONFIG}
          />
        </div>

        <MasterListFooter shown={items.length} total={totalItems} noun="entries" />
      </div>

      <GlobalDetailModal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Production Details" icon={Package}>
        {selectedRecord ? (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow="Daily production"
              icon={Package}
              title={selectedRecord.acc_name}
              badge={`Doc ${selectedRecord.doc_no} · ${formatDocDate(selectedRecord.doc_dt) || "—"}`}
            />
            <MasterDetailGrid columns={2}>
              <MasterDetailSection label="Document no." tone="indigo"><span>{selectedRecord.doc_no}</span></MasterDetailSection>
              <MasterDetailSection label="Entry date" tone="white"><span>{formatDocDate(selectedRecord.doc_dt) || "—"}</span></MasterDetailSection>
            </MasterDetailGrid>
            <MasterDetailSection label="Item code" tone="white"><span>{selectedRecord.item_code}</span></MasterDetailSection>
            {selectedRecord.item_desc ? (
              <MasterDetailProse label="Item description" tone="slate">{selectedRecord.item_desc}</MasterDetailProse>
            ) : null}
            <MasterDetailKV
              label="Total qty"
              value={parseFloat(selectedRecord.total_qty || 0).toLocaleString()}
              valueClassName="text-emerald-700 text-base tabular-nums"
            />
            {selectedRecord.sticker_generated ? (
              <MasterDetailGrid columns={2}>
                <MasterDetailKV label="Sticker created" value={formatDateTime(selectedRecord.sticker_created_at) || "—"} />
                <MasterDetailKV label="Created by" value={selectedRecord.sticker_created_by_name || "—"} />
                <MasterDetailKV label="Sticker updated" value={formatDateTime(selectedRecord.sticker_updated_at) || "—"} />
                <MasterDetailKV label="Updated by" value={selectedRecord.sticker_updated_by_name || "—"} />
              </MasterDetailGrid>
            ) : null}
          </MasterDetailBody>
        ) : null}
      </GlobalDetailModal>

      <StickerRemoveConfirmModal
        open={removeStickersConfirmOpen}
        docNo={selectedRecord?.doc_no}
        loading={removeStickersLoading}
        onClose={() => { if (!removeStickersLoading) setRemoveStickersConfirmOpen(false); }}
        onConfirm={() => void handleRemoveGeneratedStickersForRow()}
      />

      {isStickerModalOpen && selectedRecord ? (
        <StickerCreationModel
          open={isStickerModalOpen}
          data={selectedRecord}
          imsDateFilter={imsDateFilter}
          onClose={() => setIsStickerModalOpen(false)}
          onSuccess={handleStickerSuccess}
        />
      ) : null}
    </div>
  );
}
