"use client";

import { Loader2 } from "lucide-react";
import { isCoilAvailableForSaMinus, isSaMinusWriteOff } from "@/apps/rmstore/lib/utils/saMinusInventory";

function coilSourceLabel(row) {
  if (row?.sa_id != null && String(row?.sa_entry_type || "").toLowerCase() === "stock_in") {
    return "SA ADD";
  }
  return "MRN";
}

function isCoilAvailableForMinus(row, currentAdjustmentId) {
  return isCoilAvailableForSaMinus(row, { excludeAdjustmentId: currentAdjustmentId });
}

function coilStatusLabel(row, checked, readOnly, canSelect) {
  const removed = isSaMinusWriteOff(row) || String(row?.status || "").toLowerCase() === "consumed";
  if (readOnly) {
    if (checked) return removed ? "Removed" : "Selected";
    return removed ? "Removed" : "In stock";
  }
  if (!canSelect) return "Not available";
  if (checked) return "Selected";
  return "In stock";
}

/** IMS-style minus breakdown table for RM Store coils. */
export default function RmMinusCoilBreakdownTable({
  rows = [],
  selectedUids = new Set(),
  onToggle,
  mrnNo,
  mrnUid,
  selectedQty = 0,
  selectedCount = 0,
  readOnly = false,
  allowSelect = true,
  loading = false,
  entryApproved = false,
  currentAdjustmentId = null,
}) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;
  const unit = list[0]?.unit || "KG";
  const showMinusCol = allowSelect && !readOnly;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0">
      <div className="shrink-0 px-3 py-2 lg:px-4 bg-rose-50 border-b border-rose-100 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase text-rose-700 tracking-wide">
            {readOnly
              ? entryApproved
                ? "Coils removed (minus)"
                : "Coils selected for minus"
              : "Coils to remove (minus)"}
          </p>
          <p className="text-[11px] font-bold text-rose-900">
            {readOnly ? (
              <>
                <span className="tabular-nums">{total}</span> coil
              </>
            ) : (
              <>
                Selected: <span className="tabular-nums">{selectedCount}</span> / {total} coil
              </>
            )}
            <span className="mx-2 text-rose-300">|</span>
            Qty impact:{" "}
            <span className="font-black tabular-nums">-{Number(selectedQty || 0).toLocaleString()}</span> {unit}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto overscroll-contain p-0 lg:p-1 [-webkit-overflow-scrolling:touch]">
        {loading ? (
          <div className="py-12 text-center text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading coils…
          </div>
        ) : !list.length ? (
          <div className="bg-white border border-slate-200 px-3 py-8 text-center text-slate-400 text-[10px] font-bold uppercase">
            No coils
          </div>
        ) : (
          <div className="bg-white border border-slate-200 w-full max-w-full min-w-0">
            <table className="w-full min-w-[760px] sm:min-w-[820px] lg:min-w-[960px] text-left border-separate border-spacing-0">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th
                    scope="col"
                    className="sticky left-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-600 border-r border-slate-200 whitespace-nowrap"
                  >
                    #
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                  >
                    Coil
                  </th>
                  {/* <th
                    scope="col"
                    className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                  >
                    MRN No.
                  </th> */}
                  <th
                    scope="col"
                    className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                  >
                    MRN UID
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                  >
                    Supplier
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                  >
                    Qty
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-500 whitespace-nowrap"
                  >
                    Status
                  </th>
                  {showMinusCol ? (
                    <th
                      scope="col"
                      className="sticky right-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] font-black uppercase text-slate-600 text-center border-l border-slate-200 whitespace-nowrap"
                    >
                      Minus
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {list.map((row, idx) => {
                  const uid = String(row.coil_no_uid || "");
                  const checked = selectedUids.has(uid);
                  const isSa = coilSourceLabel(row) === "SA ADD";
                  const canSelect = isCoilAvailableForMinus(row, currentAdjustmentId) || checked;
                  const coilIndex = row.coil_index ?? idx + 1;
                  const totalCoils = row.total_coils ?? total;
                  return (
                    <tr
                      key={uid || idx}
                      className={`group border-b border-slate-100 transition-colors hover:bg-slate-50/70 ${!canSelect && !readOnly ? "opacity-50" : ""}`}
                    >
                      <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums transition-colors">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-700 min-w-0 max-w-[180px] lg:max-w-[240px]">
                        <div className="flex flex-col leading-snug min-w-0">
                          <span className="text-slate-800 font-bold text-[10px] break-all">{uid || "—"}</span>
                          <span className="text-[8px] lg:text-[10px] text-slate-400 uppercase font-bold truncate">
                            Coil {coilIndex} / {totalCoils}
                          </span>
                        </div>
                      </td>
                      {/* <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-700 whitespace-nowrap tabular-nums">
                        {row.mrn_no ?? mrnNo ?? "—"}
                      </td> */}
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-700 min-w-0 max-w-[140px] lg:max-w-[180px]">
                        <span className="font-mono break-all">{row.mrn_uid ?? mrnUid ?? "—"}</span>
                      </td>
                      <td
                        className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-700 min-w-0 max-w-[140px] lg:max-w-[180px] truncate uppercase"
                        title={row.acc_name || ""}
                      >
                        {row.acc_name?.trim() || "—"}
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] font-bold text-slate-800 whitespace-nowrap tabular-nums">
                        {Number(row.qty ?? 0).toLocaleString()} {unit}
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                        <span
                          className={`text-[8px] font-black px-1 py-0.5 lg:px-1.5 lg:py-0.5 border whitespace-nowrap ${
                            isSa
                              ? "bg-violet-50 text-violet-800 border-violet-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {coilSourceLabel(row)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                        <span className="text-[9px] font-bold text-slate-600 uppercase whitespace-nowrap">
                          {coilStatusLabel(row, checked, readOnly, canSelect)}
                        </span>
                      </td>
                      {showMinusCol ? (
                        <td className="sticky right-0 z-10 py-1.5 px-2 lg:py-2 lg:px-3 text-center bg-white group-hover:bg-slate-50 border-l border-slate-100 align-middle transition-colors">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canSelect}
                            onChange={() => onToggle?.(row)}
                            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            aria-label={`Minus coil ${uid}`}
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
