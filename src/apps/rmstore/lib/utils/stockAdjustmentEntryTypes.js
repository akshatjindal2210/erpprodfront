/** RM Stock Adjustment entry types — mirror backend stockAdjustmentEntryTypes.js */

export function normalizeSaEntryType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (t === "new") return "old";
  if (t === "add" || t === "minus" || t === "old") return t;
  return null;
}

export function isSaAddLikeEntryType(entryType) {
  const t = normalizeSaEntryType(entryType);
  return t === "add" || t === "old";
}

export function isSaLotGateEntryType(entryType) {
  return normalizeSaEntryType(entryType) === "old";
}

export function saEntryTypeNeedsFinancialYear(entryType) {
  const t = normalizeSaEntryType(entryType);
  return t === "add" || t === "old";
}

export const isSaAddLike = isSaAddLikeEntryType;
export const usesLotGate = isSaLotGateEntryType;
export const needsFinancialYear = saEntryTypeNeedsFinancialYear;

export function stockAdjustmentTypeLabel(entryTypeOrRow) {
  const raw =
    entryTypeOrRow != null && typeof entryTypeOrRow === "object"
      ? entryTypeOrRow.entry_type
      : entryTypeOrRow;
  const t = normalizeSaEntryType(raw) || String(raw || "").trim().toLowerCase();
  if (t === "minus") return "Minus (-)";
  if (t === "old") return "Old";
  if (t === "add") return "Add (+)";
  return "—";
}

/** Parse approved flag from API rows (boolean, 0/1, t/f, yes/no). */
export function normalizeSaApproved(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null || value === "") return false;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "t", "yes", "y", "approved", "authorized"].includes(s)) return true;
  if (["false", "0", "f", "no", "n", "pending", "draft"].includes(s)) return false;
  return false;
}

export function canPrintSaStickers(row) {
  return isSaAddLikeEntryType(row?.entry_type) && normalizeSaApproved(row?.approved);
}
