"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Check, Loader2 } from "lucide-react";

import { appConfigService } from "@/features/admin/services/appConfigService";
import { applyListViewSpanFromSession } from "@/core/utils/global";
import { okInput } from "@/core/components/common/Constants";

const INPUT = `${okInput} text-[11px] h-[38px] rounded-lg border-slate-200`;
const SELECT = INPUT;
const TEXTAREA = `${okInput} text-[11px] rounded-lg border-slate-200 resize-none py-2.5 min-h-[72px]`;
const LABEL = "text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block mb-1";

const COMPANY_LAYOUT = [
  ["company_name", "company_phone", "company_email"],
  ["company_pincode", "company_state", "company_gstin"],
  ["company_address"],
];

const APPLICATION_LAYOUT = [
  ["inward_location_validation", "default_list_view_span_days"],
  ["box_qr_public_base_url"],
];

function FormRow({ row, draft, setDraft, disabled }) {
  const value = draft[row.key] ?? "";
  const isBool = row.value_type === "boolean";
  const isOn = String(value).toLowerCase() === "true" || value === "1";

  if (isBool) {
    return (
      <div className="space-y-1 min-w-0">
        <label htmlFor={`cfg-${row.key}`} className={LABEL}>
          {row.label}
        </label>
        <select
          id={`cfg-${row.key}`}
          disabled={disabled}
          value={isOn ? "true" : "false"}
          onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
          className={SELECT}
        >
          <option value="false">Disabled</option>
          <option value="true">Enabled</option>
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-1 min-w-0">
      <label htmlFor={`cfg-${row.key}`} className={LABEL}>
        {row.key === "company_address" ? "Address" : row.label}
      </label>
      {row.key === "company_address" ? (
        <textarea
          id={`cfg-${row.key}`}
          rows={2}
          disabled={disabled}
          className={TEXTAREA}
          value={value}
          onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
          placeholder="Plot no., sector, city…"
        />
      ) : (
        <input
          id={`cfg-${row.key}`}
          type={row.value_type === "number" ? "number" : "text"}
          min={row.min}
          max={row.max}
          disabled={disabled}
          className={INPUT}
          value={value}
          onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
          placeholder={
            row.value_type === "url" ? "https://example.com" : row.value_type === "number" ? String(row.min ?? 7) : ""
          }
        />
      )}
    </div>
  );
}

function ConfigFieldRows({ layout, rowsByKey, draft, setDraft, disabled }) {
  return (
    <div className="space-y-4">
      {layout.map((rowKeys, idx) => (
        <div
          key={idx}
          className={rowKeys.length === 1 ? "grid grid-cols-1 gap-y-4" : "grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4"}
        >
          {rowKeys.map((key) => {
            const row = rowsByKey[key];
            if (!row) return null;
            return (
              <FormRow key={row.key} row={row} draft={draft} setDraft={setDraft} disabled={disabled} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function ImsAppConfigForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appConfigService.list();
      if (!res?.success) throw new Error(res?.message || "Failed to load");
      setItems(res.data || []);
      const next = {};
      (res.data || []).forEach((row) => {
        next[row.key] = row.config_value ?? "";
      });
      setDraft(next);
      setSaved(next);
    } catch (err) {
      toast.error(err?.message || "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const companyByKey = useMemo(
    () => Object.fromEntries(items.filter((r) => r.section === "company").map((r) => [r.key, r])),
    [items]
  );
  const applicationByKey = useMemo(
    () =>
      Object.fromEntries(
        items.filter((r) => (r.section || "application") === "application").map((r) => [r.key, r])
      ),
    [items]
  );

  const dirtyRows = useMemo(
    () => items.filter((row) => String(draft[row.key] ?? "") !== String(saved[row.key] ?? "")),
    [items, draft, saved]
  );

  const handleReset = () => setDraft({ ...saved });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dirtyRows.length) {
      toast.info("No changes to save");
      return;
    }
    setSaving(true);
    try {
      for (const row of dirtyRows) {
        const res = await appConfigService.update(row.key, draft[row.key]);
        if (!res?.success) throw new Error(res?.message || `Failed to save ${row.label}`);
        if (row.key === "default_list_view_span_days" && res.data?.config_value != null) {
          applyListViewSpanFromSession({
            default_list_view_span_days: res.data.config_value,
          });
        }
        if (row.key === "inward_location_validation" && res.data?.config_value != null) {
          applyListViewSpanFromSession({
            inward_location_validation: String(res.data.config_value).trim().toLowerCase() === "true",
          });
        }
      }
      toast.success("Configuration saved successfully");
      await load();
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 size={20} className="animate-spin text-indigo-600" />
            <span className="text-sm font-semibold">Loading…</span>
          </div>
        ) : (
          <div className="w-full space-y-8">
            <section>
              <div className="mb-4 pb-2 border-b border-slate-200">
                <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Company details</h2>
                <p className="text-[10px] text-slate-500 mt-1">Printed on box stickers and labels.</p>
              </div>
              <ConfigFieldRows
                layout={COMPANY_LAYOUT}
                rowsByKey={companyByKey}
                draft={draft}
                setDraft={setDraft}
                disabled={saving}
              />
            </section>

            <section>
              <div className="mb-4 pb-2 border-b border-slate-200">
                <h2 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">Application settings</h2>
              </div>
              <ConfigFieldRows
                layout={APPLICATION_LAYOUT}
                rowsByKey={applicationByKey}
                draft={draft}
                setDraft={setDraft}
                disabled={saving}
              />
            </section>
          </div>
        )}
      </div>

      {!loading && (
        <div className="shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <button
            type="button"
            disabled={saving || dirtyRows.length === 0}
            onClick={handleReset}
            className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving || dirtyRows.length === 0}
            className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-none transition-all flex items-center justify-center gap-2 shadow-none disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check size={18} /> Save changes
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}
