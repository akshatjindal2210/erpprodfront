"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Check, Loader2, Shield, Package, Trash2, Plus, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "react-toastify";

import { forwardingNoteService } from "@/features/apps/ims/services/forwardingNote";
import { masterService }         from "@/features/apps/ims/services/master";
import { schedulePlanningService } from "@/features/apps/ims/services/schedulePlanning";
import Drawer                    from "@/core/components/ui/Drawer";
import ModuleSopAcknowledgment   from "@/core/components/common/ModuleSopAcknowledgment";
import SearchableSelect          from "@/core/components/common/SearchableSelect";
import { applyClientSearch } from "@/features/apps/ims/helpers/clientListSearch";
import { withSortedViewsData } from "@/features/apps/ims/helpers/sortDropdownResponse";
import { sortSelectRowsAsc } from "@/core/utils/sortSelectOptions";
import { calculateFifoBoxes, enrichForwardingBoxesWithPackingStd, isForwardingLooseBox } from "@/core/utils/utilHelper";
import RemarksTextarea           from "@/core/components/common/RemarksTextarea";
import FormPanelLoader           from "@/core/components/common/FormPanelLoader";
import { OK_INPUT, FORM_LABEL_CLASS, FORM_MICRO_LABEL_CLASS, FORM_ERROR_CLASS } from "@/core/components/common/Constants";
import { useCanAccess }          from "@/core/hooks/useCanAccess";
import { focusFirstError } from "@/core/utils/formFocus";

const FIELD_ORDER = ["acc_code", "po_number"];

const INITIAL_FORM = {
  acc_code:            "",
  packing_category_id: "",
  po_number:           "",
  schno:               "",
  transporter_sel_id:  "",
  transporter_name:    "",
  transporter_id:      "",
  vehicle_number:      "",
  cartage:             "",
  customer_qty:        "",
  remarks:             "",
  approved:            false,
  items:               [], // multiple rows
};

const INITIAL_ITEM_ROW = {
  item_dcode:      "",
  item_code:       "",
  itemdesc:        "",
  schno:           "",
  available_boxes: [], // full stock from API
  selected_boxes:  [], // Boxes selected in FIFO order
  loose_priority:  false,
  fg_qty:          0,
  erp_qty:         0,
  erp_by_packing:  {},
  dispatch_qty:    "", // system FIFO outgoing qty (shown in input)
  dispatch_target: "", // user target for FIFO calc (balance cap)
  dispatch_std:    "", // dispatch according to standard
  source_dispatch_qty: 0,
  use_system_std:  false, // FIFO / Std suggestion active (save uses Std QTY)
  fetching:        false,
  boxes_edited:    false, // true once user changes box selection (prevents edit fallback)
};

const forwardingBoxKey = (box) =>
  String(box?.box_no_uid ?? box?.box_uid ?? "").trim();

/** Box keys already taken by other rows of the same item (keeps multi-Sch FIFO exclusive). */
const claimedBoxKeysForItem = (items, currentIdx, itemDcode) => {
  const dcode = String(itemDcode ?? "").trim();
  const claimed = new Set();
  if (!dcode) return claimed;
  (items || []).forEach((row, idx) => {
    if (idx === currentIdx) return;
    if (String(row?.item_dcode ?? "").trim() !== dcode) return;
    for (const box of row?.selected_boxes || []) {
      const key = forwardingBoxKey(box);
      if (key) claimed.add(key);
    }
  });
  return claimed;
};

/** FIFO pool for one row — full stock minus other rows' claims (current selection stays available). */
const fifoPoolForRow = (items, idx) => {
  const item = items?.[idx];
  if (!item) return [];
  const claimed = claimedBoxKeysForItem(items, idx, item.item_dcode);
  const keep = new Set((item.selected_boxes || []).map(forwardingBoxKey).filter(Boolean));
  return (item.available_boxes || []).filter((box) => {
    const key = forwardingBoxKey(box);
    if (!key) return true;
    return !claimed.has(key) || keep.has(key);
  });
};

