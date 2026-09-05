"use client";
import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { Inbox, Loader2 } from "lucide-react";
import TableSkeleton from "@/ui/common/table/TableSkeleton";
import CardSkeleton from "@/ui/common/table/CardSkeleton";
import EmptyState from "@/ui/common/table/EmptyState";
import { buildCellRangeSet, isCellInSet, buildClipboardFromCellSet, copyTextToClipboard, getCellPlainText } from "@/platform/utils/list/dataTableCellSelection";
import { MODULE_DISABLED_MESSAGE } from "@/ui/common/Constants";
import { isHotkeyTypingTarget } from "@/platform/utils/list/listHotkeys";
import { formatDocDate } from "@/platform/utils/core/utilHelper";

/** Pixels: checkbox column — colgroup + sticky offsets (`table-fixed` otherwise stretches the first col). */
const DATA_TABLE_SELECTION_COL_PX = 36;
const ARROW_SCROLL_PX = 120;
/** Fallback sticky thead height — measured from DOM when possible. */
const TABLE_STICKY_HEAD_PX = 48;
const SCROLL_EDGE_PADDING = 6;
/** Reserve space for the horizontal scrollbar at the bottom of the table scroller. */
const SCROLLBAR_RESERVE_PX = 18;
const MOB_UNFREEZE_HDR = "max-md:!left-auto max-md:!right-auto max-md:!z-[55]";
const MOB_UNFREEZE_TD = "max-md:!static max-md:!left-auto max-md:!right-auto";

function parseColWidthPx(w, fallback = 150) {
  if (typeof w === "number" && Number.isFinite(w)) return w;
  if (typeof w === "string") {
    const n = parseFloat(w);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function measureStickyHeadPx(container) {
  const thead = container?.querySelector?.("thead");
  if (!thead) return TABLE_STICKY_HEAD_PX;
  const h = thead.getBoundingClientRect().height;
  return Number.isFinite(h) && h > 0 ? h : TABLE_STICKY_HEAD_PX;
}

function isFixedLeft(config = {}) {
  if (config.fixedRight || config.fixed === "right") return false;
  return config.fixed === true || config.fixed === "left";
}

function isFixedRight(config = {}) {
  return config.fixedRight === true || config.fixed === "right";
}

/** Phone par scroll karne ke liye column config par `mobileUnfixed: true` set karo. */
function unfreezeColOnMobile(config = {}) {
  if (!config.mobileUnfixed) return false;
  return isFixedLeft(config) || isFixedRight(config);
}

function measureStickyLeftPx(showSelection, colIndex, headers, columnWidths, selW) {
  let left = showSelection ? selW : 0;
  if (colIndex == null || colIndex < 0 || !headers?.length) return left;
  for (let i = 0; i < colIndex; i++) {
    const [, key, , config = {}] = headers[i] || [];
    if (isFixedLeft(config)) {
      left += parseColWidthPx(columnWidths[key ?? i] ?? config.width);
    }
  }
  return left;
}

function buildScrollPadding(container, showSelection, colIndex, headers, columnWidths, selW) {
  const headPx = measureStickyHeadPx(container) + SCROLL_EDGE_PADDING;
  const leftPx = measureStickyLeftPx(showSelection, colIndex, headers, columnWidths, selW) + SCROLL_EDGE_PADDING;
  return {
    paddingTop: headPx,
    paddingBottom: SCROLLBAR_RESERVE_PX + SCROLL_EDGE_PADDING,
    paddingLeft: leftPx,
    paddingRight: SCROLL_EDGE_PADDING,
  };
}

function scrollRectIntoContainer(container, elRect, padding = {}) {
  if (!container || !elRect) return false;
  const {
    paddingTop = 0,
    paddingBottom = SCROLL_EDGE_PADDING,
    paddingLeft = 0,
    paddingRight = SCROLL_EDGE_PADDING,
  } = padding;
  const cRect = container.getBoundingClientRect();
  let deltaY = 0;
  let deltaX = 0;

  const topBound = cRect.top + paddingTop;
  const bottomBound = cRect.bottom - paddingBottom;
  if (elRect.top < topBound) deltaY = elRect.top - topBound;
  else if (elRect.bottom > bottomBound) deltaY = elRect.bottom - bottomBound;

  const leftBound = cRect.left + paddingLeft;
  const rightBound = cRect.right - paddingRight;
  if (elRect.left < leftBound) deltaX = elRect.left - leftBound;
  else if (elRect.right > rightBound) deltaX = elRect.right - rightBound;

  if (deltaY !== 0) container.scrollTop += deltaY;
  if (deltaX !== 0) container.scrollLeft += deltaX;
  return deltaY !== 0 || deltaX !== 0;
}

function scrollTargetIntoView(targetEl, container, padding) {
  if (!targetEl) return;
  for (let i = 0; i < 4; i++) {
    const rect = targetEl.getBoundingClientRect();
    let moved = false;
    if (container) moved = scrollRectIntoContainer(container, rect, padding) || moved;
    let parent = container?.parentElement ?? targetEl.parentElement;
    while (parent && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      const scrollY =
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        parent.scrollHeight > parent.clientHeight + 1;
      const scrollX =
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        parent.scrollWidth > parent.clientWidth + 1;
      if (scrollY || scrollX) {
        moved = scrollRectIntoContainer(parent, rect, padding) || moved;
      }
      parent = parent.parentElement;
    }
    if (!moved) break;
  }
}

/** Arrow navigation after user clicked inside a list table (no focus ring on the container). */
function isListTableKeyboardContext(target, tableEngaged) {
  if (tableEngaged) return true;
  if (target?.closest?.("[data-list-table-root]")) return true;
  return false;
}

/** True when infinite scroll only appended rows (same prefix) — do not reset scroll/focus. */
function isDataAppendOnly(prevData, nextData, getId) {
  if (!Array.isArray(prevData) || !Array.isArray(nextData)) return false;
  if (!prevData.length || nextData.length <= prevData.length) return false;
  for (let i = 0; i < prevData.length; i++) {
    if (String(getId(prevData[i], i)) !== String(getId(nextData[i], i))) return false;
  }
  return true;
}

function collectScrollSnapshots(startEl) {
  const snapshots = [];
  let node = startEl;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      snapshots.push({ node, top: node.scrollTop });
    }
    node = node.parentElement;
  }
  return snapshots;
}

