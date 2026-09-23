const PENDING_SOURCE = {
  QC_CHECK: "qc_check",
  IN_PROCESS: "in_process",
  AWAITING_AUTHORIZATION: "awaiting_authorization",
  AWAITING_STORE_OUT: "awaiting_store_out",
  AWAITING_BILL: "awaiting_bill",
};

/** Footer label for RM Rejection list (register + pending tabs). */
export function rmRejectionSelectionLabel(row, { isPendingTab, registerStageLabel }) {
  if (!row) return "Selected: —";
  if (
    row.qc_reject_uid != null &&
    (row.pending_source === PENDING_SOURCE.AWAITING_STORE_OUT ||
      row.pending_source === PENDING_SOURCE.AWAITING_AUTHORIZATION)
  ) {
    return row.out_uid
      ? `Selected: REJECT-${row.qc_reject_uid} · OUT-${row.out_uid} · Store Out Pending`
      : `Selected: REJECT-${row.qc_reject_uid} · Store Out Pending (Scan/Edit in Store Out)`;
  }
  if (row.qc_reject_uid != null && row.pending_source === PENDING_SOURCE.AWAITING_BILL) {
    return `Selected: REJECT-${row.qc_reject_uid} · Store Out #${row.out_uid ?? "—"}`;
  }
  if (!isPendingTab && row.qc_reject_uid != null) {
    return `Selected: REJECT-${row.qc_reject_uid} · ${registerStageLabel ?? "—"}`;
  }
  if (row.pending_source === PENDING_SOURCE.IN_PROCESS) {
    return `Selected: In-Process #${row.ipr_uid}`;
  }
  if (row.pending_source === PENDING_SOURCE.QC_CHECK) {
    return `Selected: QC Check #${row.qc_check_uid}`;
  }
  if (row.qc_reject_uid != null) {
    return `Selected: REJECT-${row.qc_reject_uid}`;
  }
  return "Selected: Pending";
}
