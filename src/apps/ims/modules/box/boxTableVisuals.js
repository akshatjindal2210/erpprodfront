"use client";

import { isBoxOnQcHold, isBoxOutwardDispatch, isBoxInHand } from "@/apps/ims/lib/utils/boxInventory";

export function getBoxStockZone(row) {
  if (row?.stock_zone) return row.stock_zone;
  if (isBoxOnQcHold(row)) return "qc_hold";
  if (isBoxOutwardDispatch(row)) return "dispatched";
  if (isBoxInHand(row)) return row?.location_id ? "in_store" : "packing_area";
  return "other";
}

function hasBoxLocationId(row) {
  return row?.location_id != null && String(row.location_id).trim() !== "";
}

function boxLocationCode(row) {
  const code =
    row?.location_no ||
    `${row?.rack_no || ""}${(row?.shelf_no || "").toString().toUpperCase()}`.trim() ||
    "";
  return code && code !== "—" ? code : "";
}

/** Location column text: store code, Packing Area, QC Area, or Dispatch. */
export function resolveBoxLocationLabel(row) {
  const zone = getBoxStockZone(row);
  const loc = boxLocationCode(row);
  const hasLocId = hasBoxLocationId(row);

  if (zone === "dispatched") {
    return "Dispatch";
  }
  if (zone === "qc_hold" && !hasLocId && !loc) {
  // if (zone === "qc_hold") {
    return "QC Area";
  }
  if (zone === "packing_area" || (zone === "in_store" && !hasLocId && !loc)) {
    return "Packing Area";
  }
  if (loc) return loc;
  return "—";
}

const BOX_ZONE_SEARCH_LABELS = {
  packing_area: ["packing area", "packing_area", "packing"],
  in_store: ["in store", "in_store", "store", "inward"],
  qc_hold: ["qc hold", "qc_hold", "qc area", "qc", "hold", "yellow"],
  dispatched: ["dispatched", "dispatch", "outward", "out", "blue"],
  removed: ["removed", "stock out", "stock_out"],
  other: [],
};

/** Labels + fields for box table quick search (incl. zone names like "packing area"). */
export function getBoxClientSearchParts(row) {
  const zone = getBoxStockZone(row);
  const locationLabel = resolveBoxLocationLabel(row);

  return [
    row?.box_uid,
    row?.box_no_uid,
    row?.packing_number,
    row?.acc_name,
    row?.acc_code,
    row?.location_no,
    row?.rack_no,
    row?.shelf_no,
    locationLabel,
    row?.in_uid,
    row?.out_uid,
    row?.item_code,
    row?.itemdesc,
    row?.item_desc,
    row?.forward_note_customer_name,
    row?.qty,
    row?.qc_hold_id,
    zone,
    ...(BOX_ZONE_SEARCH_LABELS[zone] ?? []),
  ];
}

/** Row tint: QC hold = yellow, dispatched = blue. */
export function getBoxRowClassName(row) {
  const zone = getBoxStockZone(row);
  if (zone === "qc_hold") {
    return "bg-amber-50 group-hover:bg-amber-50 [&_td]:!bg-amber-50 group-hover:[&_td]:!bg-amber-50/95";
  }
  if (zone === "dispatched") {
    return "bg-blue-50 group-hover:bg-blue-50 [&_td]:!bg-blue-50 group-hover:[&_td]:!bg-blue-50/95";
  }
  if (zone === "in_store") {
    return "bg-emerald-50/40 group-hover:bg-emerald-50/50 [&_td]:!bg-emerald-50/40";
  }
  if (zone === "packing_area") {
    return "bg-green-50 group-hover:bg-green-50 [&_td]:!bg-green-50";
  }
  return "";
}

export function renderBoxQcHoldIdCell(v) {
  const id = v != null && String(v).trim() !== "" ? String(v) : null;
  if (!id) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-sm border bg-amber-200 text-amber-950 border-amber-400 text-[10px] font-bold font-mono tabular-nums">
      {id}
    </span>
  );
}

export function renderBoxLocationCell(v, row) {
  const zone = getBoxStockZone(row);
  const label = resolveBoxLocationLabel(row);
  const cellClass =
    label === "Dispatch"
      ? "bg-blue-700 text-white border border-blue-900 px-1.5 py-0.5 rounded-sm font-black"
      : label === "QC Area"
        ? "bg-amber-500 text-amber-950 border border-amber-700 px-1.5 py-0.5 rounded-sm font-black"
        : label === "Packing Area"
          ? "bg-green-800 text-white border border-green-900 px-1.5 py-0.5 rounded-sm font-black"
          : zone === "in_store"
            ? "bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded-sm"
            : zone === "qc_hold"
              ? "text-amber-800"
              : zone === "dispatched"
                ? "text-blue-700"
                : "text-slate-600";

  return (
    <span className={`text-[10px] font-bold uppercase ${cellClass}`}>
      {label}
    </span>
  );
}

export function renderBoxCustomerCell(value, { overridden = false } = {}) {
  const label = value != null && String(value).trim() !== "" && String(value).trim() !== "—" ? String(value) : "—";
  return (
    <span
      className={`text-[10px] font-bold uppercase whitespace-normal break-words leading-snug ${
        overridden ? "text-violet-800" : "text-slate-800"
      }`}
      title={overridden ? `${label} (override)` : label}
    >
      {label}
      {overridden ? (
        <span className="ml-1 text-[8px] font-black text-violet-600 normal-case">(override)</span>
      ) : null}
    </span>
  );
}

export function renderBoxForwardNoteCustomerCell(v, row) {
  const zone = getBoxStockZone(row);
  if (zone !== "dispatched") {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  return renderBoxCustomerCell(v);
}

/** @deprecated use renderBoxForwardNoteCustomerCell */
export function renderBoxForwardingCustomerCell(v, row) {
  return renderBoxForwardNoteCustomerCell(v, row);
}

/** @deprecated dispatch override column removed from box table */
export function renderBoxDispatchCustomerCell() {
  return <span className="text-[10px] text-slate-400">—</span>;
}
