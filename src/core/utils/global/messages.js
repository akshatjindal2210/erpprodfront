export const MODULE_DISABLED_MESSAGE = "This module is disabled.";
export const NO_ACCESS_MESSAGE = "You have no access.";

export const FLOW_SCAN_REJECTED_MSG = "This scan couldn't be verified. Try again or enter the code manually.";

export const FLOW_SCAN_CAMERA_ERROR_MSG = "Could not access the camera. Check that a camera is connected and try again.";

export const FLOW_SCAN_CAMERA_INSECURE_MSG =
  "Camera access requires a secure connection (HTTPS). Please check your URL and try again.";

export const FLOW_SCAN_CAMERA_DENIED_MSG =
  "Camera access was blocked. In your browser, open this site's settings and set Camera to Allow (not “Ask every time”), then reload and tap Scan again. After Allow, the app will not ask again for about 30 days on this device.";

export const SCAN_SNACK_MSG = {
  REJECTED: FLOW_SCAN_REJECTED_MSG,
  CAMERA: FLOW_SCAN_CAMERA_ERROR_MSG,
  CAMERA_DENIED: FLOW_SCAN_CAMERA_DENIED_MSG,
  BOX_ADDED: (code) => `Scanned: ${String(code ?? "").trim()}`,
  BOX_DUPLICATE: (code) => `Already scanned: ${String(code ?? "").trim()}`,
  LOCATION_OK: "Location scanned successfully",
  AUDIT_LOCATION_VERIFIED: (loc) => `${String(loc ?? "").trim()} verified — scan boxes now`,
  BOX_SCANNED_TOTAL: (boxNoUid, totalScanned) => {
    const n = Number(totalScanned);
    const displayCount = Number.isFinite(n) && n >= 100 ? "100+" : String(totalScanned ?? 0);
    return `${boxNoUid} scanned · Total ${displayCount}`;
  },
  BOX_NOT_IN_NOTE: (boxId) => `Box ${boxId} was not found in this forwarding note.`,
  BOX_ALREADY_OUTWARD: (boxId) => `Box ${boxId} is already outward. It is not in stock.`,
  BOX_STOCK_ADJUSTMENT_OUT: (boxId) => `Box ${boxId} was removed via stock adjustment. It is not available for out entry.`,
  LOOKUP_FAILED: "Box lookup failed. Please try again.",
};
