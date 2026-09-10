const SEARCH_POSITIONS = new Set(["left", "right", "center", "full"]);
const SEARCH_MODES = new Set(["global", "columns", "both"]);

/** @returns {"left"|"right"|"center"|"full"} */
export function normalizeTableSearchPosition(raw = "right") {
  const value = String(raw || "right").trim().toLowerCase();
  return SEARCH_POSITIONS.has(value) ? value : "right";
}

/**
 * How table search UI works when Search bar is enabled.
 * - global: toolbar search only (default)
 * - columns: inputs under each column header
 * - both: toolbar + column filters
 * @returns {"global"|"columns"|"both"}
 */
export function normalizeTableSearchMode(raw = "global") {
  const value = String(raw || "global").trim().toLowerCase();
  return SEARCH_MODES.has(value) ? value : "global";
}

/** Compact search width in px (ignored when position is full). */
export function normalizeTableSearchWidth(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 280;
  return Math.max(160, Math.min(600, Math.round(n)));
}

export const TABLE_SEARCH_POSITION_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "full", label: "Full" },
];
