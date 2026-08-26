import { Clock, Layers, RotateCcw, ShieldAlert } from "lucide-react";

/**
 * Toggle partial QC flows. Set true to restore Partial Hold + Partial Submit.
 * @see backend/src/apps/ims/lib/constants/qcHoldFeatureFlags.js (keep in sync)
 */
export const QC_HOLD_PARTIAL_ENABLED = true;

export const QC_HOLD_STATUS = {
  PENDING: "pending",
  PARTIAL: "partial",
  COMPLETE: "complete",
};

export const QC_HOLD_MODE_PENDING = "pending";
export const QC_HOLD_MODE_PARTIAL = "partial";
export const QC_HOLD_MODE_FULL = "full";
export const QC_HOLD_MODE_REVERT = "revert";

export const QC_HOLD_PICKER_ACCENT = {
  amber: {
    card: "border-amber-300 bg-amber-50/60 hover:border-amber-400 hover:bg-amber-50",
    title: "text-amber-900",
    banner: "border-amber-200 bg-amber-50 text-amber-900",
    submit: "bg-amber-600 shadow-amber-100 hover:bg-amber-700",
  },
  indigo: {
    card: "border-indigo-200 bg-indigo-50/60 hover:border-indigo-400 hover:bg-indigo-50",
    title: "text-indigo-800",
    banner: "border-indigo-200 bg-indigo-50 text-indigo-900",
    submit: "bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700",
  },
  yellow: {
    card: "border-yellow-300 bg-yellow-50/60 hover:border-yellow-400 hover:bg-yellow-50",
    title: "text-yellow-900",
    banner: "border-yellow-300 bg-yellow-50 text-yellow-900",
    submit: "bg-yellow-600 shadow-yellow-100 hover:bg-yellow-700",
  },
  emerald: {
    card: "border-emerald-300 bg-emerald-50/60 hover:border-emerald-400 hover:bg-emerald-50",
    title: "text-emerald-900",
    banner: "border-emerald-200 bg-emerald-50 text-emerald-900",
    submit: "bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700",
  },
};

export const QC_HOLD_PICKER_ICONS = {
  clock: Clock,
  layers: Layers,
  shield: ShieldAlert,
  revert: RotateCcw,
};

export const QC_HOLD_SCAN_PARTIAL = "partial";
export const QC_HOLD_SCAN_FULL = "full";

/** Default scan mode when creating / editing holds. */
export function defaultQcHoldScanMode() {
  return QC_HOLD_PARTIAL_ENABLED ? QC_HOLD_SCAN_PARTIAL : QC_HOLD_SCAN_FULL;
}

const QC_HOLD_PENDING_SCAN_PARTIAL_OPTION = {
  id: QC_HOLD_SCAN_PARTIAL,
  title: "Partial Hold",
  description: "Scan in-hand stock boxes only — same packing; outward boxes cannot be added.",
  accent: "indigo",
  icon: "layers",
};

const QC_HOLD_PENDING_SCAN_FULL_OPTION = {
  id: QC_HOLD_SCAN_FULL,
  title: "Full Hold",
  description: "Scan one box or enter packing number — all in-hand stock boxes are held (not outward/dispatch).",
  accent: "yellow",
  icon: "shield",
};

export const QC_HOLD_PENDING_SCAN_OPTIONS = [
  QC_HOLD_PENDING_SCAN_FULL_OPTION,
  ...(QC_HOLD_PARTIAL_ENABLED ? [QC_HOLD_PENDING_SCAN_PARTIAL_OPTION] : []),
];

export function activeQcHoldPendingScanOptions() {
  return QC_HOLD_PENDING_SCAN_OPTIONS;
}

export function getQcHoldPendingScanOption(id) {
  return QC_HOLD_PENDING_SCAN_OPTIONS.find((o) => o.id === id) || null;
}

export function isFullPendingScanMode(mode) {
  return mode === QC_HOLD_SCAN_FULL;
}

