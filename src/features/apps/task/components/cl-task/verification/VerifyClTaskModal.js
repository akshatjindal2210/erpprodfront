import { useState, useEffect, useCallback } from "react";
import { User, Calendar, Clock, AlertTriangle, Star, X, Check } from "lucide-react";
import Drawer from "@/core/components/ui/Drawer";
import ClTaskFormEntriesView, { ClTaskFormEntriesHeader } from "../shared/ClTaskFormEntriesView";
import RichTextDisplay from "../../common/RichTextDisplay";
import { parseFormSchema, normalizeToEntries } from "@/features/apps/task/helpers/clTaskFormHelper";
import { formatDateTime } from "@/features/apps/task/helpers/utilHelper";
import { ClFormSection, ClFormLabel, ClFormError, inputBase } from "../shared/clTaskFormUi";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function VerifyClTaskModal({ task, onClose, onVerify, saving }) {
  const [score, setScore] = useState(5);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");

  const isOpen = !!task;
  const scoringOn = task?.verification_required !== false;

  useEffect(() => {
    if (!task) return;
    setScore(5);
    setRemark("");
    setError("");
  }, [task?.instance_id]);

  const handleApprove = useCallback(() => {
    if (scoringOn && (score < 1 || score > 10)) {
      setError("Select a score between 1 and 10");
      return;
    }
    onVerify(task, {
      action: "approve",
      score: scoringOn ? score : null,
      verifier_remark: remark.trim() || null,
    });
  }, [task, score, remark, scoringOn, onVerify]);

  const handleReject = useCallback(() => {
    if (!remark.trim()) {
      setError("Remark is required when rejecting");
      return;
    }
    onVerify(task, { action: "reject", verifier_remark: remark.trim() });
  }, [task, remark, onVerify]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Verify & Score Task"
      description={task ? `Submitted by ${task.person_name || "—"}` : ""}
      headerVariant="form"
      maxWidth="max-w-2xl"
      footer={
        task ? (
          <>
            <button
              type="button"
              onClick={handleReject}
              disabled={saving}
              className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5"><X size={14} /> Reject</span>
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={saving}
              className="flex-1 sm:flex-none min-w-[150px] px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-60 shadow-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} />
                {saving ? "Saving…" : scoringOn ? `Approve · Score ${score}` : "Approve"}
              </span>
            </button>
          </>
        ) : null
      }
    >
      {task && (
        <div className="space-y-4 pb-6">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:p-4 space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">{task.title}</h3>
            {task.description && (
              <div className="text-sm text-slate-600 leading-relaxed">
                <RichTextDisplay value={task.description} />
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><User size={11} /> {task.person_name}</span>
              <span className="inline-flex items-center gap-1"><Calendar size={11} /> {task.scheduled_date}</span>
              <span className="inline-flex items-center gap-1"><Clock size={11} /> Submitted {formatDateTime(task.submitted_at)}</span>
            </div>
            {task.reject_count > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertTriangle size={13} /> Previously rejected {task.reject_count} time(s)
              </p>
            )}
          </div>

          {task.sop_description && (
            <ClFormSection title="SOP Reference">
              <RichTextDisplay value={task.sop_description} />
            </ClFormSection>
          )}

          {task.person_remark && (
            <ClFormSection title="Person Remark">
              <p className="text-sm text-slate-700">{task.person_remark}</p>
            </ClFormSection>
          )}

          {parseFormSchema(task.form_schema).length > 0 && (
            <ClFormSection title="Submitted Form Entries">
              <ClTaskFormEntriesHeader count={normalizeToEntries(task.form_responses).length} />
              <div className="mt-3">
                <ClTaskFormEntriesView schema={task.form_schema} formResponses={task.form_responses} />
              </div>
            </ClFormSection>
          )}

          {scoringOn && (
            <ClFormSection title="Score Task (1–10)">
              <ClFormLabel required>Your Score</ClFormLabel>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {SCORES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setScore(n); setError(""); }}
                    className={`py-2.5 rounded-lg text-sm font-bold border transition-all ${
                      score === n
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-amber-700 mt-2 font-medium">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                Selected score: {score}/10
              </p>
            </ClFormSection>
          )}

          <ClFormSection title="Verifier Remark">
            <ClFormLabel>{scoringOn ? "Remark (optional for approve)" : "Remark"}</ClFormLabel>
            <textarea
              className={`${inputBase} min-h-[80px] resize-y`}
              value={remark}
              onChange={(e) => { setRemark(e.target.value); setError(""); }}
              placeholder="Feedback for the person…"
              rows={3}
            />
            <ClFormError msg={error} />
          </ClFormSection>
        </div>
      )}
    </Drawer>
  );
}
