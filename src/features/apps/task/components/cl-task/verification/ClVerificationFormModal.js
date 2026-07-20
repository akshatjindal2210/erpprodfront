"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { User, Calendar, Clock, AlertTriangle, Star, Shield, Save, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { clTaskService } from "@/features/apps/task/services/clTaskApi";
import { parseFormSchema, newFormEntry, validateEntryValues, normalizeToEntries, stripHtml } from "@/features/apps/task/helpers/clTaskFormHelper";
import { formatDateTime, formatScheduledDate } from "@/features/apps/task/helpers/utilHelper";
import { formatStoredScoreAsPercent, scoreToPercent } from "@/features/apps/task/helpers/clTaskScoreHelper";
import ClTaskCustomFieldRenderer from "../shared/ClTaskCustomFieldRenderer";
import { ClTaskFormEntriesHeader } from "../shared/ClTaskFormEntriesView";
import ClTaskSubmissionFillsList from "../shared/ClTaskSubmissionFillsList";
import RichTextDisplay from "../../common/RichTextDisplay";
import { ClFormSection, ClFormLabel, ClFormError, inputBase } from "../shared/clTaskFormUi";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Normalize permission tokens to uppercase ADD | EDIT | APPROVE | VIEW | DELETE.
 */
function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  return permissions
    .map((p) => String(p || "").toUpperCase().trim())
    .filter(Boolean);
}

/**
 * Single reusable CL Verification form.
 *
 * Permission rules (module cl_task_verification):
 * - VIEW    → read-only; no submit actions
 * - ADD     → score + Verify/Approve (+ Reject) — only role that can approve
 * - EDIT    → user data only (before verify); cannot approve
 * - APPROVE → update only (user + score; after verify too); cannot approve
 */
