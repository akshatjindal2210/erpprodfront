import { boxService } from "@/services/box";
import { fetchAllListPages } from "@/helpers/clientListSearch";
import { formatStockAdjustmentBoxNoUid } from "@/utils/stockAdjustmentPacking";
import { getBoxNoUidPrefix } from "@/global";

export function parseRemovedBoxUids(row) {
  const raw = row?.removed_box_ids;
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.map((u) => Number(u)).filter((n) => Number.isFinite(n) && n > 0);
  }
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return (Array.isArray(parsed) ? parsed : [])
      .map((u) => Number(u))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

export function mapSavedBoxesToAddRows(boxes, packingNo) {
  const pn = String(packingNo || "").trim();
  const list = Array.isArray(boxes) ? boxes : [];
  return list.map((b, i) => ({
    box_no: i + 1,
    box_uid: b.box_uid,
    box_no_uid: b.box_no_uid,
    package_no: b.packing_number ?? pn,
    total_boxes: list.length,
    qty: b.qty,
    unit: b.unit || "PCS",
    is_loose: !!b.is_loose,
    is_saved: true,
  }));
}

/**
 * Full add breakdown for view: merge DB boxes with expected SA rows from adjustment record.
 */
export function buildViewAddRowsFromAdjustment(row, dbBoxes, packingNo) {
  const pn = String(packingNo || "").trim();
  const adjId = Number(row?.adjustment_id);
  const n = parseInt(String(row?.box_count_impact ?? ""), 10);
  const perBox = parseInt(String(row?.per_box_qty ?? ""), 10);
  const unit = row?.unit || "PCS";

  if (!Number.isFinite(adjId) || adjId < 1 || !pn || !Number.isFinite(n) || n < 1) {
    return mapSavedBoxesToAddRows(dbBoxes, pn);
  }

  const byUid = new Map();
  for (const b of dbBoxes || []) {
    if (b?.box_no_uid) byUid.set(String(b.box_no_uid), b);
  }

  const rows = [];
  for (let i = 1; i <= n; i++) {
    const expectedUid = formatStockAdjustmentBoxNoUid(pn, adjId, n, i, getBoxNoUidPrefix());
    const db =
      byUid.get(expectedUid) ||
      (dbBoxes || []).find((b) => String(b.box_no_uid || "").endsWith(`_${n}_${i}`)) ||
      null;

    rows.push({
      box_no: i,
      box_uid: db?.box_uid ?? null,
      box_no_uid: db?.box_no_uid || expectedUid,
      package_no: db?.packing_number ?? pn,
      total_boxes: n,
      qty: db?.qty != null ? db.qty : Number.isFinite(perBox) && perBox > 0 ? perBox : row?.qty,
      unit: db?.unit || unit,
      is_loose: !!db?.is_loose,
      is_saved: !!db?.box_uid,
    });
  }
  return rows;
}

export async function loadBoxesBySaId(adjustmentId) {
  const adjId = Number(adjustmentId);
  if (!Number.isFinite(adjId) || adjId < 1) return [];

  const { data } = await fetchAllListPages(
    async (page, limit) => {
      const body = await boxService.getAll({
        page,
        limit,
        filters: { sa_id: adjId },
        sortBy: "box_uid",
        order: "ASC",
      });
      const list = Array.isArray(body?.data) ? body.data : [];
      const total = Number(body?.total ?? list.length);
      return { data: list, total: Number.isFinite(total) ? total : list.length };
    },
    1000,
    50000
  );

  return data.filter((b) => Number(b.sa_id) === adjId);
}

async function loadBoxesByUids(uids) {
  const unique = [...new Set(uids.map((u) => Number(u)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!unique.length) return [];

  const results = await Promise.all(
    unique.map(async (uid) => {
      try {
        const res = await boxService.getById(uid);
        return res?.data ?? res ?? null;
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean).sort((a, b) => Number(a.box_uid) - Number(b.box_uid));
}

/** Boxes for view/print: add (stock_in) by sa_id; minus by removed_box_ids then sa_id fallback. */
export async function loadBoxesForAdjustmentView(row) {
  const entryType = row?.entry_type;
  const adjId = Number(row?.adjustment_id);

  if (entryType === "minus") {
    const uids = parseRemovedBoxUids(row);
    if (uids.length) {
      const byUids = await loadBoxesByUids(uids);
      if (byUids.length) return byUids;
    }
    return loadBoxesBySaId(adjId);
  }

  return loadBoxesBySaId(adjId);
}
