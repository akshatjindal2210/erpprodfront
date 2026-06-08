"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscapeKey } from "@/core/hooks/useEscapeKey";
import { isMobileDevice } from "@/core/utils/pwa";

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
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEscapeKey(onClose, open);
  if (!open || !isMobileDevice() || !mounted) return null;

  const content = (
    <div
      className={`fixed inset-0 ${zIndexClass} bg-slate-900/85 backdrop-blur-[1px] flex flex-col items-center justify-center p-4`}
      role="dialog"
      aria-modal="true"
      aria-label="QR scanner"
    >
      <div className="w-full max-w-md relative">
        <div className="absolute top-3 right-3 z-[210]">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            className="p-2 bg-black/35 hover:bg-black/50 rounded-full text-white transition-all"
            title="Close scanner"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className={`relative rounded-2xl overflow-hidden bg-black aspect-square shadow-xl animate-in zoom-in-95 duration-300 ${frameClassName}`}
        >
          <div id={readerId} className="w-full h-full [&_video]:h-full [&_video]:object-cover" />
          <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40" />
        </div>

        <div className="text-center mt-3 z-[210]">
          <p className="text-white/85 text-[10px] font-black uppercase tracking-widest bg-black/30 inline-block px-4 py-2 rounded-full">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
