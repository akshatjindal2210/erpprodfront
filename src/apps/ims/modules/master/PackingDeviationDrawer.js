"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquareQuote, Shield } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { ERR_INPUT, OK_INPUT, FormLabel } from "@/ui/common/Constants";
import { focusFirstError } from "@/platform/utils/form/formFocus";
import { boxService } from "@/apps/ims/lib/services/box";
import { createPackingDeviation } from "@/apps/ims/lib/services/shortage";
import { formatDocDate } from "@/platform/utils/core/utilHelper";

const FIELD_ORDER = ["qty", "remarks"];
/** Standalone — do not merge with OK_INPUT (bg-white / text-slate-900 fight Tailwind). */
const DISABLED_INPUT =
  "w-full border border-slate-200 rounded-lg px-2.5 sm:px-3 min-h-9 h-auto sm:h-9 py-2 sm:py-0 text-xs sm:text-[11px] leading-normal outline-none appearance-none bg-slate-100 text-slate-500 cursor-not-allowed select-none pointer-events-none";

function itemLabel(row) {
  if (!row) return "—";
  const code = row.item_code || row.itemcode || row.itemdcode || row.item_dcode || "";
  const desc = row.itemdesc || row.description || row.item_desc || "";
  return [code, desc].filter(Boolean).join(" — ") || "—";
}

function fmtQty(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN");
}

export default function PackingDeviationDrawer({ open, onClose, packingRow, onSuccess }) {
  const [loadingLimit, setLoadingLimit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limitInfo, setLimitInfo] = useState(null);
  const [qty, setQty] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);

  const itemdcode = packingRow?.itemdcode ?? packingRow?.item_dcode;

  useEffect(() => {
    if (!open || itemdcode == null || String(itemdcode).trim() === "") {
      setLimitInfo(null);
      setQty("");
      setRemarks("");
      setErrors({});
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoadingLimit(true);
      setErrors({});
      setRemarks("");
      try {
        const res = await boxService.previewMonthlyPackingLimit({
          doc_no: packingRow.doc_no,
          itemdcode,
          total_qty: packingRow.total_qty,
          doc_dt: packingRow.doc_dt,
        });
        const data = res?.data || res || {};
        if (cancelled) return;
        setLimitInfo(data);
        const excess = Number(data.excess_qty);
        setQty(Number.isFinite(excess) && excess > 0 ? String(Math.ceil(excess)) : "");
      } catch (err) {
        if (!cancelled) {
          setLimitInfo(null);
          setQty("");
          toast.error(err?.message || "Could not load monthly packing limit.");
        }
      } finally {
        if (!cancelled) setLoadingLimit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, packingRow?.doc_no, itemdcode, packingRow?.total_qty, packingRow?.doc_dt]);

  const handleSave = async () => {
    const nextErrors = {};
    const qtyNum = parseInt(String(qty), 10);
    if (!Number.isFinite(qtyNum) || qtyNum < 1) nextErrors.qty = "Quantity must be at least 1";
    if (!String(remarks || "").trim()) nextErrors.remarks = "Remarks are required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error("Please fix the highlighted fields before saving.");
      focusFirstError(nextErrors, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }

    setSaving(true);
    try {
      const res = await createPackingDeviation({
        itemdcode,
        itemcode: packingRow.item_code || packingRow.itemcode || String(itemdcode),
        qty: qtyNum,
        remarks: String(remarks).trim(),
        month: packingRow.doc_dt || null,
      });
      onSuccess?.(res?.data);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const shortBy = Number(limitInfo?.excess_qty) || 0;
  const withinLimit = limitInfo && limitInfo.ok === true;

  const footerContent = (
    <div className="flex items-center justify-end gap-3 w-full">
      <button type="button" onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-bold text-slate-500">
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || loadingLimit || !packingRow}
        className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Processing
          </>
        ) : (
          <>
            <Check size={18} /> Save
          </>
        )}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSave}
      title="Create Deviation"
      description="Record excess packing qty (auto-approved)"
      footer={footerContent}
      maxWidth="max-w-2xl"
    >
      {!packingRow ? (
        <p className="text-sm text-slate-500">Select a packing row first.</p>
      ) : loadingLimit ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : (
        <form ref={formRef} className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          {!withinLimit && shortBy > 0 ? (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-[11px] text-amber-700 font-medium leading-normal">
                Short by <span className="font-bold tabular-nums">{fmtQty(shortBy)}</span>
                {" · "}Used {fmtQty(limitInfo?.month_used_qty)} · Batch {fmtQty(limitInfo?.requested_qty)} · Allowed{" "}
                {fmtQty(limitInfo?.allowed_limit)}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormLabel>Packing No</FormLabel>
              <input
                type="text"
                value={packingRow.doc_no != null ? `#${packingRow.doc_no}` : "—"}
                readOnly
                disabled
                tabIndex={-1}
                className={DISABLED_INPUT}
              />
            </div>
            <div>
              <FormLabel>Doc Date</FormLabel>
              <input
                type="text"
                value={formatDocDate(packingRow.doc_dt) || "—"}
                readOnly
                disabled
                tabIndex={-1}
                className={DISABLED_INPUT}
              />
            </div>
          </div>

          <div>
            <FormLabel>Item</FormLabel>
            <input
              type="text"
              value={itemLabel(packingRow)}
              readOnly
              disabled
              tabIndex={-1}
              className={DISABLED_INPUT}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormLabel>Batch Qty</FormLabel>
              <input
                type="text"
                value={fmtQty(packingRow.total_qty)}
                readOnly
                disabled
                tabIndex={-1}
                className={`${DISABLED_INPUT} tabular-nums`}
              />
            </div>
            <div>
              <FormLabel>Customer</FormLabel>
              <input
                type="text"
                value={packingRow.acc_name || "—"}
                readOnly
                disabled
                tabIndex={-1}
                className={DISABLED_INPUT}
              />
            </div>
          </div>

          <div data-field="qty">
            <FormLabel required>Quantity</FormLabel>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                if (errors.qty) setErrors((p) => ({ ...p, qty: "" }));
              }}
              disabled={saving}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg ${errors.qty ? ERR_INPUT : OK_INPUT}`}
            />
            {errors.qty ? <p className="text-xs text-rose-500 mt-1">{errors.qty}</p> : null}
          </div>

          <div data-field="remarks">
            <FormTextarea
              label="Remarks"
              labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
              className="[&_textarea]:!text-[11px] [&_textarea]:!min-h-[4.5rem] [&_textarea]:!py-2"
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                if (errors.remarks) setErrors((p) => ({ ...p, remarks: "" }));
              }}
              placeholder="Reason for excess packing qty..."
              disabled={saving}
              error={errors.remarks}
              required
              rows={4}
            />
          </div>

          <div className="h-px bg-slate-100" />

          <div className="p-3 rounded-xl border bg-emerald-600 border-emerald-700 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20 text-white">
                <Shield size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Approval Status</p>
                <p className="text-[9px] uppercase font-bold tracking-tight text-emerald-100">Final & Locked</p>
              </div>
            </div>
          </div>
        </form>
      )}
    </Drawer>
  );
}