export function isPartialPendingScanMode(mode) {
  return QC_HOLD_PARTIAL_ENABLED && mode === QC_HOLD_SCAN_PARTIAL;
}

const QC_HOLD_MODE_PARTIAL_OPTION = {
  id: QC_HOLD_MODE_PARTIAL,
  title: "Partial Submit",
  cardTitle: "Partial Submit",
  description: "Submit completed / rejected qty — needs approval.",
  accent: "indigo",
  icon: "layers",
};

const QC_HOLD_MODE_PENDING_OPTION = {
  id: QC_HOLD_MODE_PENDING,
  title: "Pending Hold",
  cardTitle: "On Hold",
  description: "Keep stock on hold — scan boxes & save.",
  accent: "amber",
  icon: "clock",
};

const QC_HOLD_MODE_FULL_OPTION = {
  id: QC_HOLD_MODE_FULL,
  title: "Full Submit",
  cardTitle: "Full Submit",
  description: "Close balance with completed & rejected — needs approval.",
  accent: "yellow",
  icon: "shield",
};

const QC_HOLD_MODE_REVERT_OPTION = {
  id: QC_HOLD_MODE_REVERT,
  title: "Revert (No Change)",
  cardTitle: "Revert",
  description: "Release QC hold only — same stickers & location, no pass/reject split.",
  accent: "emerald",
  icon: "revert",
};

export const QC_HOLD_MODE_PICKER_OPTIONS = [
  QC_HOLD_MODE_PENDING_OPTION,
  ...(QC_HOLD_PARTIAL_ENABLED ? [QC_HOLD_MODE_PARTIAL_OPTION] : []),
  QC_HOLD_MODE_FULL_OPTION,
  QC_HOLD_MODE_REVERT_OPTION,
];

export function activeQcHoldModePickerOptions() {
  return QC_HOLD_MODE_PICKER_OPTIONS;
}

export function getQcHoldPickerOption(id) {
  return QC_HOLD_MODE_PICKER_OPTIONS.find((o) => o.id === id) || null;
}

export function isPendingHoldMode(mode) {
  return mode === QC_HOLD_MODE_PENDING;
}

export function isSubmitMode(mode) {
  if (mode === QC_HOLD_MODE_FULL || mode === QC_HOLD_MODE_REVERT) return true;
  return QC_HOLD_PARTIAL_ENABLED && mode === QC_HOLD_MODE_PARTIAL;
}

export function isPartialSubmitMode(mode) {
  return QC_HOLD_PARTIAL_ENABLED && mode === QC_HOLD_MODE_PARTIAL;
}

export function isFullSubmitMode(mode) {
  return mode === QC_HOLD_MODE_FULL;
}

export function isRevertSubmitMode(mode) {
  return mode === QC_HOLD_MODE_REVERT;
}

export function submissionTypeForPickerMode(mode) {
  if (isRevertSubmitMode(mode)) return "revert";
  if (isFullSubmitMode(mode)) return "full";
  if (isPartialSubmitMode(mode)) return "partial";
  return null;
}

export function pickerIdFromSubmissionType(submissionType) {
  const t = String(submissionType || "").trim().toLowerCase();
  if (t === "revert") return QC_HOLD_MODE_REVERT;
  if (t === "full") return QC_HOLD_MODE_FULL;
  return QC_HOLD_MODE_PARTIAL;
}

/** Active / pending QC hold — one line: hold # · packing · item · qty */
export function formatQcHoldActiveHoldLabel(hold) {
  if (!hold) return "";
  const holdId = hold.hold_id ?? "—";
  const packing = hold.packing_number || "—";
  const item = hold.item_code || hold.item_dcode || "—";
  const bal = Number(hold.balance_qty ?? 0).toLocaleString();
  return `#${holdId} · ${packing} · ${item} · Bal ${bal} qty`;
}

export function mapQcHoldSelectRow(row) {
  return {
    ...row,
    label: formatQcHoldActiveHoldLabel(row),
  };
}
