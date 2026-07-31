"use client";

import {
  renderCoilCompactCell,
  renderCoilCustomerCell,
  renderCoilLocationCell,
  renderCoilMrnCell,
  renderCoilQtyCell,
  resolveCoilLocationLabel,
} from "./coilTableVisuals";

export const COIL_CARD_CONFIG = {
  titleKey: "coil_no_uid",
  badgeIndices: [4],
  detailKeys: ["mrn_uid", "item_code", "item_desc", "heat_no", "acc_name", "location_no"],
  footerKey: "acc_name",
};

/** Compact IMS-style coil list — Area shows store / shop floor / consumed / rejection. */
export const COIL_HEADERS = [
  ["Coil No", "coil_no_uid", (v) => renderCoilCompactCell(v, "font-bold text-slate-800"), { fixed: true, width: "128px" }],
  ["MRN", "mrn_uid", renderCoilMrnCell, { width: "72px" }],
  ["Item Code", "item_code", (v) => renderCoilCompactCell(v, "font-mono font-bold"), { width: "108px" }],
  ["Description", "item_desc", (v) => renderCoilCompactCell(v, "font-bold text-slate-700 truncate max-w-[140px] block", v), { width: "148px" }],
  ["Qty", "qty", renderCoilQtyCell, { width: "52px", align: "center" }],
  ["Area", "location_no", renderCoilLocationCell, {
    width: "88px",
    copyValue: (row) => resolveCoilLocationLabel(row),
  }],
  ["Heat", "heat_no", (v) => renderCoilCompactCell(v, "font-mono text-slate-700"), { width: "76px" }],
  ["Customer", "acc_name", renderCoilCustomerCell, { width: "120px", wrap: true }],
];
