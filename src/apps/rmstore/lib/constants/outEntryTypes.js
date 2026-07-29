export const OUT_ENTRY_TYPE = {
  STORE_OUT: "store_out",
  RM_REJECTION: "rm_rejection",
};

export function getOutEntryTypeLabel(entryType) {
  const v = String(entryType || "").trim().toLowerCase();
  if (v === OUT_ENTRY_TYPE.RM_REJECTION || v === "rm rejection") return "RM Rejection";
  return "Store Out";
}
