"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Box, Layers, Loader2, Printer } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { stockAdjustmentService } from "@/apps/rmstore/lib/services/stockAdjustment";
import { canPrintSaStickers, stockAdjustmentTypeLabel } from "@/apps/rmstore/lib/utils/stockAdjustmentEntryTypes";
import { printFromBackendHtml } from "@/apps/ims/lib/utils/printHtmlDocument";
import { STICKER_DOWNLOAD_SOURCE_KEYS } from "@/platform/utils/global";
import RmStockAdjustmentDetailCards, {
  buildRmSaDetailCardProps,
  buildRmSaStickerMeta,
} from "./RmStockAdjustmentDetailCards";

/** Coil sticker table — same layout as IMS StickerPrintBreakdownTable. */
export function CoilPrintBreakdownTable({ rows, dlTracking, mrnNo, mrnUid, adjId, unit = "KG", onPrintOne, canPrint = true }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0">
      <div className="px-2 py-1.5 lg:px-4 lg:py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-1.5 min-w-0 shrink-0">
        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0 flex-1">
          <Box className="w-4 h-4 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-600" aria-hidden />
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight text-slate-800 truncate">
            Stickers
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-0 lg:p-1 touch-pan-y">
        {!rows.length ? (
          <div className="bg-white border border-slate-200 px-3 py-8 text-center">
            <div className="flex flex-col items-center gap-1.5 text-slate-400">
              <Layers size={20} className="opacity-20" />
              <span className="text-[10px] font-bold uppercase tracking-wide px-1">
                No coils found for this adjustment.
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 overflow-hidden w-full max-w-full min-w-0">
            <p className="sm:hidden px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
              Swipe sideways →
            </p>
            <div className="overflow-x-auto overscroll-x-contain touch-pan-x max-w-full [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[560px] sm:min-w-[640px] lg:min-w-[820px] text-left border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-600 border-r border-slate-200 whitespace-nowrap"
                    >
                      #
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Coil
                    </th>
                    {/* <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      MRN No.
                    </th> */}
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      MRN UID
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="sticky right-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 text-right whitespace-nowrap border-l border-slate-200"
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const uid = String(row.coil_no_uid || "");
                    const isPrinted = !!dlTracking[uid];
                    const coilIndex = row.coil_index ?? idx + 1;
                    const totalCoils = row.total_coils ?? rows.length;

                    return (
                      <tr key={uid || idx} className="group border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 min-w-0 max-w-[110px] sm:max-w-[180px] lg:max-w-[240px]">
                          <div className="flex flex-col leading-snug min-w-0">
                            <span className="text-blue-700 font-bold text-[10px] break-all">{uid || "—"}</span>
                            <span className="text-[8px] lg:text-[10px] text-slate-400 uppercase font-bold truncate">
                              Coil {coilIndex} / {totalCoils}
                            </span>
                          </div>
                        </td>
                        {/* <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 whitespace-nowrap tabular-nums">
                          {row.mrn_no ?? mrnNo ?? "—"}
                        </td> */}
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 min-w-0 max-w-[140px] lg:max-w-[180px]">
                          <span className="font-mono break-all">{row.mrn_uid ?? mrnUid ?? "—"}</span>
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-800 whitespace-nowrap tabular-nums">
                          {Number(row.qty || 0).toLocaleString()} {unit}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                          <span
                            className={`text-[9px] lg:text-[12px] font-bold uppercase whitespace-nowrap ${
                              isPrinted ? "text-emerald-600" : "text-blue-600"
                            }`}
                          >
                            {isPrinted ? "Downloaded" : "Generated"}
                          </span>
                        </td>
                        <td className="sticky right-0 z-10 py-1 px-2 lg:py-2 lg:px-2 text-right bg-white group-hover:bg-slate-50 border-l border-slate-100 whitespace-nowrap w-px align-middle">
                          {canPrint ? (
                            <button
                              type="button"
                              onClick={() => onPrintOne(row)}
                              aria-label={isPrinted ? "Re-print sticker" : "Print sticker"}
                              title={isPrinted ? "Re-print" : "Print"}
                              className={`touch-manipulation inline-flex items-center justify-center gap-0 border lg:gap-1.5 lg:px-2.5 lg:py-1.5 p-1 min-h-[28px] min-w-[28px] sm:min-h-[32px] sm:min-w-[32px] lg:min-h-0 lg:min-w-0 ${
                                isPrinted
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                  : "border-blue-400 bg-blue-50 text-blue-700"
                              }`}
                            >
                              <Printer className="w-4 h-4 shrink-0 lg:hidden" strokeWidth={2.25} aria-hidden />
                              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-black uppercase whitespace-nowrap">
                                <Printer className="w-4 h-4 shrink-0" strokeWidth={2.25} aria-hidden />
                                {isPrinted ? "Re-Print" : "Print"}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[9px] lg:text-[12px] text-slate-300 font-bold px-0.5">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StockAdjustmentPrintStickersDrawer({ open, onClose, editData }) {
  const canAccess = useCanAccess();
  const canPrintStickers = useMemo(
    () => canAccess("rm_stock_adjustment", "view").allowed,
    [canAccess]
  );

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [coils, setCoils] = useState([]);
  const [dlTracking, setDlTracking] = useState({});
  const [printingAll, setPrintingAll] = useState(false);
  const [mobileTab, setMobileTab] = useState("details");
  const sopAckRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const detailCardProps = useMemo(() => buildRmSaDetailCardProps(detail, coils), [detail, coils]);

  const stickerMeta = useMemo(() => buildRmSaStickerMeta(detail), [detail]);

  useEffect(() => {
    if (!open || !editData?.adjustment_id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setDlTracking({});
      setMobileTab("details");
      setDetail(null);
      setCoils([]);
      try {
        const res = await stockAdjustmentService.getById(editData.adjustment_id);
        if (cancelled) return;
        const row = res?.data;
        if (!row) {
          toast.error("The stock adjustment was not found.");
          onCloseRef.current?.();
          return;
        }
        if (!canPrintSaStickers(row)) {
          toast.info("Print stickers is only for approved Add (+) or Old adjustments.");
          onCloseRef.current?.();
          return;
        }
        const fetchedCoils = Array.isArray(row.coils) ? row.coils : [];
        const seedCoils = Array.isArray(editData?.coils) ? editData.coils : [];
        const list = fetchedCoils.length ? fetchedCoils : seedCoils;
        setDetail(row);
        setCoils(list);
        if (!list.length) toast.warning("No coils are linked to this adjustment.");
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.message || "Failed to load stickers");
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

  const handlePrintOne = useCallback(
    async (coil) => {
      if (!canPrintStickers) {
        toast.info("Sticker download requires Stock Adjustment view permission.");
        return;
      }
      const uid = String(coil?.coil_no_uid || "").trim();
      if (!uid) return;
      if (!sopAckRef.current?.assertAcknowledged()) return;

      try {
        const res = await stockAdjustmentService.renderSingleSticker({
          coil_no_uid: uid,
          download_source: STICKER_DOWNLOAD_SOURCE_KEYS.stock_adjustment,
          sticker_meta: buildRmSaStickerMeta(detail, coil),
        });
        if (!String(res?.html || "").trim()) {
          toast.error("Sticker HTML was empty — could not print.");
          return;
        }
        const ok = printFromBackendHtml(res.html, { title: res?.print_title || `SA ${uid}` });
        if (!ok) {
          toast.warning("Allow pop-ups to print stickers.");
          return;
        }
        setDlTracking((prev) => ({ ...prev, [uid]: true }));
      } catch (err) {
        toast.error(err?.message || "Could not print sticker.");
      }
    },
    [canPrintStickers, detail]
  );

  const handlePrintAll = useCallback(async () => {
    if (!canPrintStickers) {
      toast.info("Sticker download requires Stock Adjustment view permission.");
      return;
    }
    if (!detail || !coils.length) return;
    if (printingAll) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;

    const uids = coils.map((c) => c.coil_no_uid).filter(Boolean);
    if (!uids.length) {
      toast.warning("No printable coils found.");
      return;
    }

    setPrintingAll(true);
    try {
      const res = await stockAdjustmentService.renderBulkStickers({
        coil_no_uids: uids,
        download_source: STICKER_DOWNLOAD_SOURCE_KEYS.stock_adjustment,
        sticker_meta: stickerMeta,
      });
      if (!String(res?.html || "").trim()) {
        toast.error("Sticker HTML was empty — could not print.");
        return;
      }
      const ok = printFromBackendHtml(res.html, {
        title: res?.print_title || `SA #${detail.adjustment_id}`,
      });
      if (!ok) {
        toast.warning("Allow pop-ups to print stickers.");
        return;
      }
      const next = {};
      uids.forEach((u) => {
        next[String(u)] = true;
      });
      setDlTracking((prev) => ({ ...prev, ...next }));
    } catch (err) {
      toast.error(err?.message || "Bulk print failed");
    } finally {
      setPrintingAll(false);
    }
  }, [canPrintStickers, detail, coils, printingAll, stickerMeta]);

  const printAllHotkeyRef = useRef(handlePrintAll);
  printAllHotkeyRef.current = handlePrintAll;

  const printedCount = Object.keys(dlTracking).length;

  const breakdownBlock = (
    <CoilPrintBreakdownTable
      rows={coils}
      dlTracking={dlTracking}
      mrnNo={detail?.mrn_no}
      mrnUid={detail?.mrn_uid}
      adjId={detail?.adjustment_id}
      unit={detail?.unit || "KG"}
      onPrintOne={handlePrintOne}
      canPrint={canPrintStickers}
    />
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Print stickers"
      description="Print one sticker or all — same flow as packing sticker creation after generate."
      maxWidth="max-w-full xl:max-w-7xl"
      noPadding
      bodyScrollable={false}
    >
      <div className="flex h-full min-h-0 flex-col w-full max-w-full min-w-0 overflow-hidden bg-slate-50">
        {loading ? (
          <FormPanelLoader
            className="flex-1 border-0 rounded-none min-h-0"
            minHeight="min-h-0 flex-1"
            label="Loading stickers..."
            hint="Fetching adjustment coils and MRN details."
          />
        ) : (
          <>
            <div className="bg-white border-b px-2 md:px-4 py-1.5 sm:py-2 md:py-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 shadow-sm z-10 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">Adjustment</p>
                <p className="text-[11px] sm:text-sm font-black text-slate-800 truncate">
                  ADJ #{detail?.adjustment_id}
                  {detail?.entry_type ? ` · ${stockAdjustmentTypeLabel(detail)}` : ""}
                  {detail?.financial_year ? ` · FY ${detail.financial_year}` : ""}
                  {detail?.mrn_uid ? ` · ${detail.mrn_uid}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                {canPrintStickers && coils.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handlePrintAll()}
                    disabled={printingAll}
                    title="Print all stickers"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-md sm:shadow-lg whitespace-nowrap disabled:bg-emerald-300 touch-manipulation min-h-[34px] sm:min-h-0"
                  >
                    {printingAll ? (
                      <Loader2 size={14} className="animate-spin shrink-0" />
                    ) : (
                      <Printer size={14} className="shrink-0" />
                    )}
                    <span className="lg:hidden">{printingAll ? "…" : "ALL"}</span>
                    <span className="hidden lg:inline">{printingAll ? "PREPARING…" : "PRINT ALL"}</span>
                    {!printingAll && (
                      <span className="text-[9px] sm:text-[10px] opacity-90 tabular-nums">
                        ({printedCount}/{coils.length})
                      </span>
                    )}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden lg:hidden bg-slate-100/80 min-h-[min(52dvh,420px)]">
                <div
                  role="tablist"
                  aria-label="Details and stickers"
                  className="grid grid-cols-2 gap-1.5 shrink-0 px-2 pt-1.5 pb-1.5 border-b border-slate-200 bg-white"
                >
                  {[
                    { id: "details", label: "Details" },
                    { id: "coils", label: "Stickers" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={mobileTab === tab.id}
                      onClick={() => setMobileTab(tab.id)}
                      className={`rounded-lg py-2 px-2 text-center text-[10px] font-black uppercase tracking-tight transition-all touch-manipulation active:opacity-90 min-h-[2.25rem] flex items-center justify-center ${
                        mobileTab === tab.id
                          ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                          : "bg-slate-200/70 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col mx-2 mb-2 mt-1.5 bg-white border border-slate-200 rounded-lg">
                  {mobileTab === "details" ? (
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-50 p-2">
                      <RmStockAdjustmentDetailCards {...detailCardProps} />
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">{breakdownBlock}</div>
                  )}
                </div>
              </div>

              <div className="hidden lg:flex lg:flex-row flex-1 min-h-0 w-full min-w-0 overflow-hidden bg-slate-50">
                <div className="shrink-0 lg:w-80 xl:w-96 border-r border-slate-200 bg-slate-50 overflow-y-auto overflow-x-hidden">
                  <RmStockAdjustmentDetailCards {...detailCardProps} />
                </div>
                <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">{breakdownBlock}</div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2">
              <ModuleSopAcknowledgment
                ref={sopAckRef}
                key={`${open}-print-stickers-rm`}
                moduleSlug="rm_stock_adjustment"
                permissionType="view"
                isOpen={open}
              />
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
