"use client";

import { useState, useEffect } from "react";
import { X, Save, Clock } from "lucide-react";
import { toast } from "react-toastify";
import { shiftService } from "@/apps/settings/lib/services/shiftService";
import { shiftTimeToInputValue, isOvernight, shiftHours, formatShiftTime, LUNCH_MIN } from "@/apps/settings/lib/utils/shiftTimeFormat";
import { FormLabel, OK_INPUT } from "@/ui/common/Constants";
import { useEscapeKey } from "@/platform/hooks/system/useEscapeKey";
import OverlayModal from "@/ui/primitives/OverlayModal";

export default function ShiftModal({ open, onClose, onSuccess, editData }) {
  const [loading, setLoading] = useState(false);
  useEscapeKey(onClose, open);
  const [form, setForm] = useState({ code: "", start_time: "", end_time: "", lunch: false });

  useEffect(() => {
    if (editData) {
      setForm({
        code: editData.code || "",
        start_time: shiftTimeToInputValue(editData.start_time),
        end_time: shiftTimeToInputValue(editData.end_time),
        lunch: !!editData.lunch,
      });
    } else {
      setForm({ code: "", start_time: "", end_time: "", lunch: false });
    }
  }, [editData, open]);

  if (!open) return null;

  const nextDay = form.start_time && form.end_time && isOvernight(form.start_time, form.end_time);
  const hours =
    form.start_time && form.end_time ? shiftHours(form.start_time, form.end_time, form.lunch) : null;

  const save = async (e) => {
    e.preventDefault();
    const code = String(form.code || "").trim().toUpperCase();
    if (!code) return toast.error("Code required");
    if (!form.start_time || !form.end_time) return toast.error("Start / end required");
    if (form.start_time === form.end_time) return toast.error("Times cannot be same");

    setLoading(true);
    try {
      const body = {
        code,
        start_time: form.start_time,
        end_time: form.end_time,
        lunch: !!form.lunch,
      };
      const res = editData
        ? await shiftService.update(editData.id, body)
        : await shiftService.create(body);
      toast.success(res?.message || "Saved");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OverlayModal
      open={open}
      zIndex={100}
      onBackdropClick={onClose}
      className="bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-indigo-600">
              <Clock size={16} className="text-white" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
              {editData ? "Edit Shift" : "New Shift"}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={save} className="flex flex-col">
          <div className="space-y-4 p-5">
            <div className="space-y-1">
              <FormLabel required>Code</FormLabel>
              <input
                autoFocus
                type="text"
                maxLength={20}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="A / BB / CCC"
                className={`${OK_INPUT} h-10 font-mono uppercase tracking-wide`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <FormLabel required>Start</FormLabel>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className={`${OK_INPUT} h-10`}
                />
              </div>
              <div className="space-y-1">
                <FormLabel required>End</FormLabel>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className={`${OK_INPUT} h-10`}
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={!!form.lunch}
                onChange={(e) => setForm({ ...form, lunch: e.target.checked })}
                className="h-3.5 w-3.5 border-slate-300 text-indigo-600"
              />
              Lunch (−{LUNCH_MIN}m)
            </label>
            {hours != null ? (
              <p className="text-[11px] font-semibold text-slate-500">
                <span className="font-black tabular-nums text-slate-800">{hours}h</span>
                {nextDay ? <span className="ml-1 text-[9px] font-bold uppercase text-indigo-600">+1</span> : null}
                <span className="ml-1.5 text-slate-400">
                  {formatShiftTime(form.start_time)}
                  {nextDay ? " → " : " – "}
                  {formatShiftTime(form.end_time)}
                  {nextDay ? " next day" : ""}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-9 items-center gap-2 bg-indigo-600 px-6 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:bg-indigo-400"
            >
              {loading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Save size={14} />
              )}
              {editData ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </OverlayModal>
  );
}
