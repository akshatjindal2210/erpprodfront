"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { reportPanelService } from "@/features/apps/task/services/reportApi";
import { useCanAccess } from "@/core/hooks/useCanAccess";

export default function TaskReportFormModal({ open, task, onClose, onSaved }) {
  const canAccess = useCanAccess();
  const canEdit = canAccess("task_report", "edit").allowed;

  const [score, setScore] = useState("");
  const [remark, setRemark] = useState("");
  const [isRed, setIsRed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    setScore(task.effective_score != null ? String(task.effective_score) : task.score != null ? String(task.score) : "");
    setRemark(task.management_remark ?? "");
    setIsRed(!!task.is_red_flag);
  }, [open, task]);

  if (!open || !task) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await reportPanelService.saveReview({
        cl_instance_id: task.instance_id,
        report_date: task.scheduled_date,
        score: score !== "" ? Number(score) : null,
        management_remark: remark.trim() || null,
        is_red_flag: isRed,
      });
      toast.success(isRed ? "Saved — red flag applied to MIS score" : "Report review saved");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">CL Task Report</h2>
          <p className="text-sm text-slate-500 mt-1">{task.title}</p>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-400 text-xs">Date</span><p className="font-medium">{task.scheduled_date}</p></div>
            <div><span className="text-slate-400 text-xs">Person</span><p className="font-medium">{task.person_name ?? "—"}</p></div>
            <div><span className="text-slate-400 text-xs">Status</span><p className="font-medium capitalize">{task.status?.replace("_", " ")}</p></div>
            <div><span className="text-slate-400 text-xs">Current Score</span><p className="font-medium">{task.score ?? "—"}</p></div>
          </div>
          {canEdit && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Management Score (1–10)</label>
                <input type="number" min={1} max={10} value={score} onChange={(e) => setScore(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Management Remark</label>
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-indigo-400"
                  placeholder="Add management remarks…" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isRed} onChange={(e) => setIsRed(e.target.checked)} className="rounded border-slate-300 text-rose-600" />
                <span className="text-sm text-rose-700 font-medium">Mark as Red Ticket (minus MIS score impact)</span>
              </label>
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl">Close</button>
          {canEdit && (
            <button type="button" disabled={saving} onClick={handleSave}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save Review"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
