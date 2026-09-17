"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL } from "@/apps/ims/lib/helpers/masterListUi";
import { mrnService } from "@/apps/rmstore/lib/services/mrn";
import { notify } from "@/apps/rmstore/lib/utils/notify";
import { equalSplitQtyAcrossCoils, roundQty3, splitQtyAcrossCoils } from "@/apps/rmstore/lib/helpers/coilUid";
import { formatDocDate } from "@/platform/utils/core/utilHelper";

const LABEL = "block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1";
const INPUT =
  "w-full h-10 sm:h-8 px-2.5 sm:px-2 text-[11px] text-slate-800 border border-slate-200 rounded-lg focus:border-rose-500 outline-none bg-white font-bold tabular-nums touch-manipulation";

function parseStickerDraft(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof raw === "object" ? raw : null;
}

function buildCoilQtys(count, total, autoCalc) {
  const n = Math.max(1, Number(count) || 1);
  return autoCalc ? splitQtyAcrossCoils(total, n) : equalSplitQtyAcrossCoils(total, n);
}

function initialCoilCount(detail) {
  const draft = parseStickerDraft(detail?.sticker_draft);
  if (draft?.coil_count != null) {
    return Math.max(1, Number(draft.coil_count) || 1);
  }
  return 1;
}

function isDetailGenerated(detail) {
  return detail?.sticker_generated === true || (Array.isArray(detail?.coils) && detail.coils.length > 0);
}

