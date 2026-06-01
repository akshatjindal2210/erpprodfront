"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Box, Layers, Loader2, Printer } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/core/components/ui/Drawer";
import FormPanelLoader from "@/core/components/common/FormPanelLoader";
import ModuleSopAcknowledgment from "@/core/components/common/ModuleSopAcknowledgment";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import StockAdjustmentStickerDetailCards from "./StockAdjustmentStickerDetailCards";
import { hydrateStockAdjustmentStickerView } from "./hydrateStockAdjustmentStickerView";
import { buildStockAdjustmentStickerPrintMeta, printSingleStockAdjustmentSticker, printStockAdjustmentAddStickers } from "./stockAdjustmentStickerPrint";

function StickerPrintBreakdownTable({ rows, dlTracking, packingFullCount, onPrintOne, canPrint = true }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0">
      <div className="px-2 py-1.5 lg:px-4 lg:py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-1.5 min-w-0 shrink-0">
        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0 flex-1">
          <Box className="w-4 h-4 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-600" aria-hidden />
          <span className="text-[10px] sm:text-[11px] lg:text-sm font-black uppercase tracking-tight text-slate-800 truncate">
            Stickers
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-0 lg:p-1 touch-pan-y">
        {!rows.length ? (
          <div className="bg-white border border-slate-200 px-3 py-8 text-center">
            <div className="flex flex-col items-center gap-1.5 text-slate-400">
              <Layers size={20} className="opacity-20" />
              <span className="text-[10px] lg:text-xs font-bold uppercase tracking-wide px-1">
                No boxes found for this adjustment.
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 overflow-hidden w-full max-w-full min-w-0">
            <p className="sm:hidden px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
              Swipe sideways →
            </p>
            <div className="overflow-x-auto overscroll-x-contain touch-pan-x max-w-full [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[460px] sm:min-w-[540px] lg:min-w-[700px] text-left border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-30 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-600 border-r border-slate-200 whitespace-nowrap"
                    >
                      #
                    </th>
                    <th scope="col" className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap">
                      Box
                    </th>
                    <th scope="col" className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap">
                      Packing
                    </th>
                    <th scope="col" className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap">
                      Qty
                    </th>
                    <th scope="col" className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap">
                      Type
                    </th>
                    <th scope="col" className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap">
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
                    const rowKey = row.box_uid || `${row.box_no_uid}_${idx}`;
                    const isPrinted = row.box_uid != null && !!dlTracking[String(row.box_uid)];
                    const isLoose = row.is_loose || Number(row.box_no) > packingFullCount;

                    return (
                      <tr key={rowKey} className="group border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 min-w-0 max-w-[110px] sm:max-w-[180px] lg:max-w-[240px]">
                          <div className="flex flex-col leading-snug min-w-0">
                            <span className="text-blue-700 font-bold text-[10px] lg:text-xs break-all">{row.box_no_uid}</span>
                            <span className="text-[8px] lg:text-[10px] text-slate-400 uppercase font-bold truncate">
                              Box {row.box_no} / {row.total_boxes}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-700 whitespace-nowrap tabular-nums">
                          {row.package_no}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2 text-[10px] lg:text-[13px] font-bold text-slate-800 whitespace-nowrap tabular-nums">
                          {Number(row.qty).toLocaleString()} {row.unit || "PCS"}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 lg:py-2">
                          <span
                            className={`text-[8px] lg:text-[11px] font-black px-1 py-0.5 lg:px-1.5 lg:py-0.5 border whitespace-nowrap ${
                              isLoose
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {isLoose ? "LOOSE" : "FULL"}
                          </span>
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
    () => canAccess("stock_adjustment", "view").allowed,
    [canAccess]
  );

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [packingPreview, setPackingPreview] = useState(null);
  const [itemMeta, setItemMeta] = useState(null);
  const [stickerRows, setStickerRows] = useState([]);
  const [dlTracking, setDlTracking] = useState({});
  const [printingAll, setPrintingAll] = useState(false);
  const [mobileTab, setMobileTab] = useState("boxes");
  const sopAckRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !editData?.adjustment_id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setDlTracking({});
      setMobileTab("boxes");
      setDetail(null);
      setPackingPreview(null);
      setItemMeta(null);
      setStickerRows([]);
      try {
        const hydrated = await hydrateStockAdjustmentStickerView(editData);
        if (cancelled) return;

        const row = hydrated.row;
        if (row?.entry_type !== "add") {
          toast.info("Print stickers is only for approved add adjustments.");
          onCloseRef.current?.();
          return;
        }
        if (!row?.approved) {
          toast.info("Approve this add adjustment before printing stickers.");
          onCloseRef.current?.();
          return;
        }

        const rows = (hydrated.savedAddBoxRows || []).filter((r) => r.box_uid != null);
        setDetail(row);
        setPackingPreview(hydrated.packingPreview);
        setItemMeta(hydrated.itemMeta);
        setStickerRows(rows);
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

  const selectedRowLike = useMemo(() => {
    if (!packingPreview) {
      return {
        item_code: detail?.item_code ?? "—",
        itemdesc: detail?.item_desc ?? "—",
        category: "—",
        acc_name: "—",
        job_card_no: "—",
        total_qty: detail?.qty ?? 0,
        unit: detail?.unit || "PCS",
        doc_dt: null,
        doc_no: detail?.packing_number ?? "",
      };
    }
    const st = packingPreview.stickerRow;
    const dp = packingPreview.dailyprod;
    const im = itemMeta;
    const pn = String(detail?.packing_number ?? "").trim();
    return {
      item_code: im?.item_code ?? st?.item_code ?? dp?.item_code ?? detail?.item_code ?? "—",
      itemdesc: im?.itemdesc ?? im?.description ?? st?.itemdesc ?? st?.item_desc ?? detail?.item_desc ?? "—",
      category: st?.category ?? st?.type_name ?? "—",
      acc_name: im?.acc_name ?? st?.acc_name ?? dp?.acc_name ?? "—",
      party_rate_cust_code: st?.party_rate_cust_code ?? dp?.party_rate_cust_code,
      acc_code: dp?.acc_code ?? st?.acc_code ?? null,
      job_card_no: dp?.job_card_no ?? st?.job_card_no ?? "—",
      total_qty: st?.total_qty ?? dp?.total_qty ?? detail?.qty ?? 0,
      unit: st?.unit ?? dp?.unit ?? detail?.unit ?? "PCS",
      doc_dt: st?.doc_dt ?? dp?.doc_dt,
      doc_no: st?.doc_no ?? dp?.doc_no ?? pn,
    };
  }, [packingPreview, itemMeta, detail]);

  const packingLike = useMemo(() => {
    const pd = packingPreview?.stickerRow?.packing_details;
    if (pd?.qty_per_box != null && pd.qty_per_box !== "") {
      return {
        qty_per_box: Number(pd.qty_per_box) || 0,
        full_boxes_count: Number(pd.full_boxes_count) || 0,
        loose_box_qty: Number(pd.loose_box_qty) || 0,
      };
    }
    const perBox = parseInt(String(detail?.per_box_qty ?? ""), 10);
    const full = stickerRows.filter((r) => !r.is_loose).length;
    const looseQty = stickerRows.find((r) => r.is_loose)?.qty ?? 0;
    return {
      qty_per_box: Number.isFinite(perBox) && perBox > 0 ? perBox : stickerRows[0]?.qty ?? 0,
      full_boxes_count: full,
      loose_box_qty: stickerRows.some((r) => r.is_loose) ? Number(looseQty) || 1 : 0,
    };
  }, [packingPreview, detail, stickerRows]);

  const packingFullCount = packingLike.full_boxes_count || stickerRows.filter((r) => !r.is_loose).length;

  const stickerMetaBase = useMemo(
    () => buildStockAdjustmentStickerPrintMeta(detail, packingPreview, stickerRows[0]),
    [detail, packingPreview, stickerRows]
  );

  const handlePrintOne = useCallback(
    async (row) => {
      if (!canPrintStickers) {
        toast.info("Sticker download requires Stock Adjustment view permission.");
        return;
      }
      if (!detail || !row?.box_uid) return;
      if (!sopAckRef.current?.assertAcknowledged()) return;

      try {
        const meta = buildStockAdjustmentStickerPrintMeta(detail, packingPreview, row);
        const printRes = await printSingleStockAdjustmentSticker({
          boxUid: row.box_uid,
          stickerMeta: meta,
        });
        if (!printRes?.ok) {
          if (printRes?.reason === "popup_blocked") toast.warning("Allow pop-ups to print stickers.");
          else toast.error("Could not print sticker.");
          return;
        }
        setDlTracking((prev) => ({ ...prev, [String(row.box_uid)]: true }));
      } catch (err) {
        toast.error(err?.message || "Print failed");
      }
    },
    [canPrintStickers, detail, packingPreview]
  );

  const handlePrintAll = useCallback(async () => {
    if (!canPrintStickers) {
      toast.info("Sticker download requires Stock Adjustment view permission.");
      return;
    }
    if (!detail || !stickerRows.length) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;
    if (printingAll) return;

    const uids = stickerRows
      .map((r) => Number(r.box_uid))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!uids.length) {
      toast.warning("No printable boxes found.");
      return;
    }

    setPrintingAll(true);
    try {
      const printRes = await printStockAdjustmentAddStickers({
        adjustmentId: detail.adjustment_id,
        packingNo: detail.packing_number,
        boxUids: uids,
        stickerMeta: stickerMetaBase,
      });
      if (!printRes?.ok) {
        if (printRes?.reason === "popup_blocked") toast.warning("Allow pop-ups to print stickers.");
        else toast.error("Could not print stickers.");
        return;
      }
      const all = {};
      uids.forEach((uid) => {
        all[String(uid)] = true;
      });
      setDlTracking(all);
    } catch (err) {
      toast.error(err?.message || "Bulk print failed");
    } finally {
      setPrintingAll(false);
    }
  }, [canPrintStickers, detail, stickerRows, printingAll, stickerMetaBase]);

  const printAllHotkeyRef = useRef(handlePrintAll);
  printAllHotkeyRef.current = handlePrintAll;

  const breakdownBlock = (
    <StickerPrintBreakdownTable
      rows={stickerRows}
      dlTracking={dlTracking}
      packingFullCount={packingFullCount}
      onPrintOne={canPrintStickers ? handlePrintOne : () => {}}
      canPrint={canPrintStickers}
    />
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onPrintHotkey={
        canPrintStickers && stickerRows.length
          ? () => {
              void printAllHotkeyRef.current();
            }
          : undefined
      }
      canPrintHotkey={() => canPrintStickers && !printingAll && stickerRows.length > 0}
      title="Print stickers"
      description="Print one sticker or all — same flow as packing sticker creation after generate."
      maxWidth="max-w-full xl:max-w-7xl"
      noPadding
      bodyScrollable={false}
    >
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-full min-w-0 overflow-hidden bg-slate-50 antialiased">
        {loading ? (
          <FormPanelLoader
            className="flex-1 border-0 rounded-none min-h-0"
            minHeight="min-h-0 flex-1"
            label="Loading stickers..."
            hint="Fetching adjustment boxes and packing details."
          />
        ) : (
          <>
            <div className="bg-white border-b px-2 md:px-4 py-1.5 sm:py-2 md:py-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 shadow-sm z-10 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">Adjustment</p>
                <p className="text-[11px] sm:text-sm font-black text-slate-800 truncate">
                  ADJ #{detail?.adjustment_id}
                  {detail?.packing_number ? ` · Packing ${detail.packing_number}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                {canPrintStickers && stickerRows.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handlePrintAll()}
                    disabled={printingAll}
                    title="Print all stickers (Ctrl+Alt+P / Ctrl+P in app)"
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
                        ({Object.keys(dlTracking).length}/{stickerRows.length})
                      </span>
                    )}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden lg:hidden bg-slate-100/80">
                <div
                  role="tablist"
                  aria-label="Details and stickers"
                  className="grid grid-cols-2 gap-1.5 shrink-0 px-2 pt-1.5 pb-1.5 border-b border-slate-200 bg-white"
                >
                  {[
                    { id: "details", label: "Details" },
                    { id: "boxes", label: "Stickers" },
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
                      <StockAdjustmentStickerDetailCards selectedRow={selectedRowLike} packing={packingLike} />
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">{breakdownBlock}</div>
                  )}
                </div>
              </div>

              <div className="hidden lg:flex lg:flex-row flex-1 min-h-0 w-full min-w-0 overflow-hidden bg-slate-50">
                <div className="shrink-0 lg:w-80 xl:w-96 border-r border-slate-200 bg-slate-50 overflow-y-auto overflow-x-hidden">
                  <StockAdjustmentStickerDetailCards selectedRow={selectedRowLike} packing={packingLike} />
                </div>
                <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">{breakdownBlock}</div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2">
              <ModuleSopAcknowledgment
                ref={sopAckRef}
                key={`${open}-print-stickers`}
                moduleSlug="stock_adjustment"
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
