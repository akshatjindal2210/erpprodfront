"use client";

import { isIssuedToShopFloor, isSaMinusWriteOff } from "@/apps/rmstore/lib/utils/saMinusInventory";

/** Where is this coil right now? */
export function getCoilStockZone(row) {
  const status = String(row?.status || "active").toLowerCase();
  if (status === "returned") return "returned";
  if (status === "rejected") return "rejected";
  if (isSaMinusWriteOff(row) || status === "consumed") return "consumed";
  if (isIssuedToShopFloor(row)) return "out";
  if (isQcFailedCoil(row)) return "rejected";
  if (row?.location_id != null && String(row.location_id).trim() !== "") return "stored";
  return "coil_area";
}

/** Approved QC fail — Rejection Pending or RM Rejection register (not QC Hold). */
function isQcFailedCoil(row) {
  const qc = String(row?.qc_check_status || "").trim().toLowerCase();
  if (qc === "failed") return true;
  const status = String(row?.status || "").toLowerCase();
  return status === "rejected" && row?.qc_uid != null && row?.rm_uid == null;
}

function rejectionKind(row) {
  const status = String(row?.status || "").toLowerCase();
  if (status === "returned") return "returned";
  const rejectionId = row?.rm_uid;
  if (rejectionId != null && String(rejectionId).trim() !== "") {
    if (row?.qc_uid != null) return "rm_rejection";
    return "register";
  }
  if (status === "rejected" && row?.ipr_uid != null) return "ipr";
  if (isQcFailedCoil(row)) return "rm_rejection";
  if (status === "rejected") return "register";
  return null;
}

