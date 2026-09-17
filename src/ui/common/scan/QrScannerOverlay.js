"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Flashlight, FlashlightOff } from "lucide-react";
import { useEscapeKey } from "@/platform/hooks/system/useEscapeKey";
import { isMobileDevice } from "@/platform/utils/pwa/pwa";

/**
 * Full-screen camera QR scanner shell (shared UI). Pair with `useHtml5QrScanner`.
 */
export default function QrScannerOverlay({
  open,
  onClose,
  readerId,
  hint = "Point camera at QR code",
  zIndexClass = "z-[2000]",
  frameClassName = "border-4 border-slate-100",
  torchSupported = false,
  torchOn = false,
  onToggleTorch,
  /** Allow webcam QR on desktop (e.g. tax-invoice bill scan). */
  allowDesktop = false,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEscapeKey(onClose, open);
  const deviceOk = allowDesktop || isMobileDevice();
  if (!open || !deviceOk || !mounted) return null;

  const closeScanner = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onClose?.();
  };

  const content = (
    <div
      className={`fixed inset-0 ${zIndexClass} bg-slate-900/85 backdrop-blur-[1px] flex flex-col items-center justify-center p-4`}
      style={{ zIndex: 4000 }}
      role="dialog"
      aria-modal="true"
      aria-label="QR scanner"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md">
        <div className="mb-2 flex items-center justify-between">
          {torchSupported ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await onToggleTorch?.();
              }}
              className={`p-2 rounded-full text-white transition-all ${
                torchOn ? "bg-amber-500/90 hover:bg-amber-500" : "bg-black/35 hover:bg-black/50"
              }`}
              title={torchOn ? "Turn flash off" : "Turn flash on"}
              aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
              aria-pressed={torchOn}
            >
              {torchOn ? <Flashlight size={20} /> : <FlashlightOff size={20} />}
            </button>
          ) : (
            <span aria-hidden />
          )}

          <button
            type="button"
            onPointerDown={closeScanner}
            onClick={closeScanner}
            className="p-2 bg-black/35 hover:bg-black/50 rounded-full text-white transition-all"
            title="Close scanner"
            aria-label="Close scanner"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className={`relative rounded-2xl overflow-hidden bg-black aspect-square shadow-xl animate-in zoom-in-95 duration-300 ${frameClassName}`}
        >
          <div id={readerId} className="w-full h-full [&_video]:h-full [&_video]:object-cover [&_video]:pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40" />
        </div>

        <div className="text-center mt-3">
          <p className="text-white/85 text-[10px] font-black uppercase tracking-widest bg-black/30 inline-block px-4 py-2 rounded-full">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
