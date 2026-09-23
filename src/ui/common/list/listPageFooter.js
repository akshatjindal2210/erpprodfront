"use client";

/**
 * List page footer — one import, one layout implementation (all apps).
 *
 * import AppListFooter, {
 *   appListFooterFromClientFilter,
 *   ListPageFooterContextStrip,
 *   buildTransactionLogFooterLabel,
 * } from "@/ui/common/list/listPageFooter";
 *
 * What lives here vs on pages (no feature removal — same behaviour, split for clarity):
 * - AppListFooter.js — footer zones, selection strip, scope strip, default count line
 * - Page / domain helpers — count rules unchanged (client filter, journey, custom left text)
 *
 * AppListFooter props (same capabilities as before the refactor):
 * - shown, total, noun — standard “Showing X of Y …”
 * - databaseTotal, isFiltered, journeyMode, prefix — RM-style filtered / journey counts
 * - searchHint, extra (string) — left hints after count
 * - extra (node), centerContent — center legend (coil colours, schedule swatches, …)
 * - leftContent / children — fully custom left line (transaction logs, schedule counts, …)
 * - contextHint — drill-down scope (packing filter, item-wise shortage, journey, …)
 * - selected, selectedRecord, selectionLabel, onClearSelection — row selection (footer right)
 * - layout — `"default"` (all apps); Task module uses TaskListFooter wrapper with layout `"task"`
 */

export {
  default,
  ListPageSelectionStrip,
  ListPageFooterScopeDivider,
  ListPageFooterActionStack,
  ListPageFooterActionsPanel,
  ListPageFooterBar,
  ListPageFooterContextStrip,
  FOOTER_TEXT_CLASS,
  formatAppListFooterCountText,
  splitAppListFooterCountParts,
  appListFooterFromClientFilter,
} from "@/ui/common/list/AppListFooter";

export { buildTransactionLogFooterLabel, transactionLogSelectionLabel } from "@/ui/common/list/transactionLogFooterLabel";

export { consoleListSelectionLabel, ListFooterColorLegend } from "@/ui/common/list/consoleListFooterHelpers";
