import { masterService } from "@/features/apps/ims/services/master";
import { boxService } from "@/features/apps/ims/services/box";
import { stockAdjustmentService } from "@/features/apps/ims/services/stockAdjustment";
import { rowInIndianFinancialYear } from "@/core/utils/indianFinancialYear";
import { parseOptionalStandardQtyPerBox } from "@/features/apps/ims/utils/stockAdjustmentPacking";
import {
  dedupeMinusDrawerBoxRows,
  isBoxVisibleForStockAdjustmentMinus,
  isValidMinusDrawerBoxRow,
} from "@/features/apps/ims/utils/boxInventory";
function normDoc(v) {
  return String(v ?? "").trim();
}

function dailyprodFromMeta(serverMeta, pn) {
  if (!serverMeta) return null;
  const hasItem = serverMeta.itemdcode != null;
  const hasAcc =
    (serverMeta.acc_code != null && String(serverMeta.acc_code).trim() !== "") ||
    (serverMeta.acc_name != null && String(serverMeta.acc_name).trim() !== "");
  if (!hasItem && !hasAcc) return null;
  return {
    itemdcode: serverMeta.itemdcode ?? null,
    acc_code: serverMeta.acc_code ?? null,
    acc_name: serverMeta.acc_name ?? null,
    item_code: serverMeta.item_code ?? null,
    item_desc: serverMeta.item_desc ?? null,
    job_card_no: serverMeta.job_card_no ?? null,
    total_qty: serverMeta.total_qty ?? null,
    doc_dt: serverMeta.doc_dt ?? null,
    doc_no: serverMeta.doc_no ?? pn,
    party_rate_cust_code: serverMeta.party_rate_cust_code ?? null,
  };
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
 * Packing + boxes for stock adjustment drawer (fast path: packing-meta + in-hand only).
 * @param {string} packingNumber
 * @param {{
 *   forMinus?: boolean,
 *   adjustmentId?: number|null,
 *   itemDcode?: number|string|null,
 *   financialYear?: string,
 *   packingMeta?: object|null,
 *   prefillMeta?: object|null,
 *   fetchBoxes?: boolean,
 * }} [options]
 */
export async function loadPackingContext(packingNumber, options = {}) {
  const pn = normDoc(packingNumber);
  if (!pn) throw new Error("Packing number required");

  const forMinus = options?.forMinus === true;
  const adjustmentId = options?.adjustmentId ?? null;
  const adjIdNum =
    adjustmentId != null && Number(adjustmentId) > 0 ? Number(adjustmentId) : null;
  const itemDcodeOpt = options?.itemDcode ?? null;
  const fyOpt =
    options?.financialYear != null ? String(options.financialYear).trim() : "";

  const embeddedMeta = options.packingMeta ?? options.prefillMeta ?? null;
  const needBoxes = forMinus || options.fetchBoxes !== false;

  const [metaRes, inHandList] = await Promise.all([
    embeddedMeta
      ? Promise.resolve({ success: true, data: embeddedMeta })
      : stockAdjustmentService
          .getPackingMeta({
            packing_number: pn,
            adjustment_id: adjIdNum,
            item_dcode: itemDcodeOpt,
            financial_year: fyOpt || undefined,
          })
          .catch(() => ({ success: false })),
    needBoxes
      ? fetchInHandBoxesForPacking(pn, { adjustmentId: forMinus ? adjIdNum : null })
      : Promise.resolve([]),
  ]);

  const serverMeta = metaRes?.success ? metaRes.data : null;
  let dailyprod = dailyprodFromMeta(serverMeta, pn);

  if (!dailyprod && forMinus && (inHandList || []).length > 0) {
    const b0 = inHandList[0];
    const packingAcc = b0?.prod_acc_code ?? null;
    dailyprod = {
      itemdcode: b0?.itemdcode ?? b0?.item_dcode ?? null,
      acc_code: packingAcc != null ? String(packingAcc).trim() || null : null,
      acc_name: b0?.acc_name ?? null,
      doc_no: pn,
    };
  }

  const itemdcode = dailyprod?.itemdcode ?? null;
  const jc = dailyprod?.job_card_no ?? null;

  const boxes = needBoxes
    ? dedupeMinusDrawerBoxRows(
        (inHandList || [])
          .filter((b) =>
            forMinus ? isBoxVisibleForStockAdjustmentMinus(b, { adjustmentId: adjIdNum }) : true
          )
          .map((b) => mapBoxRow(b, pn, itemdcode, jc))
          .filter(isValidMinusDrawerBoxRow)
      )
    : [];

  let preview = {
    dailyprod,
    boxes,
    stickerRow: null,
    standard_qty_per_box: serverMeta?.standard_qty_per_box ?? null,
  };

  const metaComplete =
    serverMeta?.acc_name &&
    (serverMeta?.item_code || serverMeta?.itemdcode != null);
  if (fyOpt && !metaComplete && !options.prefillMeta) {
    preview = await enrichPackingPreviewFromImsPack(preview, pn, fyOpt);
  }
  if (serverMeta?.standard_qty_per_box != null && preview.standard_qty_per_box == null) {
    preview.standard_qty_per_box = serverMeta.standard_qty_per_box;
  }

  return preview;
}

/** IMS pack row → customer / JC / item (edit view + add load). */
export async function enrichPackingPreviewFromImsPack(packingPreview, packingNumber, financialYear) {
  const fy = String(financialYear ?? "").trim();
  const pn = normDoc(packingNumber);
  if (!fy || !pn || !packingPreview) return packingPreview;

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
    if (!imsRes?.success || recs.length < 1) return packingPreview;

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
            acc_code: first.acc_code ?? base.acc_code,
            total_qty: first.QTY != null ? String(first.QTY) : base.total_qty,
            doc_dt: first.doc_dt || first.docdt || base.doc_dt,
            doc_no: first.docno != null ? String(first.docno) : base.doc_no ?? pn,
            job_card_no: first.jobcardno || base.job_card_no,
            party_rate_cust_code: partyFromPackFy,
            item_code: first.item_code ?? base.item_code,
            item_desc: first.itemdesc ?? base.item_desc,
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

    return {
      ...packingPreview,
      dailyprod: mergedDaily,
      standard_qty_per_box: parseOptionalStandardQtyPerBox(imsRes.standard_qty_per_box),
    };
  } catch {
    return packingPreview;
  }
}
