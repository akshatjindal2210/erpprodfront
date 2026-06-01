export function packingKey(packing_number) {
  return String(packing_number ?? "").trim() || "N/A";
}

export function itemGroupKey(row) {
  const code = String(row?.item_dcode ?? row?.item_code ?? "").trim();
  if (code) return code;
  if (row?.id != null) return `line_${row.id}`;
  return "unknown";
}

function isLooseBox(box) {
  return box?.is_loose === true || box?.is_loose === 1 || box?.is_loose === "true";
}

/**
 * Per packing: MAX(box/loose) per item, then SUM across different items.
 * Avoids double-count duplicate rows; adds requirements when multiple items share a packing.
 */
export function aggregatePackingBoxRequirements(items = []) {
  const byPacking = new Map();

  for (const row of items) {
    const pKey = packingKey(row?.packing_number);
    const iKey = itemGroupKey(row);
    if (!byPacking.has(pKey)) byPacking.set(pKey, new Map());
    const itemMap = byPacking.get(pKey);
    const cur = itemMap.get(iKey) || { box: 0, loose_box: 0 };
    cur.box = Math.max(cur.box, Number(row?.box) || 0);
    cur.loose_box = Math.max(cur.loose_box, Number(row?.loose_box) || 0);
    itemMap.set(iKey, cur);
  }

  const totals = new Map();
  for (const [pKey, itemMap] of byPacking) {
    let box = 0;
    let loose_box = 0;
    for (const v of itemMap.values()) {
      box += v.box;
      loose_box += v.loose_box;
    }
    totals.set(pKey, { box, loose_box });
  }
  return totals;
}

/** Forwarding note items grouped by item_dcode (multiple items per FUID). */
export function buildOutEntryItemGroups(items = []) {
  const byItem = new Map();
  for (const row of items) {
    const key = itemGroupKey(row);
    if (!byItem.has(key)) {
      byItem.set(key, {
        item_dcode: row.item_dcode,
        item_code: row.item_code ?? row.item_dcode,
        itemdesc: row.itemdesc ?? row.item_desc ?? null,
        packingLines: [],
      });
    }
    byItem.get(key).packingLines.push({
      id: row.id,
      packing_number: row.packing_number,
      box: Number(row.box) || 0,
      loose_box: Number(row.loose_box) || 0,
      box_qty: Number(row.box_qty) || 0,
      loose_box_qty: Number(row.loose_box_qty) || 0,
      total_qty: Number(row.total_qty) || 0,
    });
  }
  return Array.from(byItem.values());
}

/** Scan groups by packing_number (merged locations + aggregated box counts). */
export function buildOutEntryPackingGroups(items = []) {
  const reqTotals = aggregatePackingBoxRequirements(items);
  const groups = new Map();

  for (const row of items) {
    const packKey = packingKey(row?.packing_number);
    if (!groups.has(packKey)) {
      const totals = reqTotals.get(packKey) || { box: 0, loose_box: 0 };
      groups.set(packKey, {
        packing_number: row?.packing_number,
        itemCodes: new Set(),
        itemDescs: new Set(),
        box: totals.box,
        loose_box: totals.loose_box,
        box_qty: 0,
        loose_box_qty: 0,
        total_qty: 0,
        locations: [],
      });
    }

    const group = groups.get(packKey);
    const code = String(row?.item_code ?? row?.item_dcode ?? "").trim();
    const desc = String(row?.itemdesc ?? row?.item_desc ?? "").trim();
    if (code) group.itemCodes.add(code);
    if (desc) group.itemDescs.add(desc);

    group.box_qty = Math.max(group.box_qty, Number(row?.box_qty) || 0);
    group.loose_box_qty = Math.max(group.loose_box_qty, Number(row?.loose_box_qty) || 0);
    group.total_qty = Math.max(group.total_qty, Number(row?.total_qty) || 0);

    (row?.locations || []).forEach((loc) => {
      const locKey = `${loc?.location_id ?? ""}-${loc?.location_name ?? ""}`;
      const existingLocIdx = group.locations.findIndex(
        (l) => `${l?.location_id ?? ""}-${l?.location_name ?? ""}` === locKey
      );

      if (existingLocIdx === -1) {
        group.locations.push({
          ...loc,
          boxes: [...(loc?.boxes || [])],
        });
        return;
      }

      const existingLoc = group.locations[existingLocIdx];
      const existingBoxIds = new Set((existingLoc?.boxes || []).map((b) => b.box_no_uid));
      (loc?.boxes || []).forEach((box) => {
        if (!existingBoxIds.has(box.box_no_uid)) {
          existingLoc.boxes.push(box);
        }
      });
    });
  }

  return Array.from(groups.values()).map((g) => ({
    ...g,
    item_code_text: Array.from(g.itemCodes).join(", ") || "N/A",
    item_desc_text: Array.from(g.itemDescs).join(", ") || "N/A",
  }));
}

