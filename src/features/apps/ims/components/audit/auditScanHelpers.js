/** Build { [location_id]: box_no_uid[] } from audit scan rows. */
export function buildScannedDataFromAudit(audit) {
  const data = {};
  (audit?.scans || []).forEach((scan) => {
    const locId = Number(scan.location_id);
    if (!Number.isFinite(locId)) return;
    if (!data[locId]) data[locId] = [];
    const uid = String(scan.box_no_uid || "").trim();
    if (uid && !data[locId].includes(uid)) data[locId].push(uid);
  });
  return data;
}

export function getLocationFromAudit(audit, locationId) {
  if (!audit?.locations || locationId == null) return null;
  const id = Number(locationId);
  return audit.locations.find((l) => Number(l.location_id) === id) || null;
}

/** True when finishing this location will complete the entire audit. */
export function isLastPendingAuditLocation(audit, locationId) {
  const pending = (audit?.locations || []).filter((l) => l.status !== "completed");
  return pending.length === 1 && Number(pending[0].location_id) === Number(locationId);
}
