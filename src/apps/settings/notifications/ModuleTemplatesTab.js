"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, RefreshCw, Plus, BellRing, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "react-toastify";
import { notificationTemplateService } from "@/apps/settings/lib/services/notificationTemplateService";
import { applyClientSearch, sortRowsByKey } from "@/platform/utils/list/listSearch";
import { APP_TYPE_LABELS } from "@/config/moduleAppRegistry";
import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import AppListFooter, { appListFooterFromClientFilter } from "@/ui/common/list/listPageFooter";
import Pagination from "@/apps/task/lib/ui/common/Pagination";
import { AppConfigFormLoading, CONFIG_INPUT } from "@/apps/settings/configuration/components/AppConfigFormFields";
import NotificationTemplateModal from "./NotificationTemplateModal";
import { TRIGGER_EVENT_OPTIONS, TRIGGER_EVENT_LABELS, CHANNEL_LABELS, EVENT_BADGE_TONE, recipientText, channelText } from "./moduleTemplateConfig";

const NOTIFY_SELECT = "w-full bg-white border border-slate-200 rounded-lg px-3 h-9 text-[11px] text-slate-800 outline-none transition-all cursor-pointer focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50/80";

const VIEWS = [
  { id: "templates", label: "Templates" },
  { id: "history", label: "Sent History" },
];

const LOG_STATUS = {
  sent: { label: "Sent", className: "bg-amber-50 text-amber-800" },
  failed: { label: "Failed", className: "bg-rose-50 text-rose-700" },
  skipped: { label: "Skipped", className: "bg-slate-100 text-slate-600" },
};