/** Index in packingGroups for first packing that has a scanned box (edit reload). */
export function findActivePackingIdxForScanned(packingGroups = [], scannedBoxIds) {
  const scanned =
    scannedBoxIds instanceof Set ? scannedBoxIds : new Set(scannedBoxIds || []);
  if (!scanned.size || !packingGroups.length) return 0;

  for (let idx = 0; idx < packingGroups.length; idx++) {
    const pg = packingGroups[idx];
    const hasScanned = (pg.locations || []).some((loc) =>
      (loc.boxes || []).some((box) => scanned.has(box.box_no_uid))
    );
    if (hasScanned) return idx;
  }
  return 0;
}

/** All box_no_uid listed on this forwarding note (packing area locations). */
export function collectForwardingNoteBoxUids(packingGroups = []) {
  const uids = new Set();
  for (const pg of packingGroups) {
    for (const loc of pg.locations || []) {
      for (const box of loc.boxes || []) {
        if (box?.box_no_uid) uids.add(box.box_no_uid);
      }
    }
  }
  return uids;
}

/** box_no_uid → box row (packing groups + DB-linked boxes for this out entry). */
export function buildOutEntryBoxIndex(packingGroups = [], linkedBoxes = []) {
  const index = new Map();
  for (const pg of packingGroups) {
    const packing_number = pg.packing_number;
    pg.locations?.forEach((loc) => {
      loc.boxes?.forEach((box) => {
        const uid = box?.box_no_uid;
        if (!uid) return;
        index.set(uid, { ...box, packing_number: box.packing_number ?? packing_number });
      });
    });
  }
  for (const box of linkedBoxes || []) {
    const uid = box?.box_no_uid;
    if (!uid || index.has(uid)) continue;
    index.set(uid, box);
  }
  return index;
}

/** Scan code (box_no_uid or numeric box_uid) → { box, canonicalBoxId, packing_number }. */
export function buildOutEntryScanCodeIndex(packingGroups = [], linkedBoxes = []) {
  const index = new Map();
  const boxIndex = buildOutEntryBoxIndex(packingGroups, linkedBoxes);
  for (const [uid, box] of boxIndex) {
    const packing_number = box.packing_number;
    const entry = { box, canonicalBoxId: uid, packing_number };
    index.set(String(uid).trim().toLowerCase(), entry);
    if (box.box_uid != null && String(box.box_uid).trim() !== "") {
      index.set(String(box.box_uid).trim().toLowerCase(), entry);
    }
  }
  return index;
}

export function countScannedFulfillmentByPacking(packingGroups = [], scannedBoxIds, linkedBoxes = []) {
  const scanned = scannedBoxIds instanceof Set ? scannedBoxIds : new Set(scannedBoxIds || []);
  const fnUids = collectForwardingNoteBoxUids(packingGroups);
  const boxIndex = buildOutEntryBoxIndex(packingGroups, linkedBoxes);
  const byPacking = new Map();

  for (const uid of scanned) {
    if (!fnUids.has(uid)) continue;
    const box = boxIndex.get(uid);
    if (!box) continue;
    const key = packingKey(box.packing_number);
    const cur = byPacking.get(key) || { standard: 0, loose: 0 };
    if (isLooseBox(box)) cur.loose += 1;
    else cur.standard += 1;
    byPacking.set(key, cur);
  }
  return byPacking;
}

export function getOutEntryFulfillmentIssues(packingGroups = [], scannedBoxIds, linkedBoxes = []) {
  const scannedByPacking = countScannedFulfillmentByPacking(packingGroups, scannedBoxIds, linkedBoxes);
  const issues = [];

  for (const pg of packingGroups) {
    const key = packingKey(pg.packing_number);
    const counts = scannedByPacking.get(key) || { standard: 0, loose: 0 };
    const reqStd = Number(pg.box) || 0;
    const reqLoose = Number(pg.loose_box) || 0;
    if (counts.standard !== reqStd || counts.loose !== reqLoose) {
      issues.push({
        packing_number: pg.packing_number,
        required_standard: reqStd,
        scanned_standard: counts.standard,
        required_loose: reqLoose,
        scanned_loose: counts.loose,
      });
    }
  }
  return issues;
}

