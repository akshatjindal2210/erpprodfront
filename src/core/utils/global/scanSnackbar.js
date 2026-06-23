import { useCallback } from "react";
import { playScanSuccessBeep } from "@/features/apps/ims/helpers/scanFeedback";
import { parseBoxScanRaw } from "@/features/apps/ims/helpers/qrScan";
import { SCAN_SNACK_MSG } from "./messages";

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

/** Toast when the QR scanner hook suppresses a rapid re-decode of the same code. */
export function notifyDecodeSuppressedScan(showScanToast, decodedText, dedupePrefix = "scanner-cooldown") {
  const raw = String(decodedText ?? "").trim();
  if (!raw) {
    showScanToast("error", `${dedupePrefix}-empty`, SCAN_SNACK_MSG.REJECTED, 1200);
    return;
  }
  const code = parseBoxScanRaw(raw) || raw;
  showScanToast(
    "error",
    `${dedupePrefix}-${String(code).toLowerCase()}`,
    SCAN_SNACK_MSG.BOX_DUPLICATE(code),
    1200
  );
}

