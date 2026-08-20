"use client";

import { Loader2, QrCode, ScanLine, X } from "lucide-react";

import { coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { OK_INPUT } from "@/ui/common/Constants";
import { getScanInputPlaceholder } from "@/platform/utils/device/deviceScanSettings";

/** Store In — Store Out jaisa scanned coil list (sirf coil + details). */
export default function StoreInRequestForm({
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
  scanBtnFill = "w-full",
  laserActive = false,
}) {
  const scannedQty = coils.reduce(
    (s, c) => s + (Number(c.original_qty ?? c.qty) || 0),
    0
  );

  const scanControls = !readOnly && (coils.length === 0 || isEdit) ? (
    <div className="space-y-2 p-1.5 bg-white border border-indigo-100 rounded-lg w-full min-w-0">
      {(showPhoneQr || showLaserUi) && (
        <div className="flex items-stretch gap-2 w-full min-w-0">
          {showPhoneQr && (
            <button
              type="button"
              onClick={onStartCamera}
              disabled={isScannerOpen || validatingCoil}
              className={`h-9 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
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
  ) : null;

  return (
    <div className="space-y-2">
      {scanControls}
      {errors.scan ? (
        <p className="text-[10px] font-bold text-rose-600 px-0.5">{errors.scan}</p>
      ) : null}

      <div className="bg-white/60 rounded-lg border border-indigo-50 overflow-hidden">
        <div className="px-3 py-1.5 bg-indigo-100/50 border-b border-indigo-100 flex justify-between items-center">
          <span className="text-[10px] font-bold text-indigo-600 uppercase">Scanned Item List</span>
          <span className="text-[9px] font-black text-indigo-600/50 uppercase tracking-tighter">
            Coils: {coils.length} · Qty: {scannedQty.toLocaleString()}
          </span>
        </div>
        <div className="max-h-[min(40dvh,280px)] overflow-y-auto overscroll-y-contain p-2 custom-scrollbar">
          {coils.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {coils.map((c) => (
                <div
                  key={c.coil_no_uid}
                  className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between shadow-sm hover:border-emerald-300 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black bg-emerald-100 text-emerald-600 shrink-0">
                      C
                    </div>
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="text-[11px] font-mono font-black text-slate-700 truncate">
                        {coilUidDisplayLabel(c.coil_no_uid) || c.coil_no_uid}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase truncate">
                        Qty {c.original_qty ?? c.qty ?? 0}
                        {c.item_code ? ` · ${c.item_code}` : ""}
                        {c.heat_no ? ` · ${c.heat_no}` : ""}
                      </span>
                    </div>
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => onRemoveCoil?.(c.coil_no_uid)}
                      title="Remove from scan list"
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-300">
              <ScanLine size={24} className="mx-auto opacity-20 mb-2" />
              <p className="text-[9px] font-bold uppercase tracking-wide">Ready for scanning</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
