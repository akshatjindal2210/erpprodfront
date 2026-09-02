"use client";

import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { Calendar } from "lucide-react";
import { toast } from "react-toastify";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { schedulePlanningService } from "@/apps/ims/lib/services/schedulePlanning";
import { scheduleItemRowKey, scheduleItemWiseSearchParts, ScheduleStatusBadge, formatSchHeaderDate } from "@/apps/ims/modules/schedule-planning/schedulePlanningColumns";
import { SCHEDULE_PLAN_STATUS, normalizeScheduleStatus, scheduleDispatchMatchPct, scheduleDispatchWorkableQty, compareRecommendedDispatchRows } from "@/apps/ims/modules/schedule-planning/schedulePlanStatus";
import { IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { applyClientSearch, sortRowsByKey, nextSortParams } from "@/ui/common/list/clientListSearch";
import DataTable from "@/ui/primitives/DataTable";
import DispatchRescheduleModal from "./DispatchRescheduleModal";
import DispatchRejectModal from "./DispatchRejectModal";
import DispatchCompleteModal from "./DispatchCompleteModal";

function joinUniqueCsv(values) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.join(", ");
}

function scheduleCustomerRowKey(row) {
  return String(row?.acc_code ?? "").trim();
}

function itemDispatchQty(row) {
  return Number(row?.dispatch_workable_qty ?? scheduleDispatchWorkableQty(row));
}

function itemBoxCount(row) {
  const fromApi = Number(row?.dispatch_box_count);
  if (Number.isFinite(fromApi) && fromApi >= 0) return fromApi;

  const qty = itemDispatchQty(row);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const per = Number(row?.qty_per_box);
  if (Number.isFinite(per) && per > 0) {
    const full = Math.floor(qty / per);
    return full + (qty % per > 0 ? 1 : 0);
  }
  return 1;
}

function customerTotalBoxCount(row) {
  if (row?.recommended_total_boxes != null) return Number(row.recommended_total_boxes) || 0;
  return itemBoxCount(row);
}

/** Item code with per-line dispatch qty, comma-separated. */
function formatItemsWithDispatchQty(items) {
  return items
    .map((r) => {
      const code = String(r.item_code ?? "").trim();
      if (!code) return "";
      return `${code} (${itemDispatchQty(r).toLocaleString()})`;
    })
    .filter(Boolean)
    .join(", ");
}

/** Customer-wise recommended: highest total dispatch qty first (tie → item-wise rules). */
function compareRecommendedCustomerRows(a, b) {
  const qtyA = Number(a?.recommended_dispatch_qty ?? a?.dispatch_workable_qty ?? 0);
  const qtyB = Number(b?.recommended_dispatch_qty ?? b?.dispatch_workable_qty ?? 0);
  if (qtyB !== qtyA) return qtyB - qtyA;
  return compareRecommendedDispatchRows(a, b);
}

/** One row per customer — sch no comma-separated; items with dispatch qty. */
function groupRecommendedByCustomer(itemRows) {
  const byAcc = new Map();
  for (const row of itemRows) {
    const acc = scheduleCustomerRowKey(row);
    if (!acc) continue;
    if (!byAcc.has(acc)) byAcc.set(acc, []);
    byAcc.get(acc).push(row);
  }

  const grouped = [];
  for (const items of byAcc.values()) {
    items.sort(compareRecommendedDispatchRows);
    const anchor = items[0];
    const matchPcts = items.map((r) => Number(r.dispatch_match_pct ?? scheduleDispatchMatchPct(r)));
    const recommended_dispatch_qty = items.reduce((sum, r) => sum + itemDispatchQty(r), 0);
    const boxTotals = items.reduce((sum, r) => sum + itemBoxCount(r), 0);
    grouped.push({
      ...anchor,
      schno: joinUniqueCsv(items.map((r) => r.schno)),
      item_code: formatItemsWithDispatchQty(items),
      recommended_total_boxes: boxTotals,
      itemdesc: joinUniqueCsv(items.map((r) => r.itemdesc)),
      action_date: joinUniqueCsv(items.map((r) => r.action_date)),
      item_remark: joinUniqueCsv(items.map((r) => r.item_remark)),
      shortage_no: joinUniqueCsv(items.map((r) => r.shortage_no)),
      recommended_dispatch_qty,
      dispatch_workable_qty: recommended_dispatch_qty,
      dispatch_match_pct: matchPcts.length ? Math.min(...matchPcts) : 0,
      _groupItems: items,
    });
  }

  grouped.sort(compareRecommendedCustomerRows);
  return grouped;
}

