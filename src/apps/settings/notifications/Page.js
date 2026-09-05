"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/apps/settings/configuration/utils/routes";
import { notificationService } from "@/apps/settings/lib/services/notificationService";
import Pagination from "@/apps/task/lib/ui/common/Pagination";
import { AppConfigFormFooter, AppConfigFormLoading, CONFIG_INPUT, CONFIG_LABEL, CONFIG_TEXTAREA } from "@/apps/settings/configuration/components/AppConfigFormFields";
import SendMessageTab from "./SendMessageTab";
import NotificationVariablesHint from "./NotificationVariablesHint";
import NotificationLogViewModal from "./NotificationLogViewModal";

const NOTIFY_SELECT =
  "w-full bg-white border border-slate-200 rounded-lg px-3 h-10 text-[11px] text-slate-800 outline-none transition-all cursor-pointer relative z-[2] touch-manipulation focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50/80 disabled:opacity-50 disabled:cursor-not-allowed";

const TEMPLATE_TABS = [
  { id: "send_message", label: "Send Message" },
  { id: "task_assigned", label: "New Task" },
  { id: "daily_reminder", label: "Daily" },
  { id: "personal_reminder", label: "Personal" },
  { id: "target_date_set", label: "Target Date" },
  { id: "status_changed", label: "Status" },
  { id: "chat_message", label: "Chat" },
  { id: "logs", label: "Logs" },
];

const LOG_TEMPLATE_OPTIONS = [
  { value: "manual_instant", label: "Custom / Instant" },
  ...TEMPLATE_TABS.filter((t) => t.id !== "send_message" && t.id !== "logs").map((t) => ({
    value: t.id,
    label: t.label,
  })),
];

const LOG_CHANNEL_OPTIONS = [
  { value: "", label: "All channels" },
  { value: "pwa_push", label: "PWA" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

const LOG_STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "received", label: "Received" },
  { value: "read", label: "Read" },
];

