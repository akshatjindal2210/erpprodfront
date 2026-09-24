"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, Edit3, Trash2, Users, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";
import { focusFirstError } from "@/platform/utils/form/formFocus";
import { notificationTemplateService } from "@/apps/settings/lib/services/notificationTemplateService";
import { APP_TYPE_LABELS } from "@/config/moduleAppRegistry";
import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { FormLabel, OK_INPUT, ERR_INPUT, OK_TEXTAREA, ERR_TEXTAREA } from "@/ui/common/Constants";
import { TRIGGER_EVENT_OPTIONS, TRIGGER_EVENT_LABELS, WHATSAPP_OPTIONS, SYSTEM_VARIABLES, AUDIENCE_DIM_OPTIONS, normalizeAudience, audienceHasAny, roleLabel } from "./moduleTemplateConfig";

const ALL_ID = "*";
const FIELD_ORDER = ["module_id", "name", "trigger_events", "audience", "channels", "message"];
const FIELD_INPUT = "text-[11px] h-[38px] rounded-lg";
const SELECT_CLS = `${OK_INPUT} ${FIELD_INPUT} appearance-none`;
const ERR_TXT = "text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1";

const emptyAudience = () => ({
  departments: { all: false, ids: [] },
  designations: { all: false, ids: [] },
  attributes: { all: false, ids: [] },
  roles: { all: false, ids: [] },
  users: { all: false, ids: [] },
});

const EMPTY_FORM = {
  module_id: "",
  name: "",
  subject: "",
  message: "",
  trigger_events: [],
  audience: emptyAudience(),
  pwa_enabled: true,
  email_enabled: false,
  send_via: "none",
  is_active: true,
};

function sortAz(rows) {
  return [...rows].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
}

function makeStaticServices(rows, allLabel) {
  const sorted = sortAz(rows);
  const list = allLabel ? [{ id: ALL_ID, name: allLabel }, ...sorted] : sorted;
  const byId = new Map(list.map((r) => [String(r.id), r]));

  return {
    fetchService: async ({ search = "", page = 1, limit = 50 } = {}) => {
      const q = String(search).trim().toLowerCase();
      let filtered;
      if (!q) filtered = list;
      else {
        const rest = sorted.filter((r) => String(r.name).toLowerCase().includes(q));
        const allHit = allLabel && String(allLabel).toLowerCase().includes(q);
        filtered = allHit ? [{ id: ALL_ID, name: allLabel }, ...rest] : rest;
      }
      const start = (Math.max(1, Number(page) || 1) - 1) * (Number(limit) || 50);
      return { data: filtered.slice(start, start + (Number(limit) || 50)), total: filtered.length };
    },
    getByIdService: async (id) => byId.get(String(id)) ?? null,
  };
}

function selectValue(dim) {
  if (dim?.all) return [ALL_ID];
  return Array.isArray(dim?.ids) ? dim.ids.map(String) : [];
}

function fromSelectIds(ids) {
  const list = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean);
  const specifics = list.filter((id) => id !== ALL_ID);
  if (list.includes(ALL_ID) && !specifics.length) return { all: true, ids: [] };
  return { all: false, ids: specifics };
}

function AudienceDropdown({ label, rows, allLabel, dim, onChange, disabled }) {
  const { fetchService, getByIdService } = useMemo(
    () => makeStaticServices(rows, allLabel),
    [rows, allLabel]
  );

  return (
    <SearchableSelect
      label={label}
      multiple
      compactMulti
      preserveApiOrder
      value={selectValue(dim)}
      onChange={(ids) => onChange(fromSelectIds(ids))}
      fetchService={fetchService}
      getByIdService={getByIdService}
      dataKey="id"
      labelKey="name"
      placeholder={`Search ${label.toLowerCase()}…`}
      disabled={disabled}
    />
  );
}

