import { boxService } from "@/apps/ims/lib/services/box";
import { fetchAllListPages } from "@/ui/common/list/clientListSearch";
import { formatSaBoxNoUid, STICKER } from "@/apps/ims/lib/stickerUidFormat";
import { parseStickerBoxIndex } from "@/apps/ims/lib/stickerUidHelpers";
import { getBoxNoUidPrefix } from "@/platform/utils/global";
import { fetchInHandBoxesForPacking } from "./loadPackingContext";
import { enrichMinusBoxCustomerNames } from "@/apps/ims/lib/utils/minusCustomerBreakdown";
import { pickBoxFromViewsResponse } from "@/apps/ims/lib/helpers/boxViewsLookup";

const STOCK_ADJ_PERMS = { permission_module: "stock_adjustment", permission_action: "view" };

export function parseRemovedBoxUids(row) {
  return parseRemovedBoxIdentifiers(row).uids;
}

/** Parse removed_box_ids — numeric box_uid and/or box_no_uid sticker strings. */
export function parseRemovedBoxIdentifiers(row) {
  const uids = [];
  const labels = [];
  const raw = row?.removed_box_ids;

  const collect = (items) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item == null || item === "") continue;
      if (typeof item === "number" && Number.isFinite(item) && item > 0) {
        uids.push(item);
        continue;
      }
      const s = String(item).trim();
      if (!s) continue;
      const n = Number(s);
      if (/^\d+$/.test(s) && Number.isFinite(n) && n > 0) {
        uids.push(n);
        continue;
      }
      labels.push(s);
    }
  };

  if (raw == null || raw === "") {
    return { uids: [], labels: [] };
  }
  if (Array.isArray(raw)) {
    collect(raw);
    return { uids: [...new Set(uids)], labels: [...new Set(labels)] };
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return { uids: [raw], labels: [] };
  }
  try {
    let parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    if (Array.isArray(parsed)) {
      collect(parsed);
      return { uids: [...new Set(uids)], labels: [...new Set(labels)] };
    }
    if (parsed && typeof parsed === "object") {
      const arr = parsed.uids ?? parsed.box_uids ?? parsed.removed_box_uids;
      if (Array.isArray(arr)) {
        collect(arr);
        return { uids: [...new Set(uids)], labels: [...new Set(labels)] };
      }
    }
  } catch {
    /* fall through */
  }
  if (typeof raw === "string") {
    const split = raw
      .replace(/^\[|\]$/g, "")
      .split(/[,;\s]+/)
      .map((u) => String(u).trim())
      .filter(Boolean);
    if (split.length) {
      collect(split);
      return { uids: [...new Set(uids)], labels: [...new Set(labels)] };
    }
  }
  return { uids: [], labels: [] };
}

/** Parse + dedupe; optionally cap to saved box_count_impact when DB has stale extras. */
export function parseRemovedBoxUidsForAdjustment(row) {
  const uids = [...new Set(parseRemovedBoxUids(row))];
  const impact = parseInt(String(row?.box_count_impact ?? ""), 10);
  if (Number.isFinite(impact) && impact > 0 && uids.length > impact) {
    return uids.slice(0, impact);
  }
  return uids;
}

/** Map saved removed_box_ids → checked box_uid set for minus edit/view. */
export function resolveMinusSelectedUidsForAdjustment(row, boxes) {
  const list = Array.isArray(boxes) ? boxes : [];
  const byUid = new Map();
  const byLabel = new Map();
  for (const b of list) {
    const uid = Number(b?.box_uid);
    const label = String(b?.box_no_uid ?? "").trim();
    if (!Number.isFinite(uid) || uid <= 0 || !label) continue;
    byUid.set(uid, b);
    byLabel.set(label, b);
  }

  const { uids, labels } = parseRemovedBoxIdentifiers(row);
  const impact = parseInt(String(row?.box_count_impact ?? ""), 10);
  const resolved = [];

  for (const u of uids) {
    if (byUid.has(u)) resolved.push(u);
  }
  for (const label of labels) {
    const b = byLabel.get(label);
    if (b?.box_uid != null) resolved.push(Number(b.box_uid));
  }

  let unique = [...new Set(resolved.filter((n) => Number.isFinite(n) && n > 0))];
  if (Number.isFinite(impact) && impact > 0 && unique.length > impact) {
    unique = unique.slice(0, impact);
  }
  return normalizeMinusSelectedUidSet(unique);
}

