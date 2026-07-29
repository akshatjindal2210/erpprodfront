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
import { formatDateTime, formatDocDate } from "@/platform/utils/core/utilHelper";
import { bestTierForStrings } from "@/apps/ims/lib/helpers/liveSearchRank";
import { formatDateTimeLocalLabel } from "@/apps/task/lib/helpers/utilHelper";
import { Box } from "lucide-react";

/* ─── 1. Packing Entry (DailyProduction.js) ─── */

export function dailyProdRowKey(row) {
  return `${row.doc_no}-${row.itemdcode}`;
}

function renderDailyProdStickerStatus(_v, row) {
  const generated = isDailyProdStickerGenerated(row);
  return (
    <span
      className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
        generated ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
      }`}
    >
      {generated ? "● GENERATED" : "○ PENDING"}
    </span>
  );
}

function renderPendingQtyPerBox(v, row) {
  const n = parseFloat(v ?? row?.qty_per_box);
  if (!Number.isFinite(n) || n <= 0) {
    return <span className="text-[10px] text-slate-300 font-bold">—</span>;
  }
  return <span className="font-black text-blue-700 text-[11px] tabular-nums">{n.toLocaleString()}</span>;
}

function renderPendingTotalBoxes(v) {

  if (v == null || v === "") {
    return <span className="text-[10px] text-slate-300 font-bold">—</span>;
  }
  return (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-200">
    <Box size={10} />
    {Number(v) || 0}
  </span>)
}

function renderPendingFullBoxes(v, row) {
  if (v == null || v === "") {
    return <span className="text-[11px] text-slate-300 font-medium tracking-wider">—</span>;
  }

  const count = Number(v) || 0;
  const per = parseFloat(row?.qty_per_box || 0);
  const totalQty = count * per;

  return (
    <div className="flex flex-col justify-center leading-none py-0.5">
      {/* Box Count / Multiplier Display */}
      <span className={`font-bold text-[11px] tabular-nums ${count > 0 ? "text-blue-600" : "text-slate-400"}`}>
        {count > 0 && per > 0 ? `${count} × ${per.toLocaleString()}` : count}
      </span>
      
      {/* Total Qty Display */}
      {/* {count > 0 && per > 0 && (
        <span className="text-[9px] text-slate-500 font-semibold tabular-nums mt-0.5">
          Qty: {totalQty.toLocaleString()}
        </span>
      )} */}
    </div>
  );
}

function renderPendingLooseBoxes(v, row) {
  if (v == null || v === "") {
    return <span className="text-[11px] text-slate-300 font-medium tracking-wider">—</span>;
  }

  const count = Number(v) || 0;
  const looseQty = parseFloat(row?.loose_box_qty || 0);
  // Agar per item loose qty 1 box ki calculation ke liye hai, toh count * looseQty
  const totalLooseQty = count * looseQty; 

  return (
    <div className="flex flex-col justify-center leading-none py-0.5">
      {/* Loose Box Count / Multiplier Display */}
      <span className={`font-bold text-[11px] tabular-nums ${count > 0 ? "text-amber-600" : "text-slate-400"}`}>
        {count > 0 && looseQty > 0 ? `${count} × ${looseQty.toLocaleString()}` : count}
      </span>
      
      {/* Total Loose Qty Display */}
      {/* {count > 0 && looseQty > 0 && (
        <span className="text-[9px] text-slate-500 font-semibold tabular-nums mt-0.5">
          Qty: {totalLooseQty.toLocaleString()}
        </span>
      )} */}
    </div>
  );
}
/** Card view — sticker-style box breakdown (pending tab). */
function renderPendingBoxCardPlan(_v, row) {
  const per = parseFloat(row?.qty_per_box || 0);
  const total = row?.total_boxes;
  const full = row?.full_boxes_count;
  const loose = row?.loose_boxes_count;
  const looseQty = parseFloat(row?.loose_box_qty || 0);
  const hasPlan =
    (total != null && total !== "") ||
    (full != null && full !== "") ||
    (Number.isFinite(per) && per > 0);

  if (!hasPlan) {
    return <span className="text-[10px] text-slate-300 font-bold">—</span>;
  }

  const fullQty =
    Number.isFinite(per) && per > 0 && full != null && full !== ""
      ? Number(full) * per
      : null;
  const looseCount = Number(loose) || 0;

  return (
    <div className="w-full space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded border border-indigo-100 bg-indigo-50/60 px-1.5 py-1.5 text-center">
          <p className="text-[8px] font-bold text-slate-500 uppercase">Total Boxes</p>
          <p className="text-base font-black text-indigo-700 tabular-nums leading-none mt-0.5">{total ?? "—"}</p>
        </div>
        <div className="rounded border border-blue-100 bg-blue-50/60 px-1.5 py-1.5 text-center">
          <p className="text-[8px] font-bold text-slate-500 uppercase">Full Boxes</p>
          <p className="text-base font-black text-blue-600 tabular-nums leading-none mt-0.5">{full ?? "—"}</p>
          {/* {fullQty != null ? (
            <p className="text-[8px] text-slate-500 font-semibold mt-0.5 tabular-nums">Qty: {fullQty.toLocaleString()}</p>
          ) : null} */}
        </div>
        <div className="rounded border border-amber-100 bg-amber-50/60 px-1.5 py-1.5 text-center">
          <p className="text-[8px] font-bold text-slate-500 uppercase">Loose Box</p>
          <p
            className={`text-base font-black tabular-nums leading-none mt-0.5 ${looseCount > 0 ? "text-amber-600" : "text-slate-400"}`}
          >
            {looseCount}
          </p>
          {/* {looseCount > 0 && Number.isFinite(looseQty) && looseQty > 0 ? (
            <p className="text-[8px] text-slate-500 font-semibold mt-0.5 tabular-nums">Qty: {looseQty.toLocaleString()}</p>
          ) : null} */}
        </div>
      </div>
    </div>
  );
}

const renderDailyProdQtyCell = (v) => (
  <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px]">
    {parseFloat(v || 0).toLocaleString()}
  </span>
);

const PENDING_BOX_CARD_META = {
  cardRender: renderPendingBoxCardPlan,
  cardLabel: "Box Breakdown",
  cardDetailFullWidth: true,
};

const DAILY_PRODUCTION_BASE_HEADERS = [
  ["Packing No", "doc_no", (v) => <span className="font-mono font-bold text-slate-700 text-[10px] uppercase">{v}</span>, { width: "100px", fixed: true }],
  ["Date", "doc_dt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatDocDate(v) || "—"}</span>, { width: "100px" }],
  ["Job Card", "job_card_no", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>, { width: "120px" }],
  ["Quantity", "total_qty", renderDailyProdQtyCell, {
    width: "100px",
    cardRender: renderDailyProdQtyCell,
  }],
];

const DAILY_PRODUCTION_PENDING_BOX_HEADERS = [
  ["Total Boxes", "total_boxes", renderPendingTotalBoxes, { width: "82px", ...PENDING_BOX_CARD_META }],
  ["Full Boxes", "full_boxes_count", renderPendingFullBoxes, { width: "88px" }],
  ["Loose Box", "loose_boxes_count", renderPendingLooseBoxes, { width: "88px" }],
];

const DAILY_PRODUCTION_TAIL_HEADERS = [
  ["Customer", "acc_name", (v) => (
    <span className="text-slate-800 font-bold text-[10px] uppercase whitespace-normal break-words leading-snug hyphens-auto" title={v}>
      {v || "Unknown"}
    </span>
  ), { width: "250px", wrap: true }],
  ["Item Details", "item_code", (v) => (
    <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v}>{v}</span>
  )],
  // ["Item Description", "item_desc", (v) => (
  //   <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v}>{v}</span>
  // ), { width: "220px" }],
  ["Sticker Status", "sticker_generated", renderDailyProdStickerStatus, { width: "110px" }],
  ["Created By", "internal_create_user", (v) => <span className="text-[10px] text-slate-500 uppercase font-bold">{v || "—"}</span>, { width: "110px" }],
  ["Created At", "internal_create_date", (v) => <span className="text-[10px] text-slate-400 font-bold">{formatDateTimeLocalLabel(v) || "—"}</span>, { width: "150px" }],
  ["Generate By", "system_generate_user_name", (v) => <span className="text-[10px] text-slate-500 uppercase font-bold">{v || "—"}</span>, { width: "110px" }],
  ["Generate At", "system_generate_date", (v) => <span className="text-[10px] text-slate-400 font-bold">{formatDateTime(v) || "—"}</span>, { width: "150px" }],
];

/** All / Generated — same columns as original packing entry table. */
export const DAILY_PRODUCTION_HEADERS = [
  ...DAILY_PRODUCTION_BASE_HEADERS,
  ...DAILY_PRODUCTION_TAIL_HEADERS,
];

/** Pending tab — includes expected box split from packing standard (display only). */
export const DAILY_PRODUCTION_PENDING_HEADERS = [
  ...DAILY_PRODUCTION_BASE_HEADERS,
  ...DAILY_PRODUCTION_PENDING_BOX_HEADERS,
  ...DAILY_PRODUCTION_TAIL_HEADERS,
];

/** @deprecated Same as DAILY_PRODUCTION_HEADERS */
export const DAILY_PRODUCTION_GENERATED_HEADERS = DAILY_PRODUCTION_HEADERS;

export const STICKER_STATUS_FILTER_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Generated", value: "generated" },
  { label: "Comparison", value: "comparison" },
];

function formatComparePlain(v, { date = false, qty = false } = {}) {
  if (v == null || v === "") return "—";
  if (date) return formatDocDate(v) || "—";
  if (qty) return parseFloat(v || 0).toLocaleString();
  return String(v);
}

function CompareImsDbLines({ imsText, dbText, mismatch = false }) {
  const rowClass = mismatch
    ? "rounded border border-rose-200 bg-rose-50 px-1 py-0.5"
    : "";
  const labelClass = mismatch ? "text-rose-500" : "text-slate-400";
  const textClass = mismatch ? "font-bold text-rose-700" : "font-semibold text-slate-700";

  return (
    <div className="space-y-1 text-[10px] leading-snug min-w-[120px]">
      <div className={`flex flex-wrap gap-x-1 ${rowClass}`}>
        <span className={`shrink-0 font-black uppercase text-[8px] ${labelClass}`}>ERP</span>
        <span className={`${textClass} break-words`}>{imsText}</span>
      </div>
      <div className={`flex flex-wrap gap-x-1 ${rowClass}`}>
        <span className={`shrink-0 font-black uppercase text-[8px] ${labelClass}`}>DB</span>
        <span className={`${textClass} break-words`}>{dbText}</span>
      </div>
    </div>
  );
}

function renderDailyProdCompareCell(row, field, { date = false, qty = false } = {}) {
  if (row?.comparison?.missing_ims) {
    const dbVal = row?.local_source?.[field] ?? row?.[field];
    return (
      <CompareImsDbLines
        imsText="—"
        dbText={formatComparePlain(dbVal, { date, qty })}
        mismatch
      />
    );
  }
  if (row?.comparison?.missing_local) {
    return (
      <CompareImsDbLines
        imsText={formatComparePlain(row?.ims_source?.[field] ?? row?.[field], { date, qty })}
        dbText="—"
        mismatch
      />
    );
  }
  const cmp = row?.comparison?.fields?.[field];
  if (!cmp) {
    return (
      <span className="text-[10px] text-slate-400" title="No saved snapshot for this field">
        —
      </span>
    );
  }
  return (
    <CompareImsDbLines
      imsText={formatComparePlain(cmp.ims, { date, qty })}
      dbText={formatComparePlain(cmp.local, { date, qty })}
      mismatch={field === "acc_name" ? false : Boolean(cmp.mismatch)}
    />
  );
}

const COMPARE_FIELD_LABELS = {
  doc_dt: "Date",
  job_card_no: "Job card",
  acc_name: "Customer",
  item_code: "Item",
  total_qty: "Qty",
};

function renderDailyProdMismatchSummary(_v, row) {
  if (row?.comparison?.missing_ims || row?.ims_missing) {
    return <span className="text-[9px] font-bold uppercase text-rose-700">Not in ERP</span>;
  }
  if (row?.comparison?.missing_local) {
    return <span className="text-[9px] font-bold uppercase text-rose-700">No DB snapshot</span>;
  }
  const fields = row?.comparison?.fields || {};
  const keys = Object.keys(fields).filter((k) => k !== "acc_name" && fields[k]?.mismatch);
  if (!keys.length) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  return (
    <span className="text-[9px] font-bold uppercase text-rose-700 leading-snug">
      {keys.map((k) => COMPARE_FIELD_LABELS[k] || k).join(", ")}
    </span>
  );
}

function dailyProdImsCustomerName(row) {
  if (row?.comparison?.missing_ims || row?.ims_missing) return null;
  return (
    row?.ims_source?.acc_name ??
    row?.comparison?.fields?.acc_name?.ims ??
    null
  );
}

function renderDailyProdImsCustomer(_v, row) {
  const name = dailyProdImsCustomerName(row);
  return (
    <span
      className="text-slate-800 font-bold text-[10px] uppercase whitespace-normal break-words leading-snug hyphens-auto"
      title={name || undefined}
    >
      {name || "—"}
    </span>
  );
}

export const DAILY_PRODUCTION_COMPARISON_HEADERS = [
  ["Packing No", "doc_no", (v) => <span className="font-mono font-bold text-slate-700 text-[10px] uppercase">{v}</span>, { width: "100px", fixed: true }],
  ["Date", "doc_dt", (_v, row) => renderDailyProdCompareCell(row, "doc_dt", { date: true }), { width: "140px", wrap: true }],
  ["Job Card", "job_card_no", (_v, row) => renderDailyProdCompareCell(row, "job_card_no"), { width: "140px", wrap: true }],
  ["Customer", "acc_name", renderDailyProdImsCustomer, { width: "220px", wrap: true }],
  ["Item", "item_code", (_v, row) => renderDailyProdCompareCell(row, "item_code"), { width: "140px", wrap: true }],
  ["Quantity", "total_qty", (_v, row) => renderDailyProdCompareCell(row, "total_qty", { qty: true }), { width: "140px", wrap: true }],
  ["Mismatch", "has_comparison_mismatch", renderDailyProdMismatchSummary, { width: "120px", wrap: true }],
];

/** True when production stickers exist in local DB for this packing row. */
export function isDailyProdStickerGenerated(row) {
  return row?.sticker_generated === true || row?.sticker_generated === "true";
}

export function hasDailyProdComparisonMismatch(row, { ignoreCustomer = true } = {}) {
  if (row?.comparison?.missing_ims || row?.ims_missing) return true;
  const fields = row?.comparison?.fields || {};
  return Object.entries(fields).some(([key, f]) => {
    if (ignoreCustomer && key === "acc_name") return false;
    return Boolean(f?.mismatch);
  });
}

export const DAILY_PROD_PENDING_CARD_CONFIG = {
  titleKey: "job_card_no",
  tagsKeys: ["doc_no", "sticker_generated"],
  detailKeys: ["total_qty", "total_boxes", "acc_name", "item_code", "item_desc"],
  footerKey: "doc_dt",
};

export const DAILY_PROD_GENERATED_CARD_CONFIG = {
  titleKey: "job_card_no",
  tagsKeys: ["doc_no", "sticker_generated"],
  detailKeys: ["total_qty", "acc_name", "item_code", "item_desc"],
  footerKey: "doc_dt",
};

export const DAILY_PROD_COMPARISON_CARD_CONFIG = {
  titleKey: "doc_no",
  tagsKeys: ["has_comparison_mismatch"],
  detailKeys: ["doc_dt", "job_card_no", "acc_name", "item_code", "total_qty"],
};

export const DAILY_PROD_CARD_CONFIG = DAILY_PROD_GENERATED_CARD_CONFIG;

export function dailyProdPendingSearchParts(row) {
  return [
    row.doc_no,
    row.job_card_no,
    row.acc_name,
    row.item_code,
    row.item_desc,
    isDailyProdStickerGenerated(row) ? "generated" : "pending",
    row.internal_create_user,
    row.system_generate_user_name,
    row.total_boxes,
    row.full_boxes_count,
    row.loose_boxes_count,
    row.qty_per_box,
    row.loose_box_qty,
  ];
}

export function dailyProdGeneratedSearchParts(row) {
  return [
    ...dailyProdPendingSearchParts(row),
    row.packing_category,
    row.qty_per_box,
    row.full_boxes_count,
    row.loose_box_qty,
    row.party_rate_cust_code,
  ];
}

export function dailyProdSearchParts(row) {
  return isDailyProdStickerGenerated(row)
    ? dailyProdGeneratedSearchParts(row)
    : dailyProdPendingSearchParts(row);
}

/** Comparison tab: search IMS + DB snapshot values (customer name, job, item, qty, etc.). */
export function dailyProdComparisonSearchParts(row) {
  const parts = [
    row?.doc_no,
    row?.job_card_no,
    row?.acc_name,
    row?.acc_code,
    row?.item_code,
    row?.item_desc,
    row?.total_qty,
    formatDocDate(row?.doc_dt),
    row?.ims_source?.doc_no,
    row?.ims_source?.job_card_no,
    row?.ims_source?.acc_name,
    row?.ims_source?.acc_code,
    row?.ims_source?.item_code,
    row?.ims_source?.total_qty,
    formatDocDate(row?.ims_source?.doc_dt),
    row?.local_source?.job_card_no,
    row?.local_source?.acc_name,
    row?.local_source?.acc_code,
    row?.local_source?.item_code,
    row?.local_source?.total_qty,
    formatDocDate(row?.local_source?.doc_dt),
  ];

  const fields = row?.comparison?.fields;
  if (fields && typeof fields === "object") {
    for (const f of Object.values(fields)) {
      if (f?.ims != null && f.ims !== "") parts.push(f.ims);
      if (f?.local != null && f.local !== "") parts.push(f.local);
    }
  }

  if (row?.comparison?.missing_ims) parts.push("not in erp");
  if (row?.comparison?.missing_local) parts.push("no db snapshot");

  return parts.filter((p) => p != null && String(p).trim() !== "");
}

export function filterDailyProdByStickerStatus(rows, status) {
  if (status === "all") {
    return rows;
  }
  if (status === "generated") {
    return rows.filter((row) => isDailyProdStickerGenerated(row));
  }
  if (status === "comparison") {
    return rows.filter(
      (row) => isDailyProdStickerGenerated(row) && hasDailyProdComparisonMismatch(row)
    );
  }
  // Pending: IMS pack rows not yet sticker-generated in our DB
  return rows.filter((row) => !isDailyProdStickerGenerated(row));
}

/* ─── 2. Product Master (ProductMaster.js) ─── */

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
  return [row.item_code, row.primitem_code, row.itemdesc, row.grpname];
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
