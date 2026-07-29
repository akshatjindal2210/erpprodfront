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

/** Join selected bill numbers for save — e.g. HPF/26-27/0834,HPF/26-27/0835 (deduped). */
export function formatBillNosForSave(billNos) {
  const unique = uniqueBillNos(Array.isArray(billNos) ? billNos.map(String) : []);
  if (unique.length === 0) return null;
  return unique.join(",");
}

/** Live IMS bill numbers for SearchableSelect (via backend bill-helper). */
export async function fetchBillOptions({ search = "", page = 1, limit = 50 } = {}) {
  const res = await forwardingNoteService.getBillNumbers({ search, page, limit });
  const data = Array.isArray(res?.data) ? res.data : [];
  return {
    data,
    total: Number(res?.total) || data.length,
  };
}

/** Resolve one saved bill number for multi-select display. */
export async function getBillByNo(billNo) {
  const label = String(billNo ?? "").trim();
  if (!label) return { data: null };

  try {
    const res = await forwardingNoteService.getBillNumbers({ search: label, page: 1, limit: 100 });
    const data = Array.isArray(res?.data) ? res.data : [];
    const found = data.find((row) => String(row?.bill_no ?? "").trim() === label);
    if (found) return { data: found };
  } catch {
    /* fall through — show saved value even if IMS lookup fails */
  }

  return { data: { bill_no: label } };
}
