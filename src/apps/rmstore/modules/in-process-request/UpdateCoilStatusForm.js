"use client";

import { PackagePlus, RefreshCcwDot } from "lucide-react";

import { coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { formatPjobcardnoDisplay } from "@/apps/rmstore/modules/coil/coilTableVisuals";
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
  reassignRowRmColor = null,
  errors = {},
  readOnly = false,
}) {
  if (!coil) return null;

  const totalQty = Number(coil.original_qty ?? coil.qty) || 0;
  const partialMode = consumeMode === "leftover" || reassignEnabled;
  const returnActive = consumeMode === "leftover" && !reassignEnabled;
  // Return: input = qty to Store In. Reassign: input = consumed on current JC.
  const inputNum = partialMode ? Number(consumedQty) : NaN;
  const remaining = returnActive
    ? Number.isFinite(inputNum)
      ? Math.max(0, Math.min(totalQty, inputNum))
      : 0
    : partialMode && Number.isFinite(inputNum)
      ? Math.max(0, totalQty - inputNum)
      : 0;
  const used = returnActive
    ? Math.max(0, totalQty - remaining)
    : partialMode && Number.isFinite(inputNum)
      ? inputNum
      : totalQty;
  const validUsed = Number.isFinite(used) ? used : NaN;
  const showQtySection = partialMode && !readOnly;
  const jc = formatPjobcardnoDisplay(coil.source_pjobcardno || coil.pjobcardno);
  const val = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : "—");
  const summaryRows = [
    ["Coil", coilUidDisplayLabel(coil.coil_no_uid), "mono"],
    ["MRN UID", val(coil.mrn_uid), "mono"],
    ["RM Item", val(coil.item_code), "mono"],
    ["RM Desc", val(coil.item_desc), "desc"],
    ["FG Item", val(coil.fg_item_code), "mono"],
    ["FG Desc", val(coil.fg_item_desc), "desc"],
    ["Job Card", val(jc), "mono"],
    ["Qty", totalQty.toLocaleString(), "num"],
  ];

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5 min-w-0">
        {summaryRows.map(([label, value, kind]) => (
          <div key={label} className="grid grid-cols-[4.5rem_1fr] gap-x-1.5 items-baseline min-w-0">
            <dt className="text-[8px] font-bold uppercase text-slate-500 truncate">{label}</dt>
            <dd
              className={`text-[9px] truncate min-w-0 ${
                kind === "desc"
                  ? "font-medium normal-case text-slate-700"
                  : kind === "num"
                    ? "font-bold tabular-nums text-indigo-950"
                    : "font-mono font-bold uppercase text-indigo-950"
              }`}
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

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
                Enter return qty — that qty goes to Store In for receive.
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
            {returnActive ? "Return qty" : "Consumed qty"}
          </label>
          <input
            type="number"
            min={0}
            max={totalQty}
            step="any"
            inputMode="decimal"
            value={consumedQty}
            onChange={(e) => onConsumedQtyChange?.(e.target.value)}
            placeholder={String(totalQty)}
            className={`${OK_INPUT} h-10 text-sm tabular-nums`}
          />
          {returnActive &&
          consumedQty !== "" &&
          consumedQty !== "." &&
          remaining > 0 ? (
            <p className="text-[10px] font-semibold text-teal-800 flex items-center gap-1.5">
              <PackagePlus size={12} className="shrink-0" />
              {remaining.toLocaleString()} will go to Store In on submit
              {used > 0 ? ` · ${used.toLocaleString()} consumed` : ""}
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
          preserveApiOrder
          getOptionStyle={
            reassignRowRmColor
              ? (item) =>
                  Number(item.is_primary) === 1 || item._isPrimaryProd
                    ? {
                        backgroundColor: reassignRowRmColor.soft,
                        borderLeft: `3px solid ${reassignRowRmColor.accent}`,
                      }
                    : undefined
              : undefined
          }
          getOptionClassName={
            reassignRowRmColor
              ? (item) =>
                  Number(item.is_primary) === 1 || item._isPrimaryProd ? "font-semibold" : ""
              : undefined
          }
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
