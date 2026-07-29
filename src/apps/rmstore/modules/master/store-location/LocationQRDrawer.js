"use client";

import { useRef } from "react";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";
import { Printer, Download, Hash, MapPin } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { buildLocationLabelDataUrlFromSvg, downloadLocationLabelDataUrl, getLocationQrValue, printLocationLabelDataUrls } from "@/apps/rmstore/lib/helpers/locationQrLabel";

export default function LocationQRDrawer({ isOpen, onClose, data }) {
  const qrRef = useRef();
  const canAccess = useCanAccess();
  const canPrint = canAccess("rm_store_location_master", "view").allowed;

  if (!data) return null;

  const qrValue = getLocationQrValue(data);

  const handleExport = async (type = "download") => {
    if (!canPrint) {
      toast.info("Printing and downloading require view permission for the Location master.");
      return;
    }
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) {
      toast.error("QR preview is not ready. Please try again.");
      return;
    }
    try {
      const dataUrl = await buildLocationLabelDataUrlFromSvg(svg, data);
      if (type === "download") {
        downloadLocationLabelDataUrl(data, dataUrl);
        toast.success("Label downloaded.");
      } else {
        const ok = printLocationLabelDataUrls([dataUrl]);
        if (!ok) {
          toast.error("Could not open the print window. Allow popups for this site.");
          return;
        }
        toast.success("Opening the print dialog…");
      }
    } catch (err) {
      toast.error(err?.message || "Could not export the QR label. Please try again.");
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Location Details" maxWidth="max-w-md ">
      <div className="flex flex-col p-2 space-y-6 bg-white h-full font-sans">

        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 shrink-0">
          {canPrint ? (
          <>
          <button
            type="button"
            onClick={() => void handleExport("print")}
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-95 transition-all"
          >
            <Printer size={18} /> Print Label
          </button>
          <button
            type="button"
            onClick={() => void handleExport("download")}
            title="Download label PNG"
            className="w-12 h-12 flex items-center justify-center border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 active:scale-95 transition-all shrink-0"
          >
            <Download size={20} />
          </button>
          </>
          ) : (
            <p className="text-[11px] font-semibold text-slate-500 px-1">View permission required to print or download labels.</p>
          )}
        </div>

        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 border border-slate-100 rounded-3xl shadow-inner">
          <div ref={qrRef} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <QRCode value={qrValue} size={200} level="H" />
          </div>
          <div className="mt-4 text-center">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              LOC-NO: {data.location_no || (data.rack_no ? `RM-${data.rack_no}${(data.row_no || "").toString().toUpperCase()}` : "__")}
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
              RM Rack: {data.rack_no || "__"} | RM Row: {(data.row_no || "__").toString().toUpperCase()}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
              Scan for full details
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <MapPin size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Location No.</span>
            </div>
            <p className="text-sm font-bold text-slate-800 uppercase">
              {data.location_no || (data.rack_no ? `RM-${data.rack_no}${(data.row_no || "").toString().toUpperCase()}` : "__")}
            </p>
          </div>
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Hash size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">RM Rack</span>
            </div>
            <p className="text-sm font-bold text-slate-800 uppercase">{data.rack_no || "__"}</p>
          </div>
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Hash size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">RM Row</span>
            </div>
            <p className="text-sm font-bold text-slate-800 uppercase">{(data.row_no || "__").toString().toUpperCase()}</p>
          </div>
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Hash size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Capacity</span>
            </div>
            <p className="text-sm font-bold text-slate-800">{data.total_capacity} Units</p>
          </div>
        </div>

        {data.location_description ? (
          <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Details</p>
            <p className="text-sm text-slate-700 whitespace-normal break-words leading-snug">{data.location_description}</p>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

