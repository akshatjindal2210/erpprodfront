"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Layers, X, Locate } from "lucide-react";
import { toast } from "react-toastify";

import { coilService } from "@/apps/rmstore/lib/services/coil";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { applyClientSearch } from "@/ui/common/list/clientListSearch";
import CoilFinderDrawer from "./CoilFinderDrawer";
import { COIL_CARD_CONFIG, COIL_HEADERS } from "./coilColumns";
import { getCoilRowClassName, CoilTableColorLegend, getCoilClientSearchParts } from "./coilTableVisuals";

const MODULE = "rm_coils";
const PAGE_SIZE = 200;

function buildFilters({ fromDate, toDate, journey }) {
  if (journey) return { journey };
  return {
    ...(fromDate && { from_date: `${fromDate} 00:00:00` }),
    ...(toDate && { to_date: `${toDate} 23:59:59` }),
  };
}

export default function CoilTablePage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, handleViewMode] = useViewMode();
  const [params, setParams] = useState({
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "coil_uid",
    sortDir: "desc",
  });
  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [journeyInput, setJourneyInput] = useState("");
  const [appliedJourney, setAppliedJourney] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);

  const journey = String(appliedJourney ?? "").trim();
  const hasDateRange = Boolean(params.fromDate || params.toDate);
  const canLoad = journey || hasDateRange;

  const listQuery = useMemo(
    () => ({
      sortBy: params.sortKey || "coil_uid",
      order: String(params.sortDir || "desc").toUpperCase(),
      filters: buildFilters({ fromDate: params.fromDate, toDate: params.toDate, journey }),
      ...(appliedSearch && { search: appliedSearch }),
    }),
    [params.sortKey, params.sortDir, params.fromDate, params.toDate, journey, appliedSearch]
  );

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    setParams((prev) => {
      if (prev.fromDate === dateFilterDefaults.from && prev.toDate === dateFilterDefaults.to) return prev;
      return { ...prev, fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to };
    });
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  useEffect(() => {
    if (!canLoad) {
      setRows([]);
      setTotal(0);
      setPage(1);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    coilService
      .getAll({ ...listQuery, page: 1, limit: PAGE_SIZE })
      .then((body) => {
        if (cancelled) return;
        setRows(body.data ?? []);
        setTotal(Number(body.total) || 0);
        setPage(1);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.message || "Could not load coils.");
        setRows([]);
        setTotal(0);
        setPage(1);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [listQuery, canLoad]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const body = await coilService.getAll({ ...listQuery, page: nextPage, limit: PAGE_SIZE });
      setRows((prev) => [...prev, ...(body.data ?? [])]);
      setTotal(Number(body.total) || total);
      setPage(nextPage);
    } catch (err) {
      toast.error(err?.message || "Could not load more coils.");
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, rows.length, total, page, listQuery]);

  const refresh = useCallback(() => {
    if (!canLoad) return;
    setLoading(true);
    coilService
      .getAll({ ...listQuery, page: 1, limit: PAGE_SIZE })
      .then((body) => {
        setRows(body.data ?? []);
        setTotal(Number(body.total) || 0);
        setPage(1);
      })
      .catch((err) => toast.error(err?.message || "Could not load coils."))
      .finally(() => setLoading(false));
  }, [canLoad, listQuery]);

  const selectedRecord = useMemo(
    () => rows.find((r) => r.coil_uid === selected) || null,
    [rows, selected]
  );

  const filteredRows = useMemo(() => {
    const q = String(tempSearch ?? "").trim();
    if (!q) return rows;
    return applyClientSearch(rows, tempSearch, {
      getParts: getCoilClientSearchParts,
      skipSort: Boolean(params.sortKey),
    });
  }, [rows, tempSearch, params.sortKey]);

  const quickSearchActive = Boolean(String(tempSearch ?? "").trim());

  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: rows,
        filteredRows,
        serverFiltered: Boolean(appliedSearch) || Boolean(journey) || hasDateRange,
      }),
    [rows, filteredRows, tempSearch, appliedSearch, journey, hasDateRange]
  );

  const handleFilterApply = (data) => {
    applySearchFromInput();
    const nextJourney = String(journeyInput ?? "").trim();
    setAppliedJourney(nextJourney);
    setParams((prev) => ({
      ...prev,
      fromDate: data?.fromDate ?? prev.fromDate,
      toDate: data?.toDate ?? prev.toDate,
    }));
  };

  const handleReset = () => {
    resetSearch();
    setJourneyInput("");
    setAppliedJourney("");
    setParams({
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "coil_uid",
      sortDir: "desc",
    });
  };

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Coil Records",
    rows: filteredRows,
    headers: COIL_HEADERS,
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
                <button
                  type="button"
                  onClick={refresh}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all"
                >
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
          {selectedRecord && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase truncate">
                Selected: {selectedRecord.coil_no_uid}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${params.fromDate}-${params.toDate}-${journey}`}
            showDate
            fromDate={params.fromDate}
            toDate={params.toDate}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
            extraFilters={[
              {
                type: "text",
                label: "Journey",
                placeholder: "MRN, coil no, item, job card, or machine",
                value: journeyInput,
                onChange: setJourneyInput,
                onEnter: () => setAppliedJourney(String(journeyInput ?? "").trim()),
              },
            ]}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Coil UID, MRN, heat, item, job card, machine…"
            searchLabel="Quick Search"
            searchVariant="quick"
            showSearchButton
            applyOnSearchEnter
            applyExtrasOnChange={false}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={COIL_HEADERS}
            data={filteredRows}
            loading={loading || loadingMore}
            viewMode={viewMode}
            allowCopy
            showSelection
            emptyIcon={Layers}
            sortKey={params.sortKey ?? ""}
            sortDir={params.sortDir}
            onSort={(key) => {
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }));
            }}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={(row) => row.coil_uid}
            getRowClassName={getCoilRowClassName}
            onLoadMore={loadMore}
            hasMore={!quickSearchActive && rows.length < total}
            totalItems={quickSearchActive ? filteredRows.length : total}
            emptyMessage={
              quickSearchActive
                ? "No coils match quick search"
                : journey
                  ? "No coils match this journey"
                  : "No coil records for this date range"
            }
            emptySubMessage={
              quickSearchActive
                ? "Try coil no, MRN, heat, item, job card, or machine"
                : journey
                  ? "Try MRN, coil no, item, job card, or machine"
                  : "Set dates and click Search"
            }
            cardConfig={COIL_CARD_CONFIG}
          />
        </div>

        <RmStoreListFooter
          shown={filteredRows.length}
          total={quickSearchActive ? filteredRows.length : total}
          label="Coil Records"
          journeyMode={Boolean(journey)}
          {...footerFilter}
          extra={<CoilTableColorLegend />}
        />
      </div>

      {finderOpen && <CoilFinderDrawer open={finderOpen} onClose={() => setFinderOpen(false)} />}
    </div>
  );
}
