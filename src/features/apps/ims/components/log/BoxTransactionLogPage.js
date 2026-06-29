"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCcw, History, Layers, Eye } from "lucide-react";
import { toast } from "react-toastify";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";

import { boxTransactionLogService } from "@/features/apps/ims/services/boxTransactionLog";
import { useViewMode } from "@/core/hooks/useViewMode";
import DataTable from "@/core/components/ui/DataTable";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import BoxTransactionLogDetailModal from "@/features/apps/ims/components/log/BoxTransactionLogDetailModal";
import BoxStickerNosCell, { getBoxStickerEntries } from "@/features/apps/ims/components/log/BoxStickerNosCell";
import { applyBoxTransactionLogView, BOX_TX_DISPLAY_MODES, isUniquePerLogSearch } from "@/features/apps/ims/utils/boxTransactionLogSearch";
import { fetchAllListPages, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { formatDateTime } from "@/core/utils/utilHelper";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_NUMBER, IMS_TABLE_CELL_TEXT } from "@/features/apps/ims/helpers/listPageShellClasses";
import {
  getBoxTxTypeBadgeClass,
  resolveBoxTxTypeLabel,
} from "@/features/apps/ims/utils/boxTransactionVisuals";

const LIST_PAGE_SIZE = 1000;
const DISPLAY_CHUNK = 100;

