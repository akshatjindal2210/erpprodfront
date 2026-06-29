"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Check, Loader2, Shield, Package, Trash2, Plus, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "react-toastify";

import { forwardingNoteService } from "@/features/apps/ims/services/forwardingNote";
import { masterService }         from "@/features/apps/ims/services/master";
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
  available_boxes: [], // full stock from API
  selected_boxes:  [], // Boxes selected in FIFO order
  loose_priority:  false,
  fg_qty:          0,
  erp_qty:         0,
  erp_by_packing:  {},
  dispatch_qty:    "", // user input
  dispatch_std:    "", // dispatch according to standard
  fetching:        false,
  boxes_edited:    false, // true once user changes box selection (prevents edit fallback)
};

const forwardingBoxKey = (box) =>
  String(box?.box_no_uid ?? box?.box_uid ?? "").trim();

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

export default function ForwardingModal({ open, onClose, onSuccess, editData, mode = "add" }) {
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
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";

  const showApproval = canAuthorize && (mode === "add" || mode === "approve");

  const [transporterHighlight, setTransporterHighlight] = useState(-1);
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

    let cancelled = false;
    (async () => {
      try {
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
  }, [open, formReady, editingFuid]);

  const getItemById = useCallback(
    (id) => {
      if (Array.isArray(inHandItemCatalog)) {
        const match = inHandItemCatalog.find((item) => String(item.id) === String(id));
        if (match) return Promise.resolve({ data: match });
      }
      return masterService.getItemViewById(id, {
        permission_module: "forwarding_note_master",
        permission_action: "view",
      });
    },
    [inHandItemCatalog]
  );

  const buildInHandItemFetchService = useCallback((catalog, currentIdx) => {
    return async ({ search = "", page = 1, limit = 50 } = {}) => {
      if (!Array.isArray(catalog)) return { data: [] };

      const selectedInOtherRows = new Set(
        formItemsRef.current
          .filter((_, rowIdx) => rowIdx !== currentIdx)
          .map((row) => String(row.item_dcode))
          .filter(Boolean)
      );
      let list = catalog.filter((item) => !selectedInOtherRows.has(String(item.id)));

      const q = String(search || "").trim();
      if (q) {
        list = applyClientSearch(list, q, {
          getParts: (item) => [item.item_code, item.itemdesc, item.item_desc].filter(Boolean),
          skipSort: true,
        });
      } else {
        list = sortSelectRowsAsc(list, "item_code", ["itemdesc"]);
      }

      const start = (Math.max(1, Number(page) || 1) - 1) * (Number(limit) || 50);
      return { data: list.slice(start, start + (Number(limit) || 50)), total: list.length };
    };
  }, []);

  const itemRowFetchServices = useMemo(() => {
    if (!Array.isArray(inHandItemCatalog)) {
      return form.items.map(() => async () => ({ data: [] }));
    }
    return form.items.map((_, idx) => buildInHandItemFetchService(inHandItemCatalog, idx));
  }, [form.items.length, inHandItemCatalog, buildInHandItemFetchService]);

  // ── Bootstrap (show loader until form is hydrated — no blank fields) ───────
  useEffect(() => {
    if (!open) {
      setFormReady(false);
      setForm(INITIAL_FORM);
      setTransporterOpts([]);
      prevCategoryRef.current = "";
      return undefined;
    }

    let cancelled = false;
    setFormReady(false);
    setErrors({});

    const hydrate = async () => {
      const fuid = parseInt(String(editData?.fuid ?? "").trim(), 10);
      const needsFetch = Boolean(fuid > 0 && (isEdit || isApprove));

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
        if (fullData.acc_code) {
          try {
            const catRes = await forwardingNoteService.getCustomerCategory({ acc_code: Number(fullData.acc_code) });
            const categoryOptions = Array.isArray(catRes?.data?.options) ? catRes.data.options : [];
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

        const itemsWithStock = await Promise.all((fullData.items || []).map(async (i) => {
          let available_boxes = [];
          let fg_qty = i.total_qty || 0;
          let erp_qty = 0;
          let erp_by_packing = {};

          const stockBody = {
            item_dcode: i.item_dcode,
            exclude_fuid: fuid || undefined,
            ...(resolvedCategoryId != null && resolvedCategoryId !== ""
              ? { packing_category_id: Number(resolvedCategoryId) }
              : {}),
          };

          try {
            const [stockRes, erpRes] = await Promise.all([
              forwardingNoteService.getAvailableBoxes(stockBody),
              forwardingNoteService.getErpStock(stockBody),
            ]);
            if (stockRes.success) {
              available_boxes = sortBoxesForFifo(enrichForwardingBoxesWithPackingStd(stockRes.data || []));
              fg_qty = sumQty(available_boxes);
            }
            if (erpRes?.success !== false) {
              erp_qty = Number(erpRes?.total) || 0;
              erp_by_packing = erpRes?.by_packing && typeof erpRes.by_packing === "object" ? erpRes.by_packing : {};
            }
          } catch (e) {
            console.error("Stock fetch error", e);
          }

          const loosePriorityFromSaved =
            Array.isArray(i.breakdowns) &&
            i.breakdowns.some(
              (bd) => Number(bd?.loose_box || 0) > 0 || Number(bd?.loose_box_qty || 0) > 0
            );

          const orderedBoxes = reorderBoxesForSelection(available_boxes, loosePriorityFromSaved);
          const selected_boxes = selectBoxesByQty(orderedBoxes, i.total_qty);

          return {
            ...i,
            item_dcode: i.item_dcode,
            item_code: i.item_code,
            itemdesc: i.itemdesc,
            available_boxes,
            selected_boxes,
            loose_priority: loosePriorityFromSaved,
            fg_qty,
            erp_qty,
            erp_by_packing,
            dispatch_qty: i.total_qty || "",
            dispatch_std: i.total_qty || "",
            fetching: false,
            boxes_edited: false,
            original_breakdowns: i.breakdowns || [],
          };
        }));

        if (cancelled) return;

        const categoryKey =
          resolvedCategoryId != null && resolvedCategoryId !== ""
            ? String(resolvedCategoryId)
            : "";
        prevCategoryRef.current = categoryKey;

        setForm({
          acc_code: fullData.acc_code || "",
          packing_category_id:
            resolvedCategoryId != null && resolvedCategoryId !== ""
              ? String(resolvedCategoryId)
              : "",
          po_number: fullData.po_number || "",
          transporter_sel_id: "",
          transporter_name: fullData.transporter_name || "",
          transporter_id: fullData.transporter_id || "",
          vehicle_number: fullData.vehicle_number || "",
          cartage: fullData.cartage ?? "",
          customer_qty: fullData.customer_qty ?? "",
          remarks: fullData.remarks || "",
          approved: isApprove ? (fullData?.approved ?? false) : false,
          items: itemsWithStock,
        });
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.message || "Failed to load forwarding note details.");
          setForm({ ...INITIAL_FORM, items: [{ ...INITIAL_ITEM_ROW }] });
        }
      } finally {
        if (!cancelled) setFormReady(true);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [open, editData?.fuid, isEdit, isApprove]);

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
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, ...updates } : item)
    }));
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
            Object.assign(updates, {
              selected_boxes: [],
              loose_priority: false,
              dispatch_qty: "",
              boxes_edited: true,
              original_breakdowns: [],
            });
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
    handleInputChange("packing_category_id", categoryId);
    formItemsRef.current.forEach((item, idx) => {
      if (item.item_dcode) void fetchItemStock(idx, item.item_dcode, categoryId);
    });
  };

  useEffect(() => {
    if (!open || !formReady || categoryLoading) return;
    const cat = String(form.packing_category_id ?? "");
    const prev = prevCategoryRef.current;
    prevCategoryRef.current = cat;
    // Only refetch when category changes from one value to another — not on the
    // initial assignment after edit/approve hydrate (that would wipe saved qty/boxes).
    if (!cat || cat === prev || !prev) return;
    formItemsRef.current.forEach((item, idx) => {
      if (item.item_dcode) void fetchItemStock(idx, item.item_dcode, cat);
    });
  }, [open, formReady, categoryLoading, form.packing_category_id, fetchItemStock]);

  // ── Item select — fetch boxes from API ────────────────────────────────────
  const handleItemChange = async (idx, id, rawData) => {
    if (!id) {
      updateItemRow(idx, INITIAL_ITEM_ROW);
      return;
    }

    const duplicateSelected = form.items.some(
      (row, rowIdx) => rowIdx !== idx && String(row.item_dcode) === String(id)
    );
    if (duplicateSelected) {
      toast.warning("This item is already selected in another row.");
      return;
    }

    if (categoryLoading) {
      toast.info("Category is loading — please wait a moment.");
      return;
    }
    if (form.acc_code && !form.packing_category_id) {
      toast.error("Please select a category before adding items.");
      return;
    }

    updateItemRow(idx, {
      item_dcode:      id,
      item_code:       rawData?.item_code || "",
      itemdesc:        rawData?.itemdesc  || "",
      available_boxes: [],
      selected_boxes:  [],
      loose_priority:  false,
      fg_qty:          0,
      erp_qty:         0,
      erp_by_packing:  {},
      dispatch_qty:    "",
      dispatch_std:    "",
      fetching:        true,
      boxes_edited:    false,
      original_breakdowns: [],
    });

    await fetchItemStock(idx, id, form.packing_category_id, { resetSelection: true });
  };

  const handleDispatchQtyChange = (idx, val) => {
    const item = form.items[idx];
    const qty = Math.min(Math.max(0, Number(val)), item.fg_qty);
    const ordered = reorderBoxesForSelection(item.available_boxes, item.loose_priority);
    const selected = selectBoxesByQty(ordered, qty);
    
    // Update both raw input and the actual boxes.
    // If the selected boxes sum to more than the input (due to full box rule),
    // we keep the raw input for now but STD QTY will show the actual rounded total.
    updateItemRow(idx, {
      dispatch_qty: val || "",
      selected_boxes: selected,
      boxes_edited: true,
    });
  };

  const handleDispatchQtyBlur = (idx) => {
    const item = form.items[idx];
    const roundedQty = sumQty(item.selected_boxes);
    // When focus is lost, update the input to match the actual selected boxes
    updateItemRow(idx, {
      dispatch_qty: roundedQty || "",
    });
  };

  const handleBoxChange = (idx, type) => {
    const item = form.items[idx];
    const orderedBoxes = reorderBoxesForSelection(item.available_boxes, item.loose_priority);

    let currentSelected = [...item.selected_boxes];
    if (
      isEdit &&
      !item.boxes_edited &&
      currentSelected.length === 0 &&
      Number(item.dispatch_qty) > 0 &&
      orderedBoxes.length > 0
    ) {
      currentSelected = selectBoxesByQty(orderedBoxes, Number(item.dispatch_qty));
    }

    const selectedIds = new Set(currentSelected.map(forwardingBoxKey));

    if (type === "add") {
      const nextBox = orderedBoxes.find((b) => !selectedIds.has(forwardingBoxKey(b)));
      if (!nextBox) return toast.info("All available boxes are already selected.");
      const newSelected = [...currentSelected, nextBox];
      updateItemRow(idx, {
        selected_boxes: newSelected,
        dispatch_qty: sumQty(newSelected) || "",
        boxes_edited: true,
      });
    } else {
      if (!currentSelected.length) return;
      const newSelected = currentSelected.slice(0, -1);
      updateItemRow(idx, {
        selected_boxes: newSelected,
        dispatch_qty: sumQty(newSelected) || "",
        boxes_edited: true,
      });
    }
  };

  const handleLoosePriorityToggle = (idx, checked) => {
    const item = form.items[idx];
    const ordered = reorderBoxesForSelection(item.available_boxes, checked);
    const qty = Number(item.dispatch_qty || 0);
    const { selectedBoxes } = calculateFifoBoxes(ordered, qty);
    updateItemRow(idx, {
      loose_priority: checked,
      selected_boxes: selectedBoxes,
      dispatch_qty: sumQty(selectedBoxes) || "",
      boxes_edited: true,
    });
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
        cartage: parseFloat(form.cartage) || 0,
        customer_qty: parseInt(form.customer_qty) || 0,
        approved: finalApproved,
        total_items: validItems.reduce((s, i) => s + itemStdQty(i), 0),
        items:       validItems.flatMap(i => {
          if (i.selected_boxes.length > 0) {
            return [{
              item_dcode: i.item_dcode,
              item_code:  i.item_code,
              itemdesc:   i.itemdesc,
              qty:        sumQty(i.selected_boxes),
              selected_boxes: i.selected_boxes,
            }];
          }
          if (!i.boxes_edited && i.original_breakdowns?.length > 0) {
            return i.original_breakdowns.map(bd => ({
              item_dcode: i.item_dcode,
              item_code:  i.item_code,
              itemdesc:   i.itemdesc,
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
    ? "Fetching note, items, and available stock."
    : "Setting up a new forwarding note.";

  // ── Derived ────────────────────────────────────────────────────────────────
  const confirmedTotal = form.items.reduce((s, i) => s + itemStdQty(i), 0);
  const customerQty    = parseInt(form.customer_qty) || 0;
  const isQtyExceeded  = customerQty > 0 && confirmedTotal > customerQty;

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
              disabled={!formReady || saving}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-40 w-full sm:w-auto"
            >
              Keep Pending
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={!formReady || saving}
              className="min-w-[140px] w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-40"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
            </button>
          </>
        ) : (
          <button
            onClick={() => handleSave()}
            disabled={!formReady || saving || isQtyExceeded}
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
        if (!formReady || saving) return;
        handleSave(isApprove ? true : undefined);
      }}
      title={isApprove ? "Approve Note" : isEdit ? "Edit Note" : "New Forwarding Note"}
      description="Create note for dispatch"
      footer={footer}
      maxWidth="max-w-4xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        {!formReady ? (
          <FormPanelLoader label={hydrateLabel} hint={hydrateHint} minHeight="min-h-[280px]" />
        ) : (
        <>
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
          <div className="md:col-span-2 space-y-1 relative" data-field="acc_code">
            <SearchableSelect 
              label="Customer / Account"
              required
              value={form.acc_code}
              onChange={handleAccCodeChange}
              error={errors.acc_code || ""}
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
                className={`${OK_INPUT} rounded-lg border-slate-200 disabled:bg-slate-50 disabled:text-slate-400`}
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
                  {customerQty > 0 && (
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
                  <span className={`${FORM_MICRO_LABEL_CLASS} text-slate-400`}>Row #{idx + 1}</span>
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
                  <div className="col-span-2 sm:col-span-4 lg:col-span-3 text-[11px] min-w-0">
                    <SearchableSelect
                      label="Search Item"
                      value={item.item_dcode}
                      onChange={(id, raw) => handleItemChange(idx, id, raw)}
                      fetchService={itemRowFetchServices[idx]}
                      getByIdService={getItemById}
                      dataKey="id"
                      labelKey="item_code"
                      subLabelKey="itemdesc"
                      disabled={!form.acc_code || categoryLoading || !form.packing_category_id}
                      emptyMessage={
                        !form.acc_code
                          ? "Select customer first"
                          : categoryLoading
                            ? "Loading category…"
                            : !form.packing_category_id
                              ? "Select category first"
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
                    <label className={`${FORM_MICRO_LABEL_CLASS} text-emerald-600 block ml-1`}>FG Stock</label>
                    <div className="bg-emerald-600 text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-xs">
                      {item.fg_qty.toLocaleString()}
                    </div>
                  </div>

                  {/* Dispatch Qty */}
                  <div className="lg:col-span-2 space-y-0.5">
                    <label className={`${FORM_MICRO_LABEL_CLASS} block ml-1`}>Dispatch Qty</label>
                    <input
                      type="number"
                      value={item.dispatch_qty}
                      onChange={(e) => handleDispatchQtyChange(idx, e.target.value)}
                      onBlur={() => handleDispatchQtyBlur(idx)}
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
                        disabled={item.selected_boxes.length >= item.available_boxes.length}
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
                              <td className="px-2 py-1 text-right font-bold text-slate-700 tabular-nums">
                                {erpQtyForPacking(item, bd.packing_number).toLocaleString()}
                              </td>
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
          <div className="pt-1 flex justify-end">
            <button
              onClick={addRow}
              className="w-full md:w-auto flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-md transition-all shadow-sm"
            >
              <Plus size={12} /> Add Row
            </button>
          </div>
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

