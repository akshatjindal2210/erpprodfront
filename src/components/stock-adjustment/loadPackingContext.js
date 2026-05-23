import { masterService } from "@/services/master";
import { boxService } from "@/services/box";
import { isBoxInHand, isBoxVisibleForStockAdjustmentMinus } from "@/utils/boxInventory";

function normDoc(v) {
  return String(v ?? "").trim();
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
export async function fetchInHandBoxesForPacking(packingNumber) {
  const pn = normDoc(packingNumber);
  if (!pn) return [];
  const res = await boxService.getInHandBoxesByPacking({ packing_number: pn });
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

  const [dpRes, stickerRes, inHandRes] = await Promise.all([
    masterService.getDailyProd({
      search: pn,
      page: 1,
      limit: 5000,
    }),
    boxService.getStickers({ doc_no: pn }).catch(() => ({ success: false, data: [] })),
    forMinus
      ? fetchInHandBoxesForPacking(pn)
      : boxService
          .getAll({
            page: 1,
            limit: 1000,
            filters: { packing_number: pn },
            sortBy: "box_uid",
            order: "ASC",
          })
          .then((r) => (Array.isArray(r?.data) ? r.data.filter((b) => !b.is_deleted && isBoxInHand(b)) : []))
          .catch(() => []),
  ]);

  const dailyList = Array.isArray(dpRes?.data) ? dpRes.data : [];
  const dailyRow = dailyList.find((r) => rowMatchesPacking(r, pn)) || null;

  const stickerRow =
    stickerRes?.success && Array.isArray(stickerRes.data) && stickerRes.data.length > 0
      ? stickerRes.data[0]
      : null;

  const itemdcode = dailyRow?.itemdcode ?? stickerRow?.itemdcode ?? null;
  const dailyprod =
    itemdcode != null
      ? {
          itemdcode,
          acc_code: dailyRow?.acc_code ?? stickerRow?.acc_code ?? null,
          item_code: dailyRow?.item_code ?? stickerRow?.item_code ?? null,
          item_desc: dailyRow?.item_desc ?? stickerRow?.itemdesc ?? stickerRow?.item_desc ?? null,
          job_card_no: dailyRow?.job_card_no ?? stickerRow?.job_card_no ?? null,
          total_qty: dailyRow?.total_qty ?? stickerRow?.total_qty ?? null,
          doc_dt: dailyRow?.doc_dt ?? stickerRow?.doc_dt ?? null,
          doc_no: dailyRow?.doc_no ?? stickerRow?.doc_no ?? pn,
        }
      : null;

  const jc = dailyprod?.job_card_no ?? null;

  let boxes;
  if (forMinus) {
    const inHandList = Array.isArray(inHandRes) ? inHandRes : [];
    boxes = inHandList
      .filter((b) => isBoxVisibleForStockAdjustmentMinus(b, { adjustmentId }))
      .map((b) => mapBoxRow(b, pn, itemdcode, jc));
  } else {
    const boxList = Array.isArray(inHandRes) ? inHandRes : [];
    boxes = boxList.map((b) => mapBoxRow(b, pn, itemdcode, jc));
  }

  return { dailyprod, boxes, stickerRow };
}
