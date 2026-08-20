/**
 * Dashboard builder + publish — change canvas / container / widget backgrounds here only.
 */

/** Main canvas background (builder + live publish). */
export const DASHBOARD_CANVAS_BG = "#fcfcfd";

/** Container widget shell background. */
export const DASHBOARD_CONTAINER_BG = "#f1f5f9";

/** KPI, table, graph + nested widgets inside containers. */
export const DASHBOARD_WIDGET_BG = "#ffffff";

/** Table rows/header fallback when widget style has no bg. */
export const DASHBOARD_TABLE_BODY_BG = DASHBOARD_WIDGET_BG;
export const DASHBOARD_TABLE_HEADER_BG = "#f8fafc";

/** Builder dot-grid (edit mode only). */
export const DASHBOARD_CANVAS_GRID_DOT = "#eef1f5";

/** Default borders (optional tweak with backgrounds). */
export const DASHBOARD_WIDGET_BORDER = "1px solid #e2e8f0";
/** Builder-only container outline (edit mode CSS also adds dashed ring). */
export const DASHBOARD_CONTAINER_BORDER_BUILDER = "2px dashed #cbd5e1";
/** Publish/live — no dotted container outline. */
export const DASHBOARD_CONTAINER_BORDER = "none";

/** Strip builder dashed/dotted borders on publish (incl. legacy saved container styles). */
export function borderForPublish(saved) {
  const v = String(saved ?? "").trim();
  if (!v || v.toLowerCase() === "none" || v === "0") return undefined;
  if (/dashed|dotted/i.test(v)) return undefined;
  return saved;
}

/** Default theme borders/shadows — hide on publish (scale + overflow clip = dark corner artifacts). */
export function resolvePublishWidgetBorder(saved) {
  const v = String(saved ?? "").trim().toLowerCase();
  if (!v || v === "none" || v === "0") return undefined;
  if (/dashed|dotted/i.test(v)) return undefined;
  const legacy = new Set([
    "1px solid #e2e8f0",
    "1px solid #f5f7f9",
    "1px solid #eef1f5",
  ]);
  if (legacy.has(v)) return undefined;
  return saved;
}

export function shadowForPublish(saved) {
  if (!saved || String(saved).trim().toLowerCase() === "none") return "none";
  // Any outer shadow bleeds past rounded corners when the canvas parent clips with overflow.
  return "none";
}

/** Treat legacy default whites/greys as theme-controlled (updates old saved widgets too). */
export function resolveDashboardThemeBg(saved, fallback) {
  const legacy = new Set([
    "#ffffff", "#fff", "white",
    "#f1f5f9", "#f8fafc", "#fcfcfd",
  ]);
  const v = String(saved ?? "").trim().toLowerCase();
  if (!v || legacy.has(v)) return fallback;
  return saved;
}
