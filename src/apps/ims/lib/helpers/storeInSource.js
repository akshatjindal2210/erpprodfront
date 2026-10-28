/** Store In → Pending list SOURCE values (keep in sync with backend `boxSourceSql`). */

export const STORE_IN_SOURCE = {
  TRAY_PENDING: "TRAY PENDING",
  TRAY_LINKED: "TRAY LINKED",
  PACKING_ENTRY: "PACKING ENTRY",
  STOCK_ADJUSTMENT: "STOCK ADJUSTMENT",
  QC_HOLD: "QC HOLD",
};

export function normalizeStoreInSource(value) {
  const s = String(value ?? "").trim().toUpperCase();
  if (s === "MANAGE TRAY") return STORE_IN_SOURCE.TRAY_PENDING;
  return s;
}

export function isStoreInTrayPendingSource(row) {
  return normalizeStoreInSource(row?.source) === STORE_IN_SOURCE.TRAY_PENDING;
}
