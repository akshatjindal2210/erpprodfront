"use client";

import { useRef } from "react";
import { ScanLine } from "lucide-react";
import { useLaserScanCapture } from "@/platform/hooks/scan/useLaserScanCapture";

/**
 * Laser capture — invisible input (no soft keyboard). Default: Scan button only.
 * requireArmButton false → hidden capture only (Finder + keyboard/QR row).
 */
export default function LaserScanField({
  active,
  onScanned,
  keyboardInputRef,
  className = "",
  heightClass = "h-10 sm:h-9",
  placeholder = "Ready to scan",
  idlePlaceholder = "Tap Scan, then use scanner",
  bannerClassName = "",
  compact = false,
  formatPreview,
  requireArmButton = true,
  showPreview = false,
  armButtonLabel = "Scan",
  fill = false,
  autoArmOnActive = true,
  onBeforeArm,
  onScanRejected,
}) {
  const rootRef = useRef(null);
  const {
    scanPreview,
    armed,
    armScan,
    disarmScan,
    setLaserInputRef,
    lockLaserInput,
    handleLaserKeyDown,
    handleLaserChange,
  } = useLaserScanCapture(active, onScanned, {
    keyboardInputRef,
    formatPreview,
    requireArmToCapture: requireArmButton,
    showPreview,
    autoArmOnActive: requireArmButton && autoArmOnActive,
    rootRef,
    onScanRejected,
  });

  const toggleArm = () => {
    if (armed) {
      disarmScan();
      return;
    }
    onBeforeArm?.();
    armScan();
  };

  const armBtnClass = (extra = "") =>
    `inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed ${extra} ${
      armed
        ? "bg-emerald-600 border-emerald-700 text-white ring-2 ring-emerald-200"
        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  const captureReady = !requireArmButton || armed;

  const captureInput = (
    <input
      ref={setLaserInputRef}
      type="text"
      aria-label="Laser scanner capture"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      readOnly={requireArmButton && !armed}
      tabIndex={captureReady ? 0 : -1}
      onKeyDown={handleLaserKeyDown}
      onChange={handleLaserChange}
      onMouseDown={(e) => {
        if (requireArmButton && !armed) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
      }}
      onTouchStart={(e) => {
        if (requireArmButton && !armed) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
      }}
      onFocus={(e) => {
        if (requireArmButton && !armed) {
          e.currentTarget.blur();
          return;
        }
        lockLaserInput(e.currentTarget);
      }}
      onBlur={(e) => lockLaserInput(e.currentTarget)}
      className={
        showPreview
          ? "absolute inset-0 w-full h-full opacity-0 cursor-default caret-transparent"
          : "fixed left-0 top-1/2 w-px h-px -translate-y-1/2 opacity-0 overflow-hidden -z-10 border-0 p-0 m-0"
      }
    />
  );

  if (showPreview) {
    const displayPad = compact ? "pl-8 pr-3" : "pl-10 pr-4";
    const iconLeft = compact ? "left-2.5" : "left-3";
    const textSize = compact ? "text-[11px]" : "text-sm";
    const displayPlaceholder = captureReady ? placeholder : idlePlaceholder;

    return (
      <div ref={rootRef} className={`flex items-stretch gap-2 min-w-0 ${className}`}>
        {requireArmButton ? (
          <button
            type="button"
            onClick={toggleArm}
            disabled={!active}
            className={`shrink-0 ${armBtnClass(compact ? `px-2.5 text-[10px] ${heightClass}` : `px-3 text-xs ${heightClass}`)}`}
            aria-pressed={armed}
          >
            <ScanLine size={compact ? 14 : 16} className="shrink-0" aria-hidden />
            {armButtonLabel}
          </button>
        ) : null}
        <div className={`relative flex-1 min-w-0 ${heightClass}`}>
          <div
            aria-hidden
            className={`absolute inset-0 ${displayPad} border rounded-lg flex items-center pointer-events-none select-none ${bannerClassName} bg-emerald-50 border-emerald-200`}
          >
            <span className={`${textSize} font-mono text-slate-800 truncate w-full`}>
              {scanPreview || displayPlaceholder}
            </span>
          </div>
          {captureInput}
        </div>
      </div>
    );
  }

  const stretchClass = fill ? "flex flex-1 basis-0 min-w-0" : "inline-flex shrink-0";
  const btnStretchClass = fill ? "w-full" : "";

  if (requireArmButton) {
    return (
      <div ref={rootRef} className={`${stretchClass} ${className}`}>
        <button
          type="button"
          onClick={toggleArm}
          disabled={!active}
          className={armBtnClass(`${btnStretchClass} ${compact ? "px-2.5 text-[10px]" : "px-3 text-[11px]"} ${heightClass} min-w-[4.25rem]`)}
          aria-pressed={armed}
        >
          <ScanLine size={compact ? 14 : 16} className="shrink-0" aria-hidden />
          {armButtonLabel}
        </button>
        {captureInput}
      </div>
    );
  }

  return <div className={className}>{captureInput}</div>;
}