const REJECTION_STYLE = {
  ipr: {
    row: "bg-violet-50/50 group-hover:bg-violet-50/60 [&_td]:!bg-violet-50/50",
    badge: "bg-violet-700 text-white border border-violet-800",
    label: "IPR Hold",
    detail: (row) => (row?.ipr_uid != null ? `IPR-${row.ipr_uid}` : "IPR Hold"),
  },
  rm_rejection: {
    row: "bg-rose-50/50 group-hover:bg-rose-50/60 [&_td]:!bg-rose-50/50",
    badge: "bg-rose-700 text-white border border-rose-800",
    label: "RM Rejection",
    detail: (row) => {
      if (row?.rm_uid != null) return `REJECT-${row.rm_uid}`;
      if (row?.qc_uid != null) return `QC-${row.qc_uid} · Failed`;
      return "RM Rejection";
    },
  },
  register: {
    row: "bg-rose-50/50 group-hover:bg-rose-50/60 [&_td]:!bg-rose-50/50",
    badge: "bg-rose-700 text-white border border-rose-800",
    label: "Rejected",
    detail: (row) => {
      const id = row?.rm_uid;
      return id != null ? `REJECT-${id}` : "Rejected";
    },
  },
  returned: {
    row: "bg-orange-50/50 group-hover:bg-orange-50/60 [&_td]:!bg-orange-50/50",
    badge: "bg-orange-700 text-white border border-orange-800",
    label: "Returned",
    detail: (row) => {
      const id = row?.rm_uid;
      return id != null ? `REJECT-${id} · Returned` : "Returned";
    },
  },
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

/** Area label — fixed zone names (UIDs live in Adj ID / IPR ID / QC ID columns). */
export function resolveCoilLocationLabel(row) {
  const zone = getCoilStockZone(row);
  if (zone === "coil_area") return "Unassigned";
  if (zone === "rejected" || zone === "returned") {
    const kind = rejectionKind(row);
    return kind ? REJECTION_STYLE[kind].label : zone === "returned" ? "Returned" : "Rejected";
  }
  if (zone === "out") return "Shop Floor";
  if (zone === "consumed") return "Consumed";
  return String(row?.location_no || "").trim() || "Stored";
}

export function resolveCoilLocationDetail(row) {
  const zone = getCoilStockZone(row);
  if (zone === "rejected" || zone === "returned") {
    const kind = rejectionKind(row);
    return kind ? REJECTION_STYLE[kind].detail(row) : zone === "returned" ? "Returned" : "Rejected";
  }
  if (zone === "consumed" && row?.sa_id != null) return `SA-${row.sa_id} · Adjustment`;
  if (zone === "consumed" && row?.ipr_uid != null) return `IPR-${row.ipr_uid} · Consumed`;
  if (zone === "out" && row?.out_uid != null) return `OUT-${row.out_uid} · Shop Floor`;
  return resolveCoilLocationLabel(row);
}

const COIL_ZONE_SEARCH_LABELS = {
  coil_area: ["unassigned", "coil area"],
  stored: ["stored", "in store"],
  out: ["dispatch", "shop floor", "outward", "out"],
  consumed: ["consumed", "used", "adjustment", "minus"],
  rejected: ["rejected", "hold", "ipr hold", "rm rejection", "qc fail"],
  returned: ["returned", "returned out"],
};

/** Quick search parts — zone names + all visible coil fields. */
export function getCoilClientSearchParts(row) {
  const zone = getCoilStockZone(row);
  const locationLabel = resolveCoilLocationLabel(row);
  const locationDetail = resolveCoilLocationDetail(row);

  return [
    row?.coil_no_uid,
    row?.coil_uid,
    row?.mrn_uid,
    row?.mrn_no,
    row?.serial_no,
    row?.heat_no,
    row?.item_code,
    row?.item_desc,
    row?.acc_name,
    row?.acc_code,
    row?.location_no,
    row?.rack_no,
    row?.row_no,
    row?.in_uid,
    row?.out_uid,
    row?.pjobcardno,
    row?.macname,
    row?.ipr_uid != null ? `IPR-${row.ipr_uid}` : null,
    row?.ipr_uid,
    row?.qc_uid != null ? `QC-${row.qc_uid}` : null,
    row?.qc_uid,
    row?.rm_uid != null ? `REJECT-${row.rm_uid}` : null,
    row?.rm_uid,
    row?.rejection_approved,
    row?.rejection_reason,
    row?.qc_check_status,
    row?.sa_id != null ? `SA-${row.sa_id}` : null,
    row?.sa_id,
    row?.sa_entry_type,
    row?.status,
    row?.qty,
    locationLabel,
    locationDetail,
    zone,
    ...(COIL_ZONE_SEARCH_LABELS[zone] ?? []),
  ];
}

export function getCoilRowClassName(row) {
  const zone = getCoilStockZone(row);
  if (zone === "rejected" || zone === "returned") {
    const kind = rejectionKind(row);
    return kind ? REJECTION_STYLE[kind].row : zone === "returned" ? REJECTION_STYLE.returned.row : REJECTION_STYLE.register.row;
  }
  if (zone === "stored") return "bg-emerald-50/40 group-hover:bg-emerald-50/50 [&_td]:!bg-emerald-50/40";
  if (zone === "out") {
    return "bg-blue-50 group-hover:bg-blue-50 [&_td]:!bg-blue-50 group-hover:[&_td]:!bg-blue-50/95";
  }
  if (zone === "consumed") return "bg-amber-50/50 group-hover:bg-amber-50/60 [&_td]:!bg-amber-50/50";
  return "bg-green-50 group-hover:bg-green-50 [&_td]:!bg-green-50";
}

export function resolveCoilQcStatusLabel(row) {
  const qcId = row?.qc_uid;
  if (qcId == null) return null;
  const raw = String(row?.qc_check_status || "").trim().toLowerCase();
  if (raw === "passed") return "Passed";
  if (raw === "failed") return "Failed";
  if (raw === "awaiting_approval") return "Awaiting";
  if (row?.rm_uid != null) return "Failed";
  if (String(row?.status || "").toLowerCase() === "rejected" && row?.qc_uid != null) return "Failed";
  return "Pending";
}

export function resolveCoilQcIdStatusLabel(row) {
  if (row?.qc_uid == null) return "—";
  const status = resolveCoilQcStatusLabel(row) || "Pending";
  if (row?.rm_uid != null) {
    return `QC ${row.qc_uid} · ${status} · RM ${row.rm_uid}`;
  }
  return `QC ${row.qc_uid} · ${status}`;
}

export function renderCoilQcStatusCell(_v, row) {
  if (row?.qc_uid == null) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  const id = String(row.qc_uid);
  const label = resolveCoilQcStatusLabel(row) || "Pending";
  let cls = "bg-amber-100 text-amber-800 border-amber-200";
  if (label === "Passed") cls = "bg-emerald-100 text-emerald-800 border-emerald-200";
  else if (label === "Failed") cls = "bg-rose-100 text-rose-800 border-rose-200";
  else if (label === "Awaiting") cls = "bg-sky-100 text-sky-800 border-sky-200";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[9px] font-bold uppercase leading-tight whitespace-nowrap ${cls}`}
      title={resolveCoilQcIdStatusLabel(row)}
    >
      <span className="font-mono tabular-nums">{id}</span>
      <span className="opacity-60 font-black">·</span>
      <span>{label}</span>
    </span>
  );
}

/** QC column — id + status in one badge, e.g. `1 · Pending`. */
export function renderCoilQcIdStatusCell(_v, row) {
  return renderCoilQcStatusCell(_v, row);
}

export function renderCoilLocationCell(_v, row) {
  const zone = getCoilStockZone(row);
  const label = resolveCoilLocationLabel(row);
  const title = resolveCoilLocationDetail(row);

  if (zone === "rejected" || zone === "returned") {
    const kind = rejectionKind(row);
    const tone = kind ? REJECTION_STYLE[kind].badge : zone === "returned" ? REJECTION_STYLE.returned.badge : REJECTION_STYLE.register.badge;
    return (
      <span className={`${BADGE} ${tone}`} title={title}>
        {label}
      </span>
    );
  }

  const cellClass =
    label === "Shop Floor"
      ? "bg-blue-700 text-white border border-blue-900 px-1.5 py-0.5 rounded-sm font-black"
      : label === "Consumed"
        ? "bg-amber-600 text-white border border-amber-700 px-1.5 py-0.5 rounded-sm font-black"
        : label === "Unassigned"
          ? "bg-green-800 text-white border border-green-900 px-1.5 py-0.5 rounded-sm font-black"
          : zone === "stored"
            ? "bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded-sm"
            : "bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded-sm";

  return (
    <span className={`text-[10px] font-bold uppercase ${cellClass}`} title={title}>
      {label}
    </span>
  );
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

function renderCoilRefIdCell(v, { tone = "neutral", title } = {}) {
  const id = v != null && String(v).trim() !== "" ? String(v) : null;
  if (!id) return <span className="text-[10px] text-slate-400">—</span>;
  const tones = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-100 text-emerald-900 border-emerald-300",
    blue: "bg-blue-100 text-blue-900 border-blue-300",
    orange: "bg-orange-100 text-orange-900 border-orange-300",
    sky: "bg-sky-100 text-sky-900 border-sky-300",
    indigo: "bg-indigo-100 text-indigo-900 border-indigo-300",
    violet: "bg-violet-100 text-violet-900 border-violet-300",
    amber: "bg-amber-100 text-amber-900 border-amber-300",
  };
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded-sm border text-[9px] font-bold font-mono tabular-nums ${tones[tone] || tones.neutral}`}
      title={title || id}
    >
      {id}
    </span>
  );
}

