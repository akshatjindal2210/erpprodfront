import { useCallback } from "react";
import { playScanSuccessBeep } from "@/features/apps/ims/helpers/scanFeedback";

export const SCAN_SNACK_DUR = { short: 3200, med: 4000, long: 5200 };

function levelToVariant(level) {
  if (level === "error") return "danger";
  if (level === "warning") return "warning";
  if (level === "info") return "info";
  return "success";
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