/** Normalize box_uid keys for Set lookup (string vs number). */
export function normalizeMinusSelectedUidSet(uids) {
  const out = new Set();
  for (const u of uids || []) {
    const n = Number(u);
    if (Number.isFinite(n) && n > 0) out.add(String(n));
  }
  return out;
}

export function isMinusBoxUidSelected(selectedUids, boxUid) {
  if (!(selectedUids instanceof Set) || boxUid == null || boxUid === "") return false;
  const target = Number(boxUid);
  if (!Number.isFinite(target) || target <= 0) return false;
  for (const x of selectedUids) {
    if (Number(x) === target) return true;
  }
  return false;
}

function stockAdjustmentAddStickerTag(adjustmentId) {
  const adjId = Number(adjustmentId);
  return Number.isFinite(adjId) && adjId > 0 ? `_${STICKER.SA}${adjId}_` : "";
}

function isStockAdjustmentAddSticker(boxNoUid, adjustmentId) {
  const tag = stockAdjustmentAddStickerTag(adjustmentId);
  return tag !== "" && String(boxNoUid ?? "").includes(tag);
}

function dedupeBoxesByUid(boxes) {
  const byUid = new Map();
  for (const b of boxes || []) {
    const uid = Number(b?.box_uid);
    if (!Number.isFinite(uid) || uid <= 0) continue;
    if (!byUid.has(uid)) byUid.set(uid, b);
  }
  return [...byUid.values()].sort((a, b) => Number(a.box_uid) - Number(b.box_uid));
}

function findDbBoxForAddSlot(dbBoxes, adjustmentId, slotIndex) {
  const idx = Number(slotIndex);
  if (!Number.isFinite(idx) || idx <= 0) return null;
  return (
    (dbBoxes || []).find(
      (b) =>
        isStockAdjustmentAddSticker(b?.box_no_uid, adjustmentId) &&
        parseStickerBoxIndex(b.box_no_uid) === idx
    ) ?? null
  );
}

/** Row count for add view: saved impact + qty/per-box + sticker slots in DB. */
export function resolveAddBoxCountForView(row, dbBoxes, adjustmentId) {
  const fromRecord = parseInt(String(row?.box_count_impact ?? row?.no_of_boxes ?? ""), 10);
  const perBox = parseInt(String(row?.per_box_qty ?? ""), 10);
  const totalQty = Math.abs(parseInt(String(row?.qty ?? ""), 10) || 0);
  let fromQty = 0;
  if (Number.isFinite(perBox) && perBox > 0 && totalQty > 0) {
    fromQty = Math.round(totalQty / perBox);
  }

  let maxIndex = 0;
  let stampCount = 0;
  for (const b of dbBoxes || []) {
    if (!isStockAdjustmentAddSticker(b?.box_no_uid, adjustmentId)) continue;
    stampCount += 1;
    maxIndex = Math.max(maxIndex, parseStickerBoxIndex(b.box_no_uid));
  }
  const n = Math.max(
    Number.isFinite(fromRecord) && fromRecord > 0 ? fromRecord : 0,
    Number.isFinite(fromQty) && fromQty > 0 ? fromQty : 0,
    maxIndex,
    stampCount
  );
  return n >= 1 ? n : Number.isFinite(fromRecord) && fromRecord > 0 ? fromRecord : 0;
}

async function loadAllBoxesBySaStickerPattern(adjustmentId, packingNo) {
  const adjId = Number(adjustmentId);
  const pn = String(packingNo ?? "").trim();
  if (!Number.isFinite(adjId) || adjId <= 0 || !pn) return [];

  try {
    const res = await boxService.getSaAddBoxesByAdjustment({
      packing_number: pn,
      adjustment_id: adjId,
    });
    return dedupeBoxesByUid(Array.isArray(res?.data) ? res.data : []);
  } catch {
    return [];
  }
}

