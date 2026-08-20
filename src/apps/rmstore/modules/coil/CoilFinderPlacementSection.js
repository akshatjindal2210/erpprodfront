"use client";

import { MapPin } from "lucide-react";
import { getLocationDisplayNo } from "@/apps/rmstore/lib/helpers/locationQrLabel";
import {
  getCoilStockZone,
  resolveCoilLocationDetail,
  resolveCoilLocationLabel,
} from "@/apps/rmstore/modules/coil/coilTableVisuals";

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
  const location = physicalLocation(locationData, coil);
  if (!coil) {
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
  if (info.zone === "rejected") return "No rack — send this coil from Store Out.";
  if (info.zone === "returned") return "No rack — this coil was returned.";
  if (info.zone === "out") return "No rack — this coil is on the shop floor.";
  if (info.zone === "consumed") {
    return info.zoneDetail?.includes("Adjustment")
      ? "No rack — this coil was removed by stock adjustment."
      : "No rack — this coil has been consumed.";
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

/** Next card under "This coil" — one parent card for area + rack. */
export default function CoilFinderPlacementSection({ coil, locationData }) {
  if (!coil && !locationData) return null;
  const info = getCoilWhereInfo(coil, locationData);
  const tone = coil ? coilFinderHeaderTone(coil) : coilFinderHeaderTone({ status: "active", location_id: 1 });
  const locNo = info.location ? getLocationDisplayNo(info.location) : null;
  const showLoc = Boolean(info.location && locNo && locNo !== "—");

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
