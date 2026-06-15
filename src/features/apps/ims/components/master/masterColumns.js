"use client";

/**
 * Table columns, card config, row keys, search & filters — all master pages in one file.
 *
 * Sections:
 *   1. Packing Entry  → DailyProduction.js
 *   2. Product Master → ProductMaster.js
 *   3. Customer Master → CustomerMaster.js
 *   4. Party Rate Master → PartyRateMaster.js
 */
import { formatDateTime, formatDocDate } from "@/core/utils/utilHelper";
import { sortFilterOptionsAsc } from "@/core/utils/sortSelectOptions";
import { bestTierForStrings } from "@/features/apps/ims/helpers/liveSearchRank";

/* ─── 1. Packing Entry (DailyProduction.js) ─── */

export function dailyProdRowKey(row) {
  return `${row.doc_no}-${row.itemdcode}`;
}

export const DAILY_PRODUCTION_HEADERS = [
  ["Packing No", "doc_no", (v) => <span className="font-mono font-bold text-slate-700 text-[10px] uppercase">{v}</span>, { width: "100px", fixed: true }],
  ["Date", "doc_dt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatDocDate(v) || "—"}</span>, { width: "100px" }],
  ["Job Card", "job_card_no", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>, { width: "120px" }],
  ["Quantity", "total_qty", (v) => (
    <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px]">
      {parseFloat(v || 0).toLocaleString()}
    </span>
  ), { width: "100px" }],
  ["Customer", "acc_name", (v) => (
    <span className="text-slate-800 font-bold text-[10px] uppercase whitespace-normal break-words leading-snug hyphens-auto" title={v}>
      {v || "Unknown"}
    </span>
  ), { width: "250px", wrap: true }],
  ["Item Details", "item_code", (v) => (
    <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v}>{v}</span>
  )],
  ["Item Description", "item_desc", (v) => (
    <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v}>{v}</span>
  ), { width: "220px" }],
  ["Sticker Status", "sticker_generated", (v) => (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
      {v ? "● GENERATED" : "○ PENDING"}
    </span>
  ), { width: "110px" }],
  ["Created By", "sticker_created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px", copyValue: (row) => (row.sticker_generated ? formatDateTime(row.sticker_created_at) || "—" : "") }],
  ["Created At", "sticker_created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ["Updated By", "sticker_updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px", copyValue: (row) => (row.sticker_generated ? row.sticker_updated_by_name || "—" : "") }],
  ["Updated At", "sticker_updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
];

export const STICKER_STATUS_FILTER_OPTIONS = sortFilterOptionsAsc([
  { label: "All Status", value: "all" },
  { label: "Generated", value: "generated" },
  { label: "Pending", value: "pending" },
]);

export const DAILY_PROD_CARD_CONFIG = {
  titleKey: "job_card_no",
  badgeIndices: [0, 2],
  detailIndices: [4, 5, 6],
  footerKey: "doc_dt",
};

export function dailyProdSearchParts(row) {
  return [row.doc_no, row.job_card_no, row.acc_name, row.item_code, row.item_desc];
}

export function filterDailyProdByStickerStatus(rows, status) {
  if (status === "all") return rows;
  const wantGenerated = status === "generated";
  return rows.filter((row) => !!row.sticker_generated === wantGenerated);
}

/* ─── 2. Product Master (ProductMaster.js) ─── */

export const PRODUCT_MASTER_HEADERS = [
  ["Item Code", "item_code", (v) => <span className="font-mono text-[10px] font-bold tracking-tighter">{v}</span>, { width: "150px" }],
  ["Description", "itemdesc", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>, { width: "180px" }],
  ["Group", "grpname", (v) => (
    <span className="px-2 py-0.5 rounded-none text-[9px] font-bold border bg-slate-50 text-slate-600 border-slate-200 uppercase tracking-tighter">{v}</span>
  )],
  ["Min/Max", "minqty", (v, row) => <span className="text-slate-500 font-medium text-[10px]">{v} / {row.maxqty}</span>],
  ["Reorder", "reorderqty", (v) => <span className="font-bold text-amber-600 text-[11px]">{v}</span>],
  ["Status", "apvitem", (v) => (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
      {v ? "Active" : "Inactive"}
    </span>
  ), { width: "110px" }],
];

export const PRODUCT_CARD_CONFIG = {
  titleKey: "itemdesc",
  tagsKeys: ["grpname"],
  detailKeys: ["item_code", "reorderqty", "minqty"],
  className: "rounded-none border border-slate-200 shadow-none",
};

export function productRowKey(row) {
  return row.itemdcode;
}

export function productSearchParts(row) {
  return [row.item_code, row.itemdesc, row.grpname];
}

/* ─── 3. Customer Master (CustomerMaster.js) ─── */

export const CUSTOMER_MASTER_HEADERS = [
  ["Customer Name", "acc_name", (v) => (
    <span
      className="font-bold text-slate-700 text-[11px] md:text-xs uppercase tracking-tight py-1 block whitespace-normal break-words hyphens-auto leading-snug"
      title={v && String(v).length > 60 ? v : undefined}
    >
      {v && v.trim() !== "" ? v : "—"}
    </span>
  ), { wrap: true }],
];

export const CUSTOMER_CARD_CONFIG = {
  titleKey: "acc_name",
  className: "rounded-none border border-slate-200 shadow-none",
};

export function customerRowKey(row) {
  return row.acc_code;
}

export function customerSearchParts(row) {
  return [row.acc_name, row.acc_code, row.city];
}

/* ─── 4. Party Rate Master (PartyRateMaster.js) ─── */

export const PARTY_RATE_HEADERS = [
  ["Customer Name", "acc_name", (v) => (
    <span className="font-semibold text-slate-800 text-[11px] uppercase leading-snug whitespace-normal break-words hyphens-auto" title={v && String(v).length > 80 ? v : undefined}>
      {v || "—"}
    </span>
  ), { wrap: true, width: "180px" }],
  ["Item Code", "item_code", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight font-mono">{v || "—"}</span>, { width: "120px" }],
  ["Item Description", "itemdesc", (v) => (
    <span className="font-medium text-slate-700 text-[11px] leading-snug whitespace-normal break-words hyphens-auto">{v || "—"}</span>
  ), { wrap: true, width: "250px" }],
  ["Group Name", "grpname", (v) => (
    <span className="font-medium text-slate-700 text-[11px] leading-snug whitespace-normal break-words hyphens-auto">{v || "—"}</span>
  ), { wrap: true }],
  ["Customer Code", "narr1", (v) => <span className="text-slate-500 italic text-[11px] block max-w-[180px] truncate leading-tight">{v || "—"}</span>],
  ["Status", "itapv", (v) => (
    <span className={`px-2 py-0.5 rounded-none text-[9px] font-bold border uppercase tracking-widest ${
      v?.toUpperCase() === "APPROVED" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"
    }`}>
      {v || "PENDING"}
    </span>
  )],
];

export const PARTY_RATE_CARD_CONFIG = {
  titleKey: "acc_name",
  tagsKeys: ["itapv"],
  detailKeys: ["item_code", "itemdesc", "narr1"],
  className: "rounded-none border border-slate-200 shadow-none",
};

export function partyRateRowKey(row) {
  return row.row_id;
}

export function partyRateSearchParts(row) {
  return [row.acc_name, row.itemdesc, row.item_code, row.narr1, row.grpname, row.itapv];
}

export function sortPartyList(list, qRaw) {
  const q = String(qRaw ?? "").trim().toLowerCase();
  if (!q) {
    return [...list].sort((a, b) =>
      String(a.acc_name ?? "").localeCompare(String(b.acc_name ?? ""), undefined, { sensitivity: "base" })
    );
  }
  return [...list].sort((a, b) => {
    const ra = bestTierForStrings(q, [a.acc_name, a.acc_code]);
    const rb = bestTierForStrings(q, [b.acc_name, b.acc_code]);
    if (ra !== rb) return ra - rb;
    return String(a.acc_name ?? "").localeCompare(String(b.acc_name ?? ""), undefined, { sensitivity: "base" });
  });
}

export function sortItemOptionList(list, qRaw) {
  const q = String(qRaw ?? "").trim().toLowerCase();
  if (!q) {
    return [...list].sort((a, b) =>
      String(a.item_code ?? "").localeCompare(String(b.item_code ?? ""), undefined, { sensitivity: "base" })
    );
  }
  return [...list].sort((a, b) => {
    const ra = bestTierForStrings(q, [a.item_code, a.itemdesc, String(a.itemdcode ?? "")]);
    const rb = bestTierForStrings(q, [b.item_code, b.itemdesc, String(b.itemdcode ?? "")]);
    if (ra !== rb) return ra - rb;
    return String(a.item_code ?? "").localeCompare(String(b.item_code ?? ""), undefined, { sensitivity: "base" });
  });
}

export function buildUniqueParties(rows) {
  const map = new Map();
  for (const r of rows) {
    const code = r.acc_code;
    if (code == null || code === "") continue;
    const key = String(code);
    if (map.has(key)) continue;
    map.set(key, { acc_code: code, acc_name: r.acc_name || `Customer ${code}` });
  }
  return [...map.values()].sort((a, b) =>
    String(a.acc_name || "").localeCompare(String(b.acc_name || ""), undefined, { sensitivity: "base" })
  );
}

export function buildUniqueItemOptions(rows) {
  const map = new Map();
  for (const r of rows) {
    if (r.itemdcode == null || r.itemdcode === "") continue;
    const key = String(r.itemdcode);
    if (map.has(key)) continue;
    map.set(key, { itemdcode: r.itemdcode, item_code: r.item_code || key, itemdesc: r.itemdesc || "" });
  }
  return [...map.values()].sort((a, b) =>
    String(a.item_code ?? "").localeCompare(String(b.item_code ?? ""), undefined, { sensitivity: "base" })
  );
}

export function filterPartyRateRows(rows, { accCode, itemDcode } = {}) {
  let data = rows;
  if (accCode != null && accCode !== "") data = data.filter((r) => String(r.acc_code) === String(accCode));
  if (itemDcode != null && itemDcode !== "") data = data.filter((r) => String(r.itemdcode) === String(itemDcode));
  return data;
}

export function attachPartyRateRowIds(list) {
  return list.map((row, index) => ({ ...row, row_id: `${row.acc_code}-${row.itemdcode}-${index}` }));
}