export default function ClVerificationFormModal({
  task,
  onClose,
  onSuccess,
  /** @type {string[]} e.g. ['ADD'], ['EDIT','APPROVE'], ['VIEW'] */
  permissions = ["VIEW"],
  /**
   * Report panel: show user fill + verifier data;
   * Super Admin can Update only (no Verify / Reject).
   */
  reportVariant = false,
  /** Extra fills for same Open/Frequently master (from report instance API). */
  siblingFills: siblingFillsProp = [],
  /** Switch to another fill (report) — parent reloads that instance_id. */
  onSwitchFill,
}) {
  const [values, setValues] = useState({});
  const [formEntries, setFormEntries] = useState([]);
  const [personRemark, setPersonRemark] = useState("");
  const [verifierRemark, setVerifierRemark] = useState("");
  const [score, setScore] = useState(5);
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  /** When rejecting: also create a red ticket from remark + score. */
  const [createAsRedTicket, setCreateAsRedTicket] = useState(false);
  const [loadedSubmissionFills, setLoadedSubmissionFills] = useState([]);

  const schema = parseFormSchema(task?.form_schema);
  const isOpen = !!task;
  const scoringOn = task?.verification_required !== false;
  const isCompleted = task?.status === "completed";
  const awaiting = task?.status === "awaiting_verification";
  const fillableStatus = ["pending", "awaiting_verification"].includes(task?.status);
  const siblingFills = Array.isArray(task?.sibling_fills)
    ? task.sibling_fills
    : Array.isArray(siblingFillsProp)
      ? siblingFillsProp
      : [];
  const masterId = task?.cl_task_id != null ? Number(task.cl_task_id) : null;
  const sameTaskOnly = (fills) =>
    (Array.isArray(fills) ? fills : []).filter((f) => {
      if (masterId == null) return false;
      return Number(f.cl_task_id) === masterId;
    });
  const submissionFills = sameTaskOnly(
    loadedSubmissionFills.length > 0
      ? loadedSubmissionFills
      : Array.isArray(task?.submission_fills) && task.submission_fills.length
        ? task.submission_fills
        : siblingFills,
  );
  const fillCount =
    submissionFills.length > 0
      ? submissionFills.length
      : task?.fill_count != null
        ? Number(task.fill_count)
        : 1;

  const caps = useMemo(() => {
    const perms = normalizePermissions(permissions);
    const hasAdd = perms.includes("ADD");
    const hasEdit = perms.includes("EDIT");
    const hasApprove = perms.includes("APPROVE");
    const hasWrite = hasAdd || hasEdit || hasApprove;
    const viewOnly = !hasWrite;

    if (reportVariant) {
      const canUpdate = hasEdit || hasApprove;
      return {
        viewOnly: !canUpdate,
        userEditable: canUpdate,
        scoringEditable: canUpdate,
        showVerifyApprove: false,
        showUpdate: canUpdate,
        hasAdd,
        hasEdit,
        hasApprove,
      };
    }

    /**
     * User form:
     * - EDIT → only before verify
     * - APPROVE → before verify AND after completed
     */
    const userEditable =
      !viewOnly &&
      ((hasApprove && (fillableStatus || isCompleted)) || (hasEdit && fillableStatus));

    /**
     * Score / weightage:
     * - ADD → while awaiting (for Verify)
     * - APPROVE → before and after verify (update only)
     * - EDIT → never (user data only)
     */
    const scoringEditable =
      !viewOnly &&
      ((hasApprove && (fillableStatus || isCompleted || awaiting)) || (hasAdd && awaiting));

    /** Only ADD can approve / reject — never EDIT or APPROVE permission. */
    const showVerifyApprove = !viewOnly && hasAdd && awaiting;
    /** EDIT / APPROVE: save without approving (including post-verify for APPROVE). */
    const showUpdate =
      !viewOnly && (hasEdit || hasApprove) && (userEditable || scoringEditable);

    return {
      viewOnly,
      userEditable,
      scoringEditable,
      showVerifyApprove,
      showUpdate,
      hasAdd,
      hasEdit,
      hasApprove,
    };
  }, [permissions, fillableStatus, awaiting, isCompleted, reportVariant]);

  const {
    viewOnly,
    userEditable,
    scoringEditable,
    showVerifyApprove,
    showUpdate,
  } = caps;

  const showScoringSection =
    scoringEditable ||
    showVerifyApprove ||
    isCompleted ||
    task?.verifier_remark ||
    task?.score != null ||
    reportVariant;

  useEffect(() => {
    if (!task) return;
    const loaded = normalizeToEntries(task.form_responses);
    setFormEntries(
      loaded.length
        ? loaded.map((e) => ({
            id: e.id,
            filled_at: e.filled_at,
            responses: { ...(e.responses || {}) },
          }))
        : [],
    );
    setValues(loaded[0]?.responses ? { ...loaded[0].responses } : {});
    setPersonRemark(task.person_remark || "");
    setVerifierRemark(task.verifier_remark || "");
    setScore(Number(task.score) > 0 ? Number(task.score) : 5);
    setEditNote(task.edit_note || "");
    setFieldError("");
    setVerifyError("");
    setCreateAsRedTicket(false);
  }, [task?.instance_id]);

  useEffect(() => {
    if (!task?.instance_id && !task?.cl_task_id) {
      setLoadedSubmissionFills([]);
      return;
    }
    setLoadedSubmissionFills([]);
    const masterId = Number(task.cl_task_id);
    const pickSameTask = (fills) =>
      (fills || []).filter((f) => masterId && Number(f.cl_task_id) === masterId);

    if (Array.isArray(task?.submission_fills) && task.submission_fills.length) {
      setLoadedSubmissionFills(pickSameTask(task.submission_fills));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = task.instance_id
          ? { instance_id: task.instance_id }
          : { cl_task_id: task.cl_task_id, person_id: task.person_id };
        const res = await clTaskService.getInstance(params);
        if (!cancelled) {
          setLoadedSubmissionFills(pickSameTask(res?.data?.data?.submission_fills || []));
        }
      } catch {
        if (!cancelled) setLoadedSubmissionFills([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [task?.instance_id, task?.cl_task_id, task?.person_id]);

  const plainDesc = stripHtml(task?.description);

  const updateEntryResponses = useCallback((idx, nextResponses) => {
    setFormEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, responses: nextResponses } : e)),
    );
    if (idx === 0) setValues(nextResponses);
  }, []);

  const buildUserFormData = useCallback(() => {
    const sourceEntries =
      formEntries.length > 0
        ? formEntries
        : schema.length
          ? [newFormEntry({ ...values })]
          : [];
    const finalEntries = sourceEntries.map((e) => ({
      id: e.id || newFormEntry().id,
      filled_at: e.filled_at || new Date().toISOString(),
      responses: e.responses || {},
    }));
    const fd = new FormData();
    const serializableEntries = finalEntries.map((e) => ({
      id: e.id,
      filled_at: e.filled_at,
      responses: Object.fromEntries(
        Object.entries(e.responses || {})
          .map(([k, v]) => {
            if (v instanceof File) return [k, null];
            if (Array.isArray(v)) return [k, v.filter((item) => !(item instanceof File))];
            return [k, v];
          })
          .filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)),
      ),
    }));
    fd.append("form_responses", JSON.stringify({ entries: serializableEntries }));
    fd.append("person_remark", personRemark || "");
    if (editNote) fd.append("edit_note", editNote);
    /** Keep completed after authorize post-verify edits; otherwise stay / return to awaiting. */
    fd.append(
      "resubmit_for_verification",
      task?.status === "completed" ? "false" : "true",
    );

    finalEntries.forEach((entry, idx) => {
      for (const field of schema) {
        if (field.type !== "attachment") continue;
        const val = entry.responses?.[field.id];
        const files = Array.isArray(val) ? val : val ? [val] : [];
        files.forEach((f) => {
          if (f instanceof File) fd.append(`e${idx}__${field.id}`, f);
        });
      }
    });
    return fd;
  }, [schema, formEntries, values, personRemark, editNote, task?.status]);

  const validateUserFill = useCallback(() => {
    if (!userEditable || !schema.length) return true;
    const list =
      formEntries.length > 0
        ? formEntries
        : [{ responses: values }];
    if (!list.length) {
      setFieldError("At least one form entry is required");
      toast.error("At least one form entry is required");
      return false;
    }
    for (let i = 0; i < list.length; i += 1) {
      const err = validateEntryValues(schema, list[i].responses || {});
      if (err) {
        const msg = list.length > 1 ? `Entry #${i + 1}: ${err}` : err;
        setFieldError(msg);
        toast.error(msg);
        return false;
      }
    }
    setFieldError("");
    return true;
  }, [userEditable, schema, formEntries, values]);

  const validateScoring = useCallback(
    ({ requireRemark = false, forRedTicket = false } = {}) => {
      if (!scoringEditable && !showVerifyApprove) return true;
      if ((scoringOn || forRedTicket) && (score < 1 || score > 10)) {
        setVerifyError(
          forRedTicket
            ? "Select a score (1–10) for the red ticket penalty"
            : "Select a score between 1 and 10",
        );
        return false;
      }
      if (requireRemark && !verifierRemark.trim()) {
        setVerifyError("Remark is required when rejecting");
        return false;
      }
      setVerifyError("");
      return true;
    },
    [scoringEditable, showVerifyApprove, scoringOn, score, verifierRemark],
  );

  const saveUserFill = useCallback(async () => {
    if (!task || !userEditable) return;
    if (!validateUserFill()) throw new Error("validation");
    await clTaskService.updateSubmission(task.instance_id, buildUserFormData());
  }, [task, userEditable, validateUserFill, buildUserFormData]);

  const saveScoring = useCallback(async () => {
    if (!task || !scoringEditable) return;
    if (!validateScoring()) throw new Error("validation");
    await clTaskService.updateVerificationReview(task.instance_id, {
      score: scoringOn ? score : null,
      verifier_remark: verifierRemark.trim() || null,
    });
  }, [task, scoringEditable, validateScoring, scoringOn, score, verifierRemark]);

  const handleUpdate = useCallback(async () => {
    if (!task || !showUpdate) return;
    setSaving(true);
    try {
      if (userEditable) await saveUserFill();
      if (scoringEditable) await saveScoring();
      toast.success("Updated successfully");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      if (err?.message !== "validation") {
        toast.error(err.response?.data?.message || "Failed to update");
      }
    } finally {
      setSaving(false);
    }
  }, [
    task,
    showUpdate,
    userEditable,
    scoringEditable,
    saveUserFill,
    saveScoring,
    onSuccess,
    onClose,
  ]);

  const runApprove = useCallback(
    async ({ action, successMsg, createRedTicket = false }) => {
      if (!task) return;
      if (userEditable && !validateUserFill()) return;
      if (
        !validateScoring({
          requireRemark: action === "reject",
          forRedTicket: action === "reject" && createRedTicket,
        })
      ) {
        return;
      }

      setSaving(true);
      try {
        if (userEditable) await saveUserFill();
        await clTaskService.verify(task.instance_id, {
          action,
          score:
            action === "approve" && scoringOn
              ? score
              : action === "reject" && createRedTicket
                ? score
                : undefined,
          verifier_remark:
            action === "reject"
              ? verifierRemark.trim()
              : verifierRemark.trim() || null,
          create_red_ticket: action === "reject" ? !!createRedTicket : undefined,
          fill_id: task.fill_id || undefined,
        });
        toast.success(successMsg);
        onSuccess?.();
        onClose?.();
      } catch (err) {
        toast.error(err.response?.data?.message || `Failed to ${action}`);
      } finally {
        setSaving(false);
      }
    },
    [
      task,
      userEditable,
      validateUserFill,
      validateScoring,
      saveUserFill,
      scoringOn,
      score,
      verifierRemark,
      onSuccess,
      onClose,
    ],
  );

  const handleVerifyApprove = useCallback(() => {
    if (!showVerifyApprove || createAsRedTicket) return;
    runApprove({
      action: "approve",
      successMsg: scoringOn
        ? `Verified · ${scoreToPercent(score)}%`
        : "Verified",
    });
  }, [showVerifyApprove, createAsRedTicket, runApprove, scoringOn, score]);

  const handleReject = useCallback(() => {
    if (!showVerifyApprove) return;
    runApprove({
      action: "reject",
      createRedTicket: createAsRedTicket,
      successMsg: createAsRedTicket
        ? "Rejected — red ticket created; task sent back for refill"
        : "Rejected — sent back to person",
    });
  }, [showVerifyApprove, runApprove, createAsRedTicket]);

  const title = reportVariant
    ? viewOnly
      ? "View CL Task Report"
      : "Update CL Task Report"
    : viewOnly
      ? "View CL Task"
      : showVerifyApprove
        ? "Verify CL Task"
        : isCompleted
          ? "Update Verified CL Task"
          : "Update CL Task";

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={
        task
          ? `${task.title || ""} · ${task.person_name || "—"} · Verifier ${task.verification_user_name || "—"}${
              reportVariant && fillCount > 1 ? ` · ${fillCount} fills` : ""
            }`
          : ""
      }
      headerVariant="form"
      maxWidth="max-w-2xl"
      closeOnOutside={false}
      footer={
        task ? (
          viewOnly ? (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-500"
            >
              Close
            </button>
          ) : (
            <div className="flex items-center justify-end gap-2 w-full flex-wrap">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              {showUpdate ? (
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={saving}
                  className="px-4 py-2.5 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Save size={15} />
                  {saving ? "Saving…" : "Update"}
                </button>
              ) : null}
              {showVerifyApprove ? (
                <>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={saving}
                    className="px-4 py-2.5 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 disabled:opacity-50"
                  >
                    {createAsRedTicket ? "Reject + Red Ticket" : "Reject"}
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyApprove}
                    disabled={saving || createAsRedTicket}
                    title={
                      createAsRedTicket
                        ? "Approve disabled — Create as Red Ticket only allows Reject"
                        : undefined
                    }
                    className="min-w-[140px] px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 size={16} />
                    {saving
                      ? "Saving…"
                      : scoringOn
                        ? `Verify/Approve · ${scoreToPercent(score)}%`
                        : "Verify/Approve"}
                  </button>
                </>
              ) : null}
            </div>
          )
        ) : null
      }
    >
      {task && (
        <div className="space-y-4 pb-6">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:p-4 space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">{task.title}</h3>
            {plainDesc ? (
              <div className="text-sm text-slate-600 leading-relaxed">
                <RichTextDisplay value={task.description} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <User size={11} /> {task.person_name || "—"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar size={11} /> {formatScheduledDate(task.scheduled_date)}
              </span>
              {task.submitted_at ? (
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} /> Submitted {formatDateTime(task.submitted_at)}
                </span>
              ) : null}
              {task.score != null && isCompleted ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                  <Star size={11} className="fill-amber-400 text-amber-400" />{" "}
                  {formatStoredScoreAsPercent(task.score)}
                </span>
              ) : null}
              {task.weightage != null || task.wastage != null ? (
                <span className="inline-flex items-center gap-1 font-bold text-slate-600">
                  Weightage {task.weightage ?? task.wastage}
                </span>
              ) : null}
              {reportVariant && fillCount > 1 ? (
                <span className="inline-flex items-center gap-1 font-bold text-indigo-700">
                  {fillCount} fills total
                </span>
              ) : null}
            </div>
            {task.reject_count > 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertTriangle size={13} /> Rejected {task.reject_count} time(s)
              </p>
            ) : null}
          </div>

          {task.sop_description ? (
            <ClFormSection title="SOP">
              <RichTextDisplay value={task.sop_description} />
            </ClFormSection>
          ) : null}

          {schema.length > 0 ? (
            <ClFormSection
              title={
                formEntries.length > 1
                  ? `User form details (${formEntries.length} entries)`
                  : "User form details"
              }
            >
              {formEntries.length > 1 ? (
                <div className="space-y-3">
                  {formEntries.map((entry, idx) => (
                    <div
                      key={entry.id || `entry-${idx}`}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100">
                        <span className="shrink-0 w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700">Entry #{idx + 1}</p>
                          {entry.filled_at ? (
                            <p className="text-[11px] text-slate-400">
                              {formatDateTime(entry.filled_at)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="p-3">
                        <ClTaskCustomFieldRenderer
                          schema={schema}
                          values={entry.responses || {}}
                          onChange={
                            userEditable
                              ? (next) => updateEntryResponses(idx, next)
                              : undefined
                          }
                          readOnly={!userEditable}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ClTaskCustomFieldRenderer
                  schema={schema}
                  values={formEntries[0]?.responses || values}
                  onChange={
                    userEditable
                      ? (next) => {
                          if (formEntries.length) updateEntryResponses(0, next);
                          else setValues(next);
                        }
                      : undefined
                  }
                  readOnly={!userEditable}
                />
              )}
              {fieldError ? <p className="text-xs text-rose-600 mt-2">{fieldError}</p> : null}
            </ClFormSection>
          ) : null}

          {submissionFills.length > 1 ? (
            <>
              {reportVariant ? <ClTaskFormEntriesHeader count={fillCount} /> : null}
              <ClTaskSubmissionFillsList
                fills={submissionFills}
                schema={schema}
                clTaskId={task.cl_task_id}
                personId={task.person_id}
                currentInstanceId={task.instance_id}
                excludeCurrent
                defaultCollapsed
                title="Other submits for this task"
                onOpenFill={
                  typeof onSwitchFill === "function"
                    ? (fill) =>
                        onSwitchFill({
                          instance_id: fill.instance_id,
                          title: fill.title || task?.title,
                          scheduled_date: fill.scheduled_date,
                        })
                    : undefined
                }
              />
            </>
          ) : null}

          <ClFormSection title="User remark">
            <textarea
              className={`${inputBase} min-h-[72px] resize-y`}
              rows={3}
              value={personRemark}
              disabled={!userEditable}
              onChange={(e) => setPersonRemark(e.target.value)}
              placeholder="Assignee / user note"
            />
          </ClFormSection>

          {showScoringSection ? (
            <>
              {(scoringEditable || showVerifyApprove) && scoringOn ? (
                <ClFormSection title="Scoring (1–10 → %)">
                  <ClFormLabel required={showVerifyApprove}>
                    Score ({scoreToPercent(score)}%)
                  </ClFormLabel>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {SCORES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={!scoringEditable}
                        onClick={() => {
                          setScore(n);
                          setVerifyError("");
                        }}
                        className={`py-2.5 rounded-lg text-sm font-bold border transition-all disabled:opacity-50 ${
                          score === n
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
                        }`}
                        title={`${scoreToPercent(n)}%`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Stored as 1–10 · shown as {scoreToPercent(score)}%
                    {(task.weightage != null || task.wastage != null)
                      ? ` · task weightage ${task.weightage ?? task.wastage}`
                      : ""}
                  </p>
                </ClFormSection>
              ) : scoringOn ? (
                <ClFormSection title="Scoring">
                  <p className="text-sm font-bold text-amber-700 inline-flex items-center gap-1.5">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    {formatStoredScoreAsPercent(task.score)}
                  </p>
                  {(task.weightage != null || task.wastage != null) && (
                    <p className="text-xs text-slate-500 mt-1">
                      Task weightage {task.weightage ?? task.wastage}/10
                    </p>
                  )}
                </ClFormSection>
              ) : showVerifyApprove && createAsRedTicket ? (
                <ClFormSection title="Red ticket penalty score (1–10)">
                  <ClFormLabel required>Score / penalty</ClFormLabel>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {SCORES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setScore(n);
                          setVerifyError("");
                        }}
                        className={`py-2.5 rounded-lg text-sm font-bold border transition-all ${
                          score === n
                            ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-rose-300"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </ClFormSection>
              ) : null}

              <ClFormSection title="Verifier remark">
                <ClFormLabel required={showVerifyApprove && !scoringOn}>
                  {showVerifyApprove ? "Remark (required for Reject)" : "Remark"}
                </ClFormLabel>
                <textarea
                  className={`${inputBase} min-h-[72px] resize-y`}
                  rows={3}
                  value={verifierRemark}
                  disabled={!scoringEditable}
                  onChange={(e) => {
                    setVerifierRemark(e.target.value);
                    setVerifyError("");
                  }}
                  placeholder="Verification person feedback"
                />
                {showVerifyApprove ? (
                  <label className="mt-3 flex items-start gap-2.5 cursor-pointer select-none rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-rose-600"
                      checked={createAsRedTicket}
                      onChange={(e) => {
                        setCreateAsRedTicket(e.target.checked);
                        setVerifyError("");
                      }}
                    />
                    <span className="text-sm text-rose-900 leading-snug">
                      <span className="font-bold">Create as Red Ticket</span>
                      <span className="block text-[11px] text-rose-700/90 mt-0.5">
                        On reject only: creates a red ticket with this remark + score as MIS penalty.
                        Approve is disabled while this is checked.
                      </span>
                    </span>
                  </label>
                ) : null}
                <ClFormError msg={verifyError} />
              </ClFormSection>
            </>
          ) : null}

          {userEditable ? (
            <div>
              <ClFormLabel>Edit note (optional)</ClFormLabel>
              <input
                className={inputBase}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Why was user data corrected?"
              />
            </div>
          ) : null}

        </div>
      )}
    </Drawer>
  );
}
