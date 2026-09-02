"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Package, Eye, Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import { formatDateTime, formatDocDate } from "@/platform/utils/core/utilHelper";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { masterService, peekDailyProdListCache, invalidateDailyProdListCache } from "@/apps/ims/lib/services/master";
import { boxService } from "@/apps/ims/lib/services/box";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ActionButton from "@/ui/primitives/ActionButton";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection, MasterDetailGrid, MasterDetailKV, MasterDetailProse } from "./MasterDetailLayout";
import StickerRemoveConfirmModal from "./StickerRemoveConfirmModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey, nextSortParams } from "@/ui/common/list/clientListSearch";
import { toastDataRefreshed } from "@/platform/utils/core/toastNotify";
import { MasterSelectionBanner, MasterListFooter, MasterRefreshButton } from "@/apps/ims/lib/helpers/masterListUi";
import { DAILY_PRODUCTION_HEADERS, DAILY_PRODUCTION_PENDING_HEADERS, DAILY_PRODUCTION_COMPARISON_HEADERS, STICKER_STATUS_FILTER_OPTIONS, DAILY_PROD_PENDING_CARD_CONFIG, DAILY_PROD_GENERATED_CARD_CONFIG, DAILY_PROD_COMPARISON_CARD_CONFIG, dailyProdRowKey, dailyProdSearchParts, dailyProdComparisonSearchParts, filterDailyProdByStickerStatus, isDailyProdStickerGenerated, isDailyProdNeedsDeviation, DAILY_PROD_DEVIATION_ROW_CLASS, hasDailyProdComparisonMismatch } from "./masterColumns";
import { useSelector } from "react-redux";
import { selectUser } from "@/platform/store/slices/authSlice";
import { canCreatePackingDeviation } from "@/apps/ims/lib/utils/imsSpecialPermissions";

const LIST_FETCH_CAP = 50000;
const DISPLAY_CHUNK = 150;
const DAILY_PROD_CLIENT_CACHE_MS = 60_000;

/** Session cache — same filters reopen instantly while background refresh runs. */
const dailyProdClientCache = new Map();

function dailyProdCacheKey(query) {
  return `${query.stickerStatus}|${query.fromDate}|${query.toDate}`;
}

function apiStickerStatusForTab(tab) {
  if (tab === "comparison") return "comparison";
  if (tab === "generated") return "generated";
  if (tab === "all") return "all";
  return "pending";
}

async function loadDailyProdRows(query, { forceRefresh = false } = {}) {
  const base = {
    list_view: true,
    ...(forceRefresh ? { refresh: true } : {}),
    filters: buildDailyProdFetchFilters(query.stickerStatus, query.fromDate, query.toDate),
  };
  const loadOnePage = async (page, limit) => {
    const body = { ...base, page, limit };
    if (!forceRefresh && page === 1) {
      const warmed = peekDailyProdListCache(body);
      if (warmed) {
        return { data: warmed.data, total: warmed.total };
      }
    }
    const res = await masterService.getDailyProd(body);
    const list = res?.data ?? [];
    return {
      data: Array.isArray(list) ? list : [],
      total: res?.total ?? list.length,
    };
  };
  // Repeated GET list until all rows for current filters are loaded (backend caps page size).
  return fetchAllListPages(loadOnePage, 1000, LIST_FETCH_CAP);
}

function buildDailyProdFetchFilters(stickerStatus, fromDate, toDate) {
  const filters = {
    sticker_status: apiStickerStatusForTab(stickerStatus),
    ...(fromDate ? { from_date: fromDate } : {}),
    ...(toDate ? { to_date: toDate } : {}),
  };
  if (stickerStatus === "pending") filters.sticker_generated = false;
  else if (stickerStatus === "generated") filters.sticker_generated = true;
  return filters;
}

/** Sticker generate/remove moves rows between Pending ↔ Generated — clear every tab cache for this range. */
function invalidateDailyProdCachesForDateRange(fromDate, toDate) {
  dailyProdClientCache.clear();
  for (const status of ["pending", "generated", "all", "comparison"]) {
    invalidateDailyProdListCache({
      filters: buildDailyProdFetchFilters(status, fromDate, toDate),
    });
  }
}

const StickerCreationModel = dynamic(
  () => import("@/apps/ims/modules/stickers/StickerCreationModel"),
  { ssr: false }
);

