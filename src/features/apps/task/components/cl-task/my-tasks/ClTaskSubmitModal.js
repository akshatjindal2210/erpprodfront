import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, Clock, AlertTriangle, Plus, ListChecks, Zap, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { clTaskService } from "@/features/apps/task/services/clTaskApi";
import {
  parseFormSchema,
  newFormEntry,
  validateEntryValues,
  getFormFieldsSummary,
} from "@/features/apps/task/helpers/clTaskFormHelper";
import { formatDateTime } from "@/features/apps/task/helpers/utilHelper";
import ClTaskCustomFieldRenderer from "../shared/ClTaskCustomFieldRenderer";
import ClTaskFormEntriesView from "../shared/ClTaskFormEntriesView";
import RichTextDisplay from "../../common/RichTextDisplay";
import ClTaskCardFormPreview from "../shared/ClTaskCardFormPreview";
import { ClFormSection, ClFormLabel, ClDrawerFooter, inputBase } from "../shared/clTaskFormUi";

function hasFilledValues(values) {
  return Object.keys(values).some((k) => {
    const v = values[k];
    if (v == null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
}

export default function ClTaskSubmitModal({ task, onClose, onSuccess }) {
  const [values, setValues] = useState({});
  const [entries, setEntries] = useState([]);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setValues({});
    setEntries([]);
    setRemark("");
  }, [task?.instance_id]);

  const schema = parseFormSchema(task?.form_schema);
  const isOpen = !!task;
  const formSummary = useMemo(() => getFormFieldsSummary(task?.form_schema), [task?.form_schema]);
  const draftActive = hasFilledValues(values);
  const totalOnSubmit = entries.length + (draftActive ? 1 : 0);

  const handleAddEntry = useCallback(() => {
    const err = validateEntryValues(schema, values);
    if (err) {
      toast.error(err);
      return;
    }
    const responses = { ...values };
    setEntries((prev) => [...prev, newFormEntry(responses)]);
    setValues({});
    toast.success(`Entry ${entries.length + 1} added`);
  }, [schema, values, entries.length]);

  const handleRemoveEntry = useCallback((index) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!task) return;

    let finalEntries = [...entries];

    if (schema.length > 0) {
      if (draftActive) {
        const err = validateEntryValues(schema, values);
        if (err) {
          toast.error(err);
          return;
        }
        finalEntries = [...finalEntries, newFormEntry({ ...values })];
      }
      if (finalEntries.length === 0) {
        toast.error("Fill required form fields before submitting");
        return;
      }
    }

    setSaving(true);
    try {
      const fd = new FormData();

      const serializableEntries = finalEntries.map((e) => ({
        id: e.id,
        filled_at: e.filled_at,
        responses: Object.fromEntries(
          Object.entries(e.responses || {}).filter(([, v]) => !(v instanceof File)),
        ),
      }));

      fd.append("form_responses", JSON.stringify({ entries: serializableEntries }));
      if (remark) fd.append("person_remark", remark);

      finalEntries.forEach((entry, idx) => {
        for (const field of schema) {
          if (field.type !== "attachment") continue;
          const val = entry.responses?.[field.id];
          if (val instanceof File) {
            fd.append(`e${idx}__${field.id}`, val);
          }
        }
      });

      await clTaskService.submit(task.instance_id, fd);
      toast.success(
        task.verification_required === false
          ? `Task completed · ${finalEntries.length} ${finalEntries.length === 1 ? "entry" : "entries"}`
          : `Submitted for verification · ${finalEntries.length} ${finalEntries.length === 1 ? "entry" : "entries"}`,
      );
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit");
    } finally {
      setSaving(false);
    }
  }, [task, schema, entries, values, draftActive, remark, onClose, onSuccess]);

  const saveLabel = schema.length
    ? totalOnSubmit > 0
      ? `Submit (${totalOnSubmit} ${totalOnSubmit === 1 ? "entry" : "entries"})`
      : "Submit Task"
    : "Mark Complete";

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSave}
      closeOnOutside={false}
      title={task?.title || "Complete Task"}
      description="Fill the form below and submit — add more entries only if needed"
      headerVariant="form"
      maxWidth="max-w-3xl"
      footer={
        <ClDrawerFooter
          onCancel={onClose}
          onSave={handleSave}
          saving={saving}
          saveLabel={saveLabel}
        />
      }
    >
      {task && (
        <div className="space-y-4 pb-6">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 sm:p-4 space-y-2.5">
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} className="text-indigo-500" />
                {task.scheduled_date}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} className="text-indigo-500" />
                Due {formatDateTime(task.end_date_time)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Zap size={12} className="text-amber-500" />
                Wattage {task.wastage ?? "—"}/10
              </span>
              {task.verification_required !== false && (
                <span className="inline-flex items-center gap-1 text-indigo-600">
                  <ShieldCheck size={12} />
                  Verification required
                </span>
              )}
            </div>
            {task.description && (
              <div className="text-sm text-slate-700 leading-relaxed prose-sm">
                <RichTextDisplay value={task.description} />
              </div>
            )}
            {task.reject_count > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertTriangle size={13} /> Rejected {task.reject_count}x — please redo
              </p>
            )}
            {formSummary.total > 0 && (
              <ClTaskCardFormPreview formSchema={task.form_schema} maxLabels={6} />
            )}
          </div>

          {task.sop_description && (
            <ClFormSection title="SOP — Follow These Steps">
              <RichTextDisplay value={task.sop_description} />
            </ClFormSection>
          )}

          {schema.length > 0 && (
            <>
              <ClFormSection title="Fill Form">
                {formSummary.requiredCount > 0 && (
                  <p className="text-xs text-slate-500 mb-3">
                    Fill all fields marked <span className="text-rose-500 font-bold">*</span> then tap Submit.
                    Use &quot;Add Entry&quot; only if you need multiple submissions.
                  </p>
                )}
                <ClTaskCustomFieldRenderer schema={task.form_schema} values={values} onChange={setValues} />
                <button
                  type="button"
                  onClick={handleAddEntry}
                  className="mt-3 w-full py-2 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  Add another entry (optional)
                </button>
              </ClFormSection>

              {entries.length > 0 && (
                <ClFormSection title={`Saved Entries (${entries.length})`}>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <ListChecks size={14} className="text-emerald-500" />
                    {draftActive
                      ? "Current form will be included on submit"
                      : "These entries will be submitted"}
                  </div>
                  <ClTaskFormEntriesView
                    schema={task.form_schema}
                    entries={entries}
                    onRemove={handleRemoveEntry}
                    compact
                  />
                </ClFormSection>
              )}
            </>
          )}

          {!schema.length && (
            <ClFormSection title="Confirm Completion">
              <p className="text-sm text-slate-500 text-center py-4">
                No custom fields — submit to mark this task complete.
              </p>
            </ClFormSection>
          )}

          <ClFormSection title="Your Remark">
            <ClFormLabel>Remark (optional)</ClFormLabel>
            <textarea
              className={`${inputBase} min-h-[72px] resize-y`}
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