function EventBadges({ events = [] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {events.map((e) => (
        <span key={e} className={`px-1.5 py-0.5 border text-[9px] font-bold uppercase tracking-wider ${EVENT_BADGE_TONE[e] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
          {TRIGGER_EVENT_LABELS[e] ?? e}
        </span>
      ))}
    </div>
  );
}

function ActiveToggle({ active, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={active ? "Click to deactivate" : "Click to activate"}
      className={`px-2 py-0.5 rounded-none text-[9px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-50 ${
        active
          ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
          : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}

function TemplatesView({ options }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [tempSearch, setTempSearch] = useState("");
  const [params, setParams] = useState({ appType: "all", status: "all", event: "all", sortKey: null, sortDir: "asc" });
  const [slot, setSlot] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationTemplateService.getAll({ page: 1, limit: 5000 });
      setRows(res?.data ?? []);
    } catch (err) {
      toast.error(err?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSorted = useMemo(() => {
    let data = rows.map((r) => ({ ...r, recipient_text: recipientText(r, options).label }));
    if (params.appType !== "all") data = data.filter((r) => String(r.module_app_type ?? "").toLowerCase() === params.appType);
    if (params.status !== "all") data = data.filter((r) => !!r.is_active === (params.status === "active"));
    if (params.event !== "all") data = data.filter((r) => (r.trigger_events ?? []).includes(params.event));
    if (String(tempSearch).trim()) data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [rows, tempSearch, params, options]);

  const appTypeOptions = useMemo(() => {
    const types = [...new Set(rows.map((r) => String(r.module_app_type ?? "").toLowerCase()).filter(Boolean))].sort();
    return [{ label: "All Apps", value: "all" }, ...types.map((t) => ({ label: APP_TYPE_LABELS[t] ?? t.toUpperCase(), value: t }))];
  }, [rows]);

  const extraFilters = useMemo(
    () => [
      { label: "App", key: "appType", value: params.appType, options: appTypeOptions },
      {
        label: "Status",
        key: "status",
        value: params.status,
        options: [
          { label: "All", value: "all" },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
      {
        label: "Trigger",
        key: "event",
        value: params.event,
        options: [{ label: "All events", value: "all" }, ...TRIGGER_EVENT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))],
      },
    ],
    [params, appTypeOptions]
  );

  const openAdd = () => setSlot({ isEdit: false });
  const openEdit = (row) => setSlot({ isEdit: true, id: row.id, existingData: row });

  const handleToggle = async (row) => {
    setBusyId(row.id);
    try {
      await notificationTemplateService.toggle(row.id, !row.is_active);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !row.is_active } : r)));
    } catch (err) {
      toast.error(err?.message || "Failed to update status");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete template "${row.name}"?`)) return;
    setBusyId(row.id);
    try {
      await notificationTemplateService.delete(row.id);
      toast.success("Template deleted successfully");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      toast.error(err?.message || "Failed to delete template");
    } finally {
      setBusyId(null);
    }
  };

  const HEADERS = [
    ["Module", "module_label", (v, row) => (
      <div className="flex flex-col py-1">
        <span className="font-bold text-slate-800 text-[11px] uppercase tracking-tight">{v}</span>
        <span className="text-[10px] text-slate-400">{APP_TYPE_LABELS[row.module_app_type] ?? row.module_app_type}</span>
      </div>
    ), { width: "180px", wrap: true }],
    ["Template", "name", (v, row) => (
      <div className="flex flex-col py-1 min-w-0">
        <span className="font-semibold text-slate-800 text-[11px]">{v}</span>
        {row.subject ? <span className="text-[10px] text-slate-400 truncate">{row.subject}</span> : null}
      </div>
    ), { width: "220px", wrap: true }],
    ["Trigger On", null, (v, row) => <EventBadges events={row.trigger_events} />, { width: "170px" }],
    ["Send To", "recipient_text", (v, row) => {
      const r = recipientText(row, options);
      return (
        <div className="flex flex-col py-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{r.type}</span>
          <span className="text-[11px] text-slate-700">{r.label || "-"}</span>
        </div>
      );
    }, { width: "220px", wrap: true }],
    ["Channels", null, (v, row) => (
      <span className="text-[10px] text-slate-600">{channelText(row) || "-"}</span>
    ), { width: "160px" }],
    ["Status", "is_active", (v, row) => (
      <ActiveToggle active={!!v} disabled={busyId === row.id} onClick={() => handleToggle(row)} />
    ), { align: "center", width: "90px" }],
    ["Actions", null, (v, row) => (
      <div className="flex items-center justify-center gap-1">
        <button type="button" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200">
          <Pencil size={13} />
        </button>
        <button type="button" title="Delete" disabled={busyId === row.id} onClick={(e) => { e.stopPropagation(); handleDelete(row); }} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 disabled:opacity-50">
          <Trash2 size={13} />
        </button>
      </div>
    ), { align: "center", width: "90px" }],
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <button type="button" onClick={fetchData} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider">
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </button>
        <button type="button" onClick={openAdd} disabled={!options} className="h-9 px-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-none flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50">
          <Plus size={14} /> Add Template
        </button>
      </div>

      <ListPageFilterStrip>
        <DateRangeFilter
          showDate={false}
          instantClientExtras
          extraFilters={extraFilters}
          onApply={(data) => setParams((p) => ({ ...p, appType: data.appType || "all", status: data.status || "all", event: data.event || "all" }))}
          onReset={() => {
            setTempSearch("");
            setParams((p) => ({ ...p, appType: "all", status: "all", event: "all" }));
          }}
          searchValue={tempSearch}
          onSearchChange={setTempSearch}
          searchPlaceholder="Module, template or message…"
          searchLabel="Quick filter"
        />
      </ListPageFilterStrip>

      <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
        <DataTable
          viewMode="table"
          headers={HEADERS}
          data={filteredSorted}
          loading={loading}
          sortKey={params.sortKey}
          sortDir={params.sortDir}
          showSelection={false}
          onRowDoubleClick={openEdit}
          onSort={(key) =>
            setParams((p) => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc" }))
          }
          emptyIcon={BellRing}
          emptyMessage="No notification templates yet"
          emptySubMessage="Add a template to notify people when a module record is added, edited, deleted or approved."
          totalItems={filteredSorted.length}
        />
      </div>

      <AppListFooter
        shown={filteredSorted.length}
        total={filteredSorted.length}
        noun="Templates"
        {...appListFooterFromClientFilter({ tempSearch, sourceRows: rows, filteredRows: filteredSorted })}
      />

      {slot && (
        <NotificationTemplateModal
          slot={slot}
          options={options}
          onClose={() => setSlot(null)}
          onSuccess={() => {
            setSlot(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function HistoryView({ options }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", module_id: "", action: "", channel: "", status: "", order: "desc" });

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput.trim() }));
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationTemplateService.getLogs({
        page,
        limit: pageSize,
        search: filters.search || undefined,
        module_id: filters.module_id || undefined,
        action: filters.action || undefined,
        channel: filters.channel || undefined,
        status: filters.status || undefined,
        order: filters.order,
      });
      setLogs(res?.data?.items ?? []);
      setTotal(res?.data?.total ?? 0);
    } catch (err) {
      toast.error(err?.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const hasFilters = filters.search || filters.module_id || filters.action || filters.channel || filters.status || filters.order !== "desc";
  const totalPages = Math.ceil(total / pageSize) || 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-4 md:px-5 py-3 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Automated notification history</h2>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 rounded transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
          <div className="lg:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search recipient, template, record…"
              className={`${CONFIG_INPUT} pl-9 h-9 text-[11px]`}
            />
          </div>
          <select className={NOTIFY_SELECT} value={filters.module_id} onChange={(e) => setFilter("module_id", e.target.value)}>
            <option value="">All modules</option>
            {(options?.modules ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.label || m.name}</option>
            ))}
          </select>
          <select className={NOTIFY_SELECT} value={filters.action} onChange={(e) => setFilter("action", e.target.value)}>
            <option value="">All actions</option>
            {TRIGGER_EVENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select className={NOTIFY_SELECT} value={filters.channel} onChange={(e) => setFilter("channel", e.target.value)}>
            <option value="">All channels</option>
            {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select className={NOTIFY_SELECT} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">All status</option>
            {Object.entries(LOG_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
          </select>
          <select className={NOTIFY_SELECT} value={filters.order} onChange={(e) => setFilter("order", e.target.value)}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setFilters({ search: "", module_id: "", action: "", channel: "", status: "", order: "desc" });
              setPage(1);
            }}
            className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <AppConfigFormLoading />
        ) : logs.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-16">No automated notifications sent yet</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 text-slate-500 sticky top-0 z-[1]">
              <tr>
                <th className="px-4 py-2.5 text-left font-bold">Sent</th>
                <th className="px-4 py-2.5 text-left font-bold">Module</th>
                <th className="px-4 py-2.5 text-left font-bold">Action</th>
                <th className="px-4 py-2.5 text-left font-bold">Record</th>
                <th className="px-4 py-2.5 text-left font-bold">Template</th>
                <th className="px-4 py-2.5 text-left font-bold">Recipient</th>
                <th className="px-4 py-2.5 text-left font-bold">Channel</th>
                <th className="px-4 py-2.5 text-left font-bold">Status</th>
                <th className="px-4 py-2.5 text-left font-bold">Done by</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const status = LOG_STATUS[log.status] ?? { label: log.status || "-", className: "bg-slate-100 text-slate-600" };
                return (
                  <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50/60 align-top">
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{log.sent_at || "-"}</td>
                    <td className="px-4 py-2 text-slate-700">{log.module_label || "-"}</td>
                    <td className="px-4 py-2"><EventBadges events={[log.action]} /></td>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{log.record_id || "-"}</td>
                    <td className="px-4 py-2 text-slate-700 max-w-[220px]">
                      <div className="truncate" title={log.message || ""}>{log.template_name || "(deleted template)"}</div>
                      {log.title ? <div className="text-[10px] text-slate-400 truncate" title={log.title}>{log.title}</div> : null}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      <div>{log.recipient_name || "-"}</div>
                      {log.channel !== "pwa_push" && log.recipient ? <div className="text-[10px] text-slate-400">{log.recipient}</div> : null}
                    </td>
                    <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                      {CHANNEL_LABELS[log.channel] ?? log.channel}
                      {log.channel === "pwa_push" && log.is_read ? <span className="ml-1 text-[9px] font-bold text-emerald-600">READ</span> : null}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${status.className}`} title={log.error_detail || ""}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{log.triggered_by || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {!loading && total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

export default function ModuleTemplatesTab() {
  const [view, setView] = useState("templates");
  const [options, setOptions] = useState(null);

  useEffect(() => {
    notificationTemplateService
      .getOptions()
      .then((res) => setOptions(res?.data ?? null))
      .catch((err) => toast.error(err?.message || "Failed to load form options"));
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-3 md:px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-all ${
              view === v.id
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "templates" ? <TemplatesView options={options} /> : <HistoryView options={options} />}
    </div>
  );
}
