import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, Clock, AlertTriangle, ListChecks, Zap, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { clTaskService } from "@/apps/task/lib/services/clTaskApi";
import { parseFormSchema, newFormEntry, validateEntryValues, getFormFieldsSummary, stripHtml, normalizeToEntries } from "@/apps/task/lib/helpers/clTaskFormHelper";
import { formatDueTimeLabel, getClTaskFillBlockedReasonClient, isBeforeDueTime } from "@/apps/task/lib/helpers/clTaskTimeHelper";
import ClTaskCustomFieldRenderer from "../shared/ClTaskCustomFieldRenderer";
import ClTaskSubmissionFillsList from "../shared/ClTaskSubmissionFillsList";
import RichTextDisplay from "../../../lib/ui/common/RichTextDisplay";
import ClTaskAttachmentsField from "../shared/ClTaskAttachmentBlock";
import { ClFormSection, textareaBase } from "../shared/clTaskFormUi";

export default function ClTaskSubmitModal({ task, onClose, onSuccess }) {
  const [values, setValues] = useState({});
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [submissionFills, setSubmissionFills] = useState([]);

  useEffect(() => {
    if (!task) return;
    const entries = normalizeToEntries(task.form_responses);
    const first = entries[0]?.responses || {};
    setValues(Object.keys(first).length ? { ...first } : {});
    setRemark(task.person_remark || "");
    setFieldError("");
  }, [task?.instance_id, task?.cl_task_id]);

  useEffect(() => {
    if (!task?.cl_task_id) {
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

  const schema = parseFormSchema(task?.form_schema);
  const isOpen = !!task;
  const isOpenType = task?.task_type === "open";
  const isFrequent = task?.task_type === "frequently";
  const formSummary = useMemo(() => getFormFieldsSummary(task?.form_schema), [task?.form_schema]);
  const plainDesc = stripHtml(task?.description);
  const fillBlocked = task ? getClTaskFillBlockedReasonClient(task) : null;

  const handleSave = useCallback(async () => {
    if (!task) return;

    if (fillBlocked) {
      toast.error(fillBlocked);
      return;
    }

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
      if (remark) fd.append("person_remark", remark);

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

      // Open from Task Master Due: submit by cl_task_id (creates CL instance).
      // Rejected open / frequently: submit existing instance_id.
      if (task.instance_id) {
        await clTaskService.submit(task.instance_id, fd);
      } else if (task.cl_task_id) {
        fd.append("cl_task_id", String(task.cl_task_id));
        await clTaskService.submit(null, fd);
      } else {
        throw new Error("Missing task id");
      }

      if (isOpenType) {
        toast.success(
          task.verification_required === false
            ? "Submitted · Open task stays on Due for another fill anytime today"
            : "Submitted for verification · Open task stays on Due for another fill",
        );
      } else {
        toast.success(
          task.verification_required === false
            ? "Completed · this cycle is locked"
            : "Submitted · open Submitted Logs to correct while awaiting verification",
        );
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit");
    } finally {
      setSaving(false);
    }
  }, [task, schema, values, remark, fillBlocked, isOpenType, onClose, onSuccess]);

  const saveLabel = schema.length ? "Submit Task" : "Mark Complete";

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={fillBlocked ? undefined : handleSave}
      closeOnOutside={false}
      title={task?.title || "Complete Task"}
      description={
        isOpenType
          ? "Fill required fields (*) then Submit. You can fill again anytime today."
          : isFrequent
            ? `Fill required fields (*) then Submit once before ${formatDueTimeLabel(task?.due_time) || "due time"}.`
            : "Fill required fields (*) then Submit."
      }
      headerVariant="form"
      maxWidth="max-w-3xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !!fillBlocked}
            className="flex-1 sm:flex-none min-w-[160px] h-11 px-5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-60 shadow-md shadow-indigo-200 inline-flex items-center justify-center gap-2"
          >
            {saving ? (
              "Submitting…"
            ) : (
              <>
                <CheckCircle2 size={16} />
                {saveLabel}
              </>
            )}
          </button>
        </>
      }
    >
      {task && (
        <div className="space-y-4 pb-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                <Calendar size={12} className="text-indigo-500" />
                {task.scheduled_date}
              </span>
              {isFrequent && task.due_time ? (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                    isBeforeDueTime(task.due_time)
                      ? "bg-amber-50 border-amber-100 text-amber-800"
                      : "bg-rose-50 border-rose-100 text-rose-700"
                  }`}
                >
                  <Clock size={12} />
                  Fill before {formatDueTimeLabel(task.due_time)}
                  {!isBeforeDueTime(task.due_time) ? " · closed" : ""}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[11px] font-semibold text-amber-800">
                <Zap size={12} />
                Weightage {task.weightage ?? task.wastage ?? "—"}/10
              </span>
              {task.verification_required !== false ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-700">
                  <ShieldCheck size={12} />
                  Verification required
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 text-[11px] font-semibold text-sky-700">
                <ListChecks size={12} />
                {isOpenType ? "Open · multiple fills" : "Frequently · one fill"}
              </span>
            </div>

            {fillBlocked ? (
              <p className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                <AlertTriangle size={13} /> {fillBlocked}
              </p>
            ) : null}

            {plainDesc ? (
              <div className="text-sm text-slate-700 leading-relaxed break-words">
                <RichTextDisplay value={task.description} />
              </div>
            ) : null}

            <ClTaskAttachmentsField value={task.attachment} readOnly label="Attachments" />

            {task.reject_count > 0 ? (
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
                  <AlertTriangle size={13} /> Rejected {task.reject_count}{" "}
                  {Number(task.reject_count) === 1 ? "time" : "times"} — please redo
                </p>
                {task.verifier_remark ? (
                  <p className="text-[11px] text-rose-700/90 leading-snug pl-5">
                    <span className="font-bold">Reason: </span>
                    {task.verifier_remark}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {submissionFills.length > 0 ? (
            <ClTaskSubmissionFillsList
              fills={submissionFills}
              schema={schema}
              clTaskId={task.cl_task_id}
              personId={task.person_id}
              currentInstanceId={task.instance_id}
              defaultCollapsed={false}
              title="Previous submits"
              emptyLabel="No previous submissions"
            />
          ) : null}

          {task.sop_description ? (
            <ClFormSection title="SOP — Follow These Steps">
              <RichTextDisplay value={task.sop_description} />
            </ClFormSection>
          ) : null}

          {schema.length > 0 ? (
            <ClFormSection title="Fill Form">
              <p className="text-xs text-slate-500 mb-3 -mt-1">
                {formSummary.total} field{formSummary.total === 1 ? "" : "s"}
                {formSummary.requiredCount > 0
                  ? ` · ${formSummary.requiredCount} required (*)`
                  : ""}
              </p>
              <ClTaskCustomFieldRenderer
                schema={task.form_schema}
                values={values}
                onChange={(next) => {
                  setValues(next);
                  if (fieldError) setFieldError("");
                }}
              />
              {fieldError ? (
                <p className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1">
                  <AlertTriangle size={12} /> {fieldError}
                </p>
              ) : null}
            </ClFormSection>
          ) : (
            <ClFormSection title="Confirm Completion">
              <div className="text-center py-6 px-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={22} className="text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No form fields on this task</p>
                <p className="text-xs text-slate-400 mt-1">Tap Mark Complete to finish.</p>
              </div>
            </ClFormSection>
          )}

          <ClFormSection title="Your Remark">
            <textarea
              className={textareaBase}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Any notes for the verifier…"
              rows={2}
            />
          </ClFormSection>
        </div>
      )}
    </Drawer>
  );
}
