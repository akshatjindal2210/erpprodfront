function parseDetails(raw) {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

export function resolveCoilTxTypeLabel(type, row, typeLabels = {}) {
  if (!type) return "—";
  return typeLabels[type] || String(type).replace(/_/g, " ");
}

const TYPE_BADGE_CLASSES = {
  sticker_create: "bg-emerald-50 text-emerald-700 border-emerald-100",
  sticker_delete: "bg-rose-50 text-rose-700 border-rose-100",
  inward_link: "bg-emerald-50 text-emerald-700 border-emerald-100",
  inward_unlink: "bg-rose-50 text-rose-700 border-rose-100",
  store_out: "bg-blue-50 text-blue-600 border-blue-100",
  store_out_revert: "bg-orange-50 text-orange-600 border-orange-100",
  qc_check_pass: "bg-emerald-50 text-emerald-700 border-emerald-100",
  qc_check_fail: "bg-rose-50 text-rose-700 border-rose-100",
  qc_reject: "bg-rose-50 text-rose-700 border-rose-100",
  qc_reject_revert: "bg-orange-50 text-orange-600 border-orange-100",
  stock_adjustment_add: "bg-emerald-50 text-emerald-700 border-emerald-100",
  stock_adjustment_minus: "bg-rose-50 text-rose-700 border-rose-100",
  stock_adjustment_add_revert: "bg-rose-50 text-rose-700 border-rose-100",
  stock_adjustment_minus_revert: "bg-emerald-50 text-emerald-700 border-emerald-100",
  consume: "bg-rose-50 text-rose-700 border-rose-100",
  consume_revert: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

export function getCoilTxTypeBadgeClass(type) {
  return TYPE_BADGE_CLASSES[type] || "bg-slate-50 text-slate-600 border-slate-100";
}

export function getCoilStickerChipClass() {
  return "text-slate-700 bg-slate-50 ring-1 ring-inset ring-slate-200";
}

export { parseDetails };
