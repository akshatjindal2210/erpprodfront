export const STICKER_DOWNLOAD_SOURCE_KEYS = {
  sticker_creation: "sticker_creation",
  customer_override: "customer_override",
  stock_adjustment: "stock_adjustment",
  qc_hold_material: "qc_hold_material",
  mrn_sticker_render: "mrn_sticker_render",
  mrn_sticker_render_bulk: "mrn_sticker_render_bulk",
  mrn_sticker_render_batch_qc: "mrn_sticker_render_batch_qc",
  unknown: "unknown",
};

const LABELS = {
  sticker_creation: "Sticker creation",
  customer_override: "Customer override",
  stock_adjustment: "Stock adjustment",
  qc_hold_material: "QC Hold",
  mrn_sticker_render: "MRN sticker print",
  mrn_sticker_render_qc: "MRN QC sticker print",
  mrn_sticker_render_bulk: "MRN bulk print",
  mrn_sticker_render_bulk_qc: "MRN bulk QC print",
  mrn_sticker_render_batch_qc: "MRN batch QC print",
  unknown: "Other / legacy",
};

export function labelStickerDownloadSource(key) {
  if (key == null || String(key).trim() === "") return LABELS.unknown;
  const k = String(key).trim().toLowerCase();
  if (LABELS[k]) return LABELS[k];
  if (k.startsWith("mrn_sticker")) return "MRN sticker print";
  return String(key);
}
