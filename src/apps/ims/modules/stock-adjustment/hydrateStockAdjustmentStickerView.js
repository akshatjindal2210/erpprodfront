import { stockAdjustmentService } from "@/apps/ims/lib/services/stockAdjustment";
import { masterService } from "@/apps/ims/lib/services/master";
import { boxService } from "@/apps/ims/lib/services/box";
import { loadPackingContext } from "./loadPackingContext";
import { buildViewAddRowsFromAdjustment, loadAddBoxesForAdjustmentView, isAddBoxRemovedFromInventory, mapSavedBoxesToAddRows, loadMinusPlanBoxes, parseRemovedBoxUidsForAdjustment, resolveMinusSelectedUidsForAdjustment, normalizeMinusSelectedUidSet,isMinusBoxUidSelected } from "./stockAdjustmentViewBoxes";
import { parseStoredRemarks } from "./StockAdjustmentModal";
import { dedupeMinusDrawerBoxRows, isBoxVisibleForStockAdjustmentMinus, isValidMinusDrawerBoxRow } from "@/apps/ims/lib/utils/boxInventory";
import { enrichMinusBoxCustomerNames } from "@/apps/ims/lib/utils/minusCustomerBreakdown";
import { parseQtyUpdatePayload } from "@/apps/ims/lib/utils/stockAdjustmentQtyUpdate";
import { pickBoxFromViewsResponse } from "@/apps/ims/lib/helpers/boxViewsLookup";

const STOCK_ADJ_PERMS = { permission_module: "stock_adjustment", permission_action: "view" };

function mapBoxRow(b, packingNo) {
  return {
    box_uid: b.box_uid,
    box_no_uid: b.box_no_uid,
    qty: b.qty,
    packing_number: b.packing_number ?? packingNo,
    is_loose: !!b.is_loose,
    override_cust: b.override_cust ?? null,
    acc_code: b.acc_code ?? null,
    acc_name: b.acc_name ?? null,
    prod_acc_code: b.prod_acc_code ?? null,
    unit: b.unit || "PCS",
    sa_id: b.sa_id ?? null,
    sa_entry_type: b.sa_entry_type ?? null,
    out_uid: b.out_uid ?? null,
  };
}

function pickSaInventoryFields(existing, incoming) {
  const exOut = String(existing?.sa_entry_type ?? "").trim() === "stock_out";
  const inOut = String(incoming?.sa_entry_type ?? "").trim() === "stock_out";
  const prefer = inOut ? incoming : exOut ? existing : incoming ?? existing;
  const fallback = prefer === incoming ? existing : incoming;
  return {
    sa_id: prefer?.sa_id ?? fallback?.sa_id ?? null,
    sa_entry_type: prefer?.sa_entry_type ?? fallback?.sa_entry_type ?? null,
    out_uid: prefer?.out_uid ?? fallback?.out_uid ?? null,
  };
}

/** Latest in-hand + saved minus plan (deduped by box_uid; plan SA fields win on conflict). */
function mergeMinusPackingBoxes(liveBoxes, planBoxes, packingNo) {
  const pn = String(packingNo || "").trim();
  const byUid = new Map();
  for (const b of liveBoxes || []) {
    if (b?.box_uid != null) byUid.set(Number(b.box_uid), mapBoxRow(b, pn));
  }
  for (const b of planBoxes || []) {
    const uid = Number(b?.box_uid);
    if (!Number.isFinite(uid) || uid <= 0) continue;
    const mapped = mapBoxRow(b, pn);
    const existing = byUid.get(uid);
    if (!existing) {
      byUid.set(uid, mapped);
      continue;
    }
    const saFields = pickSaInventoryFields(existing, mapped);
    const custFields =
      mapped.override_cust != null && String(mapped.override_cust).trim() !== "" && String(mapped.override_cust).trim() !== "-"
        ? {
            override_cust: mapped.override_cust,
            acc_code: mapped.acc_code ?? existing.acc_code,
            acc_name: mapped.acc_name ?? existing.acc_name,
            prod_acc_code: mapped.prod_acc_code ?? existing.prod_acc_code,
          }
        : {
            override_cust: existing.override_cust ?? mapped.override_cust,
            acc_code: existing.acc_code ?? mapped.acc_code,
            acc_name: existing.acc_name ?? mapped.acc_name,
            prod_acc_code: existing.prod_acc_code ?? mapped.prod_acc_code,
          };
    byUid.set(uid, {
      ...existing,
      ...mapped,
      ...saFields,
      ...custFields,
      box_no_uid: mapped.box_no_uid ?? existing.box_no_uid ?? null,
    });
  }
  return [...byUid.values()].sort((a, b) => Number(a.box_uid) - Number(b.box_uid));
}

