"use client";

import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { Calendar } from "lucide-react";
import { toast } from "react-toastify";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { schedulePlanningService } from "@/features/apps/ims/services/schedulePlanning";
import { scheduleItemRowKey, scheduleItemWiseSearchParts, ScheduleStatusBadge, formatSchHeaderDate } from "@/features/apps/ims/components/schedule-planning/schedulePlanningColumns";
import { IMS_TABLE_CELL_TEXT } from "@/features/apps/ims/helpers/listPageShellClasses";
import { applyClientSearch, sortRowsByKey, nextSortParams } from "@/features/apps/ims/helpers/clientListSearch";
import { formatDocDate } from "@/core/utils/utilHelper";
import DataTable from "@/core/components/ui/DataTable";
import DispatchRescheduleModal from "./DispatchRescheduleModal";
import DispatchRejectModal from "./DispatchRejectModal";
import DispatchCompleteModal from "./DispatchCompleteModal";

function getTodayLabel() {
  const now = new Date();
  return `Till ${now.getDate()} ${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;
}

const DISPATCH_PLAN_ROW_LEGEND = [
  { swatch: "bg-emerald-50 border border-emerald-200 shadow-[inset_3px_0_0_0_#10b981]", label: "Stock sufficient" },
  { swatch: "bg-amber-50 border border-amber-200 shadow-[inset_3px_0_0_0_#f59e0b]", label: "Insufficient stock" },
  { swatch: "bg-rose-50 border border-rose-200 shadow-[inset_3px_0_0_0_#f43f5e]", label: "On hold" },
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

/** Custom dispatch-plan columns — only what's needed */
function buildDispatchHeaders() {
  const cols = [
    [ "Sch No", "schno", (v) => (
        <span className="font-mono text-[10px] font-bold text-slate-800 uppercase tracking-tight">
          {v || "—"}
        </span>
      ), 
      { fixed: true, width: "90px" } 
    ],
    [ "Due Date", "action_date", (v) => (
        <span className={`${IMS_TABLE_CELL_TEXT} text-slate-600 font-bold uppercase`}>
          {formatSchHeaderDate(v)}
        </span>
      ), 
      { width: "96px" },
    ],
    [ "Status", "is_planned", (_v, row) => <ScheduleStatusBadge row={row} />, { width: "88px" }],
    [ "Remark", "item_remark", (v) => (
        <span className={`${IMS_TABLE_CELL_TEXT} break-words text-slate-600`}>
          {v || "—"}
        </span>
      ), 
      { width: "180px", wrap: true },
    ],
    [ "Item Code", "item_code", (v) => (
        <span className="font-bold text-slate-900 text-[10px] uppercase">{v || "—"}</span>
      ),
      { width: "130px" },
    ],
    [ "Description", "itemdesc", (v) => (
        <span className={`${IMS_TABLE_CELL_TEXT} break-words text-slate-700`}>{v || "—"}</span>
      ),
      { width: "200px", wrap: true },
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

  return cols;
}

const TodayDispatchPlanTab = forwardRef(function TodayDispatchPlanTab({ search = "", statusFilter = "active", onSelectedChange, onRowsChange, viewMode }, ref) {
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
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [rows, search, params.sortKey, params.sortDir]);

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

  const displayRows = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);

  const handleSelect = useCallback(
    (id) => {
      setSelected(id);
      const row = id ? rows.find((r) => scheduleItemRowKey(r) === id) : null;
      onSelectedChange?.(row ?? null);
    },
    [rows, onSelectedChange]
  );

  const handleOpenCompleteRow = useCallback(
    (row) => {
      if (!row || !canAddPlan) return;
      if (Number(row.is_planned) !== 1) {
        toast.warning("Only planned items can be marked as complete.");
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
    const status = Number(row.is_planned);
    const qty = Number(row.balance_qty ?? row.totalqty ?? row.total_qty ?? 0);
    const stock = Number(row.fg_stock_qty ?? 0);

    // Marked complete — muted.
    if (status === 3) {
      return "[&_td]:bg-slate-100 [&_td]:text-slate-500 [&_td:first-child]:shadow-[inset_3px_0_0_0_#64748b]";
    }

    // Hold items should always stand out in red.
    if (status === 6) {
      return "[&_td]:bg-rose-50 [&_td:first-child]:shadow-[inset_3px_0_0_0_#f43f5e]";
    }

    // Zero remaining balance — muted (still selectable).
    if (qty <= 0) {
      return "[&_td]:bg-slate-100 [&_td]:text-slate-500 [&_td:first-child]:shadow-[inset_3px_0_0_0_#94a3b8]";
    }

    // Scheduled / planned rows use stock adequacy highlighting.
    if (status === 1) {
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

  const headers = useMemo(() => buildDispatchHeaders(), []);

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
          emptySubMessage={`No schedule items found ${rangeLabel}`}
          onLoadMore={() => {
            if (!loading && displayRows.length < filteredRows.length) {
              setDisplayLimit((n) => n + 100);
            }
          }}
          hasMore={displayRows.length < filteredRows.length}
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
