"use client";

import { useRef } from "react";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";
import { Download, Hash, Layers, Package, Printer, ShieldCheck } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { buildTrayLabelDataUrlFromSvg, downloadTrayLabelDataUrl, getTrayQrValue, printTrayLabelDataUrls } from "@/apps/ims/lib/helpers/trayQrLabel";
import { isTrayApproved } from "@/apps/ims/lib/helpers/trayHelper";

export default function TrayQRDrawer({ isOpen, onClose, data, stackLevel = 0 }) {
  const canAccess = useCanAccess();
  const canPrint = canAccess("tray_master", "view").allowed;
  const qrRef = useRef(null);

  if (!data) return null;

  const isApproved = isTrayApproved(data);
  const qrValue = getTrayQrValue(data);

  const handleExport = async (mode) => {
    if (!isApproved) {
      toast.info("Authorize this tray before printing or downloading QR.");
      return;
    }
    if (!canPrint) {
      toast.info("Print/download requires Tray Master view permission.");
      return;
    }
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) {
      toast.error("QR preview is not ready. Please try again.");
      return;
    }
    try {
      const dataUrl = await buildTrayLabelDataUrlFromSvg(svg, data);
      if (mode === "print") {
        const ok = printTrayLabelDataUrls([dataUrl]);
        if (!ok) {
          toast.error("Could not open print window. Allow pop-ups for this site.");
          return;
        }
        toast.success("Opening print dialog...");
        return;
      }
      downloadTrayLabelDataUrl(data, dataUrl);
      toast.success("Label downloaded.");
    } catch (err) {
      toast.error(err?.message || "Failed to export tray label.");
    }
  };

  const detailCards = [
    { icon: Hash, label: "Tray Code", value: data.code || "—" },
    { icon: Package, label: "Type", value: data.type || "—" },
    { icon: Hash, label: "S.No.", value: data.serial_number ?? "—" },
    { icon: Layers, label: "Batch", value: data.batch_id || "—" },
  ];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Tray QR" maxWidth="max-w-md" stackLevel={stackLevel}>
      <div className="flex flex-col p-2 space-y-6 bg-white h-full font-sans">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => void handleExport("print")}
            disabled={!canPrint || !isApproved}
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-95 transition-all disabled:opacity-50"
          >
            <Printer size={18} />
            Print Label
          </button>
          <button
            type="button"
            onClick={() => void handleExport("download")}
            disabled={!canPrint || !isApproved}
            title="Download label PNG"
            className="w-12 h-12 flex items-center justify-center border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 active:scale-95 transition-all shrink-0 disabled:opacity-50"
          >
            <Download size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 border border-slate-100 rounded-3xl shadow-inner">
          {isApproved ? (
            <>
              <div ref={qrRef} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <QRCode value={qrValue} size={200} level="H" />
              </div>
              <div className="mt-4 text-center">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{data.code || "—"}</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Type: {data.type || "—"} | Batch: {data.batch_id || "—"}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Scan for tray code</p>
              </div>
            </>
          ) : (
            <p className="px-6 text-center text-sm font-semibold text-amber-700">
              This tray is pending. Approve it first to print or download QR.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {detailCards.map(({ icon: Icon, label, value }) => (
            <div key={label} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Icon size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-sm font-bold text-slate-800 uppercase break-all">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isApproved ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
            }`}
          >
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Status</p>
            <p className={`text-sm font-black uppercase ${isApproved ? "text-emerald-700" : "text-amber-700"}`}>
              {isApproved ? "Authorized" : "Pending"}
            </p>
            {data.approved_by_name ? (
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">By {data.approved_by_name}</p>
            ) : null}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
