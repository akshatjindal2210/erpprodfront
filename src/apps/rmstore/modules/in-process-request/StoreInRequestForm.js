"use client";

import { useMemo } from "react";
import { Loader2, Plus, ScanLine, X } from "lucide-react";

import { coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { OK_INPUT } from "@/ui/common/Constants";
import { getScanInputPlaceholder } from "@/platform/utils/device/deviceScanSettings";

/**
 * Store-in Request body.
 * Issued coil qty is a read-only snapshot — never mutated.
 * User records consumed vs return lines for a new Store In request.
 */
export default function StoreInRequestForm({
  readOnly = false,
  coils = [],
  proposedCoils = [],
  errors = {},
  manualCoilId = "",
  setManualCoilId,
  validatingCoil = false,
  showPhoneQr = false,
  showLaserUi = false,
  keyboardType = false,
  isScannerOpen = false,
  onStartCamera,
  onLaserScan,
  onLaserRejected,
  onAddManual,
  onRemoveCoil,
  onRemainingChange,
  onAddProposedLine,
  onProposedQtyChange,
  onRemoveProposed,
  scanBtnFill = "w-full",
  laserActive = false,
}) {
  const issuedQty = useMemo(
    () => coils.reduce((s, c) => s + (Number(c.original_qty ?? c.qty) || 0), 0),
    [coils]
  );
  const returnQty = useMemo(
    () => proposedCoils.reduce((s, c) => s + (Number(c.qty) || 0), 0),
    [proposedCoils]
  );
  const consumedQty = Math.max(0, issuedQty - returnQty);
  const avgPerCoil = coils.length ? issuedQty / coils.length : 0;
  const issuedHint =
    coils.length > 0
      ? `${coils.length} × ${Number(avgPerCoil).toLocaleString()} ≈ ${issuedQty.toLocaleString()}`
      : "—";

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-2.5 text-[10px] text-teal-900 leading-snug space-y-1">
        <p>
          Scan the coils that were <span className="font-bold">issued to the machine</span>. For example:{" "}
          <span className="font-bold">100 × 5 = 500 kg</span> issued and <span className="font-bold">350 kg</span>{" "}
          used, so the remainder is returned using proposed lines.
        </p>
        <p className="font-bold text-teal-800">
          The issued quantity is kept as history only. Existing coil and issue quantities are never changed.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
          <div className="text-[8px] font-bold uppercase text-slate-500">Issued (snapshot)</div>
          <div className="text-sm font-black tabular-nums text-slate-800">
            {issuedQty.toLocaleString()}
          </div>
          <div className="text-[8px] text-slate-400 font-medium truncate px-0.5">{issuedHint}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
          <div className="text-[8px] font-bold uppercase text-amber-700">Used</div>
          <div className="text-sm font-black tabular-nums text-amber-800">
            {consumedQty.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-2">
          <div className="text-[8px] font-bold uppercase text-teal-700">Return → Store In</div>
          <div className="text-sm font-black tabular-nums text-teal-800">
            {returnQty.toLocaleString()}
          </div>
        </div>
      </div>

      {!readOnly ? (
        <div className="space-y-2 bg-teal-50/30 p-2 rounded-lg border border-teal-100 shadow-sm">
          <div className="space-y-2 p-1.5 bg-white border border-teal-100 rounded-lg w-full min-w-0">
            {(showPhoneQr || showLaserUi) && (
              <div className="flex items-stretch gap-2 w-full min-w-0">
                {showPhoneQr && (
                  <button
                    type="button"
                    onClick={onStartCamera}
                    disabled={isScannerOpen || validatingCoil}
                    className={`h-9 px-3 bg-teal-600 border border-teal-700 hover:bg-teal-700 text-white rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
                  >
                    <ScanLine size={14} />
                    <span className="text-[10px] font-black uppercase">QR</span>
                  </button>
                )}
                {showLaserUi && (
                  <LaserScanField
                    active={laserActive}
                    onScanned={onLaserScan}
                    onScanRejected={onLaserRejected}
                    formatPreview={coilUidDisplayLabel}
                    compact
                    heightClass="h-9"
                    fill
                    armButtonLabel="Scan"
                    placeholder={getScanInputPlaceholder("coil")}
                  />
                )}
              </div>
            )}
            {keyboardType ? (
              <div className="flex w-full min-w-0 gap-1.5">
                <input
                  type="text"
                  value={manualCoilId}
                  onChange={(e) => setManualCoilId?.(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onAddManual?.();
                    }
                  }}
                  placeholder="Enter or paste a coil UID"
                  className={`${OK_INPUT} flex-1 min-w-0 font-mono`}
                />
                <button
                  type="button"
                  disabled={validatingCoil}
                  onClick={() => onAddManual?.()}
                  className="h-9 px-3 bg-teal-600 text-white rounded-lg text-[10px] font-bold uppercase shrink-0 disabled:opacity-50"
                >
                  {validatingCoil ? <Loader2 size={14} className="animate-spin" /> : "Add"}
                </button>
              </div>
            ) : !showPhoneQr && !showLaserUi ? (
              <p className="text-[10px] text-slate-500 px-1">Enable scan mode in Settings.</p>
            ) : null}
          </div>
          {errors.scan ? (
            <p className="text-[10px] font-bold text-rose-600 px-0.5">{errors.scan}</p>
          ) : null}
        </div>
      ) : null}

      {/* Issued snapshot — read-only history */}
      <div className="bg-white/60 rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-3 py-1.5 border-b bg-slate-100/80 border-slate-200 flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase text-slate-700">
            Issued coils (history, not updated)
          </span>
          <span className="text-[9px] font-black uppercase text-slate-500">
            {coils.length} coils · qty {issuedQty.toLocaleString()}
          </span>
        </div>
        <div className="max-h-[min(32dvh,220px)] overflow-y-auto p-2 custom-scrollbar space-y-1.5">
          {coils.length ? (
            coils.map((c) => {
              const issued = Number(c.original_qty ?? c.qty) || 0;
              const returnForCoil =
                c.remaining_qty != null ? Number(c.remaining_qty) : issued;
              const used = Math.max(0, issued - returnForCoil);
              return (
                <div
                  key={c.coil_no_uid}
                  className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono font-black text-slate-700 truncate">
                        {coilUidDisplayLabel(c.coil_no_uid)}
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase truncate">
                        MRN {c.mrn_no ?? "—"} · Issued {issued.toLocaleString()}
                        {c.item_code ? ` · ${c.item_code}` : ""}
                      </div>
                    </div>
                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={() => onRemoveCoil?.(c.coil_no_uid)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[8px] font-bold uppercase text-slate-500">Issued</span>
                      <div className="text-[11px] font-black tabular-nums text-slate-700 mt-0.5">
                        {issued.toLocaleString()}
                      </div>
                    </div>
                    <label className="block min-w-0">
                      <span className="text-[8px] font-bold uppercase text-teal-700">
                        Return Qty
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        disabled={readOnly}
                        value={Number.isFinite(returnForCoil) ? returnForCoil : ""}
                        onChange={(e) =>
                          onRemainingChange?.(c.coil_no_uid, e.target.value)
                        }
                        className={`${OK_INPUT} mt-0.5 h-8 text-[11px] tabular-nums`}
                      />
                    </label>
                    <div className="flex flex-col justify-end pb-0.5">
                      <span className="text-[8px] font-bold uppercase text-amber-700">Used</span>
                      <span className="text-[11px] font-black tabular-nums text-amber-700">
                        {used.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300 py-8">
              <ScanLine size={28} className="opacity-20 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">Scan issued coils</p>
            </div>
          )}
        </div>
      </div>

      {/* Proposed return lines for Store In */}
      <div className="bg-white/60 rounded-lg border border-teal-200 overflow-hidden">
        <div className="px-3 py-1.5 border-b bg-teal-50 border-teal-100 flex justify-between items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-teal-800">
            Proposed return (new Store In lines)
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-teal-700/70">
              {proposedCoils.length} lines · qty {returnQty.toLocaleString()}
            </span>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => onAddProposedLine?.()}
                className="h-7 px-2 inline-flex items-center gap-1 text-[9px] font-black uppercase text-teal-700 bg-white border border-teal-200 rounded-md hover:bg-teal-50"
              >
                <Plus size={12} /> Line
              </button>
            ) : null}
          </div>
        </div>
        <div className="max-h-[min(28dvh,200px)] overflow-y-auto p-2 custom-scrollbar space-y-1.5">
          {proposedCoils.length ? (
            proposedCoils.map((p) => (
              <div
                key={p.temp_id}
                className="bg-white p-2 rounded-lg border border-teal-100 flex items-center gap-2 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono font-bold text-slate-700 truncate">
                    {p.coil_no_uid
                      ? coilUidDisplayLabel(p.coil_no_uid)
                      : p.from_coil_uid
                        ? `From ${coilUidDisplayLabel(p.from_coil_uid)}`
                        : "New return line"}
                  </div>
                  <div className="text-[8px] text-slate-400 uppercase font-bold">
                    Created as a new line after approval; the original quantity is unchanged
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  disabled={readOnly}
                  value={Number.isFinite(Number(p.qty)) ? Number(p.qty) : ""}
                  onChange={(e) => onProposedQtyChange?.(p.temp_id, e.target.value)}
                  className={`${OK_INPUT} w-24 h-8 text-[11px] tabular-nums shrink-0`}
                />
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => onRemoveProposed?.(p.temp_id)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-[10px] text-slate-400 text-center py-6 font-medium">
              Set the return quantity on the issued coils, or add split lines such as 100 + 50.
            </p>
          )}
        </div>
      </div>

      {errors.proposed ? (
        <p className="text-[10px] font-bold text-rose-600 px-0.5">{errors.proposed}</p>
      ) : null}
    </div>
  );
}
