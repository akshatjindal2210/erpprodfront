const SEARCH_POSITIONS = new Set(["left", "right", "center", "full"]);

/** @returns {"left"|"right"|"center"|"full"} */
export function normalizeTableSearchPosition(raw = "right") {
  const value = String(raw || "right").trim().toLowerCase();
  return SEARCH_POSITIONS.has(value) ? value : "right";
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
