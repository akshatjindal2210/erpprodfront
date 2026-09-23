"use client";

/**
 * Special footer layout ONLY for:
 * - Task list (`/task/dashboard/tasks`)
 * - Task report (`/task/dashboard/reports`)
 *
 * One compact row: count (left) · status legend (center, wraps) · filter/selection (right).
 * Everywhere else uses standard `AppListFooter` (default grid).
 */
import AppListFooter from "@/ui/common/list/listPageFooter";

export default function TaskListFooter(props) {
  return <AppListFooter layout="task" {...props} />;
}

export {
  ListPageFooterContextStrip,
  ListFooterColorLegend,
  consoleListSelectionLabel,
} from "@/ui/common/list/listPageFooter";
