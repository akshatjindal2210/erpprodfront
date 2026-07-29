"use client";

import { useRef } from "react";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";
import { Printer, Download, Package, User, Hash, MapPin } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { buildLocationLabelDataUrlFromSvg, downloadLocationLabelDataUrl, getLocationQrValue, printLocationLabelDataUrls } from "@/apps/ims/lib/helpers/locationQrLabel";

export default function LocationQRDrawer({ isOpen, onClose, data }) {
  const qrRef = useRef();
  const canAccess = useCanAccess();
  const canPrint = canAccess("location_master", "view").allowed;

  if (!data) return null;

  const qrValue = getLocationQrValue(data);

  const handleExport = async (type = "download") => {
    if (!canPrint) {
      toast.info("Print/download requires Location Master view permission.");
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
          toast.error("Could not open print window. Allow pop-ups for this site.");
          return;
        }
        toast.success("Opening print dialog…");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to export QR label.");
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
              LOC-NO: {data.location_no || `${data.rack_no || ""}${(data.shelf_no || "").toString().toUpperCase()}` || "__"}
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
              Rack No: {data.rack_no || "__"} | Shelf No: {(data.shelf_no || "__").toString().toUpperCase()}
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
              <span className="text-[10px] font-bold uppercase tracking-wider">Loc No</span>
            </div>
            <p className="text-sm font-bold text-slate-800 uppercase">
              {data.location_no || `${data.rack_no || ""}${(data.shelf_no || "").toString().toUpperCase()}` || "__"}
            </p>
          </div>
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Hash size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Rack No</span>
            </div>
            <p className="text-sm font-bold text-slate-800 uppercase">{data.rack_no || "__"}</p>
          </div>
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Hash size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Shelf No</span>
            </div>
            <p className="text-sm font-bold text-slate-800 uppercase">{(data.shelf_no || "__").toString().toUpperCase()}</p>
          </div>
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Hash size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Capacity</span>
            </div>
            <p className="text-sm font-bold text-slate-800">{data.total_capacity} Units</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <Package size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Linked Item</p>
              <p className="text-sm font-bold text-slate-800 truncate">{data.item_code || "__"}</p>
              {data.item_desc && <p className="text-[11px] text-slate-500 truncate mt-0.5">{data.item_desc}</p>}
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Customer Name</p>
              <p className="text-sm font-bold text-slate-800 whitespace-normal break-words leading-snug" title={data.acc_name}>
                {data.acc_name || "__"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

