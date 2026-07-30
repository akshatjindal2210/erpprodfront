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
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import CoilFinderDrawer from "./CoilFinderDrawer";
import { getCoilClientSearchParts, getCoilRowClassName, getCoilStockZone, renderCoilCustomerCell, renderCoilLocationCell, renderCoilQtyCell, resolveCoilLocationLabel } from "./coilTableVisuals";

const MODULE = "rm_coils";

export default function CoilTablePage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [params, setParams] = useState({
    pageSize: 1000,
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "coil_uid",
    sortDir: "desc",
  });
  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [journeyInput, setJourneyInput] = useState("");
  const [appliedJourney, setAppliedJourney] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    setParams((prev) => {
      if (prev.fromDate === dateFilterDefaults.from && prev.toDate === dateFilterDefaults.to) return prev;
      return { ...prev, fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to };
    });
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const fetchCoils = useCallback(async () => {
    const journey = String(appliedJourney ?? "").trim();
    if (!journey && !params.fromDate && !params.toDate) {
      setLoading(false);
      setAllRows([]);
      return;
    }
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || "coil_uid",
        order: String(params.sortDir || "desc").toUpperCase(),
        filters: journey
          ? { journey }
          : {
              ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
              ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
            },
        ...(appliedSearch && { search: appliedSearch }),
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await coilService.getAll({ ...base, page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the coils. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate, appliedJourney, appliedSearch]);

  useEffect(() => {
    fetchCoils();
  }, [fetchCoils]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(allRows, tempSearch, {
        skipSort: !!params.sortKey,
        getParts: getCoilClientSearchParts,
      });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const applyJourneyFilter = useCallback(() => {
    const journey = String(journeyInput ?? "").trim();
    setDisplayLimit(100);
    setAppliedJourney(journey);
  }, [journeyInput]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows,
        serverFiltered: Boolean(appliedSearch) || Boolean(appliedJourney),
      }),
    [tempSearch, allRows, filteredRows, appliedSearch, appliedJourney]
  );
  const selectedRecord = useMemo(
    () => filteredRows.find((r) => r.coil_uid === selected) || null,
    [filteredRows, selected]
  );

  const handleFilterApply = (data) => {
    applySearchFromInput();
    const journey = String(journeyInput ?? "").trim();
    setDisplayLimit(100);
    if (journey) {
      setAppliedJourney(journey);
      return;
    }
    setAppliedJourney("");
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
    }));
  };

  const handleReset = () => {
    resetSearch();
    setJourneyInput("");
    setAppliedJourney("");
    setParams({
      pageSize: 1000,
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "coil_uid",
      sortDir: "desc",
    });
  };

  const journeyTyping = Boolean(String(journeyInput ?? "").trim());
  const isJourneyMode = Boolean(String(appliedJourney ?? "").trim());

  /** IMS Boxes column order adapted for coils. */
  const HEADERS = useMemo(
    () => [
      ["Coil No", "coil_no_uid", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { fixed: true, width: "160px" }],
      ["MRN UID", "mrn_uid", (v) => <span className="font-semibold text-slate-700 text-[10px] uppercase">{v ?? "—"}</span>, { width: "90px" }],
      ["MRN No", "mrn_no", (v) => <span className="font-semibold text-slate-700 text-[10px] uppercase">{v ?? "—"}</span>, { width: "90px" }],
      ["Item Code", "item_code", (v) => <span className="font-mono text-[10px] font-bold tracking-tighter">{v || "—"}</span>, { width: "130px" }],
      ["Description", "item_desc", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter" title={v || ""}>{v || "—"}</span>, { width: "220px" }],
      ["Qty", "qty", renderCoilQtyCell, { width: "70px", align: "center" }],
      ["Location", "location_no", renderCoilLocationCell, {
        width: "120px",
        copyValue: (row) => resolveCoilLocationLabel(row),
      }],
      ["Heat No.", "heat_no", (v) => <span className="font-mono text-[10px] font-bold text-slate-700">{v || "—"}</span>, { width: "110px" }],
      ["Inward UID", "in_uid", (v, row) => {
        const zone = getCoilStockZone(row);
        return (
          <span className={`text-[10px] ${zone === "stored" ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
            {v || "—"}
          </span>
        );
      }, { width: "100px" }],
      ["Customer", "acc_name", renderCoilCustomerCell, { width: "180px", wrap: true }],
      ["Serial", "serial_no", (v) => <span className="text-[10px] text-slate-500 tabular-nums">{v ?? "—"}</span>, { width: "70px" }],
    ],
    []
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Coil Records",
    rows: filteredRows,
    headers: HEADERS,
  });

  const extraFilters = useMemo(
    () => [
      {
        type: "text",
        label: "Journey",
        placeholder: "MRN, coil no, or item code",
        value: journeyInput,
        onChange: setJourneyInput,
        onEnter: applyJourneyFilter,
      },
    ],
    [journeyInput, applyJourneyFilter]
  );

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
                  onClick={() => fetchCoils()}
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
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
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
            key={`${params.fromDate}-${params.toDate}-${appliedJourney}`}
            showDate
            fromDate={params.fromDate}
            toDate={params.toDate}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
            dateDisabled={journeyTyping}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={() =>
              handleFilterApply({
                fromDate: params.fromDate,
                toDate: params.toDate,
              })
            }
            searchPlaceholder="Search by coil UID, MRN, heat, or location"
            searchLabel="Search Coil Records"
            searchVariant="quick"
            applyOnSearchEnter={false}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            showSelection
            emptyIcon={Layers}
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
            getRowId={(row) => row.coil_uid}
            getRowClassName={getCoilRowClassName}
            onLoadMore={() => {
              if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            emptyMessage={isJourneyMode ? "No coils match this journey" : "No coil records for this date range"}
            emptySubMessage={
              isJourneyMode
                ? "Try MRN, coil no, heat, or item code"
                : "Set From / To date and click Search"
            }
            cardConfig={{
              titleKey: "coil_no_uid",
              badgeIndices: [5],
              detailKeys: ["mrn_no", "item_code", "item_desc", "acc_name", "location_no", "heat_no", "in_uid"],
              footerKey: "acc_name",
            }}
          />
        </div>

        <RmStoreListFooter
          shown={items.length}
          total={totalItems}
          label="Coil Records"
          journeyMode={isJourneyMode}
          {...footerFilter}
          extra={
            <>
              Location: <span className="text-green-900 font-bold">unassigned</span>
              {" / "}
              <span className="text-emerald-700 font-bold">stored</span>
            </>
          }
        />
      </div>

      {finderOpen && <CoilFinderDrawer open={finderOpen} onClose={() => setFinderOpen(false)} />}
    </div>
  );
}
