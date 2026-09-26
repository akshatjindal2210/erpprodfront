/** DB / QR storage: rack digits + row letters (e.g. rack 4, row E → "4E"). Display reverses to row + rack ("E4"). */

const RACK_ROW_STORED_RE = /^(\d+)([A-Za-z]+)$/;
const RM_RACK_ROW_RE = /^RM-?(\d+)([A-Za-z]+)$/i;

export function getLocationStoredNo(data) {
  if (data == null) return "";
  if (typeof data === "string") return String(data).trim().toUpperCase();
  const row = data?.row_no ?? data?.shelf_no ?? "";
  const rack = data?.rack_no;
  const fromParts =
    rack != null && String(rack).trim() !== ""
      ? `${String(rack).trim()}${String(row).trim().toUpperCase()}`
      : "";
  return String(data?.location_no ?? fromParts ?? "")
    .trim()
    .toUpperCase();
}

/**
 * @param {string|{ location_no?: string, rack_no?: string, row_no?: string, shelf_no?: string }} input
 * @returns {string} Row+r rack display code, or original text when not rack/row pattern
 */
export function formatLocationDisplay(input) {
  if (input == null || input === "") return "";

  if (typeof input === "object") {
    const rack = String(input.rack_no ?? "").trim();
    const row = String(input.row_no ?? input.shelf_no ?? "")
      .trim()
      .toUpperCase();
    if (rack && row) return `${row}${rack}`;
    const stored = getLocationStoredNo(input);
    return stored ? formatLocationDisplay(stored) : "";
  }

  let s = String(input).trim().toUpperCase();
  if (!s || s === "—") return s;

  let m = s.match(RM_RACK_ROW_RE);
  if (m) return `${m[2]}${m[1]}`;
  m = s.match(RACK_ROW_STORED_RE);
  if (m) return `${m[2]}${m[1]}`;

  return s;
}

/** Match scanned/typed input against stored location_no (supports display "E4" or stored "4E"). */
export function locationScanMatches(storedNo, scannedNo) {
  const stored = String(storedNo ?? "").trim().toUpperCase();
  const scanned = String(scannedNo ?? "").trim().toUpperCase();
  if (!stored || !scanned) return false;
  if (stored === scanned) return true;
  return formatLocationDisplay(stored) === scanned;
}
