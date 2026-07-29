export const OUT_ENTRY_TYPE = {
  FORWARDING_NOTE: "forwarding_note",
  INVENTORY_OUT: "inventory_out",
  PACKING_AREA: "packing_area",
  QC_AREA: "qc_area",
  /** @deprecated */
  LEGACY_OTHER: "other",
};

export const OUT_ENTRY_TYPE_BADGE = {
  red: "bg-red-50 text-red-800 border-red-200",
  yellow: "bg-yellow-50 text-yellow-900 border-yellow-300",
  indigo: "bg-indigo-50 text-indigo-900 border-indigo-200",
};

export const OUT_ENTRY_MODE_PICKER_OPTIONS = [
  {
    id: "forwarding_note",
    mode: OUT_ENTRY_TYPE.FORWARDING_NOTE,
    title: "Forwarding Note",
    description: "Dispatch via FUID.",
    accent: "red",
    icon: "truck",
  },
  {
    id: "inventory_out",
    mode: OUT_ENTRY_TYPE.INVENTORY_OUT,
    title: "Inventory Out",
    description: "Reduce store stock.",
    accent: "red",
    icon: "log-out",
  },
  {
    id: "packing_area",
    mode: OUT_ENTRY_TYPE.PACKING_AREA,
    title: "Packing Area",
    description: "Clear location → packing area.",
    accent: "yellow",
    icon: "package",
  },
  {
    id: "qc_area",
    mode: OUT_ENTRY_TYPE.QC_AREA,
    title: "QC Area",
    description: "Move QC hold boxes from store to QC area.",
    accent: "indigo",
    icon: "shield",
  },
];

export function isOutEntryInventoryOut(entryType) {
  return entryType === OUT_ENTRY_TYPE.INVENTORY_OUT;
}

export function isOutEntryPackingArea(entryType) {
  return (
    entryType === OUT_ENTRY_TYPE.PACKING_AREA ||
    entryType === OUT_ENTRY_TYPE.LEGACY_OTHER
  );
}

export function isOutEntryQcArea(entryType) {
  return entryType === OUT_ENTRY_TYPE.QC_AREA;
}

export function isOutEntryForwardingNote(entryType) {
  return entryType === OUT_ENTRY_TYPE.FORWARDING_NOTE;
}

export function isOutEntryAutoAuthorized(entryType) {
  return isOutEntryPackingArea(entryType) || isOutEntryQcArea(entryType);
}

export function isOutEntrySimpleScanMode(entryMode) {
  return (
    entryMode === OUT_ENTRY_TYPE.INVENTORY_OUT ||
    entryMode === OUT_ENTRY_TYPE.PACKING_AREA
  );
}

export function getOutEntryTypeTableLabel(entryType) {
  if (isOutEntryInventoryOut(entryType)) return "Inventory";
  if (isOutEntryPackingArea(entryType)) return "Packing";
  if (isOutEntryQcArea(entryType)) return "QC Area";
  if (isOutEntryForwardingNote(entryType)) return "Forwarding";
  return entryType ? String(entryType).replace(/_/g, " ") : "—";
}

export function getOutEntryTypeBadgeClass(entryType) {
  if (isOutEntryPackingArea(entryType)) return OUT_ENTRY_TYPE_BADGE.yellow;
  if (isOutEntryQcArea(entryType)) return OUT_ENTRY_TYPE_BADGE.indigo;
  return OUT_ENTRY_TYPE_BADGE.red;
}

export function getOutEntryTypeLabel(entryType) {
  return getOutEntryTypeTableLabel(entryType);
}

export function getOutEntryModePickerOption(modeId) {
  return OUT_ENTRY_MODE_PICKER_OPTIONS.find((o) => o.id === modeId) || null;
}

export function entryModeFromPickerId(pickerId) {
  return getOutEntryModePickerOption(pickerId)?.mode ?? null;
}

export function pickerIdFromEntryType(entryType) {
  if (isOutEntryInventoryOut(entryType)) return "inventory_out";
  if (isOutEntryPackingArea(entryType)) return "packing_area";
  if (isOutEntryQcArea(entryType)) return "qc_area";
  if (isOutEntryForwardingNote(entryType)) return "forwarding_note";
  return null;
}