/** Load saved add/minus/update adjustment into the same UI state as the create drawer (view / edit). */
export async function hydrateStockAdjustmentStickerView(editData, options = {}) {
  const adjId = Number(editData?.adjustment_id);
  if (!Number.isFinite(adjId) || adjId < 1) {
    throw new Error("Invalid adjustment");
  }

  const res = await stockAdjustmentService.getById(adjId);
  const row = res?.data ?? editData;
  const entryType = row.entry_type;
  const pn = String(row.packing_number || "").trim();

  if (entryType === "update") {
    return hydrateUpdateAdjustment(row, options);
  }

  if (!pn || (entryType !== "add" && entryType !== "minus")) {
    throw new Error("This adjustment cannot be opened in the packing form");
  }

  const parsed = parseStoredRemarks(row.remarks);

  const financialYear = String(
    row.financial_year || row.resolved_financial_year || ""
  ).trim();

  let packingPreview = await loadPackingContext(pn, {
    forMinus: entryType === "minus",
    adjustmentId: adjId,
    itemDcode: row.item_dcode,
    financialYear: financialYear || undefined,
    packingMeta: row.packing_meta ?? null,
    fetchBoxes: entryType === "minus",
  });
  let itemMeta = null;
  let viewAddRows = [];
  let savedAddBoxRows = [];
  let minusSelectedUids = new Set();

  if (entryType === "add") {
    const allAddBoxes = await loadAddBoxesForAdjustmentView(row);
    viewAddRows = buildViewAddRowsFromAdjustment(row, allAddBoxes, pn);
    savedAddBoxRows = mapSavedBoxesToAddRows(
      allAddBoxes.filter((b) => !isAddBoxRemovedFromInventory(b, adjId)),
      pn
    );

  } else {
    const planUids = parseRemovedBoxUidsForAdjustment(row);
    const planUidSet = new Set(planUids.map((u) => String(u)));
    const livePackingBoxes = dedupeMinusDrawerBoxRows(packingPreview.boxes || []);
    const planBoxes = dedupeMinusDrawerBoxRows(await loadMinusPlanBoxes(row));
    const merged = dedupeMinusDrawerBoxRows(
      mergeMinusPackingBoxes(livePackingBoxes, planBoxes, pn)
    );

    let minusSelectedUidsResolved = resolveMinusSelectedUidsForAdjustment(row, merged);
    if (!minusSelectedUidsResolved.size && planBoxes.length) {
      minusSelectedUidsResolved = normalizeMinusSelectedUidSet(
        planBoxes
          .filter((b) => isValidMinusDrawerBoxRow(b))
          .map((b) => b.box_uid)
      );
    }

    const finalBoxes = merged.filter(
      (b) =>
        isValidMinusDrawerBoxRow(b) &&
        (isBoxVisibleForStockAdjustmentMinus(b, { adjustmentId: adjId }) ||
          planUidSet.has(String(b.box_uid)) ||
          isMinusBoxUidSelected(minusSelectedUidsResolved, b.box_uid))
    );

    minusSelectedUids = resolveMinusSelectedUidsForAdjustment(row, finalBoxes);
    if (!minusSelectedUids.size && minusSelectedUidsResolved.size) {
      minusSelectedUids = normalizeMinusSelectedUidSet(
        [...minusSelectedUidsResolved].filter((uid) =>
          finalBoxes.some((b) => Number(b.box_uid) === Number(uid))
        )
      );
    }

    const enrichedFinalBoxes = await enrichMinusBoxCustomerNames(
      finalBoxes,
      packingPreview.dailyprod?.itemdcode ?? row.item_dcode
    );

    packingPreview = {
      ...packingPreview,
      boxes: enrichedFinalBoxes,
    };
  }

  const idForItem =
    packingPreview.dailyprod?.itemdcode ?? row.item_dcode ?? null;
  const hasItemLabels =
    packingPreview.dailyprod?.item_code && packingPreview.dailyprod?.item_desc;
  if (idForItem && !hasItemLabels) {
    try {
      const itemRes = await masterService.getItemViewById(idForItem, STOCK_ADJ_PERMS);
      itemMeta = itemRes?.data ?? null;
    } catch {
      /* optional */
    }
  }

  return {
    row,
    gateEntryType: entryType,
    gateFinancialYear: financialYear,
    gatePackingNo: pn,
    form: {
      remarks: parsed.remarks,
      approved: !!row.approved,
    },
    addNumBoxes:
      entryType === "add"
        ? String(viewAddRows.length || row.box_count_impact || "")
        : "",
    addPerBoxQty: entryType === "add" ? String(row.per_box_qty ?? "") : "",
    minusSelectedUids,
    viewAddRows,
    savedAddBoxRows,
    packingPreview,
    itemMeta,
    updateBox: null,
    updateAction: "minus",
    updateQty: "",
  };
}

