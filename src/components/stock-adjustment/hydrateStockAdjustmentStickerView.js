import { stockAdjustmentService } from "@/services/stockAdjustment";
import { masterService } from "@/services/master";
import { rowInIndianFinancialYear } from "@/utils/indianFinancialYear";
import { parseOptionalStandardQtyPerBox } from "@/utils/stockAdjustmentPacking";
import { loadPackingContext } from "./loadPackingContext";
import { boxService } from "@/services/box";
import {
  buildViewAddRowsFromAdjustment,
  loadBoxesForAdjustmentView,
  parseRemovedBoxUids,
} from "./stockAdjustmentViewBoxes";
import { parseStoredRemarks } from "./StockAdjustmentModal";
import { isBoxInHand, isBoxVisibleForStockAdjustmentMinus } from "@/utils/boxInventory";

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

function mergeMinusPackingBoxes(liveBoxes, removedBoxes, packingNo) {
  const pn = String(packingNo || "").trim();
  const byUid = new Map();
  for (const b of liveBoxes || []) {
    if (b?.box_uid != null) byUid.set(Number(b.box_uid), mapBoxRow(b, pn));
  }
  for (const b of removedBoxes || []) {
    const uid = Number(b?.box_uid);
    if (Number.isFinite(uid) && uid > 0 && !byUid.has(uid)) {
      byUid.set(uid, mapBoxRow(b, pn));
    }
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
  const saBoxes = await loadBoxesForAdjustmentView(row);
  const minusPlanUids = entryType === "minus" ? parseRemovedBoxUids(row) : [];

  let packingPreview = await loadPackingContext(pn, {
    forMinus: entryType === "minus",
    adjustmentId: entryType === "minus" ? adjId : null,
  });
  let itemMeta = null;

  if (entryType === "add") {
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
    const livePackingBoxes = (packingPreview.boxes || []).map((b) =>
      mapBoxRow(b, pn)
    );
    const removedForMinus = (saBoxes || [])
      .filter((b) => !b.is_deleted && isBoxVisibleForStockAdjustmentMinus(b, { adjustmentId: adjId }))
      .map((b) => mapBoxRow(b, pn));
    packingPreview = {
      ...packingPreview,
      boxes: mergeMinusPackingBoxes(livePackingBoxes, removedForMinus, pn).filter((b) =>
        isBoxVisibleForStockAdjustmentMinus(b, { adjustmentId: adjId })
      ),
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
    addNumBoxes: entryType === "add" ? String(row.box_count_impact ?? "") : "",
    addPerBoxQty: entryType === "add" ? String(row.per_box_qty ?? "") : "",
    minusSelectedUids:
      entryType === "minus"
        ? new Set(minusPlanUids.map((u) => String(u)).filter(Boolean))
        : new Set(),
    viewAddRows: entryType === "add" ? buildViewAddRowsFromAdjustment(row, saBoxes, pn) : [],
    packingPreview,
    itemMeta,
  };
}
