function t(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

/** Footer “Selected: …” for IMS list pages — pass to MasterListFooter / ListPageFooter. */
export const imsSelectionLabel = {
  box: (r) => `Selected: ${t(r?.box_no_uid)}`,
  location: (r) => {
    const loc = r?.location_no || `${t(r?.rack_no)}${String(r?.shelf_no ?? "").toUpperCase()}` || "—";
    return `Selected: ${loc} | Rack: ${t(r?.rack_no)} | Shelf: ${String(r?.shelf_no ?? "—").toUpperCase()}`;
  },
  packingStandard: (r) => `Selected: ${t(r?.item_code)}`,
  product: (r) => `Selected: ${t(r?.item_code)} | ${t(r?.itemdesc)}`,
  customer: (r) => `Selected: ${t(r?.acc_name)}`,
  partyRate: (r) => `Selected: ${t(r?.acc_name)} · ${t(r?.item_code || r?.itemdesc)}`,
  shortage: (r) => `Selected: ${t(r?.item_code || r?.itemcode || r?.id)}`,
  stockAdjustment: (r) => {
    let s = `Selected: ADJ-#${t(r?.id ?? r?.adjustment_id)}`;
    if (r?.item_code) s += ` · ${r.item_code}`;
    if (r?.item_desc) s += ` — ${r.item_desc}`;
    return s;
  },
  qcHold: (r) => {
    let s = `Selected: #${t(r?.hold_id)}`;
    if (r?.packing_number) s += ` · ${r.packing_number}`;
    if (r?.item_code) s += ` · ${r.item_code}`;
    if (r?.balance_qty != null) s += ` · Bal ${Number(r.balance_qty).toLocaleString()} qty`;
    return s;
  },
  auditMaster: (r) => `Selected: Audit #${t(r?.audit_id)}`,
  auditLocation: (r) => `Selected: ${t(r?.location_no)} · Audit #${t(r?.audit_id)}`,
  stickerOverride: (r) => `Selected: Request #${t(r?.request_id)} (${t(r?.packing_number)})`,
  boxTransactionLog: (r) => {
    const type = r?.transaction_type ? String(r.transaction_type).replace(/_/g, " ") : "—";
    return `Selected: Log #${t(r?.id)} · ${type}`;
  },
};

export function imsScheduleSelectionLabel(isScheduleTab) {
  return (r) => {
    let s = `Selected: Sch ${t(r?.schno)} · ${t(r?.acc_name)}`;
    if (!isScheduleTab && r?.item_code) s += ` · ${r.item_code}`;
    return s;
  };
}

export function imsGateEntryLabel(isPending) {
  return (r) => {
    if (isPending) return `Selected: ${t(r?.billno || r?.bill_no)}`;
    const kind = String(r?.type || "out").toLowerCase() === "in" ? "IN" : "OUT";
    const bill = r?.bill_no ? ` · ${r.bill_no}` : "";
    return `Selected: ${kind}-${t(r?.uid)}${bill}`;
  };
}
