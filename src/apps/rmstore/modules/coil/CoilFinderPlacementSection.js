"use client";

import { MapPin } from "lucide-react";
import { getLocationDisplayNo } from "@/apps/rmstore/lib/helpers/locationQrLabel";
import { isSaMinusWriteOff } from "@/apps/rmstore/lib/utils/saMinusInventory";
import { getCoilStockZone, resolveCoilJobCardLabel, resolveCoilLocationDetail, resolveCoilLocationLabel, resolveCoilMachineLabel } from "@/apps/rmstore/modules/coil/coilTableVisuals";

function ImsDetail({ label, value, mono, uppercase }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-bold uppercase text-blue-500">{label}</dt>
      <dd
        className={`text-[11px] font-semibold text-blue-900 break-words ${mono ? "font-mono" : ""} ${uppercase ? "uppercase" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

/** Consumed coils (IPR consume or SA minus). */
export function CoilFinderConsumedDetails({ coil }) {
  if (!coil || getCoilStockZone(coil) !== "consumed") return null;

  const iprUid = coil.ipr_uid != null && String(coil.ipr_uid).trim() !== "" ? String(coil.ipr_uid).trim() : null;
  const saId = coil.sa_id != null && String(coil.sa_id).trim() !== "" ? String(coil.sa_id).trim() : null;
  const saMinus = isSaMinusWriteOff(coil) || (saId != null && !iprUid);
  const entryType = saMinus ? "STOCK ADJUSTMENT MINUS" : iprUid ? "IN-PROCESS CONSUME" : "CONSUMED";
  const footnote = saMinus
    ? "No rack shown — this coil was removed by stock adjustment."
    : "No rack shown — this coil has been consumed.";

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
      <p className="text-xs font-semibold text-blue-900">Consumed Details</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {iprUid ? <ImsDetail label="IPR UID" value={`IPR-${iprUid}`} mono /> : null}
        {saId ? <ImsDetail label="Adjustment" value={`SA-${saId}`} mono /> : null}
        {iprUid ? <ImsDetail label="Job Card" value={resolveCoilJobCardLabel(coil)} mono uppercase /> : null}
        {iprUid ? <ImsDetail label="Machine" value={resolveCoilMachineLabel(coil)} mono uppercase /> : null}
        <ImsDetail label="Entry Type" value={entryType} uppercase />
      </dl>
      <p className="text-[11px] text-blue-800 mt-2 leading-snug">{footnote}</p>
    </div>
  );
}

function physicalLocation(locationData, coil) {
  const src = locationData || coil;
  if (!src) return null;
  const location_no = String(src.location_no || "").trim();
  const rack_no = src.rack_no;
  const row_no = src.row_no;
  if (!location_no && rack_no == null && row_no == null) return null;
  return { location_no: location_no || null, rack_no, row_no };
}

export function getCoilWhereInfo(coil, locationData) {
  if (!coil) {
    const location = physicalLocation(locationData, coil);
    return {
      zone: "stored",
      title: "Coil is here",
      intro: "Current location",
      zoneLabel: null,
      zoneDetail: null,
      location,
    };
  }
  const zone = getCoilStockZone(coil);
  const zoneLabel = resolveCoilLocationLabel(coil);
  const detail = resolveCoilLocationDetail(coil);
  const inArea = zone !== "stored";
  const location = zone === "stored" ? physicalLocation(locationData, coil) : null;
  return {
    zone,
    title: location && !inArea ? "Coil is here" : "Coil is in this area",
    intro: location && !inArea ? "Current location" : "Current area",
    zoneLabel: inArea ? zoneLabel : null,
    zoneDetail: inArea && detail && detail !== zoneLabel ? detail : null,
    location,
  };
}

function emptyLocationHint(info) {
  if (info.zone === "rejected") return "No rack shown — send this coil from Store Out.";
  if (info.zone === "returned") return "No rack shown — this coil was returned.";
  if (info.zone === "out") return "Store location is not shown. Full record is below.";
  if (info.zone === "consumed") {
    return info.zoneDetail?.includes("Adjustment")
      ? "No rack shown — this coil was removed by stock adjustment."
      : "No rack shown — this coil has been consumed.";
  }
  return "No rack yet. Use Store In to store it.";
}

function Field({ label, value, tone, mono }) {
  return (
    <div>
      <p className={`text-[10px] font-medium mb-0.5 ${tone.kicker}`}>{label}</p>
      <p className={`text-xs font-semibold leading-snug break-all ${mono ? "font-mono" : ""} ${tone.title}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function CoilWhereBody({ info, tone }) {
  const locNo = info.location ? getLocationDisplayNo(info.location) : null;
  const showLoc = Boolean(info.location && locNo && locNo !== "—");

  return (
    <>
      {info.zoneLabel || info.zoneDetail ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {info.zoneLabel ? <Field label="Area / Zone" value={info.zoneLabel} tone={tone} /> : null}
          {info.zoneDetail ? <Field label="Reference" value={info.zoneDetail} tone={tone} mono /> : null}
        </div>
      ) : null}
      {showLoc ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Field label="Location No." value={locNo} tone={tone} mono />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rack" value={info.location.rack_no} tone={tone} mono />
            <Field label="Row" value={info.location.row_no} tone={tone} mono />
          </div>
        </div>
      ) : (
        <p className={`text-[11px] leading-snug ${tone.meta || "text-slate-600"}`}>{emptyLocationHint(info)}</p>
      )}
    </>
  );
}

/** Coil location / area — own card below “This coil” and extra FG cards. */
export default function CoilFinderPlacementSection({ coil, locationData }) {
  if (!coil && !locationData) return null;
  const tone = coil ? coilFinderHeaderTone(coil) : coilFinderHeaderTone({ status: "active", location_id: 1 });
  const info = getCoilWhereInfo(coil, locationData);

  return (
    <div className={`p-3 rounded-xl border ${tone.shell}`}>
      <div className="flex items-start gap-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${tone.icon}`}>
          <MapPin size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-medium leading-none ${tone.kicker}`}>{info.intro}</p>
          <p className={`text-sm font-bold leading-tight mt-1 ${tone.title}`}>{info.title}</p>
          <div className={`mt-2 pt-2 border-t ${tone.divider} space-y-2`}>
            <CoilWhereBody info={info} tone={tone} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function coilFinderHeaderTone(coil) {
  const zone = getCoilStockZone(coil);
  if (zone === "returned") {
    return {
      shell: "bg-orange-50 border-orange-200",
      icon: "bg-orange-600 text-white",
      kicker: "text-orange-700",
      title: "text-orange-900",
      meta: "text-slate-600",
      divider: "border-orange-100/90",
    };
  }
  if (zone === "rejected") {
    return {
      shell: "bg-rose-50 border-rose-200",
      icon: "bg-rose-700 text-white",
      kicker: "text-rose-700",
      title: "text-rose-900",
      meta: "text-slate-600",
      divider: "border-rose-100/90",
    };
  }
  if (zone === "stored") {
    return {
      shell: "bg-emerald-50 border-emerald-100",
      icon: "bg-emerald-600 text-white",
      kicker: "text-emerald-700",
      title: "text-emerald-900",
      meta: "text-emerald-700/80",
      divider: "border-emerald-100/90",
    };
  }
  return {
    shell: "bg-indigo-50 border-indigo-100",
    icon: "bg-indigo-600 text-white",
    kicker: "text-indigo-600",
    title: "text-indigo-950",
    meta: "text-indigo-900/90",
    divider: "border-indigo-100/90",
  };
}
