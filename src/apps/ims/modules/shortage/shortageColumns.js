import { Layers, List } from "lucide-react";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

export const SHORTAGE_PAGE_TABS = [
  { id: "master", label: "Master-wise", icon: Layers },
  { id: "item-wise", label: "Item-wise", icon: List },
];

function typeBadgeClass(type) {
  if (type === "Deviation") return "bg-amber-50 text-amber-700 border border-amber-200";
  if (type === "PPC") return "bg-blue-50 text-blue-700 border border-blue-200";
  if (type === "WIP") return "bg-violet-50 text-violet-700 border border-violet-200";
  return "bg-slate-50 text-slate-600 border border-slate-200";
}

function drillButton(label, onClick, title) {
  if (!onClick) {
    return <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="font-bold text-indigo-600 uppercase text-[11px] tracking-tight hover:underline cursor-pointer"
      title={title}
    >
      {label}
    </button>
  );
}

export function shortageMasterSearchParts(row) {
  return [
    row.item_code,
    row.itemcode,
    row.item_desc,
    row.primitem_code,
    row.grpname,
    row.total_shortage_qty,
    row.produced_qty,
    row.remaining_balance,
    row.entry_count,
    ...(Array.isArray(row.types) ? row.types : []),
  ];
}

export function shortageItemWiseSearchParts(row) {
  return [
    row.id,
    row.item_code,
    row.itemcode,
    row.item_desc,
    row.primitem_code,
    row.grpname,
    row.type,
    row.qty,
    row.remarks,
    row.created_by_name,
    row.created_by,
  ];
}

export function buildShortageMasterHeaders({ onDrillToItems } = {}) {
  return [
    [
      "Item Code",
      "item_code",
      (v, row) =>
        drillButton(
          v || row.itemcode || "—",
          onDrillToItems ? () => onDrillToItems(row) : null,
          `View ${Number(row.entry_count ?? 0)} entr${Number(row.entry_count ?? 0) === 1 ? "y" : "ies"} in Item-wise`
        ),
      { fixed: true, width: "140px" },
    ],
    ["Primary", "primitem_code", (v) => (
      <span className="text-[10px] font-semibold text-slate-600 uppercase">{v || "—"}</span>
    ), { width: "120px" }],
    ["Group", "grpname", (v) => (
      <span className="text-[10px] font-medium text-slate-500 uppercase">{v || "—"}</span>
    ), { width: "120px" }],
    ["Description", "item_desc", (v) => <span className="text-[10px] text-slate-500 truncate block italic">{v || "—"}</span>, { width: "200px" }],
    [
      "Entries",
      "entry_count",
      (v, row) =>
        drillButton(
          <span className="font-black text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>,
          onDrillToItems ? () => onDrillToItems(row) : null,
          `Open ${Number(v ?? 0).toLocaleString()} entr${Number(v ?? 0) === 1 ? "y" : "ies"} in Item-wise`
        ),
      { width: "90px", align: "center" },
    ],
    ["Types", "types", (v) => {
      const list = Array.isArray(v) ? v : [];
      if (!list.length) return <span className="text-[10px] text-slate-400">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {list.map((t) => (
            <span key={t} className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(t)}`}>{t}</span>
          ))}
        </div>
      );
    }, { width: "160px", copyValue: (row) => (Array.isArray(row.types) ? row.types.join(", ") : "") }],
    ["Total Shortage", "total_shortage_qty", (v) => (
      <span className="font-black text-slate-800 text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>
    ), { width: "120px", align: "center" }],
    ["Produced", "produced_qty", (v) => (
      <span className="font-bold text-indigo-700 text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>
    ), { width: "110px", align: "center" }],
    ["Balance", "remaining_balance", (v) => {
      const n = Number(v ?? 0);
      const tone = n < 0 ? "text-rose-600" : n === 0 ? "text-slate-500" : "text-emerald-700";
      return <span className={`font-black text-[11px] tabular-nums ${tone}`}>{n.toLocaleString()}</span>;
    }, { width: "110px", align: "center" }],
    ["Authorized Qty", "approved_qty", (v) => (
      <span className="text-[10px] font-semibold text-emerald-700 tabular-nums">{Number(v ?? 0).toLocaleString()}</span>
    ), { width: "110px", align: "center" }],
    ["Pending Qty", "pending_qty", (v) => (
      <span className="text-[10px] font-semibold text-amber-700 tabular-nums">{Number(v ?? 0).toLocaleString()}</span>
    ), { width: "100px", align: "center" }],
  ];
}

export function buildShortageItemWiseHeaders() {
  return [
    ["Shortage No", "id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "80px" }],
    ["Item Code", "item_code", (v, row) => (
      <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v || row.itemcode || "—"}</span>
    ), { fixed: true, width: "140px" }],
    ["Primary", "primitem_code", (v) => (
      <span className="text-[10px] font-semibold text-slate-600 uppercase">{v || "—"}</span>
    ), { width: "120px" }],
    ["Group", "grpname", (v) => (
      <span className="text-[10px] font-medium text-slate-500 uppercase">{v || "—"}</span>
    ), { width: "120px" }],
    ["Description", "item_desc", (v) => <span className="text-[10px] text-slate-500 truncate block italic">{v || "—"}</span>, { width: "180px" }],
    ["Type", "type", (v) => (
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${typeBadgeClass(v)}`}>{v}</span>
    ), { width: "110px" }],
    ["Qty", "qty", (v) => <span className="font-black text-slate-700 text-[11px]">{v}</span>, { width: "80px", align: "center" }],
    ["Month", "month", (v) => (
      <span className="text-[10px] font-bold text-indigo-700 tabular-nums">
        {v ? String(v).slice(0, 10) : "—"}
      </span>
    ), { width: "110px" }],
    ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-500 truncate block">{v || "—"}</span>, { width: "160px" }],
    ["Status", "approved", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
        {v ? "● AUTHORIZED" : "○ PENDING"}
      </span>
    ), { width: "120px" }],
    ["Created By", "created_by_name", (v, row) => <span className="text-[10px] text-slate-500">{v || row?.created_by || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "updated_by_name", (v, row) => <span className="text-[10px] text-slate-500">{v || row?.updated_by || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Approved By", "approved_by_name", (v, row) => <span className="text-[10px] text-slate-500">{v || row?.approved_by || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];
}
