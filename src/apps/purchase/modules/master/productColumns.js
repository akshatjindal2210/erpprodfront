"use client";

function formatProductWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export const PRODUCT_MASTER_HEADERS = [
  ["Item Code", "item_code", (v) => <span className="font-mono text-[10px] font-bold tracking-tighter">{v}</span>, { width: "120px" }],
  ["Description", "itemdesc", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>, { width: "180px" }],
  ["Group", "grpname", (v) => (
    <span className="px-2 py-0.5 rounded-none text-[9px] font-bold border bg-slate-50 text-slate-600 border-slate-200 uppercase tracking-tighter">{v}</span>
  )],
  ["Weight", "weight", (v) => (
    <span className="text-slate-600 font-medium text-[10px] tabular-nums">{formatProductWeight(v)}</span>
  ), { width: "80px" }],
  ["Min/Max", "minqty", (v, row) => <span className="text-slate-500 font-medium text-[10px]">{v} / {row.maxqty}</span>],
  ["Reorder", "reorderqty", (v) => <span className="font-bold text-amber-600 text-[11px]">{v}</span>],
  ["Primary Item Code", "primitem_code", (v) => (
    <span className="font-mono text-[10px] font-bold tracking-tighter">{v || "—"}</span>
  ), { width: "110px" }],
  ["Status", "apvitem", (v) => (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
      {v ? "Active" : "Inactive"}
    </span>
  ), { width: "110px" }],
];

export const PRODUCT_CARD_CONFIG = {
  titleKey: "itemdesc",
  tagsKeys: ["grpname", "primitem_code"],
  detailKeys: ["item_code", "weight", "reorderqty", "minqty"],
  className: "rounded-none border border-slate-200 shadow-none",
};

export function productRowKey(row) {
  return row.itemdcode;
}

export function productSearchParts(row) {
  const isActive = Number(row.apvitem) === 1 || row.apvitem === true;
  return [
    row.item_code,
    row.primitem_code,
    row.primitemdesc,
    row.itemdesc,
    row.grpname,
    row.itemdcode,
    isActive ? "active" : "inactive",
    isActive ? "approved" : "pending",
  ];
}