export default function DataTable({ 
  headers = [], 
  data = [], 
  loading = false, 
  getRowId, 
  viewMode = "table", 
  onSort, 
  sortKey, 
  sortDir, 
  showSelection = true, 
  allowCopy = false, 
  selectedId = null, 
  onSelect,
  /** Primary key field on each row (used for selection/copy when first column is not the id). */
  idKey = "id",
  skeletonCount = 10, 
  emptyMessage = "No records found", 
  emptySubMessage,
  emptyIcon: EmptyIcon = Inbox, 
  cardConfig = { titleIdx: 1, badgeIndices: [5, 4], detailIndices: [2, 3], footerIdx: 6 },
  onLoadMore,
  hasMore = false,
  totalItems = 0,
  onRowClick,
  onRowDoubleClick,
  /** When true, hide the bottom “Loading more…” row/cards (parent shows a centered overlay instead). */
  suppressLoadingFooterRow = false,
  /** When true and `loading`, show centered loader over the list and hide skeleton/footer rows (API fetch from parent). */
  centerLoadingOverlay = true,
  /** When true, suppress list keyboard nav while a drawer/modal is open (`useListDrawerHotkeys` handles N/E/P/A). */
  hotkeysDisabled = false,
  /** Table: cell/range select + Ctrl+C only when `allowCopy` is true. */
  enableCellSelection = true,
  /** When true, automatically focus/select the first row if none is selected. */
  autoFocusFirstRow = false,
  /** Optional per-row class for status tint on table rows. */
  getRowClassName,
  /** When set with renderExpandedRow, inserts a full-width detail row under the matching row (table view only). */
  expandedRowId = null,
  renderExpandedRow,
}) {
  const selW = DATA_TABLE_SELECTION_COL_PX;
  const lastApiError = typeof window !== "undefined" ? window.__LAST_API_ERROR__ : null;
  const errMsg = String(lastApiError?.message ?? "");
  const isModuleOff = lastApiError?.status === 403 && (errMsg === MODULE_DISABLED_MESSAGE || /module is disabled|module has been deactivat/i.test(errMsg));
  const resolvedEmptyMessage = isModuleOff ? MODULE_DISABLED_MESSAGE : emptyMessage;
  const resolvedEmptySubMessage = isModuleOff ? "" : emptySubMessage;
  
  // --- 0. INFINITE SCROLL LOGIC ---
  const observer = useRef();
  /** Prevents sentinel re-fire while parent is still applying the previous chunk. */
  const loadMoreLockRef = useRef(false);

  // --- 1. COLUMN RESIZE + CELL SELECTION ---
  const [columnWidths, setColumnWidths] = useState({});
  const resizingRef = useRef(null);
  const [selectionMode, setSelectionMode] = useState("none");
  const [anchorCell, setAnchorCell] = useState(null);
  const [selectedCells, setSelectedCells] = useState(() => new Set());
  const cellDragRef = useRef({ active: false, anchor: null });

  const cellSelectActive =
    viewMode === "table" && enableCellSelection && allowCopy;

  const scrollContainerRef = useRef(null);
  const scrollSnapshotsRef = useRef([]);
  const rowElRefs = useRef(new Map());
  /** Set on mousedown inside this table; cleared when clicking outside — drives arrow keys without focusing the wrapper. */
  const tableEngagedRef = useRef(false);

  const registerRowRef = useCallback((id, el) => {
    const key = String(id);
    if (!el) {
      rowElRefs.current.delete(key);
      return;
    }
    rowElRefs.current.set(key, el);
  }, []);

  const scrollRowIntoView = useCallback(
    (id, colIndex = null) => {
      const rowEl = rowElRefs.current.get(String(id));
      if (!rowEl) return;

      let targetEl = rowEl;
      if (colIndex != null && Number.isFinite(colIndex) && colIndex >= 0) {
        const childIndex = colIndex + (showSelection ? 1 : 0);
        const cell = rowEl.children[childIndex];
        if (cell instanceof HTMLElement) targetEl = cell;
      }

      const run = () => {
        const container = scrollContainerRef.current;
        const padding = buildScrollPadding(
          container,
          showSelection,
          colIndex,
          headers,
          columnWidths,
          selW
        );
        scrollTargetIntoView(targetEl, container, padding);
      };

      run();
      requestAnimationFrame(run);
      requestAnimationFrame(() => requestAnimationFrame(run));
    },
    [showSelection, headers, columnWidths, selW]
  );

  const scrollTableHorizontal = useCallback((delta) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollLeft += delta;
  }, []);

  useEffect(() => {
    if (!cellSelectActive) return;
    const onUp = () => {
      cellDragRef.current.active = false;
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [cellSelectActive]);

  useEffect(() => {
    setAnchorCell(null);
    setSelectedCells(new Set());
    setSelectionMode("none");
  }, [data]);

  const startResizing = useCallback((headerKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[headerKey] || 150;
    const startX = e.clientX;
    const onMouseMove = (moveEvent) => {
      if (!resizingRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      setColumnWidths((prev) => ({ ...prev, [headerKey]: Math.max(80, startWidth + deltaX) }));
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "default";
    };
    resizingRef.current = headerKey;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
  }, [columnWidths]);

  const getId = useCallback((item, index) => {
    if (getRowId) return getRowId(item, index);
    if (idKey && item?.[idKey] != null && item[idKey] !== "") return item[idKey];
    const firstHeaderKey = headers[0]?.[1];
    return (firstHeaderKey && item[firstHeaderKey] !== undefined) ? item[firstHeaderKey] : (item.id || `row-${index}`);
  }, [getRowId, headers, idKey]);

   // --- 2. COPY TO CLIPBOARD LOGIC ---
   const copyRowToClipboard = useCallback((item) => {
     if (!allowCopy || !item) return;

     try {
       const targetId = getId(item, 0);
       const rowIndex = data.findIndex((row, i) => String(getId(row, i)) === String(targetId));
       const safeRowIndex = rowIndex >= 0 ? rowIndex : 0;
       // Tab-separated visible cell text only (matches table + cell copy)
       const rowData = headers
         .filter((h) => !h[3]?.excludeCopy)
         .map((header) => getCellPlainText(item, header, safeRowIndex) || "—")
         .join("\t");

       const performCopy = async (text) => {
         // 1. Try Clipboard API
         if (navigator.clipboard && window.isSecureContext) {
           try {
             await navigator.clipboard.writeText(text);
             // Success - no message as requested
             return;
           } catch (err) {
             console.error("Clipboard API failed", err);
           }
         }
         
         // 2. Fallback to execCommand
         try {
           const textArea = document.createElement("textarea");
           textArea.value = text;
           textArea.style.position = "fixed";
           textArea.style.left = "-9999px";
           textArea.style.top = "0";
           document.body.appendChild(textArea);
           textArea.focus();
           textArea.select();
           document.execCommand('copy');
           document.body.removeChild(textArea);
         } catch (err) {
           console.error("Fallback copy failed", err);
         }
       };

       performCopy(rowData);
     } catch (err) {
       console.error("Copy operation failed", err);
     }
  }, [allowCopy, headers, data, getId]);

  const copyCellSelectionToClipboard = useCallback(async () => {
    if (!allowCopy || !selectedCells?.size) return;
    const text = buildClipboardFromCellSet(data, headers, selectedCells);
    if (!text) return;
    await copyTextToClipboard(text);
  }, [allowCopy, data, headers, selectedCells]);

  const selectRowByCheckbox = useCallback(
    (item, currentId) => {
      setSelectionMode("row");
      setAnchorCell(null);
      setSelectedCells(new Set());
      onSelect?.(currentId);
    },
    [onSelect]
  );

  /*
  const handleDataCellPointer = useCallback(
    (e, rowIndex, colIndex) => {
      if (!cellSelectActive) return;
      e.stopPropagation();
      const extend =
        (e.ctrlKey || e.metaKey || e.shiftKey) &&
        anchorCell &&
        selectionMode === "cell";
      const anchor = extend ? anchorCell : { row: rowIndex, col: colIndex };
      if (!extend) {
        setSelectionMode("cell");
        setAnchorCell({ row: rowIndex, col: colIndex });
      }
      setSelectedCells(
        buildCellRangeSet(anchor.row, anchor.col, rowIndex, colIndex)
      );
      cellDragRef.current = { active: true, anchor };
    },
    [cellSelectActive, anchorCell, selectionMode]
  );
  */

  // --- 3. HELPERS ---
  /*
  const handleDataCellMouseEnter = useCallback(
    (rowIndex, colIndex) => {
      if (!cellDragRef.current.active || !cellDragRef.current.anchor) return;
      setSelectionMode("cell");
      const a = cellDragRef.current.anchor;
      setSelectedCells(buildCellRangeSet(a.row, a.col, rowIndex, colIndex));
    },
    []
  );
  */

  const findSelectedRowIndex = useCallback(() => {
    if (selectedId == null || selectedId === "") return -1;
    return data.findIndex((item, i) => String(getId(item, i)) === String(selectedId));
  }, [data, selectedId, getId]);

  const savedCellFocusRef = useRef({ row: 0, col: 0 });
  const prevDataRef = useRef(null);
  const prevHotkeysDisabledRef = useRef(hotkeysDisabled);

  useEffect(() => {
    tableEngagedRef.current =
      (showSelection || cellSelectActive) && data.length > 0 && !hotkeysDisabled;
  }, [showSelection, cellSelectActive, data.length, hotkeysDisabled]);

  useEffect(() => {
    if (anchorCell) savedCellFocusRef.current = anchorCell;
  }, [anchorCell]);

  const selectRowByIndex = useCallback(
    (rowIndex) => {
      if (!showSelection || rowIndex < 0 || rowIndex >= data.length) return;
      setSelectionMode("row");
      setAnchorCell(null);
      setSelectedCells(new Set());
      const currentId = getId(data[rowIndex], rowIndex);
      onSelect?.(currentId);
      scrollRowIntoView(currentId);
    },
    [showSelection, data, getId, onSelect, scrollRowIntoView]
  );

  const focusCell = useCallback(
    (rowIndex, colIndex, skipOnSelect = false, scrollToRow = true) => {
      if (!cellSelectActive || rowIndex < 0 || rowIndex >= data.length) return;
      const colMax = Math.max(0, headers.length - 1);
      const r = Math.max(0, Math.min(data.length - 1, rowIndex));
      const c = Math.max(0, Math.min(colMax, colIndex));
      setSelectionMode("cell");
      setAnchorCell({ row: r, col: c });
      setSelectedCells(buildCellRangeSet(r, c, r, c));
      cellDragRef.current = { active: false, anchor: null };
      const currentId = getId(data[r], r);
      if (!skipOnSelect) {
        onSelect?.(currentId);
      }
      if (scrollToRow) scrollRowIntoView(currentId, c);
    },
    [cellSelectActive, data, headers.length, getId, onSelect, scrollRowIntoView]
  );

  const captureScrollPositions = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    scrollSnapshotsRef.current = collectScrollSnapshots(el);
  }, []);

  const restoreScrollPositions = useCallback(() => {
    for (const { node, top } of scrollSnapshotsRef.current) {
      if (node?.isConnected) node.scrollTop = top;
    }
  }, []);

  const lastElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      if (!node) return;
      observer.current = new IntersectionObserver(
        (entries) => {
          if (
            !entries[0]?.isIntersecting ||
            !hasMore ||
            !onLoadMore ||
            loading ||
            loadMoreLockRef.current
          ) {
            return;
          }
          loadMoreLockRef.current = true;
          captureScrollPositions();
          onLoadMore();
          window.setTimeout(() => {
            loadMoreLockRef.current = false;
          }, 150);
        },
        {
          root: scrollContainerRef.current,
          rootMargin: "120px 0px",
          threshold: 0,
        },
      );
      observer.current.observe(node);
    },
    [loading, hasMore, onLoadMore, captureScrollPositions],
  );

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return undefined;

    const onScroll = () => captureScrollPositions();
    onScroll();

    const parents = [];
    let node = el.parentElement;
    while (node) {
      const { overflowY } = window.getComputedStyle(node);
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        node.addEventListener("scroll", onScroll, { passive: true });
        parents.push(node);
      }
      node = node.parentElement;
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      parents.forEach((parent) => parent.removeEventListener("scroll", onScroll));
    };
  }, [viewMode, data.length, captureScrollPositions]);

  const resolveFocusCol = useCallback(
    (rowIndex) => {
      const saved = savedCellFocusRef.current;
      if (saved?.row === rowIndex) return saved.col ?? 0;
      return 0;
    },
    []
  );

  /** Page open / list data refresh: first cell, or keep parent `selectedId` row if still in data. */
  useEffect(() => {
    if (!cellSelectActive || !data.length || headers.length < 1) return;

    const prevData = prevDataRef.current;
    const dataChanged = prevData !== data;
    prevDataRef.current = data;
    if (!dataChanged) return;

    if (isDataAppendOnly(prevData, data, getId)) return;

    const rowIdx = findSelectedRowIndex();
    if (rowIdx >= 0) {
      focusCell(rowIdx, resolveFocusCol(rowIdx), false, false);
      return;
    }
    if (autoFocusFirstRow) {
      focusCell(0, 0, false, false);
    } else {
      focusCell(0, 0, true, false);
    }
  }, [data, cellSelectActive, headers.length, findSelectedRowIndex, focusCell, resolveFocusCol, autoFocusFirstRow, getId]);

  /** Infinite scroll append: restore scroll, then keep keyboard/selection row visible. */
  useLayoutEffect(() => {
    const prevData = prevDataRef.current;
    const append = isDataAppendOnly(prevData, data, getId);
    if (!append) return;
    restoreScrollPositions();
    requestAnimationFrame(() => {
      restoreScrollPositions();
      const rowIdx = findSelectedRowIndex();
      if (rowIdx >= 0) {
        const id = getId(data[rowIdx], rowIdx);
        const col =
          cellSelectActive && selectionMode === "cell" && anchorCell ? anchorCell.col : null;
        scrollRowIntoView(id, col);
      }
    });
  }, [
    data,
    getId,
    restoreScrollPositions,
    findSelectedRowIndex,
    scrollRowIntoView,
    cellSelectActive,
    selectionMode,
    anchorCell,
  ]);

  /** After paint, keep the selected row/cell fully inside the visible scroll area (keyboard nav). */
  useLayoutEffect(() => {
    if (!data.length || hotkeysDisabled) return;
    const rowIdx = findSelectedRowIndex();
    if (rowIdx < 0) return;
    const id = getId(data[rowIdx], rowIdx);
    const col =
      cellSelectActive && selectionMode === "cell" && anchorCell ? anchorCell.col : null;
    scrollRowIntoView(id, col);
  }, [
    selectedId,
    anchorCell?.row,
    anchorCell?.col,
    selectionMode,
    getId,
    findSelectedRowIndex,
    scrollRowIntoView,
    cellSelectActive,
    hotkeysDisabled,
    data.length,
  ]);

  /** Drawer/modal closed: restore cell focus + scroll to the row user had selected. */
  useEffect(() => {
    const wasDisabled = prevHotkeysDisabledRef.current;
    prevHotkeysDisabledRef.current = hotkeysDisabled;

    if (!wasDisabled || hotkeysDisabled) return;
    if (selectedId == null || selectedId === "") return;

    const rowIdx = findSelectedRowIndex();
    if (rowIdx < 0) return;

    if (cellSelectActive) {
      focusCell(rowIdx, resolveFocusCol(rowIdx));
      return;
    }
    if (showSelection) {
      requestAnimationFrame(() => scrollRowIntoView(selectedId));
    }
  }, [
    hotkeysDisabled,
    selectedId,
    cellSelectActive,
    showSelection,
    findSelectedRowIndex,
    focusCell,
    resolveFocusCol,
    scrollRowIntoView,
  ]);

  // For toggle selection on click, we want to allow deselecting by clicking the same cell — so pass the current selectedId and let parent decide whether to clear or set.
  // const handleDataCellPointer = useCallback(
  //   (e, rowIndex, colIndex) => {
  //     if (!cellSelectActive) return;
  //     e.stopPropagation();
  //     setSelectionMode("cell");
  //     setAnchorCell({ row: rowIndex, col: colIndex });
  //     setSelectedCells(buildCellRangeSet(rowIndex, colIndex, rowIndex, colIndex));
  //     cellDragRef.current = { active: false, anchor: null };
  //     const currentId = getId(data[rowIndex], rowIndex);
  //     onSelect?.(selectedId === currentId ? null : currentId);
  //   },
  //   [cellSelectActive, data, getId, onSelect, selectedId]
  // );

  const handleDataCellPointer = useCallback(
    (e, rowIndex, colIndex) => {
      if (!cellSelectActive) return;
      e.stopPropagation();
      setSelectionMode("cell");
      setAnchorCell({ row: rowIndex, col: colIndex });
      setSelectedCells(buildCellRangeSet(rowIndex, colIndex, rowIndex, colIndex));
      cellDragRef.current = { active: false, anchor: null };
      const currentId = getId(data[rowIndex], rowIndex);
      onSelect?.(currentId);
    },
    [cellSelectActive, data, getId, onSelect]
  );

  const handleDataCellMouseEnter = useCallback(() => {}, []);

  // --- 3b. ARROW KEY NAVIGATION (rows + cells; horizontal scroll when not in cell mode) ---
  const navStateRef = useRef({});
  useEffect(() => {
    navStateRef.current = {
      data,
      viewMode,
      showSelection,
      cellSelectActive,
      hotkeysDisabled,
      selectionMode,
      anchorCell,
      headersCount: headers.length,
      getId,
      findSelectedRowIndex,
      selectRowByIndex,
      focusCell,
      scrollTableHorizontal,
      scrollRowIntoView,
    };
  }, [
    data,
    viewMode,
    showSelection,
    cellSelectActive,
    hotkeysDisabled,
    selectionMode,
    anchorCell,
    headers.length,
    getId,
    findSelectedRowIndex,
    selectRowByIndex,
    focusCell,
    scrollTableHorizontal,
    scrollRowIntoView,
  ]);

  useEffect(() => {
    if (!showSelection && !cellSelectActive) return;

    const handleArrowNav = (e) => {
      if (isHotkeyTypingTarget(e.target)) return;
      if (!isListTableKeyboardContext(e.target, tableEngagedRef.current)) return;

      const s = navStateRef.current;
      if (s.hotkeysDisabled || !s.data?.length) return;

      const key = e.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      let rowIdx = s.findSelectedRowIndex();
      let colIdx =
        s.cellSelectActive && s.selectionMode === "cell" && s.anchorCell
          ? s.anchorCell.col
          : 0;
      if (s.cellSelectActive && s.selectionMode === "cell" && s.anchorCell) {
        rowIdx = s.anchorCell.row;
      }

      const colMax = Math.max(0, s.headersCount - 1);

      if (rowIdx < 0) {
        if (key === "ArrowDown" || key === "ArrowRight") {
          if (s.cellSelectActive) s.focusCell(0, 0);
          else if (s.showSelection) s.selectRowByIndex(0);
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (s.viewMode === "card" && s.showSelection) {
        if (key === "ArrowUp" || key === "ArrowLeft") {
          if (rowIdx > 0) {
            s.selectRowByIndex(rowIdx - 1);
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }
        if (key === "ArrowDown" || key === "ArrowRight") {
          if (rowIdx < s.data.length - 1) {
            s.selectRowByIndex(rowIdx + 1);
            e.preventDefault();
            e.stopPropagation();
          }
        }
        return;
      }

      if (s.cellSelectActive) {
        if (key === "ArrowUp" && rowIdx > 0) {
          s.focusCell(rowIdx - 1, colIdx);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (key === "ArrowDown" && rowIdx < s.data.length - 1) {
          s.focusCell(rowIdx + 1, colIdx);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (key === "ArrowLeft") {
          if (colIdx > 0) s.focusCell(rowIdx, colIdx - 1);
          else {
            s.scrollTableHorizontal(-ARROW_SCROLL_PX);
            const id = s.data[rowIdx] ? s.getId?.(s.data[rowIdx], rowIdx) : null;
            requestAnimationFrame(() => {
              if (id != null) s.scrollRowIntoView(id, colIdx);
            });
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (key === "ArrowRight") {
          if (colIdx < colMax) s.focusCell(rowIdx, colIdx + 1);
          else {
            s.scrollTableHorizontal(ARROW_SCROLL_PX);
            const id = s.data[rowIdx] ? s.getId?.(s.data[rowIdx], rowIdx) : null;
            requestAnimationFrame(() => {
              if (id != null) s.scrollRowIntoView(id, colIdx);
            });
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (!s.showSelection) return;

      if (key === "ArrowUp" && rowIdx > 0) {
        s.selectRowByIndex(rowIdx - 1);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (key === "ArrowDown" && rowIdx < s.data.length - 1) {
        s.selectRowByIndex(rowIdx + 1);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (key === "ArrowLeft") {
        s.scrollTableHorizontal(-ARROW_SCROLL_PX);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (key === "ArrowRight") {
        s.scrollTableHorizontal(ARROW_SCROLL_PX);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleArrowNav, true);
    return () => window.removeEventListener("keydown", handleArrowNav, true);
  }, [showSelection, cellSelectActive]);

   // --- 4. KEYBOARD SHORTCUTS (Ctrl+C copy; list N/E/P/A live in useListDrawerHotkeys) ---
   const stateRef = useRef({});
   useEffect(() => {
     stateRef.current = {
       data,
       selectedId,
       getId,
       copyRowToClipboard,
       copyCellSelectionToClipboard,
       allowCopy,
       selectionMode,
       selectedCells,
       cellSelectActive,
       hotkeysDisabled,
     };
   }, [
     data,
     selectedId,
     getId,
     copyRowToClipboard,
     copyCellSelectionToClipboard,
     allowCopy,
     selectionMode,
     selectedCells,
     cellSelectActive,
     hotkeysDisabled,
   ]);

   useEffect(() => {
     const handleKeyDown = (e) => {
       if (isHotkeyTypingTarget(e.target)) return;

       const s = stateRef.current;
       if (s.hotkeysDisabled) return;

       const mod = e.ctrlKey || e.metaKey;
       const key = (e.key || "").toLowerCase();

       if (!mod || e.altKey || e.shiftKey || key !== "c") return;
       if (!s.allowCopy) return;

       const selection = window.getSelection();
       if (selection && selection.toString().length > 0) return;

       e.preventDefault();
       e.stopPropagation();

       if (
         s.cellSelectActive &&
         s.selectionMode === "cell" &&
         s.selectedCells?.size > 0
       ) {
         s.copyCellSelectionToClipboard();
         return;
       }

       const { selectedId: currentSelectedId, data: currentData, getId: currentGetId, copyRowToClipboard: currentCopyFn } = s;
       if (!currentSelectedId || s.selectionMode === "cell") return;

       const selectedItem = currentData.find((item, index) => {
         const id = currentGetId(item, index);
         return String(id) === String(currentSelectedId);
       });

       if (selectedItem) currentCopyFn(selectedItem);
     };

     window.addEventListener("keydown", handleKeyDown, true);
     return () => window.removeEventListener("keydown", handleKeyDown, true);
   }, [allowCopy]);

  const handleRowClick = (item, id) => {
    if (onRowClick) {
      onRowClick(item, id);
      return;
    }
    if (showSelection) {
      onSelect?.(selectedId === id ? null : id);
    }
  };

  /**
   * Ctrl/Cmd+Click → same as double-click open.
   * In cell-select mode (allowCopy), plain row clicks must not toggle selection —
   * cells already select on mousedown; a second toggle was breaking double-click.
   */
  const handleRowClickEvent = (e, item, id) => {
    if ((e.ctrlKey || e.metaKey) && typeof onRowDoubleClick === "function") {
      e.preventDefault();
      e.stopPropagation();
      onRowDoubleClick(item, id);
      return;
    }
    if (cellSelectActive && !onRowClick) return;
    if (e.detail > 1) return;
    handleRowClick(item, id);
  };

  /** Row is interactive for selection, copy, or custom row click (e.g. open detail). */
  const rowClickable = showSelection || allowCopy || !!onRowClick;

  const getHeader = (identifier) => {
    if (typeof identifier === 'number') return headers[identifier];
    return headers.find(h => h[1] === identifier);
  };

  /** Card config may reference row keys not declared as table columns — still show the value. */
  const fieldLabelFromKey = (key) =>
    String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const renderCardValue = (item, headerOrKey, rowIndex) => {
    if (headerOrKey && typeof headerOrKey === "object" && Array.isArray(headerOrKey)) {
      return renderCell(item, headerOrKey, rowIndex, "card");
    }
    const key = headerOrKey;
    const v = item[key];
    if (v === undefined || v === null || v === "") return "—";
    if (key === "doc_dt") return formatDocDate(v) || "—";
    return String(v);
  };

  /** Hide card footer when the bound field is empty (avoids a stray "—" row). */
  const cardFooterHasContent = (item, footerH, footerKeyStr) => {
    const key = footerH?.[1] ?? footerKeyStr;
    if (key == null || key === "") return false;
    const v = item[key];
    if (v === undefined || v === null) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return true;
  };

  const renderCell = (item, header, index, mode = "table") => {
    if (!header) return null;
    const [label, key, renderFn, config] = header;
    const value = item[key];
    if (mode === "card" && config?.cardRender) {
      return config.cardRender(value, item, index);
    }
    return renderFn ? renderFn(value, item, index) : (value || "—");
  };

  const SortIcon = ({ k }) => (
    <span className={`ml-1 text-[10px] ${sortKey === k ? "text-indigo-500" : "text-slate-300"}`}>
      {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const isInitialLoad = loading && data.length === 0 && !centerLoadingOverlay;
  const isRefreshing = false; // Disable the intrusive "Updating..." overlay for a smoother feel
  const showCenterFetchOverlay = Boolean(centerLoadingOverlay && loading);

  // --- 4. TABLE VIEW ---
  if (viewMode === "table") { 
    return (
      <div data-list-table-root className="relative flex flex-col flex-1 min-h-0 w-full bg-white overflow-hidden isolate">
        {showCenterFetchOverlay && (
          <div
            className="absolute inset-0 z-[90] flex items-center justify-center bg-white/85 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-lg">
              <Loader2 className="h-9 w-9 shrink-0 text-indigo-600 animate-spin" aria-hidden />
              <span className="text-sm font-semibold text-slate-800">Loading…</span>
            </div>
          </div>
        )}
        {isRefreshing && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-100 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Updating...</span>
            </div>
          </div>
        )}

        <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0 border-t border-slate-200">
          <table className="w-full text-sm border-separate border-spacing-0 table-fixed min-w-full">
            <colgroup>
              {showSelection && (
                <col style={{ width: selW, minWidth: selW, maxWidth: selW }} />
              )}
              {headers.map((h, i) => {
                const [, key, , config = {}] = h;
                const cw = columnWidths[key || i] ?? config.width ?? 150;
                const w = typeof cw === "number" ? `${cw}px` : cw;
                return <col key={`${key ?? "col"}-${i}`} style={{ width: w }} />;
              })}
            </colgroup>
            <thead className="sticky top-0 z-[60] shadow-[0_1px_0_0_rgba(148,163,184,0.45)]">
              <tr>
                {showSelection && (
                  <th
                    className="sticky left-0 top-0 z-[70] bg-slate-50 py-3 px-0 border-b border-r border-slate-200 text-center box-border"
                    style={{ width: selW, minWidth: selW, maxWidth: selW }}
                  />
                )}
                {headers.map(([label, key, renderFn, config = {}], i) => {
                  const stickyLeftCol = isFixedLeft(config);
                  const stickyRightCol = isFixedRight(config);
                  const isSortable = key && config.sortable !== false;
                  const stickyLeft = stickyLeftCol ? (config.offset || 0) + (showSelection ? selW : 0) : 0;
                  const currentWidth = columnWidths[key || i] || config.width || 150;

                  return (
                    <th
                      key={`${key ?? "th"}-${i}`}
                      style={{
                        width: currentWidth,
                        textAlign: config.align || 'left',
                        ...(stickyLeftCol ? { left: `${stickyLeft}px` } : {}),
                        ...(stickyRightCol ? { right: 0 } : {}),
                      }}
                      className={`relative px-3 py-2 sm:py-2.5 md:py-3 text-xs sm:text-[11px] font-bold uppercase tracking-tight select-none border-b border-slate-200 sticky top-0
                      ${config.headerClass || "bg-slate-50 text-slate-600 sm:text-slate-500"}
                      ${stickyRightCol ? "border-l border-r-0" : "border-r"}
                      ${stickyLeftCol ? "z-[65]" : stickyRightCol ? "z-[66]" : "z-[55]"}
                      ${unfreezeColOnMobile(config) ? MOB_UNFREEZE_HDR : ""}`}
                    >
                      <div 
                        className={`flex items-center ${isSortable ? "cursor-pointer hover:text-slate-700 transition-colors" : ""}`}
                        onClick={() => {
                          if (isSortable && onSort) {
                            onSort(key);
                          }
                        }}
                      >
                        {label} {isSortable && <SortIcon k={key} />}
                      </div>
                      <div
                        onMouseDown={(e) => startResizing(key || i, e)}
                        className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/50 transition-colors z-[100]
                        ${resizingRef.current === (key || i) ? "bg-indigo-500 w-[2px]" : "bg-transparent"}`}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={`bg-white transition-opacity duration-200 ${isRefreshing ? "opacity-40" : "opacity-100"}`}>
              {isInitialLoad ? (
                <TableSkeleton rows={skeletonCount} cols={headers.length} showSelection={showSelection} selectionColPx={selW} />
              ) : showCenterFetchOverlay && data.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length + (showSelection ? 1 : 0)}
                    className="h-48 min-h-[12rem] border-0 bg-white"
                    aria-hidden
                  />
                </tr>
              ) : data.length === 0 ? (
                <EmptyState
                  key="empty-state"
                  isTable={true}
                  colSpan={headers.length + (showSelection ? 1 : 0)}
                  message={resolvedEmptyMessage}
                  subMessage={resolvedEmptySubMessage}
                  icon={EmptyIcon}
                />
              ) : (
                <React.Fragment>
                  {data.map((item, rowIndex) => {
                    const currentId = getId(item, rowIndex);
                    const rowReactKey = `${rowIndex}-${String(currentId)}`;
                    const isSelected =
                      selectedId != null &&
                      selectedId !== "" &&
                      String(selectedId) === String(currentId);
                    const isRowHighlighted = isSelected && selectionMode !== "cell";
                    /** Full-row select: soft fill + left stripe; single cell adds ring only. */
                    const trRowSelectedClass = isRowHighlighted
                      ? "[&_td]:!bg-indigo-100 [&_td:first-child]:!shadow-[inset_3px_0_0_0_#6366f1]"
                      : "";
                    const rowToneClass = getRowClassName?.(item, rowIndex) ?? "";
                    const defaultCellBg = isRowHighlighted
                      ? ""
                      : rowToneClass
                        ? ""
                        : "bg-white group-hover:bg-slate-50/80";
                    /** Fixed/sticky columns need a fully opaque background so scrolled cells do not show through. */
                    const stickyCellBg = isRowHighlighted
                      ? ""
                      : rowToneClass
                        ? ""
                        : "bg-white group-hover:bg-slate-50";
                    const isLastElement = data.length === rowIndex + 1;

                    return (
                      <React.Fragment key={rowReactKey}>
                      <tr
                        ref={(el) => {
                          registerRowRef(currentId, el);
                          if (isLastElement) lastElementRef(el);
                        }}
                        onClick={
                          cellSelectActive
                            ? onRowClick || onRowDoubleClick
                              ? (e) => handleRowClickEvent(e, item, currentId)
                              : undefined
                            : rowClickable
                              ? (e) => handleRowClickEvent(e, item, currentId)
                              : undefined
                        }
                        onDoubleClick={
                          onRowDoubleClick
                            ? (e) => {
                                e.stopPropagation();
                                onRowDoubleClick(item, currentId);
                              }
                            : undefined
                        }
                        className={`group ${trRowSelectedClass}${rowToneClass ? ` ${rowToneClass}` : ""}${!cellSelectActive && rowClickable ? " cursor-pointer" : ""}`}
                      >
                        {showSelection && (
                          <td
                            onClick={(e) => {
                              e.stopPropagation();
                              selectRowByCheckbox(item, currentId);
                            }}
                            className={`sticky left-0 z-30 py-2 px-0 border-b border-r border-slate-200 transition-colors ${stickyCellBg} text-center align-middle box-border cursor-pointer`}
                            style={{ width: selW, minWidth: selW, maxWidth: selW }}
                          >
                            <span className="inline-flex items-center justify-center w-full">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                tabIndex={-1}
                                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600 pointer-events-none"
                              />
                            </span>
                          </td>
                        )}
                        {headers.map((h, i) => {
                          const config = h[3] || {};
                          const stickyLeftCol = isFixedLeft(config);
                          const stickyRightCol = isFixedRight(config);
                          const isSticky = stickyLeftCol || stickyRightCol;
                          const stickyLeft = stickyLeftCol ? (config.offset || 0) + (showSelection ? selW : 0) : 0;
                          const currentWidth = columnWidths[h[1] || i] || config.width || 150;
                          const allowWrap = config.wrap === true;
                          const cellSelected =
                            cellSelectActive &&
                            selectionMode === "cell" &&
                            isCellInSet(selectedCells, rowIndex, i);
                          const colCellTone =
                            !cellSelected && config.cellClass ? config.cellClass : "";
                          const cellBg = cellSelected
                            ? "!bg-indigo-100 ring-1 ring-inset !ring-indigo-400 relative z-[1]"
                            : colCellTone
                              ? colCellTone
                              : isSticky
                                ? stickyCellBg
                                : defaultCellBg;

                          return (
                            <td
                              key={`${h[1] ?? "col"}-${i}`}
                              style={{
                                width: currentWidth,
                                ...(stickyLeftCol ? { left: `${stickyLeft}px` } : {}),
                                ...(stickyRightCol ? { right: 0 } : {}),
                                textAlign: config.align || "left",
                              }}
                              className={`px-3 py-2 text-[13px] border-b border-slate-200 transition-colors align-top select-none
                              ${stickyRightCol ? "border-l border-r-0" : "border-r"}
                              ${allowWrap ? "whitespace-normal break-words min-w-0 overflow-hidden" : "whitespace-nowrap overflow-hidden text-ellipsis"}
                              ${stickyLeftCol ? "sticky z-20" : stickyRightCol ? "sticky z-[25]" : "text-slate-600"}
                              ${unfreezeColOnMobile(config) ? MOB_UNFREEZE_TD : ""}
                              ${cellSelectActive ? "cursor-cell" : ""} ${cellBg}`}
                              onMouseDown={
                                cellSelectActive
                                  ? (e) => handleDataCellPointer(e, rowIndex, i)
                                  : undefined
                              }
                              onMouseEnter={
                                cellSelectActive
                                  ? () => handleDataCellMouseEnter(rowIndex, i)
                                  : undefined
                              }
                            >
                              {renderCell(item, h, rowIndex, "table")}
                            </td>
                          );
                        })}
                      </tr>
                      {renderExpandedRow &&
                      expandedRowId != null &&
                      String(expandedRowId) === String(currentId) ? (
                        <tr key={`${rowReactKey}-expand`} className="bg-slate-50">
                          <td
                            colSpan={headers.length + (showSelection ? 1 : 0)}
                            className="p-0 border-b border-slate-200 align-top"
                          >
                            {renderExpandedRow(item, currentId)}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                    );
                  })}
                  {loading && data.length > 0 && !suppressLoadingFooterRow && !centerLoadingOverlay && (
                    <tr key="loading-more">
                      <td colSpan={headers.length + (showSelection ? 1 : 0)} className="py-4 text-center bg-slate-50/50">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 shrink-0 text-indigo-600 animate-spin" aria-hidden />
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                            {hasMore && onLoadMore ? "Loading more…" : "Loading…"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- 5. CARD VIEW ---
  return (
    <div data-list-table-root className="flex-1 min-h-0 bg-slate-50/50 relative overflow-hidden flex flex-col">
      {showCenterFetchOverlay && (
        <div
          className="absolute inset-0 z-[90] flex items-center justify-center bg-slate-50/90 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-lg">
            <Loader2 className="h-9 w-9 shrink-0 text-indigo-600 animate-spin" aria-hidden />
            <span className="text-sm font-semibold text-slate-800">Loading…</span>
          </div>
        </div>
      )}
      {isRefreshing && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-50/40 backdrop-blur-[1px]">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
        </div>
      )}

      <div ref={scrollContainerRef} className="overflow-y-auto flex-1 p-4">
        {isInitialLoad ? (
          <CardSkeleton count={skeletonCount} />
        ) : showCenterFetchOverlay && data.length === 0 ? (
          <div className="min-h-[14rem] w-full" aria-hidden />
        ) : data.length === 0 ? (
          <EmptyState isTable={false} message={resolvedEmptyMessage} subMessage={resolvedEmptySubMessage} icon={EmptyIcon} />
        ) : (
          <>
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity duration-200 ${isRefreshing ? "opacity-30" : "opacity-100"}`}>
              {data.map((item, rowIndex) => {
                const currentId = getId(item, rowIndex);
                const rowReactKey = `${rowIndex}-${String(currentId)}`;
                const isSelected =
                  selectedId != null &&
                  selectedId !== "" &&
                  String(selectedId) === String(currentId);
                const titleH = getHeader(cardConfig.titleKey ?? cardConfig.titleIdx);
                const footerH = getHeader(cardConfig.footerKey ?? cardConfig.footerIdx);
                const titleKeyStr =
                  typeof (cardConfig.titleKey ?? cardConfig.titleIdx) === "string"
                    ? (cardConfig.titleKey ?? cardConfig.titleIdx)
                    : null;
                const footerKeyStr =
                  typeof (cardConfig.footerKey ?? cardConfig.footerIdx) === "string"
                    ? (cardConfig.footerKey ?? cardConfig.footerIdx)
                    : null;

                const resolveCardSlot = (k) => {
                  if (k === undefined || k === null) return null;
                  const h = getHeader(k);
                  if (h) return { kind: "header", h };
                  if (typeof k === "string" && k) return { kind: "raw", key: k };
                  return null;
                };

                const badgeSlots = (cardConfig.tagsKeys || cardConfig.badgeIndices || [])
                  .map(resolveCardSlot)
                  .filter(Boolean);
                const detailSlots = (cardConfig.detailKeys || cardConfig.detailIndices || [])
                  .map(resolveCardSlot)
                  .filter(Boolean);
                const isLastElement = data.length === rowIndex + 1;

                return (
                  <div
                    key={rowReactKey}
                    ref={(el) => {
                      registerRowRef(currentId, el);
                      if (isLastElement) lastElementRef(el);
                    }}
                    onClick={rowClickable ? (e) => handleRowClickEvent(e, item, currentId) : undefined}
                    onDoubleClick={
                      onRowDoubleClick
                        ? (e) => {
                            e.stopPropagation();
                            onRowDoubleClick(item, currentId);
                          }
                        : undefined
                    }
                    className={`relative bg-white rounded-xl border transition-all duration-200 overflow-hidden ${rowClickable ? "cursor-pointer" : ""} ${isSelected ? "border-indigo-600 shadow-lg shadow-indigo-100 ring-[0.5px] ring-indigo-600" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
                  >
                    {isSelected && <div className="absolute top-0 left-0 right-0 h-[3px] bg-indigo-600" />}
                    <div className="p-4">
                      <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
                        <div
                          className="min-w-0 flex-1 text-sm font-black text-slate-800 uppercase whitespace-normal break-words leading-snug [&_*]:whitespace-normal [&_*]:break-words"
                          role="heading"
                          aria-level={3}
                        >
                          {titleH
                            ? renderCell(item, titleH, rowIndex, "card")
                            : titleKeyStr
                              ? renderCardValue(item, titleKeyStr, rowIndex)
                              : "—"}
                        </div>
                        {showSelection && (
                          <input type="checkbox" checked={isSelected} readOnly className="mt-0.5 shrink-0 w-4 h-4 rounded border-slate-300 accent-indigo-600" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {badgeSlots.map((slot, idx) => {
                          const badgeConfig = slot.kind === "header" ? slot.h[3] || {} : {};
                          const badgeClass =
                            badgeConfig.cardBadgeClass ||
                            "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tight bg-slate-100 text-slate-600 border border-slate-200";
                          return (
                          <div
                            key={`${rowReactKey}-b-${slot.kind === "header" ? slot.h[1] : slot.key}-${idx}`}
                            className="inline-block"
                          >
                            {slot.kind === "header"
                              ? badgeConfig.cardBadgeClass
                                ? (
                                  <span className={badgeClass}>
                                    {renderCell(item, slot.h, rowIndex, "card")}
                                  </span>
                                )
                                : renderCell(item, slot.h, rowIndex, "card")
                              : (
                                <span className={badgeClass}>
                                  {renderCardValue(item, slot.key, rowIndex)}
                                </span>
                              )}
                          </div>
                          );
                        })}
                      </div>
                      <div className="space-y-2 mb-3">
                        {detailSlots.map((slot, idx) => {
                          const headerConfig = slot.kind === "header" ? slot.h[3] || {} : {};
                          const detailFullWidth = Boolean(headerConfig.cardDetailFullWidth);
                          const detailLabel =
                            slot.kind === "header"
                              ? headerConfig.cardLabel || slot.h[0]
                              : fieldLabelFromKey(slot.key);

                          return (
                          <div
                            key={`${rowReactKey}-d-${slot.kind === "header" ? slot.h[1] : slot.key}-${idx}`}
                            className={detailFullWidth ? "space-y-1.5" : "flex justify-between items-baseline group/row"}
                          >
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              {detailLabel}
                            </span>
                            {!detailFullWidth ? <div className="flex-1 mx-2 border-b border-dotted border-slate-100" /> : null}
                            <div
                              className={
                                detailFullWidth
                                  ? `w-full ${headerConfig.cardValueClass || ""}`
                                  : `min-w-0 max-w-[70%] text-[11px] font-bold text-slate-600 text-right whitespace-normal break-words hyphens-auto ${headerConfig.cardValueClass || ""}`
                              }
                              title={slot.kind === "raw" ? String(item[slot.key] ?? "") : undefined}
                            >
                              {slot.kind === "header"
                                ? renderCell(item, slot.h, rowIndex, "card")
                                : renderCardValue(item, slot.key, rowIndex)}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                      {(footerH || footerKeyStr) && cardFooterHasContent(item, footerH, footerKeyStr) && (
                        <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-1">
                          <div className="text-[10px] text-slate-400 font-medium">
                            {footerH
                              ? renderCell(item, footerH, rowIndex, "card")
                              : renderCardValue(item, footerKeyStr, rowIndex)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {loading && data.length > 0 && !suppressLoadingFooterRow && !centerLoadingOverlay && (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
                  <Loader2 className="w-4 h-4 shrink-0 text-indigo-600 animate-spin" aria-hidden />
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">
                    {hasMore && onLoadMore ? "Loading more results…" : "Loading…"}
                  </span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  Showing {data.length} of {totalItems} total items
                </div>
              </div>
            )}
            {!hasMore && data.length > 0 && (
              <div className="py-8 flex flex-col items-center justify-center gap-2">
                <div className="h-px w-12 bg-slate-200 mb-2" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">End of results</span>
                <div className="text-[11px] font-bold text-slate-500">
                  Total {totalItems} items loaded
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

