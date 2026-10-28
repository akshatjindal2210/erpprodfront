"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Table2, RefreshCw, Play, Pause, Square, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_TEXT, IMS_TABLE_CELL_NUMBER, LIST_PAGE_TABLE_AREA_CLASS } from "@/ui/common/list/listPageShellClasses";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import AppListFooter from "@/ui/common/list/listPageFooter";
import DataTable from "@/ui/primitives/DataTable";
import ProductionFilters, { FILTER_NONE, useProductionFilterIds } from "@/apps/production/modules/job-card-board/ProductionFilters";
import JobCardViewDrawer from "@/apps/production/modules/job-card-board/ViewDrawer";
import { PLANNING_MODULE, STATUS_FILTER_OPTIONS } from "@/apps/production/modules/job-card-board/board";
import { fetchPlanTable, setPlanLineStatus } from "@/apps/production/modules/plan/planTable";
import { PROCESS_STATUS_BADGE } from "@/apps/production/lib/constants/processStatus";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";

const MODULE = PLANNING_MODULE;
const PAGE_CHUNK = 100;
const btn = `${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`;

const LINE_ACTIONS = [
  { key: "start", label: "Start", api: "running", Icon: Play, cls: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { key: "hold", label: "Hold", api: "hold", Icon: Pause, cls: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { key: "complete", label: "Done", api: "complete", Icon: Square, cls: "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100" },
];

function canLineAction(statusKey, key) {
  const st = String(statusKey || "pending").toLowerCase();
  if (st === "complete") return false;
  if (key === "start") return st !== "running";
  if (key === "hold") return st === "running";
  if (key === "complete") return st !== "complete";
  return false;
}

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
    const hay = [row.job_card_no, row.machine, row.process].filter(Boolean).join(" ").toLowerCase();
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

function PlanRowActions({ row, busyId, onAction }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {LINE_ACTIONS.map(({ key, label, api, Icon, cls }) =>
        canLineAction(row.statusKey, key) ? (
          <button
            key={key}
            type="button"
            disabled={Boolean(busyId)}
            className={`h-7 px-2 border text-[9px] font-bold uppercase inline-flex items-center gap-1 ${cls} disabled:opacity-50`}
            onClick={(e) => {
              e.stopPropagation();
              void onAction(row, api, label);
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        ) : null
      )}
    </div>
  );
}

export default function PlanTablePage() {
  const canAccess = useCanAccess();
  const canView = canAccess(MODULE, "view").allowed;
  const canEdit = canAccess(MODULE, "edit").allowed;
  const { processIds, machineIds, statusFromUrl } = useProductionFilterIds();

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(statusFromUrl || "all");
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [viewCard, setViewCard] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ sortKey: "job_card_no", sortDir: "asc" });
  const [limit, setLimit] = useState(PAGE_CHUNK);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPlanTable();
      setRows(data.rows || []);
      setMachines(data.machines || []);
      // selected is a row id string (DataTable onSelect), not a row object
      setSelected((cur) => (cur && (data.rows || []).some((r) => r.id === cur) ? cur : null));
    } catch (e) {
      setError(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    const data = rows.filter((r) => rowMatchesFilters(r, { processIds, machineIds, statusFromUrl: statusFilter, search }));
    return sortRowsByKey(data, sort.sortKey, sort.sortDir);
  }, [rows, processIds, machineIds, statusFilter, search, sort]);

  const visibleRows = useMemo(() => filteredRows.slice(0, limit), [filteredRows, limit]);

  const onLineAction = useCallback(
    async (row, apiStatus, label) => {
      if (!canEdit || busyId) return;
      setBusyId(row.id);
      try {
        await setPlanLineStatus(row.docno, row.processId, row.machineId, apiStatus);
        toast.success(`${row.job_card_no}: ${label}`);
        await load();
      } catch (e) {
        toast.error(e?.message || `${label} failed.`);
      } finally {
        setBusyId(null);
      }
    },
    [canEdit, busyId, load]
  );

  const headers = useMemo(
    () => [
      [
        "Job Card No",
        "job_card_no",
        (v) => <span className={`${IMS_TABLE_CELL_TEXT} font-mono font-bold text-indigo-700`}>{v || "—"}</span>,
        { width: "110px", fixed: true },
      ],
      ["Machine", "machine", textCell, { width: "120px" }],
      ["Process", "process", textCell, { width: "130px" }],
      [
        "Stage",
        "stage",
        (v) => (
          <span className={`${IMS_TABLE_CELL_NUMBER} text-center block`}>{v != null ? String(v) : "—"}</span>
        ),
        { width: "64px", align: "center" },
      ],
      [
        "Qty",
        "qty",
        (v) => <span className={`${IMS_TABLE_CELL_NUMBER} text-right block`}>{Number(v ?? 0).toLocaleString()}</span>,
        { width: "96px", align: "right", copyValue: (row) => String(row.qty ?? 0) },
      ],
      ["Plan Start", "planStart", textCell, { width: "130px" }],
      ["Actual Start", "actStart", textCell, { width: "130px" }],
      ["Plan End", "planEnd", textCell, { width: "110px" }],
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
      ...(canEdit
        ? [
            [
              "Actions",
              "actions",
              (_, row) => <PlanRowActions row={row} busyId={busyId} onAction={onLineAction} />,
              { width: "148px", sortable: false, excludeCopy: true, fixed: "right", align: "right" },
            ],
          ]
        : []),
    ],
    [canEdit, busyId, onLineAction]
  );

  // Drawer loads JC once — do not prefetch getById here (avoids double fetch).
  const openView = useCallback((row) => {
    if (!row?.docno) {
      toast.error("Job card not found.");
      return;
    }
    setViewCard({
      docno: row.docno,
      job_card_docno: row.docno,
      job_card_no: row.job_card_no,
      prime_item_code: row.prime_item_code,
    });
  }, []);

  const selectedRow = useMemo(
    () => (selected ? filteredRows.find((r) => r.id === selected) || rows.find((r) => r.id === selected) || null : null),
    [selected, filteredRows, rows]
  );

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: Boolean(viewCard),
    selectedId: selected,
    getSelectedRow: () => selectedRow,
    openEdit: (row) => void openView(row),
    canEditSelection: () => Boolean(selectedRow),
  });

  const resetFiltersView = () => setLimit(PAGE_CHUNK);

  if (!canView) {
    return <div className="p-8 text-sm text-slate-500">You do not have permission to view Production Planning.</div>;
  }

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      {viewCard ? <JobCardViewDrawer card={viewCard} onClose={() => setViewCard(null)} /> : null}

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
              <button type="button" className={btn} onClick={() => void load()} disabled={loading} title="Refresh">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
            }
          />
        </ListPageToolbar>

        <ProductionFilters
          processOptions={processOptions}
          machineOptions={machineOptions}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            resetFiltersView();
          }}
          searchLabel="Search Plan"
          searchPlaceholder="Job card, machine, process…"
          statusFilter={statusFilter}
          statusOptions={STATUS_FILTER_OPTIONS}
          onStatusChange={(v) => {
            setStatusFilter(v);
            resetFiltersView();
          }}
        />

        <div className={LIST_PAGE_TABLE_AREA_CLASS}>
          <DataTable
            headers={headers}
            data={visibleRows}
            loading={loading}
            allowCopy
            showSelection
            {...tableHotkeyProps}
            sortKey={sort.sortKey}
            sortDir={sort.sortDir}
            onSort={(key) => {
              setLimit(PAGE_CHUNK);
              setSort((p) => ({
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }));
            }}
            getRowId={(row) => row.id}
            selectedId={selected}
            onSelect={(id) => setSelected(id)}
            onRowDoubleClick={(row) => void openView(row)}
            onLoadMore={() => setLimit((n) => n + PAGE_CHUNK)}
            hasMore={visibleRows.length < filteredRows.length}
            totalItems={filteredRows.length}
            emptyIcon={Table2}
            emptyMessage={error ? "Could not load planning table" : "No plan lines"}
            emptySubMessage={
              error ? `${error} — refresh to retry.` : "Authorize job cards with a process plan, or relax filters."
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
