"use client";

import { Check, Loader2 } from "lucide-react";
import { okInput } from "@/core/components/common/Constants";

export const CONFIG_INPUT = `${okInput} text-[11px] h-[38px] rounded-lg border-slate-200`;
export const CONFIG_SELECT = CONFIG_INPUT;
export const CONFIG_TEXTAREA = `${okInput} text-[11px] rounded-lg border-slate-200 resize-none py-2.5 min-h-[72px]`;
export const CONFIG_LABEL = "text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block mb-1";

export function ConfigFormRow({ row, draft, setDraft, disabled }) {
  const value = draft[row.key] ?? "";
  const isBool = row.value_type === "boolean";
  const isOn = String(value).toLowerCase() === "true" || value === "1";

  if (isBool) {
    return (
      <div className="space-y-1 min-w-0">
        <label htmlFor={`cfg-${row.key}`} className={CONFIG_LABEL}>
          {row.label}
        </label>
        <select
          id={`cfg-${row.key}`}
          disabled={disabled}
          value={isOn ? "true" : "false"}
          onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
          className={CONFIG_SELECT}
        >
          <option value="false">Disabled</option>
          <option value="true">Enabled</option>
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-1 min-w-0">
      <label htmlFor={`cfg-${row.key}`} className={CONFIG_LABEL}>
        {row.key === "company_address" ? "Address" : row.label}
      </label>
      {row.key === "company_address" ? (
        <textarea
          id={`cfg-${row.key}`}
          rows={2}
          disabled={disabled}
          className={CONFIG_TEXTAREA}
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
          className={CONFIG_INPUT}
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

export function ConfigFieldRows({ layout, rowsByKey, draft, setDraft, disabled }) {
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
              <ConfigFormRow key={row.key} row={row} draft={draft} setDraft={setDraft} disabled={disabled} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function AppConfigFormFooter({ saving, dirtyCount, onReset, submitLabel = "Save changes" }) {
  return (
    <div className="shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
      <button
        type="button"
        disabled={saving || dirtyCount === 0}
        onClick={onReset}
        className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-40"
      >
        Reset
      </button>
      <button
        type="submit"
        disabled={saving || dirtyCount === 0}
        className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-none transition-all flex items-center justify-center gap-2 shadow-none disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Check size={18} /> {submitLabel}
          </>
        )}
      </button>
    </div>
  );
}

export function AppConfigFormLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
      <Loader2 size={20} className="animate-spin text-indigo-600" />
      <span className="text-sm font-semibold">Loading…</span>
    </div>
  );
}
