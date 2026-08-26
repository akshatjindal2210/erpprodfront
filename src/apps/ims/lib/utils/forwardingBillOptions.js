import { forwardingNoteService } from "@/apps/ims/lib/services/forwardingNote";

/** Keep first occurrence only — avoids duplicate React keys in multi-select tags. */
export function uniqueBillNos(billNos) {
  const seen = new Set();
  const out = [];
  for (const raw of billNos || []) {
    const billNo = String(raw ?? "").trim();
    if (!billNo || seen.has(billNo)) continue;
    seen.add(billNo);
    out.push(billNo);
  }
  return out;
}

/** Split stored bill_no string into individual bill numbers (deduped). */
export function parseSavedBillNos(raw) {
  if (raw == null || raw === "") return [];
  return uniqueBillNos(
    String(raw)
      .split(/,\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

/** Join selected bill numbers for save. */
export function formatBillNosForSave(billNos) {
  const unique = uniqueBillNos(Array.isArray(billNos) ? billNos.map(String) : []);
  if (unique.length === 0) return null;
  return unique.join(",");
}

export function isBlankForwardingBill(row = {}) {
  return !String(row?.billno ?? "").trim();
}

/** Row → payload item for bill-helper (backend decides match key). */
export function billHelperItemFromRow(row = {}) {
  if (!row) return null;
  const acc_code = row.acc_code;
  const item_dcode = row.item_dcode ?? row.itemdcode;
  if (acc_code == null || item_dcode == null) return null;
  return {
    acc_code,
    item_dcode,
    packing_number: row.packing_number ?? row.packing ?? null,
  };
}

/** Live invfnote bills — pass selected row fields; match mode is backend-only. */
export async function fetchBillOptions({ search = "", page = 1, limit = 50, items = [] } = {}) {
  const res = await forwardingNoteService.getBillNumbers({ search, page, limit, items });
  const data = Array.isArray(res?.data) ? res.data : [];
  return {
    data,
    total: Number(res?.total) || data.length,
  };
}

export async function getBillByNo(billNo, { items = [] } = {}) {
  const label = String(billNo ?? "").trim();
  if (!label) return { data: null };

  try {
    const res = await forwardingNoteService.getBillNumbers({
      search: label,
      page: 1,
      limit: 100,
      items,
    });
    const data = Array.isArray(res?.data) ? res.data : [];
    const found = data.find((row) => String(row?.bill_no ?? row?.billno ?? "").trim() === label);
    if (found) return { data: found };
  } catch {
    /* fall through */
  }

  return { data: { bill_no: label, billno: label } };
}
