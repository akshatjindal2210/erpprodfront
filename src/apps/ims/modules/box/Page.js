"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Box, Locate } from "lucide-react";
import AppListFooter from "@/ui/common/list/listPageFooter";
import { imsSelectionLabel } from "@/apps/ims/lib/imsSelectionLabel";
import { toast } from "react-toastify";
import { boxService } from "@/apps/ims/lib/services/box";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";

// Components
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DataTable from "@/ui/primitives/DataTable";
import BoxFinderDrawer from "./BoxFinderDrawer";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";

import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { formatDocDate } from "@/platform/utils/core/utilHelper";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { BOX_ZONE_FILTER_OPTIONS, defaultBoxZoneIncludes, filterBoxRowsByZone, getBoxRowClassName, getBoxStockZone, getBoxClientSearchParts, renderBoxForwardNoteCustomerCell, renderBoxLocationCell, renderBoxQcHoldIdCell, resolveBoxLocationLabel } from "./boxTableVisuals";

const BOX_ZONE_FILTER = {
  type: "checkboxGroup",
  key: "zoneIncludes",
  label: "Zone",
  variant: "quick",
  options: BOX_ZONE_FILTER_OPTIONS,
  className: "md:min-w-[11rem] md:max-w-[13rem]",
  allLabel: "All zones",
};

