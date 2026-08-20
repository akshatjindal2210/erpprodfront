import { formatDateTime, formatDocDate } from "@/platform/utils/core/utilHelper";
import { fetchAllListPages } from "@/ui/common/list/clientListSearch";
import { getBoxStickerEntries } from "@/apps/ims/lib/utils/boxTransactionStickerEntries";
import { getBoxTxTypeBadgeClass, resolveBoxTxTypeLabel } from "@/apps/ims/lib/utils/boxTransactionVisuals";
import { boxTransactionLogService } from "@/apps/ims/lib/services/boxTransactionLog";

const TX_SKIP = new Set([
  "count", "total_qty", "qty", "per_box_qty", "box_kind", "standard_count", "loose_count",
  "box_no_uids", "box_uids", "box_sticker_entries", "action",
]);

const fmt = (v) => {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const push = (rows, label, value) => rows.push({ label, value: fmt(value) });

function parseDetails(raw) {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

export function boxJourneyKey(box) {
  return String(box?.box_no_uid ?? box?.box_uid ?? "").trim();
}

export function buildBoxDetailRows(box) {
  if (!box) return [];
  return [
    ["Box Sticker No", box.box_no_uid],
    ["Internal UID", box.box_uid],
    ["Packing No", box.packing_number],
    ["Job Card", box.job_card_no ?? box.job_no],
    ["Item Code", box.item_code],
    ["Item DCode", box.item_dcode ?? box.itemdcode],
    ["Description", box.item_desc ?? box.itemdesc],
    ["Customer", box.acc_name],
    ["Account Code", box.acc_code],
    ["Party Rate Cust Code", box.party_rate_cust_code],
    ["Qty", box.qty],
    ["Box Type", box.box_kind],
    ["Inward UID", box.in_uid != null ? `IN-${box.in_uid}` : null],
    ["Outward UID", box.out_uid != null ? `OUT-${box.out_uid}` : null],
    ["Stock Adjustment ID", box.sa_id],
    ["Location ID", box.location_id],
    ["Doc Date", box.doc_dt ? formatDocDate(box.doc_dt) : null],
    ["Created At", box.created_at ? formatDateTime(box.created_at) : null],
  ].map(([label, value]) => ({ label, value: fmt(value) }));
}

function buildTxEvent(row, typeLabels) {
  const d = parseDetails(row?.details);
  const lines = [];
  push(lines, "User", row?.user_name || "System");
  push(lines, "Module", row?.source_module?.replace(/_/g, " "));
  push(lines, "Reference", row?.source_id);
  push(lines, "Packing No", row?.packing_number);
  push(lines, "Box Count", row?.box_count ?? d.count);
  push(lines, "Qty", row?.total_qty ?? d.total_qty ?? d.qty);
  push(lines, "Box Type", row?.box_kind ?? d.box_kind);
  const std = d.standard_count ?? (row?.box_kind === "Standard" ? row?.box_count : null);
  const loose = d.loose_count ?? (row?.box_kind === "Loose" ? row?.box_count : null);
  if (std != null || loose != null) push(lines, "Standard / Loose", `${std ?? 0} / ${loose ?? 0}`);
  if (d.per_box_qty != null) push(lines, "Per Box Qty", d.per_box_qty);
  const stickers = getBoxStickerEntries(row);
  if (stickers.length) {
    push(
      lines,
      "Box Sticker No.",
      stickers
        .map((e) => `${e.box_no_uid}${e.is_loose ? " (loose)" : ""}${Number.isFinite(Number(e.qty)) ? ` qty ${e.qty}` : ""}`)
        .join(", ")
    );
  }
  Object.entries(d)
    .filter(([k, v]) => !TX_SKIP.has(k) && v != null && v !== "" && !(Array.isArray(v) && !v.length))
    .forEach(([k, v]) => push(lines, k.replace(/_/g, " "), v));

  return {
    id: `tx-${row?.id}`,
    at: row?.created_at ?? null,
    title: resolveBoxTxTypeLabel(row?.transaction_type, row, typeLabels),
    badgeClass: getBoxTxTypeBadgeClass(row?.transaction_type, row),
    lines,
  };
}

export async function fetchBoxFinderData(box) {
  const key = boxJourneyKey(box);
  const details = buildBoxDetailRows(box);
  if (!key) return { details, events: [] };

  let typeLabels = {};
  const { data } = await fetchAllListPages(async (page, limit) => {
    const res = await boxTransactionLogService.getAll({
      page,
      limit,
      filters: { journey: key },
      sortBy: "created_at",
      order: "ASC",
    });
    if (page === 1 && res?.typeLabels) typeLabels = res.typeLabels;
    return res;
  }, 500, 10000);

  const events = (data ?? [])
    .map((row) => buildTxEvent(row, typeLabels))
    .sort((a, b) => {
      const ta = a?.at ? new Date(a.at).getTime() : 0;
      const tb = b?.at ? new Date(b.at).getTime() : 0;
      return ta !== tb ? ta - tb : String(a.id).localeCompare(String(b.id));
    });

  return { details, events };
}
