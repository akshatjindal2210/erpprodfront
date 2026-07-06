"use client";

import { X, MessageSquare, Clock, User, Hash, AlertTriangle } from "lucide-react";
import { useEscapeKey } from "@/core/hooks/useEscapeKey";

const CHANNEL_LABELS = {
  pwa_push: "PWA Push",
  free: "WhatsApp Free",
  paid: "WhatsApp Paid",
  gateway: "WhatsApp",
};

const STATUS_STYLES = {
  sent: { badge: "bg-amber-50 text-amber-800 border-amber-200" },
  failed: { badge: "bg-rose-50 text-rose-700 border-rose-200" },
  received: { badge: "bg-sky-50 text-sky-700 border-sky-200" },
  read: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  skipped: { badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

const SOURCE_LABELS = {
  push: "PWA Push",
  whatsapp: "WhatsApp",
};

const TEMPLATE_LABELS = {
  manual_instant: "Custom / Instant",
  task_assigned: "New Task",
  daily_reminder: "Daily Reminder",
  personal_reminder: "Personal Reminder",
  target_date_set: "Target Date",
  status_changed: "Status Update",
};

function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <section className={`border border-slate-200 bg-white overflow-hidden ${className}`}>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border-b border-slate-100">
        {Icon && <Icon size={12} className="text-indigo-500 shrink-0" />}
        <h4 className="text-[9px] font-black uppercase tracking-wide text-slate-500">{title}</h4>
      </div>
      <div className="px-2.5 py-2">{children}</div>
    </section>
  );
}

