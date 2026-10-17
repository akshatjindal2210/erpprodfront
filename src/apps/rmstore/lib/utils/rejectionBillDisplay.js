import { formatDocDate } from "@/platform/utils/core/utilHelper";

/** Saved → matched → MRN → coil (same as list / AD report). */
export function rejectionBill(...srcs) {
  const coil = srcs.flatMap((s) => s?.coils || []).find((c) => c?.bill_no || c?.bill_dt) || {};
  const saved = String(srcs.map((s) => s?.bill_no).find(Boolean) || "").trim();
  const billNo =
    saved ||
    String(
      srcs.map((s) => s?.matched_bill_no).find(Boolean) ||
        srcs.map((s) => s?.mrn_bill_no).find(Boolean) ||
        coil.bill_no ||
        ""
    ).trim() ||
    null;
  const billDt =
    formatDocDate(
      saved
        ? srcs.map((s) => s?.bill_dt).find(Boolean)
        : srcs.map((s) => s?.matched_bill_dt).find(Boolean) ||
            srcs.map((s) => s?.mrn_bill_dt).find(Boolean) ||
            srcs.map((s) => s?.bill_dt).find(Boolean) ||
            coil.bill_dt
    ) || null;
  return { billNo, billDt };
}
