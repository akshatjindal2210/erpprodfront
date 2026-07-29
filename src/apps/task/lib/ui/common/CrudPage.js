"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import StatCard   from "@/apps/task/lib/ui/common/StatCard";
import SearchBar  from "@/apps/task/lib/ui/common/SearchBar";
import Pagination from "@/apps/task/lib/ui/common/Pagination";

/**
 * Generic CRUD page — for categories, departments, designations, holidays, etc.
 *
 * Props:
 *  config = {
 *    // Page meta
 *    title:        "Holiday Management",
 *    breadcrumb:   "Holidays",
 *    accentColor:  "orange",          // tailwind color name (violet, blue, emerald, orange…)
 *
 *    // Stat cards  [{ label, icon, iconBg, iconText, borderColor, getValue }]
 *    stats: [
 *      { label: "Total Holidays", icon: CalendarDays, iconBg: "bg-orange-50", iconText: "text-orange-600", borderColor: "border-orange-100", getValue: (items, total) => total },
 *      { label: "This Month",     icon: Hash,         iconBg: "bg-amber-50",  iconText: "text-amber-600",  borderColor: "border-amber-100",  getValue: (items) => items.filter(...).length },
 *    ],
 *
 *    // Table columns  [{ label, key }]
 *    columns: [
 *      { label: "#",          key: "id"         },
 *      { label: "Name",       key: "name"       },
 *      { label: "Date",       key: "date"       },
 *      { label: "Created At", key: "created_at" },
 *    ],
 *
 *    // Service — must have getAll({ page,limit,search,dateFrom,dateTo,sortBy,order }), delete(id)
 *    service: holidayService,
 *
 *    // Response data extractor (optional, default handles common shapes)
 *    extractItems: (res) => res.data?.items ?? res.data?.data ?? res.data ?? [],
 *    extractTotal: (res) => res.data?.total ?? 0,
 *
 *    // Export CSV columns  [{ label, key }]
 *    exportColumns: [{ label: "Name", key: "name" }, { label: "Date", key: "date" }],
 *    exportFilename: "holidays.csv",
 *
 *    // Item id field (default: "id")
 *    idKey: "id",
 *  }
 *
 *  // Render props — inject your specific components
 *  renderModal:       ({ open, onClose, onSuccess, editItem }) => <HolidayModal ... />
 *  renderDeleteModal: ({ item, onClose, onSuccess })           => <HolidayDeleteModal ... />
 *  renderRow:         ({ item, index, isSelected, onToggle, onEdit, onDelete }) => <HolidayTableRow ... />
 *  renderFilterButtons: (props) => <HolidayFilterButtons ... />
 *  renderFilterPanel:   (props) => <HolidayFilterPanel ... />   // optional
 *  renderBulkBar:       (props) => <BulkActionBar ... />
 *  renderBulkUpload:    () => <HolidayBulkUpload />             // optional
 */
