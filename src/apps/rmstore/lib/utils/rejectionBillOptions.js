import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";

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

/** Bill filter is decided by the backend from the rejection (acc_code + item_dcode; super admin: all) — send only its id. */
export function rejectionBillFilters(row) {
  return { qc_reject_uid: row?.qc_reject_uid ?? null };
}

/** Live invfnote bills (salecat=2) allowed for this rejection. */
export async function fetchBillOptions({ search = "", page = 1, limit = 50, qc_reject_uid } = {}) {
  const res = await rmRejectionService.getBillNumbers({ search, page, limit,
    ...(qc_reject_uid != null && { qc_reject_uid }),
  });
  const data = Array.isArray(res?.data) ? res.data : [];
  return {
    data,
    total: Number(res?.total) || data.length,
  };
}

/** Resolve one saved bill number for multi-select display. */
export async function getBillByNo(billNo, filters = {}) {
  const label = String(billNo ?? "").trim();
  if (!label) return { data: null };

  const { qc_reject_uid } = filters || {};
  try {
    const res = await rmRejectionService.getBillNumbers({ search: label, page: 1, limit: 100,
      ...(qc_reject_uid != null && { qc_reject_uid }),
    });
    const data = Array.isArray(res?.data) ? res.data : [];
    const found = data.find((row) => String(row?.bill_no ?? "").trim() === label);
    if (found) return { data: found };
  } catch {
    /* show saved value even if lookup fails */
  }

  return { data: { bill_no: label } };
}
