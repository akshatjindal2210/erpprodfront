"use client";

import { cloneElement, isValidElement } from "react";
import { Filter, MousePointerClick, X } from "lucide-react";

/**
 * App-wide list page footer.
 * Layout: left = Showing count (+ search hints) · center = table legend · right = scope + row selection.
 * Icons: Filter = scope label · MousePointerClick = selection label · X on scope/row clear buttons only.
 */

export const FOOTER_TEXT_CLASS = "text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 min-w-0";

const FOOTER_SEARCH_HINT_CLASS = "text-[10px] font-semibold text-slate-500 uppercase tracking-wide shrink-0 min-w-0 truncate";

const FOOTER_CONTEXT_TONE = {
  amber: {
    label: "text-amber-800",
    icon: "text-amber-600",
    text: "text-amber-600 hover:text-amber-900",
  },
  cyan: {
    label: "text-cyan-800",
    icon: "text-cyan-600",
    text: "text-cyan-600 hover:text-cyan-900",
  },
};

export function splitAppListFooterCountParts({shown, total, noun = "Entries", databaseTotal, isFiltered = false, journeyMode = false, prefix = ""}) {
  const countLabel = noun;
  const s = Math.max(0, Number(shown) || 0);
  const t = Math.max(0, Number(total) || 0);
  const db =
    databaseTotal != null ? Math.max(0, Number(databaseTotal) || 0) : null;
  const lead = prefix ? `${String(prefix).trim()} · ` : "";

  let searchHint = null;
  let tableCount;

  if (journeyMode) {
    tableCount = `${lead}Showing ${s} of ${t} ${countLabel} (all DB)`;
    return { searchHint, tableCount };
  }

  if (isFiltered && db != null && (db !== t || t === 0)) {
    if (t === 0) {
      tableCount = `${lead}0 ${countLabel} Match`;
      searchHint = `${db} Total`;
    } else {
      tableCount = `${lead}Showing ${s} of ${t} ${countLabel}`;
      searchHint = `Filtered From ${db}`;
    }
    return { searchHint, tableCount };
  }

  tableCount = `${lead}Showing ${s} of ${t} ${countLabel}`;
  return { searchHint, tableCount };
}

export function formatAppListFooterCountText(props) {
  const { searchHint, tableCount } = splitAppListFooterCountParts(props);
  if (searchHint) return `${tableCount} · ${searchHint}`;
  return tableCount;
}

export function appListFooterFromClientFilter({ tempSearch, sourceRows, filteredRows, serverFiltered = false }) {
  const hasClientSearch = Boolean(String(tempSearch ?? "").trim());
  const sourceLen = Array.isArray(sourceRows) ? sourceRows.length : 0;
  const filteredLen = Array.isArray(filteredRows) ? filteredRows.length : 0;
  const narrowed = hasClientSearch || filteredLen !== sourceLen;

  return {
    isFiltered: narrowed || serverFiltered,
    databaseTotal: narrowed ? sourceLen : undefined,
  };
}

export function ListPageSelectionStrip({
  selectedRecord,
  selectionLabel,
  onClearSelection,
  className = "",
  embedded = false,
}) {
  if (!selectedRecord || !selectionLabel || !onClearSelection) return null;
  const raw = String(selectionLabel(selectedRecord) ?? "").trim();
  const line = /^Selected:/i.test(raw) ? raw : `Selected: ${raw || "—"}`;
  return (
    <div
      className={`flex flex-wrap md:flex-nowrap items-center gap-x-1.5 gap-y-0.5 min-w-0 max-w-full md:overflow-hidden ${
        embedded ? "justify-start" : "justify-end"
      } ${className}`.trim()}
      role="group"
      aria-label="Table row selection"
    >
      <MousePointerClick size={12} className="shrink-0 text-indigo-500" aria-hidden />
      <span
        className={`text-[10px] font-bold text-indigo-600 uppercase truncate min-w-0 ${
          embedded ? "max-w-[min(42vw,20rem)] lg:max-w-[28rem]" : "max-w-[min(52vw,22rem)]"
        }`}
        title={line}
      >
        {line}
      </span>
      <button
        type="button"
        onClick={onClearSelection}
        className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-800 font-bold text-[10px] uppercase shrink-0 tracking-wide whitespace-nowrap"
        aria-label="Clear row selection"
        title="Clear row selection (checkbox only)"
      >
        <X size={12} strokeWidth={2.5} aria-hidden />
        Clear row
      </button>
    </div>
  );
}

