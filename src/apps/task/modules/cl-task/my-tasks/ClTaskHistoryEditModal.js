import { useState, useEffect, useCallback } from "react";
import { User, Calendar, Clock, AlertTriangle, Save } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { clTaskService } from "@/apps/task/lib/services/clTaskApi";
import { parseFormSchema, newFormEntry, validateEntryValues, normalizeToEntries, stripHtml } from "@/apps/task/lib/helpers/clTaskFormHelper";
import { formatDateTime, formatScheduledDate } from "@/apps/task/lib/helpers/utilHelper";
import ClTaskCustomFieldRenderer from "../shared/ClTaskCustomFieldRenderer";
import ClTaskSubmissionFillsList from "../shared/ClTaskSubmissionFillsList";
import RichTextDisplay from "../../../lib/ui/common/RichTextDisplay";
import { ClFormSection, ClFormLabel, inputBase, textareaBase } from "../shared/clTaskFormUi";

export default function ClTaskHistoryEditModal({ task, onClose, onSuccess, viewOnly = false }) {
  const [values, setValues] = useState({});
  const [personRemark, setPersonRemark] = useState("");
  const [verifierRemark, setVerifierRemark] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [submissionFills, setSubmissionFills] = useState([]);

  const schema = parseFormSchema(task?.form_schema);
  const isOpen = !!task;
  const readOnlyCompleted = viewOnly || !!task?._viewOnly || task?.status === "completed";

  useEffect(() => {
    if (!task) return;
    const entries = normalizeToEntries(task.form_responses);
    const first = entries[0]?.responses || {};
    setValues({ ...first });
    setPersonRemark(task.person_remark || "");
    setVerifierRemark(task.verifier_remark || "");
    setEditNote(task.edit_note || "");
    setFieldError("");
  }, [task?.instance_id]);

  useEffect(() => {
    if (!task) {
      setSubmissionFills([]);
      return;
    }
    setSubmissionFills([]);
    let cancelled = false;
    (async () => {
      try {
        const params = task.instance_id
          ? { instance_id: task.instance_id }
          : { cl_task_id: task.cl_task_id, person_id: task.person_id };
        if (!params.instance_id && !params.cl_task_id) return;
        const res = await clTaskService.getInstance(params);
        if (!cancelled) {
          const fills = res?.data?.data?.submission_fills || [];
          const masterId = Number(task.cl_task_id);
          setSubmissionFills(
            fills.filter((f) => masterId && Number(f.cl_task_id) === masterId),
          );
        }
      } catch {
        if (!cancelled) setSubmissionFills([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [task?.instance_id, task?.cl_task_id, task?.person_id]);

  const plainDesc = stripHtml(task?.description);

  const handleSave = useCallback(async () => {
    if (!task || readOnlyCompleted) return;

    if (schema.length > 0) {
      const err = validateEntryValues(schema, values);
      if (err) {
        setFieldError(err);
        toast.error(err);
        return;
      }
    }
    setFieldError("");

    const finalEntries = schema.length ? [newFormEntry({ ...values })] : [];
    setSaving(true);
    try {
      const fd = new FormData();
      const serializableEntries = finalEntries.map((e) => ({
        id: e.id,
        filled_at: e.filled_at,
        responses: Object.fromEntries(
          Object.entries(e.responses || {}).map(([k, v]) => {
            if (v instanceof File) return [k, null];
            if (Array.isArray(v)) {
              return [k, v.filter((item) => !(item instanceof File))];
            }
            return [k, v];
          }).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)),
        ),
      }));
      fd.append("form_responses", JSON.stringify({ entries: serializableEntries }));
      fd.append("person_remark", personRemark || "");
      fd.append("verifier_remark", verifierRemark || "");
      if (editNote) fd.append("edit_note", editNote);
      fd.append("resubmit_for_verification", "true");

      finalEntries.forEach((entry, idx) => {
        for (const field of schema) {
          if (field.type !== "attachment") continue;
          const val = entry.responses?.[field.id];
          const files = Array.isArray(val) ? val : (val ? [val] : []);
          files.forEach((f) => {
            if (f instanceof File) fd.append(`e${idx}__${field.id}`, f);
          });
        }
      });

      await clTaskService.updateSubmission(task.instance_id, fd);
      toast.success("Submission corrected — pending verification");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update submission");
    } finally {
      setSaving(false);
    }
  }, [
    task,
    schema,
    values,
    personRemark,
    verifierRemark,
    editNote,
    readOnlyCompleted,
    onClose,
    onSuccess,
  ]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={readOnlyCompleted ? "Submitted Task (View)" : "Correct Submission"}
      description={
        task
          ? `${task.title || ""} · Assignee ${task.person_name || "—"} · Verifier ${task.verification_user_name || "—"}`
          : ""
      }
      headerVariant="form"
      maxWidth="max-w-2xl"
      footer={
        task ? (
          readOnlyCompleted ? (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-500"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none min-w-[160px] px-5 py-2.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl disabled:opacity-60 shadow-sm inline-flex items-center justify-center gap-1.5"
              >
                <Save size={14} />
                {saving ? "Saving…" : "Save Corrections"}
              </button>
            </>
          )
        ) : null
      }
    >
      {task && (
        <div className="space-y-4 pb-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">{task.title}</h3>
            {plainDesc ? (
              <div className="text-sm text-slate-600 leading-relaxed">
                <RichTextDisplay value={task.description} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><User size={11} /> {task.person_name || "—"}</span>
              <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatScheduledDate(task.scheduled_date)}</span>
              {task.submitted_at ? (
                <span className="inline-flex items-center gap-1"><Clock size={11} /> Submitted {formatDateTime(task.submitted_at)}</span>
              ) : null}
            </div>
            {task.reject_count > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertTriangle size={13} /> Rejected {task.reject_count}{" "}
                {Number(task.reject_count) === 1 ? "time" : "times"}
                {task.verifier_remark ? ` — ${task.verifier_remark}` : ""}
              </p>
            )}
            {task.last_edited_by_name ? (
              <p className="text-[11px] text-slate-500">
                Last edited by {task.last_edited_by_name}
                {task.last_edited_at ? ` · ${formatDateTime(task.last_edited_at)}` : ""}
              </p>
            ) : null}
          </div>

            <ClFormSection title={schema.length > 0 ? "Form answers" : "Details"}>
              {schema.length > 0 ? (
                <>
                  <p className="text-xs text-slate-500 mb-3 -mt-1">
                    {readOnlyCompleted
                      ? "Submitted answers (read-only)."
                      : "Update answers below, then save."}
                  </p>
                  <ClTaskCustomFieldRenderer
                    schema={schema}
                    values={values}
                    onChange={readOnlyCompleted ? undefined : setValues}
                    readOnly={readOnlyCompleted}
                  />
                  {fieldError ? <p className="text-xs text-rose-600 mt-2">{fieldError}</p> : null}
                </>
              ) : (
                <p className="text-xs text-slate-400">No form fields on this task.</p>
              )}
            </ClFormSection>

          {submissionFills.length > 1 ? (
            <ClTaskSubmissionFillsList
              fills={submissionFills}
              schema={schema}
              clTaskId={task.cl_task_id}
              personId={task.person_id}
              currentInstanceId={task.instance_id}
              excludeCurrent
              defaultCollapsed
              title="Other submits for this task"
            />
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <ClFormLabel>Assignee note</ClFormLabel>
              <textarea
                className={textareaBase}
                rows={3}
                value={personRemark}
                disabled={readOnlyCompleted}
                onChange={(e) => setPersonRemark(e.target.value)}
                placeholder="Assignee feedback / correction note"
              />
            </div>
            <div>
              <ClFormLabel>Verifier note</ClFormLabel>
              <textarea
                className={textareaBase}
                rows={3}
                value={verifierRemark}
                disabled={readOnlyCompleted}
                onChange={(e) => setVerifierRemark(e.target.value)}
                placeholder="Verifier feedback"
              />
            </div>
          </div>

          {!readOnlyCompleted && (
            <div>
              <ClFormLabel>Edit log note</ClFormLabel>
              <input
                className={inputBase}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Why was this corrected?"
              />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