/** Expanded customer items — same DataTable (resize, sort, copy) as item-wise view. */
function DispatchCustomerItemSubTable({ items, headers, getRowClassName }) {
  const [params, setParams] = useState({ sortKey: "", sortDir: "asc" });
  const rows = useMemo(() => {
    if (!params.sortKey) return items;
    return sortRowsByKey([...items], params.sortKey, params.sortDir);
  }, [items, params.sortKey, params.sortDir]);

  if (!items.length) return null;

  return (
    <div className="h-[min(280px,35vh)] min-h-[120px] flex flex-col overflow-hidden border-l-4 border-indigo-400 bg-slate-50/90">
      <DataTable
        headers={headers}
        data={rows}
        allowCopy
        viewMode="table"
        showSelection={false}
        getRowClassName={getRowClassName}
        getRowId={scheduleItemRowKey}
        sortKey={params.sortKey}
        sortDir={params.sortDir}
        onSort={(key) => setParams((prev) => nextSortParams(prev, key))}
        emptyMessage="No items"
        suppressLoadingFooterRow
        centerLoadingOverlay={false}
        hotkeysDisabled
        enableCellSelection
      />
    </div>
  );
}

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

/** Plan / Item + Recommended by Customer (uncomment) — same column format. */
function dispatchPlanDetailColumns() {
  return [
    [ "Description", "itemdesc", (v) => (
        <span className={`${IMS_TABLE_CELL_TEXT} break-words text-slate-700`}>{v || "—"}</span>
      ),
      { width: "200px", wrap: true },
    ],
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
  ];
}

function dispatchPlanStatusColumn() {
  return [
    "Status",
    "is_planned",
    (_v, row) => <ScheduleStatusBadge row={row} />,
    { width: "140px", align: "center" },
  ];
}

/** Custom dispatch-plan columns — only what's needed */
function buildDispatchHeaders({ showMatchPct = false, customerRecommendedView = false } = {}) {
  const cols = [];

  if (!customerRecommendedView) {
    cols.push(["Sch No", "schno", (v) => (
        <span className="font-mono text-[10px] font-bold text-slate-800 uppercase tracking-tight">
          {v || "—"}
        </span>
      ),
      { fixed: true, width: "90px" },
    ]);
  }

  cols.push(
    ["Customer", "acc_name", (v) => (
        <span
          className="font-bold text-slate-900 text-[10px] uppercase whitespace-normal break-words leading-snug"
          title={v}
        >
          {v || "—"}
        </span>
      ),
      { fixed: customerRecommendedView, width: "220px", wrap: true, copyValue: (row) => row.acc_name || "—" },
    ],
    [
      customerRecommendedView ? "Item (Dispatch Qty)" : "Item Code",
      "item_code",
      (v) => (
        <span
          className={`font-bold text-slate-900 text-[10px] uppercase ${customerRecommendedView ? "whitespace-normal break-words leading-snug" : ""}`}
          title={v}
        >
          {v || "—"}
        </span>
      ),
      { width: customerRecommendedView ? "220px" : "130px", wrap: customerRecommendedView, copyValue: (row) => row.item_code || "—" },
    ]
  );

  if (customerRecommendedView) {
    cols.push([
      "Rec. Dispatch Qty",
      "recommended_dispatch_qty",
      (v, row) => (
        <span className="inline-flex items-center justify-center min-w-[3rem] px-1.5 py-0.5 rounded-md bg-indigo-100 border border-indigo-300 text-[11px] font-black tabular-nums text-indigo-950">
          {Number(v ?? row.dispatch_workable_qty ?? 0).toLocaleString()}
        </span>
      ),
      { align: "center", width: "110px", copyValue: (row) => String(row.recommended_dispatch_qty ?? row.dispatch_workable_qty ?? 0) },
    ]);
    cols.push([
      "Total Boxes",
      "recommended_total_boxes",
      (v, row) => (
        <span className="font-black text-slate-800 text-[11px] tabular-nums">
          {Number(v ?? customerTotalBoxCount(row)).toLocaleString()}
        </span>
      ),
      {
        align: "center",
        width: "82px",
        copyValue: (row) => String(customerTotalBoxCount(row)),
      },
    ]);

    // when we need then uncomment — Plan tab same format (dispatchPlanDetailColumns)
    // cols.push(...dispatchPlanDetailColumns());
  } else {
    cols.push(
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
      ]
    );
  }
  
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

  if (customerRecommendedView) {
    cols.push(dispatchPlanStatusColumn());
  } else {
    const [descriptionCol, actionDateCol, remarkCol, shortageCol] = dispatchPlanDetailColumns();
    cols.push(
      descriptionCol,
      dispatchPlanStatusColumn(),
      actionDateCol,
      remarkCol,
      shortageCol
    );
  }

  return cols;
}

