"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Center modal shell — portals to body with data-app-overlay-root for global focus trap. */
export default function OverlayModal({
  open,
  children,
  className = "",
  zIndex = 1100,
  onBackdropClick,
  backdropClassName = "absolute inset-0 bg-slate-900/40 backdrop-blur-sm",
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      data-app-overlay-root
      className={`fixed inset-0 flex items-center justify-center p-4 ${className}`}
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
    >
      {onBackdropClick ? (
        <div role="presentation" className={backdropClassName} onClick={onBackdropClick} />
      ) : null}
      {children}
    </div>,
    document.body
  );
}