/** Run async mapper with limited concurrency (keeps schedule hydrate from flooding the API). */
async function mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Number(concurrency) || 3);
  const out = new Array(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) || 0 }, async () => {
    while (next < list.length) {
      const idx = next++;
      out[idx] = await mapper(list[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Skeleton item row from a dispatch/schedule line — no stock APIs yet. */
function skeletonItemFromDispatchRow(row) {
  const itemDcode = row?.itemdcode;
  const scheduleQty = Number(row?.totalqty ?? row?.total_qty ?? 0);
  const balanceQty = Math.max(
    0,
    Number.isFinite(Number(row?.balance_qty)) ? Number(row.balance_qty) : scheduleQty
  );
  const rowSchno =
    row?.schno != null && String(row.schno).trim() !== "" ? String(row.schno).trim() : "";
  return {
    ...INITIAL_ITEM_ROW,
    item_dcode: itemDcode ? String(itemDcode) : "",
    item_code: row?.item_code || "",
    itemdesc: row?.itemdesc || "",
    schno: rowSchno,
    source_dispatch_qty: balanceQty,
    dispatch_target: balanceQty > 0 ? String(balanceQty) : "",
    fetching: Boolean(itemDcode),
    boxes_edited: false,
  };
}

/** Dropdown option from a customer schedule line (unique per schno+item). */
function scheduleLineToCatalogItem(row) {
  const itemdcode = String(row?.itemdcode ?? row?.item_dcode ?? "").trim();
  const schno = row?.schno != null && String(row.schno).trim() !== "" ? String(row.schno).trim() : "";
  const balanceQty = Math.max(
    0,
    Number.isFinite(Number(row?.balance_qty))
      ? Number(row.balance_qty)
      : Number(row?.totalqty ?? row?.total_qty ?? 0)
  );
  const fg = Number(row?.fg_stock_qty ?? row?.in_hand_qty ?? 0);
  const itemCode = row?.item_code || "";
  const itemdesc = row?.itemdesc || row?.item_desc || "";
  const fgZero = !(fg > 0);
  const balanceZero = balanceQty <= 0;
  return {
    id: `${schno}::${itemdcode}`,
    itemdcode,
    item_dcode: itemdcode,
    item_code: itemCode,
    itemdesc,
    schno,
    balance_qty: balanceQty,
    source_dispatch_qty: balanceQty,
    fg_stock_qty: fg,
    fg_zero: fgZero,
    balance_zero: balanceZero,
    zero_or_no_stock: balanceZero || fgZero,
    // SearchableSelect sub-label
    schedule_hint: [
      schno ? `Sch ${schno}` : null,
      `Bal ${balanceQty.toLocaleString()}`,
      `FG ${fg.toLocaleString()}`,
      fgZero ? "No FG stock" : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function scheduleCatalogSelectionKey(row) {
  const d = String(row?.item_dcode ?? row?.itemdcode ?? "").trim();
  const s = String(row?.schno ?? "").trim();
  if (!d) return "";
  return s ? `${s}::${d}` : d;
}

/** Box count / breakdown source — never revert to saved breakdown after user edits selection. */
const itemBoxDisplay = (item) => {
  if (item.selected_boxes.length > 0 || item.boxes_edited) {
    return { boxes: item.selected_boxes, fromSelection: true };
  }
  if (item.original_breakdowns?.length > 0) {
    return { boxes: [], fromSelection: false, breakdowns: item.original_breakdowns };
  }
  return { boxes: [], fromSelection: true };
};

const itemSelectedBoxCount = (item) => {
  const display = itemBoxDisplay(item);
  if (display.fromSelection) return display.boxes.length;
  return (display.breakdowns || []).reduce(
    (acc, bd) => acc + (Number(bd.box) || 0) + (Number(bd.loose_box) || 0),
    0
  );
};

const itemStdQty = (item) => {
  const display = itemBoxDisplay(item);
  if (display.fromSelection) return sumQty(display.boxes);
  return (display.breakdowns || []).reduce((acc, bd) => acc + (Number(bd.total_qty) || 0), 0);
};

const erpQtyForPacking = (item, packingNo) => {
  const key = String(packingNo ?? "").trim();
  return Number(item?.erp_by_packing?.[key] ?? 0) || 0;
};

/** ERP FG rows keyed by Doc No. — for packing-wise display. */
const erpPackingEntries = (item) => {
  const map = item?.erp_by_packing;
  if (!map || typeof map !== "object") return [];
  return Object.entries(map)
    .map(([packingNo, qty]) => ({
      packingNo: String(packingNo).trim(),
      qty: Number(qty) || 0,
    }))
    .filter((r) => r.packingNo)
    .sort((a, b) => {
      const na = Number(a.packingNo);
      const nb = Number(b.packingNo);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return nb - na;
      return b.packingNo.localeCompare(a.packingNo);
    });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Total qty of a box array
const sumQty = (boxes) => boxes.reduce((s, b) => s + Number(b.qty), 0);

/** Max manual dispatch qty — balance cap from schedule plan, else FG stock. */
const getDispatchQtyCap = (item) => {
  const balanceCap = Number(item?.source_dispatch_qty ?? 0);
  const fgCap = Number(item?.fg_qty ?? 0);
  if (balanceCap > 0) return Math.min(fgCap, balanceCap);
  return fgCap;
};

/** Cap typed dispatch qty; empty string allowed while editing. */
const formatDispatchQtyInput = (item, rawVal) => {
  if (rawVal === "" || rawVal == null) return "";
  const n = Number(rawVal);
  if (!Number.isFinite(n)) return "";
  const cap = getDispatchQtyCap(item);
  return String(Math.min(Math.max(0, n), cap));
};

/** User / balance target for FIFO — never treat system dispatch_qty as target on schedule rows. */
const getItemFifoTarget = (item) => {
  const balanceCap = Number(item?.source_dispatch_qty ?? 0);
  const targetQty = Number(item.dispatch_target || 0);
  if (targetQty > 0) {
    return balanceCap > 0 ? Math.min(targetQty, balanceCap) : targetQty;
  }
  if (balanceCap > 0) return balanceCap;
  return Number(item.dispatch_qty || 0) || 0;
};

/** Selected boxes as contiguous FIFO prefix (no gaps — full boxes only). */
const getFifoPrefixFromSelection = (orderedBoxes, selectedBoxes) => {
  if (!orderedBoxes?.length) return [];
  const selectedKeys = new Set((selectedBoxes || []).map(forwardingBoxKey).filter(Boolean));
  if (!selectedKeys.size) return [];
  const prefix = [];
  for (const box of orderedBoxes) {
    const key = forwardingBoxKey(box);
    if (!key) continue;
    if (selectedKeys.has(key)) {
      prefix.push(box);
    } else if (prefix.length > 0) {
      break;
    }
  }
  return prefix;
};

/**
 * Max boxes for +/- stepper (FIFO, full boxes).
 * - Schedule (balance > 0): stop at boxes needed for balance qty
 * - Direct / no schedule: all available boxes so + can grow dispatch qty freely
 */
const maxFifoBoxesForItem = (item, orderedBoxes) => {
  const balanceCap = Number(item?.source_dispatch_qty ?? 0);
  if (balanceCap > 0) {
    return selectBoxesByQty(orderedBoxes, balanceCap).length;
  }
  return orderedBoxes.length;
};

/** Current FIFO selection length for +/- (prefer contiguous prefix; fall back to selected count). */
const getFifoSelectionCount = (item, orderedBoxes) => {
  const prefixLen = getFifoPrefixFromSelection(orderedBoxes, item.selected_boxes).length;
  if (prefixLen > 0) return prefixLen;
  return Array.isArray(item.selected_boxes) ? item.selected_boxes.length : 0;
};

const canAddMoreFifoBoxes = (item) => {
  if (!item?.available_boxes?.length) return false;
  const orderedBoxes = reorderBoxesForSelection(item.available_boxes, item.loose_priority);
  const fifoLimit = maxFifoBoxesForItem(item, orderedBoxes);
  const current = getFifoSelectionCount(item, orderedBoxes);
  return current < fifoLimit && current < orderedBoxes.length;
};

/** FIFO pick; always takes full boxes (never partial) to avoid breaking boxes. */
const selectBoxesByQty = (boxes, targetQty) =>
  calculateFifoBoxes(boxes, targetQty).selectedBoxes;

/** Group by qty for display. `selection` = pick order (loose priority); `asc`/`desc` = qty sort. */
const formatBoxQtyGroups = (boxes = [], { qtyOrder = "desc" } = {}) => {
  if (!boxes.length) return "—";
  if (qtyOrder === "selection") {
    const parts = [];
    let runQty = null;
    let runCount = 0;
    const flush = () => {
      if (runCount > 0) parts.push(`${runCount} x ${runQty.toLocaleString()}`);
      runQty = null;
      runCount = 0;
    };
    for (const b of boxes) {
      const q = Math.round(Number(b.qty) || 0);
      if (q === runQty) runCount += 1;
      else {
        flush();
        runQty = q;
        runCount = 1;
      }
    }
    flush();
    return parts.join(", ") || "—";
  }
  const byQty = new Map();
  for (const b of boxes) {
    const q = Math.round(Number(b.qty) || 0);
    byQty.set(q, (byQty.get(q) || 0) + 1);
  }
  const sortFn = qtyOrder === "asc" ? (a, b) => a[0] - b[0] : (a, b) => b[0] - a[0];
  return [...byQty.entries()]
    .sort(sortFn)
    .map(([qty, count]) => `${count} x ${qty.toLocaleString()}`)
    .join(", ");
};

/** Saved breakdown row — only aggregate count + total; never fake equal per-box qty. */
const formatAggregatedBoxCount = (count, totalQty) => {
  const n = Number(count) || 0;
  const total = Number(totalQty) || 0;
  if (n <= 0 || total <= 0) return null;
  // const perBox = total / n;
  // if (Number.isInteger(perBox)) return `${n} x ${perBox.toLocaleString()}`;
  return `${n} box${n > 1 ? "es" : ""} · ${total.toLocaleString()} qty`;
};

const sortBoxesForFifo = (boxes = []) => {
  return [...boxes].sort((a, b) => {
    // 1. FIFO (Packing Number)
    const pA = Number(a?.packing_number ?? 0);
    const pB = Number(b?.packing_number ?? 0);
    if (pA !== pB) return pA - pB;

    // 2. Full boxes first (`is_loose` from box table)
    const looseA = isForwardingLooseBox(a) ? 1 : 0;
    const looseB = isForwardingLooseBox(b) ? 1 : 0;
    if (looseA !== looseB) return looseA - looseB;

    // 3. UID
    const uidA = Number(a?.box_uid ?? 0);
    const uidB = Number(b?.box_uid ?? 0);
    return uidA - uidB;
  });
};

/** Global prioritization of loose vs full boxes based on preference, maintaining FIFO within groups. */
const reorderBoxesForSelection = (boxes = [], loosePriority = false) => {
  return [...boxes].sort((a, b) => {
    // 1. FIFO (Packing Number)
    const pA = Number(a?.packing_number ?? 0);
    const pB = Number(b?.packing_number ?? 0);
    if (pA !== pB) return pA - pB;

    // 2. Loose boxes first if loosePriority is true
    const looseA = isForwardingLooseBox(a) ? 1 : 0;
    const looseB = isForwardingLooseBox(b) ? 1 : 0;
    if (looseA !== looseB) {
      return loosePriority ? looseB - looseA : looseA - looseB;
    }

    // 3. UID
    const uidA = Number(a?.box_uid ?? 0);
    const uidB = Number(b?.box_uid ?? 0);
    return uidA - uidB;
  });
};

/** Std qty FIFO would allocate for a target dispatch (full boxes, may exceed target). */
const getFifoStdForTargetQty = (item, targetQty) => {
  const target = Number(targetQty) || 0;
  if (target <= 0 || !item?.available_boxes?.length) return 0;
  const ordered = reorderBoxesForSelection(item.available_boxes, item.loose_priority);
  return sumQty(selectBoxesByQty(ordered, target));
};

/** Build row state from user target — dispatch_qty = system FIFO total sent. */
const buildDispatchFromTarget = (item, targetQty) => {
  const balanceCap = Number(item?.source_dispatch_qty ?? 0);
  const ordered = reorderBoxesForSelection(item.available_boxes || [], item.loose_priority);
  const target = Number(targetQty) || 0;

  if (target <= 0 || !ordered.length) {
    return {
      dispatch_target: "",
      dispatch_qty: "",
      selected_boxes: [],
      dispatch_std: "",
      use_system_std: false,
      boxes_edited: true,
    };
  }

  const fifoTarget = balanceCap > 0 && target > balanceCap ? balanceCap : target;
  const selected = selectBoxesByQty(ordered, fifoTarget);
  const stdQty = sumQty(selected);
  const systemStd = balanceCap > 0 ? getFifoStdForTargetQty(item, balanceCap) : 0;

  return {
    dispatch_target: String(fifoTarget),
    dispatch_qty: stdQty > 0 ? String(stdQty) : "",
    selected_boxes: selected,
    dispatch_std: stdQty > 0 ? String(stdQty) : "",
    use_system_std: balanceCap > 0 && fifoTarget === balanceCap && stdQty === systemStd && systemStd > 0,
    boxes_edited: true,
  };
};

/** Apply dispatch qty input → FIFO boxes (never breaks boxes; caps at balance). */
const resolveDispatchQtySelection = (item, rawVal, { emptyMeansSystem = false } = {}) => {
  const balanceCap = Number(item?.source_dispatch_qty ?? 0);
  const ordered = reorderBoxesForSelection(item.available_boxes || [], item.loose_priority);

  if (rawVal === "" || rawVal == null) {
    if (emptyMeansSystem && balanceCap > 0 && ordered.length) {
      return buildDispatchFromTarget(item, balanceCap);
    }
    return {
      dispatch_target: "",
      dispatch_qty: "",
      selected_boxes: [],
      dispatch_std: "",
      use_system_std: false,
      boxes_edited: true,
    };
  }

  const n = Number(rawVal);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }

  if (balanceCap > 0 && n > balanceCap) {
    return buildDispatchFromTarget(item, balanceCap);
  }

  return buildDispatchFromTarget(item, n);
};

export default function ForwardingModal({
  open,
  onClose,
  onSuccess,
  editData,
  mode = "add",
  dispatchPrefill = null,
  customerSchedulePicker = false,
}) {
  const [saving, setSaving]           = useState(false);
  const [formReady, setFormReady]     = useState(false);
  const [form, setForm]               = useState(INITIAL_FORM);
  const [errors, setErrors]           = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);
  const formItemsRef = useRef(form.items);
  const prevCategoryRef = useRef("");
  const [transporterOpts, setTransporterOpts] = useState([]);
  const [transporterOpen, setTransporterOpen] = useState(false);
  const [categoryOpts, setCategoryOpts] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const canAccess = useCanAccess();
  const canAuthorize = canAccess("forwarding_note_master", "authorize").allowed;
  
  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const isFromSchedule = mode === "add" && Boolean(dispatchPrefill);
  /** Edit/approve of a schedule-linked FN (item or header schno) — detected after hydrate. */
  const [loadedAsScheduleNote, setLoadedAsScheduleNote] = useState(false);
  /** Use customer schedule item catalog (not free in-hand catalog). */
  const scheduleCatalogActive = Boolean(
    customerSchedulePicker || ((isEdit || isApprove) && loadedAsScheduleNote)
  );

  useEffect(() => {
    if (!open) setLoadedAsScheduleNote(false);
  }, [open]);

  const scheduleSchnos = useMemo(() => {
    const fromItems = (form.items || [])
      .map((i) => String(i.schno ?? "").trim())
      .filter(Boolean);
    if (fromItems.length) return [...new Set(fromItems)];
    const header = String(form.schno ?? "").trim();
    return header ? [header] : [];
  }, [form.items, form.schno]);
  const scheduleLabel =
    scheduleSchnos.length > 1
      ? `${scheduleSchnos.length} schedules`
      : scheduleSchnos[0] || form.schno || "—";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";

  const showApproval = canAuthorize && (mode === "add" || mode === "approve");

  const [transporterHighlight, setTransporterHighlight] = useState(-1);
  /** Row index whose dispatch input is being typed (show target until blur). */
  const [editingDispatchIdx, setEditingDispatchIdx] = useState(null);
  /** In-hand stock items — loaded once per modal open; dropdown search is client-only. */
  const [inHandItemCatalog, setInHandItemCatalog] = useState(null);

  useEffect(() => {
    formItemsRef.current = form.items;
  }, [form.items]);

  const editingFuid = useMemo(() => {
    const fuid = parseInt(String(editData?.fuid ?? "").trim(), 10);
    return Number.isFinite(fuid) && fuid > 0 ? fuid : null;
  }, [editData?.fuid]);

  useEffect(() => {
    if (!open || !formReady) {
      setInHandItemCatalog(null);
      return undefined;
    }
    // Schedule-locked FN cannot change items — skip catalog API.
    if (isFromSchedule) return undefined;

    let cancelled = false;
    (async () => {
      try {
        if (scheduleCatalogActive) {
          if (!form.acc_code) {
            if (!cancelled) setInHandItemCatalog([]);
            return;
          }
          const res = await schedulePlanningService.customerMonthSchedules({
            acc_code: Number(form.acc_code),
            permission_module: "forwarding_note_master",
            permission_action: "view",
            ...(editingFuid ? { exclude_fuid: editingFuid } : {}),
          });
          if (cancelled) return;
          const rows = Array.isArray(res?.records)
            ? res.records
            : Array.isArray(res?.data)
              ? res.data
              : [];
          setInHandItemCatalog(
            rows
              .map(scheduleLineToCatalogItem)
              .filter((r) => r.itemdcode && Number(r.balance_qty ?? 0) > 0 && !r.balance_zero)
          );
          return;
        }

        const res = await forwardingNoteService.getAvailableItems({
          exclude_fuid: editingFuid ?? undefined,
        });
        if (!cancelled) {
          const rows = Array.isArray(res?.data) ? res.data : [];
          setInHandItemCatalog(rows.map((item) => ({ ...item, id: item.id ?? item.itemdcode })));
        }
      } catch {
        if (!cancelled) setInHandItemCatalog([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, formReady, editingFuid, isFromSchedule, scheduleCatalogActive, form.acc_code, isEdit, isApprove]);

  // Edit / existing rows: fill Balance from customer schedule catalog when available.
  // Catalog balance already excludes this FN (exclude_fuid) so it includes qty on this note.
  useEffect(() => {
    if (!scheduleCatalogActive || !Array.isArray(inHandItemCatalog) || !inHandItemCatalog.length) return;
    if (!form.items?.some((row) => row?.item_dcode)) return;

    setForm((prev) => {
      let changed = false;
      const nextItems = prev.items.map((row) => {
        if (!row?.item_dcode) return row;
        const key = scheduleCatalogSelectionKey(row);
        const match =
          inHandItemCatalog.find((c) => String(c.id) === key) ||
          inHandItemCatalog.find(
            (c) =>
              String(c.itemdcode) === String(row.item_dcode) &&
              (!row.schno || String(c.schno) === String(row.schno))
          );
        if (!match) return row;
        // Never stamp a schedule schno onto a direct (no-schno) row.
        if (!String(row.schno || "").trim()) return row;
        const catalogBal = Math.max(0, Number(match.balance_qty ?? match.source_dispatch_qty ?? 0));
        // Safety: never show balance below qty already selected on this row.
        const rowQty = Math.max(
          0,
          Number(row.dispatch_qty) ||
            Number(row.dispatch_target) ||
            (Array.isArray(row.selected_boxes) && row.selected_boxes.length
              ? row.selected_boxes.reduce((s, b) => s + (Number(b.qty) || 0), 0)
              : 0) ||
            (Array.isArray(row.original_breakdowns)
              ? row.original_breakdowns.reduce((s, bd) => s + (Number(bd.total_qty) || 0), 0)
              : 0)
        );
        const bal = Math.max(catalogBal, rowQty);
        if (Number(row.source_dispatch_qty) === bal) return row;
        changed = true;
        return {
          ...row,
          source_dispatch_qty: bal,
        };
      });
      if (!changed) return prev;
      formItemsRef.current = nextItems;
      return { ...prev, items: nextItems };
    });
  }, [scheduleCatalogActive, inHandItemCatalog, form.items.length]);

  const getItemById = useCallback(
    (id) => {
      const rawId = String(id ?? "").trim();
      if (!rawId) return Promise.resolve({ data: null });

      if (Array.isArray(inHandItemCatalog)) {
        const match =
          inHandItemCatalog.find((item) => String(item.id) === rawId) ||
          (rawId.includes("::")
            ? inHandItemCatalog.find((item) => {
                const [schno, dcode] = rawId.split("::");
                return String(item.schno ?? "") === String(schno) && String(item.itemdcode) === String(dcode);
              })
            : inHandItemCatalog.find(
                (item) => String(item.itemdcode) === rawId || String(item.item_dcode) === rawId
              ));
        if (match) return Promise.resolve({ data: match });
      }

      if (scheduleCatalogActive) {
        const fromForm = (formItemsRef.current || []).find((row) => {
          if (!row?.item_dcode) return false;
          const key = scheduleCatalogSelectionKey(row);
          if (key && key === rawId) return true;
          if (String(row.item_dcode) === rawId) return true;
          if (rawId.includes("::")) {
            const [schno, dcode] = rawId.split("::");
            return String(row.schno ?? "") === String(schno) && String(row.item_dcode) === String(dcode);
          }
          return false;
        });
        if (fromForm?.item_dcode) {
          const schno =
            fromForm.schno != null && String(fromForm.schno).trim() !== ""
              ? String(fromForm.schno).trim()
              : "";
          const bal = Math.max(0, Number(fromForm.source_dispatch_qty ?? 0));
          const fg = Number(fromForm.fg_qty ?? 0);
          return Promise.resolve({
            data: {
              id: schno ? `${schno}::${fromForm.item_dcode}` : String(fromForm.item_dcode),
              itemdcode: String(fromForm.item_dcode),
              item_dcode: String(fromForm.item_dcode),
              item_code: fromForm.item_code || String(fromForm.item_dcode),
              itemdesc: fromForm.itemdesc || "",
              schno,
              balance_qty: bal,
              source_dispatch_qty: bal,
              fg_stock_qty: fg,
              fg_zero: !(fg > 0),
              schedule_hint: [
                schno ? `Sch ${schno}` : null,
                `Bal ${bal.toLocaleString()}`,
                `FG ${fg.toLocaleString()}`,
              ]
                .filter(Boolean)
                .join(" · "),
            },
          });
        }
        return Promise.resolve({ data: null });
      }

      return masterService.getItemViewById(id, {
        permission_module: "forwarding_note_master",
        permission_action: "view",
      });
    },
    [inHandItemCatalog, scheduleCatalogActive]
  );

  const buildInHandItemFetchService = useCallback((catalog, currentIdx) => {
    return async ({ search = "", page = 1, limit = 50 } = {}) => {
      if (!Array.isArray(catalog)) return { data: [] };

      const selectedInOtherRows = new Set(
        formItemsRef.current
          .map((row, rowIdx) => {
            if (rowIdx === currentIdx) return null;
            return scheduleCatalogSelectionKey(row);
          })
          .filter(Boolean)
      );
      let list = catalog.filter((item) => !selectedInOtherRows.has(String(item.id)));

      const q = String(search || "").trim();
      if (q) {
        list = applyClientSearch(list, q, {
          getParts: (item) =>
            [item.item_code, item.itemdesc, item.item_desc, item.schno, item.schedule_hint].filter(Boolean),
          skipSort: true,
        });
      } else {
        list = sortSelectRowsAsc(list, "item_code", ["itemdesc", "schno"]);
      }

      const start = (Math.max(1, Number(page) || 1) - 1) * (Number(limit) || 50);
      return { data: list.slice(start, start + (Number(limit) || 50)), total: list.length };
    };
  }, []);

  const scheduleOptionClassName = useCallback((item) => {
    if (!scheduleCatalogActive) return "";
    if (item?.fg_zero) {
      return "bg-rose-50 text-rose-700 border-l-2 border-l-rose-400";
    }
    if (item?.balance_zero) {
      return "bg-slate-100/90 text-slate-500";
    }
    return "";
  }, [scheduleCatalogActive]);

  const scheduleOptionDisabled = useCallback(
    (item) => {
      if (!scheduleCatalogActive) return false;
      if (!item?.fg_zero && !item?.balance_zero) return false;
      // Allow keeping an item already on this note (edit), even if catalog FG/balance shows 0.
      const id = String(item.id ?? "");
      const alreadyOnNote = (formItemsRef.current || []).some((row) => {
        if (!row?.item_dcode) return false;
        return scheduleCatalogSelectionKey(row) === id || String(row.item_dcode) === String(item.itemdcode);
      });
      return !alreadyOnNote;
    },
    [scheduleCatalogActive]
  );

  const itemRowFetchServices = useMemo(() => {
    if (!Array.isArray(inHandItemCatalog)) {
      return form.items.map(() => async () => ({ data: [] }));
    }
    return form.items.map((_, idx) => buildInHandItemFetchService(inHandItemCatalog, idx));
  }, [form.items.length, inHandItemCatalog, buildInHandItemFetchService]);

  const fetchItemStockBundle = useCallback(async (itemDcode, packingCategoryId, excludeFuid) => {
    const body = {
      item_dcode: itemDcode,
      packing_category_id: Number(packingCategoryId),
    };
    if (excludeFuid) body.exclude_fuid = excludeFuid;
    const [stockRes, erpRes] = await Promise.all([
      forwardingNoteService.getAvailableBoxes(body),
      forwardingNoteService.getErpStock(body),
    ]);
    const erp_qty = erpRes?.success !== false ? Number(erpRes?.total) || 0 : 0;
    const erp_by_packing =
      erpRes?.by_packing && typeof erpRes.by_packing === "object" ? erpRes.by_packing : {};
    const fifoBoxes = stockRes?.success
      ? sortBoxesForFifo(enrichForwardingBoxesWithPackingStd(stockRes.data || []))
      : [];
    return { fifoBoxes, erp_qty, erp_by_packing, ok: Boolean(stockRes?.success) };
  }, []);

    // ── Bootstrap (open form fast; stock fills in background with exclusive FIFO) ─
    const hydrateFromDispatchPlan = useCallback(async (prefill) => {
      const rows = Array.isArray(prefill)
        ? prefill
        : Array.isArray(prefill?.rows)
          ? prefill.rows
          : prefill
            ? [prefill]
            : [];
      if (!rows.length) {
        throw new Error("No schedule items to load.");
      }

      const headerRow = prefill?.anchorRow ?? rows[0];
      const accCode = headerRow?.acc_code;

      let categoryOptions = [];
      let packingCategoryId = "";
      const prefillCategory =
        prefill?.packing_category_id != null && String(prefill.packing_category_id).trim() !== ""
          ? String(prefill.packing_category_id).trim()
          : "";

      // Prefer category already chosen in schedule picker — skip waiting on API when possible.
      if (prefillCategory) {
        packingCategoryId = prefillCategory;
        if (accCode) {
          forwardingNoteService
            .getCustomerCategory({ acc_code: Number(accCode) })
            .then((catRes) => {
              const options = Array.isArray(catRes?.data?.options) ? catRes.data.options : [];
              setCategoryOpts(options);
            })
            .catch(() => {});
        }
      } else if (accCode) {
        try {
          const catRes = await forwardingNoteService.getCustomerCategory({ acc_code: Number(accCode) });
          categoryOptions = Array.isArray(catRes?.data?.options) ? catRes.data.options : [];
          const defaultId = catRes?.data?.packing_category_id;
          packingCategoryId =
            defaultId != null && defaultId !== ""
              ? String(defaultId)
              : categoryOptions[0]?.id != null
                ? String(categoryOptions[0].id)
                : "";
        } catch {
          categoryOptions = [];
        }
        setCategoryOpts(categoryOptions);
      }

      const itemRows = rows.map((row) => skeletonItemFromDispatchRow(row));
      const uniqueSchnos = [
        ...new Set(itemRows.map((i) => String(i.schno ?? "").trim()).filter(Boolean)),
      ];
      const headerSchno =
        uniqueSchnos[0] ||
        (headerRow?.schno != null && headerRow?.schno !== "" ? String(headerRow.schno).trim() : "");

      prevCategoryRef.current = packingCategoryId || "";

      return {
        form: {
          ...INITIAL_FORM,
          acc_code: accCode != null && accCode !== "" ? String(accCode) : "",
          packing_category_id: packingCategoryId,
          schno: headerSchno,
          items: itemRows,
        },
        packingCategoryId,
        enrich: true,
      };
    }, []);

    const fillScheduleItemStock = useCallback(
      async (items, packingCategoryId, cancelledRef) => {
        if (!packingCategoryId || !items?.length) return;

        // One stock fetch per item_dcode (not per row) — then exclusive FIFO allocate in row order.
        const uniqueDcodes = [
          ...new Set(items.map((i) => String(i.item_dcode ?? "").trim()).filter(Boolean)),
        ];
        const stockByDcode = new Map();
        await mapWithConcurrency(uniqueDcodes, 3, async (dcode) => {
          if (cancelledRef?.current) return;
          try {
            const bundle = await fetchItemStockBundle(dcode, packingCategoryId);
            stockByDcode.set(dcode, bundle);
          } catch {
            stockByDcode.set(dcode, { fifoBoxes: [], erp_qty: 0, erp_by_packing: {}, ok: false });
          }
        });
        if (cancelledRef?.current) return;

        const claimedByDcode = new Map(); // dcode → Set of box keys already allocated
        const enriched = items.map((itemRow) => {
          const dcode = String(itemRow.item_dcode ?? "").trim();
          const dispatchQty = Math.max(0, Number(itemRow?.source_dispatch_qty) || 0);
          const bundle = stockByDcode.get(dcode);
          if (!dcode || !bundle) {
            return { ...itemRow, fetching: false, boxes_edited: true };
          }
          if (!claimedByDcode.has(dcode)) claimedByDcode.set(dcode, new Set());
          const claimed = claimedByDcode.get(dcode);
          const remaining = (bundle.fifoBoxes || []).filter((box) => {
            const key = forwardingBoxKey(box);
            return !key || !claimed.has(key);
          });
          const ordered = reorderBoxesForSelection(remaining, false);
          const selected_boxes = dispatchQty > 0 ? selectBoxesByQty(ordered, dispatchQty) : [];
          for (const box of selected_boxes) {
            const key = forwardingBoxKey(box);
            if (key) claimed.add(key);
          }
          const roundedQty = sumQty(selected_boxes);
          return {
            ...itemRow,
            available_boxes: bundle.fifoBoxes || [],
            selected_boxes,
            loose_priority: false,
            fg_qty: sumQty(bundle.fifoBoxes || []),
            erp_qty: bundle.erp_qty,
            erp_by_packing: bundle.erp_by_packing,
            dispatch_target: dispatchQty > 0 ? String(dispatchQty) : "",
            dispatch_qty: roundedQty > 0 ? String(roundedQty) : "",
            dispatch_std: roundedQty > 0 ? String(roundedQty) : "",
            use_system_std: roundedQty > 0 && dispatchQty > 0,
            fetching: false,
            boxes_edited: true,
          };
        });

        if (cancelledRef?.current) return;

        setForm((prev) => {
          if (!prev.items?.length) return prev;
          // Replace by index when lengths match (schedule hydrate); preserve user edits mid-load.
          if (prev.items.length !== enriched.length) {
            return { ...prev, items: enriched };
          }
          const nextItems = prev.items.map((cur, idx) => {
            const fresh = enriched[idx];
            if (!fresh) return { ...cur, fetching: false };
            if (cur.boxes_edited && !cur.fetching && (cur.selected_boxes?.length || 0) > 0) {
              // User already changed this row — keep selection, attach stock pool if missing.
              if ((cur.available_boxes?.length || 0) > 0) return { ...cur, fetching: false };
              return {
                ...cur,
                available_boxes: fresh.available_boxes,
                fg_qty: fresh.fg_qty,
                erp_qty: fresh.erp_qty,
                erp_by_packing: fresh.erp_by_packing,
                fetching: false,
              };
            }
            return fresh;
          });
          return { ...prev, items: nextItems };
        });

        if (!enriched.some((item) => (item?.available_boxes?.length || 0) > 0)) {
          toast.info("No in-hand stock for these items in the selected category.");
        }
      },
      [fetchItemStockBundle]
    );

  useEffect(() => {
    if (!open) {
      setFormReady(false);
      setForm(INITIAL_FORM);
      setTransporterOpts([]);
      prevCategoryRef.current = "";
      return undefined;
    }

    let cancelled = false;
    const cancelledRef = { current: false };
    setFormReady(false);
    setErrors({});

    const hydrate = async () => {
      const fuid = parseInt(String(editData?.fuid ?? "").trim(), 10);
      const needsFetch = Boolean(fuid > 0 && (isEdit || isApprove));

      if (!needsFetch && isFromSchedule && dispatchPrefill) {
        try {
          const hydrated = await hydrateFromDispatchPlan(dispatchPrefill);
          if (cancelled) return;
          setForm(hydrated.form);
          setFormReady(true);
          // Stock/FIFO fills in background so the drawer opens immediately.
          if (hydrated.enrich && hydrated.packingCategoryId) {
            void fillScheduleItemStock(
              hydrated.form.items,
              hydrated.packingCategoryId,
              cancelledRef
            );
          }
        } catch (err) {
          if (!cancelled) {
            toast.error(err?.message || "Failed to load schedule item for forwarding note.");
            setForm({ ...INITIAL_FORM, items: [{ ...INITIAL_ITEM_ROW }] });
            setFormReady(true);
          }
        }
        return;
      }

      if (!needsFetch) {
        if (!cancelled) {
          setForm({ ...INITIAL_FORM, items: [{ ...INITIAL_ITEM_ROW }] });
          setFormReady(true);
        }
        return;
      }

      try {
        const res = await forwardingNoteService.getById(fuid);
        if (cancelled) return;
        if (!res.success || !res.data) {
          throw new Error(res?.message || "Failed to load forwarding note details.");
        }
        const fullData = res.data;

        let defaultCategoryId = null;
        let categoryOptions = [];
        if (fullData.acc_code) {
          try {
            const catRes = await forwardingNoteService.getCustomerCategory({ acc_code: Number(fullData.acc_code) });
            categoryOptions = Array.isArray(catRes?.data?.options) ? catRes.data.options : [];
            defaultCategoryId = catRes?.data?.packing_category_id ?? null;
            if (!cancelled) setCategoryOpts(categoryOptions);
          } catch {
            if (!cancelled) setCategoryOpts([]);
          }
        }

        const resolvedCategoryId =
          fullData.packing_category_id != null && fullData.packing_category_id !== ""
            ? fullData.packing_category_id
            : defaultCategoryId;

        const masterSchno =
          fullData.schno != null && String(fullData.schno).trim() !== ""
            ? String(fullData.schno).trim()
            : "";

        // Open edit immediately with saved breakdowns — stock pool loads in background (FIFO-safe).
        const quickItems = (fullData.items || []).map((i) => {
          const itemSchno =
            i.schno != null && String(i.schno).trim() !== ""
              ? String(i.schno).trim()
              : masterSchno;
          const itemDcode = i.item_dcode != null && String(i.item_dcode).trim() !== ""
            ? String(i.item_dcode).trim()
            : "";
          return {
            item_dcode: itemDcode,
            item_code: i.item_code,
            itemdesc: i.itemdesc,
            schno: itemSchno,
            available_boxes: [],
            selected_boxes: [],
            loose_priority:
              Array.isArray(i.breakdowns) &&
              i.breakdowns.some(
                (bd) => Number(bd?.loose_box || 0) > 0 || Number(bd?.loose_box_qty || 0) > 0
              ),
            fg_qty: Number(i.total_qty) || 0,
            erp_qty: 0,
            erp_by_packing: {},
            dispatch_target: i.total_qty || "",
            dispatch_qty: i.total_qty || "",
            dispatch_std: i.total_qty || "",
            source_dispatch_qty: 0,
            use_system_std: false,
            fetching: Boolean(i.item_dcode && resolvedCategoryId),
            boxes_edited: false,
            original_breakdowns: i.breakdowns || [],
          };
        });

        const categoryKey =
          resolvedCategoryId != null && resolvedCategoryId !== ""
            ? String(resolvedCategoryId)
            : "";
        prevCategoryRef.current = categoryKey;

        if (cancelled) return;
        const isScheduleLinked = Boolean(
          masterSchno || quickItems.some((row) => String(row.schno || "").trim())
        );
        setLoadedAsScheduleNote(isScheduleLinked);
        setForm({
          acc_code: fullData.acc_code || "",
          packing_category_id: categoryKey,
          po_number: fullData.po_number || "",
          schno: masterSchno,
          transporter_sel_id: "",
          transporter_name: fullData.transporter_name || "",
          transporter_id: fullData.transporter_id || "",
          vehicle_number: fullData.vehicle_number || "",
          cartage: fullData.cartage ?? "",
          customer_qty: fullData.customer_qty ?? "",
          remarks: fullData.remarks || "",
          approved: isApprove ? (fullData?.approved ?? false) : false,
          items: quickItems,
        });
        setFormReady(true);

        // Background: attach FIFO stock pool without wiping saved breakdowns.
        if (resolvedCategoryId && quickItems.length) {
          const uniqueDcodes = [
            ...new Set(quickItems.map((i) => String(i.item_dcode ?? "").trim()).filter(Boolean)),
          ];
          const stockByDcode = new Map();
          await mapWithConcurrency(uniqueDcodes, 3, async (dcode) => {
            if (cancelledRef.current) return;
            try {
              const bundle = await fetchItemStockBundle(dcode, resolvedCategoryId, fuid);
              stockByDcode.set(dcode, bundle);
            } catch {
              stockByDcode.set(dcode, { fifoBoxes: [], erp_qty: 0, erp_by_packing: {}, ok: false });
            }
          });
          if (cancelledRef.current) return;

          setForm((prev) => ({
            ...prev,
            items: prev.items.map((cur) => {
              const dcode = String(cur.item_dcode ?? "").trim();
              const bundle = stockByDcode.get(dcode);
              if (!bundle) return { ...cur, fetching: false };
              const fifoBoxes = bundle.fifoBoxes || [];
              // Keep saved breakdown path (boxes_edited false). Only attach pool for +/- later.
              const orderedBoxes = reorderBoxesForSelection(fifoBoxes, cur.loose_priority);
              const previewSelected =
                !cur.boxes_edited && Number(cur.dispatch_qty) > 0
                  ? selectBoxesByQty(orderedBoxes, Number(cur.dispatch_qty))
                  : cur.selected_boxes;
              return {
                ...cur,
                available_boxes: fifoBoxes,
                selected_boxes: cur.boxes_edited ? cur.selected_boxes : previewSelected,
                fg_qty: sumQty(fifoBoxes),
                erp_qty: bundle.erp_qty,
                erp_by_packing: bundle.erp_by_packing,
                fetching: false,
                // Never flip boxes_edited here — edit save must keep original_breakdowns until user edits.
                boxes_edited: cur.boxes_edited,
                original_breakdowns: cur.original_breakdowns,
              };
            }),
          }));
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.message || "Failed to load forwarding note details.");
          setForm({ ...INITIAL_FORM, items: [{ ...INITIAL_ITEM_ROW }] });
          setFormReady(true);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
  }, [open, editData?.fuid, isEdit, isApprove, isFromSchedule, dispatchPrefill, hydrateFromDispatchPlan, fillScheduleItemStock, fetchItemStockBundle]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const handleInputChange = (k, value) => {
    setForm((prev) => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const buildStockRequestBody = useCallback(
    (itemDcode, categoryId) => {
      const body = {
        item_dcode: itemDcode,
        exclude_fuid: editingFuid ?? undefined,
      };
      const catId = categoryId != null && String(categoryId).trim() !== "" ? Number(categoryId) : null;
      if (Number.isFinite(catId) && catId > 0) body.packing_category_id = catId;
      return body;
    },
    [editingFuid]
  );

  const loadCustomerCategory = useCallback(async (accCode) => {
    if (!accCode) {
      setCategoryOpts([]);
      setCategoryLoading(false);
      return;
    }
    setCategoryLoading(true);
    try {
      const res = await forwardingNoteService.getCustomerCategory({ acc_code: Number(accCode) });
      const options = Array.isArray(res?.data?.options) ? res.data.options : [];
      setCategoryOpts(options);
      const defaultId = res?.data?.packing_category_id;
      setForm((prev) => ({
        ...prev,
        packing_category_id:
          defaultId != null && defaultId !== ""
            ? String(defaultId)
            : options[0]?.id != null
              ? String(options[0].id)
              : "",
      }));
    } catch {
      setCategoryOpts([]);
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  const handleAccCodeChange = (id) => {
    setForm((prev) => ({
      ...prev,
      acc_code: id ?? "",
      packing_category_id: "",
      transporter_sel_id: "",
      transporter_name: "",
      transporter_id: "",
      ...(scheduleCatalogActive && mode === "add"
        ? { items: [{ ...INITIAL_ITEM_ROW }] }
        : {}),
    }));
    if (id) void loadCustomerCategory(id);
    else setCategoryOpts([]);
    if (errors.acc_code) setErrors((prev) => ({ ...prev, acc_code: "" }));
  };

  const loadTransporterSuggestions = useCallback(async (accCode, search = "") => {
    if (!accCode) { setTransporterOpts([]); return; }
    try {
      const res = await forwardingNoteService.getTransporters({
        acc_code: Number(accCode),
        search,
      });
      const list = Array.isArray(res?.data) ? res.data : [];
      setTransporterOpts(withSortedViewsData(list, "transporter_name"));
    } catch {
      setTransporterOpts([]);
    }
  }, []);

  useEffect(() => {
    if (!open || !formReady) return;
    if (!form.acc_code) { setTransporterOpts([]); return; }
    loadTransporterSuggestions(form.acc_code, "");
  }, [open, formReady, form.acc_code, loadTransporterSuggestions]);

  const handleTransporterPick = (opt) => {
    setForm((prev) => ({
      ...prev,
      transporter_name: opt?.transporter_name ?? prev.transporter_name,
      transporter_id: opt?.transporter_id ?? prev.transporter_id,
    }));
  };

  // ── Item Row Helpers ───────────────────────────────────────────────────────
  const updateItemRow = (idx, updates) => {
    setForm((prev) => {
      const nextItems = prev.items.map((item, i) => (i === idx ? { ...item, ...updates } : item));
      formItemsRef.current = nextItems;
      return { ...prev, items: nextItems };
    });
  };

  const addRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...INITIAL_ITEM_ROW }]
    }));
  };

  const removeRow = (idx) => {
    if (form.items.length === 1) {
      updateItemRow(0, INITIAL_ITEM_ROW);
      return;
    }
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const fetchItemStock = useCallback(
    async (idx, itemDcode, categoryId, { resetSelection = true } = {}) => {
      const catId = categoryId != null && String(categoryId).trim() !== "" ? String(categoryId) : "";
      if (!catId) {
        updateItemRow(idx, {
          available_boxes: [],
          selected_boxes: [],
          loose_priority: false,
          fg_qty: 0,
          erp_qty: 0,
          erp_by_packing: {},
          dispatch_qty: "",
          fetching: false,
          boxes_edited: true,
          original_breakdowns: [],
        });
        return;
      }

      updateItemRow(idx, { fetching: true });
      try {
        const body = buildStockRequestBody(itemDcode, categoryId);
        const [res, erpRes] = await Promise.all([
          forwardingNoteService.getAvailableBoxes(body),
          forwardingNoteService.getErpStock(body),
        ]);

        const erp_qty = erpRes?.success !== false ? Number(erpRes?.total) || 0 : 0;
        const erp_by_packing =
          erpRes?.by_packing && typeof erpRes.by_packing === "object" ? erpRes.by_packing : {};

        if (res.success) {
          const fifoBoxes = sortBoxesForFifo(enrichForwardingBoxesWithPackingStd(res.data || []));
          const fg_qty = sumQty(fifoBoxes);
          const updates = {
            available_boxes: fifoBoxes,
            fg_qty,
            erp_qty,
            erp_by_packing,
            fetching: false,
          };
          if (resetSelection) {
            const sourceQty = Number(formItemsRef.current[idx]?.source_dispatch_qty ?? 0);
            if (sourceQty > 0) {
              const ordered = reorderBoxesForSelection(fifoBoxes, false);
              const selected_boxes = selectBoxesByQty(ordered, sourceQty);
              const roundedQty = sumQty(selected_boxes);
              Object.assign(updates, {
                selected_boxes,
                loose_priority: false,
                dispatch_target: String(sourceQty),
                dispatch_qty: roundedQty > 0 ? String(roundedQty) : "",
                dispatch_std: roundedQty > 0 ? String(roundedQty) : "",
                use_system_std: roundedQty > 0 && sourceQty > 0,
                boxes_edited: true,
                original_breakdowns: [],
              });
            } else {
              Object.assign(updates, {
                selected_boxes: [],
                loose_priority: false,
                dispatch_qty: "",
                boxes_edited: true,
                original_breakdowns: [],
              });
            }
          }
          updateItemRow(idx, updates);
          if (fifoBoxes.length === 0) {
            toast.info("No stock for this item in the selected category.");
          }
        } else {
          updateItemRow(idx, {
            available_boxes: [],
            fg_qty: 0,
            erp_qty,
            erp_by_packing,
            fetching: false,
            ...(resetSelection
              ? {
                  selected_boxes: [],
                  dispatch_qty: "",
                  boxes_edited: true,
                  original_breakdowns: [],
                }
              : {}),
          });
        }
      } catch (err) {
        updateItemRow(idx, { fetching: false });
        toast.error(err?.message || "Failed to fetch available stock for this item.");
      }
    },
    [buildStockRequestBody]
  );

  const handleCategoryChange = (categoryId) => {
    if (!categoryId) return;
    // Stock reload is handled by the packing_category_id effect (avoids double API hit).
    handleInputChange("packing_category_id", categoryId);
  };

  useEffect(() => {
    if (!open || !formReady || categoryLoading) return;
    const cat = String(form.packing_category_id ?? "");
    const prev = prevCategoryRef.current;
    prevCategoryRef.current = cat;
    // Only refetch when category changes from one value to another — not on the
    // initial assignment after edit/approve hydrate (that would wipe saved qty/boxes).
    if (!cat || cat === prev || !prev) return;

    if (isFromSchedule) {
      // Re-allocate exclusive FIFO for all schedule rows (same item must not double-claim).
      const snapshot = (formItemsRef.current || []).map((item) => ({
        ...item,
        fetching: Boolean(item.item_dcode),
        selected_boxes: [],
        boxes_edited: false,
      }));
      setForm((prevForm) => ({
        ...prevForm,
        items: snapshot,
      }));
      void fillScheduleItemStock(snapshot, cat, { current: false });
      return;
    }

    formItemsRef.current.forEach((item, idx) => {
      if (item.item_dcode) void fetchItemStock(idx, item.item_dcode, cat);
    });
  }, [open, formReady, categoryLoading, form.packing_category_id, fetchItemStock, isFromSchedule, fillScheduleItemStock]);

  // ── Item select — fetch boxes from API ────────────────────────────────────
  const handleItemChange = async (idx, id, rawData) => {
    if (!id) {
      updateItemRow(idx, INITIAL_ITEM_ROW);
      return;
    }

    const scheduleSchno =
      rawData?.schno != null && String(rawData.schno).trim() !== ""
        ? String(rawData.schno).trim()
        : String(String(id).includes("::") ? String(id).split("::")[0] : "").trim();
    const itemDcode = String(
      rawData?.itemdcode ??
        rawData?.item_dcode ??
        (String(id).includes("::") ? String(id).split("::")[1] : id) ??
        ""
    ).trim();

    if (!itemDcode) {
      toast.warning("Invalid item selection.");
      return;
    }

    const duplicateSelected = form.items.some((row, rowIdx) => {
      if (rowIdx === idx) return false;
      if (String(row.item_dcode) !== String(itemDcode)) return false;
      const curSchno = scheduleSchno || String(form.items[idx]?.schno ?? "").trim();
      const rowSchno = String(row?.schno ?? "").trim();
      // Allow same item on different schedule lines.
      if (curSchno && rowSchno && curSchno !== rowSchno) return false;
      return true;
    });
    if (duplicateSelected) {
      toast.warning("This item is already selected in another row.");
      return;
    }

    if (categoryLoading) {
      toast.info("Category is still loading. Please wait a moment.");
      return;
    }
    if (form.acc_code && !form.packing_category_id) {
      toast.error("Please select a category before adding items.");
      return;
    }

    if (scheduleCatalogActive) {
      const fg = Number(rawData?.fg_stock_qty ?? 0);
      if (!(fg > 0) || rawData?.fg_zero) {
        toast.warning("This item has no FG stock and cannot be added.");
        return;
      }
      const balCheck = Number(rawData?.balance_qty ?? rawData?.source_dispatch_qty ?? 0);
      if (!(balCheck > 0) || rawData?.balance_zero) {
        toast.warning("This item has no remaining schedule balance and cannot be added.");
        return;
      }
    }

    const balanceQty = scheduleCatalogActive
      ? Math.max(
          0,
          Number.isFinite(Number(rawData?.balance_qty ?? rawData?.source_dispatch_qty))
            ? Number(rawData.balance_qty ?? rawData.source_dispatch_qty)
            : 0
        )
      : 0;

    updateItemRow(idx, {
      item_dcode:      itemDcode,
      item_code:       rawData?.item_code || "",
      itemdesc:        rawData?.itemdesc  || "",
      schno:           scheduleCatalogActive ? scheduleSchno : "",
      source_dispatch_qty: scheduleCatalogActive ? balanceQty : 0,
      available_boxes: [],
      selected_boxes:  [],
      loose_priority:  false,
      fg_qty:          0,
      erp_qty:         0,
      erp_by_packing:  {},
      dispatch_qty:    "",
      dispatch_target: scheduleCatalogActive && balanceQty > 0 ? String(balanceQty) : "",
      dispatch_std:    "",
      fetching:        true,
      boxes_edited:    false,
      original_breakdowns: [],
    });

    await fetchItemStock(idx, itemDcode, form.packing_category_id, { resetSelection: true });
  };

  const handleDispatchQtyFocus = (idx) => {
    setEditingDispatchIdx(idx);
  };

  const handleDispatchQtyChange = (idx, val) => {
    if (val === "" || val == null) {
      updateItemRow(idx, { dispatch_target: "" });
      return;
    }
    if (!/^\d+$/.test(String(val))) return;
    updateItemRow(idx, { dispatch_target: String(val) });
  };

  const handleDispatchQtyBlur = (idx) => {
    setEditingDispatchIdx((cur) => (cur === idx ? null : cur));
    const item = form.items[idx];
    const balanceCap = Number(item.source_dispatch_qty ?? 0);
    const raw =
      item.dispatch_target === "" || item.dispatch_target == null
        ? ""
        : String(item.dispatch_target);
    // Exclusive FIFO pool — never reuse boxes already claimed by another row of same item.
    const pooled = { ...item, available_boxes: fifoPoolForRow(form.items, idx) };

    if (balanceCap > 0 || raw !== "") {
      const next = resolveDispatchQtySelection(pooled, raw, {
        emptyMeansSystem: balanceCap > 0,
      });
      if (next) updateItemRow(idx, next);
      return;
    }

    updateItemRow(idx, {
      dispatch_target: "",
      dispatch_qty: "",
      selected_boxes: [],
      dispatch_std: "",
      use_system_std: false,
      boxes_edited: true,
    });
  };

  const handleBoxChange = (idx, type) => {
    const item = form.items[idx];
    const orderedBoxes = reorderBoxesForSelection(
      fifoPoolForRow(form.items, idx),
      item.loose_priority
    );
    if (!orderedBoxes.length) return;

    let prefix = getFifoPrefixFromSelection(orderedBoxes, item.selected_boxes);

    if (
      isEdit &&
      !item.boxes_edited &&
      prefix.length === 0 &&
      getItemFifoTarget(item) > 0
    ) {
      prefix = selectBoxesByQty(orderedBoxes, getItemFifoTarget(item));
    }

    // If selection keys do not form a clean prefix, rebuild from selected count so +/- still works.
    let newCount =
      prefix.length > 0
        ? prefix.length
        : Array.isArray(item.selected_boxes)
          ? item.selected_boxes.length
          : 0;

    const fifoLimit = maxFifoBoxesForItem(
      { ...item, available_boxes: orderedBoxes },
      orderedBoxes
    );

    if (type === "add") {
      if (newCount >= fifoLimit || newCount >= orderedBoxes.length) return;
      newCount += 1;
    } else {
      if (newCount <= 0) return;
      newCount -= 1;
    }

    const newSelected = orderedBoxes.slice(0, newCount);
    const stdQty = sumQty(newSelected);

    updateItemRow(idx, {
      selected_boxes: newSelected,
      dispatch_qty: stdQty > 0 ? String(stdQty) : "",
      dispatch_std: stdQty > 0 ? String(stdQty) : "",
      // Keep target in sync with box +/- so Dispatch Qty blur does not rebuild old FIFO.
      dispatch_target: stdQty > 0 ? String(stdQty) : "",
      use_system_std: false,
      boxes_edited: true,
    });
  };

  const handleLoosePriorityToggle = (idx, checked) => {
    const item = form.items[idx];
    const pooled = {
      ...item,
      loose_priority: checked,
      available_boxes: fifoPoolForRow(form.items, idx),
    };
    const target = getItemFifoTarget(pooled);
    const next =
      target > 0
        ? buildDispatchFromTarget(pooled, target)
        : {
            dispatch_target: "",
            dispatch_qty: "",
            selected_boxes: [],
            dispatch_std: "",
            use_system_std: false,
            boxes_edited: true,
          };
    setEditingDispatchIdx((cur) => (cur === idx ? null : cur));
    updateItemRow(idx, { loose_priority: checked, ...next });
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (statusOverride = null) => {
    const newErrors = {};
    if (!form.acc_code?.toString().trim()) newErrors.acc_code = "Customer / Account required";
    if (!form.po_number?.trim()) newErrors.po_number = "PO Number required";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      toast.error("Please fill all required fields before saving.");
      focusFirstError(newErrors, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }

    if (form.items.some((i) => i.fetching)) {
      toast.info("Stock is still loading. Please wait, then save.");
      return;
    }

    const validItems = form.items.filter(
      (i) => i.item_dcode && (i.selected_boxes.length > 0 || (!i.boxes_edited && i.original_breakdowns?.length > 0))
    );
    if (!validItems.length) return toast.error("Please add at least one item with boxes to proceed.");
    if (!sopAckRef.current?.assertAcknowledged()) return;

    setSaving(true);
    try {
      let finalApproved = form.approved;
      if (statusOverride !== null) {
        finalApproved = statusOverride;
      } else if (isEdit && editData?.approved) {
        finalApproved = false;
      }

      const { transporter_sel_id: _tid, ...formRest } = form;
      const payload = {
        ...formRest,
        acc_code: parseInt(form.acc_code) || null,
        packing_category_id: form.packing_category_id ? parseInt(form.packing_category_id, 10) : null,
        schno:
          form.schno?.trim() ||
          validItems.map((i) => String(i.schno ?? "").trim()).find(Boolean) ||
          null,
        cartage: parseFloat(form.cartage) || 0,
        customer_qty: parseInt(form.customer_qty) || 0,
        approved: finalApproved,
        total_items: validItems.reduce((s, i) => s + itemStdQty(i), 0),
        items:       validItems.flatMap(i => {
          const itemSchno =
            i.schno != null && String(i.schno).trim() !== ""
              ? String(i.schno).trim()
              : form.schno?.trim() || null;
          if (i.selected_boxes.length > 0) {
            return [{
              item_dcode: i.item_dcode,
              item_code:  i.item_code,
              itemdesc:   i.itemdesc,
              schno:      itemSchno,
              qty:        sumQty(i.selected_boxes),
              selected_boxes: i.selected_boxes,
            }];
          }
          if (!i.boxes_edited && i.original_breakdowns?.length > 0) {
            return i.original_breakdowns.map(bd => ({
              item_dcode: i.item_dcode,
              item_code:  i.item_code,
              itemdesc:   i.itemdesc,
              schno:      itemSchno || (bd.schno != null ? String(bd.schno).trim() : null),
              qty:        bd.total_qty,
              packing_number: bd.packing_number,
              box:        bd.box,
              box_qty:    bd.box_qty,
              loose_box:  bd.loose_box,
              loose_box_qty: bd.loose_box_qty,
              total_qty:  bd.total_qty,
              is_pre_calculated: true
            }));
          }
          return [];
        }),
      };

      if (isEdit || isApprove) {
        await forwardingNoteService.update(editData.fuid, payload);
        toast.success("Forwarding note updated successfully.");
      } else {
        await forwardingNoteService.create(payload);
        toast.success("Forwarding note created successfully.");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const hydrateLabel = isApprove
    ? "Loading approval data..."
    : isEdit
      ? "Loading forwarding note..."
      : "Preparing form...";

  const hydrateHint = isEdit || isApprove
    ? "Note opens first; FG stock fills in background."
    : isFromSchedule
      ? "Form opens first; FG stock / FIFO fills in background."
      : "Setting up a new forwarding note.";

  // ── Derived ────────────────────────────────────────────────────────────────
  const confirmedTotal = form.items.reduce((s, i) => s + itemStdQty(i), 0);
  const customerQty    = parseInt(form.customer_qty) || 0;
  const isQtyExceeded  = !isFromSchedule && customerQty > 0 && confirmedTotal > customerQty;
  const stockLoading   = form.items.some((i) => i.fetching);
  const saveDisabled   = !formReady || saving || stockLoading;

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footer = (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
      
      {/* Left: warning or empty */}
      {isQtyExceeded ? (
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 w-full sm:w-auto">
          <AlertCircle size={14} className="shrink-0" />
          <span className="text-[11px] font-bold leading-snug">
            Dispatched quantity ({confirmedTotal.toLocaleString()}) exceeds customer order quantity ({customerQty.toLocaleString()})
          </span>
        </div>
      ) : stockLoading ? (
        <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 w-full sm:w-auto">
          <Loader2 size={14} className="shrink-0 animate-spin" />
          <span className="text-[11px] font-bold leading-snug">Loading FG stock / FIFO…</span>
        </div>
      ) : <div className="hidden sm:block" />}

      {/* Right — buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
        <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-bold text-slate-500 w-full sm:w-auto">
          Cancel
        </button>
        {isApprove ? (
          <>
            <button
              onClick={() => handleSave(false)}
              disabled={saveDisabled}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-40 w-full sm:w-auto"
            >
              Keep Pending
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saveDisabled}
              className="min-w-[140px] w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-40"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
            </button>
          </>
        ) : (
          <button
            onClick={() => handleSave()}
            disabled={saveDisabled || isQtyExceeded}
            className="min-w-[140px] w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-indigo-400 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Loader2 size={18} className="animate-spin" /> Processing</>
            ) : (
              <><Check size={18} /> Save</>
            )}
          </button>
        )}
      </div>
    </div>
  );
  

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => {
        if (!formReady || saving || form.items.some((i) => i.fetching)) return;
        handleSave(isApprove ? true : undefined);
      }}
      title={isApprove ? "Approve Note" : isEdit ? "Edit Note" : "New Forwarding Note"}
      description={
        isFromSchedule
          ? scheduleSchnos.length > 1
            ? `${scheduleSchnos.length} schedules · one customer`
            : `From schedule ${scheduleLabel}`
          : "Create note for dispatch"
      }
      footer={footer}
      maxWidth="max-w-4xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        {!formReady ? (
          <FormPanelLoader label={hydrateLabel} hint={hydrateHint} minHeight="min-h-[280px]" />
        ) : (
        <>
        {isFromSchedule && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
            <AlertCircle size={16} className="text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-indigo-700 font-medium leading-normal">
              One customer · each item row has its own Sch No + Balance (multiple schedules OK). Change{" "}
              <span className="font-bold text-indigo-900 uppercase">Category</span> or{" "}
              <span className="font-bold text-indigo-900 uppercase">Dispatch Qty</span> as needed, remove extra rows, then fill PO and save.
              {form.items.some((i) => i.fetching) ? (
                <span className="block mt-1 text-indigo-500 font-semibold">Loading FG stock…</span>
              ) : null}
            </p>
          </div>
        )}

        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized forwarding note will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        {/* ── Header fields ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          <div className={`space-y-1 relative ${isFromSchedule ? "md:col-span-2 pointer-events-none" : "md:col-span-2"}`} data-field="acc_code">
            <SearchableSelect 
              label="Customer / Account"
              required
              value={form.acc_code}
              onChange={handleAccCodeChange}
              error={errors.acc_code || ""}
              disabled={isFromSchedule}
              fetchService={(params) => masterService.getLedgersViews({ 
                ...params, 
                permission_module: "forwarding_note_master", 
                permission_action: "view" 
              })}
              getByIdService={(id) => masterService.getLedgerViewById(id, { 
                permission_module: "forwarding_note_master", 
                permission_action: "view" 
              })}
              dataKey="id"
              labelKey="acc_name"
            />
          </div>

          {/* {form.acc_code ? ( */}
            <div className="md:col-span-1 space-y-1">
              <label className={FORM_LABEL_CLASS}>Category</label>
              <select
                value={String(form.packing_category_id ?? "")}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={!form.acc_code || categoryLoading}
                className={`${OK_INPUT} rounded-lg border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
              >
                {!form.acc_code ? (
                  <option value="">Select customer first</option>
                ) : categoryLoading ? (
                  <option value="">Loading category…</option>
                ) : categoryOpts.length === 0 ? (
                  <option value="">No categories</option>
                ) : (
                  categoryOpts.map((opt) => (
                    <option key={opt.id} value={String(opt.id)}>{opt.name}</option>
                  ))
                )}
              </select>
            </div>
          {/* ) : null} */}

          {/* Sch No lives on each item row — header field is unused for multi-schedule. */}

          {/* Transporter — suggestions from previous forwarding notes (per customer) + manual entry */}
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
            <div className="md:col-span-2 space-y-1 relative">
              <label className={FORM_LABEL_CLASS}>Transporter Name</label>
              {/* <input
                value={form.transporter_name}
                onChange={(e) => {
                  const v = e.target.value;
                  handleInputChange("transporter_name", v);
                  if (form.acc_code) loadTransporterSuggestions(form.acc_code, v);
                  setTransporterOpen(true);
                }}
                placeholder={form.acc_code ? "Type or pick from suggestions…" : "Select customer first"}
                disabled={!form.acc_code}
                className={`${OK_INPUT} rounded-lg border-slate-200`}
                onFocus={() => setTransporterOpen(true)}
                onBlur={() => setTimeout(() => setTransporterOpen(false), 120)}
              /> */}

              <input
                value={form.transporter_name}
                onChange={(e) => {
                  const v = e.target.value;
                  handleInputChange("transporter_name", v);
                  if (form.acc_code) loadTransporterSuggestions(form.acc_code, v);
                  setTransporterOpen(true);
                  setTransporterHighlight(-1);
                }}
                placeholder={form.acc_code ? "Type or pick from suggestions…" : "Select customer first"}
                disabled={!form.acc_code}
                className={`${OK_INPUT} rounded-lg border-slate-200`}
                onFocus={() => setTransporterOpen(true)}
                onBlur={() => setTimeout(() => setTransporterOpen(false), 120)}
                onKeyDown={(e) => {
                  if (!transporterOpen || transporterOpts.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setTransporterHighlight((prev) => Math.min(prev + 1, transporterOpts.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setTransporterHighlight((prev) => Math.max(prev - 1, 0));
                  } else if (e.key === "Enter" && transporterHighlight >= 0) {
                    e.preventDefault();
                    handleTransporterPick(transporterOpts[transporterHighlight]);
                    setTransporterOpen(false);
                    setTransporterHighlight(-1);
                  } else if (e.key === "Escape") {
                    setTransporterOpen(false);
                    setTransporterHighlight(-1);
                  }
                }}
              />

              {/* {transporterOpen && form.acc_code && transporterOpts.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-[80] max-h-56 overflow-auto">
                  {transporterOpts.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onMouseDown={(e) => {
                        // keep focus stable; prevent blur closing before click
                        e.preventDefault();
                        handleTransporterPick(o);
                        setTransporterOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50/40"
                    >
                      <div className="text-[11px] font-bold text-slate-700">{o.transporter_name}</div>
                      {o.transporter_id ? (
                        <div className="text-[10px] text-slate-400 font-mono">ID: {o.transporter_id}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              )} */}

              {transporterOpen && form.acc_code && transporterOpts.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-[80] max-h-56 overflow-auto">
                  {transporterOpts.map((o, idx) => (
                    <button
                      key={o.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleTransporterPick(o);
                        setTransporterOpen(false);
                        setTransporterHighlight(-1);
                      }}
                      onMouseEnter={() => setTransporterHighlight(idx)}
                      className={`w-full text-left px-3 py-2 ${transporterHighlight === idx ? "bg-indigo-50" : "hover:bg-indigo-50/40"}`}
                    >
                      <div className="text-[11px] font-bold text-slate-700">{o.transporter_name}</div>
                      {o.transporter_id ? (
                        <div className="text-[10px] text-slate-400 font-mono">ID: {o.transporter_id}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className={FORM_LABEL_CLASS}>Transporter ID</label>
              <input
                value={form.transporter_id}
                onChange={(e) => handleInputChange("transporter_id", e.target.value)}
                placeholder="GST / ID"
                disabled={!form.acc_code}
                className={`${OK_INPUT} rounded-lg border-slate-200`}
              />
            </div>
          </div>

          {/* PO Number */}
          <div className="space-y-1">
            <label className={FORM_LABEL_CLASS}>PO Number *</label>
            <input
              data-field="po_number"
              value={form.po_number}
              onChange={(e) => handleInputChange("po_number", e.target.value)}
              placeholder="PO-XXXX"
              className={`${OK_INPUT} rounded-lg ${errors.po_number ? "border-rose-500 bg-rose-50" : "border-slate-200"}`}
            />
            {errors.po_number && (
              <p className={FORM_ERROR_CLASS}>
                <AlertCircle size={10} /> {errors.po_number}
              </p>
            )}
          </div>

          {/* Vehicle No */}
          <div className="space-y-1">
            <label className={FORM_LABEL_CLASS}>Vehicle No</label>
            <input
              value={form.vehicle_number}
              onChange={(e) => handleInputChange("vehicle_number", e.target.value)}
              placeholder="XX-00-XX-0000"
              className={`${OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200`}
            />
          </div>

          {/* Cartage */}
          <div className="space-y-1 min-w-0">
            <label className={FORM_LABEL_CLASS}>Cartage</label>
            <input
              type="number"
              value={form.cartage}
              onChange={(e) => handleInputChange("cartage", e.target.value)}
              placeholder="0"
              className={`${OK_INPUT} w-full rounded-lg border-slate-200`}
            />
          </div>
        </div>

        {/* ── Item Section ── */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 shadow-inner">
          <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                  <Package size={14} className="text-indigo-600" />
                  <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Item Breakdown</h3>
              </div>
              <div className="flex items-center gap-2">
                  {customerQty > 0 && !isFromSchedule && (
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                          isQtyExceeded
                          ? "bg-rose-50 border-rose-200 text-rose-600"
                          : confirmedTotal === customerQty
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                          : "bg-indigo-50 border-indigo-200 text-indigo-600"
                      }`}>
                          <span>{confirmedTotal.toLocaleString()} / {customerQty.toLocaleString()}</span>
                      </div>
                  )}
              </div>
          </div>

          {/* ── Item Rows ── */}
          <div className="space-y-3">
            {form.items.map((item, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2.5 relative group/row shadow-sm">
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className={`${FORM_MICRO_LABEL_CLASS} text-slate-400`}>Row #{idx + 1}</span>
                    {item.schno ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[10px] font-black uppercase tracking-wide text-indigo-800 font-mono">
                        Sch {item.schno}
                      </span>
                    ) : null}
                    {(isFromSchedule || scheduleCatalogActive || Number(item.source_dispatch_qty) > 0) &&
                    (item.schno || Number(item.source_dispatch_qty) > 0 || scheduleCatalogActive) ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide shadow-sm tabular-nums ${
                          Number(item.source_dispatch_qty) > 0
                            ? "bg-amber-100 border-amber-300 text-amber-900"
                            : "bg-slate-100 border-slate-300 text-slate-600"
                        }`}
                      >
                        <span className="opacity-80 font-bold">Balance</span>
                        <span>
                          {item.fetching ? "…" : Number(item.source_dispatch_qty || 0).toLocaleString()}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={`inline-flex items-center gap-1.5 ${FORM_MICRO_LABEL_CLASS} text-slate-500`}>
                      <input
                        type="checkbox"
                        checked={!!item.loose_priority}
                        onChange={(e) => handleLoosePriorityToggle(idx, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-amber-600"
                      />
                      Loose Priority
                    </label>
                    {form.items.length > 1 && (
                      <button
                        onClick={() => removeRow(idx)}
                        className="p-1 text-rose-400 hover:bg-rose-50 rounded-md transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-2 items-end">
                  {/* Search Item */}
                  <div className={`col-span-2 sm:col-span-4 lg:col-span-3 text-[11px] min-w-0 ${isFromSchedule ? "pointer-events-none" : ""}`}>
                    <SearchableSelect
                      label="Search Item"
                      value={
                        scheduleCatalogActive && item.schno && item.item_dcode
                          ? `${item.schno}::${item.item_dcode}`
                          : item.item_dcode
                      }
                      onChange={(id, raw) => handleItemChange(idx, id, raw)}
                      fetchService={itemRowFetchServices[idx]}
                      getByIdService={getItemById}
                      dataKey="id"
                      labelKey="item_code"
                      subLabelKey={scheduleCatalogActive ? "schedule_hint" : "itemdesc"}
                      getOptionClassName={scheduleCatalogActive ? scheduleOptionClassName : undefined}
                      isOptionDisabled={scheduleCatalogActive ? scheduleOptionDisabled : undefined}
                      disabled={isFromSchedule || !form.acc_code || categoryLoading || !form.packing_category_id}
                      emptyMessage={
                        !form.acc_code
                          ? "Select a customer first"
                          : categoryLoading
                            ? "Loading category…"
                            : !form.packing_category_id
                              ? "Select a category first"
                              : scheduleCatalogActive
                                ? "No open schedule items for this customer"
                                : "No items with in-hand stock"
                      }
                    />
                  </div>

                  {/* ERP Stock */}
                  <div className="lg:col-span-2 space-y-0.5 min-w-0">
                    <label className={`${FORM_MICRO_LABEL_CLASS} text-slate-600 block ml-1`}>ERP Stock</label>
                    <div className="bg-slate-700 text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-xs">
                      {item.fetching ? (
                        <Loader2 size={14} className="animate-spin opacity-80" />
                      ) : (
                        (Number(item.erp_qty) || 0).toLocaleString()
                      )}
                    </div>
                  </div>

                  {/* FG Stock */}
                  <div className="lg:col-span-2 space-y-0.5 min-w-0">
                    <label
                      className={`${FORM_MICRO_LABEL_CLASS} block ml-1 ${
                        Number(item.fg_qty) > 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      FG Stock
                    </label>
                    <div
                      className={`text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-xs ${
                        Number(item.fg_qty) > 0 ? "bg-emerald-600" : "bg-rose-500"
                      }`}
                    >
                      {item.fetching ? (
                        <Loader2 size={14} className="animate-spin opacity-80" />
                      ) : (
                        (Number(item.fg_qty) || 0).toLocaleString()
                      )}
                    </div>
                  </div>

                  {/* Dispatch Qty — system FIFO qty after user target */}
                  <div className="lg:col-span-2 space-y-0.5 min-w-0">
                    <label className={`${FORM_MICRO_LABEL_CLASS} block ml-1`}>Dispatch Qty</label>
                    <input
                      type="number"
                      value={
                        editingDispatchIdx === idx
                          ? (item.dispatch_target ?? "")
                          : (item.dispatch_qty ?? "")
                      }
                      onFocus={() => handleDispatchQtyFocus(idx)}
                      onChange={(e) => handleDispatchQtyChange(idx, e.target.value)}
                      onBlur={() => handleDispatchQtyBlur(idx)}
                      min={0}
                      max={item.source_dispatch_qty > 0 ? item.source_dispatch_qty : item.fg_qty || undefined}
                      title="Type qty, then Tab/click away — system FIFO total fills here"
                      className={`${OK_INPUT} text-center font-bold text-slate-700 h-[38px] text-[11px] rounded-lg border-slate-200`}
                      placeholder="0"
                    />
                  </div>

                  {/* Boxes (FIFO) */}
                  <div className="lg:col-span-2 space-y-0.5">
                    <label className={`${FORM_MICRO_LABEL_CLASS} block ml-1`}>Boxes</label>
                    <div className="flex items-center justify-between gap-1 h-[38px] px-1.5 border border-slate-200 rounded-lg bg-white shadow-sm">
                      <button
                        onClick={() => handleBoxChange(idx, 'remove')}
                        disabled={!item.selected_boxes.length}
                        className="w-7 h-7 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-md transition-all disabled:opacity-30 font-black text-lg border border-rose-50"
                      >-</button>
                      <div className="flex flex-col items-center justify-center min-w-[40px]">
                        <span className="text-[11px] font-black text-slate-700 leading-none">
                          {itemSelectedBoxCount(item)}
                        </span>
                        <div className="h-[1px] w-3 bg-slate-200 my-0.5" />
                        <span className="text-[11px] sm:text-xs font-bold text-slate-400 leading-none">{item.available_boxes.length}</span>
                      </div>
                      <button
                        onClick={() => handleBoxChange(idx, 'add')}
                        disabled={!canAddMoreFifoBoxes(item)}
                        title={
                          !canAddMoreFifoBoxes(item)
                            ? Number(item.source_dispatch_qty) > 0
                              ? `FIFO max for balance ${Number(item.source_dispatch_qty).toLocaleString()}`
                              : Number(item.fg_qty) > 0
                                ? `FIFO max for FG stock ${Number(item.fg_qty).toLocaleString()}`
                                : undefined
                            : undefined
                        }
                        className="w-7 h-7 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 rounded-md transition-all disabled:opacity-30 font-black text-lg border border-indigo-50"
                      >+</button>
                    </div>
                  </div>

                  {/* Dispatch Std QTY */}
                  <div className="lg:col-span-1 space-y-0.5">
                    <label className={`${FORM_MICRO_LABEL_CLASS} text-indigo-600 block ml-1`}>Std QTY</label>
                    <div className="bg-indigo-600 text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-xs">
                      {itemStdQty(item).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* ERP by packing — collapsed by default, total already in box above */}
                {/* 
                {item.item_dcode && !item.fetching && erpPackingEntries(item).length > 0 && (
                  <details className="mt-1 rounded-md border border-slate-200 overflow-hidden text-xs group">
                    <summary className="flex items-center justify-between gap-2 px-2 py-1 bg-slate-50 cursor-pointer select-none hover:bg-slate-100 list-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600 min-w-0">
                        <ChevronRight
                          size={12}
                          className="shrink-0 text-slate-400 transition-transform group-open:rotate-90"
                        />
                        ERP by packing
                        <span className="font-normal text-slate-400">({erpPackingEntries(item).length})</span>
                      </span>
                      <span className="text-[9px] text-slate-400 shrink-0">tap to view</span>
                    </summary>
                    <div className="border-t border-slate-100 bg-white max-h-24 overflow-y-auto divide-y divide-slate-50">
                      {erpPackingEntries(item).map(({ packingNo, qty }) => (
                        <div
                          key={packingNo}
                          className="flex items-center justify-between gap-2 px-2 py-0.5 hover:bg-slate-50/80"
                        >
                          <span className="font-bold text-slate-500">#{packingNo}</span>
                          <span className="font-black text-slate-700 tabular-nums">{qty.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                */}

                {/* Table Breakdown */}
                {item.item_dcode && (() => {
                  const display = itemBoxDisplay(item);
                  const showTable = display.fromSelection
                    ? display.boxes.length > 0
                    : (display.breakdowns?.length > 0);
                  if (!showTable) return null;
                  return (
                  <div className="mt-1.5 border border-slate-100 rounded-md overflow-x-auto">
                    <table className="w-full min-w-[280px] text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-2 py-1 text-left font-black text-slate-400 uppercase">Packing #</th>
                          <th className="px-2 py-1 text-center font-black text-slate-400 uppercase">Open Boxes</th>
                          <th className="px-2 py-1 text-center font-black text-slate-400 uppercase">Loose Boxes</th>
                          <th className="px-2 py-1 text-right font-black text-slate-400 uppercase">Total</th>
                          <th className="px-2 py-1 text-right font-black text-yellow-500 uppercase">ERP Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {display.fromSelection ? (
                          (() => {
                            const groups = [];
                            const groupMap = new Map();
                            display.boxes.forEach(box => {
                              const pNo = box.packing_number || "N/A";
                              if (!groupMap.has(pNo)) {
                                const newGroup = { packingNo: pNo, boxes: [] };
                                groupMap.set(pNo, newGroup);
                                groups.push(newGroup);
                              }
                              groupMap.get(pNo).boxes.push(box);
                            });
                            return groups.map(({ packingNo, boxes }) => {
                              const openBoxes = boxes.filter(b => !isForwardingLooseBox(b));
                              const looseBoxes = boxes.filter(b => isForwardingLooseBox(b));
                              const openQty = sumQty(openBoxes);
                              const looseQty = sumQty(looseBoxes);
                              const boxFmtOpts = item.loose_priority ? { qtyOrder: "selection" } : undefined;
                              return (
                                <tr key={packingNo} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-2 py-1 font-bold text-slate-600">#{packingNo}</td>
                                  <td className="px-2 py-1 text-center">
                                    {openBoxes.length > 0 ? (
                                      <span className="text-indigo-600 font-bold">{formatBoxQtyGroups(openBoxes, boxFmtOpts)}</span>
                                    ) : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    {looseBoxes.length > 0 ? (
                                      <span className="text-amber-600 font-bold">{formatBoxQtyGroups(looseBoxes, boxFmtOpts)}</span>
                                    ) : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-right font-black text-slate-700">{(openQty + looseQty).toLocaleString()}</td>
                                  <td className="px-2 py-1 text-right font-bold text-slate-700 tabular-nums">{erpQtyForPacking(item, packingNo).toLocaleString()}</td>
                                </tr>
                              );
                            });
                          })()
                        ) : (
                          display.breakdowns.map((bd, bidx) => (
                            <tr key={bidx} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-2 py-1 font-bold text-slate-600">#{bd.packing_number}</td>
                              <td className="px-2 py-1 text-center">
                                {bd.box > 0 ? (
                                  <span className="text-indigo-600 font-bold">{formatAggregatedBoxCount(bd.box, bd.box_qty)}</span>
                                ) : "—"}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {bd.loose_box > 0 ? (
                                  <span className="text-amber-600 font-bold">{formatAggregatedBoxCount(bd.loose_box, bd.loose_box_qty)}</span>
                                ) : "—"}
                              </td>
                              <td className="px-2 py-1 text-right font-black text-slate-700">{bd.total_qty.toLocaleString()}</td>
                              <td className="px-2 py-1 text-right font-bold text-slate-700 tabular-nums">
                                {erpQtyForPacking(item, bd.packing_number).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  );
                })()}
              </div>
            ))}
          </div>
          {!isFromSchedule ? (
          <div className="pt-1 flex justify-end">
            <button
              onClick={addRow}
              className="w-full md:w-auto flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-md transition-all shadow-sm"
            >
              <Plus size={12} /> Add Row
            </button>
          </div>
          ) : null}
        </div>

        {/* ── Remarks (full row, same as other modals) ── */}
        <div className="space-y-3 min-w-0">
          <RemarksTextarea
            label="Remarks"
            value={form.remarks}
            onChange={(e) => handleInputChange("remarks", e.target.value)}
            placeholder="Dispatch notes, instructions, references…"
            rows={4}
          />
        </div>

        {/* ── Approval Toggle ── */}
        {showApproval ? (
          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${form.approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${form.approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${form.approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
                <p className={`text-[9px] uppercase font-bold tracking-tight ${form.approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {form.approved ? "Final & Locked" : "Draft Mode"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.approved} onChange={(e) => handleInputChange("approved", e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">Forwarding note will be marked as 'Pending' until authorized.</p>
          </div>
        )}

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${sopPermissionType}-${editData?.fuid ?? "new"}`}
          moduleSlug="forwarding_note_master"
          permissionType={sopPermissionType}
          isOpen={open && formReady}
        />
        </>
        )}
      </div>
    </Drawer>
  );
}

