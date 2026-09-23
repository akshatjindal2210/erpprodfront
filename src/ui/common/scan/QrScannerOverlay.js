"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const closingRef = useRef(false);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onClose?.();
    window.setTimeout(() => {
      closingRef.current = false;
    }, 450);
  }, [onClose]);

  useEscapeKey(requestClose, open);
  const deviceOk = allowDesktop || isMobileDevice();
  if (!open || !deviceOk || !mounted) return null;

  const stopPointerBubble = (e) => {
    e.stopPropagation();
  };

  const handleCloseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    requestClose();
  };

  const content = (
    <div
      className={`fixed inset-0 ${zIndexClass} bg-slate-900/85 backdrop-blur-[1px] flex flex-col items-center justify-center p-4`}
      style={{ zIndex: 4000 }}
      role="dialog"
      aria-modal="true"
      aria-label="QR scanner"
      data-qr-scanner-overlay="true"
      onPointerDown={stopPointerBubble}
    >
      <div className="relative z-10 w-full max-w-md pointer-events-auto">
        <div className="relative z-20 mb-2 flex items-center justify-between gap-3">
          {torchSupported ? (
            <button
              type="button"
              onPointerDown={stopPointerBubble}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await onToggleTorch?.();
              }}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white transition-all touch-manipulation ${
                torchOn ? "bg-amber-500/90 hover:bg-amber-500" : "bg-black/35 hover:bg-black/50"
              }`}
              title={torchOn ? "Turn flash off" : "Turn flash on"}
              aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
              aria-pressed={torchOn}
            >
              {torchOn ? <Flashlight size={20} /> : <FlashlightOff size={20} />}
            </button>
          ) : (
            <span aria-hidden className="min-w-[44px]" />
          )}

          <button
            type="button"
            onPointerDown={stopPointerBubble}
            onClick={handleCloseClick}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-black/35 hover:bg-black/50 rounded-full text-white transition-all touch-manipulation"
            title="Close scanner"
            aria-label="Close scanner"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className={`relative z-0 rounded-2xl overflow-hidden bg-black aspect-square shadow-xl animate-in zoom-in-95 duration-300 ${frameClassName}`}
        >
          <div
            id={readerId}
            className="w-full h-full [&_*]:pointer-events-none [&_video]:h-full [&_video]:object-cover"
          />
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