export function ListPageFooterScopeDivider({ className = "" }) {
  return (
    <span
      className={`w-px h-4 bg-slate-300 shrink-0 mx-0.5 ${className}`.trim()}
      aria-hidden
    />
  );
}

export function ListPageFooterActionStack({ children, taskLayout = false }) {
  if (children == null || children === false) return null;
  const cls = taskLayout
    ? "flex w-full flex-wrap items-center justify-start gap-x-1 gap-y-0.5 min-w-0 lg:flex-nowrap lg:justify-end lg:w-auto lg:overflow-hidden"
    : "flex flex-wrap md:flex-nowrap items-center justify-end gap-x-2 gap-y-1 min-w-0 max-w-full md:overflow-hidden";
  return <div className={cls}>{children}</div>;
}

function ListPageFooterLegendScroll({ children, label = "List legend" }) {
  if (children == null || children === false) return null;
  return (
    <div
      className="mt-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label={label}
    >
      {children}
    </div>
  );
}

function ListPageFooterMobileRows({ left, right, center, legendLabel }) {
  const hasLeft = left != null && left !== false;
  const hasRight = right != null && right !== false;
  const hasCenter = center != null && center !== false;
  if (!hasLeft && !hasRight && !hasCenter) return null;
  return (
    <div className="min-w-0 px-2 py-0.5">
      {hasLeft || hasRight ? (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
          {hasLeft ? <div className="min-w-0 shrink-0 max-w-full truncate">{left}</div> : null}
          {hasRight ? (
            <div className="min-w-0 flex-1 flex flex-wrap items-center justify-end gap-x-1 gap-y-0.5">
              {right}
            </div>
          ) : null}
        </div>
      ) : null}
      <ListPageFooterLegendScroll label={legendLabel}>{hasCenter ? center : null}</ListPageFooterLegendScroll>
    </div>
  );
}

/** Scope + row selection in one bordered toolbar (Task list footer only). */
export function ListPageFooterActionsPanel({ scope = null, selection = null, compact = false }) {
  const hasScope = scope != null && scope !== false;
  const hasSelection = selection != null && selection !== false;
  const pad = compact ? "px-2 py-0.5" : "px-2.5 py-1.5";
  if (!hasScope && !hasSelection) return null;

  if (!hasScope || !hasSelection) {
    return (
      <div className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <div className={`flex min-w-0 items-center ${pad}`}>{hasScope ? scope : selection}</div>
      </div>
    );
  }

  return (
    <div
      className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded border border-slate-200 bg-white shadow-sm divide-x divide-slate-200"
      role="group"
      aria-label="List footer actions"
    >
      <div className={`flex min-w-0 w-[8.5rem] sm:w-[10rem] shrink-0 items-center ${pad}`}>{scope}</div>
      <div className={`flex min-w-0 flex-1 items-center bg-indigo-50/40 ${pad}`}>{selection}</div>
    </div>
  );
}

