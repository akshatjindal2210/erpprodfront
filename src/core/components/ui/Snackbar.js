"use client";

import { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FADE_MS = 480;

/** W3Schools-style snackbar: #333 band, centred, slide + fade; `duration` is total wall time (~full opacity + fade out). */
export default function Snackbar({
  open,
  variant: _variant,
  title = "",
  message = "",
  duration = 3500,
  onClose,
}) {
  void _variant;

  const innerRef = useRef(null);
  const hideAfterAnimRef = useRef(null);
  const autoDismissRef = useRef(null);

  const clearAutoDismiss = () => {
    if (autoDismissRef.current !== null) {
      window.clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
  };

  const clearHideAfterAnim = () => {
    if (hideAfterAnimRef.current !== null) {
      window.clearTimeout(hideAfterAnimRef.current);
      hideAfterAnimRef.current = null;
    }
  };

  const runHideAnimationThenClose = useCallback(() => {
    if (!onClose) return;
    const inner = innerRef.current;
    if (!inner) {
      onClose();
      return;
    }
    inner.classList.remove("app-snackbar-banner--show");
    inner.classList.add("app-snackbar-banner--hide");
    clearHideAfterAnim();
    hideAfterAnimRef.current = window.setTimeout(() => {
      hideAfterAnimRef.current = null;
      onClose();
    }, FADE_MS);
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = innerRef.current;
    if (!el) return;
    el.classList.remove("app-snackbar-banner--hide");
    el.classList.add("app-snackbar-banner--show");
  }, [open, message]);

  useEffect(() => {
    if (!open || !onClose) return undefined;
    clearAutoDismiss();

    if (duration <= 0) {
      autoDismissRef.current = window.setTimeout(() => runHideAnimationThenClose(), 0);
    } else {
      const fadeDelay = Math.max(200, duration - FADE_MS);
      autoDismissRef.current = window.setTimeout(() => {
        autoDismissRef.current = null;
        runHideAnimationThenClose();
      }, fadeDelay);
    }

    return () => {
      clearAutoDismiss();
      clearHideAfterAnim();
    };
  }, [open, duration, message, onClose, runHideAnimationThenClose]);

  if (typeof document === "undefined" || !open) return null;

  const showTitle = Boolean(String(title || "").trim());

  const inner = (
    <div
      ref={innerRef}
      role="alert"
      aria-live="polite"
      className="app-snackbar-banner--show pointer-events-auto fixed bottom-[30px] left-1/2 z-[1200] min-h-[54px] w-[min(calc(100vw-32px),28rem)] min-w-[min(250px,calc(100vw-32px))] rounded-[2px] bg-[#333] px-4 py-4 pr-12 text-center text-[17px] leading-snug text-white shadow-lg"
    >
      <button
        type="button"
        onClick={() => {
          clearAutoDismiss();
          runHideAnimationThenClose();
        }}
        className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Dismiss"
      >
        <X size={20} strokeWidth={2} />
      </button>
      {showTitle ? (
        <div className="-mx-1">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-white/90">{title}</p>
          <p className="mt-2 break-words">{message}</p>
        </div>
      ) : (
        <p className="break-words">{message}</p>
      )}
    </div>
  );

  return createPortal(inner, document.body);
}
