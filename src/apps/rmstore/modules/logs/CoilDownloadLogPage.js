"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Sticker, RefreshCcw } from "lucide-react";
import { toast } from "react-toastify";

import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { labelStickerDownloadSource } from "@/platform/utils/global";
import { stickerDownloadLogService } from "@/apps/rmstore/lib/services/coilLogs";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import RmStoreListFooter, {
  FOOTER_TEXT_CLASS,
  formatRmStoreListFooterText,
  rmStoreFooterFromClientFilter,
} from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";

const MODULE = "rm_coil_download_logs";
const LIST_PAGE_SIZE = 1000;
const DISPLAY_CHUNK = 100;

function stickerLogSearchParts(row) {
  const source = row?.download_source;
  return [
    row?.primary_label,
    row?.coil_no_uid,
    row?.packing_number,
    row?.mrn_uid,
    row?.mrn_no,
    row?.acc_name,
    row?.item_code,
    row?.heat_no,
    row?.last_downloaded_by_name,
    row?.downloaded_by,
    source,
    source ? labelStickerDownloadSource(source) : null,
  ];
}

function filterRmStickerDownloadLogs(rows, query, options = {}) {
  return applyClientSearch(rows, query, { getParts: stickerLogSearchParts, ...options });
}

function downloadTypeBadge(v, row) {
  const t = String(v || "").toLowerCase();
  const isQc = t === "qc" || t === "bulk_qc" || t === "batch_qc";
  const n =
    row?.last_bulk_sticker_count != null && Number(row.last_bulk_sticker_count) > 0
      ? Number(row.last_bulk_sticker_count)
      : row?.event_sticker_count != null && Number(row.event_sticker_count) > 0
        ? Number(row.event_sticker_count)
        : null;
  const isBulk = t === "bulk" || t === "bulk_qc" || t === "batch_qc";
  const countSuffix = isBulk && n != null && n > 1 ? ` (${n})` : "";

  return (
    <span
      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
        isQc
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-slate-50 text-slate-600 border-slate-200"
      }`}
      title={t || ""}
    >
      {isQc ? `QC sticker${countSuffix}` : `Coil sticker${countSuffix}`}
    </span>
  );
}

export default function CoilDownloadLogPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const loadGenRef = useRef(0);

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "last_downloaded_at",
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

  const fetchStickers = useCallback(async () => {
    const journey = String(appliedJourney ?? "").trim();
    if (!journey && !params.fromDate && !params.toDate) return;
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await stickerDownloadLogService.getAll({
          page,
          limit,
          sortBy: "last_downloaded_at",
          order: "desc",
          filters: journey
            ? { journey }
            : {
                ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
                ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
              },
        });
        return { data: body?.data ?? [], total: body?.total ?? 0 };
      }, LIST_PAGE_SIZE);
      if (gen !== loadGenRef.current) return;
      setAllRows(data);
      setDisplayLimit(DISPLAY_CHUNK);
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      toast.error(err?.message || "Could not load the sticker logs. Please try again.");
      setAllRows([]);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [appliedJourney, params.fromDate, params.toDate]);

  useEffect(() => {
    fetchStickers();
  }, [fetchStickers]);

  useEffect(() => {
    setDisplayLimit(DISPLAY_CHUNK);
  }, [tempSearch]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch ?? "").trim();
    let data = allRows;
    if (q) {
      data = filterRmStickerDownloadLogs(allRows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const rows = useMemo(
    () => filteredRows.slice(0, displayLimit),
    [filteredRows, displayLimit]
  );

  const totalItems = filteredRows.length;
  const journeyTyping = Boolean(String(journeyInput ?? "").trim());
  const isJourneyMode = Boolean(String(appliedJourney ?? "").trim());

  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows,
        serverFiltered: isJourneyMode || Boolean(params.fromDate || params.toDate),
      }),
    [tempSearch, allRows, filteredRows, isJourneyMode, params.fromDate, params.toDate]
  );

  const handleLoadMore = useCallback(() => {
    if (!loading && rows.length < totalItems) {
      setDisplayLimit((n) => n + DISPLAY_CHUNK);
    }
  }, [loading, rows.length, totalItems]);

  const handleFilterApply = (data) => {
    const journey = String(journeyInput ?? "").trim();
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
    setDisplayLimit(DISPLAY_CHUNK);
    setParams({
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "last_downloaded_at",
      sortDir: "desc",
    });
  };

  const journeyExtras = useMemo(
    () => [
      {
        type: "text",
        label: "Journey",
        placeholder: "MRN no or coil sticker no",
        value: journeyInput,
        onChange: setJourneyInput,
        onEnter: () => setAppliedJourney(String(journeyInput ?? "").trim()),
      },
    ],
    [journeyInput]
  );

  const onSort = (key) => {
    setParams((p) => ({
      ...p,
      sortKey: key,
      sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
    }));
  };


  const HEADERS = [
    ["Sticker UID", "primary_label", (v) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
          <Sticker size={14} />
        </div>
        <span className="font-bold text-slate-900 uppercase text-[11px]">{v || "—"}</span>
      </div>
    ), { fixed: true, width: "200px" }],

    ["MRN UID", "mrn_uid", (v) => (
      <span className="text-[11px] font-semibold text-slate-700">{v || "—"}</span>
    ), { width: "120px" }],

    ["Customer", "acc_name", (v) => (
      <span className="text-[10px] font-bold text-slate-500 uppercase truncate block">{v || "—"}</span>
    ), { width: "180px" }],

    ["Download Type", "last_download_type", downloadTypeBadge, { align: "center" }],

    ["Download from", "download_source", (v) => (
      <span className="text-[10px] font-semibold text-slate-600 block truncate max-w-[200px]" title={labelStickerDownloadSource(v)}>
        {labelStickerDownloadSource(v)}
      </span>
    ), { width: "200px", sortable: true }],

    ["Downloaded By", "last_downloaded_by_name", (v) => (
      <span className="text-[10px] text-slate-500">{v || "—"}</span>
    ), { width: "110px" }],

    ["Downloaded At", "last_downloaded_at", (v) => (
      <span className="text-[10px] text-slate-400 font-medium">{v ? formatDateTime(v) : "Never"}</span>
    ), { width: "150px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "RM Sticker Download Logs",
    rows,
    headers: HEADERS,
    onExport: async () => filteredRows,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <button
                type="button"
                onClick={() => fetchStickers()}
                className="h-9 shrink-0 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all touch-manipulation"
              >
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh Data</span>
              </button>
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
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${params.fromDate}-${params.toDate}-${appliedJourney}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            dateDisabled={journeyTyping}
            extraFilters={journeyExtras}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Coil, MRN, customer, or user"
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
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              headers={HEADERS}
              data={rows}
              loading={loading}
              viewMode={viewMode}
              allowCopy={true}
              showSelection={false}
              getRowId={(item) => String(item.log_id ?? "")}
              skeletonCount={DISPLAY_CHUNK}
              emptyIcon={Sticker}
              emptyMessage="No sticker logs were found"
              sortKey={params.sortKey}
              sortDir={params.sortDir}
              onSort={onSort}
              onLoadMore={handleLoadMore}
              hasMore={rows.length < totalItems}
              totalItems={totalItems}
              cardConfig={{
                titleKey: "primary_label",
                tagsKeys: ["last_download_type"],
                detailKeys: ["mrn_uid", "packing_number", "acc_name", "item_code", "last_downloaded_by_name"],
                footerKey: "last_downloaded_at",
                className: "rounded-none border border-slate-200",
              }}
            />
          </div>
        </div>

        <RmStoreListFooter
          shown={rows.length}
          total={totalItems}
          label={isJourneyMode ? "Journey Matches" : "Download Log Rows"}
          journeyMode={isJourneyMode}
          showLive={false}
          {...footerFilter}
        />
      </div>
    </div>
  );
}