async function hydrateUpdateAdjustment(row, options = {}) {
  const forEdit = options.forEdit === true;
  const plan =
    row.qty_update_plan ||
    parseQtyUpdatePayload(row.removed_box_ids);
  if (!plan?.box_uid) {
    throw new Error("Update adjustment is missing box details");
  }

  const parsed = parseStoredRemarks(row.remarks);
  let updateBox = null;
  try {
    const boxRes = await boxService.getViews({
      box_uid: plan.box_uid,
      id: String(plan.box_uid),
      ...STOCK_ADJ_PERMS,
    });
    updateBox = pickBoxFromViewsResponse(boxRes);
  } catch {
    updateBox = null;
  }

  if (!updateBox) {
    updateBox = {
      box_uid: plan.box_uid,
      box_no_uid: plan.box_no_uid,
      packing_number: plan.packing_number || row.packing_number,
      qty: plan.snapshot_qty ?? row.per_box_qty,
      item_code: row.item_code,
      item_desc: row.item_desc,
      itemdcode: row.item_dcode,
      item_dcode: row.item_dcode,
    };
  }

  // Edit of an already-approved Update: show pre-apply qty so minus validation matches backend.
  if (
    forEdit &&
    row.approved &&
    plan.applied_delta != null &&
    Number.isFinite(Number(plan.applied_delta))
  ) {
    const liveQty = parseInt(String(updateBox.qty ?? ""), 10);
    const pre =
      plan.applied_from_qty != null && Number.isFinite(Number(plan.applied_from_qty))
        ? Number(plan.applied_from_qty)
        : Number.isFinite(liveQty)
          ? liveQty - Number(plan.applied_delta)
          : plan.snapshot_qty;
    if (Number.isFinite(pre) && pre >= 0) {
      updateBox = { ...updateBox, qty: pre };
    }
  }

  let itemMeta = null;
  const idForItem = updateBox.itemdcode ?? updateBox.item_dcode ?? row.item_dcode;
  if (idForItem) {
    try {
      const itemRes = await masterService.getItemViewById(idForItem, STOCK_ADJ_PERMS);
      itemMeta = itemRes?.data ?? null;
    } catch {
      /* optional */
    }
  }

  const packingNo = String(
    updateBox.packing_number || plan.packing_number || row.packing_number || ""
  ).trim();
  let packingPreview = {
    dailyprod: {
      itemdcode: idForItem,
      item_code: updateBox.item_code ?? row.item_code,
      item_desc: updateBox.item_desc ?? updateBox.itemdesc ?? row.item_desc,
      acc_code: updateBox.acc_code ?? row.acc_code,
      acc_name: updateBox.acc_name ?? row.acc_name,
    },
    boxes: [updateBox],
  };
  if (packingNo) {
    try {
      const ctx = await loadPackingContext(packingNo, {
        forMinus: false,
        fetchBoxes: false,
        itemDcode: idForItem,
      });
      if (ctx) {
        packingPreview = {
          ...ctx,
          boxes: [updateBox],
          dailyprod: {
            ...ctx.dailyprod,
            ...packingPreview.dailyprod,
            itemdcode: packingPreview.dailyprod.itemdcode ?? ctx.dailyprod?.itemdcode,
            item_code: packingPreview.dailyprod.item_code ?? ctx.dailyprod?.item_code,
            item_desc: packingPreview.dailyprod.item_desc ?? ctx.dailyprod?.item_desc,
            acc_code: packingPreview.dailyprod.acc_code ?? ctx.dailyprod?.acc_code,
            acc_name: packingPreview.dailyprod.acc_name ?? ctx.dailyprod?.acc_name,
            total_qty: ctx.dailyprod?.total_qty ?? packingPreview.dailyprod.total_qty,
            job_card_no: ctx.dailyprod?.job_card_no ?? packingPreview.dailyprod.job_card_no,
            doc_dt: ctx.dailyprod?.doc_dt ?? packingPreview.dailyprod.doc_dt,
            doc_no: ctx.dailyprod?.doc_no ?? packingPreview.dailyprod.doc_no,
            party_rate_cust_code:
              ctx.dailyprod?.party_rate_cust_code ?? packingPreview.dailyprod.party_rate_cust_code,
          },
        };
      }
    } catch {
      /* keep box-only preview */
    }
  }

  return {
    row,
    gateEntryType: "update",
    gateFinancialYear: "",
    gatePackingNo: String(updateBox.box_no_uid || plan.box_no_uid || "").trim(),
    form: {
      remarks: parsed.remarks,
      approved: !!row.approved,
      acc_code: packingPreview.dailyprod?.acc_code ?? row.acc_code ?? null,
      acc_name: packingPreview.dailyprod?.acc_name ?? row.acc_name ?? null,
      party_rate_cust_code: packingPreview.dailyprod?.party_rate_cust_code ?? null,
    },
    addNumBoxes: "",
    addPerBoxQty: "",
    minusSelectedUids: new Set(),
    viewAddRows: [],
    savedAddBoxRows: [],
    packingPreview,
    itemMeta,
    updateBox,
    updateAction: plan.update_action || "minus",
    updateQty: String(plan.update_qty ?? ""),
  };
}
