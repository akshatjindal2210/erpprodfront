"use client";

/** Coil stock zone — IMS packing_area ↔ coil_area, in_store ↔ stored. */
export function getCoilStockZone(row) {
  const status = String(row?.status || "active").toLowerCase();
  if (status === "rejected") return "rejected";
  if (status === "out") return "out";
  if (status === "consumed") return "consumed";
  if (row?.location_id != null && String(row.location_id).trim() !== "") return "stored";
  return "coil_area";
}

export function resolveCoilLocationLabel(row) {
  const zone = getCoilStockZone(row);
  if (zone === "coil_area") return "Unassigned";
  if (zone === "rejected") return "QC Rejected";
  if (zone === "out") return "Store Out";
  if (zone === "consumed") return "Consumed";
  const code = String(row?.location_no || "").trim();
  return code || "Stored";
}

export function getCoilClientSearchParts(row) {
  const zone = getCoilStockZone(row);
  const locationLabel = resolveCoilLocationLabel(row);
  return [
    row?.coil_uid,
    row?.coil_no_uid,
    row?.mrn_no,
    row?.heat_no,
    row?.item_code,
    row?.item_desc,
    row?.acc_name,
    row?.acc_code,
    row?.location_no,
    row?.in_uid,
    row?.qty,
    row?.serial_no,
    locationLabel,
    zone,
    zone === "coil_area" ? ["unassigned", "coil area", "area"] : zone === "stored" ? ["stored", "store", "in store"] : zone === "rejected" ? ["rejected", "qc"] : zone === "consumed" ? ["consumed", "consume"] : ["out", "store out"],
  ].flat();
}

/** Row tint: coil area = green, stored = emerald, rejected = rose, out = slate, consumed = amber. */
export function getCoilRowClassName(row) {
  const zone = getCoilStockZone(row);
  if (zone === "stored") {
    return "bg-emerald-50/40 group-hover:bg-emerald-50/50 [&_td]:!bg-emerald-50/40";
  }
  if (zone === "rejected") {
    return "bg-rose-50/50 group-hover:bg-rose-50/60 [&_td]:!bg-rose-50/50";
  }
  if (zone === "out") {
    return "bg-slate-50 group-hover:bg-slate-100 [&_td]:!bg-slate-50";
  }
  if (zone === "consumed") {
    return "bg-amber-50/50 group-hover:bg-amber-50/60 [&_td]:!bg-amber-50/50";
  }
  return "bg-green-50 group-hover:bg-green-50 [&_td]:!bg-green-50";
}

export function renderCoilLocationCell(_v, row) {
  const zone = getCoilStockZone(row);
  const label = resolveCoilLocationLabel(row);
  const cellClass =
    zone === "coil_area"
      ? "bg-green-800 text-white border border-green-900 px-1.5 py-0.5 rounded-sm font-black"
      : zone === "rejected"
        ? "bg-rose-700 text-white border border-rose-800 px-1.5 py-0.5 rounded-sm font-black"
        : zone === "out"
          ? "bg-slate-600 text-white border border-slate-700 px-1.5 py-0.5 rounded-sm font-black"
          : zone === "consumed"
            ? "bg-amber-600 text-white border border-amber-700 px-1.5 py-0.5 rounded-sm font-black"
            : "bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded-sm";

  return (
    <span className={`text-[10px] font-bold uppercase ${cellClass}`}>
      {label}
    </span>
  );
}

export function renderCoilQtyCell(v, row) {
  const zone = getCoilStockZone(row);
  const n = Number(v);
  const display = Number.isFinite(n) ? Math.round(n).toLocaleString() : "0";
  const qtyClass =
    zone === "stored" ? "text-emerald-800" : "text-green-900";
  return <span className={`font-black text-[11px] tabular-nums ${qtyClass}`}>{display}</span>;
}

export function renderCoilCustomerCell(v) {
  const label = v != null && String(v).trim() !== "" ? String(v) : "—";
  return (
    <span
      className="text-[10px] font-bold uppercase whitespace-normal break-words leading-snug text-slate-800"
      title={label}
    >
      {label}
    </span>
  );
}
