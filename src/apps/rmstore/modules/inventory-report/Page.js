"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import DataTable from "@/ui/primitives/DataTable";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { inventoryReportService } from "@/apps/rmstore/lib/services/inventoryReport";
import { sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { sortSelectRowsAsc } from "@/platform/utils/form/sortSelectOptions";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_NUMBER, IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { buildInventoryFilterOptionsFromRows, EMPTY_FILTERS, filterInventoryRows, formatCoilUidTooltip, hasActiveInventoryFilters, normalizeMultiFilterIds } from "@/apps/rmstore/modules/inventory-report/inventoryReportClient";
import { computeInventoryTotals, INVENTORY_FOOTER_CARDS, INVENTORY_FOOTER_TONE, INVENTORY_QTY_META, INVENTORY_REPORT_RULES, INVENTORY_REPORT_TABLE_COLUMNS, formatInventoryTableCell } from "@/apps/rmstore/modules/inventory-report/inventoryReport.config";
import { notifyListPageExportResult } from "@/platform/utils/list/listPageExport";
import { exportInventoryReport } from "@/apps/rmstore/modules/inventory-report/inventoryReportExport";
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";

const LOAD_LIMIT = 10000;
const TABLE_RENDER_CHUNK = 150;

function filterLabel(label, count) {
  return `${label} (${Number(count) || 0})`;
}

/** Body + card tint — Issuable, QC Pending, RM Rejection only (no header colors). */
const COLUMN_TONE = {
  issuable_qty: {
    cell: "bg-emerald-50 text-emerald-950 group-hover:bg-emerald-100/80",
    cardValue: "text-emerald-800 font-black tabular-nums",
    cardBadge:
      "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200 tabular-nums",
  },
  pending_qc_qty: {
    cell: "bg-orange-50 text-orange-950 group-hover:bg-orange-100/80",
    cardValue: "text-orange-900 font-bold tabular-nums",
  },
  pending_reject_qty: {
    cell: "bg-red-50 text-red-950 group-hover:bg-red-100/80",
    cardValue: "text-red-800 font-bold tabular-nums",
  },
};

function renderQtyCell(type, value, { title } = {}) {
  return (
    <span
      className={`block w-full font-semibold tabular-nums ${title ? "cursor-help" : ""} ${tableCellClass(type)}`}
      title={title}
    >
      {formatInventoryTableCell(type, value)}
    </span>
  );
}

function tableCellClass(type) {
  if (type === "number") return IMS_TABLE_CELL_NUMBER;
  if (type === "date") return IMS_TABLE_CELL_DATE;
  return IMS_TABLE_CELL_TEXT;
}

export default function InventoryReportPage() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [displayLimit, setDisplayLimit] = useState(TABLE_RENDER_CHUNK);
  const [params, setParams] = useState({
    sortKey: "mrn_no",
    sortDir: "desc",
  });
  const [exporting, setExporting] = useState(false);

  const loadGenRef = useRef(0);

  const allItemOptions = useMemo(() => {
    const byCode = new Map();
    for (const row of allRows) {
      const id = String(row?.item_dcode ?? row?.item_code ?? "").trim();
      const itemCode = String(row?.item_code ?? row?.item_dcode ?? id).trim();
      if (!id || id === "—" || !itemCode || itemCode === "—") continue;
      const key = itemCode.toUpperCase();
      if (!byCode.has(key)) {
        byCode.set(key, { id, item_code: itemCode, item_desc: row?.item_desc ?? null });
      }
    }
    return sortSelectRowsAsc([...byCode.values()], "item_code", ["item_desc"]);
  }, [allRows]);

  const filterOptions = useMemo(
    () => buildInventoryFilterOptionsFromRows(allRows, filters),
    [allRows, filters]
  );

  const filteredRows = useMemo(
    () => filterInventoryRows(allRows, filters, allItemOptions),
    [allRows, filters, allItemOptions]
  );

  const sortedRows = useMemo(
    () => sortRowsByKey(filteredRows, params.sortKey, params.sortDir),
    [filteredRows, params.sortKey, params.sortDir]
  );

  const displayRows = useMemo(
    () => sortedRows.slice(0, displayLimit),
    [sortedRows, displayLimit]
  );

  const totals = useMemo(() => computeInventoryTotals(filteredRows), [filteredRows]);
  const hasActiveFilters = useMemo(() => hasActiveInventoryFilters(filters), [filters]);
  const tableHasMore = displayRows.length < sortedRows.length;

  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch: "",
        sourceRows: allRows,
        filteredRows,
        serverFiltered: hasActiveFilters,
      }),
    [allRows, filteredRows, hasActiveFilters]
  );

  const loadAllRows = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    setAllRows([]);
    setDisplayLimit(TABLE_RENDER_CHUNK);

    try {
      const body = await inventoryReportService.list({
        page: 1,
        limit: LOAD_LIMIT,
        filters: {},
      });

      if (gen !== loadGenRef.current) return;

      const rows = Array.isArray(body?.data) ? body.data : [];
      setAllRows(rows);
      if (!rows.length) toast.info("No inventory entries found.");
      else if (Number(body?.total) > rows.length) {
        toast.info(`Showing first ${rows.length.toLocaleString()} of ${Number(body.total).toLocaleString()} rows.`);
      }
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      toast.error(err?.message || "Could not load the inventory report. Please try again.");
      setAllRows([]);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllRows();
  }, [loadAllRows]);

  const handleRefresh = useCallback(() => {
    void loadAllRows();
  }, [loadAllRows]);

  const handleLoadMore = useCallback(() => {
    if (tableHasMore) setDisplayLimit((n) => n + TABLE_RENDER_CHUNK);
  }, [tableHasMore]);

  const handleExport = useCallback(
    async (format) => {
      if (!sortedRows.length) {
        toast.info("No rows to export.");
        return;
      }
      setExporting(true);
      try {
        const { filename } = await exportInventoryReport({
          format,
          rows: sortedRows,
          totals,
          filters,
          filterOptions,
        });
        toast.success(notifyListPageExportResult(format, filename).message);
      } catch (err) {
        toast.error(err?.message || "Could not export the report. Please try again.");
      } finally {
        setExporting(false);
      }
    },
    [sortedRows, totals, filters, filterOptions]
  );

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setDisplayLimit(TABLE_RENDER_CHUNK);
  };

  const HEADERS = useMemo(() => {
    return INVENTORY_REPORT_TABLE_COLUMNS.map(({ label, key, type }, index) => {
      const width =
        key === "mrn_no"
          ? "110px"
          : key === "doc_dt"
            ? "100px"
            : key === "heat_no"
              ? "120px"
              : key === "item_desc" || key === "customer_name" || key === "location_details"
                ? "220px"
                : key === "item_code"
                  ? "120px"
                  : "110px";

      const tone = COLUMN_TONE[key];
      const isNumber = type === "number";

      let render;
      if (key === "location_details") {
        render = (v, row) => {
          const display =
            v != null && String(v).trim() !== "" && String(v).trim() !== "—"
              ? String(v).trim()
              : "—";
          const tip = formatCoilUidTooltip("Issuable coils", row?.issuable_coil_uids);
          return (
            <span className={`${tableCellClass("text")} ${tip ? "cursor-help" : ""}`} title={tip}>
              {display}
            </span>
          );
        };
      } else if (isNumber) {
        const qtyMeta = INVENTORY_QTY_META[key];
        const uidField = qtyMeta?.uidField;
        const uidLabel = qtyMeta?.tooltip || "Coils";
        render = (v, row) => {
          const tip = uidField
            ? formatCoilUidTooltip(uidLabel, row?.[uidField])
            : undefined;
          return tone ? (
            renderQtyCell(type, v, { title: tip })
          ) : (
            <span
              className={`block w-full tabular-nums ${tip ? "cursor-help" : ""} ${tableCellClass(type)}`}
              title={tip}
            >
              {formatInventoryTableCell(type, v)}
            </span>
          );
        };
      } else {
        render = (v) => <span className={tableCellClass(type)}>{formatInventoryTableCell(type, v)}</span>;
      }

      return [
        label,
        key,
        render,
        {
          ...(index === 0 ? { fixed: true } : {}),
          width,
          ...(isNumber ? { align: "right" } : {}),
          ...(tone
            ? {
                cellClass: tone.cell,
                ...(tone.cardValue ? { cardValueClass: tone.cardValue } : {}),
                ...(tone.cardBadge ? { cardBadgeClass: tone.cardBadge } : {}),
              }
            : {}),
        },
      ];
    });
  }, []);

  const formatQty = (n) => {
    const x = Number(n);
    return (Number.isFinite(x) ? x : 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const makeFetchService = useCallback(
    (listKey, labelKey, subLabelKey = "") => {
      return async ({ search = "", page: optPage = 1, limit = 50 } = {}) => {
        const list = filterOptions[listKey] || [];
        const q = String(search || "").trim().toLowerCase();
        const filtered = q
          ? list.filter((row) => {
              const a = String(row?.[labelKey] || "").toLowerCase();
              const b = subLabelKey ? String(row?.[subLabelKey] || "").toLowerCase() : "";
              return a.includes(q) || b.includes(q);
            })
          : list;
        const sorted = sortSelectRowsAsc(filtered, labelKey, subLabelKey ? [subLabelKey] : []);
        const start = (Math.max(1, Number(optPage) || 1) - 1) * (Number(limit) || 50);
        return { data: sorted.slice(start, start + (Number(limit) || 50)) };
      };
    },
    [filterOptions]
  );

  const makeGetByIdService = useCallback(
    (listKey) => {
      return async (id) => {
        const list = filterOptions[listKey] || [];
        const match = list.find((row) => String(row?.id) === String(id));
        return { data: match || null };
      };
    },
    [filterOptions]
  );

  const itemFetchService = useMemo(
    () => makeFetchService("items", "item_code", "item_desc"),
    [makeFetchService]
  );
  const customerFetchService = useMemo(
    () => makeFetchService("customers", "acc_name"),
    [makeFetchService]
  );
  const locationFetchService = useMemo(
    () => makeFetchService("locations", "location_no"),
    [makeFetchService]
  );
  const packingFetchService = useMemo(
    () => makeFetchService("packings", "packing_number"),
    [makeFetchService]
  );

  const itemGetById = useMemo(() => makeGetByIdService("items"), [makeGetByIdService]);
  const customerGetById = useMemo(() => makeGetByIdService("customers"), [makeGetByIdService]);
  const locationGetById = useMemo(() => makeGetByIdService("locations"), [makeGetByIdService]);
  const packingGetById = useMemo(() => makeGetByIdService("packings"), [makeGetByIdService]);

  const setMultiFilter = useCallback((key, value) => {
    setDisplayLimit(TABLE_RENDER_CHUNK);
    setFilters((prev) => ({
      ...prev,
      [key]: normalizeMultiFilterIds(value),
    }));
  }, []);

  const filterLabels = useMemo(
    () => ({
      item: filterLabel("Item", filterOptions.items.length),
      customer: filterLabel("Supplier", filterOptions.customers.length),
      location: filterLabel("Store Location", filterOptions.locations.length),
      packing: filterLabel("MRN UID", filterOptions.packings.length),
    }),
    [filterOptions]
  );

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <div className="flex items-center gap-2 min-w-0 shrink-0 md:max-w-xs lg:max-w-sm">
                  <BarChart3 size={18} className="text-indigo-600 shrink-0 hidden sm:block" />
                  <div className="min-w-0 hidden md:block">
                    <h1 className="text-sm font-bold text-slate-800 leading-tight">RM Inventory</h1>
                    <p className="text-[10px] text-slate-500 font-medium truncate">
                      {INVENTORY_REPORT_RULES.pageSubtitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50`}
                  title="Reload full report from server"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  <span className="hidden xs:inline">Refresh</span>
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || !sortedRows.length}
                onExport={handleExport}
              />
            }
          />
        </ListPageToolbar>

        <ListPageFilterStrip className="space-y-2">
          <div className="grid w-full min-w-0 grid-cols-2 items-end gap-2 md:gap-3 lg:grid-cols-4 lg:gap-3">
            <div className="min-w-0 w-full">
              <SearchableSelect
                key={`inv-item-${filterOptions.items.length}-${allRows.length}`}
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabels.item}
                placeholder="Search items"
                value={filters.item_dcodes}
                onChange={(ids) => setMultiFilter("item_dcodes", ids)}
                fetchService={itemFetchService}
                getByIdService={itemGetById}
                dataKey="id"
                labelKey="item_code"
                subLabelKey="item_desc"
                showDuplicateSubLabel
                disabled={loading}
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                key={`inv-customer-${filterOptions.customers.length}-${allRows.length}`}
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabels.customer}
                placeholder="Search suppliers"
                value={filters.customer_codes}
                onChange={(ids) => setMultiFilter("customer_codes", ids)}
                fetchService={customerFetchService}
                getByIdService={customerGetById}
                dataKey="id"
                labelKey="acc_name"
                labelOnlyDisplay
                disabled={loading}
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                key={`inv-location-${filterOptions.locations.length}-${allRows.length}`}
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabels.location}
                placeholder="Search locations"
                value={filters.location_ids}
                onChange={(ids) => setMultiFilter("location_ids", ids)}
                fetchService={locationFetchService}
                getByIdService={locationGetById}
                dataKey="id"
                labelKey="location_no"
                disabled={loading}
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                key={`inv-mrn-${filterOptions.packings.length}-${allRows.length}`}
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabels.packing}
                placeholder="Search MRN"
                value={filters.packing_numbers}
                onChange={(ids) => setMultiFilter("packing_numbers", ids)}
                fetchService={packingFetchService}
                getByIdService={packingGetById}
                dataKey="id"
                labelKey="packing_number"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="h-8 px-3 border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Clear all filters
            </button>
          </div>
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={displayRows}
            allowCopy={true}
            loading={loading}
            centerLoadingOverlay={true}
            suppressLoadingFooterRow={true}
            showSelection={false}
            viewMode={viewMode}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={(key) =>
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }))
            }
            emptyIcon={BarChart3}
            emptyMessage={
              hasActiveFilters ? "No rows match the selected filters" : "No inventory data is available yet."
            }
            emptySubMessage={
              hasActiveFilters
                ? "Change or clear a filter, or select Refresh."
                : "Select Refresh if the report is empty."
            }
            hasMore={tableHasMore}
            onLoadMore={handleLoadMore}
            totalItems={sortedRows.length}
            getRowId={(row, i) => String(row?.id ?? row?.mrn_no ?? `r-${i}`)}
            cardConfig={{
              titleKey: "mrn_uid",
              badgeIndices: ["issuable_qty"],
              detailKeys: [
                "doc_dt",
                "item_code",
                "item_desc",
                "customer_name",
                "location_details",
                "total_stock_qty",
                "issuable_qty",
                "in_store_qty",
                "unassigned_qty",
                "shop_floor_qty",
                "pending_qc_qty",
                "pending_reject_qty",
              ],
              className: "rounded-none border border-slate-200 shadow-none",
            }}
          />
          <RmStoreListFooter
            shown={displayRows.length}
            total={sortedRows.length}
            label="Inventory Rows"
            showLive={false}
            {...footerFilter}
          />
          <div className="shrink-0 border-t border-indigo-200 bg-indigo-50/80 px-2 py-1.5 sm:border-t-2 sm:px-3 sm:py-2.5">
            <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wide sm:tracking-widest text-indigo-700 mb-1 sm:mb-2 leading-tight">
              {hasActiveFilters ? "Total (filtered)" : "Total (all)"}
              {!loading && allRows.length ? (
                <span className="block sm:inline font-normal text-slate-500 normal-case tracking-normal text-[7px] sm:text-[9px]">
                  {hasActiveFilters ? "Filters on · " : ""}
                  {sortedRows.length.toLocaleString()} rows
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 sm:gap-3">
              {INVENTORY_FOOTER_CARDS.map(({ key, label, hint, tone }) => {
                const styles = INVENTORY_FOOTER_TONE[tone] || INVENTORY_FOOTER_TONE.slate;
                return (
                  <div
                    key={key}
                    className={`rounded-md sm:rounded-lg border px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0 ${styles.wrap}`}
                  >
                    <p className={`text-[7px] sm:text-[9px] font-bold uppercase tracking-wide leading-tight ${styles.label}`}>
                      {label}
                    </p>
                    <p className={`text-[9px] sm:text-lg font-black tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${styles.value}`}>
                      {formatQty(totals[key])}
                    </p>
                    <p className={`hidden sm:block text-[8px] font-medium mt-0.5 ${styles.hint}`}>{hint}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
