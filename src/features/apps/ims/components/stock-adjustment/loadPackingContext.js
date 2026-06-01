import { masterService } from "@/features/apps/ims/services/master";
import { boxService } from "@/features/apps/ims/services/box";
import {
  dedupeMinusDrawerBoxRows,
  isBoxVisibleForStockAdjustmentMinus,
  isValidMinusDrawerBoxRow,
} from "@/features/apps/ims/utils/boxInventory";

const STOCK_ADJ_PERMS = { permission_module: "stock_adjustment", permission_action: "view" };

function normDoc(v) {
  return String(v ?? "").trim();
}

async function resolveAccName(accCode) {
  const code = accCode != null ? String(accCode).trim() : "";
  if (!code) return null;
  try {
    const res = await masterService.getLedgerViewById(code, STOCK_ADJ_PERMS);
    const row = res?.data ?? res;
    return row?.acc_name ?? row?.Acc_Name ?? null;
  } catch {
    return null;
  }
}

function pickAccCode(dailyRow, stickerRow, inHandList) {
  const fromMeta = dailyRow?.acc_code ?? stickerRow?.acc_code;
  if (fromMeta != null && String(fromMeta).trim() !== "") return String(fromMeta).trim();
  const fromBox = (inHandList || []).find(
    (b) => b?.override_cust != null && String(b.override_cust).trim() !== ""
  );
  if (fromBox) return String(fromBox.override_cust).trim();
  return null;
}

/** IMS / UI mismatch: "30819" vs 30819, spaces */
function rowMatchesPacking(row, pn) {
  const a = normDoc(row?.doc_no);
  const b = normDoc(pn);
  if (!a || !b) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && String(na) === String(nb)) return true;
  return false;
}

function mapBoxRow(b, pn, itemdcode, jobCardNo) {
  return {
    box_uid: b.box_uid,
    box_no_uid: b.box_no_uid,
    qty: b.qty,
    packing_number: b.packing_number ?? pn,
    is_loose: !!b.is_loose,
    override_cust: b.override_cust ?? null,
    itemdcode: itemdcode ?? b.itemdcode ?? b.item_dcode,
    unit: b.unit || "PCS",
    job_card_no: jobCardNo,
    sa_id: b.sa_id ?? null,
    sa_entry_type: b.sa_entry_type ?? null,
    out_uid: b.out_uid ?? null,
    location_id: b.location_id ?? null,
    location_no: b.location_no ?? null,
  };
}

/** In-hand boxes for packing — same SQL as inventory report (no list date cap). */
export async function fetchInHandBoxesForPacking(packingNumber, options = {}) {
  const pn = normDoc(packingNumber);
  if (!pn) return [];
  const body = { packing_number: pn };
  const adjId = options?.adjustmentId;
  if (adjId != null && Number(adjId) > 0) {
    body.adjustment_id = Number(adjId);
  }
  const res = await boxService.getInHandBoxesByPacking(body);
  return Array.isArray(res?.data) ? res.data : [];
}

/**
 * Packing + boxes for stock adjustment drawer.
 * @param {string} packingNumber
 * @param {{ forMinus?: boolean, adjustmentId?: number|null }} [options]
 */
export async function loadPackingContext(packingNumber, options = {}) {
  const pn = normDoc(packingNumber);
  if (!pn) throw new Error("Packing number required");

  const forMinus = options?.forMinus === true;
  const adjustmentId = options?.adjustmentId ?? null;
  const adjIdNum =
    adjustmentId != null && Number(adjustmentId) > 0 ? Number(adjustmentId) : null;

  const [dpRes, stickerRes, inHandList] = await Promise.all([
    masterService.getDailyProd({
      search: pn,
      page: 1,
      limit: 5000,
    }),
    boxService.getStickers({ doc_no: pn }).catch(() => ({ success: false, data: [] })),
    fetchInHandBoxesForPacking(pn, {
      adjustmentId: forMinus ? adjIdNum : null,
    }),
  ]);

  const dailyList = Array.isArray(dpRes?.data) ? dpRes.data : [];
  const dailyRow = dailyList.find((r) => rowMatchesPacking(r, pn)) || null;

  const stickerRow =
    stickerRes?.success && Array.isArray(stickerRes.data) && stickerRes.data.length > 0
      ? stickerRes.data[0]
      : null;

  const itemdcode = dailyRow?.itemdcode ?? stickerRow?.itemdcode ?? null;
  const acc_code = pickAccCode(dailyRow, stickerRow, inHandList);
  let acc_name = dailyRow?.acc_name ?? stickerRow?.acc_name ?? null;
  if (!acc_name && acc_code) {
    acc_name = await resolveAccName(acc_code);
  }

  const dailyprod =
    itemdcode != null
      ? {
          itemdcode,
          acc_code,
          acc_name,
          item_code: dailyRow?.item_code ?? stickerRow?.item_code ?? null,
          item_desc: dailyRow?.item_desc ?? stickerRow?.itemdesc ?? stickerRow?.item_desc ?? null,
          job_card_no: dailyRow?.job_card_no ?? stickerRow?.job_card_no ?? null,
          total_qty: dailyRow?.total_qty ?? stickerRow?.total_qty ?? null,
          doc_dt: dailyRow?.doc_dt ?? stickerRow?.doc_dt ?? null,
          doc_no: dailyRow?.doc_no ?? stickerRow?.doc_no ?? pn,
        }
      : acc_code || acc_name
        ? {
            acc_code,
            acc_name,
            doc_no: pn,
          }
        : null;

  const jc = dailyprod?.job_card_no ?? null;

  const boxes = dedupeMinusDrawerBoxRows(
    (inHandList || [])
      .filter((b) =>
        forMinus ? isBoxVisibleForStockAdjustmentMinus(b, { adjustmentId: adjIdNum }) : true
      )
      .map((b) => mapBoxRow(b, pn, itemdcode, jc))
      .filter(isValidMinusDrawerBoxRow)
  );

  return { dailyprod, boxes, stickerRow };
}
