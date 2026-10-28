"use client";

import { useState, useEffect } from "react";
import { X, Save, Clock } from "lucide-react";
import { toast } from "react-toastify";
import { shiftService } from "@/apps/settings/lib/services/shiftService";
import { shiftTimeToInputValue } from "@/apps/settings/lib/utils/shiftTimeFormat";
import { useEscapeKey } from "@/platform/hooks/system/useEscapeKey";
import OverlayModal from "@/ui/primitives/OverlayModal";

export default function ShiftModal({ open, onClose, onSuccess, editData }) {
  const [loading, setLoading] = useState(false);
  useEscapeKey(onClose, open);
  const [formData, setFormData] = useState({
    code: "",
    start_time: "",
    end_time: "",
    ends_next_day: false,
  });

  useEffect(() => {
    if (editData) {
      setFormData({
        code: editData.code || "",
        start_time: shiftTimeToInputValue(editData.start_time),
        end_time: shiftTimeToInputValue(editData.end_time),
        ends_next_day: !!editData.ends_next_day,
      });
    } else {
      setFormData({ code: "", start_time: "", end_time: "", ends_next_day: false });
    }
  }, [editData, open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = String(formData.code || "").trim().toUpperCase();
    if (!code) return toast.error("Code required");
    if (!formData.start_time) return toast.error("Start time required");
    if (!formData.end_time) return toast.error("End time required");
    if (formData.start_time === formData.end_time) {
      return toast.error("Times cannot be same");
    }
    if (!formData.ends_next_day && formData.start_time >= formData.end_time) {
      return toast.error("Invalid shift times");
    }

    setLoading(true);
    try {
      const payload = { ...formData, code };
      const res = editData
        ? await shiftService.update(editData.id, payload)
        : await shiftService.create(payload);
      toast.success(res?.message || "Saved");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full h-11 px-4 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none rounded-none placeholder:text-slate-300";
  const labelClass = "text-[10px] font-black text-slate-500 uppercase tracking-widest ml-0.5";

  return (
    <OverlayModal
      open={open}
      zIndex={100}
      onBackdropClick={onClose}
      className="bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative bg-white w-full max-w-md shadow-2xl border border-slate-200 rounded-none overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 flex items-center justify-center rounded-none shadow-sm">
              <Clock size={16} className="text-white" />
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
              {editData ? "Edit Shift" : "New Shift"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors rounded-none"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className={labelClass}>
                Shift code <span className="text-rose-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                maxLength={20}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="BS"
                className={`${inputClass} uppercase font-mono tracking-wide`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Start <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>
                  End <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.ends_next_day}
                onChange={(e) => setFormData({ ...formData, ends_next_day: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Ends next day (crosses midnight)
            </label>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 rounded-none"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
