/**
 * Sticky column / header sizes only (Job Card Calendar grid).
 * Import here only where `position: sticky` layout is used.
 */

export const STICKY_SIZE = {
  /** Left # column (px). */
  snoWidthPx: 36,
  /** Process / machine label column (px) — user-resizable between min and max. */
  labelWidthPx: { default: 200, min: 140, max: 400 },
  /** Sticky top header band (px). */
  headerHeightPx: 56,
  /** Body row height (px) — 1 JC; multi adds rowStackBandPx per extra JC. */
  rowHeightPx: 92,
  /** Extra height per additional JC stacked in the same slot. */
  rowStackBandPx: 44,
  /** Process group header row (px). */
  groupHeightPx: 24,
  /** Horizontal scroll — one shift cell (px) by breakpoint. */
  shiftCellWidthPx: { desktop: 148, tablet: 120, mobile: 100 },
  zIndex: {
    stickyHeader: 20,
    stickyCorner: 30,
    stickyBodyLeft: 10,
    labelResizeHandle: 40,
    cellHover: 50,
  },
  labelResizeHandleWidthClass: "w-1.5",
};

export function calendarShiftWidthPx(viewportWidth) {
  const w = STICKY_SIZE.shiftCellWidthPx;
  if (viewportWidth < 640) return w.mobile;
  if (viewportWidth < 1024) return w.tablet;
  return w.desktop;
}