export default function BoxTablePage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("boxes", "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "box_uid", sortDir: "desc"
  });

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    setParams((prev) => {
      if (prev.fromDate === dateFilterDefaults.from && prev.toDate === dateFilterDefaults.to) {
        return prev;
      }
      return {
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      };
    });
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [journeyInput, setJourneyInput] = useState("");
  const [appliedJourney, setAppliedJourney] = useState("");
  const [zoneIncludes, setZoneIncludes] = useState(defaultBoxZoneIncludes);
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);

  const fetchBoxes = useCallback(async () => {
    const journey = String(appliedJourney ?? "").trim();
    if (!journey && !params.fromDate && !params.toDate) return;
    setLoading(true);
    try {
      const base = {
        order: "DESC",
        filters: journey
          ? { journey }
          : {
              ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
              ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
            },
        ...(appliedSearch && { search: appliedSearch }),
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await boxService.getAll({ ...base, page, limit });
        const list = body.data?.data ?? body.data ?? [];
        return { data: Array.isArray(list) ? list : [], total: body.data?.total ?? body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
    } catch (err) {
      toast.error(err?.message || "Failed to load box records");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, appliedJourney, appliedSearch]);

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch, params.fromDate, params.toDate, params.status, appliedJourney, appliedSearch]);

  const isJourneyMode = Boolean(String(appliedJourney ?? "").trim());

  const filteredRows = useMemo(() => {
    let data = filterBoxRowsByZone(allRows, zoneIncludes);
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { getParts: getBoxClientSearchParts, skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir, zoneIncludes]);

  const applyJourneyFilter = useCallback(() => {
    const journey = String(journeyInput ?? "").trim();
    setDisplayLimit(100);
    setAppliedJourney(journey);
  }, [journeyInput]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

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
      status: data.approvedStatus || prev.status,
    }));
  };

  const handleReset = () => {
    resetSearch();
    setJourneyInput("");
    setAppliedJourney("");
    setZoneIncludes(defaultBoxZoneIncludes());
    setParams({
      pageSize: 1000,
      status: "all",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "box_uid",
      sortDir: "desc",
    });
  };

  const journeyTyping = Boolean(String(journeyInput ?? "").trim());

  const handleZoneIncludesChange = useCallback((value) => {
    setZoneIncludes(value && typeof value === "object" ? value : defaultBoxZoneIncludes());
    setDisplayLimit(100);
  }, []);

  const extraFilters = useMemo(
    () => [
      {
        type: "text",
        label: "Journey",
        placeholder: "Packing no, box no, item code, or job card",
        value: journeyInput,
        onChange: setJourneyInput,
        onEnter: applyJourneyFilter,
      },
      { ...BOX_ZONE_FILTER, value: zoneIncludes },
    ],
    [journeyInput, applyJourneyFilter, zoneIncludes]
  );

  const selectedRecord = useMemo(
    () => filteredRows.find((u) => String(u.box_uid) === String(selected)),
    [filteredRows, selected]
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((u) => String(u.box_uid) === String(selected)),
    [filteredRows, selected]
  );

  const boxRowClassName = useCallback((row) => getBoxRowClassName(row), []);

  // Boxes list is view/finder only — no create/edit drawer. Disable New/Edit hotkeys
  // so Ctrl+Alt+N / Insert does not open a form that has no toolbar entry.
  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: "boxes",
    modalOpen: finderOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: null,
    openEdit: null,
    openDelete: useCallback((row) => {
      setDeleteItem(row);
    }, []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const HEADERS = [
    ["Box No", "box_no_uid", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { fixed: true, width: "120px" }],
    ["Packing No", "packing_number", (v) => <span className="font-semibold text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "110px" }],
    ["Job Card", "job_card_no", (v) => <span className="font-bold text-slate-800 text-[10px] font-mono tracking-tight">{v || "—"}</span>, { width: "120px" }],
    ["Doc Date", "doc_dt", (v) => <span className="text-[10px] font-bold text-slate-700 tabular-nums">{formatDocDate(v) || "—"}</span>, { width: "100px" }],

    ["Item Code", "item_code", (v) => <span className="font-mono text-[10px] font-bold tracking-tighter">{v}</span>, { width: "150px" }],
    ["Description", "itemdesc", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>, { width: "240px" }],

    ["Qty", "qty", (v) => (
      <span className="font-black text-[11px] tabular-nums text-slate-900">{v ?? "0"}</span>
    ), { width: "70px", align: "center" }],

    ["Location", "location_no", renderBoxLocationCell, {
      width: "120px",
      copyValue: (row) => resolveBoxLocationLabel(row),
    }],

    ["QC Hold ID", "qc_hold_id", renderBoxQcHoldIdCell, {
      width: "96px",
      align: "center",
      copyValue: (row) => (row.qc_hold_id != null ? String(row.qc_hold_id) : "—"),
    }],

    ["Inward UID", "in_uid", (v) => (
      <span className="text-[10px] text-slate-600 tabular-nums">{v || "—"}</span>
    ), { width: "120px" }],
    
    ["Customer", "forward_note_customer_name", renderBoxForwardNoteCustomerCell, {
      width: "180px",
      wrap: true,
      copyValue: (row) => (getBoxStockZone(row) === "dispatched" ? row.forward_note_customer_name || "—" : "—"),
    }],

    ["Outward UID", "out_uid", (v) => (
      <span className="text-[10px] text-slate-600 tabular-nums">{v || "—"}</span>
    ), { width: "120px" }],

    ["Tray", "tray_code", (v) => (
      <span className="font-mono text-[10px] font-bold text-indigo-800 uppercase">{v || "—"}</span>
    ), { width: "100px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Box Records",
    rows: filteredRows,
    headers: HEADERS,
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
              
              <button onClick={() => fetchBoxes()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all">
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

        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${params.fromDate}-${params.toDate}-${appliedJourney}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            dateDisabled={journeyTyping}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            onExtraFilterChange={(key, value) => {
              if (key === "zoneIncludes") handleZoneIncludesChange(value);
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={() =>
              handleFilterApply({
                fromDate: params.fromDate,
                toDate: params.toDate,
                approvedStatus: params.status,
              })
            }
              searchPlaceholder="Search box UID, box no, packing, job card, location..."
            searchLabel="Search Box Records"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              headers={HEADERS} 
              data={items} 
              loading={loading}
              viewMode={viewMode} 
              {...tableHotkeyProps}
              sortKey={params.sortKey} 
              sortDir={params.sortDir}
              allowCopy={true}
              getRowClassName={boxRowClassName}
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
              getRowId={(item) => item.box_uid}
              emptyIcon={Box}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{
                titleKey: "box_no_uid",
                badgeIndices: [5],
                detailKeys: [
                  "packing_number",
                  "item_code",
                  "item_desc",
                  "forward_note_customer_name",
                  "location_no",
                  "qc_hold_id",
                  "in_uid",
                  "out_uid",
                ],
                footerKey: "forward_note_customer_name",
              }}
            />
          </div>
        </div>

        <AppListFooter
          shown={items.length}
          total={totalItems}
          noun={isJourneyMode ? "journey matches" : "Box Records"}
          extra="Yellow QC · Blue dispatched · Location colors in grid"
          selected={selected}
          selectedRecord={selectedRecord}
          selectionLabel={imsSelectionLabel.box}
          onClearSelection={() => setSelected(null)}
        />
      </div>

      {finderOpen && <BoxFinderDrawer open={finderOpen} onClose={() => setFinderOpen(false)} />}
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { fetchBoxes(); setSelected(null); }} service={boxService} entityLabel="Box Record" idKey="box_uid" moduleSlug="boxes" />
    </div>
  );
}
