"use client";

import { useMemo } from "react";
import { Loader2, ScanLine, X } from "lucide-react";

import { coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { OK_INPUT } from "@/ui/common/Constants";
import { getScanInputPlaceholder } from "@/platform/utils/device/deviceScanSettings";

/**
 * Store-in from machine — scan issued (out) coils, set return qty per coil, submit.
 * Issued qty is kept as history; used = issued − return; remainder goes back to Coil Area.
 */
export default function StoreInRequestForm({
  readOnly = false,
  coils = [],
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
  scanBtnFill = "w-full",
  laserActive = false,
}) {
  const issuedQty = useMemo(
    () => coils.reduce((s, c) => s + (Number(c.original_qty ?? c.qty) || 0), 0),
    [coils]
  );
  const returnQty = useMemo(
    () => coils.reduce((s, c) => s + (Number(c.remaining_qty ?? c.qty) || 0), 0),
    [coils]
  );
  const consumedQty = Math.max(0, issuedQty - returnQty);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-2.5 text-[10px] text-teal-900 leading-snug">
        Scan coils that were <span className="font-bold">issued out</span> to the machine. Set{" "}
        <span className="font-bold">Return Qty</span> for what comes back — e.g. issued 100 kg, return 50 kg →{" "}
        <span className="font-bold">50 kg consumed</span>, <span className="font-bold">50 kg store in</span>.
        Issued qty is saved as history on this request.
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
          <div className="text-[8px] font-bold uppercase text-slate-500">Issued</div>
          <div className="text-sm font-black tabular-nums text-slate-800">{issuedQty.toLocaleString()}</div>
          <div className="text-[8px] text-slate-400">{coils.length} coil(s)</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
          <div className="text-[8px] font-bold uppercase text-amber-700">Consumed</div>
          <div className="text-sm font-black tabular-nums text-amber-800">{consumedQty.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-2">
          <div className="text-[8px] font-bold uppercase text-teal-700">Store In</div>
          <div className="text-sm font-black tabular-nums text-teal-800">{returnQty.toLocaleString()}</div>
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

      <div className="bg-white/60 rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-3 py-1.5 border-b bg-slate-100/80 border-slate-200 flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase text-slate-700">Scanned coils</span>
          <span className="text-[9px] font-black uppercase text-slate-500">
            {coils.length} · {scannedQtyLabel(coils)}
          </span>
        </div>
        <div className="max-h-[min(40dvh,280px)] overflow-y-auto p-2 custom-scrollbar space-y-1.5">
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
                        {c.out_uid ? ` · OUT-${c.out_uid}` : ""}
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
                      <span className="text-[8px] font-bold uppercase text-teal-700">Return Qty</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        disabled={readOnly}
                        value={Number.isFinite(returnForCoil) ? returnForCoil : ""}
                        onChange={(e) => onRemainingChange?.(c.coil_no_uid, e.target.value)}
                        className={`${OK_INPUT} mt-0.5 h-8 text-[11px] tabular-nums`}
                      />
                    </label>
                    <div className="flex flex-col justify-end pb-0.5">
                      <span className="text-[8px] font-bold uppercase text-amber-700">Consumed</span>
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

      {errors.proposed ? (
        <p className="text-[10px] font-bold text-rose-600 px-0.5">{errors.proposed}</p>
      ) : null}
    </div>
  );
}

function scannedQtyLabel(coils) {
  const issued = coils.reduce((s, c) => s + (Number(c.original_qty ?? c.qty) || 0), 0);
  const ret = coils.reduce((s, c) => s + (Number(c.remaining_qty ?? c.qty) || 0), 0);
  return `issued ${issued.toLocaleString()} · return ${ret.toLocaleString()}`;
}
