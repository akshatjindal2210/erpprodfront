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

/** Live invfnote bills (salecat=2). Pass acc_code / item_code / item_dcode to filter. */
export async function fetchBillOptions({ search = "", page = 1, limit = 50, acc_code, item_code, item_dcode } = {}) {
  const res = await rmRejectionService.getBillNumbers({ search, page, limit,
    ...(acc_code != null && acc_code !== "" && { acc_code }),
    ...(item_code != null && item_code !== "" && { item_code }),
    ...(item_dcode != null && item_dcode !== "" && { item_dcode }),
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

  const { acc_code, item_code, item_dcode } = filters || {};
  try {
    const res = await rmRejectionService.getBillNumbers({ search: label, page: 1, limit: 100,
      ...(acc_code != null && acc_code !== "" && { acc_code }),
      ...(item_code != null && item_code !== "" && { item_code }),
      ...(item_dcode != null && item_dcode !== "" && { item_dcode }),
    });
    const data = Array.isArray(res?.data) ? res.data : [];
    const found = data.find((row) => String(row?.bill_no ?? "").trim() === label);
    if (found) return { data: found };
  } catch {
    /* show saved value even if lookup fails */
  }

  return { data: { bill_no: label } };
}
