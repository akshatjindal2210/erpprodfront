"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";
import { Printer, Download, Cpu, Hash, Loader2 } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import { machineMasterService } from "@/apps/engineering/lib/services/machineMaster";
import { buildMachineLabelDataUrlFromSvg, downloadMachineLabelDataUrl, getMachineDisplayNo, getMachineQrValue, printMachineLabelDataUrls } from "@/apps/engineering/lib/helpers/machineQrLabel";

export default function MachineQRDrawer({ isOpen, onClose, machineId }) {
  const qrRef = useRef();
  const canAccess = useCanAccess();
  const canPrint = canAccess(ENG_MODULES.MACHINE_MASTER, "view").allowed;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!isOpen || !machineId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    machineMasterService
      .getQr(machineId)
      .then((res) => {
        if (cancelled) return;
        const row = res?.data ?? res;
        if (!row?.qr_value && !row?.number) {
          toast.error("Could not load machine QR.");
          return;
        }
        setData(row);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err?.message || "Failed to load machine QR");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, machineId]);

  if (!isOpen) return null;

  const qrValue = data ? getMachineQrValue(data) : "";
  const displayNo = data ? getMachineDisplayNo(data) : "—";

  const handleExport = async (type = "download") => {
    if (!canPrint) {
      toast.info("Print/download requires Machine Master view permission.");
      return;
    }
    const svg = qrRef.current?.querySelector("svg");
    if (!svg || !data) {
      toast.error("QR preview is not ready. Please try again.");
      return;
    }
    try {
      const dataUrl = await buildMachineLabelDataUrlFromSvg(svg, data);
      if (type === "download") {
        downloadMachineLabelDataUrl(data, dataUrl);
        toast.success("Label downloaded.");
      } else {
        const ok = printMachineLabelDataUrls([dataUrl]);
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
    <Drawer isOpen={isOpen} onClose={onClose} title="Machine QR" maxWidth="max-w-md ">
      <div className="flex flex-col p-2 space-y-6 bg-white h-full font-sans">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 shrink-0">
          {canPrint ? (
            <>
              <button
                type="button"
                onClick={() => void handleExport("print")}
                disabled={loading || !qrValue}
                className="flex-1 h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-95 transition-all disabled:opacity-50"
              >
                <Printer size={18} /> Print Label
              </button>
              <button
                type="button"
                onClick={() => void handleExport("download")}
                disabled={loading || !qrValue}
                title="Download label PNG"
                className="w-12 h-12 flex items-center justify-center border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 active:scale-95 transition-all shrink-0 disabled:opacity-50"
              >
                <Download size={20} />
              </button>
            </>
          ) : (
            <p className="text-[11px] font-semibold text-slate-500 px-1">
              View permission required to print or download labels.
            </p>
          )}
        </div>

        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 border border-slate-100 rounded-3xl shadow-inner min-h-[280px]">
          {loading ? (
            <Loader2 className="animate-spin text-slate-400" size={28} />
          ) : qrValue ? (
            <>
              <div ref={qrRef} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <QRCode value={qrValue} size={200} level="H" />
              </div>
              <div className="mt-4 text-center">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  M/C-NO: {displayNo}
                </h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                  {data?.name || "—"}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
                  Scan for full details
                </p>
              </div>
            </>
          ) : (
            <p className="text-[11px] font-semibold text-slate-500">No QR available.</p>
          )}
        </div>

        {data && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Hash size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Number</span>
              </div>
              <p className="text-sm font-bold text-slate-800 uppercase">{displayNo}</p>
            </div>
            <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Cpu size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Name</span>
              </div>
              <p className="text-sm font-bold text-slate-800 uppercase truncate" title={data.name}>
                {data.name || "—"}
              </p>
            </div>
            <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm col-span-2">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Hash size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Process</span>
              </div>
              <p className="text-sm font-bold text-slate-800 uppercase">{data.process_name || "—"}</p>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