export function ListPageFooterBar({ left = null, center = null, right = null, layout = "default" }) {
  const hasLeft = left != null && left !== false;
  const hasCenter = center != null && center !== false;
  const hasRight = right != null && right !== false;

  const footerShell = "shrink-0 relative z-10 border-t border-slate-200 bg-slate-50";
  const desktopCols =
    layout === "task" && hasCenter
      ? "grid-cols-[minmax(0,auto)_minmax(0,1fr)_minmax(0,auto)]"
      : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]";
  const desktopBp = layout === "task" ? "lg" : "md";
  const desktopGrid = `hidden ${desktopBp}:grid w-full min-w-0 items-center gap-x-2 px-3 py-1`;
  const mobileWrap = `${desktopBp}:hidden min-w-0`;

  return (
    <div className={footerShell}>
      <div className={`${desktopGrid} ${desktopCols}`}>
        <div className="min-w-0 truncate justify-self-start">{hasLeft ? left : null}</div>
        {hasCenter ? (
          <div className="min-w-0 justify-self-center max-w-full overflow-hidden px-0.5">{center}</div>
        ) : null}
        <div className="min-w-0 justify-self-end">{hasRight ? right : null}</div>
      </div>
      <div className={mobileWrap}>
        <ListPageFooterMobileRows
          left={hasLeft ? left : null}
          right={hasRight ? right : null}
          center={hasCenter ? center : null}
          legendLabel={layout === "task" ? "Task status legend" : "Status legend"}
        />
      </div>
    </div>
  );
}

function footerLegendNode(extra, centerContent) {
  if (centerContent != null && centerContent !== "") return null;
  const node = typeof extra !== "string" ? extra : null;
  return node != null && node !== "" ? node : null;
}

export function ListPageFooterContextStrip({
  tone = "amber",
  children,
  onClear,
  clearLabel = "Clear",
  embedded = false,
  compact = false,
  /** Task footer: scope label and clear as separate bordered chips (scope only). */
  splitActions = false,
}) {
  if (children == null || children === "" || !onClear) return null;
  const c = FOOTER_CONTEXT_TONE[tone] || FOOTER_CONTEXT_TONE.amber;
  const scopeTitle = String(clearLabel || "Clear list scope");
  const pad = compact ? "px-2 py-0.5" : "px-2.5 py-1.5";

  if (splitActions && !embedded) {
    return (
      <div className="inline-flex flex-nowrap items-center gap-1.5 shrink-0" role="group" aria-label="List scope filter">
        <div
          className={`inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white ${pad} shadow-sm min-w-0 max-w-[9rem] sm:max-w-[11rem]`}
        >
          <Filter size={11} className={`shrink-0 ${c.icon}`} aria-hidden />
          <span className={`text-[10px] font-bold uppercase truncate min-w-0 ${c.label}`} title={String(children)}>
            {children}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className={`inline-flex items-center gap-1 rounded border border-slate-200 bg-white font-bold text-[10px] uppercase shrink-0 tracking-wide ${pad} shadow-sm ${c.text} hover:bg-slate-50`}
          aria-label={scopeTitle}
          title={scopeTitle}
        >
          <X size={11} strokeWidth={2.5} aria-hidden />
          {clearLabel}
        </button>
      </div>
    );
  }

  const shell = embedded
    ? "flex flex-nowrap items-center gap-1.5 min-w-0 w-full overflow-hidden"
    : `flex flex-nowrap items-center gap-1.5 min-w-0 max-w-full overflow-hidden rounded border border-slate-200 bg-white ${pad} shadow-sm`;
  const clearCls = embedded
    ? `inline-flex items-center gap-1 font-bold text-[10px] uppercase shrink-0 tracking-wide whitespace-nowrap ${c.text} hover:underline`
    : `inline-flex items-center gap-1 font-bold text-[10px] uppercase shrink-0 tracking-wide border px-1.5 py-0.5 ${c.text} border-current/30 hover:bg-black/5`;

  return (
    <div className={shell} role="group" aria-label="List scope filter">
      <Filter size={12} className={`shrink-0 ${c.icon}`} aria-hidden />
      <span
        className={`text-[10px] font-bold uppercase truncate min-w-0 flex-1 ${c.label}`}
        title={String(children)}
      >
        {children}
      </span>
      <button
        type="button"
        onClick={onClear}
        className={clearCls}
        aria-label={scopeTitle}
        title={`${scopeTitle} (keeps row selection if any)`}
      >
        <X size={12} strokeWidth={2.5} aria-hidden />
        {clearLabel}
      </button>
    </div>
  );
}