const PackingDeviationDrawer = dynamic(
  () => import("@/apps/ims/modules/master/PackingDeviationDrawer"),
  { ssr: false }
);

export default function DailyProductionPage() {
  const user = useSelector(selectUser);
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("packing_entry", "view"), [canAccess]);
  const canRemoveGeneratedStickers = useMemo(() => canAccess("packing_entry", "delete").allowed, [canAccess]);
  const canNewSticker = useMemo(
    () => canAccess("packing_entry", "add").allowed || canAccess("packing_entry", "edit").allowed,
    [canAccess]
  );
  const canDeviation = useMemo(() => canCreatePackingDeviation(user), [user]);

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);
  const [viewMode, handleViewMode] = useViewMode();
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
  const [isDeviationOpen, setIsDeviationOpen] = useState(false);
  const [stickerGateLoading, setStickerGateLoading] = useState(false);
  const [removeStickersLoading, setRemoveStickersLoading] = useState(false);
  const [removeStickersConfirmOpen, setRemoveStickersConfirmOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_CHUNK);
  const [draftSearch, setDraftSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useState({ sortKey: "doc_dt", sortDir: "desc" });
  const initialQuerySet = useRef(false);

  /** Applied only when user clicks Search (or Reset). Default: Pending + date range. */
  const [appliedQuery, setAppliedQuery] = useState(null);

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    if (initialQuerySet.current) return;
    initialQuerySet.current = true;
    setAppliedQuery({
      stickerStatus: "pending",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
    });
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const fetchProduction = useCallback(async ({ preferCache = false, forceRefresh = false } = {}) => {
    if (!appliedQuery?.fromDate && !appliedQuery?.toDate) return;
    const cacheKey = dailyProdCacheKey(appliedQuery);
    const cached = dailyProdClientCache.get(cacheKey);
    const cacheFresh = !forceRefresh && cached && Date.now() - cached.at < DAILY_PROD_CLIENT_CACHE_MS;

    if (cacheFresh && preferCache && !forceRefresh) {
      setAllRows(cached.data);
      setDisplayLimit(DISPLAY_CHUNK);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (forceRefresh) {
      dailyProdClientCache.delete(cacheKey);
      invalidateDailyProdListCache({
        filters: buildDailyProdFetchFilters(
          appliedQuery.stickerStatus,
          appliedQuery.fromDate,
          appliedQuery.toDate
        ),
      });
    }

    try {
      const { data } = await loadDailyProdRows(appliedQuery, { forceRefresh });
      dailyProdClientCache.set(cacheKey, { at: Date.now(), data });
      setAllRows(data);
      setDisplayLimit(DISPLAY_CHUNK);
    } catch (err) {
      toast.error(err?.message || "Failed to load production data");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery]);

  useEffect(() => {
    if (!appliedQuery) return;
    void fetchProduction({ preferCache: true });
  }, [appliedQuery, fetchProduction]);

  const reload = useCallback(
    async (isManualRefresh = false) => {
      await fetchProduction({ forceRefresh: true });
      if (isManualRefresh) toastDataRefreshed();
    },
    [fetchProduction]
  );

  const rowByKey = useMemo(() => {
    const map = new Map();
    for (const row of allRows) map.set(dailyProdRowKey(row), row);
    return map;
  }, [allRows]);

  const selectedRecord = useMemo(() => {
    if (!selected) return null;
    return rowByKey.get(selected) ?? null;
  }, [selected, rowByKey]);

  const getSearchParts = useCallback(
    (row) => {
      if (appliedQuery?.stickerStatus === "comparison") return dailyProdComparisonSearchParts(row);
      return dailyProdSearchParts(row);
    },
    [appliedQuery?.stickerStatus]
  );

  const filteredRows = useMemo(() => {
    if (!appliedQuery) return [];
    let data = filterDailyProdByStickerStatus(allRows, appliedQuery.stickerStatus);
    const q = String(draftSearch || "").trim();
    if (q) {
      data = applyClientSearch(data, q, { getParts: getSearchParts, skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, appliedQuery, draftSearch, params.sortKey, params.sortDir, getSearchParts]);

  const handleDraftSearchChange = useCallback((value) => {
    setDraftSearch(value);
    setDisplayLimit(DISPLAY_CHUNK);
  }, []);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + DISPLAY_CHUNK);
    }
  }, [loading, items.length, totalItems]);

  const toggleSort = useCallback((key) => {
    setParams((prev) => nextSortParams(prev, key));
    setDisplayLimit(DISPLAY_CHUNK);
  }, []);

  const handleReset = useCallback(() => {
    setDraftSearch("");
    dailyProdClientCache.clear();
    setAppliedQuery({
      stickerStatus: "pending",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
    });
    setParams({ sortKey: "doc_dt", sortDir: "desc" });
    setSelected(null);
    setDisplayLimit(DISPLAY_CHUNK);
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const refreshAndKeepSelection = useCallback(
    async (selectionKey) => {
      if (!appliedQuery) return;
      setLoading(true);
      try {
        const cacheKey = dailyProdCacheKey(appliedQuery);
        invalidateDailyProdCachesForDateRange(appliedQuery.fromDate, appliedQuery.toDate);
        dailyProdClientCache.delete(cacheKey);
        const { data } = await loadDailyProdRows(appliedQuery, { forceRefresh: true });
        dailyProdClientCache.set(cacheKey, { at: Date.now(), data });
        setAllRows(data);
        setDisplayLimit(DISPLAY_CHUNK);
        if (!selectionKey) {
          setSelected(null);
          return;
        }
        const nextKey = data.some((row) => dailyProdRowKey(row) === selectionKey) ? selectionKey : null;
        setSelected(nextKey);
      } catch (err) {
        toast.error(err?.message || "Failed to load production data");
        setAllRows([]);
        setSelected(null);
      } finally {
        setLoading(false);
      }
    },
    [appliedQuery]
  );

  useEffect(() => {
    if (!selected || !selectedRecord || !appliedQuery) return;
    const isGenerated = isDailyProdStickerGenerated(selectedRecord);
    if (appliedQuery.stickerStatus === "pending" && isGenerated) setSelected(null);
    if (appliedQuery.stickerStatus === "generated" && !isGenerated) setSelected(null);
    if (
      appliedQuery.stickerStatus === "comparison" &&
      (!isGenerated || !hasDailyProdComparisonMismatch(selectedRecord))
    ) {
      setSelected(null);
    }
  }, [appliedQuery?.stickerStatus, selected, selectedRecord, appliedQuery]);

  const extraFilters = useMemo(
    () => [
      {
        label: "Sticker Status",
        key: "stickerStatus",
        value: appliedQuery?.stickerStatus ?? "pending",
        options: STICKER_STATUS_FILTER_OPTIONS,
      },
    ],
    [appliedQuery?.stickerStatus]
  );

  const isComparisonView = appliedQuery?.stickerStatus === "comparison";
  const isPendingView = appliedQuery?.stickerStatus === "pending";

  const tableHeaders = useMemo(() => {
    if (isComparisonView) return DAILY_PRODUCTION_COMPARISON_HEADERS;
    if (appliedQuery?.stickerStatus === "pending") return DAILY_PRODUCTION_PENDING_HEADERS;
    return DAILY_PRODUCTION_HEADERS;
  }, [isComparisonView, appliedQuery?.stickerStatus]);

  const cardConfig = useMemo(() => {
    const status = appliedQuery?.stickerStatus ?? "pending";
    if (status === "pending") return DAILY_PROD_PENDING_CARD_CONFIG;
    if (status === "comparison") return DAILY_PROD_COMPARISON_CARD_CONFIG;
    return DAILY_PROD_GENERATED_CARD_CONFIG;
  }, [appliedQuery?.stickerStatus]);

  const searchPlaceholder = useMemo(
    () =>
      appliedQuery?.stickerStatus === "comparison"
        ? "Search customer, doc, job, item..."
        : "Search Doc or Job Card...",
    [appliedQuery?.stickerStatus]
  );

  const emptyState = useMemo(() => {
    const status = appliedQuery?.stickerStatus ?? "pending";
    if (status === "generated") {
      return {
        message: "No generated stickers in this date range",
        subMessage: "Values from database snapshot saved at sticker generate — not live IMS packing",
      };
    }
    if (status === "comparison") {
      return {
        message: "No ERP vs DB mismatches in this date range",
        subMessage: "ERP vs DB snapshot — red rows show date, job, item or qty mismatch (customer ignored)",
      };
    }
    if (status === "all") {
      return {
        message: "No packing entries in this date range",
        subMessage: "All IMS pack rows — pending and generated",
      };
    }
    return {
      message: "No pending packing entries",
      subMessage: "IMS pack rows without stickers show here — generate sticker to move to Generated",
    };
  }, [appliedQuery?.stickerStatus]);

  const imsDateFilter = useMemo(
    () => ({
      from_date: appliedQuery?.fromDate || undefined,
      to_date: appliedQuery?.toDate || undefined,
    }),
    [appliedQuery?.fromDate, appliedQuery?.toDate]
  );

  const tryOpenStickerModal = useCallback(
    async (row) => {
      if (!canNewSticker) return;
      const itemdcode = row?.itemdcode ?? row?.item_dcode;
      if (itemdcode == null || String(itemdcode).trim() === "") {
        toast.info("Select a packing row with a valid item first.");
        return;
      }
      if (isDailyProdStickerGenerated(row)) {
        setIsStickerModalOpen(true);
        return;
      }

      setStickerGateLoading(true);
      try {
        const res = await boxService.previewMonthlyPackingLimit({
          doc_no: row.doc_no,
          itemdcode,
          total_qty: row.total_qty,
          doc_dt: row.doc_dt,
        });
        const limit = res?.data;
        // Fail closed: only open when backend explicitly says ok === true
        if (limit && limit.ok === true) {
          setIsStickerModalOpen(true);
          return;
        }

        const excess = Number(limit?.excess_qty) || 0;
        const baseQty = limit?.base_qty ?? limit?.base_allowed_limit;
        const pct = Number(limit?.shortage_qty_percentage);
        const tolQty = Number(limit?.tolerance_qty);
        const pctPart = Number.isFinite(pct)
            ? `base ${baseQty ?? "—"}, ${pct}% = ${Number.isFinite(tolQty) ? tolQty : "—"}, `
            : `base ${baseQty ?? "—"}, `;
        const msg =
          `New Sticker cannot open — monthly packing qty is short` +
          (excess > 0 ? ` by ${excess}` : "") +
          ` (${pctPart}allowed ${limit?.allowed_limit ?? "—"}, projected ${limit?.projected_total ?? "—"}).`;

        if (canDeviation) {
          toast.warning(`${msg} Create Deviation first, then try New Sticker again.`, {
            autoClose: 9000,
          });
        } else {
          toast.info(`${msg} Contact a user with Packing Deviation permission.`, {
            autoClose: 9000,
          });
        }
      } catch (err) {
        toast.error(err?.message || "Could not verify monthly packing qty.");
      } finally {
        setStickerGateLoading(false);
      }
    },
    [canNewSticker, canDeviation]
  );

  const openStickerModal = useCallback(() => {
    const row = selected ? rowByKey.get(selected) ?? null : null;
    void tryOpenStickerModal(row);
  }, [selected, rowByKey, tryOpenStickerModal]);

  const openDeviationDrawer = useCallback(() => {
    if (!canDeviation || !selected) return;
    setIsDeviationOpen(true);
  }, [canDeviation, selected]);

  const handleRowDoubleClick = useCallback(
    (_item, id) => {
      if (!canNewSticker) return;
      setSelected(id);
      const row = rowByKey.get(id) ?? null;
      void tryOpenStickerModal(row);
    },
    [canNewSticker, rowByKey, tryOpenStickerModal]
  );

  const openRemoveConfirm = useCallback(() => setRemoveStickersConfirmOpen(true), []);
  const getSelectedRow = useCallback(() => (selected ? rowByKey.get(selected) ?? null : null), [selected, rowByKey]);

  const { openNewModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "packing_entry",
    addActions: ["add", "edit"],
    modalOpen: isStickerModalOpen || isDetailModalOpen || removeStickersConfirmOpen || isDeviationOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: openStickerModal,
    canOpenNew: () => Boolean(selected),
    newBlockedMessage: "Select a row in the list first — New Sticker opens only after a row is selected.",
    openDelete: openRemoveConfirm,
    canDeleteSelection: () => Boolean(selected && isDailyProdStickerGenerated(selectedRecord)),
  });

  const handleRemoveGeneratedStickersForRow = async () => {
    if (!canRemoveGeneratedStickers) {
      toast.error("You do not have permission to remove stickers. Delete permission is required.");
      return;
    }
    if (!selectedRecord?.doc_no || !isDailyProdStickerGenerated(selectedRecord) || !selected) return;

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
    await reload(false);
    setSelected(null);
    setIsStickerModalOpen(false);
    toast.success("Stickers generated — row moved to Generated filter.");
  }, [reload]);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Daily Production",
    rows: filteredRows,
    headers: tableHeaders,
  });

  const handleFilterApply = useCallback((data) => {
    setDisplayLimit(DISPLAY_CHUNK);
    setAppliedQuery({
      fromDate: data.fromDate,
      toDate: data.toDate,
      stickerStatus: data.stickerStatus || "pending",
    });
    setSelected(null);
  }, []);

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
                    disabled={!selected || stickerGateLoading}
                    onClick={openNewModal}
                    title="Select a row in the list first to open New Sticker. Shortcut: Ctrl+Alt+N (browser) or Ctrl+N (PWA)."
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {stickerGateLoading ? (
                      <Loader2 size={16} className="animate-spin" strokeWidth={2} />
                    ) : (
                      <Plus size={16} strokeWidth={2} />
                    )}
                    <span>New Sticker</span>
                  </button>
                ) : null}

                {canDeviation ? (
                  <button
                    type="button"
                    disabled={!selected}
                    onClick={openDeviationDrawer}
                    title="Create Deviation shortage for the selected item (special permission). Auto-approved on save."
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white border border-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <AlertTriangle size={15} strokeWidth={2} />
                    <span>Create Deviation</span>
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

                {canRemoveGeneratedStickers && selected && isDailyProdStickerGenerated(selectedRecord) ? (
                  <button
                    type="button"
                    onClick={openRemoveConfirm}
                    disabled={removeStickersLoading || loading}
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

          {selected && isComparisonView ? (
            <MasterSelectionBanner onClear={() => setSelected(null)}>
              Mismatch · Doc {selectedRecord?.doc_no} — ERP vs DB (red = mismatch, customer not counted)
            </MasterSelectionBanner>
          ) : selected ? (
            <MasterSelectionBanner onClear={() => setSelected(null)}>
              Selected Document: {selectedRecord?.doc_no} | Job: {selectedRecord?.job_card_no}
            </MasterSelectionBanner>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            fromDate={appliedQuery?.fromDate ?? dateFilterDefaults.from}
            toDate={appliedQuery?.toDate ?? dateFilterDefaults.to}
            extraFilters={extraFilters}
            applyOnSearchEnter={false}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={draftSearch}
            onSearchChange={handleDraftSearchChange}
            searchPlaceholder={searchPlaceholder}
            searchLabel="Production Search"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={tableHeaders}
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
            onRowDoubleClick={handleRowDoubleClick}
            emptyIcon={Package}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            emptyMessage={emptyState.message}
            emptySubMessage={emptyState.subMessage}
            cardConfig={cardConfig}
            getRowClassName={
              isComparisonView
                ? (row) =>
                    hasDailyProdComparisonMismatch(row)
                      ? "bg-rose-50 group-hover:bg-rose-50 [&_td]:!bg-rose-50"
                      : ""
                : isPendingView
                  ? (row) =>
                      !isDailyProdStickerGenerated(row) && isDailyProdNeedsDeviation(row)
                        ? DAILY_PROD_DEVIATION_ROW_CLASS
                        : ""
                  : undefined
            }
          />
        </div>

        <MasterListFooter shown={items.length} total={totalItems} noun="entries" />
      </div>

      <GlobalDetailModal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Production Details" icon={Package}>
        {selectedRecord ? (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow={isDailyProdStickerGenerated(selectedRecord) ? "Saved in database" : "Daily production (IMS)"}
              icon={Package}
              title={selectedRecord.acc_name}
              badge={`Doc ${selectedRecord.doc_no} · ${formatDocDate(selectedRecord.doc_dt) || "—"}`}
            />
            {isDailyProdStickerGenerated(selectedRecord) ? (
              <MasterDetailProse label="About this record" tone="indigo">
                Values below are frozen in our database when stickers were generated — not live ERP packing data.
                Use the Comparison tab to see ERP vs saved snapshot.
              </MasterDetailProse>
            ) : null}
            <MasterDetailGrid columns={2}>
              <MasterDetailSection label="Document no." tone="indigo"><span>{selectedRecord.doc_no}</span></MasterDetailSection>
              <MasterDetailSection label="Entry date" tone="white"><span>{formatDocDate(selectedRecord.doc_dt) || "—"}</span></MasterDetailSection>
            </MasterDetailGrid>
            <MasterDetailSection label="Job card" tone="white"><span>{selectedRecord.job_card_no || "—"}</span></MasterDetailSection>
            <MasterDetailSection label="Item code" tone="white"><span>{selectedRecord.item_code}</span></MasterDetailSection>
            {selectedRecord.item_desc ? (
              <MasterDetailProse label="Item description" tone="slate">{selectedRecord.item_desc}</MasterDetailProse>
            ) : null}
            <MasterDetailKV
              label="Total qty"
              value={parseFloat(selectedRecord.total_qty || 0).toLocaleString()}
              valueClassName="text-emerald-700 text-base tabular-nums"
            />
            <MasterDetailGrid columns={2}>
              <MasterDetailKV
                label="Sticker Create (Internal)"
                value={selectedRecord.internal_create_user || "—"}
                valueClassName="text-slate-700 font-bold"
              />
              <MasterDetailKV
                label="Create Time"
                value={formatDateTime(selectedRecord.internal_create_date) || "—"}
                valueClassName="text-slate-700 font-bold"
              />
            </MasterDetailGrid>
            {isDailyProdStickerGenerated(selectedRecord) ? (
              <>
                <MasterDetailGrid columns={2}>
                  <MasterDetailKV
                    label="Sticker Generate (System)"
                    value={selectedRecord.system_generate_user_name || "—"}
                    valueClassName="text-indigo-700 font-bold"
                  />
                  <MasterDetailKV
                    label="Generate Time"
                    value={formatDateTime(selectedRecord.system_generate_date) || "—"}
                    valueClassName="text-indigo-700 font-bold"
                  />
                </MasterDetailGrid>
                <MasterDetailKV
                  label="Customer (saved)"
                  value={selectedRecord.acc_name || "—"}
                  valueClassName="text-slate-800 font-bold uppercase"
                />
                {selectedRecord.packing_category ? (
                  <MasterDetailKV
                    label="Packing category (saved)"
                    value={selectedRecord.packing_category}
                    valueClassName="text-amber-800 font-bold uppercase"
                  />
                ) : null}
                <MasterDetailGrid columns={2}>
                  <MasterDetailKV
                    label="Full boxes"
                    value={(() => {
                      const count = parseInt(String(selectedRecord.full_boxes_count ?? "0"), 10) || 0;
                      const perBox = parseFloat(selectedRecord.qty_per_box || 0);
                      const qty = Number.isFinite(perBox) && perBox > 0 ? count * perBox : 0;
                      return `${count} box${count === 1 ? "" : "es"} · Qty: ${qty.toLocaleString()}`;
                    })()}
                    valueClassName="text-blue-700 font-bold tabular-nums"
                  />
                  <MasterDetailKV
                    label="Loose boxes"
                    value={(() => {
                      const loose = parseFloat(selectedRecord.loose_box_qty || 0);
                      const hasLoose = Number.isFinite(loose) && loose > 0;
                      return hasLoose
                        ? `1 box · Qty: ${loose.toLocaleString()}`
                        : "0 boxes · Qty: 0";
                    })()}
                    valueClassName="text-orange-700 font-bold tabular-nums"
                  />
                  {selectedRecord.qty_per_box != null && selectedRecord.qty_per_box !== "" ? (
                    <MasterDetailKV
                      label="Per full box"
                      value={`${parseFloat(selectedRecord.qty_per_box || 0).toLocaleString()} ${selectedRecord.sticker_unit || "PCS"}`}
                      valueClassName="tabular-nums"
                    />
                  ) : null}
                </MasterDetailGrid>
                {selectedRecord.party_rate_cust_code ? (
                  <MasterDetailKV label="Cust. code (narration)" value={selectedRecord.party_rate_cust_code} />
                ) : null}
                {selectedRecord.fg_location ? (
                  <MasterDetailKV label="FG location" value={selectedRecord.fg_location} />
                ) : null}
              </>
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

      {isStickerModalOpen && selectedRecord && canNewSticker ? (
        <StickerCreationModel
          open={isStickerModalOpen && canNewSticker}
          data={selectedRecord}
          imsDateFilter={imsDateFilter}
          onClose={() => setIsStickerModalOpen(false)}
          onSuccess={handleStickerSuccess}
        />
      ) : null}

      {isDeviationOpen && selectedRecord && canDeviation ? (
        <PackingDeviationDrawer
          open={isDeviationOpen && canDeviation}
          packingRow={selectedRecord}
          onClose={() => setIsDeviationOpen(false)}
          onSuccess={() => {
            toast.success("Deviation saved. You can open New Sticker now.");
          }}
        />
      ) : null}
    </div>
  );
}