/** Add entry view: box no longer in this adjustment's live stock (minus / stock_out). */
export function isAddBoxRemovedFromInventory(box, addAdjustmentId) {
  if (!box || box.is_deleted) return true;
  const adjId = Number(addAdjustmentId);
  if (String(box.sa_entry_type ?? "").trim() === "stock_out") return true;
  const sa = Number(box.sa_id);
  if (Number.isFinite(adjId) && adjId > 0 && Number.isFinite(sa) && sa > 0 && sa !== adjId) {
    return true;
  }
  if (Number.isFinite(adjId) && adjId > 0 && Number.isFinite(sa) && sa === adjId) {
    return String(box.sa_entry_type ?? "").trim() !== "stock_in";
  }
  return false;
}

/**
 * Add entry view/edit hydrate: all SA add stickers (`_SA{adjId}_`) for this packing,
 * including boxes later removed via minus or add-edit remove list.
 */
export async function loadAddBoxesForAdjustmentView(row) {
  const adjId = Number(row?.adjustment_id);
  const pn = String(row?.packing_number ?? "").trim();

  // Pending add — boxes are not in inventory yet; skip sa-add / list / get-by-id calls.
  if (String(row?.entry_type ?? "").trim() === "add" && !row?.approved) {
    return [];
  }

  if (!Number.isFinite(adjId) || adjId < 1 || !pn) {
    return loadSaAddBoxesForAdjustment(row);
  }

  const bySticker = await loadAllBoxesBySaStickerPattern(adjId, pn);
  const bySaId = dedupeBoxesByUid((await loadBoxesBySaId(adjId)).filter((b) => !b.is_deleted));
  let merged = dedupeBoxesByUid([...bySticker, ...bySaId]);

  const removedUids = parseRemovedBoxUids(row);
  if (removedUids.length && row?.approved) {
    const extra = await loadBoxesByUids(removedUids);
    merged = dedupeBoxesByUid([...merged, ...extra.filter((b) => !b.is_deleted)]);
  }

  if (merged.length) return merged;
  return loadSaAddBoxesForAdjustment(row);
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
  const perBox = parseInt(String(row?.per_box_qty ?? ""), 10);
  const unit = row?.unit || "PCS";
  const n = resolveAddBoxCountForView(row, dbBoxes, adjId);

  if (!Number.isFinite(adjId) || adjId < 1 || !pn || !Number.isFinite(n) || n < 1) {
    return mapSavedBoxesToAddRows(dbBoxes, pn);
  }

  const rows = [];
  for (let i = 1; i <= n; i++) {
    const db = findDbBoxForAddSlot(dbBoxes, adjId, i);
    const expectedUid = formatSaBoxNoUid(pn, adjId, n, i, getBoxNoUidPrefix());
    const removed = db ? isAddBoxRemovedFromInventory(db, adjId) : false;
    rows.push({
      box_no: i,
      box_uid: db?.box_uid ?? null,
      box_no_uid: db?.box_no_uid || expectedUid,
      package_no: db?.packing_number ?? pn,
      total_boxes: n,
      qty:
        db?.qty != null
          ? db.qty
          : Number.isFinite(perBox) && perBox > 0
            ? perBox
            : Math.abs(parseInt(String(row?.qty ?? ""), 10) || 0) / n || row?.qty,
      unit: db?.unit || unit,
      is_loose: db?.box_uid != null ? !!db.is_loose : false,
      is_saved: !!db?.box_uid,
      is_removed: removed,
    });
  }
  return rows;
}

export async function loadBoxesBySaId(adjustmentId) {
  const adjId = Number(adjustmentId);
  if (!Number.isFinite(adjId) || adjId < 1) return [];

  const { data } = await fetchAllListPages(
    async (page, limit) => {
      const body = await boxService.getViews({
        page,
        limit,
        filters: { sa_id: adjId },
        sortBy: "box_uid",
        order: "ASC",
        ...STOCK_ADJ_PERMS,
      });
      const list = Array.isArray(body?.data) ? body.data : [];
      const total = Number(body?.total ?? list.length);
      return { data: list, total: Number.isFinite(total) ? total : list.length };
    },
    1000,
    50000
  );

  return data
    .filter((b) => Number(b.sa_id) === adjId)
    .sort((a, b) => Number(a.box_uid) - Number(b.box_uid));
}