function DetailRow({ label, value, mono = false, fullWidth = false }) {
  if (value == null || value === "") return null;
  return (
    <div
      className={`grid grid-cols-[72px_1fr] gap-2 items-baseline py-0.5 border-b border-slate-50 last:border-0 ${
        fullWidth ? "col-span-full" : ""
      }`}
    >
      <dt className="text-[9px] font-bold uppercase text-slate-400">{label}</dt>
      <dd className={`text-[11px] text-slate-800 break-words leading-tight ${mono ? "font-mono text-[10px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function timelineMarkerClass(state) {
  if (state === "done") return "bg-emerald-500 border-emerald-600";
  if (state === "failed") return "bg-rose-500 border-rose-600";
  return "bg-white border-slate-300";
}

function timelineStatusText(state) {
  if (state === "done") return { label: "Done", className: "text-emerald-700" };
  if (state === "failed") return { label: "Failed", className: "text-rose-600" };
  return { label: "Pending", className: "text-slate-400" };
}

function DeliveryTimeline({ steps }) {
  if (!steps.length) return null;

  return (
    <div className="border border-slate-100 bg-slate-50/40">
      {steps.map((step, index) => {
        const status = timelineStatusText(step.state);
        const isLast = index === steps.length - 1;

        return (
          <div
            key={step.key}
            className={`grid grid-cols-[20px_1fr] gap-x-2 px-2 py-1.5 ${!isLast ? "border-b border-slate-100" : ""}`}
          >
            <div className="flex flex-col items-center pt-0.5">
              <div className={`w-2.5 h-2.5 border-2 shrink-0 ${timelineMarkerClass(step.state)}`} aria-hidden />
              {!isLast && <div className="w-px flex-1 min-h-[12px] bg-slate-200 mt-1" aria-hidden />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-700">{step.label}</span>
                <span className={`text-[9px] font-bold uppercase shrink-0 ${status.className}`}>{status.label}</span>
              </div>
              <p className={`text-[10px] leading-tight mt-0.5 ${step.time ? "text-slate-700 font-medium" : "text-slate-400 italic"}`}>
                {step.time && step.hint && step.hint !== step.time ? `${step.time} · ${step.hint}` : step.time || step.hint || "—"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function pushDeliverySummary(log) {
  if (log.status === "failed") return "Push failed — not delivered.";
  if (log.status === "read") return "User opened PWA on company network.";
  if (log.status === "received" || log.received_at) {
    return "On user phone (any network). Read time records only after company network + PWA open.";
  }
  return "Sent from server — waiting to reach user device (any network, up to 7 days).";
}

function receivedNetworkLabel(log) {
  if (log.received_on_company_network === true) return "Company network";
  if (log.received_on_company_network === false) return "Other network (mobile data / home Wi-Fi)";
  if (log.received_client_ip) return `IP ${log.received_client_ip}`;
  return null;
}

function buildTimelineSteps(log, isPush, isFailed) {
  const steps = [{ key: "sent", label: "Sent from server", state: log.sent_at ? "done" : "pending", time: log.sent_at }];
  const networkLabel = receivedNetworkLabel(log);

  if (isPush) {
    if (isFailed) {
      steps.push(
        { key: "received", label: "Received", state: "failed", hint: "Failed" },
        { key: "read", label: "Read", state: "failed", hint: "N/A" }
      );
    } else {
      steps.push({
        key: "received",
        label: "Received on device",
        state: log.received_at ? "done" : "pending",
        time: log.received_at,
        hint: log.received_at
          ? (networkLabel ? `${networkLabel} · any network OK` : "Shown on phone · any network")
          : "Waiting — any network",
      });
      steps.push({
        key: "read",
        label: "Read (PWA opened)",
        state: log.read_at ? "done" : "pending",
        time: log.read_at,
        hint: log.read_at
          ? "Opened on company network"
          : log.received_at
            ? "Tap OK — read logs only on company network"
            : "Waiting for delivery first",
      });
    }
  }

  return steps;
}

export default function NotificationLogViewModal({ log, onClose, statusLabel }) {
  useEscapeKey(onClose, !!log);

  if (!log) return null;

  const statusMeta = STATUS_STYLES[log.status] ?? STATUS_STYLES.skipped;
  const channelLabel = CHANNEL_LABELS[log.channel] ?? log.channel ?? "-";
  const sourceLabel = SOURCE_LABELS[log.log_source] ?? log.log_source ?? "-";
  const templateLabel = TEMPLATE_LABELS[log.template_key] ?? log.template_key ?? "—";
  const messageText = log.body || log.message || log.title || "";
  const isPush = log.log_source === "push";
  const isFailed = log.status === "failed";
  const timelineSteps = buildTimelineSteps(log, isPush, isFailed);
  const networkLabel = receivedNetworkLabel(log);
  const userDisplay = log.user_name
    ? `${log.user_name}${log.user_id ? ` (#${log.user_id})` : ""}`
    : null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-log-title"
      >
        <div className="shrink-0 px-3 py-2 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 id="notification-log-title" className="text-sm font-bold text-slate-900">
                  Notification log
                </h3>
                <span
                  className={`inline-flex px-1.5 py-px border text-[9px] font-bold uppercase ${statusMeta.badge}`}
                >
                  {statusLabel || log.status || "-"}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500 truncate">
                {templateLabel} · {channelLabel} · {sourceLabel}
                {log.sent_at ? ` · ${log.sent_at}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
          {isPush && (
            <p className="text-[10px] text-slate-600 border border-indigo-100 bg-indigo-50/60 px-2 py-1.5 leading-snug">
              {pushDeliverySummary(log)}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <SectionCard title="Delivery timeline" icon={Clock}>
              <DeliveryTimeline steps={timelineSteps} />
              {!isPush && (
                <p className="mt-1.5 pt-1.5 border-t border-slate-100 text-[9px] text-slate-400 leading-snug">
                  WhatsApp: only server send time is tracked here.
                </p>
              )}
            </SectionCard>

            <SectionCard title="Recipient" icon={User}>
              <dl>
                <DetailRow label="User" value={userDisplay} />
                <DetailRow label="To" value={log.recipient} />
                {isPush && <DetailRow label="Device" value={log.device_name || log.device_id} />}
                {isPush && log.received_at && (
                  <DetailRow label="Received" value={`${log.received_at}${networkLabel ? ` · ${networkLabel}` : ""}`} />
                )}
                {isPush && log.received_client_ip && (
                  <DetailRow label="Recv IP" value={log.received_client_ip} mono />
                )}
                {isPush && log.device_id && log.device_name && (
                  <DetailRow label="Dev ID" value={log.device_id} mono fullWidth />
                )}
              </dl>
            </SectionCard>

            {(log.title || messageText) && (
              <SectionCard title="Message" icon={MessageSquare} className="md:col-span-2">
                {log.title && log.title !== messageText && (
                  <p className="text-[11px] font-semibold text-slate-900 mb-1">{log.title}</p>
                )}
                <p className="text-[11px] text-slate-700 whitespace-pre-wrap break-words leading-snug">
                  {messageText}
                </p>
              </SectionCard>
            )}

            {(log.error_detail || isFailed) && (
              <SectionCard title="Error" icon={AlertTriangle} className="md:col-span-2">
                <p className="text-[10px] text-rose-700 whitespace-pre-wrap break-words leading-snug">
                  {log.error_detail || "Delivery failed."}
                </p>
              </SectionCard>
            )}

            <SectionCard title="Record IDs" icon={Hash} className="md:col-span-2">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                <DetailRow label="Log ID" value={log.log_id} mono />
                <DetailRow label="Source" value={sourceLabel} />
                <DetailRow label="Template" value={log.template_key} mono />
                <DetailRow label="Channel" value={channelLabel} />
                {log.tracking_id && <DetailRow label="Tracking" value={log.tracking_id} mono fullWidth />}
                {log.task_id && <DetailRow label="Task" value={String(log.task_id)} mono />}
                {log.inbox_id && <DetailRow label="Inbox" value={String(log.inbox_id)} mono />}
              </dl>
            </SectionCard>
          </div>
        </div>

        <div className="shrink-0 px-3 py-1.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-[10px] font-bold uppercase bg-white border border-slate-200 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
