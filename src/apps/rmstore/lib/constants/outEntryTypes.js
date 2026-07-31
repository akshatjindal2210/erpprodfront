export const OUT_ENTRY_TYPE = {
  STORE_OUT: "store_out",
  JOB_CARD: "job_card",
  RM_REJECTION: "rm_rejection",
};

export function getOutEntryTypeLabel(entryType) {
  const v = String(entryType || "").trim().toLowerCase();
  if (v === OUT_ENTRY_TYPE.RM_REJECTION || v === "rm rejection") return "RM Rejection";
  if (v === OUT_ENTRY_TYPE.JOB_CARD || v === "job card") return "Job Card";
  return "Store Out";
}