const SEND_VIA_OPTIONS = [
  { value: "none", label: "None" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

const LOG_STATUS = {
  sent: { label: "Sent", className: "bg-amber-50 text-amber-800" },
  failed: { label: "Failed", className: "bg-rose-50 text-rose-700" },
  received: { label: "Received", className: "bg-sky-50 text-sky-700" },
  read: { label: "Read", className: "bg-emerald-50 text-emerald-700" },
  skipped: { label: "Skipped", className: "bg-slate-100 text-slate-600" },
  console: { label: "Failed", className: "bg-rose-50 text-rose-700" },
};

const LOG_CHANNEL_LABELS = {
  pwa_push: "PWA",
  free: "Free",
  paid: "Paid",
  gateway: "WhatsApp",
  console: "WhatsApp",
  whatsapp_1: "Free",
  whatsapp_2: "Paid",
};

function LogStatusBadge({ status }) {
  const meta = LOG_STATUS[status] ?? { label: status || "-", className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function logReceivedNetworkLabel(log) {
  if (log.received_on_company_network === true) return "Internal";
  if (log.received_on_company_network === false) return "External";
  if (log.received_client_ip) return log.received_client_ip;
  return "-";
}

function NotificationTabBar({ activeId, onSelect }) {
  return (
    <div className="shrink-0 bg-slate-50 border-b border-slate-300 px-3 md:px-4 pt-2">
      <div className="flex items-end gap-1 overflow-x-auto no-scrollbar -mb-px" role="tablist">
        {TEMPLATE_TABS.map((tab) => {
          const selected = activeId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(tab.id)}
              className={`shrink-0 px-4 py-2 text-[11px] uppercase tracking-wider whitespace-nowrap border transition-all ${
                selected
                  ? "border-slate-300 border-b-white bg-white text-indigo-700 font-black z-[1]"
                  : "border-transparent bg-transparent text-slate-500 font-bold hover:border-slate-200 hover:bg-white/80 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={`space-y-1 min-w-0 ${className}`}>
      <label className={CONFIG_LABEL}>{label}</label>
      {children}
    </div>
  );
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const role = useSelector((s) => s.auth?.role);
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const isSuperAdmin = normalizedRole === "super_admin";

  const [activeTab, setActiveTab] = useState("send_message");
  const [templates, setTemplates] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(20);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logSearchInput, setLogSearchInput] = useState("");
  const [logTemplate, setLogTemplate] = useState("");
  const [logChannel, setLogChannel] = useState("");
  const [logStatus, setLogStatus] = useState("");
  const [logOrder, setLogOrder] = useState("desc");
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    if (role && !isSuperAdmin) router.replace(ROUTES.SETTINGS_DASHBOARD);
  }, [role, isSuperAdmin, router]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLogSearch(logSearchInput.trim());
      setLogPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [logSearchInput]);

  const normalizeTpl = (t) => {
    let send_via = t.send_via || "none";
    if (send_via === "whatsapp_1") send_via = "free";
    else if (send_via === "whatsapp_2") send_via = "paid";
    else if (send_via === "email") send_via = "none";
    else if (!["none", "free", "paid"].includes(send_via)) {
      send_via = t.whatsapp_enabled ? "free" : "none";
    }
    return {
      ...t,
      send_via,
      pwa_enabled: !!t.pwa_enabled,
      api_enabled: !!t.api_enabled,
    };
  };

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes] = await Promise.all([notificationService.getTemplates()]);
      const items = (tplRes.data?.data ?? []).map(normalizeTpl);
      setTemplates(items);
      const map = {};
      items.forEach((t) => {
        map[t.template_key] = { ...t };
      });
      setEdits(map);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await notificationService.getLogs({
        page: logPage,
        limit: logPageSize,
        search: logSearch || undefined,
        template_key: logTemplate || undefined,
        channel: logChannel || undefined,
        status: logStatus || undefined,
        order: logOrder,
      });
      const data = res.data?.data;
      setLogs(data?.items ?? []);
      setLogTotal(data?.total ?? 0);
    } catch {
      toast.error("Failed to load logs");
    } finally {
      setLogsLoading(false);
    }
  }, [logPage, logPageSize, logSearch, logTemplate, logChannel, logStatus, logOrder]);

  useEffect(() => {
    if (isSuperAdmin) fetchTemplates();
  }, [isSuperAdmin, fetchTemplates]);

  useEffect(() => {
    if (isSuperAdmin && activeTab === "logs") fetchLogs();
  }, [isSuperAdmin, activeTab, fetchLogs]);

  useEffect(() => {
    setSelectedLog((prev) => {
      if (!prev) return prev;
      const key = `${prev.log_source || "log"}-${prev.log_id}`;
      const updated = logs.find((row) => `${row.log_source || "log"}-${row.log_id}` === key);
      if (!updated) return prev;
      if (JSON.stringify(updated) === JSON.stringify(prev)) return prev;
      return updated;
    });
  }, [logs]);

  const isLogsTab = activeTab === "logs";
  const isSendTab = activeTab === "send_message";
  const logTotalPages = Math.ceil(logTotal / logPageSize) || 0;
  const current = edits[activeTab];
  const original = templates.find((t) => t.template_key === activeTab);

  const isDirty = useMemo(() => {
    if (!current || !original || isLogsTab || isSendTab) return false;
    return JSON.stringify(current) !== JSON.stringify(normalizeTpl(original));
  }, [current, original, isLogsTab, isSendTab]);

  const updateField = (field, value) => {
    if (isLogsTab) return;
    setEdits((p) => {
      const prev = p[activeTab] || {};
      const next = { ...prev, [field]: value };
      if (field === "send_via" && value !== "none") next.api_enabled = true;
      if (field === "is_enabled" && value === true) {
        next.pwa_enabled = prev.pwa_enabled ?? false;
        next.api_enabled = prev.api_enabled ?? false;
      }
      return { ...p, [activeTab]: next };
    });
  };

  const handleReset = () => {
    if (!original) return;
    setEdits((p) => ({ ...p, [activeTab]: normalizeTpl(original) }));
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!current || isLogsTab) return;
    setSaving(true);
    try {
      await notificationService.updateTemplate(activeTab, {
        label: current.label,
        subject: current.subject,
        body: current.body,
        is_enabled: current.is_enabled,
        pwa_enabled: current.pwa_enabled,
        api_enabled: current.api_enabled,
        send_via: current.send_via || "none",
        trigger_time: current.trigger_time || null,
      });
      toast.success("Saved");
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetLogFilters = () => {
    setLogSearchInput("");
    setLogSearch("");
    setLogTemplate("");
    setLogChannel("");
    setLogStatus("");
    setLogOrder("desc");
    setLogPage(1);
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="p-3 md:p-4 h-full min-h-0 flex flex-col">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 shadow-sm overflow-hidden rounded-sm">
        <NotificationTabBar activeId={activeTab} onSelect={setActiveTab} />

        {isSendTab ? (
          <SendMessageTab templates={templates} />
        ) : isLogsTab ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="shrink-0 px-4 md:px-5 py-3 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Message logs</h2>
                <button
                  type="button"
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 rounded transition-all disabled:opacity-50"
                >
                  <RefreshCw size={12} className={logsLoading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                <div className="lg:col-span-2 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={logSearchInput}
                    onChange={(e) => setLogSearchInput(e.target.value)}
                    placeholder="Search user, message, template…"
                    className={`${CONFIG_INPUT} pl-9 h-9 text-[11px]`}
                  />
                </div>
                <select
                  className={`${NOTIFY_SELECT} h-9`}
                  value={logTemplate}
                  onChange={(e) => {
                    setLogTemplate(e.target.value);
                    setLogPage(1);
                  }}
                >
                  <option value="">All templates</option>
                  {LOG_TEMPLATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  className={`${NOTIFY_SELECT} h-9`}
                  value={logChannel}
                  onChange={(e) => {
                    setLogChannel(e.target.value);
                    setLogPage(1);
                  }}
                >
                  {LOG_CHANNEL_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  className={`${NOTIFY_SELECT} h-9`}
                  value={logStatus}
                  onChange={(e) => {
                    setLogStatus(e.target.value);
                    setLogPage(1);
                  }}
                >
                  {LOG_STATUS_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  className={`${NOTIFY_SELECT} h-9`}
                  value={logOrder}
                  onChange={(e) => {
                    setLogOrder(e.target.value);
                    setLogPage(1);
                  }}
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </div>

              {(logSearch || logTemplate || logChannel || logStatus || logOrder !== "desc") && (
                <button
                  type="button"
                  onClick={resetLogFilters}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {logsLoading ? (
                <AppConfigFormLoading />
              ) : logs.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-16">No messages found</p>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 z-[1]">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-bold">Sent</th>
                      <th className="px-4 py-2.5 text-left font-bold">Received</th>
                      <th className="px-4 py-2.5 text-left font-bold">Read</th>
                      <th className="px-4 py-2.5 text-left font-bold">Recv net</th>
                      <th className="px-4 py-2.5 text-left font-bold">Template</th>
                      <th className="px-4 py-2.5 text-left font-bold">Channel</th>
                      <th className="px-4 py-2.5 text-left font-bold">Recipient</th>
                      <th className="px-4 py-2.5 text-left font-bold">User</th>
                      <th className="px-4 py-2.5 text-left font-bold">Status</th>
                      <th className="px-4 py-2.5 text-center font-bold w-[72px]">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={`${log.log_source || "log"}-${log.log_id}`} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{log.sent_at || "-"}</td>
                        <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{log.received_at || "-"}</td>
                        <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{log.read_at || "-"}</td>
                        <td className="px-4 py-2 text-slate-600 whitespace-nowrap text-[10px]">
                          {log.received_at ? logReceivedNetworkLabel(log) : "-"}
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{log.template_key}</td>
                        <td className="px-4 py-2 text-slate-700">{LOG_CHANNEL_LABELS[log.channel] ?? log.channel}</td>
                        <td className="px-4 py-2 text-slate-600 max-w-[160px] truncate">{log.recipient || "-"}</td>
                        <td className="px-4 py-2 text-slate-600">{log.user_name || "-"}</td>
                        <td className="px-4 py-2">
                          <LogStatusBadge status={log.status} />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!logsLoading && logTotal > 0 && (
              <Pagination
                page={logPage}
                totalPages={logTotalPages}
                totalItems={logTotal}
                pageSize={logPageSize}
                onPageChange={setLogPage}
                onPageSizeChange={(size) => {
                  setLogPageSize(size);
                  setLogPage(1);
                }}
              />
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5">
              {loading ? (
                <AppConfigFormLoading />
              ) : !current ? (
                <p className="text-xs text-slate-400 text-center py-16">Template not found</p>
              ) : (
                <div className="w-full flex flex-col gap-4">
                  <div className="pb-3 border-b border-slate-200">
                    <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">
                      {current.label || activeTab}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
                    <div className="lg:col-span-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                        <Field label="Enabled">
                          <select
                            className={NOTIFY_SELECT}
                            value={current.is_enabled ? "true" : "false"}
                            onChange={(e) => updateField("is_enabled", e.target.value === "true")}
                            disabled={saving}
                          >
                            <option value="false">Disabled</option>
                            <option value="true">Enabled</option>
                          </select>
                        </Field>

                        <Field label="PWA (bell + tray)">
                          <select
                            className={NOTIFY_SELECT}
                            value={current.pwa_enabled ? "true" : "false"}
                            onChange={(e) => updateField("pwa_enabled", e.target.value === "true")}
                            disabled={saving || !current.is_enabled}
                          >
                            <option value="false">Off</option>
                            <option value="true">On</option>
                          </select>
                        </Field>

                        <Field label="API (WhatsApp)">
                          <select
                            className={NOTIFY_SELECT}
                            value={current.api_enabled ? "true" : "false"}
                            onChange={(e) => updateField("api_enabled", e.target.value === "true")}
                            disabled={saving || !current.is_enabled}
                          >
                            <option value="false">Off</option>
                            <option value="true">On</option>
                          </select>
                        </Field>

                        <Field label="WhatsApp">
                          <select
                            className={NOTIFY_SELECT}
                            value={current.send_via || "none"}
                            onChange={(e) => updateField("send_via", e.target.value)}
                            disabled={saving || !current.is_enabled || !current.api_enabled}
                          >
                            {SEND_VIA_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>

                        {activeTab === "daily_reminder" && (
                          <Field label="Trigger time (IST)">
                            <input
                              type="time"
                              className={CONFIG_INPUT}
                              value={current.trigger_time || "09:00"}
                              onChange={(e) => updateField("trigger_time", e.target.value)}
                              disabled={saving}
                            />
                          </Field>
                        )}
                      </div>

                      <Field label="Subject">
                        <input
                          className={CONFIG_INPUT}
                          value={current.subject || ""}
                          onChange={(e) => updateField("subject", e.target.value)}
                          disabled={saving}
                          placeholder="Notification subject line"
                        />
                      </Field>
                    </div>

                    <div className="lg:col-span-8 flex flex-col">
                      <Field label="Message body" className="flex flex-col">
                        <textarea
                          className={`${CONFIG_TEXTAREA} w-full font-mono text-[11px] leading-relaxed resize-y min-h-[200px] lg:min-h-[280px]`}
                          value={current.body || ""}
                          onChange={(e) => updateField("body", e.target.value)}
                          disabled={saving}
                          placeholder="Hi {{user_name}},&#10;&#10;Your message here..."
                        />
                      </Field>
                      <div className="mt-3">
                        <NotificationVariablesHint />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!loading && current && (
              <AppConfigFormFooter saving={saving} dirtyCount={isDirty ? 1 : 0} onReset={handleReset} />
            )}
          </form>
        )}
      </div>

      <NotificationLogViewModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        statusLabel={selectedLog ? (LOG_STATUS[selectedLog.status]?.label ?? selectedLog.status) : undefined}
      />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