export default function BoxTransactionLogPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("box_transaction_logs", "view"), [canAccess]);

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
  const [displayMode, setDisplayMode] = useState(BOX_TX_DISPLAY_MODES.SUMMARY);
  const [selected, setSelected] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = useCallback((row) => {
    if (!row) return;
    setViewRow(row);
    setDetailOpen(true);
  }, []);

  const filteredItems = useMemo(() => {
    const viewed = applyBoxTransactionLogView(allRows, {
      query: tempSearch,
      typeLabels,
      mode: displayMode,
      skipSort: !!params.sortKey,
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
  const isUniqueView = displayMode === BOX_TX_DISPLAY_MODES.UNIQUE;
  const isUniquePerLog = hasActiveSearch && isUniquePerLogSearch(tempSearch);

  const uniqueSourceLogCount = useMemo(() => {
    if (!isUniqueView) return 0;
    const ids = new Set(
      filteredItems.map((r) => {
        const raw = r?._sourceLogId ?? r?.id;
        return String(raw ?? "").split("::")[0];
      })
    );
    return ids.size;
  }, [filteredItems, isUniqueView]);

  const extraFilters = useMemo(
    () => [
      {
        type: "text",
        label: "Journey Name",
        placeholder: "Packing no or box sticker no",
        value: journeyInput,
        onChange: setJourneyInput,
      },
      {
        label: "View",
        key: "displayMode",
        value: displayMode,
        options: [
          { label: "Summary", value: BOX_TX_DISPLAY_MODES.SUMMARY },
          { label: "Unique", value: BOX_TX_DISPLAY_MODES.UNIQUE },
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
        const body = await boxTransactionLogService.getAll({
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
      toast.error(err?.message || "Failed to load box transaction logs");
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
    const journey = String(journeyInput ?? "").trim();
    const searchSubmit = data?.searchSubmit === true;

    if (data?.displayMode) {
      setDisplayMode(data.displayMode);
      setDisplayLimit(DISPLAY_CHUNK);
      // View dropdown only — pending journey text should not auto-search
      if (!searchSubmit && journey && journey !== appliedJourney) {
        return;
      }
    }

    setDisplayLimit(DISPLAY_CHUNK);
    if (journey) {
      setAppliedJourney(journey);
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
    setDisplayMode(BOX_TX_DISPLAY_MODES.SUMMARY);
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
    (t, row = null) => resolveBoxTxTypeLabel(t, row, typeLabels),
    [typeLabels]
  );

  const copyModuleEntity = useCallback((row) => {
    const parts = [
      row?.source_module?.replace(/_/g, " ") || "—",`REF: ${row?.source_id || "N/A"}`,
    ];
    // if (row?.packing_number) parts.push(`PKG: ${row.packing_number}`);
    return parts.join(" | ");
  }, []);

  const HEADERS = useMemo(
    () => [
      [ "#", "_row", (_v, _row, i) => <span className={IMS_TABLE_CELL_TEXT}>{i + 1}</span>, {
          fixed: true,
          width: "50px",
          align: "center",
          sortable: false,
          copyValue: (_row, _val, rowIndex) => String((rowIndex ?? 0) + 1),
        },
      ],

      [ "Type", "transaction_type", (v, row) => {
          const cls = getBoxTxTypeBadgeClass(v, row);
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
            <span className={`px-2 py-0.5 border text-[9px] font-bold ${getBoxTxTypeBadgeClass(v, row)}`}>
              {labelForType(v, row)}
            </span>
          ),
        },
      ],

      [ "Box Sticker No.", "box_no_uids_display", (_v, row) => <BoxStickerNosCell row={row} />, {
          width: "340px",
          wrap: true,
          copyValue: (row) => getBoxStickerEntries(row).map((e) => e.box_no_uid).join(", ") || "—",
        },
      ],

      [ "Box Count", "box_count", (v) => <span className={IMS_TABLE_CELL_NUMBER}>{v != null ? v : "—"}</span>,
        {
          width: "56px",
          align: "center",
          copyValue: (row) => (row.box_count != null ? String(row.box_count) : "—"),
        },
      ],

      [ "Qty", "total_qty", (v) => <span className={IMS_TABLE_CELL_NUMBER}>{v != null ? v : "—"}</span>,
        {
          width: "56px",
          align: "center",
          copyValue: (row) => (row.total_qty != null ? String(row.total_qty) : "—"),
        },
      ],

      [ "Module / Entity", "source_module", (v, row) => (
          <div className="flex flex-col leading-tight min-w-[140px]">
            <div className="flex items-center gap-1">
              <Layers size={10} className="text-slate-500 shrink-0" />
              <span className={`capitalize ${IMS_TABLE_CELL_TEXT}`}>{v?.replace(/_/g, " ")}</span>
            </div>
            <span className="text-[9px] text-indigo-500 font-mono ml-3">REF: {row.source_id || "N/A"}</span>
          </div>
        ),
        {
          width: "180px",
          copyValue: (row) => copyModuleEntity(row),
        },
      ],

      ["Created By", "user_name", (v) => <span className={IMS_TABLE_CELL_TEXT}>{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className={IMS_TABLE_CELL_DATE}>{v ? formatDateTime(v) : "—"}</span>, { width: "150px" }],
    ],
    [labelForType, copyModuleEntity]
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Box Transaction Log",
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
                {loading ? (
                  <span className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600">
                    <RefreshCcw size={14} className="shrink-0 animate-spin text-indigo-600" aria-hidden />
                  </span>
                ) : (
                  <RefreshCcw size={14} className="shrink-0" aria-hidden />
                )}
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
            key={`${params.fromDate}-${params.toDate}-${displayMode}-${appliedJourney}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            dateDisabled={journeyTyping}
            applyExtrasOnChange
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search box sticker, type, module..."
            searchLabel="Search"
            applyOnSearchEnter={false}
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

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {isUniqueView
              ? hasActiveSearch
                ? isUniquePerLog
                  ? `Unique · ${rows.length} of ${totalItems} log row${totalItems !== 1 ? "s" : ""} matching search`
                  : `Unique · ${rows.length} of ${totalItems} box${totalItems !== 1 ? "es" : ""} from ${uniqueSourceLogCount} log${uniqueSourceLogCount !== 1 ? "s" : ""} matching search`
                : `Unique · ${rows.length} of ${totalItems} box row${totalItems !== 1 ? "s" : ""} from ${allRows.length} log${allRows.length !== 1 ? "s" : ""}`
              : hasActiveSearch
                ? `Summary · ${rows.length} of ${totalItems} match${totalItems !== 1 ? "es" : ""} (${allRows.length} loaded)`
                : isJourneyMode
                  ? `Summary · ${rows.length} of ${totalItems} journey matches (all DB)`
                  : `Summary · ${rows.length} of ${totalItems} in date range`}
          </span>
        </div>
      </div>

      <BoxTransactionLogDetailModal
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