const TodayDispatchPlanTab = forwardRef(function TodayDispatchPlanTab({ search = "", statusFilter = "plan", onSelectedChange, onRowsChange, viewMode }, ref) {
  const canAccess = useCanAccess();
  const canAddPlan = useMemo(() => canAccess("schedule_planning", "add").allowed, [canAccess]);
  const isRecommendedItem = statusFilter === "recommended";
  const isRecommendedCustomer = statusFilter === "recommended_customer";
  const isRecommendedView = isRecommendedItem || isRecommendedCustomer;

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
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
      const apiStatus = isRecommendedCustomer ? "recommended" : statusFilter;
      const res = await schedulePlanningService.dispatchHelper({
        permission_module: "forwarding_note_master",
        permission_action: "view",
        status: apiStatus,
      });
      setRows(Array.isArray(res?.data) ? res.data : []);
      setDisplayLimit(100);
    } catch {
      toast.error("Failed to load today's dispatch plan.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isRecommendedCustomer]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelected(null);
    setExpandedCustomerId(null);
    onSelectedChange?.(null);
  }, [statusFilter, onSelectedChange]);

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
    if (isRecommendedView) {
      return [...data].sort(compareRecommendedDispatchRows);
    }
    return data;
  }, [rows, search, params.sortKey, params.sortDir, isRecommendedView]);

  const customerRows = useMemo(
    () => (isRecommendedCustomer ? groupRecommendedByCustomer(filteredRows) : []),
    [filteredRows, isRecommendedCustomer]
  );

  const headers = useMemo(
    () => buildDispatchHeaders({ showMatchPct: isRecommendedView, customerRecommendedView: isRecommendedCustomer }),
    [isRecommendedView, isRecommendedCustomer]
  );

  const itemDetailHeaders = useMemo(
    () => buildDispatchHeaders({ showMatchPct: true, customerRecommendedView: false }),
    []
  );

  useEffect(() => {
    setDisplayLimit(100);
  }, [search]);

  useEffect(() => {
    onRowsChange?.(filteredRows);
  }, [filteredRows, onRowsChange]);

  useEffect(() => {
    if (!selected) return;
    const stillExists = isRecommendedCustomer
      ? customerRows.some((r) => scheduleCustomerRowKey(r) === selected)
      : rows.some((r) => scheduleItemRowKey(r) === selected);
    if (!stillExists) {
      setSelected(null);
      onSelectedChange?.(null);
    }
  }, [rows, customerRows, selected, onSelectedChange, isRecommendedCustomer]);

  useEffect(() => {
    if (!expandedCustomerId || !isRecommendedCustomer) return;
    if (!customerRows.some((r) => scheduleCustomerRowKey(r) === expandedCustomerId)) {
      setExpandedCustomerId(null);
    }
  }, [customerRows, expandedCustomerId, isRecommendedCustomer]);

  const displayRows = useMemo(() => {
    if (isRecommendedCustomer) return customerRows;
    // Recommended by item: show every qualifying row (no client chunk truncate).
    if (isRecommendedItem) return filteredRows;
    return filteredRows.slice(0, displayLimit);
  }, [filteredRows, customerRows, displayLimit, isRecommendedCustomer, isRecommendedItem]);

  const resolveRowById = useCallback(
    (id) => {
      if (!id) return null;
      if (isRecommendedCustomer) {
        return customerRows.find((r) => scheduleCustomerRowKey(r) === id) ?? null;
      }
      return rows.find((r) => scheduleItemRowKey(r) === id) ?? null;
    },
    [customerRows, isRecommendedCustomer, rows]
  );

  const getRowId = useCallback(
    (row) => (isRecommendedCustomer ? scheduleCustomerRowKey(row) : scheduleItemRowKey(row)),
    [isRecommendedCustomer]
  );

  const handleSelect = useCallback(
    (id) => {
      if (!id) {
        setSelected(null);
        setExpandedCustomerId(null);
        onSelectedChange?.(null);
        return;
      }
      const row = resolveRowById(id);
      if (row) {
        const dispatchQty = isRecommendedCustomer
          ? Number(row.recommended_dispatch_qty ?? row.dispatch_workable_qty ?? 0)
          : Number(row.balance_qty ?? row.totalqty ?? row.total_qty ?? 0);
        if (dispatchQty <= 0) {
          toast.info(
            isRecommendedCustomer
              ? "No recommended dispatch qty for this customer."
              : "No remaining balance on this schedule line — it is already fully forwarded."
          );
          return;
        }
      }
      setSelected(id);
      onSelectedChange?.(row ?? null);
    },
    [resolveRowById, onSelectedChange, isRecommendedCustomer]
  );

  const handleCustomerDoubleClick = useCallback(
    (_row, id) => {
      if (!isRecommendedCustomer || !id) return;
      const row = resolveRowById(id);
      if (!row) return;
      const dispatchQty = Number(row.recommended_dispatch_qty ?? row.dispatch_workable_qty ?? 0);
      if (dispatchQty <= 0) {
        toast.info("No recommended dispatch qty for this customer.");
        return;
      }
      setSelected(id);
      onSelectedChange?.(row);
      setExpandedCustomerId((prev) => (String(prev) === String(id) ? null : id));
    },
    [isRecommendedCustomer, resolveRowById, onSelectedChange]
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
    () => (selected ? resolveRowById(selected) : null),
    [selected, resolveRowById]
  );

  const getRowClassName = useCallback((row) => {
    const items = Array.isArray(row?._groupItems) && row._groupItems.length ? row._groupItems : [row];
    let green = false;
    let amber = false;
    let slate = false;

    for (const item of items) {
      const status = normalizeScheduleStatus(item.is_planned);
      const qty = Number(item.balance_qty ?? item.totalqty ?? item.total_qty ?? 0);
      const stock = Number(item.fg_stock_qty ?? 0);

      if (status === SCHEDULE_PLAN_STATUS.COMPLETE || qty <= 0) {
        slate = true;
        continue;
      }

      if (
        status === SCHEDULE_PLAN_STATUS.PLANNED ||
        status === SCHEDULE_PLAN_STATUS.RUNNING ||
        status === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH
      ) {
        if (qty > 0 && stock >= qty) green = true;
        else if (qty > 0 && stock < qty) amber = true;
      }
    }

    if (amber) {
      return "[&_td]:bg-amber-50 [&_td:first-child]:shadow-[inset_3px_0_0_0_#f59e0b]";
    }
    if (green && !slate) {
      return "[&_td]:bg-emerald-50 [&_td:first-child]:shadow-[inset_3px_0_0_0_#10b981]";
    }
    if (slate && !green && !amber) {
      return "[&_td]:bg-slate-100 [&_td]:text-slate-500 [&_td:first-child]:shadow-[inset_3px_0_0_0_#94a3b8]";
    }
    if (green) {
      return "[&_td]:bg-emerald-50 [&_td:first-child]:shadow-[inset_3px_0_0_0_#10b981]";
    }
    return "";
  }, []);

  const renderCustomerItemExpand = useCallback(
    (row) => {
      const items = Array.isArray(row?._groupItems) ? [...row._groupItems].sort(compareRecommendedDispatchRows) : [];
      return (
        <DispatchCustomerItemSubTable
          items={items}
          headers={itemDetailHeaders}
          getRowClassName={getRowClassName}
        />
      );
    },
    [itemDetailHeaders, getRowClassName]
  );

  useImperativeHandle(
    ref,
    () => ({
      refresh: fetchData,
      loading,
      completing: completeModalOpen,
      rejecting: rejectModalOpen,
      clearSelection: () => {
        setSelected(null);
        setExpandedCustomerId(null);
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
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
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
          onRowDoubleClick={isRecommendedCustomer ? handleCustomerDoubleClick : undefined}
          getRowId={getRowId}
          expandedRowId={isRecommendedCustomer ? expandedCustomerId : null}
          renderExpandedRow={isRecommendedCustomer ? renderCustomerItemExpand : undefined}
          emptyIcon={Calendar}
          emptyMessage="No dispatch plan items"
          emptySubMessage={
            isRecommendedCustomer
              ? "Single click — select · Double click — expand items under row"
              : isRecommendedItem
                ? "Balance + FG stock lines sorted by match % (100% top → lower below)"
                : `No schedule items found ${rangeLabel}`
          }
          onLoadMore={() => {
            if (isRecommendedView) return;
            if (!loading && displayRows.length < filteredRows.length) {
              setDisplayLimit((n) => n + 100);
            }
          }}
          hasMore={!isRecommendedView && displayRows.length < filteredRows.length}
          totalItems={displayRows.length}
          cardConfig={{
            titleKey: isRecommendedCustomer ? "acc_name" : "schno",
            badgeIndices: isRecommendedCustomer ? [4] : [7],
            detailKeys: isRecommendedCustomer
              ? ["item_code", "recommended_dispatch_qty", "recommended_total_boxes"]
              : ["acc_name", "item_code", "itemdesc", "balance_qty", "action_date", "item_remark"],
            footerKey: "schdt",
          }}
        />
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center shrink-0 gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 min-w-0 sm:w-[28%]">
          {search
            ? isRecommendedCustomer
              ? `${displayRows.length} matching customers`
              : `${displayRows.length} of ${filteredRows.length} matching`
            : isRecommendedCustomer
              ? `Showing ${displayRows.length} customers`
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
