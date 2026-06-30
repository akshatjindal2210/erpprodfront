"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CalendarDays, Loader2, Save } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { schedulePlanningService } from "@/features/apps/ims/services/schedulePlanning";
import { filterDateToDisplay, formatDateTypingInput, parseFilterDateInput } from "@/core/utils/utilHelper";

const LABEL = "block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1";
const BTN =
  "h-8 px-3 text-[11px] font-bold uppercase border border-slate-300 rounded-none hover:bg-slate-50 disabled:opacity-40 text-slate-700";

/** Returns today and last day of current month as YYYY-MM-DD strings */
function getCurrentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const today = `${y}-${m}-${String(now.getDate()).padStart(2, "0")}`;
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  const max = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  return { min: today, max };
}

function DateField({ value, onChange, min, max }) {
  const [text, setText] = useState(() => filterDateToDisplay(value));
  const focused = useRef(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!focused.current) setText(filterDateToDisplay(value));
  }, [value]);

  const inRange = useCallback(
    (ymd) => {
      if (!ymd) return true;
      if (min && ymd < min) return false;
      if (max && ymd > max) return false;
      return true;
    },
    [min, max]
  );

  const commitYmd = useCallback(
    (ymd) => {
      if (ymd && !inRange(ymd)) {
        toast.error("Please pick a date within the current month from today onwards.");
        onChange("");
        setText("");
        return;
      }
      onChange(ymd || "");
      setText(filterDateToDisplay(ymd));
    },
    [onChange, inRange]
  );

  const commitDisplay = useCallback(
    (raw) => {
      const typed = formatDateTypingInput(raw);
      setText(typed);
      if (!typed.trim()) { onChange(""); return; }
      const ymd = parseFilterDateInput(typed);
      if (ymd) commitYmd(ymd);
    },
    [commitYmd, onChange]
  );

  const openCalendar = () => {
    const el = pickerRef.current;
    if (!el) return;
    el.focus();
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); } catch { /* blocked */ }
    }
  };

  return (
    <div className="relative flex items-center w-full h-8 border border-slate-200 bg-white focus-within:border-indigo-500">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        placeholder="DD/MM/YYYY"
        className="flex-1 min-w-0 h-full px-2 text-[11px] border-0 outline-none bg-transparent text-slate-800 font-medium"
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commitDisplay(text); }}
        onChange={(e) => {
          const next = formatDateTypingInput(e.target.value);
          setText(next);
          const ymd = parseFilterDateInput(next);
          if (ymd && inRange(ymd)) onChange(ymd);
          else if (!next.trim()) onChange("");
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openCalendar}
        className="shrink-0 flex h-full w-8 items-center justify-center text-slate-400 hover:text-indigo-600 border-l border-slate-200"
      >
        <CalendarDays size={13} strokeWidth={2} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value || ""}
        min={min || undefined}
        max={max || undefined}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => commitYmd(e.target.value || "")}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
    </div>
  );
}

export default function DispatchRescheduleModal({ open, item, onClose, onSaved }) {
  const [targetDate, setTargetDate] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const { min: dateMin, max: dateMax } = useMemo(getCurrentMonthRange, []);

  useEffect(() => {
    if (open) {
      setTargetDate("");
      setRemark("");
    }
  }, [open, item]);

  const handleClose = () => {
    setTargetDate("");
    setRemark("");
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!targetDate) {
      toast.error("Please select a target date.");
      return;
    }
    if (!item?.fin_year_id) {
      toast.error("Financial year not found for this item.");
      return;
    }

    setSaving(true);
    try {
      const totalQty = Number(item.totalqty ?? item.total_qty ?? 0);
      const res = await schedulePlanningService.dispatchReschedule({
        fin_year_id: String(item.fin_year_id),
        schno: item.schno,
        itemdcode: item.itemdcode,
        schmonth: item.schmonth,
        schdt: item.schdt,
        acc_code: item.acc_code,
        acc_name: item.acc_name,
        item_code: item.item_code,
        itemdesc: item.itemdesc,
        totalqty: totalQty,
        qty: totalQty,
        action_date: targetDate,
        item_remark: remark.trim() || null,
      });
      if (!res?.success) throw new Error(res?.message || "Reschedule failed.");
      toast.success("Item rescheduled successfully.");
      onSaved?.();
      handleClose();
    } catch (err) {
      toast.error(err?.message || "Failed to reschedule.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2 w-full">
      <button type="button" onClick={handleClose} disabled={saving} className={BTN}>
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving || !targetDate}
        className="h-8 px-4 text-[11px] font-bold uppercase text-white rounded-none flex items-center gap-1.5 disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
        Reschedule
      </button>
    </div>
  );

  if (!open || !item) return null;

  return (
    <Drawer
      isOpen={open}
      onClose={handleClose}
      title="Reschedule Item"
      maxWidth="max-w-md"
      footer={footer}
    >
      <div className="space-y-4 pb-2">
        {/* Item details card */}
        <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <div className="w-1 h-4 bg-indigo-500 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              Item Details
            </span>
          </div>
          <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
            <div>
              <span className={LABEL}>Sch No</span>
              <span className="text-[12px] font-semibold text-slate-800">{item.schno ?? "—"}</span>
            </div>
            <div>
              <span className={LABEL}>Item Code</span>
              <span className="text-[12px] font-semibold text-slate-800 uppercase">{item.item_code ?? "—"}</span>
            </div>
            <div className="col-span-2">
              <span className={LABEL}>Customer</span>
              <span className="text-[12px] text-slate-800 leading-snug block">{item.acc_name ?? "—"}</span>
            </div>
            <div className="col-span-2">
              <span className={LABEL}>Description</span>
              <span className="text-[12px] text-slate-700 leading-snug break-words block">{item.itemdesc ?? "—"}</span>
            </div>
            <div>
              <span className={LABEL}>Qty</span>
              <span className="text-[12px] font-semibold text-slate-800">
                {Number(item.totalqty ?? 0).toLocaleString()}
              </span>
            </div>
            {item.action_date ? (
              <div>
                <span className={LABEL}>Current Date</span>
                <span className="text-[12px] text-amber-700 font-medium">{item.action_date}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Reschedule inputs */}
        <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <div className="w-1 h-4 bg-amber-500 rounded-full shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              New Schedule
            </span>
          </div>
          <div className="px-4 py-4 space-y-4">
            <div>
              <label className={LABEL}>
                Target Date <span className="text-rose-500">*</span>
              </label>
              <DateField value={targetDate} onChange={setTargetDate} min={dateMin} max={dateMax} />
            </div>
            <div>
              <label className={LABEL}>Remark</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Optional remark..."
                rows={2}
                className="w-full px-2 py-1.5 text-[11px] text-slate-800 border border-slate-200 rounded-none focus:border-indigo-500 outline-none bg-white resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
