import { stockAdjustmentService } from "@/features/apps/ims/services/stockAdjustment";
import { masterService } from "@/features/apps/ims/services/master";
import { rowInIndianFinancialYear } from "@/core/utils/indianFinancialYear";
import { parseOptionalStandardQtyPerBox } from "@/features/apps/ims/utils/stockAdjustmentPacking";
import { loadPackingContext } from "./loadPackingContext";
import { buildViewAddRowsFromAdjustment, loadAddBoxesForAdjustmentView, isAddBoxRemovedFromInventory, mapSavedBoxesToAddRows, loadMinusPlanBoxes, parseRemovedBoxUidsForAdjustment, resolveMinusSelectedUidsForAdjustment, normalizeMinusSelectedUidSet,isMinusBoxUidSelected } from "./stockAdjustmentViewBoxes";
import { parseStoredRemarks } from "./StockAdjustmentModal";
import { dedupeMinusDrawerBoxRows, isBoxVisibleForStockAdjustmentMinus, isValidMinusDrawerBoxRow } from "@/features/apps/ims/utils/boxInventory";

const STOCK_ADJ_PERMS = { permission_module: "stock_adjustment", permission_action: "view" };

function mapBoxRow(b, packingNo) {
  return {
    box_uid: b.box_uid,
    box_no_uid: b.box_no_uid,
    qty: b.qty,
    packing_number: b.packing_number ?? packingNo,
    is_loose: !!b.is_loose,
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
    byUid.set(uid, {
      ...existing,
      ...mapped,
      ...saFields,
      box_no_uid: mapped.box_no_uid ?? existing.box_no_uid ?? null,
    });
  }
  return [...byUid.values()].sort((a, b) => Number(a.box_uid) - Number(b.box_uid));
}

/** Load saved add/minus adjustment into the same UI state as the create drawer (view / edit). */
export async function hydrateStockAdjustmentStickerView(editData, options = {}) {
  const adjId = Number(editData?.adjustment_id);
  if (!Number.isFinite(adjId) || adjId < 1) {
    throw new Error("Invalid adjustment");
  }

  const res = await stockAdjustmentService.getById(adjId);
  const row = res?.data ?? editData;
  const entryType = row.entry_type;
  const pn = String(row.packing_number || "").trim();
  if (!pn || (entryType !== "add" && entryType !== "minus")) {
    throw new Error("This adjustment cannot be opened in the packing form");
  }

  const parsed = parseStoredRemarks(row.remarks);

  let packingPreview = await loadPackingContext(pn, {
    forMinus: entryType === "minus",
    adjustmentId: entryType === "minus" ? adjId : null,
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

    const fy = String(row.financial_year || "").trim();
    if (fy) {
      try {
        const imsRes = await masterService.getPackByFinancialYearDoc({
          financial_year: fy,
          doc_no: pn,
          packing_number: pn,
          permission_module: "stock_adjustment",
          permission_action: "view",
        });
        let recs = Array.isArray(imsRes?.records) ? [...imsRes.records] : [];
        recs = recs.filter((r) => !r.doc_dt || rowInIndianFinancialYear(r, fy));
        if (imsRes?.success && recs.length > 0) {
          const first = recs[0];
          const base = packingPreview.dailyprod;
          const partyFromPackFy =
            imsRes?.party_rate_cust_code != null && String(imsRes.party_rate_cust_code).trim() !== ""
              ? String(imsRes.party_rate_cust_code).trim()
              : null;
          const mergedDaily =
            base?.itemdcode != null
              ? {
                  ...base,
                  acc_name: first.acc_name ?? base.acc_name,
                  total_qty: first.QTY != null ? String(first.QTY) : base.total_qty,
                  doc_dt: first.doc_dt || first.docdt || base.doc_dt,
                  doc_no: first.docno != null ? String(first.docno) : base.doc_no ?? pn,
                  job_card_no: first.jobcardno || base.job_card_no,
                  party_rate_cust_code: partyFromPackFy,
                }
              : {
                  itemdcode: first.itemdcode,
                  acc_code: first.acc_code,
                  acc_name: first.acc_name,
                  item_code: first.item_code,
                  item_desc: first.itemdesc,
                  job_card_no: first.jobcardno,
                  total_qty: first.QTY != null ? String(first.QTY) : null,
                  doc_dt: first.doc_dt || first.docdt,
                  doc_no: first.docno != null ? String(first.docno) : pn,
                  party_rate_cust_code: partyFromPackFy,
                };
          packingPreview = {
            ...packingPreview,
            dailyprod: mergedDaily,
            standard_qty_per_box: parseOptionalStandardQtyPerBox(imsRes.standard_qty_per_box),
          };
        }
      } catch {
        /* optional IMS enrich */
      }
    }
    const idForItem = packingPreview.dailyprod?.itemdcode ?? packingPreview.stickerRow?.itemdcode;
    if (idForItem) {
      try {
        const itemRes = await masterService.getItemViewById(idForItem, STOCK_ADJ_PERMS);
        itemMeta = itemRes?.data ?? null;
      } catch {
        /* optional */
      }
    }
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

    packingPreview = {
      ...packingPreview,
      boxes: finalBoxes,
    };

    const idForItem = packingPreview.dailyprod?.itemdcode ?? packingPreview.stickerRow?.itemdcode;
    if (idForItem) {
      try {
        const itemRes = await masterService.getItemViewById(idForItem, STOCK_ADJ_PERMS);
        itemMeta = itemRes?.data ?? null;
      } catch {
        /* optional */
      }
    }
  }

  return {
    row,
    gateEntryType: entryType,
    gateFinancialYear: String(row.financial_year || ""),
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
  };
}
