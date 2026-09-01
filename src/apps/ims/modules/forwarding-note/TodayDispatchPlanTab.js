"use client";

import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { Calendar } from "lucide-react";
import { toast } from "react-toastify";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { schedulePlanningService } from "@/apps/ims/lib/services/schedulePlanning";
import { scheduleItemRowKey, scheduleItemWiseSearchParts, ScheduleStatusBadge, formatSchHeaderDate } from "@/apps/ims/modules/schedule-planning/schedulePlanningColumns";
import { SCHEDULE_PLAN_STATUS, normalizeScheduleStatus, scheduleDispatchMatchPct, compareRecommendedDispatchRows } from "@/apps/ims/modules/schedule-planning/schedulePlanStatus";
import { IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { applyClientSearch, sortRowsByKey, nextSortParams } from "@/ui/common/list/clientListSearch";
import DataTable from "@/ui/primitives/DataTable";
import DispatchRescheduleModal from "./DispatchRescheduleModal";
import DispatchRejectModal from "./DispatchRejectModal";
import DispatchCompleteModal from "./DispatchCompleteModal";

function getTodayLabel() {
  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long" });
  const year = now.getFullYear();
  const day = now.getDate();
  return `Same month · till ${day} ${monthName} ${year} (today + past dates)`;
}

const DISPATCH_PLAN_ROW_LEGEND = [
  { swatch: "bg-emerald-50 border border-emerald-200 shadow-[inset_3px_0_0_0_#10b981]", label: "Stock sufficient (high match)" },
  { swatch: "bg-amber-50 border border-amber-200 shadow-[inset_3px_0_0_0_#f59e0b]", label: "Partial stock (lower match)" },
  { swatch: "bg-slate-100 border border-slate-200 shadow-[inset_3px_0_0_0_#94a3b8]", label: "Zero balance / Complete" },
];

function DispatchPlanRowLegend() {
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      {DISPATCH_PLAN_ROW_LEGEND.map(({ swatch, label }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
        >
          <span className={`w-3 h-3 rounded-sm shrink-0 ${swatch}`} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

function matchPctClass(pct) {
  if (pct >= 100) return "bg-emerald-100 border-emerald-300 text-emerald-900";
  if (pct >= 50) return "bg-amber-100 border-amber-300 text-amber-950";
  return "bg-slate-100 border-slate-300 text-slate-700";
}

/** Custom dispatch-plan columns — only what's needed */
function buildDispatchHeaders({ showMatchPct = false } = {}) {
  const cols = [
    [ "Sch No", "schno", (v) => (
        <span className="font-mono text-[10px] font-bold text-slate-800 uppercase tracking-tight">
          {v || "—"}
        </span>
      ),
      { fixed: true, width: "90px" }
    ],
    [ "Customer", "acc_name", (v) => (
        <span
          className="font-bold text-slate-900 text-[10px] uppercase whitespace-normal break-words leading-snug"
          title={v}
        >
          {v || "—"}
        </span>
      ),
      { width: "220px", wrap: true, copyValue: (row) => row.acc_name || "—" },
    ],
    [ "Item Code", "item_code", (v) => (
        <span className="font-bold text-slate-900 text-[10px] uppercase">{v || "—"}</span>
      ),
      { width: "130px" },
    ],
    [ "Balance Qty", "balance_qty", (v, row) => (
        <span className="inline-flex items-center justify-center min-w-[3rem] px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[11px] font-black tabular-nums text-amber-950">
          {Number(v ?? row.totalqty ?? row.total_qty ?? 0).toLocaleString()}
        </span>
      ),
      { align: "center", width: "90px" },
    ],
    [ "FG Stock", "fg_stock_qty", (v) => (
        <span className="font-black text-emerald-700 text-[11px] tabular-nums">
          {Number(v ?? 0).toLocaleString()}
        </span>
      ),
      { align: "center", width: "80px" },
    ],
  ];
  
  /*
  Comment because user don't see the row score
  if (showMatchPct) {
    cols.push([
      "Match %",
      "dispatch_match_pct",
      (v, row) => {
        const pct = Number(v ?? scheduleDispatchMatchPct(row) ?? 0);
        return (
          <span
            className={`inline-flex items-center justify-center min-w-[2.75rem] px-1.5 py-0.5 rounded-md border text-[10px] font-black tabular-nums ${matchPctClass(pct)}`}
          >
            {pct}%
          </span>
        );
      },
      { align: "center", width: "72px" },
    ]);
  }
  */

  cols.push(
    [ "Description", "itemdesc", (v) => (
        <span className={`${IMS_TABLE_CELL_TEXT} break-words text-slate-700`}>{v || "—"}</span>
      ),
      { width: "200px", wrap: true },
    ],
    [ "Status", "is_planned", (_v, row) => <ScheduleStatusBadge row={row} />, { width: "140px", align:'center' }],
    [ "Action Date", "action_date", (v) => (
        <span className={`${IMS_TABLE_CELL_TEXT} text-slate-600 font-bold uppercase`}>
          {formatSchHeaderDate(v)}
        </span>
      ),
      { width: "96px" },
    ],
    [ "Remark", "item_remark", (v) => (
        <span className={`${IMS_TABLE_CELL_TEXT} break-words text-slate-600`}>
          {v || "—"}
        </span>
      ),
      { width: "180px", wrap: true },
    ],
    [
      "Shortage No",
      "shortage_no",
      (v) => (
        <span className="font-bold text-amber-800 text-[10px] tabular-nums uppercase">
          {v || "—"}
        </span>
      ),
      { align: "center", width: "120px", copyValue: (row) => row.shortage_no || "—" },
    ],
  );

  return cols;
}

const TodayDispatchPlanTab = forwardRef(function TodayDispatchPlanTab({ search = "", statusFilter = "plan", onSelectedChange, onRowsChange, viewMode }, ref) {
  const canAccess = useCanAccess();
  const canAddPlan = useMemo(() => canAccess("schedule_planning", "add").allowed, [canAccess]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useState({ sortKey: "", sortDir: "asc" });
  const [displayLimit, setDisplayLimit] = useState(100);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectItem, setRejectItem] = useState(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeItem, setCompleteItem] = useState(null);

  const rangeLabel = useMemo(getTodayLabel, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await schedulePlanningService.dispatchHelper({
        permission_module: "forwarding_note_master",
        permission_action: "view",
        status: statusFilter,
      });
      setRows(Array.isArray(res?.data) ? res.data : []);
      setDisplayLimit(100);
    } catch {
      toast.error("Failed to load today's dispatch plan.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    const q = String(search || "").trim();
    let data = [...rows];
    if (q) {
      data = applyClientSearch(rows, search, {
        getParts: scheduleItemWiseSearchParts,
        skipSort: true,
      });
    }
    if (params.sortKey) {
      return sortRowsByKey(data, params.sortKey, params.sortDir);
    }
    if (statusFilter === "recommended") {
      return [...data].sort(compareRecommendedDispatchRows);
    }
    return data;
  }, [rows, search, params.sortKey, params.sortDir, statusFilter]);

  const headers = useMemo(
    () => buildDispatchHeaders({ showMatchPct: statusFilter === "recommended" }),
    [statusFilter]
  );

  useEffect(() => {
    setDisplayLimit(100);
  }, [search]);

  useEffect(() => {
    onRowsChange?.(filteredRows);
  }, [filteredRows, onRowsChange]);

  useEffect(() => {
    if (!selected) return;
    const stillExists = rows.some((r) => scheduleItemRowKey(r) === selected);
    if (!stillExists) {
      setSelected(null);
      onSelectedChange?.(null);
    }
  }, [rows, selected, onSelectedChange]);

  const displayRows = useMemo(() => {
    // Recommended: show every qualifying row (no client chunk truncate).
    if (statusFilter === "recommended") return filteredRows;
    return filteredRows.slice(0, displayLimit);
  }, [filteredRows, displayLimit, statusFilter]);

  const handleSelect = useCallback(
    (id) => {
      const row = id ? rows.find((r) => scheduleItemRowKey(r) === id) : null;
      if (row) {
        const balance = Number(row.balance_qty ?? row.totalqty ?? row.total_qty ?? 0);
        if (balance <= 0) {
          toast.info("No remaining balance on this schedule line — it is already fully forwarded.");
          return;
        }
      }
      setSelected(id);
      onSelectedChange?.(row ?? null);
    },
    [rows, onSelectedChange]
  );

  const handleOpenCompleteRow = useCallback(
    (row) => {
      if (!row || !canAddPlan) return;
      const dbStatus = Number(row.db_is_planned ?? row.is_planned);
      if (Number(row.is_planned) === SCHEDULE_PLAN_STATUS.COMPLETE) {
        toast.info("Already complete.");
        return;
      }
      if (dbStatus !== SCHEDULE_PLAN_STATUS.PLANNED && dbStatus !== SCHEDULE_PLAN_STATUS.RUNNING) {
        toast.warning("Only Plan items can be marked complete.");
        return;
      }
      setCompleteItem(row);
      setCompleteModalOpen(true);
    },
    [canAddPlan]
  );

  const handleCompleteSaved = useCallback(() => {
    setSelected(null);
    onSelectedChange?.(null);
    void fetchData();
  }, [fetchData, onSelectedChange]);

  const handleOpenRescheduleRow = useCallback(
    (row) => {
      if (!row || !canAddPlan) return;
      setRescheduleItem(row);
      setRescheduleModalOpen(true);
    },
    [canAddPlan]
  );

  const handleOpenRejectRow = useCallback(
    (row) => {
      if (!row || !canAddPlan) return;
      setRejectItem(row);
      setRejectModalOpen(true);
    },
    [canAddPlan]
  );

  const handleRejectSaved = useCallback(() => {
    setSelected(null);
    onSelectedChange?.(null);
    void fetchData();
  }, [fetchData, onSelectedChange]);

  const handleRescheduleSaved = useCallback(() => {
    setSelected(null);
    onSelectedChange?.(null);
    void fetchData();
  }, [fetchData, onSelectedChange]);

  const getSelectedRow = useCallback(
    () => (selected ? rows.find((r) => scheduleItemRowKey(r) === selected) ?? null : null),
    [selected, rows]
  );

  const getRowClassName = useCallback((row) => {
    const status = normalizeScheduleStatus(row.is_planned);
    const qty = Number(row.balance_qty ?? row.totalqty ?? row.total_qty ?? 0);
    const stock = Number(row.fg_stock_qty ?? 0);

    // Marked complete — muted.
    if (status === SCHEDULE_PLAN_STATUS.COMPLETE) {
      return "[&_td]:bg-slate-100 [&_td]:text-slate-500 [&_td:first-child]:shadow-[inset_3px_0_0_0_#64748b]";
    }

    // Zero remaining balance — muted (still selectable).
    if (qty <= 0) {
      return "[&_td]:bg-slate-100 [&_td]:text-slate-500 [&_td:first-child]:shadow-[inset_3px_0_0_0_#94a3b8]";
    }

    // Plan / Ready — stock adequacy highlighting (Recommended + Plan tabs).
    if (
      status === SCHEDULE_PLAN_STATUS.PLANNED ||
      status === SCHEDULE_PLAN_STATUS.RUNNING ||
      status === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH
    ) {
      if (qty > 0 && stock >= qty) {
        return "[&_td]:bg-emerald-50 [&_td:first-child]:shadow-[inset_3px_0_0_0_#10b981]";
      }
      if (qty > 0 && stock < qty) {
        return "[&_td]:bg-amber-50 [&_td:first-child]:shadow-[inset_3px_0_0_0_#f59e0b]";
      }
    }
    return "";
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      refresh: fetchData,
      loading,
      completing: completeModalOpen,
      rejecting: rejectModalOpen,
      clearSelection: () => {
        setSelected(null);
        onSelectedChange?.(null);
      },
      completeSelected: () => {
        const row = getSelectedRow();
        if (row) handleOpenCompleteRow(row);
      },
      rejectSelected: () => {
        const row = getSelectedRow();
        if (row) handleOpenRejectRow(row);
      },
      openRescheduleForSelected: () => {
        const row = getSelectedRow();
        if (row) handleOpenRescheduleRow(row);
      },
      hasSelected: Boolean(selected),
    }),
    [
      fetchData,
      loading,
      completeModalOpen,
      rejectModalOpen,
      selected,
      getSelectedRow,
      handleOpenCompleteRow,
      handleOpenRejectRow,
      handleOpenRescheduleRow,
      onSelectedChange,
    ]
  );

  return (
    <>
      {/* Table */}
      <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
        <DataTable
          headers={headers}
          data={displayRows}
          loading={loading}
          allowCopy
          viewMode={viewMode}
          getRowClassName={getRowClassName}
          sortKey={params.sortKey}
          sortDir={params.sortDir}
          onSort={(key) => {
            setParams((prev) => nextSortParams(prev, key));
            setDisplayLimit(100);
          }}
          selectedId={selected}
          onSelect={handleSelect}
          getRowId={scheduleItemRowKey}
          emptyIcon={Calendar}
          emptyMessage="No dispatch plan items"
          emptySubMessage={
            statusFilter === "recommended"
              ? "Balance + FG stock lines sorted by match % (100% top → lower below)"
              : `No schedule items found ${rangeLabel}`
          }
          onLoadMore={() => {
            if (statusFilter === "recommended") return;
            if (!loading && displayRows.length < filteredRows.length) {
              setDisplayLimit((n) => n + 100);
            }
          }}
          hasMore={statusFilter !== "recommended" && displayRows.length < filteredRows.length}
          totalItems={filteredRows.length}
          cardConfig={{
            titleKey: "schno",
            badgeIndices: [7],
            detailKeys: ["acc_name", "item_code", "itemdesc", "balance_qty", "action_date", "item_remark"],
            footerKey: "schdt",
          }}
        />
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center shrink-0 gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 min-w-0 sm:w-[28%]">
          {search
            ? `${displayRows.length} of ${filteredRows.length} matching`
            : `Showing ${displayRows.length} of ${filteredRows.length} items`}
          {selected ? " · 1 selected" : ""}
        </span>
        <div className="flex-1 flex justify-center min-w-0 px-1">
          <DispatchPlanRowLegend />
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:w-[28%] justify-end">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
        </div>
      </div>

      <DispatchRescheduleModal
        open={rescheduleModalOpen}
        item={rescheduleItem}
        onClose={() => {
          setRescheduleModalOpen(false);
          setRescheduleItem(null);
        }}
        onSaved={handleRescheduleSaved}
      />

      <DispatchRejectModal
        open={rejectModalOpen}
        item={rejectItem}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectItem(null);
        }}
        onSaved={handleRejectSaved}
      />

      <DispatchCompleteModal
        open={completeModalOpen}
        item={completeItem}
        onClose={() => {
          setCompleteModalOpen(false);
          setCompleteItem(null);
        }}
        onSaved={handleCompleteSaved}
      />
    </>
  );
});

export default TodayDispatchPlanTab;