/** Training cell: lockModule / lockEvents / presetEvents / viewOnly */
export default function NotificationTemplateModal({ slot, options, onClose, onSuccess, stackLevel = 0 }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const formRef = useRef(null);
  const messageRef = useRef(null);
  const ex = slot?.existingData;
  const viewOnly = slot?.viewOnly === true;
  const disabled = saving || viewOnly;
  const fromGrid = !!(slot?.lockModule && slot?.lockEvents);
  const eventLabel = TRIGGER_EVENT_LABELS[form.trigger_events?.[0]] || form.trigger_events?.[0] || "";
  const headerDesc = [slot.modLabel || ex?.module_label, eventLabel].filter(Boolean).join(" · ");

  useEffect(() => {
    if (ex) {
      setForm({
        module_id: ex.module_id ?? "",
        name: ex.name ?? "",
        subject: ex.subject ?? "",
        message: ex.message ?? "",
        trigger_events: Array.isArray(ex.trigger_events) ? ex.trigger_events.slice(0, 1) : [],
        audience: normalizeAudience(ex.audience),
        pwa_enabled: ex.pwa_enabled !== false,
        email_enabled: !!ex.email_enabled,
        send_via: ex.send_via ?? "none",
        is_active: ex.is_active !== false,
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        audience: emptyAudience(),
        module_id: slot?.moduleId ?? "",
        trigger_events: slot?.presetEvents ?? [],
      });
    }
    setErrors({});
  }, [slot]);

  const set = useCallback((patch) => setForm((prev) => ({ ...prev, ...patch })), []);

  const setAudienceDim = (key, dim) =>
    setForm((prev) => ({ ...prev, audience: { ...prev.audience, [key]: dim } }));

  const moduleRows = useMemo(
    () =>
      (options?.modules ?? []).map((m) => ({
        id: m.id,
        name: `${m.label || m.name} · ${APP_TYPE_LABELS[m.app_type] ?? String(m.app_type || "").toUpperCase()}${m.is_active ? "" : " (inactive)"}`,
      })),
    [options]
  );
  const moduleServices = useMemo(() => makeStaticServices(moduleRows), [moduleRows]);

  const dimRows = useMemo(() => {
    const o = options ?? {};
    return {
      departments: (o.departments ?? []).map((d) => ({ id: String(d.id), name: d.name })),
      designations: (o.designations ?? []).map((d) => ({ id: String(d.id), name: d.name })),
      attributes: (o.attributes ?? []).map((a) => ({ id: String(a.id), name: a.name })),
      roles: (o.roles ?? []).map((r) => ({ id: r, name: roleLabel(r) })),
      users: (o.users ?? []).map((u) => ({
        id: String(u.id),
        name: [u.name, u.usercode ? `#${u.usercode}` : null].filter(Boolean).join(" "),
      })),
    };
  }, [options]);

  const audienceKey = useMemo(() => JSON.stringify(form.audience), [form.audience]);

  useEffect(() => {
    if (!audienceHasAny(form.audience)) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      notificationTemplateService
        .previewRecipients(form.audience)
        .then((res) => !cancelled && setPreview(res?.data ?? null))
        .catch(() => !cancelled && setPreview(null));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [audienceKey]);

  const toggleEvent = (value) => {
    if (slot.lockEvents || viewOnly) return;
    set({ trigger_events: form.trigger_events.includes(value) ? [] : [value] });
  };

  const insertVariable = (key) => {
    if (viewOnly) return;
    const token = `{{${key}}}`;
    const el = messageRef.current;
    const text = form.message || "";
    if (!el) {
      set({ message: text + token });
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    set({ message: text.slice(0, start) + token + text.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleSave = async () => {
    if (viewOnly) return;
    const e = {};
    if (!form.module_id) e.module_id = "Select a module";
    if (!String(form.name).trim()) e.name = "Template name is required";
    if (!form.trigger_events.length) e.trigger_events = "Select a trigger event";
    if (!audienceHasAny(form.audience)) e.audience = "Select at least one recipient";
    if (!form.pwa_enabled && !form.email_enabled && form.send_via === "none") e.channels = "Enable PWA, Email, or WhatsApp";
    if (!String(form.message).trim()) e.message = "Message is required";

    if (Object.keys(e).length) {
      setErrors(e);
      toast.warning("Please fill required fields");
      focusFirstError(e, FIELD_ORDER, (key) => formRef.current?.querySelector(`[data-field="${key}"]`));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        module_id: Number(form.module_id),
        name: form.name.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        audience: normalizeAudience(form.audience),
      };
      if (slot.isEdit) {
        await notificationTemplateService.update(slot.id, payload);
        toast.success("Template updated successfully");
      } else {
        await notificationTemplateService.create(payload);
        toast.success("Template saved successfully");
      }
      onSuccess();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (viewOnly) return;
    if (!confirm("Delete this template?")) return;
    setSaving(true);
    try {
      await notificationTemplateService.delete(slot.id);
      toast.success("Template deleted successfully");
      onSuccess();
    } catch (err) {
      toast.error(err?.message || "Failed to delete template");
    } finally {
      setSaving(false);
    }
  };

  const drawerFooter = (
    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full">
      {slot.isEdit && slot.canDelete !== false && !viewOnly ? (
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} /> Delete
        </button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:ml-auto">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-xl"
        >
          {viewOnly ? "Close" : "Cancel"}
        </button>
        {!viewOnly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto sm:min-w-[140px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check size={18} /> Save
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={!!slot}
      onClose={onClose}
      onSubmit={viewOnly ? undefined : handleSave}
      title={viewOnly ? "View Notification" : slot.isEdit ? "Edit Notification" : "New Notification"}
      description={headerDesc || "Module notification template"}
      footer={drawerFooter}
      maxWidth="max-w-2xl"
      stackLevel={stackLevel}
    >
      <div ref={formRef} className="space-y-4 pb-4">
        {!fromGrid && (
          <div data-field="module_id">
            <SearchableSelect
              label="Module"
              required
              value={form.module_id || null}
              onChange={(id) => set({ module_id: id ?? "" })}
              fetchService={moduleServices.fetchService}
              getByIdService={moduleServices.getByIdService}
              dataKey="id"
              labelKey="name"
              placeholder="Search module…"
              disabled={disabled || !!slot.lockModule}
              error={errors.module_id || ""}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-field="name">
          <div className="md:col-span-2 space-y-1">
            <FormLabel required>Template Name</FormLabel>
            <input
              className={`${errors.name ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT}`}
              placeholder="e.g. User edited — notify heads"
              value={form.name}
              maxLength={150}
              disabled={disabled}
              onChange={(e) => set({ name: e.target.value })}
            />
            {errors.name && (
              <p className={ERR_TXT}>
                <AlertCircle size={10} /> {errors.name}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <FormLabel>Status</FormLabel>
            <select
              className={SELECT_CLS}
              value={form.is_active ? "true" : "false"}
              disabled={disabled}
              onChange={(e) => set({ is_active: e.target.value === "true" })}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        {!fromGrid && (
          <div className="space-y-1" data-field="trigger_events">
            <FormLabel required>Trigger On</FormLabel>
            <div className="flex flex-wrap gap-2">
              {TRIGGER_EVENT_OPTIONS.map((o) => {
                const on = form.trigger_events.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleEvent(o.value)}
                    disabled={disabled || !!slot.lockEvents}
                    className={`px-3 h-[38px] rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                      on
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {errors.trigger_events && (
              <p className={ERR_TXT}>
                <AlertCircle size={10} /> {errors.trigger_events}
              </p>
            )}
          </div>
        )}

        <div className="h-px bg-slate-100" />

        <div className="space-y-3" data-field="audience">
          <div className="flex items-center justify-between gap-2">
            <FormLabel required>Send To</FormLabel>
            {preview ? (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users size={12} /> {preview.count} user{preview.count === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AUDIENCE_DIM_OPTIONS.map((d) => (
              <AudienceDropdown
                key={d.key}
                label={d.label}
                rows={dimRows[d.key]}
                allLabel={d.allLabel}
                dim={form.audience[d.key]}
                onChange={(dim) => setAudienceDim(d.key, dim)}
                disabled={disabled}
              />
            ))}
          </div>
          {errors.audience && (
            <p className={ERR_TXT}>
              <AlertCircle size={10} /> {errors.audience}
            </p>
          )}
        </div>

        <div className="h-px bg-slate-100" />

        <div className="space-y-1" data-field="channels">
          <FormLabel required>Channels</FormLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <FormLabel>PWA (bell + tray)</FormLabel>
              <select
                className={SELECT_CLS}
                value={form.pwa_enabled ? "true" : "false"}
                disabled={disabled}
                onChange={(e) => set({ pwa_enabled: e.target.value === "true" })}
              >
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            </div>
            <div className="space-y-1">
              <FormLabel>Email</FormLabel>
              <select
                className={SELECT_CLS}
                value={form.email_enabled ? "true" : "false"}
                disabled={disabled}
                onChange={(e) => set({ email_enabled: e.target.value === "true" })}
              >
                <option value="false">Off</option>
                <option value="true">On</option>
              </select>
            </div>
            <div className="space-y-1">
              <FormLabel>WhatsApp</FormLabel>
              <select
                className={SELECT_CLS}
                value={form.send_via}
                disabled={disabled}
                onChange={(e) => set({ send_via: e.target.value })}
              >
                {WHATSAPP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {errors.channels && (
            <p className={ERR_TXT}>
              <AlertCircle size={10} /> {errors.channels}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <FormLabel>Subject</FormLabel>
          <input
            className={`${OK_INPUT} ${FIELD_INPUT}`}
            placeholder="Notification subject"
            value={form.subject}
            disabled={disabled}
            onChange={(e) => set({ subject: e.target.value })}
          />
        </div>

        <div className="space-y-1" data-field="message">
          <FormLabel required>Message</FormLabel>
          <textarea
            ref={messageRef}
            rows={5}
            className={`${errors.message ? ERR_TEXTAREA : OK_TEXTAREA} font-mono resize-y min-h-[110px]`}
            placeholder="Hi {{user_name}}, …"
            value={form.message}
            disabled={disabled}
            onChange={(e) => set({ message: e.target.value })}
          />
          {errors.message && (
            <p className={ERR_TXT}>
              <AlertCircle size={10} /> {errors.message}
            </p>
          )}
          {!viewOnly && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SYSTEM_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="px-2 py-1 text-[10px] font-mono text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                  title={v.label}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
