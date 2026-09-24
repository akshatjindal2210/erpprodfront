/**
 * Coil Finder → "Full record details" grid.
 *
 * `show: false` = hide row. Order in array = display order (2 columns on screen).
 */

import { formatDateTime, formatDocDate } from "@/platform/utils/core/utilHelper";
import { formatFgWireSplitLine, resolveCoilJobCardLabel, resolveCoilMachineLabel } from "@/apps/rmstore/modules/coil/coilTableVisuals";

function hasValue(v) {
  if (v == null || v === "") return false;
  if (typeof v === "string" && !v.trim()) return false;
  return true;
}

/** @typedef {{ id: string, label: string, show?: boolean, visibleWhen?: (coil: object) => boolean, rows?: (coil: object) => Array<{ label: string, value: unknown }>, value?: (coil: object) => unknown }} CoilFinderFullRecordField */

/** Default = full list like legacy Full record card (toggle `show` to hide). */
export const coilFinderFullRecordFields = /** @type {CoilFinderFullRecordField[]} */ ([
  { id: "mrn_uid", label: "MRN UID", show: true, value: (c) => c?.mrn_uid },
  { id: "mrn_dt", label: "MRN Date", show: true, value: (c) => (c?.mrn_dt ? formatDocDate(c.mrn_dt) : null) },
  { id: "heat_no", label: "Heat No", show: true, value: (c) => c?.heat_no },
  { id: "item_code", label: "Item Code", show: true, value: (c) => c?.item_code },
  { id: "item_desc", label: "Description", show: true, value: (c) => c?.item_desc },
  { id: "qty", label: "Qty", show: true, value: (c) => c?.qty },
  { id: "bill_no", label: "Bill Number", show: true, value: (c) => c?.bill_no },
  { id: "bill_dt", label: "Bill Date", show: true, value: (c) => (c?.bill_dt ? formatDocDate(c.bill_dt) : null) },
  { id: "qc_status", label: "QC Status", show: true, value: (c) => c?.qc_check_status },
  { id: "job_card", label: "Job Card", show: true, value: (c) => resolveCoilJobCardLabel(c) },
  { id: "machine", label: "Machine", show: true, value: (c) => resolveCoilMachineLabel(c) },
  { id: "created_at", label: "Created At", show: true, value: (c) => (c?.created_at ? formatDateTime(c.created_at) : null) },
  { id: "updated_at", label: "Updated At", show: true, value: (c) => (c?.updated_at ? formatDateTime(c.updated_at) : null) },
  { id: "coil_no_uid", label: "Coil UID", show: true, value: (c) => c?.coil_no_uid },
  { id: "vendor", label: "Vendor", show: true, value: (c) => c?.acc_name },
  { id: "in_uid", label: "Inward UID", show: true, value: (c) => (c?.in_uid != null ? `IN-${c.in_uid}` : null) },
  { id: "out_uid", label: "Outward UID", show: true, value: (c) => (c?.out_uid != null ? `OUT-${c.out_uid}` : null) },
  { id: "sa_id", label: "Stock Adjustment ID", show: true, value: (c) => c?.sa_id },
  { id: "sa_entry_type", label: "SA Entry Type", show: true, value: (c) => c?.sa_entry_type },
  { id: "status", label: "Status", show: true, value: (c) => c?.status },

  // Optional extras — off by default (set show: true if needed)
  { id: "qc_uid", label: "QC ID", show: false, value: (c) => (c?.qc_uid != null ? `QC-${c.qc_uid}` : null) },
  { id: "rm_spec", label: "RM Spec", show: false, value: (c) => c?.rm_spec_code || c?.rm_spec_label },
  { id: "rm_uid", label: "RM ID", show: false, value: (c) => c?.rm_uid },
  { id: "ipr_uid", label: "IPR ID", show: false, value: (c) => (c?.ipr_uid != null ? String(c.ipr_uid) : null) },
  {
    id: "fg_wire_splits",
    label: "FG · wire",
    show: false,
    rows: (c) => {
      const splits = Array.isArray(c?.fg_wire_splits) ? c.fg_wire_splits : [];
      if (!splits.length) {
        const code = c?.fg_item_code;
        const desc = c?.fg_item_desc;
        const out = [];
        if (hasValue(code)) out.push({ label: "FG Item", value: code });
        if (hasValue(desc) && String(desc).trim() !== String(code || "").trim()) {
          out.push({ label: "FG Description", value: desc });
        }
        return out;
      }
      return splits.flatMap((split, idx) => {
        const line = formatFgWireSplitLine(split);
        const desc =
          split.fg_item_desc &&
          String(split.fg_item_desc).trim() &&
          String(split.fg_item_desc).trim().toUpperCase() !== String(split.fg_item_code || "").trim().toUpperCase()
            ? split.fg_item_desc
            : null;
        const rows = [{ label: `FG · wire ${idx + 1}`, value: line }];
        if (desc) rows.push({ label: `FG desc ${idx + 1}`, value: desc });
        return rows;
      });
    },
  },
]);

export function buildCoilFinderDetailRowsFromConfig(coil, fields = coilFinderFullRecordFields) {
  if (!coil) return [];
  const out = [];
  for (const field of fields) {
    if (field.show === false) continue;
    if (typeof field.visibleWhen === "function" && !field.visibleWhen(coil)) continue;

    if (typeof field.rows === "function") {
      for (const row of field.rows(coil) || []) {
        if (!hasValue(row?.value)) continue;
        out.push({ id: `${field.id}-${row.label}`, label: row.label, value: String(row.value) });
      }
      continue;
    }

    const raw = typeof field.value === "function" ? field.value(coil) : null;
    if (!hasValue(raw)) continue;
    out.push({ id: field.id, label: field.label, value: String(raw) });
  }
  return out;
}
