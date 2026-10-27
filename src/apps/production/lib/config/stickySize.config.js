/**
 * Sticky column / header sizes only (Job Card Calendar grid).
 * Import here only where `position: sticky` layout is used.
 */

export const STICKY_SIZE = {
  /** Left # column (px). */
  snoWidthPx: 32,
  /** Process / machine label column (px) — user-resizable between min and max. */
  labelWidthPx: { default: 176, min: 120, max: 420 },
  /** Sticky top header band (px). */
  headerHeightPx: 56,
  /** Body row height (px). */
  rowHeightPx: 26,
  /** Process group header row (px). */
  groupHeightPx: 28,
  /** Horizontal scroll — one shift cell (px) by breakpoint. */
  shiftCellWidthPx: { desktop: 78, tablet: 58, mobile: 48 },
  zIndex: {
    stickyHeader: 20,
    stickyCorner: 30,
    stickyBodyLeft: 10,
    labelResizeHandle: 40,
  },
  labelResizeHandleWidthClass: "w-1.5",
};

export function calendarShiftWidthPx(viewportWidth) {
  const w = STICKY_SIZE.shiftCellWidthPx;
  if (viewportWidth < 640) return w.mobile;
  if (viewportWidth < 1024) return w.tablet;
  return w.desktop;
}
