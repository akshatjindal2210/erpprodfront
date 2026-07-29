"use client";

import { useState, useEffect, useMemo } from "react";
import { Send, Users, User, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { notificationService } from "@/apps/task/lib/services/notificationApi";
import { userService } from "@/apps/task/lib/services/userApi";
import { formatTaskUserOptionLabel } from "@/apps/task/lib/helpers/utilHelper";
import SearchableSelect from "@/apps/task/lib/ui/common/SearchableSelect";
import { AppConfigFormLoading, CONFIG_INPUT, CONFIG_LABEL, CONFIG_TEXTAREA } from "@/apps/settings/configuration/components/AppConfigFormFields";
import NotificationVariablesHint from "./NotificationVariablesHint";

const NOTIFY_SELECT =
  "w-full bg-white border border-slate-200 rounded-lg px-3 h-10 text-[11px] text-slate-800 outline-none transition-all cursor-pointer relative z-[2] touch-manipulation focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50/80 disabled:opacity-50 disabled:cursor-not-allowed";

const MESSAGE_TYPES = [
  { value: "manual_instant", label: "Custom / Instant" },
  { value: "task_assigned", label: "New Task" },
  { value: "daily_reminder", label: "Daily Reminder" },
  { value: "personal_reminder", label: "Personal Reminder" },
  { value: "target_date_set", label: "Target Date" },
  { value: "status_changed", label: "Status Update" },
];

const SEND_VIA_OPTIONS = [
  { value: "none", label: "None" },
  { value: "free", label: "Free (WhatsApp)" },
  { value: "paid", label: "Paid (WhatsApp)" },
];

function Field({ label, children, className = "" }) {
  return (
    <div className={`space-y-1 min-w-0 ${className}`}>
      <label className={CONFIG_LABEL}>{label}</label>
      {children}
    </div>
  );
}

export default function SendMessageTab({ templates = [] }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sending, setSending] = useState(false);

  const [recipientMode, setRecipientMode] = useState("users");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [pickUserId, setPickUserId] = useState("");
  const [messageType, setMessageType] = useState("manual_instant");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pwaEnabled, setPwaEnabled] = useState(true);
  const [apiEnabled, setApiEnabled] = useState(false);
  const [sendVia, setSendVia] = useState("none");

  useEffect(() => {
    userService
      .getViews()
      .then((res) => setUsers(res.data?.data || []))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoadingUsers(false));
  }, []);

  const userOptions = useMemo(
    () => users.map((u) => ({ id: u.id, name: formatTaskUserOptionLabel(u) })),
    [users]
  );

  const selectedUsers = useMemo(
    () => userOptions.filter((u) => selectedUserIds.includes(u.id)),
    [userOptions, selectedUserIds]
  );

  useEffect(() => {
    const tpl = templates.find((t) => t.template_key === messageType);
    if (tpl) {
      setSubject(tpl.subject || "");
      setBody(tpl.body || "");
    }
  }, [messageType, templates]);

  const addUser = () => {
    const id = Number(pickUserId);
    if (!id || selectedUserIds.includes(id)) return;
    setSelectedUserIds((prev) => [...prev, id]);
    setPickUserId("");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (recipientMode === "users" && !selectedUserIds.length) {
      toast.error("Select at least one user");
      return;
    }
    if (!subject.trim() && !body.trim()) {
      toast.error("Enter subject or message");
      return;
    }
    if (!pwaEnabled && (!apiEnabled || sendVia === "none")) {
      toast.error("Enable PWA and/or WhatsApp channel");
      return;
    }

    setSending(true);
    try {
      const res = await notificationService.sendInstant({
        recipient_mode: recipientMode,
        user_ids: recipientMode === "users" ? selectedUserIds : [],
        template_key: messageType,
        subject: subject.trim(),
        body: body.trim(),
        pwa_enabled: pwaEnabled,
        api_enabled: apiEnabled,
        send_via: sendVia,
      });
      const data = res.data?.data;
      toast.success(res.data?.message || `Sent to ${data?.sent ?? 0} user(s)`);
      if (data?.failed > 0) toast.warn(`${data.failed} failed — check Logs tab`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loadingUsers) return <AppConfigFormLoading />;

  return (
    <form onSubmit={handleSend} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5">
        <div className="w-full flex flex-col gap-4">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">
              Send instant message
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
            <div className="lg:col-span-4 space-y-4">
              <Field label="Send to">
                <select
                  className={NOTIFY_SELECT}
                  value={recipientMode}
                  onChange={(e) => setRecipientMode(e.target.value)}
                  disabled={sending}
                >
                  <option value="users">Selected users</option>
                  <option value="all">All active users</option>
                </select>
              </Field>

              {recipientMode === "users" && (
                <div className="space-y-2">
                  <Field label="Add user">
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          options={userOptions.filter((u) => !selectedUserIds.includes(u.id))}
                          value={pickUserId}
                          onChange={setPickUserId}
                          placeholder="Search user…"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addUser}
                        disabled={!pickUserId || sending}
                        className="shrink-0 px-3 h-10 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </Field>
                  {selectedUsers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUsers.map((u) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-100"
                        >
                          <User size={10} />
                          {u.name}
                          <button
                            type="button"
                            onClick={() => setSelectedUserIds((prev) => prev.filter((x) => x !== u.id))}
                            className="ml-0.5 text-indigo-400 hover:text-rose-500"
                            disabled={sending}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">No users selected yet</p>
                  )}
                </div>
              )}

              {recipientMode === "all" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-[10px]">
                  <Users size={14} />
                  Message will go to all active users
                </div>
              )}

              <Field label="Message type (API trigger)">
                <select
                  className={NOTIFY_SELECT}
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value)}
                  disabled={sending}
                >
                  {MESSAGE_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="PWA (bell + tray)">
                <select
                  className={NOTIFY_SELECT}
                  value={pwaEnabled ? "true" : "false"}
                  onChange={(e) => setPwaEnabled(e.target.value === "true")}
                  disabled={sending}
                >
                  <option value="true">On — instant in app</option>
                  <option value="false">Off</option>
                </select>
              </Field>

              <Field label="API (WhatsApp)">
                <select
                  className={NOTIFY_SELECT}
                  value={apiEnabled ? "true" : "false"}
                  onChange={(e) => setApiEnabled(e.target.value === "true")}
                  disabled={sending}
                >
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </select>
              </Field>

              <Field label="WhatsApp channel">
                <select
                  className={NOTIFY_SELECT}
                  value={sendVia}
                  onChange={(e) => setSendVia(e.target.value)}
                  disabled={sending || !apiEnabled}
                >
                  {SEND_VIA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Subject">
                <input
                  className={CONFIG_INPUT}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending}
                  placeholder="Message subject"
                />
              </Field>
            </div>

            <div className="lg:col-span-8 flex flex-col">
              <Field label="Message body" className="flex flex-col flex-1">
                <textarea
                  className={`${CONFIG_TEXTAREA} w-full font-mono text-[11px] leading-relaxed resize-y min-h-[200px] lg:min-h-[280px]`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={sending}
                  placeholder="Hi {{user_name}},&#10;&#10;Your message here..."
                />
              </Field>
              <div className="mt-3">
                <NotificationVariablesHint />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 px-4 md:px-5 py-3 flex items-center justify-end gap-2 bg-slate-50/80">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 shadow-sm"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? "Sending…" : "Send now"}
        </button>
      </div>
    </form>
  );
}