export default function CrudPage({config, renderModal, renderDeleteModal, renderRow, renderFilterButtons, renderFilterPanel, renderBulkBar, renderBulkUpload}) {
  const {
    title,
    breadcrumb,
    accentColor  = "indigo",
    stats        = [],
    columns      = [],
    service,
    extractItems = (res) => res?.data?.items ?? res?.data?.data?.items ?? res?.data?.data ?? res?.data ?? [],
    extractTotal = (res) => res?.data?.total ?? res?.data?.data?.total ?? 0,
    exportColumns  = [],
    exportFilename = "export.csv",
    idKey          = "id",
    defaultSortKey = "id",
    defaultSortDir = "asc",
    entity         = "",
  } = config;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState("");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(10);
  const [sortKey,     setSortKey]     = useState(defaultSortKey);
  const [sortDir,     setSortDir]     = useState(defaultSortDir);
  const [showFilters, setShowFilters] = useState(false);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState([]);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page, limit: pageSize,
        search:   search   || undefined,
        dateFrom: dateFrom || undefined,
        dateTo:   dateTo   || undefined,
        sortBy:   sortKey,
        order:    sortDir,
      };
      const response = await service.getAll(params);
      const res      = response.data;
      const raw      = extractItems(res);
      const safe     = Array.isArray(raw) ? raw : [];
      setItems(safe);
      setTotalItems(extractTotal(res) || safe.length);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to load ${breadcrumb}`);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, dateFrom, dateTo, sortKey, sortDir]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const itemList     = Array.isArray(items) ? items : [];
  const computedStats = useMemo(
    () => stats.map((s) => ({ ...s, value: s.getValue(itemList, totalItems) })),
    [itemList, totalItems],
  );

  // ── Sort ──────────────────────────────────────────────────────────────────
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const allSelected = itemList.length > 0 && itemList.every((i) => selected.includes(i[idKey]));
  const toggleAll   = () =>
    setSelected(allSelected
      ? selected.filter((id) => !itemList.find((i) => i[idKey] === id))
      : [...new Set([...selected, ...itemList.map((i) => i[idKey])])]);
  const toggleOne   = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    try {
      await Promise.all(selected.map((id) => service.delete(id)));
      toast.success(`${selected.length} ${breadcrumb} deleted`);
      setSelected([]);
      fetchItems();
    } catch {
      toast.error("Some deletions failed");
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = exportColumns.map((c) => c.label).join(",");
    const rows    = itemList.map((item) =>
      exportColumns.map((c) => `"${item[c.key] ?? ""}"`).join(",")
    );
    const csv  = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: exportFilename }).click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setSearch(""); setDateFrom(""); setDateTo("");
    setPage(1); setSortKey(defaultSortKey); setSortDir(defaultSortDir);
  };

  const hasActiveFilter = dateFrom !== "" || dateTo !== "" || sortDir !== defaultSortDir;
  const totalPages      = Math.max(1, Math.ceil(totalItems / pageSize));

  const SortIcon = ({ k }) => (
    <span className={`ml-1 text-xs ${sortKey === k ? `text-${accentColor}-500` : "text-slate-300"}`}>
      {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  // ── Shared props for filter components ───────────────────────────────────
  const filterProps = {
    showFilters, hasActiveFilter,
    onToggleFilters: () => setShowFilters((v) => !v),
    onExport: handleExport,
    onRefresh: fetchItems,
    onReset: handleReset,
    sortDir, onSortChange: (v) => { setSortDir(v); setPage(1); },
    dateFrom, onDateFromChange: (v) => { setDateFrom(v); setPage(1); },
    dateTo,   onDateToChange:   (v) => { setDateTo(v);   setPage(1); },
    pageSize, onPageSizeChange: (v) => { setPageSize(v); setPage(1); },
  };

  const bulkBarProps = {
    count: selected.length,
    onBulkDelete: handleBulkDelete,
    onClearSelection: () => setSelected([]),
    entity,
  };

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-screen text-slate-800">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <span>Dashboard</span><span>/</span>
            <span className="text-slate-500 font-medium">{breadcrumb}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk upload button — optional */}
          {/* {renderBulkUpload?.()} */}
          {renderBulkUpload?.({ 
            refresh: fetchItems, 
            fetchData: fetchItems
          })}
          <button
            onClick={() => { setEditItem(null); setModalOpen(true); }}
            className={`flex items-center gap-2 bg-${accentColor}-600 hover:bg-${accentColor}-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5`}
          >
            <Plus size={16} /> Add {breadcrumb.replace(/s$/, "")}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      {computedStats.length > 0 && (
        <div className={`grid grid-cols-2 lg:grid-cols-${Math.min(computedStats.length, 4)} gap-3 mb-6`}>
          {computedStats.map((s, i) => (
            <StatCard key={i} label={s.label} value={s.value} icon={s.icon} iconBg={s.iconBg} iconText={s.iconText} borderColor={s.borderColor} />
          ))}
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <SearchBar
                value={search}
                onChange={(val) => { setSearch(val); setPage(1); }}
                placeholder={`Search ${breadcrumb.toLowerCase()}…`}
              />
            </div>
            {renderFilterButtons?.(filterProps)}
          </div>

          {showFilters && renderFilterPanel?.(filterProps)}

          {renderBulkBar?.(bulkBarProps)}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className={`w-4 h-4 rounded border-slate-300 accent-${accentColor}-600 cursor-pointer`} />
                </th>
                {columns.map(({ label, key }) => (
                  <th key={key} onClick={() => toggleSort(key)}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 transition-colors select-none whitespace-nowrap">
                    {label}<SortIcon k={key} />
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={columns.length + 2} className="py-16 text-center text-slate-400">
                  <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                  <p className="text-sm">Loading {breadcrumb.toLowerCase()}…</p>
                </td></tr>
              ) : itemList.length === 0 ? (
                <tr><td colSpan={columns.length + 2} className="py-16 text-center text-slate-400">
                  <p className="text-sm">No {breadcrumb.toLowerCase()} found</p>
                </td></tr>
              ) : itemList.map((item, i) => {
                const rowProps = {
                  item,
                  index:      (page - 1) * pageSize + i + 1,
                  isSelected: selected.includes(item[idKey]),
                  onToggle:   toggleOne,
                  onEdit:     (it) => { setEditItem(it); setModalOpen(true); },
                  onDelete:   (it) => setDeleteItem(it),
                };
                return (
                  <React.Fragment key={item[idKey]}>
                    {renderRow(rowProps)}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {renderModal?.({ open: modalOpen, onClose: () => { setModalOpen(false); setEditItem(null); }, onSuccess: fetchItems, editItem })}
      {renderDeleteModal?.({ item: deleteItem, onClose: () => setDeleteItem(null), onSuccess: fetchItems })}
    </div>
  );
}
