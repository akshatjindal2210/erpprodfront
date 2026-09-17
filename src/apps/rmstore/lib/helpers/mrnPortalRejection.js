/** Matches backend — register only, bill → complete (no Store Out). */
export const MRN_PORTAL_REJECTION_REASON = "MRN Portal Rejection";

export function isMrnPortalRejection(row) {
  return String(row?.reason || "").trim() === MRN_PORTAL_REJECTION_REASON;
}
