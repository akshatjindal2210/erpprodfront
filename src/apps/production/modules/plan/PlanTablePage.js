"use client";

/**
 * Production Planning → Table View — listing / row control (CRUD without Create).
 * Create comes from Authorize / Board; here: View / Edit / Delete selected plan line only.
 * Shop-floor Start / Hold / Complete stays on Job Card Board.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Table2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_TEXT, IMS_TABLE_CELL_NUMBER, LIST_PAGE_TABLE_AREA_CLASS } from "@/ui/common/list/listPageShellClasses";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import { ListPageEditButton, ListPageViewButton, ListPageDeleteButton } from "@/ui/common/list/listPageCrud";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import AppListFooter from "@/ui/common/list/listPageFooter";
import DataTable from "@/ui/primitives/DataTable";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import ProductionFilters, { FILTER_NONE, useProductionFilterIds } from "@/apps/production/modules/job-card-board/ProductionFilters";
import PlanLineDrawer from "@/apps/production/modules/plan/PlanLineDrawer";
import { PLANNING_MODULE, STATUS_FILTER_OPTIONS } from "@/apps/production/modules/job-card-board/board";
import { fetchPlanTable } from "@/apps/production/modules/plan/planTable";
import { planService } from "@/apps/production/lib/services/plan";
import { PROCESS_STATUS_BADGE } from "@/apps/production/lib/constants/processStatus";

const MODULE = PLANNING_MODULE;
const PAGE_CHUNK = 100;
const btn = `${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`;

/** false = IMS (To = aaj). true = To = aaj + 1 month. */
const TO_PLUS_1_MONTH = true;

