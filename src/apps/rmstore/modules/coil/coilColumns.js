"use client";

import { renderCoilCompactCell, renderCoilCustomerCell, renderCoilInwardUidCell, renderCoilIprIdCell, renderCoilLocationCell, renderCoilMrnCell, renderCoilOutUidCell, renderCoilQcIdStatusCell, renderCoilQtyCell, renderCoilRejectionIdCell, resolveCoilLocationLabel, resolveCoilQcIdStatusLabel } from "./coilTableVisuals";

export const COIL_CARD_CONFIG = {
  titleKey: "coil_no_uid",
  badgeIndices: [4],
  detailKeys: ["mrn_uid", "item_code", "item_desc", "qc_uid", "rm_uid", "sa_id", "ipr_uid", "in_uid", "out_uid", "pjobcardno", "macname", "heat_no", "acc_name", "location_no"],
  footerKey: "acc_name",
};

/** Compact IMS-style coil list — Area shows store / shop floor / consumed / rejection. */
export const COIL_HEADERS = [
  ["Coil No", "coil_no_uid", (v) => renderCoilCompactCell(v, "font-bold text-slate-800"), { fixed: true, width: "128px" }],
  ["MRN UID", "mrn_uid", renderCoilMrnCell, { width: "72px" }],
  ["Item Code", "item_code", (v) => renderCoilCompactCell(v, "font-mono font-bold"), { width: "108px" }],
  ["Description", "item_desc", (v) => renderCoilCompactCell(v, "font-bold text-slate-700 truncate max-w-[140px] block", v), { width: "148px" }],
  ["Qty", "qty", renderCoilQtyCell, { width: "52px", align: "center" }],
  ["Area", "location_no", renderCoilLocationCell, { width: "100px", align: "center", copyValue: (row) => resolveCoilLocationLabel(row)}],
  ["QC", "qc_uid", renderCoilQcIdStatusCell, { width: "96px", align: "center", copyValue: resolveCoilQcIdStatusLabel }],
  // ["Adj ID", "sa_id", renderCoilSaIdCell, { width: "64px",align: "center", copyValue: (row) => (row.sa_id != null ? String(row.sa_id) : "—")}],
  ["RM ID", "rm_uid", renderCoilRejectionIdCell, { width: "64px", align: "center", copyValue: (row) => (row?.rm_uid != null ? String(row.rm_uid) : "—")}],
  ["IPR ID", "ipr_uid", renderCoilIprIdCell, { width: "64px", align: "center", copyValue: (row) => (row.ipr_uid != null ? String(row.ipr_uid) : "—")}],
  ["Inward UID", "in_uid", renderCoilInwardUidCell, { width: "80px", copyValue: (row) => (row.in_uid != null ? String(row.in_uid) : "—")}],
  ["Outward UID", "out_uid", renderCoilOutUidCell, { width: "80px", copyValue: (row) => (row.out_uid != null ? String(row.out_uid) : "—")}],
  ["Job Card", "pjobcardno", (v) => renderCoilCompactCell(v, "font-mono font-bold text-slate-800"), { width: "100px" }],
  ["Machine", "macname", (v) => renderCoilCompactCell(v, "font-bold text-slate-700"), { width: "110px" }],
  ["Heat", "heat_no", (v) => renderCoilCompactCell(v, "font-mono text-slate-700"), { width: "76px" }],
  ["Vendor", "acc_name", renderCoilCustomerCell, { width: "120px", wrap: true }],
];
