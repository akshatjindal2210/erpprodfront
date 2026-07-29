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

const OUT_DISPATCH_TYPES = new Set(["out_link"]);

function normalizeBoxTxType(type) {
  if (type === "audit_adjust_remove") return "audit_missing";
  if (type === "audit_adjust_add" || type === "audit_adjust_relocate") return "audit_extra";
  return type;
}

const ADD_TYPES = new Set([
  "packing_create",
  "inward_link",
  "sa_stock_in",
  "out_unlink",
  "out_other_return_to_packing",
  "out_qc_area_release",
  "audit_extra",
  "qc_hold_complete",
]);

const HOLD_TYPES = new Set(["qc_hold_apply"]);

const REMOVE_TYPES = new Set([
  "packing_delete",
  "inward_unlink",
  "sa_stock_out",
  "sa_delete",
  "box_soft_delete",
  "audit_missing",
  "qc_hold_source_consume",
  "qc_hold_revert",
]);

function qcHoldCompleteIsDelete(row) {
  return !!parseDetails(row?.details).deleted_pending_completion;
}

/** add = boxes linked/created, remove = boxes unlinked/deleted, dispatch = out only, neutral = other */
export function getBoxTxDirection(row) {
  const type = normalizeBoxTxType(row?.transaction_type);
  if (!type) return "neutral";

  if (type === "sa_revert") {
    const entryType = parseDetails(row?.details).entry_type;
    if (entryType === "add") return "remove";
    if (entryType === "minus") return "add";
    return "neutral";
  }

  if (type === "qc_hold_complete") {
    return qcHoldCompleteIsDelete(row) ? "remove" : "add";
  }

  if (OUT_DISPATCH_TYPES.has(type)) return "dispatch";
  if (HOLD_TYPES.has(type)) return "hold";
  if (ADD_TYPES.has(type)) return "add";
  if (REMOVE_TYPES.has(type)) return "remove";
  return "neutral";
}

export function resolveBoxTxTypeLabel(type, row, typeLabels = {}) {
  if (!type) return "—";
  type = normalizeBoxTxType(type);

  if (type === "sa_revert") {
    const entryType = parseDetails(row?.details).entry_type;
    if (entryType === "add") return "Adjustment — Remove";
    if (entryType === "minus") return "Adjustment — Add";
  }

  if (type === "qc_hold_complete" && qcHoldCompleteIsDelete(row)) {
    return "QC Hold — Delete";
  }

  return typeLabels[type] || String(type).replace(/_/g, " ");
}

const TYPE_BADGE_CLASSES = {
  packing_create: "bg-emerald-50 text-emerald-700 border-emerald-100",
  packing_delete: "bg-rose-50 text-rose-700 border-rose-100",
  inward_link: "bg-emerald-50 text-emerald-700 border-emerald-100",
  inward_unlink: "bg-rose-50 text-rose-700 border-rose-100",
  out_link: "bg-blue-50 text-blue-600 border-blue-100",
  out_unlink: "bg-orange-50 text-orange-600 border-orange-100",
  out_other_return_to_packing: "bg-emerald-50 text-emerald-700 border-emerald-100",
  out_qc_area_release: "bg-indigo-50 text-indigo-700 border-indigo-100",
  sa_stock_in: "bg-emerald-50 text-emerald-700 border-emerald-100",
  sa_stock_out: "bg-rose-50 text-rose-700 border-rose-100",
  sa_delete: "bg-rose-50 text-rose-700 border-rose-100",
  sa_qty_update: "bg-blue-50 text-blue-600 border-blue-100",
  box_soft_delete: "bg-rose-50 text-rose-700 border-rose-100",
  override_customer: "bg-violet-50 text-violet-600 border-violet-100",
  audit_missing: "bg-amber-50 text-amber-800 border-amber-200",
  audit_extra: "bg-emerald-50 text-emerald-700 border-emerald-100",
  qc_hold_apply: "bg-amber-50 text-amber-800 border-amber-200",
  qc_hold_complete: "bg-emerald-50 text-emerald-700 border-emerald-100",
  qc_hold_source_consume: "bg-rose-50 text-rose-700 border-rose-100",
  qc_hold_revert: "bg-orange-50 text-orange-600 border-orange-100",
};

export function getBoxTxTypeBadgeClass(type, row) {
  type = normalizeBoxTxType(type);
  if (type === "sa_revert") {
    const dir = getBoxTxDirection({ transaction_type: type, details: row?.details });
    if (dir === "add") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (dir === "remove") return "bg-rose-50 text-rose-700 border-rose-100";
  }
  if (type === "qc_hold_complete") {
    const dir = getBoxTxDirection({ transaction_type: type, details: row?.details });
    if (dir === "add") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (dir === "remove") return "bg-rose-50 text-rose-700 border-rose-100";
  }
  return TYPE_BADGE_CLASSES[type] || "bg-slate-50 text-slate-600 border-slate-100";
}

/** Full vs loose box sticker chips — unchanged from original column styling. */
export function getBoxKindStickerChipClass(entry) {
  return entry?.is_loose
    ? "font-semibold text-amber-800 bg-amber-50 ring-1 ring-inset ring-amber-300"
    : "text-slate-700 bg-slate-50 ring-1 ring-inset ring-slate-200";
}