/** Approved add boxes — list by sa_id, fallback to in-hand boxes for this packing. */
export async function loadSaAddBoxesForAdjustment(row) {
  const adjId = Number(row?.adjustment_id);
  const pn = String(row?.packing_number ?? "").trim();
  if (!Number.isFinite(adjId) || adjId < 1) return [];

  let boxes = await loadBoxesBySaId(adjId);
  boxes = (boxes || []).filter(
    (b) => String(b.sa_entry_type ?? "").trim() !== "stock_out" && !b.is_deleted
  );
  if (boxes.length) return boxes;

  if (!pn) return [];
  const inHand = await fetchInHandBoxesForPacking(pn);
  return (inHand || []).filter(
    (b) =>
      Number(b.sa_id) === adjId &&
      String(b.sa_entry_type ?? "").trim() === "stock_in"
  );
}

async function loadBoxesByUids(uids) {
  const unique = [...new Set(uids.map((u) => Number(u)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!unique.length) return [];

  const results = await Promise.all(
    unique.map(async (uid) => {
      try {
        const res = await boxService.getViews({
          box_uid: uid,
          id: String(uid),
          ...STOCK_ADJ_PERMS,
        });
        if (res?.success === false) return null;
        return pickBoxFromViewsResponse(res);
      } catch {
        return null;
      }
    })
  );
  return results
    .filter(Boolean)
    .map((b) => ({ ...b, box_uid: b.box_uid ?? b.id }))
    .sort((a, b) => Number(a.box_uid) - Number(b.box_uid));
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

  return loadSaAddBoxesForAdjustment(row);
}

/** Load saved minus plan boxes — only removed_box_ids (capped to box_count_impact). */
export async function loadMinusPlanBoxes(row) {
  const adjId = Number(row?.adjustment_id);
  const pn = String(row?.packing_number ?? "").trim();
  const uids = parseRemovedBoxUidsForAdjustment(row);
  const uidSet = new Set(uids.map((u) => Number(u)));

  if (!uidSet.size) return [];

  let boxes = await loadBoxesByUids(uids);

  if (pn && Number.isFinite(adjId) && adjId > 0) {
    const merged = await fetchInHandBoxesForPacking(pn, { adjustmentId: adjId });
    const stockOutForAdj = (merged || []).filter((b) => {
      const uid = Number(b.box_uid);
      if (!uidSet.has(uid)) return false;
      if (Number(b.sa_id) !== adjId) return false;
      if (String(b.sa_entry_type ?? "").trim() === "stock_out") return true;
      return Number(b.out_uid) === adjId;
    });
    const stockOutByUid = new Map(
      stockOutForAdj.map((b) => [Number(b.box_uid), b]).filter(([uid]) => Number.isFinite(uid))
    );
    if (!boxes.length) {
      boxes = stockOutForAdj;
    } else {
      boxes = boxes.map((b) => {
        const live = stockOutByUid.get(Number(b.box_uid));
        if (!live) return b;
        return {
          ...b,
          box_no_uid: b.box_no_uid ?? live.box_no_uid,
          qty: b.qty ?? live.qty,
          is_loose: b.is_loose ?? live.is_loose,
          packing_number: b.packing_number ?? live.packing_number,
          sa_id: b.sa_id ?? live.sa_id,
          sa_entry_type: b.sa_entry_type ?? live.sa_entry_type,
          out_uid: b.out_uid ?? live.out_uid,
        };
      });
      const seen = new Set(boxes.map((b) => Number(b.box_uid)));
      for (const b of stockOutForAdj) {
        const uid = Number(b.box_uid);
        if (Number.isFinite(uid) && uidSet.has(uid) && !seen.has(uid)) {
          boxes.push(b);
          seen.add(uid);
        }
      }
    }
  }

  if (!boxes.length && Number.isFinite(adjId) && adjId > 0) {
    const bySa = await loadBoxesBySaId(adjId);
    boxes = (bySa || []).filter(
      (b) =>
        uidSet.has(Number(b.box_uid)) &&
        String(b.sa_entry_type ?? "").trim() === "stock_out" &&
        !b.is_deleted
    );
  }

  const sorted = boxes
    .filter((b) => uidSet.has(Number(b.box_uid)))
    .sort((a, b) => Number(a.box_uid) - Number(b.box_uid));

  return enrichMinusBoxCustomerNames(sorted, row?.item_dcode);
}
