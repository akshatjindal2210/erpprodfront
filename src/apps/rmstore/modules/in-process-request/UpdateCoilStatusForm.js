"use client";

import { PackageMinus, PackagePlus, RefreshCcwDot } from "lucide-react";

import { coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { OK_INPUT } from "@/ui/common/Constants";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";

/** Update Coil Status — cards select mode; consumed qty (+ job card) below cards. */
export default function UpdateCoilStatusForm({
  coil = null,
  consumeMode = "full",
  onConsumeModeChange,
  consumedQty = "",
  onConsumedQtyChange,
  reassignEnabled = false,
  onReassignToggle,
  reassignJobCardNo = "",
  onReassignJobCardChange,
  fetchJobCards,
  getJobCardById,
  errors = {},
  readOnly = false,
}) {
  if (!coil) return null;

  const totalQty = Number(coil.original_qty ?? coil.qty) || 0;
  const partialMode = consumeMode === "leftover" || reassignEnabled;
  const used = partialMode ? Number(consumedQty) : totalQty;
  const validUsed = Number.isFinite(used) ? used : NaN;
  const remaining =
    partialMode && Number.isFinite(validUsed) ? Math.max(0, totalQty - validUsed) : 0;

  const returnActive = consumeMode === "leftover" && !reassignEnabled;
  const showQtySection = partialMode && !readOnly;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 min-w-0">
        <PackageMinus size={14} className="text-indigo-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-indigo-900 uppercase truncate">
            {coilUidDisplayLabel(coil.coil_no_uid)}
          </p>
          <p className="text-[8px] font-bold text-indigo-700/80 uppercase truncate">
            MRN {coil.mrn_no ?? "—"} · Total qty {totalQty.toLocaleString()}
            {coil.item_code ? ` · ${coil.item_code}` : ""}
          </p>
        </div>
      </div>

      {!readOnly ? (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Consumption
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onConsumeModeChange?.("full")}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                consumeMode === "full" && !reassignEnabled
                  ? "border-emerald-400 bg-emerald-50/80"
                  : "border-slate-200 bg-white hover:border-emerald-200"
              }`}
            >
              <span className="text-xs font-black uppercase text-emerald-900">Full Consume</span>
              <p className="text-[10px] text-slate-600 mt-1 leading-snug">
                Entire coil qty ({totalQty.toLocaleString()}) is used at the machine.
              </p>
            </button>
            <button
              type="button"
              onClick={() => onConsumeModeChange?.("leftover")}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                returnActive
                  ? "border-indigo-400 bg-indigo-50/80"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
            >
              <span className="text-xs font-black uppercase text-indigo-900">Return</span>
              <p className="text-[10px] text-slate-600 mt-1 leading-snug">
                Enter consumed qty — balance returns to store automatically.
              </p>
            </button>
            <button
              type="button"
              onClick={() => onReassignToggle?.(true)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                reassignEnabled
                  ? "border-violet-400 bg-violet-50/80"
                  : "border-slate-200 bg-white hover:border-violet-200"
              }`}
            >
              <span className="text-xs font-black uppercase text-violet-900 inline-flex items-center gap-1.5">
                <RefreshCcwDot size={14} />
                Reassign
              </span>
              <p className="text-[10px] text-slate-600 mt-1 leading-snug">
                Enter consumed qty, pick job card — balance stays on shop floor.
              </p>
            </button>
          </div>
        </div>
      ) : null}

      {showQtySection ? (
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Consumed qty
          </label>
          <input
            type="number"
            min={0}
            max={totalQty}
            step="any"
            value={consumedQty}
            onChange={(e) => onConsumedQtyChange?.(e.target.value)}
            placeholder={`Max ${totalQty.toLocaleString()}`}
            className={`${OK_INPUT} h-10 text-sm tabular-nums`}
          />
          {returnActive &&
          Number.isFinite(validUsed) &&
          validUsed >= 0 &&
          validUsed <= totalQty ? (
            <p className="text-[10px] font-semibold text-teal-800 flex items-center gap-1.5">
              <PackagePlus size={12} className="shrink-0" />
              {remaining.toLocaleString()} will go to Store In on submit
            </p>
          ) : null}
          {reassignEnabled &&
          Number.isFinite(validUsed) &&
          validUsed >= 0 &&
          validUsed <= totalQty &&
          remaining > 0 ? (
            <p className="text-[10px] font-semibold text-teal-800 flex items-center gap-1.5">
              <PackagePlus size={12} className="shrink-0" />
              {remaining.toLocaleString()} will reassign
              {reassignJobCardNo ? ` to job card ${reassignJobCardNo}` : ""} on submit
            </p>
          ) : null}
          {errors.qty ? (
            <p className="text-[10px] font-bold text-rose-600">{errors.qty}</p>
          ) : null}
        </div>
      ) : partialMode && readOnly ? (
        <div className="text-[10px] font-semibold text-slate-600">
          Consumed {Number(validUsed || 0).toLocaleString()} of {totalQty.toLocaleString()}
          {remaining > 0 && returnActive ? ` · ${remaining.toLocaleString()} → Store In` : null}
          {remaining > 0 && reassignEnabled
            ? ` · ${remaining.toLocaleString()} → Reassign${reassignJobCardNo ? ` (${reassignJobCardNo})` : ""}`
            : null}
        </div>
      ) : null}

      {reassignEnabled && !readOnly ? (
        <SearchableSelect
          label="Job card"
          value={reassignJobCardNo}
          onChange={(id, raw) => onReassignJobCardChange?.(id, raw)}
          fetchService={fetchJobCards}
          getByIdService={getJobCardById}
          dataKey="id"
          labelKey="label"
          selectedLabelKey="label"
          subLabelKey="sub"
          placeholder="Select job card…"
          required
          disabled={readOnly}
        />
      ) : null}
      {reassignEnabled && errors.reassignJobCard ? (
        <p className="text-[10px] font-bold text-rose-600 -mt-1">{errors.reassignJobCard}</p>
      ) : null}
      {reassignEnabled && errors.reassignMachine ? (
        <p className="text-[10px] font-bold text-rose-600 -mt-1">{errors.reassignMachine}</p>
      ) : null}
    </div>
  );
}
