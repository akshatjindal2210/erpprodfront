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

function getTodayLabel() {
  const now = new Date();
  return `Till ${now.getDate()} ${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;
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
    [ "Qty", "totalqty", (v, row) => (
        <span className="font-black text-slate-700 text-[11px] tabular-nums">
          {Number(v ?? row.total_qty ?? 0).toLocaleString()}
        </span>
      ),
      { align: "center", width: "80px" },
    ],
    [ "FG Stock", "fg_stock_qty", (v) => (
        <span className="font-black text-slate-700 text-[11px] tabular-nums">
          {Number(v ?? 0).toLocaleString()}
        </span>
      ),
      { align: "center", width: "80px" },
    ],
  ];

  return cols;
}

const TodayDispatchPlanTab = forwardRef(function TodayDispatchPlanTab({ search = "", statusFilter = "all", onSelectedChange, onRowsChange, viewMode }, ref) {
  const canAccess = useCanAccess();
  const canAddPlan = useMemo(() => canAccess("schedule_planning", "add").allowed, [canAccess]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useState({ sortKey: "", sortDir: "asc" });
  const [displayLimit, setDisplayLimit] = useState(100);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

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
      toast.error("Failed to load dispatch plan data");
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

  const handleCompleteRow = useCallback(
    async (row) => {
      if (!row || !canAddPlan) return;
      if (!row.fin_year_id) {
        toast.error("Financial year not found for this item.");
        return;
      }
      setCompleting(true);
      try {
        const res = await schedulePlanningService.dispatchComplete({
          fin_year_id: String(row.fin_year_id),
          schno: row.schno,
          itemdcode: row.itemdcode,
          schmonth: row.schmonth,
          schdt: row.schdt,
          acc_code: row.acc_code,
          acc_name: row.acc_name,
          item_code: row.item_code,
          itemdesc: row.itemdesc,
          totalqty: Number(row.totalqty ?? 0),
        });
        if (!res?.success) throw new Error(res?.message || "Complete failed.");
        toast.success("Item marked as complete.");
        setSelected(null);
        onSelectedChange?.(null);
        void fetchData();
      } catch (err) {
        toast.error(err?.message || "Failed to mark as complete.");
      } finally {
        setCompleting(false);
      }
    },
    [canAddPlan, fetchData, onSelectedChange]
  );

  const handleOpenRescheduleRow = useCallback(
    (row) => {
      if (!row || !canAddPlan) return;
      setRescheduleItem(row);
      setRescheduleModalOpen(true);
    },
    [canAddPlan]
  );

  const handleRejectRow = useCallback(
    async (row) => {
      if (!row || !canAddPlan) return;
      if (!row.fin_year_id) {
        toast.error("Financial year not found for this item.");
        return;
      }
      setRejecting(true);
      try {
        const res = await schedulePlanningService.reject({
          fin_year_id: String(row.fin_year_id),
          schno: row.schno,
          itemdcode: row.itemdcode,
          schmonth: row.schmonth,
          schdt: row.schdt,
          acc_code: row.acc_code,
          acc_name: row.acc_name,
          item_code: row.item_code,
          itemdesc: row.itemdesc,
          totalqty: Number(row.totalqty ?? 0),
          action_reason: "Rejected from dispatch plan",
          item_remark: row.item_remark ?? null,
        });
        if (!res?.success) throw new Error(res?.message || "Reject failed.");
        toast.success("Item marked as reject.");
        setSelected(null);
        onSelectedChange?.(null);
        void fetchData();
      } catch (err) {
        toast.error(err?.message || "Failed to reject item.");
      } finally {
        setRejecting(false);
      }
    },
    [canAddPlan, fetchData, onSelectedChange]
  );

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
    const qty = Number(row.totalqty ?? row.total_qty ?? 0);
    const stock = Number(row.fg_stock_qty ?? 0);

    // Hold items should always stand out in red.
    if (status === 6) {
      return "[&_td]:bg-rose-50/70";
    }

    // Scheduled / planned rows use stock adequacy highlighting.
    if (status === 1) {
      if (qty > 0 && stock >= qty) {
        return "[&_td]:bg-emerald-50/60";
      }
      if (qty > 0 && stock < qty) {
        return "[&_td]:bg-amber-50/70";
      }
    }
    return "";
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      refresh: fetchData,
      loading,
      completing,
      rejecting,
      completeSelected: () => {
        const row = getSelectedRow();
        if (row && Number(row.is_planned) === 1) void handleCompleteRow(row);
      },
      rejectSelected: () => {
        const row = getSelectedRow();
        if (row) void handleRejectRow(row);
      },
      openRescheduleForSelected: () => {
        const row = getSelectedRow();
        if (row) handleOpenRescheduleRow(row);
      },
      hasSelected: Boolean(selected),
    }),
    [fetchData, loading, completing, rejecting, selected, getSelectedRow, handleCompleteRow, handleRejectRow, handleOpenRescheduleRow]
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
            badgeIndices: [6],
            detailKeys: ["acc_name", "item_code", "itemdesc", "totalqty", "action_date", "item_remark"],
            footerKey: "schdt",
          }}
        />
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {search
            ? `${displayRows.length} of ${filteredRows.length} matching`
            : `Showing ${displayRows.length} of ${filteredRows.length} items`}
          {selected ? " · 1 selected" : ""}
        </span>
        <div className="flex items-center gap-2">
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
    </>
  );
});

export default TodayDispatchPlanTab;