export function isOutEntryFulfillmentComplete(packingGroups = [], scannedBoxIds, linkedBoxes = []) {
  if (!packingGroups.length) return false;
  const totalRequired = packingGroups.reduce(
    (sum, pg) => sum + (Number(pg.box) || 0) + (Number(pg.loose_box) || 0),
    0
  );
  if (totalRequired === 0) return false;
  return getOutEntryFulfillmentIssues(packingGroups, scannedBoxIds, linkedBoxes).length === 0;
}

/** Totals for tab badge + save draft label (aligned with fulfillment rules). */
export function getOutEntryGlobalScanTotals(packingProgressList = []) {
  let required = 0;
  let scanned = 0;
  for (const p of packingProgressList) {
    required += Number(p.required_total) || 0;
    scanned += (Number(p.scanned_standard) || 0) + (Number(p.scanned_loose) || 0);
  }
  return { scanned, required };
}

export function getOutEntryPackingProgressList(packingGroups = [], scannedBoxIds, linkedBoxes = []) {
  const scannedByPacking = countScannedFulfillmentByPacking(packingGroups, scannedBoxIds, linkedBoxes);
  return packingGroups.map((pg) => {
    const key = packingKey(pg.packing_number);
    const counts = scannedByPacking.get(key) || { standard: 0, loose: 0 };
    const reqStd = Number(pg.box) || 0;
    const reqLoose = Number(pg.loose_box) || 0;
    const required_total = reqStd + reqLoose;
    const scanned_total = counts.standard + counts.loose;
    const complete =
      required_total > 0 && counts.standard === reqStd && counts.loose === reqLoose;
    return {
      packing_number: pg.packing_number,
      required_standard: reqStd,
      required_loose: reqLoose,
      scanned_standard: counts.standard,
      scanned_loose: counts.loose,
      required_total,
      scanned_total,
      complete,
    };
  });
}

export function getOutEntryItemLineProgressList(itemGroups = [], packingProgressList = []) {
  const byPacking = new Map(
    packingProgressList.map((p) => [packingKey(p.packing_number), p])
  );
  const lines = [];
  for (const item of itemGroups) {
    for (const line of item.packingLines || []) {
      const progress = byPacking.get(packingKey(line.packing_number));
      const lineRequired = (Number(line.box) || 0) + (Number(line.loose_box) || 0);
      lines.push({
        line_id: line.id,
        item_code: item.item_code,
        itemdesc: item.itemdesc,
        packing_number: line.packing_number,
        box: line.box,
        loose_box: line.loose_box,
        line_required_total: lineRequired,
        packing_progress: progress,
        packing_complete: Boolean(progress?.complete),
      });
    }
  }
  return lines;
}

export function findPackingGroupByNumber(packingGroups = [], packing_number) {
  const key = packingKey(packing_number);
  return packingGroups.find((pg) => packingKey(pg.packing_number) === key) || null;
}

/** First packing tab that still needs scans (for auto-focus on open). */
export function findFirstIncompletePackingIdx(packingProgressList = []) {
  const idx = packingProgressList.findIndex((p) => !p.complete && (p.required_total || 0) > 0);
  return idx >= 0 ? idx : 0;
}

/** Next incomplete packing after `afterIdx`, else first incomplete. */
export function findNextIncompletePackingIdx(packingProgressList = [], afterIdx = -1) {
  for (let i = afterIdx + 1; i < packingProgressList.length; i++) {
    if (!packingProgressList[i].complete && (packingProgressList[i].required_total || 0) > 0) {
      return i;
    }
  }
  return findFirstIncompletePackingIdx(packingProgressList);
}

export function isPackingProgressComplete(progress) {
  return Boolean(progress?.complete && (progress?.required_total || 0) > 0);
}

export function formatPackingProgressShort(progress) {
  if (!progress || !progress.required_total) return "—";
  const { scanned_total, required_total, complete } = progress;
  return complete ? `✓ ${scanned_total}/${required_total}` : `${scanned_total}/${required_total}`;
}

export function formatItemLineRequirement(line) {
  const parts = [];
  if (Number(line?.box) > 0) parts.push(`${line.box} std`);
  if (Number(line?.loose_box) > 0) parts.push(`${line.loose_box} loose`);
  return parts.length ? parts.join(" + ") : "0 boxes";
}

export const OUT_ENTRY_APPROVE_BLOCKED_MSG =
  "Scan all required boxes for every item and packing on this forwarding note before approving.";
