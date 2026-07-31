"use client";

/** Where is this coil right now? */
export function getCoilStockZone(row) {
  const status = String(row?.status || "active").toLowerCase();
  if (status === "rejected") return "rejected";
  if (status === "out") return "out";
  if (status === "consumed") return "consumed";
  if (row?.location_id != null && String(row.location_id).trim() !== "") return "stored";
  return "coil_area";
}

function rejectionKind(row) {
  if (String(row?.status || "").toLowerCase() !== "rejected") return null;
  if (row?.ipr_uid != null) return "ipr";
  if (row?.qc_check_uid != null) return "qc";
  return "register";
}

const REJECTION_STYLE = {
  ipr: {
    row: "bg-violet-50/50 group-hover:bg-violet-50/60 [&_td]:!bg-violet-50/50",
    badge: "bg-violet-700 text-white border border-violet-800",
    label: (row) => `IPR-${row.ipr_uid}`,
  },
  qc: {
    row: "bg-sky-50/50 group-hover:bg-sky-50/60 [&_td]:!bg-sky-50/50",
    badge: "bg-sky-700 text-white border border-sky-800",
    label: (row) => `QC-${row.qc_check_uid}`,
  },
  register: {
    row: "bg-rose-50/50 group-hover:bg-rose-50/60 [&_td]:!bg-rose-50/50",
    badge: "bg-rose-700 text-white border border-rose-800",
    label: (row) => (row?.qc_reject_uid != null ? `REJECT-${row.qc_reject_uid}` : "Rejected"),
  },
};

const LOCATION_BADGE = {
  coil_area: "bg-green-800 text-white border border-green-900",
  stored: "bg-emerald-100 text-emerald-900 border border-emerald-300",
  out: "bg-blue-700 text-white border border-blue-900",
  consumed: "bg-amber-600 text-white border border-amber-700",
};

const BADGE = "inline-block px-1 py-0 text-[9px] font-black uppercase leading-tight rounded-sm";

export function renderCoilCompactCell(v, className = "", title) {
  const label = v != null && String(v).trim() !== "" ? String(v) : "—";
  return (
    <span className={`text-[10px] uppercase ${className}`} title={title || label}>
      {label}
    </span>
  );
}

export function renderCoilMrnCell(_v, row) {
  const uid = row?.mrn_uid != null && String(row.mrn_uid).trim() !== "" ? String(row.mrn_uid) : null;
  const no = row?.mrn_no != null ? String(row.mrn_no) : null;
  const label = uid || no || "—";
  return renderCoilCompactCell(label, "font-semibold text-slate-700 tabular-nums", uid && no ? `${uid} · ${no}` : label);
}

export function resolveCoilLocationLabel(row) {
  const zone = getCoilStockZone(row);
  if (zone === "coil_area") return "Unassigned";
  if (zone === "rejected") {
    const kind = rejectionKind(row);
    return kind ? REJECTION_STYLE[kind].label(row) : "Rejected";
  }
  if (zone === "out") {
    return row?.out_uid != null ? `Shop Floor · OUT-${row.out_uid}` : "Shop Floor";
  }
  if (zone === "consumed") return row?.ipr_uid != null ? `IPR-${row.ipr_uid}` : "Used";
  return String(row?.location_no || "").trim() || "Stored";
}

export function getCoilRowClassName(row) {
  const zone = getCoilStockZone(row);
  if (zone === "rejected") {
    const kind = rejectionKind(row);
    return kind ? REJECTION_STYLE[kind].row : REJECTION_STYLE.register.row;
  }
  if (zone === "stored") return "bg-emerald-50/40 group-hover:bg-emerald-50/50 [&_td]:!bg-emerald-50/40";
  if (zone === "out") return "bg-slate-50 group-hover:bg-slate-100 [&_td]:!bg-slate-50";
  if (zone === "consumed") return "bg-amber-50/50 group-hover:bg-amber-50/60 [&_td]:!bg-amber-50/50";
  return "bg-green-50 group-hover:bg-green-50 [&_td]:!bg-green-50";
}

export function renderCoilLocationCell(_v, row) {
  const zone = getCoilStockZone(row);
  const label = resolveCoilLocationLabel(row);
  let tone = LOCATION_BADGE[zone] || LOCATION_BADGE.stored;
  if (zone === "rejected") {
    const kind = rejectionKind(row);
    tone = kind ? REJECTION_STYLE[kind].badge : REJECTION_STYLE.register.badge;
  }
  return <span className={`${BADGE} ${tone}`}>{label}</span>;
}

export function renderCoilQtyCell(v, row) {
  const n = Number(v);
  const display = Number.isFinite(n) ? Math.round(n).toLocaleString() : "0";
  const qtyClass = getCoilStockZone(row) === "stored" ? "text-emerald-800" : "text-green-900";
  return <span className={`font-black text-[10px] tabular-nums ${qtyClass}`}>{display}</span>;
}

export function renderCoilCustomerCell(v) {
  const label = v != null && String(v).trim() !== "" ? String(v) : "—";
  return (
    <span className="text-[9px] font-bold uppercase whitespace-normal break-words leading-snug text-slate-800" title={label}>
      {label}
    </span>
  );
}

/** Footer color key — IMS box page style. */
export function CoilTableColorLegend() {
  return (
    <span className="text-[9px] text-slate-500">
      <span className="text-green-800 font-bold">Green row</span> unassigned ·{" "}
      <span className="text-emerald-700 font-bold">Emerald row</span> stored ·{" "}
      <span className="text-violet-700 font-bold">Violet row</span> IPR hold ·{" "}
      <span className="text-sky-700 font-bold">Sky row</span> QC fail ·{" "}
      <span className="text-rose-700 font-bold">Rose row</span> rejected ·{" "}
      <span className="text-blue-700 font-bold">Blue row</span> shop floor (issued) ·{" "}
      <span className="text-amber-700 font-bold">Amber row</span> consumed ·{" "}
      Location: <span className="text-green-900 font-bold">unassigned</span> /{" "}
      <span className="text-emerald-700 font-bold">stored</span> /{" "}
      <span className="text-violet-700 font-bold">IPR</span> /{" "}
      <span className="text-sky-700 font-bold">QC</span> /{" "}
      <span className="text-rose-700 font-bold">REJECT</span> /{" "}
      <span className="text-blue-800 font-bold">OUT</span>
    </span>
  );
}
