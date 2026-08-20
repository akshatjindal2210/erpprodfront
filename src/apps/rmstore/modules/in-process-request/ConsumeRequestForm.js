"use client";

import { useMemo } from "react";
import { Loader2, QrCode, ScanLine, X } from "lucide-react";

import { coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { OK_INPUT } from "@/ui/common/Constants";
import { getScanInputPlaceholder } from "@/platform/utils/device/deviceScanSettings";

/** Consume — IMS-style scan panel + scanned coil grid. Toggle per coil for partial used qty. */
export default function ConsumeRequestForm({
  readOnly = false,
  isEdit = false,
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
  onPartialToggle,
  onUsedQtyChange,
  scanBtnFill = "w-full",
  laserActive = false,
}) {
  const totalIssued = useMemo(
    () => coils.reduce((s, c) => s + (Number(c.original_qty ?? c.qty) || 0), 0),
    [coils]
  );
  const totalUsed = useMemo(
    () =>
      coils.reduce(
        (s, c) => s + (Number(c.consumed_qty ?? c.original_qty ?? c.qty) || 0),
        0
      ),
    [coils]
  );

  return (
    <div className="space-y-2">
      {!readOnly && (coils.length === 0 || isEdit) ? (
        <div className="space-y-2 bg-indigo-50/30 p-2 rounded-lg border border-indigo-100 shadow-sm">
          <div className="space-y-2 p-1.5 bg-white border border-indigo-100 rounded-lg w-full min-w-0">
            {coils.length === 0 ? (
              <p className="text-[9px] font-semibold text-indigo-800/80 px-0.5 leading-snug">
                Scan issued coils and record used qty. Full coil use = full qty consumed. Partial use →
                balance auto-queues in Store In Pending.
              </p>
            ) : null}
            {(showPhoneQr || showLaserUi) && (
              <div className="flex items-stretch gap-2 w-full min-w-0">
                {showPhoneQr && (
                  <button
                    type="button"
                    onClick={onStartCamera}
                    disabled={isScannerOpen || validatingCoil}
                    className={`h-9 px-3 bg-indigo-600 border border-indigo-700 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
                  >
                    <QrCode size={14} />
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
                  className="h-9 px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase shrink-0 disabled:opacity-50"
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

      <div className="bg-white/60 rounded-lg border border-indigo-50 overflow-hidden">
        <div className="px-3 py-1.5 bg-indigo-100/50 border-b border-indigo-100 flex justify-between items-center gap-2">
          <span className="text-[10px] font-bold text-indigo-600 uppercase">Scanned coils</span>
          <span className="text-[9px] font-black text-indigo-600/50 uppercase tracking-tighter shrink-0">
            {coils.length} total · qty {totalUsed.toLocaleString()}
            {totalUsed !== totalIssued && totalIssued > 0
              ? ` / ${totalIssued.toLocaleString()}`
              : ""}
          </span>
        </div>
        <div className="max-h-[min(40dvh,280px)] overflow-y-auto overscroll-y-contain p-2 custom-scrollbar">
          {coils.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {coils.map((c) => {
                const issued = Number(c.original_qty ?? c.qty) || 0;
                const partial = Boolean(c.partial_qty);
                const used = Number(c.consumed_qty ?? issued) || 0;
                const balance = Math.max(0, issued - used);
                return (
                  <div
                    key={c.coil_no_uid}
                    className={`bg-white p-2 rounded-lg border flex flex-col gap-2 shadow-sm transition-all ${partial ? "border-indigo-200 hover:border-indigo-300" : "border-emerald-100 hover:border-emerald-300"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0">
                          C
                        </div>
                        <div className="flex flex-col leading-tight min-w-0">
                          <span className="text-[11px] font-mono font-black text-slate-700 truncate">
                            {coilUidDisplayLabel(c.coil_no_uid)}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase truncate">
                            MRN {c.mrn_no ?? "—"} · Qty: {issued.toLocaleString()}
                            {c.out_uid != null ? ` · OUT-${c.out_uid}` : ""}
                            {c.item_code ? ` · ${c.item_code}` : ""}
                          </span>
                        </div>
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={() => onRemoveCoil?.(c.coil_no_uid)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 transition-all"
                          aria-label="Remove coil"
                        >
                          <X size={16} />
                        </button>
                      ) : null}
                    </div>

                    {!readOnly ? (
                      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
                        <label
                          className={`inline-flex items-center gap-2 shrink-0 ${
                            readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={partial}
                            disabled={readOnly}
                            onChange={(e) => onPartialToggle?.(c.coil_no_uid, e.target.checked)}
                            className="sr-only peer"
                          />
                          <span
                            className={`relative w-9 h-5 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform ${
                              partial
                                ? "bg-indigo-500 after:translate-x-4"
                                : "bg-slate-300"
                            }`}
                          />
                          <span className="text-[8px] font-bold uppercase text-slate-500">Left Over</span>
                        </label>
                        {partial ? (
                          <input
                            type="number"
                            min={0}
                            max={issued}
                            step="any"
                            value={Number.isFinite(used) ? used : ""}
                            onChange={(e) => onUsedQtyChange?.(c.coil_no_uid, e.target.value)}
                            placeholder="Used qty"
                            className={`${OK_INPUT} h-8 w-24 text-[11px] tabular-nums`}
                          />
                        ) : (
                          <span className="text-[8px] font-bold uppercase text-emerald-600">Full Consume</span>
                        )}
                      </div>
                    ) : partial || used < issued ? (
                      <div className="pt-1 border-t border-slate-100 text-[8px] font-bold uppercase text-slate-500">
                        Used{" "}
                        <span className="text-indigo-700 tabular-nums">{used.toLocaleString()}</span>
                        {balance > 0 ? (
                          <span className="text-slate-400 font-semibold normal-case">
                            {" "}
                            · {balance.toLocaleString()} → Store In Pending on submit
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-slate-200">
                <ScanLine size={32} className="opacity-20" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest">Ready for scanning</p>
              <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Scan shop-floor coils</p>
            </div>
          )}
        </div>
      </div>

      {errors.qty ? (
        <p className="text-[10px] font-bold text-rose-600 px-0.5">{errors.qty}</p>
      ) : null}
    </div>
  );
}
