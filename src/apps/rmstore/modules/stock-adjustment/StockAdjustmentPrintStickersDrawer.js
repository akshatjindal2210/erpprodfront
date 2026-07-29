"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Box, Layers, Loader2, Printer } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import { stockAdjustmentService } from "@/apps/rmstore/lib/services/stockAdjustment";
import { printFromBackendHtml } from "@/apps/ims/lib/utils/printHtmlDocument";
import { STICKER_DOWNLOAD_SOURCE_KEYS } from "@/platform/utils/global";

/**
 * Print SA Add coils using IMS FG sticker design (buildStickerCardHtml) —
 * same card as IMS Stock Adjustment / packing stickers.
 */
export default function StockAdjustmentPrintStickersDrawer({ open, onClose, editData }) {
  const [loading, setLoading] = useState(false);
  const [coils, setCoils] = useState([]);
  const [detail, setDetail] = useState(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [printed, setPrinted] = useState({});
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stickerMeta = detail
    ? {
        packing_number: `SA-${detail.adjustment_id}`,
        item_code: detail.item_code,
        item_desc: detail.item_desc,
        acc_name: detail.acc_name,
        heat_no: detail.heat_no,
        unit: detail.unit || "KG",
        doc_dt: detail.approved_at || detail.created_at || detail.doc_dt,
      }
    : {};

  useEffect(() => {
    if (!open || !editData?.adjustment_id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setCoils([]);
      setDetail(null);
      setPrinted({});
      try {
        const res = await stockAdjustmentService.getById(editData.adjustment_id);
        if (cancelled) return;
        const row = res?.data;
        if (!row) {
          toast.error("The stock adjustment was not found.");
          onCloseRef.current?.();
          return;
        }
        if (row.entry_type !== "add") {
          toast.info("Printing stickers is only available for approved Add (+) adjustments.");
          onCloseRef.current?.();
          return;
        }
        if (!row.approved) {
          toast.info("Approve the adjustment before printing stickers.");
          onCloseRef.current?.();
          return;
        }
        const list = Array.isArray(row.coils) ? row.coils : [];
        setDetail(row);
        setCoils(list);
        if (!list.length) toast.warning("No coils are linked to this adjustment.");
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.message || "Could not load the stickers. Please try again.");
          onCloseRef.current?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, editData?.adjustment_id]);

  const printOne = useCallback(
    async (coil) => {
      const uid = String(coil?.coil_no_uid || "").trim();
      if (!uid) return;
      try {
        const res = await stockAdjustmentService.renderSingleSticker({
          coil_no_uid: uid,
          download_source: STICKER_DOWNLOAD_SOURCE_KEYS.stock_adjustment,
          sticker_meta: stickerMeta,
        });
        const ok = printFromBackendHtml(res?.html, {
          title: res?.print_title || `SA ${uid}`,
        });
        if (!ok) {
          toast.error("The print window was blocked. Allow popups for this site.");
          return;
        }
        setPrinted((prev) => ({ ...prev, [uid]: true }));
        toast.success(`Printed ${uid}.`);
      } catch (err) {
        toast.error(err?.message || "Could not print the sticker. Please try again.");
      }
    },
    [stickerMeta]
  );

  const printAll = useCallback(async () => {
    const uids = coils.map((c) => c.coil_no_uid).filter(Boolean);
    if (!uids.length) {
      toast.info("No coils to print.");
      return;
    }
    setPrintingAll(true);
    try {
      const res = await stockAdjustmentService.renderBulkStickers({
        coil_no_uids: uids,
        download_source: STICKER_DOWNLOAD_SOURCE_KEYS.stock_adjustment,
        sticker_meta: stickerMeta,
      });
      const ok = printFromBackendHtml(res?.html, {
        title: res?.print_title || `SA #${detail?.adjustment_id}`,
      });
      if (!ok) {
        toast.error("The print window was blocked. Allow popups for this site.");
        return;
      }
      const next = {};
      uids.forEach((u) => {
        next[u] = true;
      });
      setPrinted((prev) => ({ ...prev, ...next }));
      toast.success(`Printed ${uids.length} sticker(s).`);
    } catch (err) {
      toast.error(err?.message || "Could not print the stickers. Please try again.");
    } finally {
      setPrintingAll(false);
    }
  }, [coils, detail?.adjustment_id, stickerMeta]);

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Print Stickers"
      description={
        detail
          ? `ADJ #${detail.adjustment_id} · ${detail.item_code || "—"} · ${coils.length} coil(s)`
          : "Stock adjustment stickers"
      }
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500">
            Close
          </button>
          <button
            type="button"
            onClick={printAll}
            disabled={loading || printingAll || !coils.length}
            className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {printingAll ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Printing
              </>
            ) : (
              <>
                <Printer size={18} /> Print All
              </>
            )}
          </button>
        </div>
      }
      maxWidth="max-w-4xl"
    >
      <div className="space-y-3 pb-4">
        {loading ? (
          <FormPanelLoader label="Loading coils…" hint="Preparing the stickers for printing." />
        ) : (
          <div className="bg-white border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Box size={16} className="text-slate-600" />
              <span className="text-[11px] font-black uppercase text-slate-800">
                Stickers ({coils.length})
              </span>
              <span className="ml-auto text-[9px] font-bold uppercase text-slate-400">
                Standard sticker layout
              </span>
            </div>
            {!coils.length ? (
              <div className="py-10 text-center text-[10px] font-bold uppercase text-slate-400 flex flex-col items-center gap-2">
                <Layers size={20} className="opacity-20" />
                No coils were found for this adjustment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">#</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Coil</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">
                        Packing
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Qty</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">
                        Status
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {coils.map((c, idx) => {
                      const uid = String(c.coil_no_uid || "");
                      const isPrinted = !!printed[uid];
                      return (
                        <tr key={uid || idx} className="border-b border-slate-100 hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-[11px] font-bold text-slate-600 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-[11px] font-mono font-bold text-blue-700 break-all">
                            {uid}
                          </td>
                          <td className="px-3 py-2 text-[11px] font-bold text-slate-700 tabular-nums">
                            SA-{detail?.adjustment_id}
                          </td>
                          <td className="px-3 py-2 text-[11px] font-bold tabular-nums">
                            {Number(c.qty || 0).toLocaleString()} {detail?.unit || "KG"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                isPrinted ? "text-emerald-600" : "text-blue-600"
                              }`}
                            >
                              {isPrinted ? "Downloaded" : "Generated"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => printOne(c)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] font-black uppercase ${
                                isPrinted
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                  : "border-blue-400 bg-blue-50 text-blue-700"
                              }`}
                            >
                              <Printer size={14} />
                              {isPrinted ? "Re-Print" : "Print"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
