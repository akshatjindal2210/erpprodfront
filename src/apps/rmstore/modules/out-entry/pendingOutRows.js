/** Pending Store Out — unified row shape (job card + coil + batch + rejection). */

export const PENDING_TYPE = {
  ALL: "all",
  JOB_CARD: "job_card",
  COIL: "coil",
  BATCH: "batch",
  REJECTION: "rejection",
};

export const PENDING_TYPE_FILTER_OPTIONS = [
  { label: "All", value: PENDING_TYPE.ALL },
  { label: "Job Card", value: PENDING_TYPE.JOB_CARD },
  { label: "Rejection", value: PENDING_TYPE.REJECTION },
];

export function pendingTypeLabel(type) {
  const t = String(type || "").toLowerCase();
  if (t === PENDING_TYPE.JOB_CARD) return "Job Card";
  if (t === PENDING_TYPE.BATCH) return "Batch";
  if (t === PENDING_TYPE.COIL) return "Coil";
  if (t === PENDING_TYPE.REJECTION) return "Rejection";
  return "—";
}

export function pendingRowId(row) {
  if (!row || typeof row !== "object") return "pending-unknown";
  const type = String(row.pending_type || "").toLowerCase();
  if (type === PENDING_TYPE.JOB_CARD) {
    return `jc-${row.issue_uid ?? "x"}-${String(row.pjobcardno || "").trim()}`;
  }
  if (type === PENDING_TYPE.REJECTION) {
    return `rej-${row.qc_reject_uid ?? row.out_uid ?? "x"}`;
  }
  if (type === PENDING_TYPE.BATCH && row.mrn_uid) {
    return `batch-${row.mrn_uid}`;
  }
  return `coil-${row.coil_uid ?? row.coil_no_uid ?? "x"}`;
}

export function parseSeedCoilUids(seed) {
  const raw = seed?.coil_uids ?? seed?.coil_no_uids ?? seed?.coil_no_uid;
  if (Array.isArray(raw)) return raw.map((u) => String(u).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
  }
  return [];
}