function formatQty(v) {
  const n = roundQty3(v);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

/** Live ERP / list-row value first — pending MRNs emerge from the list, not local detail alone. */
function erpField(row, detail, key) {
  const fromIms = row?.ims_source?.[key];
  if (fromIms != null && String(fromIms).trim() !== "") return fromIms;
  const fromRow = row?.[key];
  if (fromRow != null && String(fromRow).trim() !== "") return fromRow;
  const fromDetail = detail?.[key];
  if (fromDetail != null && String(fromDetail).trim() !== "") return fromDetail;
  return null;
}

/**
 * Pending MRN → enter coil count + remark → RM Rejection register.
 * Coils are not created yet; only the count and marks are captured at reject time.
 */
export default function MrnRejectDrawer({ open, onClose, onSuccess, row }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [coilCount, setCoilCount] = useState(1);
  const [remark, setRemark] = useState("");

  const uid = row?.uid != null ? String(row.uid).trim() : "";

  const totalQty = useMemo(
    () => roundQty3(Number(erpField(row, detail, "it_recp_qty")) || 0),
    [row, detail]
  );
  const qtyAutoCalc = row?.qty_auto_calc ?? detail?.qty_auto_calc;
  const qtyAutoCalcEnabled = qtyAutoCalc !== false;
  const coilQtys = useMemo(
    () => buildCoilQtys(coilCount, totalQty, qtyAutoCalcEnabled),
    [coilCount, totalQty, qtyAutoCalcEnabled]
  );

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await mrnService.getDetail(uid);
      const data = res?.data ?? null;
      if (!data) {
        throw new Error("MRN not found.");
      }
      if (isDetailGenerated(data)) {
        toast.error("Reject is only allowed before sticker generation.");
        onClose?.();
        return;
      }
      if (data.sticker_rejected) {
        toast.error("This MRN has already been rejected.");
        onClose?.();
        return;
      }
      setDetail(data);
      setCoilCount(initialCoilCount(data));
      setRemark("");
    } catch (err) {
      toast.error(err?.message || "Could not load the MRN. Please try again.");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [uid, onClose]);

  useEffect(() => {
    if (open && uid) {
      void load();
    } else if (!open) {
      setDetail(null);
      setCoilCount(1);
      setRemark("");
      setLoading(false);
      setSubmitting(false);
    }
  }, [open, uid, load]);

  const handleCoilCountChange = (raw) => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (!digits) {
      setCoilCount("");
      return;
    }
    setCoilCount(String(Math.max(1, Math.floor(Number(digits)))));
  };

  const commitCoilCount = () => {
    const n = Math.max(1, Math.floor(Number(coilCount) || 1));
    setCoilCount(String(n));
  };

  const handleClose = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!uid) {
      toast.error("MRN UID is missing.");
      return;
    }
    const count = Math.max(1, Number(coilCount) || 1);
    if (!remark.trim()) {
      toast.error("Remark is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await mrnService.rejectPortal({
        uid,
        sourceRow: row ?? detail,
        coil_count: count,
        coil_qtys: coilQtys,
        total_qty: totalQty,
        remarks: remark.trim(),
      });
      notify(res, "MRN rejected — see RM Rejection register to attach bill.");
      onSuccess?.();
      handleClose();
    } catch (err) {
      toast.error(err?.message || "Could not reject this MRN. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const unit = erpField(row, detail, "it_unit") || "KGS";
  const mrnNo = erpField(row, detail, "mrn_no") ?? "—";
  const serialNo = erpField(row, detail, "serial_no") ?? "—";
  const accName = erpField(row, detail, "acc_name") ?? "—";
  const billNo = erpField(row, detail, "bill_no") ?? "—";
  const billDt = erpField(row, detail, "bill_dt");
  const mrnDt = erpField(row, detail, "mrn_dt");
  const itemCode = erpField(row, detail, "item_code") ?? "—";
  const itemDesc = erpField(row, detail, "item_desc") ?? "—";
  const canSubmit = !loading && remark.trim() && Math.max(1, Number(coilCount) || 1) >= 1;

  const footer = (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={handleClose} disabled={submitting} className={IMS_DRAWER_BTN_CANCEL}>
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting || loading || !canSubmit}
        title="Ctrl+S"
        className="shrink-0 min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-rose-100 disabled:opacity-50"
      >
        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        Reject
      </button>
    </div>
  );

  if (!open || !row) return null;

  return (
    <Drawer
      isOpen={open}
      onClose={handleClose}
      onSubmit={!loading && !submitting && canSubmit ? () => void handleSubmit() : undefined}
      title="Reject MRN"
      description="Enter the number of coils and remark, then submit to RM Rejection."
      maxWidth="max-w-md"
      footer={footer}
      bodyScrollable
    >
      <div className="space-y-4 pb-2">
        <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
          <div className="px-3 sm:px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <div className="w-1 h-4 bg-slate-500 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">MRN Details</span>
          </div>
          <div className="px-3 sm:px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2.5">
            <div>
              <span className={LABEL}>MRN No</span>
              <span className="text-[12px] font-semibold text-slate-800">{mrnNo}</span>
            </div>
            <div>
              <span className={LABEL}>Serial No</span>
              <span className="text-[12px] font-semibold text-slate-800">{serialNo}</span>
            </div>
            <div>
              <span className={LABEL}>MRN Date</span>
              <span className="text-[12px] font-semibold text-slate-800">
                {formatDocDate(mrnDt) || "—"}
              </span>
            </div>
            <div>
              <span className={LABEL}>Total Qty</span>
              <span className="text-[12px] font-semibold text-slate-800 tabular-nums">
                {formatQty(totalQty)}{" "}
                <span className="text-[10px] uppercase opacity-70">{unit}</span>
              </span>
            </div>
            <div className="col-span-2">
              <span className={LABEL}>Name</span>
              <span className="text-[12px] text-slate-700 leading-snug break-words block">{accName}</span>
            </div>
            <div>
              <span className={LABEL}>Bill</span>
              <span className="text-[12px] font-semibold text-slate-800 uppercase">{billNo}</span>
            </div>
            <div>
              <span className={LABEL}>Bill Date</span>
              <span className="text-[12px] font-semibold text-slate-800">
                {formatDocDate(billDt) || "—"}
              </span>
            </div>
            <div className="col-span-2">
              <span className={LABEL}>Item Code</span>
              <span className="text-[12px] font-semibold text-slate-800 uppercase">{itemCode}</span>
            </div>
            <div className="col-span-2">
              <span className={LABEL}>Description</span>
              <span className="text-[12px] text-slate-700 leading-snug break-words block">{itemDesc}</span>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
          <div className="px-3 sm:px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <div className="w-1 h-4 bg-rose-500 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Reject</span>
          </div>
          <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 text-[11px] py-1">
                <Loader2 size={14} className="animate-spin shrink-0" /> Checking MRN…
              </div>
            ) : null}
            <div>
              <label className={LABEL} htmlFor="mrn-reject-coil-count">
                No. of Coils <span className="text-rose-500">*</span>
              </label>
              <input
                id="mrn-reject-coil-count"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                autoComplete="off"
                value={coilCount}
                onChange={(e) => handleCoilCountChange(e.target.value)}
                onBlur={commitCoilCount}
                disabled={loading}
                className={INPUT}
              />
              <p className="text-[10px] text-slate-400 mt-1.5">
                MRN qty {formatQty(totalQty)} {unit} split across {Math.max(1, Number(coilCount) || 1)} coil(s).
              </p>
            </div>

            <FormTextarea
              label={
                <>
                  Remark <span className="text-rose-500">*</span>
                </>
              }
              labelClassName={LABEL}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Enter rejection remark..."
              rows={3}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
}
