import { getLocationDisplayNo } from "@/apps/rmstore/lib/helpers/locationQrLabel";

function t(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

/** Footer “Selected: …” for list pages — pass to AppListFooter. */
export const rmStoreSelectionLabel = {
  production: (r) => `Selected: ${t(r?.item_code)} → ${t(r?.rm_item_code)}`,
  rmSpec: (r) => `Selected: ${t(r?.item_code)} · ${r?.spec_count ?? 0} line${(r?.spec_count ?? 0) === 1 ? "" : "s"}`,
  storeLocation: (r) => {
    const loc = getLocationDisplayNo(r);
    return `Selected: ${loc} | RM Rack: ${t(r?.rack_no)} | RM Row: ${(r?.row_no || "—").toString().toUpperCase()}`;
  },
  coil: (r) => `Selected: ${t(r?.coil_no_uid)}`,
  stockAdjustment: (r) => {
    let s = `Selected: ADJ-#${t(r?.id ?? r?.adjustment_id)}`;
    if (r?.item_code) s += ` · ${r.item_code}`;
    if (r?.item_desc) s += ` — ${r.item_desc}`;
    return s;
  },
  qcCheck: (r) => {
    const id = r?.qc_check_uid != null ? `QC-${r.qc_check_uid}` : "Pending";
    return `Selected: ${id} · ${t(r?.coil_no_uid)}`;
  },
};

export function rmStoreIssueRequestSelectionLabel(isSummary) {
  return (r) => {
    if (isSummary) {
      return `Selected: Issue #${t(r?.issue_uid)} · ${t(r?.item_code)} · RM ${t(r?.rm_item_code)} · Qty ${Number(r?.requested_qty || 0).toLocaleString()} · ${r?.coil_count ?? 0} coil(s)`;
    }
    return `Selected: Issue #${t(r?.issue_uid)} · ${t(r?.pjobcardno)} · Issue Qty ${Number(r?.issue_qty || 0).toLocaleString()} · ${r?.coil_count ?? 0} coil(s)`;
  };
}

export function rmStoreInProcessSelectionLabel(isPendingTab) {
  return (r) => {
    if (isPendingTab && (r?._pendingKind === "shop_floor" || (!r?.ipr_uid && r?.coil_no_uid))) {
      return `Selected: ${t(r?.coil_no_uid)} · ${t(r?.item_code)} · Qty ${Number(r?.qty || 0).toLocaleString()} · JC ${t(r?.pjobcardno)}`;
    }
    return `Selected: IPR #${t(r?.ipr_uid)} · ${t(r?.item_code)}`;
  };
}

export function rmStoreMrnPortalSelectionLabel(isComparisonView) {
  return (r) => {
    if (isComparisonView) {
      return `Selected: Mismatch · MRN ${t(r?.mrn_no)} · ERP vs RM Store (red = mismatch)`;
    }
    return `Selected: MRN ${t(r?.mrn_no)} | ${t(r?.item_code)} | Qty ${t(r?.it_recp_qty)}`;
  };
}