function usesAdvancedCount({ databaseTotal, isFiltered, journeyMode, prefix }) {
  return (
    databaseTotal != null ||
    isFiltered ||
    journeyMode ||
    Boolean(prefix)
  );
}

function joinSearchHints(...parts) {
  const line = parts
    .flatMap((p) => (p == null || p === "" ? [] : [String(p).trim()]))
    .filter(Boolean)
    .join(" · ");
  return line || null;
}

export default function AppListFooter({
  shown,
  total,
  noun = "Records",
  /** String = search hint on left (after count); React node = center legend. */
  extra = null,
  /** Center: table legend / badges only. */
  centerContent = null,
  contextHint = null,
  /** Full custom left (replaces auto count line). `children` is an alias. */
  leftContent = null,
  searchHint = null,
  children = null,
  selected,
  selectedRecord,
  selectionLabel,
  onClearSelection,
  databaseTotal,
  isFiltered = false,
  journeyMode = false,
  prefix = "",
  /** `"task"` = Task module compact two-row footer; default = standard single-row grid for all other apps. */
  layout = "default",
}) {
  const isTaskLayout = layout === "task";
  const showSelection = selected && selectedRecord && selectionLabel && onClearSelection;
  const extraText = typeof extra === "string" && extra.trim() ? extra.trim() : "";

  const customLeft = leftContent ?? children;

  const useSplit = usesAdvancedCount({ databaseTotal, isFiltered, journeyMode, prefix });
  const { searchHint: autoHint, tableCount } = useSplit
    ? splitAppListFooterCountParts({
        shown,
        total,
        noun,
        databaseTotal,
        isFiltered,
        journeyMode,
        prefix,
      })
    : {
        searchHint: null,
        tableCount: `Showing ${shown} of ${total} ${noun}`,
      };

  const hintLine = joinSearchHints(searchHint, autoHint, extraText);

  let leftNode = customLeft;
  if (leftNode == null) {
    leftNode = (
      <div className="flex flex-nowrap items-center gap-x-2 min-w-0 max-w-full justify-start">
        <span className={`${FOOTER_TEXT_CLASS} truncate`} title={tableCount}>
          {tableCount}
        </span>
        {hintLine ? (
          <span className={FOOTER_SEARCH_HINT_CLASS} title={hintLine}>
            · {hintLine}
          </span>
        ) : null}
      </div>
    );
  }

  let centerNode = centerContent;
  if (centerNode == null) {
    const legend = footerLegendNode(extra, centerContent);
    centerNode = legend;
  }

  const hasRight = Boolean(contextHint || showSelection);

  let scopeNode = contextHint;
  if (isTaskLayout && isValidElement(contextHint)) {
    scopeNode = cloneElement(contextHint, { compact: true, splitActions: false });
  }

  let rightNode = null;
  if (hasRight) {
    rightNode = (
      <ListPageFooterActionStack taskLayout={isTaskLayout}>
        {scopeNode}
        {contextHint && showSelection ? (
          <ListPageFooterScopeDivider className={isTaskLayout ? "hidden lg:block" : "hidden md:block"} />
        ) : null}
        {showSelection ? (
          <ListPageSelectionStrip
            selectedRecord={selectedRecord}
            selectionLabel={selectionLabel}
            onClearSelection={onClearSelection}
          />
        ) : null}
      </ListPageFooterActionStack>
    );
  }

  return (
    <ListPageFooterBar left={leftNode} center={centerNode} right={rightNode} layout={layout} />
  );
}
