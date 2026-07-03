import { useCallback } from "react";
import { playScanSuccessBeep } from "@/features/apps/ims/helpers/scanFeedback";

export const SCAN_SNACK_DUR = { short: 3200, med: 4000, long: 5200 };

/** Scan snackbar: success = green, everything else (duplicate, invalid, fail) = red */
function levelToVariant(level) {
  return level === "success" ? "success" : "error";
}

function toastDuration(cooldownMs = 1800) {
  return Math.max(
    SCAN_SNACK_DUR.short,
    Math.min(SCAN_SNACK_DUR.long, (cooldownMs || 1800) + 2400)
  );
}

export function buildScanSnackbarState(level, message, cooldownMs = 1800) {
  return {
    open: true,
    variant: levelToVariant(level),
    title: "",
    message: message ?? "",
    duration: toastDuration(cooldownMs),
  };
}

export function useScanSnackbarActions(setSnackbar, scanToastRef) {
  const showScanToast = useCallback(
    (level, dedupeKey, message, cooldownMs = 1800) => {
      const now = Date.now();
      if (dedupeKey) {
        const last = scanToastRef.current[dedupeKey] || 0;
        if (now - last < cooldownMs) return;
        scanToastRef.current[dedupeKey] = now;
      }
      if (level === "success") {
        void playScanSuccessBeep();
      }
      setSnackbar(buildScanSnackbarState(level, message, cooldownMs));
    },
    [setSnackbar, scanToastRef]
  );

  const showScanSuccess = useCallback(
    (dedupeKey, message, cooldownMs = 1200) => {
      showScanToast("success", dedupeKey, message, cooldownMs);
    },
    [showScanToast]
  );

  return { showScanToast, showScanSuccess };
}

/** After a successful scan, suppress duplicate toasts for this window (camera re-read). */
export const SCAN_DUPLICATE_SILENT_MS = 4000;

function scanCodeKey(code) {
  return String(code ?? "").trim().toLowerCase();
}

export function markRecentScanSuccess(recentSuccessRef, code) {
  const key = scanCodeKey(code);
  if (key) recentSuccessRef.current.set(key, Date.now());
}

export function shouldSilenceScanDuplicate(recentSuccessRef, code) {
  const key = scanCodeKey(code);
  if (!key) return false;
  const at = recentSuccessRef.current.get(key);
  if (at == null) return false;
  return Date.now() - at < SCAN_DUPLICATE_SILENT_MS;
}

/** Rapid camera re-read — first decode already handled; ignore silently. */
export function notifyDecodeSuppressedScan() {}