function rowMatchesFilters(row, { processIds, machineIds, statusFromUrl, search }) {
  if (processIds.length) {
    if (processIds.length === 1 && processIds[0] === FILTER_NONE) return false;
    if (!processIds.includes(String(row.processId))) return false;
  }
  if (machineIds.length) {
    if (machineIds.length === 1 && machineIds[0] === FILTER_NONE) return false;
    const mid = row.machineId != null ? String(row.machineId) : null;
    if (!mid || !machineIds.includes(mid)) return false;
  }
  if (statusFromUrl && statusFromUrl !== "all" && row.status !== statusFromUrl) return false;
  const q = String(search || "").trim().toLowerCase();
  if (q) {
    const hay = [row.job_card_no, row.machine, row.process, row.prime_item_code].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function textCell(v) {
  const t = v == null || v === "" ? "—" : String(v);
  return (
    <span className={`${IMS_TABLE_CELL_TEXT} truncate block`} title={t === "—" ? "" : t}>
      {t}
    </span>
  );
}

export default function PlanTablePage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const canView = viewAccess.allowed;
  const imsDates = useViewDateFilterDefaults(viewAccess);
  // const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);
  const dateFilterDefaults = useMemo(() => {
    if (!TO_PLUS_1_MONTH) return imsDates;
    const to = dayjs().add(1, "month").format("YYYY-MM-DD");
    return { ...imsDates, to, maxDate: to };
  }, [imsDates]);
  const { processIds, machineIds, statusFromUrl } = useProductionFilterIds();

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(statusFromUrl || "all");
  const [fromDate, setFromDate] = useState(dateFilterDefaults.from);
  const [toDate, setToDate] = useState(dateFilterDefaults.to);
  const [filterKey, setFilterKey] = useState(0);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lineDrawer, setLineDrawer] = useState(null); // { row, mode: view|edit }
  const [deleteRow, setDeleteRow] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ sortKey: "plan_start", sortDir: "desc" });
  const [limit, setLimit] = useState(PAGE_CHUNK);
  const [viewMode, handleViewMode] = useViewMode();

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    setFromDate(dateFilterDefaults.from);
    setToDate(dateFilterDefaults.to);
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const resetFilters = useCallback(() => {
    setFromDate(dateFilterDefaults.from || "");
    setToDate(dateFilterDefaults.to || "");
    setSearch("");
    setStatusFilter("all");
    setLimit(PAGE_CHUNK);
    setFilterKey((k) => k + 1);
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPlanTable({ from_date: fromDate, to_date: toDate });
      setRows(data.rows || []);
      setMachines(data.machines || []);
      setSelected((cur) => (cur && (data.rows || []).some((r) => r.id === cur) ? cur : null));
    } catch (e) {
      setError(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  useEffect(() => {
    setStatusFilter(statusFromUrl || "all");
  }, [statusFromUrl]);

  const processOptions = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.processId)) map.set(r.processId, { label: r.process, value: String(r.processId) });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const machineOptions = useMemo(
    () =>
      machines
        .map((m) => ({ label: m.name, value: String(m.id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [machines]
  );

  const filteredRows = useMemo(() => {
    const data = rows.filter((r) =>
      rowMatchesFilters(r, {
        processIds,
        machineIds,
        statusFromUrl: statusFilter,
        search,
      })
    );
    return sortRowsByKey(data, sort.sortKey, sort.sortDir);
  }, [rows, processIds, machineIds, statusFilter, search, sort]);

  const visibleRows = useMemo(() => filteredRows.slice(0, limit), [filteredRows, limit]);

  const headers = useMemo(
    () => [
      [
        "Job Card No",
        "job_card_no",
        (v) => <span className={`${IMS_TABLE_CELL_TEXT} font-mono font-bold text-indigo-700`}>{v || "—"}</span>,
        { width: "110px", fixed: true },
      ],
      [
        "Prime Item",
        "prime_item_code",
        (v) => <span className={`${IMS_TABLE_CELL_TEXT} font-bold uppercase`}>{v || "—"}</span>,
        { width: "110px" },
      ],
      ["Machine", "machine", textCell, { width: "120px" }],
      ["Process", "process", textCell, { width: "130px" }],
      [
        "Stage",
        "stage",
        (v) => <span className={`${IMS_TABLE_CELL_NUMBER} text-center block`}>{v != null ? String(v) : "—"}</span>,
        { width: "64px", align: "center" },
      ],
      [
        "Qty",
        "qty",
        (v) => <span className={`${IMS_TABLE_CELL_NUMBER} text-right block`}>{Number(v ?? 0).toLocaleString()}</span>,
        { width: "96px", align: "right", copyValue: (row) => String(row.qty ?? 0) },
      ],
      ["Plan Start", "plan_start", (_, row) => textCell(row.planStart), { width: "130px", copyValue: (row) => row.plan_start || "—" }],
      ["Actual Start", "actStart", textCell, { width: "130px" }],
      ["Plan End", "plan_end", (_, row) => textCell(row.planEnd), { width: "110px", copyValue: (row) => row.plan_end || "—" }],
      ["Actual End", "actEnd", textCell, { width: "130px" }],
      [
        "Status",
        "status",
        (_, row) => (
          <span
            className={`inline-block border px-2 py-0.5 text-[9px] font-black uppercase ${
              PROCESS_STATUS_BADGE[row.statusKey] || PROCESS_STATUS_BADGE.pending
            }`}
          >
            {row.status}
          </span>
        ),
        { width: "100px", align: "center", copyValue: (row) => row.status || "—" },
      ],
    ],
    []
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Planning Table",
    rows: filteredRows,
    headers,
  });

  const selectedRow = useMemo(
    () => (selected ? filteredRows.find((r) => r.id === selected) || rows.find((r) => r.id === selected) || null : null),
    [selected, filteredRows, rows]
  );

  const openView = useCallback((row) => {
    if (!row) return toast.info("Select a plan line first.");
    setLineDrawer({ row, mode: "view" });
  }, []);

  const openEdit = useCallback((row) => {
    if (!row) return toast.info("Select a plan line first.");
    setLineDrawer({ row, mode: "edit" });
  }, []);

  const openDelete = useCallback((row) => {
    if (!row) return toast.info("Select a plan line first.");
    setDeleteRow(row);
  }, []);

  const modalOpen = Boolean(lineDrawer || deleteRow);

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen,
    selectedId: selected,
    getSelectedRow: () => selectedRow,
    openEdit: (row) => openEdit(row),
    canEditSelection: () => Boolean(selectedRow),
    openDelete: (row) => openDelete(row),
    canDeleteSelection: () => Boolean(selectedRow),
  });

  const resetFiltersView = () => setLimit(PAGE_CHUNK);

  if (!canView) {
    return <div className="p-8 text-sm text-slate-500">You do not have permission to view Production Planning.</div>;
  }

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      {lineDrawer ? (
        <PlanLineDrawer
          key={`${lineDrawer.row.id}-${lineDrawer.mode}`}
          row={lineDrawer.row}
          mode={lineDrawer.mode}
          onClose={() => setLineDrawer(null)}
          onSaved={() => {
            setLineDrawer(null);
            void load();
          }}
        />
      ) : null}
      {deleteRow ? (
        <DeleteModal
          item={deleteRow}
          onClose={() => setDeleteRow(null)}
          onSuccess={() => {
            setDeleteRow(null);
            setSelected(null);
            void load();
          }}
          service={planService}
          entityLabel="Plan line"
          idKey="plan_docno"
          titleKey="job_card_no"
          moduleSlug={MODULE}
          warningMessage="Removes this process/machine line from Board, Calendar, and Table. Job card itself is kept."
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-slate-300 bg-white shadow-sm">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <div className="flex items-center gap-2 px-1">
                <Table2 size={14} className="text-indigo-600 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">Planning Table</span>
                {!loading && !error ? (
                  <span className="text-[10px] font-semibold tabular-nums text-slate-500">
                    {filteredRows.length.toLocaleString()} line{filteredRows.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            }
            actions={
              <>
                <ListPageViewButton
                  module={MODULE}
                  disabled={!selectedRow}
                  record={selectedRow}
                  onClick={() => openView(selectedRow)}
                />
                <ListPageEditButton
                  module={MODULE}
                  disabled={!selectedRow}
                  record={selectedRow}
                  onClick={() => openEdit(selectedRow)}
                />
                <ListPageDeleteButton
                  module={MODULE}
                  disabled={!selectedRow}
                  onClick={() => openDelete(selectedRow)}
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-0.5 shrink-0" />
                <button type="button" className={btn} onClick={() => void load()} disabled={loading} title="Refresh" aria-label="Refresh">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={exportDisabled}
                onExport={handleExport}
              />
            }
          />
        </ListPageToolbar>

        <ProductionFilters
          key={filterKey}
          processOptions={processOptions}
          machineOptions={machineOptions}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            resetFiltersView();
          }}
          searchLabel="Quick Search"
          searchPlaceholder="Job card, prime item, machine, process…"
          statusFilter={statusFilter}
          statusOptions={STATUS_FILTER_OPTIONS}
          onStatusChange={(v) => {
            setStatusFilter(v);
            resetFiltersView();
          }}
          showDate
          fromDate={fromDate}
          toDate={toDate}
          minDate={dateFilterDefaults.minDate}
          maxDate={dateFilterDefaults.maxDate}
          onDateChange={(from, to) => {
            setFromDate(from || "");
            setToDate(to || "");
            resetFiltersView();
          }}
          onDateReset={resetFilters}
        />

        <div className={LIST_PAGE_TABLE_AREA_CLASS}>
          <DataTable
            headers={headers}
            data={visibleRows}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            showSelection
            {...tableHotkeyProps}
            sortKey={sort.sortKey}
            sortDir={sort.sortDir}
            onSort={(key) => {
              setLimit(PAGE_CHUNK);
              setSort((p) => ({
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "desc" ? "asc" : "desc",
              }));
            }}
            getRowId={(row) => row.id}
            selectedId={selected}
            onSelect={(id) => setSelected(id)}
            onRowDoubleClick={(row) => openView(row)}
            onLoadMore={() => setLimit((n) => n + PAGE_CHUNK)}
            hasMore={visibleRows.length < filteredRows.length}
            totalItems={filteredRows.length}
            cardConfig={{ titleKey: "job_card_no", badgeIndices: [10], detailIndices: [1, 2, 3] }}
            emptyIcon={Table2}
            emptyMessage={error ? "Could not load planning table" : "No plan lines"}
            emptySubMessage={
              error
                ? `${error} — refresh to retry.`
                : "Authorize job cards with a process plan, or relax filters. Edit updates this plan line only."
            }
          />
        </div>

        <AppListFooter
          shown={visibleRows.length}
          total={filteredRows.length}
          noun="Plan Lines"
          selected={selected}
          selectedRecord={selectedRow}
          selectionLabel={(r) => `Selected: ${r?.job_card_no || "—"} · ${r?.process || ""} · ${r?.machine || ""}`}
          onClearSelection={() => setSelected(null)}
        />
      </div>
    </div>
  );
}