/** RM Rejection register ID (coil.rm_uid → rmstore_rejection). */
export function renderCoilRejectionIdCell(v, row) {
  const id = v ?? row?.rm_uid;
  const approved = row?.rejection_approved === true;
  const reason = row?.rejection_reason ? String(row.rejection_reason).trim() : "";
  const title = id != null
    ? [
        `RM Rejection ${id}`,
        row?.qc_uid != null ? `From QC ${row.qc_uid}` : null,
        approved ? "Store Out approved" : "Pending Store Out",
        reason || null,
      ].filter(Boolean).join(" · ")
    : undefined;
  return renderCoilRefIdCell(id, {
    tone: id != null ? "rose" : "neutral",
    title,
  });
}

/** QC check reference */
export function renderCoilQcIdCell(v, row) {
  const kind = rejectionKind(row);
  return renderCoilRefIdCell(v, {
    tone: kind === "rm_rejection" ? "rose" : "neutral",
    title: v != null ? `QC ${v}` : undefined,
  });
}

/** Store inward UID */
export function renderCoilInwardUidCell(v, row) {
  const stored = getCoilStockZone(row) === "stored";
  return renderCoilRefIdCell(v, {
    tone: stored ? "emerald" : "neutral",
    title: v != null ? `Inward ${v}` : undefined,
  });
}

/** Stock adjustment reference */
export function renderCoilSaIdCell(v, row) {
  const id = v != null && String(v).trim() !== "" ? String(v) : null;
  return renderCoilRefIdCell(id, {
    tone: id ? "indigo" : "neutral",
    title: id
      ? row?.sa_entry_type
        ? `Adjustment ${id} · ${row.sa_entry_type}`
        : `Adjustment ${id}`
      : undefined,
  });
}

/** In-process request UID */
export function renderCoilIprIdCell(v, row) {
  const id = v != null && String(v).trim() !== "" ? String(v) : null;
  if (!id) return renderCoilRefIdCell(null);
  const zone = getCoilStockZone(row);
  const tone =
    zone === "consumed" ? "amber" : zone === "rejected" && rejectionKind(row) === "ipr" ? "violet" : "violet";
  return renderCoilRefIdCell(id, { tone, title: `IPR ${id}` });
}

/** @deprecated Use renderCoilIprIdCell */
export const renderCoilIssueIdCell = renderCoilIprIdCell;

/** Store out UID */
export function renderCoilOutUidCell(v, row) {
  const zone = getCoilStockZone(row);
  const dispatched = zone === "out" || zone === "returned";
  if (!dispatched) return renderCoilRefIdCell(v, { tone: "neutral" });
  return renderCoilRefIdCell(v, {
    tone: zone === "returned" ? "orange" : "blue",
    title: v != null ? `Outward ${v}` : undefined,
  });
}

function LegendChip({ dotClass, label }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded border border-slate-200/90 bg-white/90 text-[8px] font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}

/** Footer color key — compact chips for table row / area status. */
export function CoilTableColorLegend() {
  const items = [
    { dot: "bg-green-600", label: "Unassigned" },
    { dot: "bg-emerald-600", label: "Stored" },
    { dot: "bg-violet-600", label: "IPR Hold" },
    { dot: "bg-rose-600", label: "RM Rejection" },
    { dot: "bg-rose-800", label: "Rejected" },
    { dot: "bg-blue-600", label: "Shop Floor" },
    { dot: "bg-orange-500", label: "Returned" },
    { dot: "bg-amber-500", label: "Consumed" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 max-w-full">
      {items.map((item) => (
        <LegendChip key={item.label} dotClass={item.dot} label={item.label} />
      ))}
    </div>
  );
}
