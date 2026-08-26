"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Loader2, Printer } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { boxService } from "@/apps/ims/lib/services/box";
import StockAdjustmentStickerDetailCards from "@/apps/ims/modules/stock-adjustment/StockAdjustmentStickerDetailCards";
import { StickerPrintBreakdownTable } from "@/apps/ims/modules/stock-adjustment/StockAdjustmentPrintStickersDrawer";
import { buildQcHoldStickerPrintMeta, loadQcHoldCompletionStickerView, printQcHoldCompletionStickers, printSingleQcHoldSticker } from "./qcHoldStickerPrint";

export default function QcHoldPrintStickersDrawer({ open, onClose, editData, initialStickers = null }) {
  const canAccess = useCanAccess();
  const canPrintStickers = useMemo(
    () => canAccess("qc_hold_material", "view").allowed,
    [canAccess]
  );

  const [loading, setLoading] = useState(false);
  const [hold, setHold] = useState(null);
  const [packingMeta, setPackingMeta] = useState(null);
  const [stickerRow, setStickerRow] = useState(null);
  const [stickerRows, setStickerRows] = useState([]);
  const [printSubmission, setPrintSubmission] = useState(null);
  const [dlTracking, setDlTracking] = useState({});
  const [printingAll, setPrintingAll] = useState(false);
  const [mobileTab, setMobileTab] = useState("details");
  const sopAckRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const holdId = editData?.hold_id;
    if (!holdId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setDlTracking({});
      setMobileTab("details");
      setHold(null);
      setPackingMeta(null);
      setStickerRow(null);
      setPrintSubmission(null);

      try {
        const hydrated = await loadQcHoldCompletionStickerView({
          hold_id: holdId,
        });
        if (cancelled) return;
        const isRevert = String(hydrated.submission?.submission_type || "").toLowerCase() === "revert";
        const boxes =
          hydrated.boxes?.length
            ? hydrated.boxes
            : Array.isArray(initialStickers) && initialStickers.length
              ? initialStickers
              : [];
        if (!boxes.length) {
          toast.info(
            isRevert
              ? "No original boxes found for this revert hold."
              : "No completion stickers found for this hold."
          );
          onCloseRef.current?.();
          return;
        }
        setHold(hydrated.hold || editData);
        setPackingMeta(hydrated.packingMeta);
        setPrintSubmission(hydrated.submission);
        setStickerRows(boxes);

        const pn = String(editData?.packing_number ?? initialStickers?.[0]?.packing_number ?? "").trim();
        if (pn) {
          try {
            const stickerRes = await boxService.getStickers({
              doc_no: pn,
              permission_module: "qc_hold_material",
              permission_action: "view",
            });
            const row = stickerRes?.data?.[0] || null;
            if (!cancelled) setStickerRow(row);
          } catch {
            if (!cancelled) setStickerRow(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.message || "Failed to load QC hold stickers");
          onCloseRef.current?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, editData?.hold_id, editData?.submission_id, editData?.packing_number, initialStickers]);

  const selectedRowLike = useMemo(() => {
    const pn = String(hold?.packing_number ?? packingMeta?.packing_number ?? "").trim();
    const st = stickerRow;
    return {
      item_code: hold?.item_code ?? packingMeta?.item_code ?? st?.item_code ?? "—",
      itemdesc: hold?.item_desc ?? packingMeta?.item_desc ?? st?.itemdesc ?? st?.item_desc ?? "—",
      category: st?.category ?? st?.type_name ?? st?.ims_category ?? "—",
      acc_name: hold?.acc_name ?? packingMeta?.acc_name ?? st?.acc_name ?? "—",
      party_rate_cust_code: st?.party_rate_cust_code ?? packingMeta?.party_rate_cust_code,
      acc_code: hold?.acc_code ?? packingMeta?.acc_code ?? st?.acc_code ?? null,
      job_card_no: packingMeta?.job_card_no ?? st?.job_card_no ?? "—",
      total_qty:
        stickerRows.reduce((s, r) => s + (Number(r.qty) || 0), 0) ||
        hold?.completed_qty ||
        hold?.qty ||
        0,
      unit: "PCS",
      doc_dt: st?.doc_dt,
      doc_no: pn,
    };
  }, [hold, packingMeta, stickerRow, stickerRows]);

  const packingLike = useMemo(() => {
    const rows = stickerRows || [];
    if (rows.length) {
      const maxQty = rows.reduce((m, r) => Math.max(m, Number(r.qty) || 0), 0);
      const qtyPerBox = Number(packingMeta?.standard_qty_per_box) || (maxQty > 0 ? maxQty : 0);
      const fullRows = rows.filter((r) => qtyPerBox > 0 && Number(r.qty) >= qtyPerBox);
      const looseRows = rows.filter((r) => !(qtyPerBox > 0 && Number(r.qty) >= qtyPerBox));
      const looseQty = looseRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      return {
        qty_per_box: qtyPerBox || Number(rows[0]?.qty) || 0,
        full_boxes_count: fullRows.length,
        loose_box_qty: looseQty,
      };
    }
    const pd = stickerRow?.packing_details;
    if (pd?.qty_per_box != null && pd.qty_per_box !== "") {
      return {
        qty_per_box: Number(pd.qty_per_box) || 0,
        full_boxes_count: Number(pd.full_boxes_count) || 0,
        loose_box_qty: Number(pd.loose_box_qty) || 0,
      };
    }
    return {
      qty_per_box: 0,
      full_boxes_count: 0,
      loose_box_qty: 0,
    };
  }, [stickerRow, packingMeta, stickerRows]);

  const isRevertPrint = String(printSubmission?.submission_type || "").toLowerCase() === "revert";

  const packingFullCount = packingLike.full_boxes_count || stickerRows.filter((r) => !r.is_loose).length;

  const stickerMetaBase = useMemo(
    () => buildQcHoldStickerPrintMeta(hold, packingMeta, stickerRows[0]),
    [hold, packingMeta, stickerRows]
  );

  const handlePrintOne = useCallback(
    async (row) => {
      if (!canPrintStickers) {
        toast.info("Sticker print requires QC Hold view permission.");
        return;
      }
      if (!hold || !row?.box_uid) return;
      if (!sopAckRef.current?.assertAcknowledged()) return;

      try {
        const meta = buildQcHoldStickerPrintMeta(hold, packingMeta, row);
        const printRes = await printSingleQcHoldSticker({ boxUid: row.box_uid, stickerMeta: meta });
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
    [canPrintStickers, hold, packingMeta]
  );

  const handlePrintAll = useCallback(async () => {
    if (!canPrintStickers) {
      toast.info("Sticker print requires QC Hold view permission.");
      return;
    }
    if (!hold || !stickerRows.length) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;
    if (printingAll) return;

    const uids = stickerRows.map((r) => Number(r.box_uid)).filter((n) => Number.isFinite(n) && n > 0);
    if (!uids.length) {
      toast.warning("No printable boxes found.");
      return;
    }

    setPrintingAll(true);
    try {
      const printRes = await printQcHoldCompletionStickers({
        packingNo: hold.packing_number,
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
  }, [canPrintStickers, hold, stickerRows, printingAll, stickerMetaBase]);

  const printAllHotkeyRef = useRef(handlePrintAll);
  printAllHotkeyRef.current = handlePrintAll;

  const breakdownBlock = (
    <StickerPrintBreakdownTable
      rows={stickerRows.map((row) => ({
        ...row,
        package_no: row.package_no ?? row.packing_number ?? hold?.packing_number,
      }))}
      dlTracking={dlTracking}
      packingFullCount={packingFullCount}
      qtyPerBox={packingLike.qty_per_box}
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
      title={isRevertPrint ? "Print original stickers" : "Print QC Hold stickers"}
      description={
        isRevertPrint
          ? "No change revert — re-print the same packing stickers that were on hold."
          : "Same layout as packing sticker creation — print one or all completion boxes."
      }
      maxWidth="max-w-full xl:max-w-7xl"
      noPadding
      bodyScrollable={false}
    >
      <div className="flex h-full min-h-0 flex-col w-full max-w-full min-w-0 overflow-hidden bg-slate-50 antialiased">
        {loading ? (
          <FormPanelLoader
            className="flex-1 border-0 rounded-none min-h-0"
            minHeight="min-h-0 flex-1"
            label="Loading stickers..."
            hint="Fetching QC hold completion boxes and packing details."
          />
        ) : (
          <>
            <div className="bg-white border-b px-2 md:px-4 py-1.5 sm:py-2 md:py-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 shadow-sm z-10 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">QC Hold</p>
                <p className="text-[11px] sm:text-sm font-black text-slate-800 truncate">
                  QCH #{hold?.hold_id}
                  {hold?.packing_number ? ` · Packing ${hold.packing_number}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                {canPrintStickers && stickerRows.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handlePrintAll()}
                    disabled={printingAll}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-md disabled:bg-emerald-300 min-h-[34px]"
                  >
                    {printingAll ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Printer size={14} className="shrink-0" />}
                    <span className="hidden lg:inline">{printingAll ? "PREPARING…" : "PRINT ALL"}</span>
                    <span className="lg:hidden">{printingAll ? "…" : "ALL"}</span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden lg:hidden bg-slate-100/80 min-h-[min(52dvh,420px)]">
                <div className="grid grid-cols-2 gap-1.5 shrink-0 px-2 pt-1.5 pb-1.5 border-b border-slate-200 bg-white">
                  {[
                    { id: "details", label: "Details" },
                    { id: "boxes", label: "Stickers" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMobileTab(tab.id)}
                      className={`rounded-lg py-2 px-2 text-center text-[10px] font-black uppercase ${
                        mobileTab === tab.id ? "bg-white text-indigo-700 ring-1 ring-slate-200" : "bg-slate-200/70 text-slate-600"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col mx-2 mb-2 mt-1.5 bg-white border border-slate-200 rounded-lg">
                  {mobileTab === "details" ? (
                    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-2">
                      <StockAdjustmentStickerDetailCards
                        selectedRow={selectedRowLike}
                        packing={packingLike}
                        categorySelectDisabled
                        customerSelectDisabled
                      />
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{breakdownBlock}</div>
                  )}
                </div>
              </div>

              <div className="hidden lg:flex lg:flex-row flex-1 min-h-0 w-full overflow-hidden bg-slate-50">
                <div className="shrink-0 lg:w-80 xl:w-96 border-r border-slate-200 bg-slate-50 overflow-y-auto">
                  <StockAdjustmentStickerDetailCards
                    selectedRow={selectedRowLike}
                    packing={packingLike}
                    categorySelectDisabled
                    customerSelectDisabled
                  />
                </div>
                <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">{breakdownBlock}</div>
              </div>
            </div>

            <div className="shrink-0 border-t border-amber-200 bg-amber-50/50 px-3 py-3">
              <ModuleSopAcknowledgment
                ref={sopAckRef}
                moduleSlug="qc_hold_material"
                permissionType="view"
                isOpen={open && !!hold}
                requireAckWhenPresent
                showRejectToast={false}
              />
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
