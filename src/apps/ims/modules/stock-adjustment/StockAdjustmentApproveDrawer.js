"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Shield, Printer, Package } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { stockAdjustmentService } from "@/apps/ims/lib/services/stockAdjustment";
import { plainRemarksForDisplay } from "@/apps/ims/modules/stock-adjustment/StockAdjustmentModal";
import { loadBoxesForStockAdjustmentAdd, printStockAdjustmentAddStickers } from "./stockAdjustmentStickerPrint";
import { parseStoredAddAllBoxesLoose } from "./stockAdjustmentViewBoxes";

export default function StockAdjustmentApproveDrawer({ open, onClose, onSuccess, editData, printOnly = false, viewOnly = false }) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [boxes, setBoxes] = useState([]);
  const [selectedUids, setSelectedUids] = useState(() => new Set());
  const [printing, setPrinting] = useState(false);
  const sopAckRef = useRef(null);

  const isAdd = detail?.entry_type === "add";
  const isMinus = detail?.entry_type === "minus";

  useEffect(() => {
    if (!open || !editData?.adjustment_id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await stockAdjustmentService.getById(editData.adjustment_id);
        const row = res?.data ?? editData;
        if (cancelled) return;
        setDetail(row);
        if (row?.entry_type === "add" || row?.entry_type === "minus") {
          const list = await loadBoxesForStockAdjustmentAdd(row.adjustment_id);
          if (cancelled) return;
          setBoxes(list);
          setSelectedUids(new Set(list.map((b) => Number(b.box_uid)).filter(Number.isFinite)));
        } else {
          setBoxes([]);
          setSelectedUids(new Set());
        }
      } catch (err) {
        if (!cancelled) toast.error(err?.message || "Failed to load adjustment");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editData?.adjustment_id]);

  const toggleBox = (uid) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      const n = Number(uid);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedUids.size === boxes.length) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(boxes.map((b) => Number(b.box_uid)).filter(Number.isFinite)));
    }
  };

  const handlePrint = useCallback(async () => {
    if (!isAdd || !detail) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;

    const uids = [...selectedUids];
    if (!uids.length) {
      toast.warning("Select at least one box to print.");
      return;
    }

    setPrinting(true);
    try {
      const printRes = await printStockAdjustmentAddStickers({
        adjustmentId: detail.adjustment_id,
        packingNo: detail.packing_number,
        boxUids: uids,
      });
      if (!printRes?.ok) {
        if (printRes?.reason === "popup_blocked") toast.warning("Allow pop-ups to print stickers.");
        else toast.error("Could not print stickers.");
      }
    } catch (err) {
      toast.error(err?.message || "Print failed");
    } finally {
      setPrinting(false);
    }
  }, [isAdd, detail, selectedUids]);

  const handleApprove = async () => {
    if (printOnly || viewOnly || !detail) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setLoading(true);
    try {
      const payload = { approved: true };
      if (detail?.entry_type === "add") {
        if (boxes.length > 0) {
          payload.all_boxes_loose = boxes.every((b) => !!b.is_loose);
        } else {
          const stored = parseStoredAddAllBoxesLoose(detail?.removed_box_ids);
          payload.all_boxes_loose = stored !== null ? stored : false;
        }
      }
      await stockAdjustmentService.update(detail.adjustment_id, payload);
      toast.success("Adjustment approved");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Approve failed");
    } finally {
      setLoading(false);
    }
  };

  const footer = viewOnly ? (
    <div className="flex flex-wrap items-center justify-end gap-2 w-full">
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg">
        Close
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-end gap-2 w-full">
      <button type="button" onClick={onClose} disabled={loading || printing} className="px-4 py-2 text-sm font-bold text-slate-500">
        {printOnly ? "Close" : "Cancel"}
      </button>
      {isAdd && (
        <button
          type="button"
          onClick={handlePrint}
          disabled={loading || printing || !boxes.length}
          className="px-4 py-2 text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
          Print selected ({selectedUids.size})
        </button>
      )}
      {!printOnly && (
        <button
          type="button"
          onClick={handleApprove}
          disabled={loading || printing || detail?.approved}
          className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
          Approve
        </button>
      )}
    </div>
  );

  const drawerTitle = viewOnly
    ? "View stock adjustment"
    : printOnly
      ? "Print stickers"
      : "Approve stock adjustment";
  const drawerDescription = viewOnly
    ? "Read-only snapshot — how this adjustment was recorded (no edits)."
    : printOnly
      ? "Select boxes and print stickers for this add adjustment."
      : "Review and approve. For add entries, select boxes and print stickers here (not on create or minus).";

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={viewOnly || printOnly ? undefined : handleApprove}
      title={drawerTitle}
      description={drawerDescription}
      footer={footer}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pb-4">
        {loading && !detail ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-indigo-500" size={28} />
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1 text-[11px] text-slate-700">
              <p>
                <span className="font-bold text-slate-500">ADJ ID:</span> #{detail?.adjustment_id}
              </p>
              <p>
                <span className="font-bold text-slate-500">Type:</span>{" "}
                {isAdd ? "Add (+)" : isMinus ? "Minus (−)" : "—"}
              </p>
              <p>
                <span className="font-bold text-slate-500">Packing:</span> {detail?.packing_number || "—"}
              </p>
              {isAdd && detail?.financial_year && (
                <p>
                  <span className="font-bold text-slate-500">FY:</span> {detail.financial_year}
                </p>
              )}
              <p>
                <span className="font-bold text-slate-500">Qty impact:</span> {detail?.qty ?? "—"} {detail?.unit || "PCS"}
              </p>
              <p>
                <span className="font-bold text-slate-500">Status:</span> {detail?.approved ? "Approved" : "Pending"}
              </p>
              <p>
                <span className="font-bold text-slate-500">Item:</span>{" "}
                {detail?.item_dcode || "—"}
                {detail?.item_code ? ` (${detail.item_code})` : ""}
              </p>
              <p>
                <span className="font-bold text-slate-500">Box impact:</span> {detail?.box_count_impact ?? "—"}
              </p>
              {detail?.remarks ? (
                <p className="whitespace-pre-wrap break-words">
                  <span className="font-bold text-slate-500">Remarks:</span> {plainRemarksForDisplay(detail.remarks)}
                </p>
              ) : null}
              <p>
                <span className="font-bold text-slate-500">Created:</span>{" "}
                {detail?.created_by_name || "—"}
                {detail?.created_at ? ` · ${formatDateTime(detail.created_at)}` : ""}
              </p>
              {detail?.approved ? (
                <p>
                  <span className="font-bold text-slate-500">Approved:</span>{" "}
                  {detail?.approved_by_name || "—"}
                  {detail?.approved_at ? ` · ${formatDateTime(detail.approved_at)}` : ""}
                </p>
              ) : null}
            </div>

            {isMinus && !viewOnly && (
              <p className="text-[11px] text-slate-500 italic">
                Minus adjustments do not print stickers. Approve to finalize box removal.
              </p>
            )}

            {(isAdd || (viewOnly && isMinus)) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <Package size={16} />
                    <span className="text-[11px] font-black uppercase tracking-wide">
                      {viewOnly ? "Boxes in this adjustment" : "Boxes to print"}
                    </span>
                  </div>
                  {!viewOnly && isAdd && (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-[10px] font-bold uppercase text-indigo-600 hover:underline"
                    >
                      {selectedUids.size === boxes.length ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
                {boxes.length === 0 ? (
                  <p className="text-[11px] text-amber-600 font-medium">No boxes found for this adjustment.</p>
                ) : viewOnly ? (
                  <div className="max-h-[280px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {boxes.map((b) => (
                      <div key={b.box_uid} className="flex items-center gap-3 px-3 py-2 bg-white">
                        <span className="font-mono text-[11px] font-bold text-slate-800">{b.box_no_uid}</span>
                        <span className="text-[10px] text-slate-500 tabular-nums ml-auto">Qty {b.qty ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="max-h-[280px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {boxes.map((b) => {
                      const uid = Number(b.box_uid);
                      const checked = selectedUids.has(uid);
                      return (
                        <label
                          key={b.box_uid}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 ${checked ? "bg-indigo-50/50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBox(uid)}
                            className="rounded border-slate-300 text-indigo-600"
                          />
                          <span className="font-mono text-[11px] font-bold text-slate-800">{b.box_no_uid}</span>
                          <span className="text-[10px] text-slate-500 tabular-nums ml-auto">Qty {b.qty ?? "—"}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!viewOnly && (
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={`${open}-${printOnly ? "print" : "authorize"}`}
            moduleSlug="stock_adjustment"
            permissionType="authorize"
            isOpen={open}
          />
        )}
      </div>
    </Drawer>
  );
}

