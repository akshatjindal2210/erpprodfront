"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCcw, History, Eye } from "lucide-react";
import { toast } from "react-toastify";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";

import { coilTransactionLogService } from "@/apps/rmstore/lib/services/coilLogs";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import RmStoreListFooter, { FOOTER_TEXT_CLASS, formatRmStoreListFooterText, rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import CoilTransactionLogDetailModal from "@/apps/rmstore/modules/logs/CoilTransactionLogDetailModal";
import CoilStickerNosCell, { getCoilStickerEntries } from "@/apps/rmstore/modules/logs/CoilStickerNosCell";
import { applyCoilTransactionLogView, COIL_TX_DISPLAY_MODES } from "@/apps/rmstore/lib/utils/coilTransactionLogSearch";
import { fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_NUMBER, IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { TransactionLogModuleEntityCell } from "@/ui/common/list/ActivityLogModuleEntityCell";
import { getCoilTxTypeBadgeClass, resolveCoilTxTypeLabel } from "@/apps/rmstore/lib/utils/coilTransactionVisuals";

const MODULE = "rm_coil_transaction_logs";
const LIST_PAGE_SIZE = 1000;
const DISPLAY_CHUNK = 100;

export default function CoilTransactionLogPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeLabels, setTypeLabels] = useState({});
  const [viewMode, handleViewMode] = useViewMode();
  const loadGenRef = useRef(0);

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "created_at",
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

  const [tempSearch, setTempSearch] = useState("");
  const [journeyInput, setJourneyInput] = useState("");
  const [appliedJourney, setAppliedJourney] = useState("");
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_CHUNK);
  const [displayMode, setDisplayMode] = useState(COIL_TX_DISPLAY_MODES.SUMMARY);
  const [selected, setSelected] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = useCallback((row) => {
    if (!row) return;
    setViewRow(row);
    setDetailOpen(true);
  }, []);

  const filteredItems = useMemo(() => {
    const viewed = applyCoilTransactionLogView(allRows, {
      query: tempSearch,
      typeLabels,
      mode: displayMode,
    });
    return sortRowsByKey(viewed, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, typeLabels, displayMode, params.sortKey, params.sortDir]);

  const rows = useMemo(
    () => filteredItems.slice(0, displayLimit),
    [filteredItems, displayLimit]
  );

  const totalItems = filteredItems.length;

  const selectedRecord = useMemo(
    () => rows.find((r) => String(r.id) === String(selected)),
    [rows, selected]
  );

  const hasActiveSearch = Boolean(String(tempSearch ?? "").trim());
  const journeyTyping = Boolean(String(journeyInput ?? "").trim());
  const isJourneyMode = Boolean(String(appliedJourney ?? "").trim());
  const isUniqueView = displayMode === COIL_TX_DISPLAY_MODES.UNIQUE;
  const hasDateRange = Boolean(params.fromDate || params.toDate);

  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows: filteredItems,
        serverFiltered: isJourneyMode || hasDateRange,
      }),
    [tempSearch, allRows, filteredItems, isJourneyMode, hasDateRange]
  );

  const footerText = useMemo(() => {
    const prefix = isUniqueView ? "Unique ·" : "Summary ·";
    if (isJourneyMode && !hasActiveSearch) {
      return formatRmStoreListFooterText({
        shown: rows.length,
        total: totalItems,
        label: "Journey Matches",
        journeyMode: true,
        prefix,
      });
    }
    return formatRmStoreListFooterText({
      shown: rows.length,
      total: totalItems,
      label: isUniqueView ? "Coil Rows" : "Transaction Log Rows",
      prefix,
      ...footerFilter,
    });
  }, [
    rows.length,
    totalItems,
    isUniqueView,
    isJourneyMode,
    hasActiveSearch,
    footerFilter,
  ]);

  const extraFilters = useMemo(
    () => [
      {
        type: "text",
        label: "Journey",
        placeholder: "MRN or coil sticker no",
        value: journeyInput,
        onChange: setJourneyInput,
        onEnter: () => setAppliedJourney(String(journeyInput ?? "").trim()),
      },
      {
        label: "View",
        key: "displayMode",
        value: displayMode,
        options: [
          { label: "Summary", value: COIL_TX_DISPLAY_MODES.SUMMARY },
          { label: "Unique", value: COIL_TX_DISPLAY_MODES.UNIQUE },
        ],
      },
    ],
    [journeyInput, displayMode]
  );

  const fetchLogs = useCallback(async () => {
    const journey = String(appliedJourney ?? "").trim();
    if (!journey && !params.fromDate && !params.toDate) return;
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await coilTransactionLogService.getAll({
          page,
          limit,
          sortBy: "created_at",
          order: "DESC",
          filters: journey
            ? { journey }
            : {
                ...(params.fromDate && { fromDate: `${params.fromDate} 00:00:00` }),
                ...(params.toDate && { toDate: `${params.toDate} 23:59:59` }),
              },
        });
        if (body.typeLabels) setTypeLabels(body.typeLabels);
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, LIST_PAGE_SIZE);
      if (gen !== loadGenRef.current) return;
      setAllRows(data);
      setDisplayLimit(DISPLAY_CHUNK);
      setSelected(null);
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      toast.error(err?.message || "Could not load the coil transaction logs. Please try again.");
      setAllRows([]);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [appliedJourney, params.fromDate, params.toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setDisplayLimit(DISPLAY_CHUNK);
  }, [tempSearch, displayMode]);

  useEffect(() => {
    setSelected(null);
  }, [displayMode, tempSearch]);

  const handleLoadMore = useCallback(() => {
    if (!loading && rows.length < totalItems) {
      setDisplayLimit((n) => n + DISPLAY_CHUNK);
    }
  }, [loading, rows.length, totalItems]);

  const handleFilterApply = (data) => {
    const nextJourney = String(journeyInput ?? "").trim();
    setDisplayLimit(DISPLAY_CHUNK);
    if (nextJourney) {
      setAppliedJourney(nextJourney);
      return;
    }
    setAppliedJourney("");
    setParams((prev) => ({
      ...prev,
      fromDate: data?.fromDate ?? prev.fromDate,
      toDate: data?.toDate ?? prev.toDate,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setJourneyInput("");
    setAppliedJourney("");
    setDisplayMode(COIL_TX_DISPLAY_MODES.SUMMARY);
    setDisplayLimit(DISPLAY_CHUNK);
    setParams((prev) => ({
      ...prev,
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "created_at",
      sortDir: "desc",
    }));
  };

  const labelForType = useCallback(
    (t, row = null) => resolveCoilTxTypeLabel(t, row, typeLabels),
    [typeLabels]
  );

  const copyModuleEntity = useCallback((row) => {
    const parts = [row?.source_module?.replace(/_/g, " ") || "—"];
    const ref = String(row?.source_id ?? "").trim();
    if (ref && ref !== "N/A") parts.push(`REF: ${ref}`);
    return parts.join(" | ");
  }, []);

  const HEADERS = useMemo(
    () => [
      [
        "#",
        "_row",
        (_v, _row, i) => <span className={IMS_TABLE_CELL_TEXT}>{i + 1}</span>,
        {
          fixed: true,
          width: "50px",
          align: "center",
          sortable: false,
          copyValue: (_row, _val, rowIndex) => String((rowIndex ?? 0) + 1),
        },
      ],
      [
        "Type",
        "transaction_type",
        (v, row) => {
          const cls = getCoilTxTypeBadgeClass(v, row);
          return (
            <span className={`px-2 py-0.5 border text-[9px] font-bold ${cls}`} title={labelForType(v, row)}>
              {labelForType(v, row)}
            </span>
          );
        },
        {
          width: "168px",
          align: "center",
          copyValue: (row) => labelForType(row.transaction_type, row),
          cardRender: (v, row) => (
            <span className={`px-2 py-0.5 border text-[9px] font-bold ${getCoilTxTypeBadgeClass(v, row)}`}>
              {labelForType(v, row)}
            </span>
          ),
        },
      ],
      [
        "Coil Sticker No.",
        "coil_no_uids_display",
        (_v, row) => <CoilStickerNosCell row={row} />,
        {
          width: "340px",
          wrap: true,
          copyValue: (row) => getCoilStickerEntries(row).map((e) => e.coil_no_uid).join(", ") || "—",
        },
      ],
      [
        "Coil Count",
        "coil_count",
        (v) => <span className={IMS_TABLE_CELL_NUMBER}>{v != null ? v : "—"}</span>,
        {
          width: "56px",
          align: "center",
          copyValue: (row) => (row.coil_count != null ? String(row.coil_count) : "—"),
        },
      ],
      [
        "Qty",
        "total_qty",
        (v) => <span className={IMS_TABLE_CELL_NUMBER}>{v != null ? v : "—"}</span>,
        {
          width: "56px",
          align: "center",
          copyValue: (row) => (row.total_qty != null ? String(row.total_qty) : "—"),
        },
      ],
      [
        "Module / Entity",
        "source_module",
        (_v, row) => <TransactionLogModuleEntityCell row={row} appType="rmstore" />,
        {
          width: "180px",
          copyValue: (row) => copyModuleEntity(row),
        },
      ],
      ["Created By", "user_name", (v) => <span className={IMS_TABLE_CELL_TEXT}>{v || "—"}</span>, { width: "110px" }],
      [
        "Created At",
        "created_at",
        (v) => <span className={IMS_TABLE_CELL_DATE}>{v ? formatDateTime(v) : "—"}</span>,
        { width: "150px" },
      ],
    ],
    [labelForType, copyModuleEntity]
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Coil Transaction Log",
    rows,
    headers: HEADERS,
    onExport: async () => filteredItems,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={!selectedRecord}
                    title={selectedRecord ? "View selected log" : "Select a row first"}
                    onClick={() => openDetail(selectedRecord)}
                    className="h-8 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Eye size={14} className="shrink-0 text-indigo-600" aria-hidden />
                    View
                  </button>

                  <div className="w-px h-6 bg-slate-200" />

                  <button
                    type="button"
                    onClick={() => fetchLogs()}
                    disabled={loading}
                    className="h-8 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  >
                    <RefreshCcw size={14} className={`shrink-0 ${loading ? "animate-spin text-indigo-600" : ""}`} aria-hidden />
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
                viewToggleClassName="h-8"
              />
            }
          />
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${params.fromDate}-${params.toDate}-${appliedJourney}`}
            showDate
            fromDate={params.fromDate}
            toDate={params.toDate}
            dateDisabled={journeyTyping}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            onExtraFilterChange={(key, value) => {
              if (key === "displayMode") {
                setDisplayMode(value || COIL_TX_DISPLAY_MODES.SUMMARY);
                setDisplayLimit(DISPLAY_CHUNK);
              }
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Coil sticker, type, module, or user"
            searchLabel="Quick Search"
            searchVariant="quick"
            showSearchButton
            applyOnSearchEnter
            applyExtrasOnChange={false}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={rows}
            loading={loading}
            allowCopy={true}
            viewMode={viewMode}
            onSort={(key) =>
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "desc" ? "asc" : "desc",
              }))
            }
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            showSelection
            selectedId={selected}
            onSelect={setSelected}
            idKey="id"
            emptyIcon={History}
            onLoadMore={handleLoadMore}
            hasMore={rows.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "user_name",
              badgeIndices: [1],
              detailIndices: [2, 3, 4, 5],
              footerKey: "created_at",
              className: "rounded-none border border-slate-200 shadow-none",
            }}
          />
        </div>

        <RmStoreListFooter showLive={false}>
          <span className={FOOTER_TEXT_CLASS}>{footerText}</span>
        </RmStoreListFooter>
      </div>

      <CoilTransactionLogDetailModal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setViewRow(null);
        }}
        row={viewRow}
        labelForType={labelForType}
      />
    </div>
  );
}
