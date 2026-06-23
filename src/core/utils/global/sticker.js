export const STICKER_DOWNLOAD_SOURCE_KEYS = {
  sticker_creation: "sticker_creation",
  customer_override: "customer_override",
  stock_adjustment: "stock_adjustment",
  qc_hold_material: "qc_hold_material",
  unknown: "unknown",
};

const LABELS = {
  sticker_creation: "Sticker creation",
  customer_override: "Customer override",
  stock_adjustment: "Stock adjustment",
  qc_hold_material: "QC Hold",
  unknown: "Other / legacy",
};

export function labelStickerDownloadSource(key) {
  if (key == null || String(key).trim() === "") return LABELS.unknown;
  const k = String(key).trim().toLowerCase();
  return LABELS[k] || String(key);
}
