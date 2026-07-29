"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { User, Calendar, Clock, AlertTriangle, Star, Shield, Save, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { clTaskService } from "@/apps/task/lib/services/clTaskApi";
import { parseFormSchema, newFormEntry, validateEntryValues, normalizeToEntries, stripHtml } from "@/apps/task/lib/helpers/clTaskFormHelper";
import { formatDateTime, formatScheduledDate } from "@/apps/task/lib/helpers/utilHelper";
import { formatStoredScoreAsPercent, scoreToPercent } from "@/apps/task/lib/helpers/clTaskScoreHelper";
import ClTaskCustomFieldRenderer from "../shared/ClTaskCustomFieldRenderer";
import ClTaskSubmissionFillsList from "../shared/ClTaskSubmissionFillsList";
import RichTextDisplay from "../../../lib/ui/common/RichTextDisplay";
import { ClFormSection, ClFormLabel, ClFormError, inputBase, textareaBase } from "../shared/clTaskFormUi";

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
  /** Avoid writing default score 5 onto fills that had no score yet. */
  const [scoreTouched, setScoreTouched] = useState(false);

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
    const rawScore = Number(task.score);
    setScore(
      Number.isFinite(rawScore) && rawScore >= 1 && rawScore <= 10 ? rawScore : 5,
    );
    setScoreTouched(false);
    setEditNote(task.edit_note || "");
    setFieldError("");
    setVerifyError("");
    setCreateAsRedTicket(false);
  }, [task?.instance_id, task?.fill_id]);

  useEffect(() => {
    if (!task?.instance_id && !task?.cl_task_id) {
      setLoadedSubmissionFills([]);
      return;
    }
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

  const formSummary = useMemo(() => {
    const fields = schema.filter((f) => f.type !== "section");
    return {
      total: fields.length,
      requiredCount: fields.filter((f) => f.required).length,
    };
  }, [schema]);

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
    if (task?.fill_id != null && task.fill_id !== "") {
      fd.append("fill_id", String(task.fill_id));
    }
    /** Keep completed after authorize post-verify edits; otherwise stay / return to awaiting. */
    fd.append(
      "resubmit_for_verification",
      task?.status === "completed" || task?.fill_id ? "false" : "true",
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
  }, [schema, formEntries, values, personRemark, editNote, task?.status, task?.fill_id]);

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

    /**
     * Report + unscored fill: omit score so default UI 5 is not written.
     * Still save verifier remark.
     */
    const includeScore =
      !reportVariant ||
      scoreTouched ||
      (task.score != null && Number(task.score) >= 1) ||
      !task.fill_id;

    await clTaskService.updateVerificationReview(task.instance_id, {
      ...(includeScore ? { score: scoringOn ? score : null } : {}),
      verifier_remark: verifierRemark.trim() || null,
      ...(task.fill_id != null && task.fill_id !== ""
        ? { fill_id: task.fill_id }
        : {}),
    });
  }, [
    task,
    scoringEditable,
    validateScoring,
    reportVariant,
    scoreTouched,
    scoringOn,
    score,
    verifierRemark,
  ]);

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

  /** Ctrl+S via Drawer — same as primary footer action (Verify/Approve or Update). */
  const handleDrawerSubmit = useCallback(() => {
    if (saving || viewOnly) return;
    if (showVerifyApprove) {
      handleVerifyApprove();
      return;
    }
    if (showUpdate) handleUpdate();
  }, [
    saving,
    viewOnly,
    showVerifyApprove,
    showUpdate,
    handleVerifyApprove,
    handleUpdate,
  ]);

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
      onSubmit={
        viewOnly || (!showVerifyApprove && !showUpdate)
          ? undefined
          : handleDrawerSubmit
      }
      title={title}
      description={
        task
          ? `${task.person_name || "—"} · Verifier ${task.verification_user_name || "—"}`
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
              className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Close
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              {showUpdate ? (
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={saving}
                  title="Ctrl+S"
                  className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
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
                    className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 disabled:opacity-50"
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
                        : "Ctrl+S"
                    }
                    className="flex-1 sm:flex-none min-w-[140px] px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={16} />
                    {saving
                      ? "Saving…"
                      : scoringOn
                        ? `Verify · ${scoreToPercent(score)}%`
                        : "Verify"}
                  </button>
                </>
              ) : null}
            </div>
          )
        ) : null
      }
    >
      {task && (
        <div className="space-y-4 pb-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-900 text-base leading-snug">
                {task.title}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {awaiting ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-100 px-2.5 py-1 text-[11px] font-semibold">
                    <Shield size={12} /> Awaiting verify
                  </span>
                ) : null}
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 px-2.5 py-1 text-[11px] font-semibold">
                    <CheckCircle2 size={12} /> Verified
                  </span>
                ) : null}
                {task.reject_count > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 px-2.5 py-1 text-[11px] font-semibold">
                    <AlertTriangle size={12} /> Rejected {task.reject_count}×
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                <User size={12} className="text-indigo-500" />
                {task.person_name || "—"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                <Calendar size={12} className="text-indigo-500" />
                {formatScheduledDate(task.scheduled_date)}
              </span>
              {task.submitted_at ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                  <Clock size={12} />
                  {formatDateTime(task.submitted_at)}
                </span>
              ) : null}
              {task.score != null && (isCompleted || reportVariant) ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[11px] font-semibold text-amber-800">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  {formatStoredScoreAsPercent(task.score)}
                </span>
              ) : null}
              {task.weightage != null || task.wastage != null ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[11px] font-semibold text-amber-800">
                  Weightage {task.weightage ?? task.wastage}/10
                </span>
              ) : null}
            </div>
            {plainDesc ? (
              <div className="text-sm text-slate-700 leading-relaxed break-words">
                <RichTextDisplay value={task.description} />
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
              currentFillId={task.fill_id || null}
              excludeCurrent={!reportVariant}
              defaultCollapsed={false}
              title={reportVariant ? "All submissions" : "Previous submits"}
              onOpenFill={
                typeof onSwitchFill === "function"
                  ? (fill) => {
                      const fillId =
                        fill.fill_id != null && fill.fill_id !== ""
                          ? fill.fill_id
                          : fill.id != null && String(fill.id).startsWith("fill_")
                            ? fill.id
                            : undefined;
                      onSwitchFill({
                        instance_id: fill.instance_id,
                        fill_id: fillId,
                        title: fill.title || task?.title,
                        scheduled_date: fill.scheduled_date,
                      });
                    }
                  : undefined
              }
            />
          ) : null}

          {task.sop_description ? (
            <ClFormSection title="SOP — Follow These Steps">
              <RichTextDisplay value={task.sop_description} />
            </ClFormSection>
          ) : null}

          {schema.length > 0 ? (
            <ClFormSection title={userEditable ? "Fill Form" : "Submitted answers"}>
              <p className="text-xs text-slate-500 mb-3 -mt-1">
                {formSummary.total} field{formSummary.total === 1 ? "" : "s"}
                {formSummary.requiredCount > 0
                  ? ` · ${formSummary.requiredCount} required (*)`
                  : ""}
              </p>
              {formEntries.length > 1 ? (
                <div className="space-y-3">
                  {formEntries.map((entry, idx) => (
                    <div
                      key={entry.id || `entry-${idx}`}
                      className="rounded-xl border border-slate-200 bg-slate-50/40 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100">
                        <span className="shrink-0 w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700">
                            Entry #{idx + 1}
                          </p>
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
              {fieldError ? (
                <p className="text-xs text-rose-600 mt-2">{fieldError}</p>
              ) : null}
            </ClFormSection>
          ) : null}

          <ClFormSection title="User remark">
            <textarea
              className={textareaBase}
              rows={2}
              value={personRemark}
              disabled={!userEditable}
              onChange={(e) => setPersonRemark(e.target.value)}
              placeholder="Assignee / user note"
            />
            {userEditable ? (
              <input
                className={`${inputBase} mt-2`}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Edit note (optional)"
              />
            ) : null}
          </ClFormSection>

          {showScoringSection ? (
            <>
              {(scoringEditable || showVerifyApprove) && scoringOn ? (
                <ClFormSection title="Score">
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
                          setScoreTouched(true);
                          setVerifyError("");
                        }}
                        className={`min-h-[44px] rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
                          score === n
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
                        }`}
                        title={`${scoreToPercent(n)}%`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </ClFormSection>
              ) : scoringOn ? (
                <ClFormSection title="Score">
                  <p className="text-sm font-semibold text-amber-700 inline-flex items-center gap-1.5">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    {formatStoredScoreAsPercent(task.score)}
                  </p>
                </ClFormSection>
              ) : showVerifyApprove && createAsRedTicket ? (
                <ClFormSection title="Red ticket penalty score">
                  <ClFormLabel required>Score / penalty (1–10)</ClFormLabel>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {SCORES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setScore(n);
                          setScoreTouched(true);
                          setVerifyError("");
                        }}
                        className={`min-h-[44px] rounded-lg text-sm font-semibold border transition-colors ${
                          score === n
                            ? "bg-rose-500 text-white border-rose-500"
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
                  className={textareaBase}
                  rows={2}
                  value={verifierRemark}
                  disabled={!scoringEditable}
                  onChange={(e) => {
                    setVerifierRemark(e.target.value);
                    setVerifyError("");
                  }}
                  placeholder="Verification feedback"
                />
                {showVerifyApprove ? (
                  <label className="mt-3 flex items-start gap-3 cursor-pointer select-none rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-rose-600"
                      checked={createAsRedTicket}
                      onChange={(e) => {
                        setCreateAsRedTicket(e.target.checked);
                        setVerifyError("");
                      }}
                    />
                    <span className="text-sm text-rose-900 leading-snug">
                      <span className="font-semibold">Create as Red Ticket</span>
                      <span className="block text-xs text-rose-700/90 mt-0.5">
                        On reject only. Approve disabled while checked.
                      </span>
                    </span>
                  </label>
                ) : null}
                <ClFormError msg={verifyError} />
              </ClFormSection>
            </>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
