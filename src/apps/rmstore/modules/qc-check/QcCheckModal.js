"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { Loader2, Eye, Upload, FileText, X, Shield, Check } from "lucide-react";
import { toast } from "react-toastify";

import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";
import Drawer from "@/ui/primitives/Drawer";
import { OK_INPUT, ERR_INPUT } from "@/ui/common/Constants";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { selectUser, selectRole } from "@/platform/store/slices/authSlice";
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";
import ApprovalStatusToggle from "@/apps/rmstore/modules/shared/ApprovalStatusToggle";
import RemarksTextarea from "@/ui/common/forms/RemarksTextarea";

function resolveDocUrl(noteOrPath) {
  const raw = String(noteOrPath || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) return raw;
  const path = raw.replace(/^\/+/, "");
  if (path.startsWith("uploads/")) return `${String(FILE_BASE_URL || "").replace(/\/$/, "")}/${path}`;
  return "";
}

function liveResult(spec, actualRaw) {
  const specType = String(spec?.spec_type || "").trim().toLowerCase();
  const actualText = actualRaw == null ? "" : String(actualRaw).trim();
  if (!actualText) return null;

  if (specType === "dropdown") {
    const correct = String(spec?.correct_option || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return correct.some((opt) => opt.toLowerCase() === actualText.toLowerCase()) ? "pass" : "fail";
  }

  const actual = Number(actualText);
  if (!Number.isFinite(actual)) return "fail";
  const min = Number(spec?.min_value);
  const max = Number(spec?.max_value);

  if (specType === "min") return actual >= (Number.isFinite(min) ? min : 0) ? "pass" : "fail";
  if (specType === "max") return actual <= (Number.isFinite(max) ? max : 0) ? "pass" : "fail";
  if (specType === "range") {
    const lo = Number.isFinite(min) ? min : 0;
    const hi = Number.isFinite(max) ? max : 0;
    return actual >= lo && actual <= hi ? "pass" : "fail";
  }
  return "fail";
}

function ResultPill({ result }) {
  if (!result) {
    return <span className="text-[9px] font-bold uppercase text-slate-300">—</span>;
  }
  const pass = result === "pass";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide rounded-full ${
        pass
          ? "bg-emerald-100 text-emerald-800"
          : "bg-rose-100 text-rose-800"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${pass ? "bg-emerald-500" : "bg-rose-500"}`} />
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

/** Overall Pass / Fail — only Super Admin can change; others see colored read-only value. */
function OverallResultSelect({ value, onChange, canEdit, readOnly }) {
  const isPass = value === "pass";
  const isFail = value === "fail";
  const locked = readOnly || !canEdit;
  const tone = isPass
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : isFail
      ? "border-rose-300 bg-rose-50 text-rose-800"
      : "border-slate-200 bg-white text-slate-600";

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Overall Result</span>
      <select
        value={value || ""}
        disabled={locked}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full h-9 px-2.5 rounded-lg border text-[12px] font-bold appearance-none ${tone} ${
          locked ? "cursor-not-allowed" : "cursor-pointer"
        }`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.65rem center",
          paddingRight: "2rem",
        }}
      >
        <option value="">— Incomplete —</option>
        <option value="pass">Pass</option>
        <option value="fail">Fail</option>
      </select>
    </div>
  );
}

function docDisplayName(note) {
  if (!note) return "";
  const parts = String(note).split(/[/\\]/);
  return parts[parts.length - 1] || note;
}

function isLineComplete(spec, v) {
  if (!String(v?.actual_value || "").trim()) return false;
  if (spec.document_required && !v?.document_file && !v?.document_note) return false;
  return true;
}

function DocUploadCell({ file, savedNote, hasErr, disabled, onChange, onClear }) {
  const localUrl = useMemo(() => (file instanceof File ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => {
    if (!localUrl) return undefined;
    return () => URL.revokeObjectURL(localUrl);
  }, [localUrl]);

  const savedUrl = resolveDocUrl(savedNote);
  const previewUrl = localUrl || savedUrl;
  const label = file?.name || docDisplayName(savedNote) || "Document";
  const hasDoc = Boolean(file || savedNote);

  const nameNode = previewUrl ? (
    <FilePreviewLink
      href={previewUrl}
      fileName={label}
      className="truncate text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer min-w-0 flex-1"
      title={`Open ${label}`}
    >
      {label}
    </FilePreviewLink>
  ) : (
    <span className="truncate text-[10px] font-bold text-slate-700 flex-1 min-w-0" title={label}>
      {label}
    </span>
  );

  if (!hasDoc) {
    return (
      <label
        className={`inline-flex items-center gap-1 h-7 px-1.5 border rounded-md bg-white cursor-pointer hover:bg-slate-50 ${
          hasErr ? "border-rose-400" : "border-slate-200"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <Upload size={11} className="text-slate-500 shrink-0" />
        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Upload</span>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />
      </label>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 min-w-0 h-7 px-1.5 border rounded-md bg-white ${
        hasErr ? "border-rose-400" : "border-slate-200"
      }`}
    >
      <FileText size={11} className="shrink-0 text-emerald-600" />
      {nameNode}
      {!disabled && file ? (
        <button type="button" onClick={onClear} className="shrink-0 text-slate-400 hover:text-rose-600" title="Remove">
          <X size={11} />
        </button>
      ) : null}
      {!disabled && savedNote && !file ? (
        <label className="shrink-0 text-[9px] font-bold text-indigo-600 cursor-pointer hover:underline">
          Replace
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              onChange(e.target.files?.[0] || null);
              e.target.value = "";
            }}
          />
        </label>
      ) : null}
    </div>
  );
}

/**
 * QC Check inspect / view / edit / approve drawer.
 * Inspect: fill specs → Save draft until complete → Submit.
 * Edit (Register): update values on the same QC row → Submit.
 * Approve: change values if needed → Approve (pass→passed / fail→Rejection Pending).
 */
export default function QcCheckModal({ open, onClose, onSuccess, row, mode = "inspect" }) {
  const canAccess = useCanAccess();
  const role = useSelector(selectRole);
  const currentUser = useSelector(selectUser);
  const isSuperAdmin =
    String(role || "").toLowerCase() === "super_admin" ||
    String(currentUser?.type || currentUser?.role || "").toLowerCase() === "super_admin";
  const canAdd = canAccess("rm_qc_check", "add").allowed;
  const canEdit = canAccess("rm_qc_check", "edit").allowed;
  const canAuthorize = canAccess("rm_qc_check", "authorize").allowed;
  const isEditMode = mode === "edit";
  const isApproveMode = mode === "approve";
  const canWrite = isApproveMode ? canAuthorize : isEditMode ? canEdit : canAdd;
  /** Approvers + super admin see Expected vs Actual (+ Result). Super admin sees all. */
  const showCompareCols = isSuperAdmin || canAuthorize || isApproveMode;

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [values, setValues] = useState({});
  const [remarks, setRemarks] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [errors, setErrors] = useState({});
  /** Super Admin override: null = follow auto from line results. */
  const [overallOverride, setOverallOverride] = useState(null);
  /** Edit + authorize: when true, Save also runs Approve. */
  const [approveOnSave, setApproveOnSave] = useState(false);

  const readOnly = mode === "view" || detail?.read_only === true;
  /** Edit/Approve + authorize → Approval Status toggle (Save uses toggle). */
  const showApprovalToggle = (isEditMode || isApproveMode) && canAuthorize && !readOnly;
  const showExpectedResultCols = readOnly || showCompareCols;

  const load = useCallback(async () => {
    if (!row?.coil_no_uid && !row?.qc_check_uid) return;
    setLoading(true);
    setLoadError(null);
    setErrors({});
    try {
      const status = String(row.status || "").toLowerCase();
      const usePrepare =
        mode === "edit" ||
        mode === "approve" ||
        status === "pending" ||
        status === "draft" ||
        row?.is_virtual_pending === true;

      if (usePrepare && mode !== "view") {
        const prepareBody = row.qc_check_uid
          ? {
              qc_check_uid: row.qc_check_uid,
              ...((mode === "edit" || mode === "approve") ? { for_edit: true } : {}),
            }
          : { coil_no_uid: row.coil_no_uid };
        const res = await qcCheckService.prepare(prepareBody);
        const data = res?.data;
        setDetail({ ...data, read_only: data?.read_only === true });
        setChecklist(data?.checklist || []);
        const next = {};
        for (const it of data?.checklist || []) {
          next[it.spec_id] = {
            actual_value: it.actual_value ?? "",
            document_file: null,
            document_note: it.document_note ?? "",
          };
        }
        setValues(next);
        setRemarks(data?.remarks || "");
        setFailureReason(data?.failure_reason || "");
        setOverallOverride(null);
      } else if (row.qc_check_uid) {
        const res = await qcCheckService.getById(row.qc_check_uid);
        const data = res?.data;
        setDetail({ ...data, read_only: true });
        setChecklist(
          (data?.items || []).map((it) => ({
            ...it,
            expected_display: it.expected_display || formatExpectedLocal(it),
            dropdown_options: buildDropdownOptions(it),
          }))
        );
        const next = {};
        for (const it of data?.items || []) {
          next[it.spec_id] = {
            actual_value: it.actual_value ?? "",
            document_file: null,
            document_note: it.document_note ?? "",
          };
        }
        setValues(next);
        setRemarks(data?.remarks || "");
        setFailureReason(data?.failure_reason || "");
        const st = String(data?.status || "").toLowerCase();
        setOverallOverride(st === "passed" ? "pass" : st === "failed" ? "fail" : null);
      } else {
        toast.error("This QC check has not been submitted yet, so there is nothing to view.");
        onClose?.();
      }
    } catch (err) {
      const msg = err?.message || "Could not load the QC check. Please try again.";
      toast.error(msg);
      if (mode === "inspect" && !row?.qc_check_uid) {
        setLoadError(msg);
        setDetail(null);
        setChecklist([]);
      } else {
        onClose?.();
      }
    } finally {
      setLoading(false);
    }
  }, [row?.qc_check_uid, row?.coil_no_uid, row?.status, row?.is_virtual_pending, mode, onClose]);

  useEffect(() => {
    if (open && (row?.coil_no_uid || row?.qc_check_uid)) {
      void load();
      if (mode === "edit" && canAuthorize) {
        const st = String(row?.status || "").toLowerCase();
        setApproveOnSave(["passed", "failed", "awaiting_approval"].includes(st));
      } else if (mode === "approve" && canAuthorize) {
        setApproveOnSave(true);
      } else {
        setApproveOnSave(false);
      }
    } else if (!open) {
      setDetail(null);
      setChecklist([]);
      setValues({});
      setRemarks("");
      setFailureReason("");
      setErrors({});
      setOverallOverride(null);
      setApproveOnSave(false);
    }
  }, [open, row?.qc_check_uid, row?.coil_no_uid, row?.status, mode, canAuthorize, load]);

  const lineResults = useMemo(() => {
    const map = {};
    for (const spec of checklist) {
      if (readOnly && spec.result) {
        map[spec.spec_id] = spec.result;
      } else {
        map[spec.spec_id] = liveResult(spec, values[spec.spec_id]?.actual_value);
      }
    }
    return map;
  }, [checklist, values, readOnly]);

  const autoOverall = useMemo(() => {
    if (!checklist.length) return "";
    const results = checklist.map((s) => lineResults[s.spec_id]);
    if (results.some((r) => !r)) return "";
    return results.some((r) => r === "fail") ? "fail" : "pass";
  }, [checklist, lineResults]);

  const overallResult = overallOverride || autoOverall;

  const autoFailureReason = useMemo(() => {
    if (readOnly) return String(failureReason || "").trim();
    const lines = [];
    for (const spec of checklist) {
      if (liveResult(spec, values[spec.spec_id]?.actual_value) !== "fail") continue;
      const expected = spec.expected_display || formatExpectedLocal(spec);
      const got = String(values[spec.spec_id]?.actual_value ?? "").trim() || "—";
      lines.push(`${spec.spec_name || `Spec ${spec.spec_id}`}: expected ${expected}, got ${got}`);
    }
    return lines.join("; ");
  }, [checklist, values, readOnly, failureReason]);

  const mismatchLines = useMemo(() => {
    if (readOnly) {
      const text = String(failureReason || "").trim();
      return text ? text.split(/\s*;\s*/).filter(Boolean) : [];
    }
    const lines = [];
    for (const spec of checklist) {
      if (liveResult(spec, values[spec.spec_id]?.actual_value) !== "fail") continue;
      const expected = spec.expected_display || formatExpectedLocal(spec);
      const got = String(values[spec.spec_id]?.actual_value ?? "").trim() || "—";
      lines.push({
        key: spec.spec_id,
        name: spec.spec_name || `Spec ${spec.spec_id}`,
        expected,
        got,
      });
    }
    return lines;
  }, [checklist, values, readOnly, failureReason]);

  const filledCount = useMemo(
    () => checklist.reduce((n, s) => n + (isLineComplete(s, values[s.spec_id]) ? 1 : 0), 0),
    [checklist, values]
  );
  const totalCount = checklist.length;
  const allFilled = totalCount > 0 && filledCount >= totalCount;

  const showDocColumn = useMemo(() => {
    const hasAnyDoc = checklist.some(
      (s) => values[s.spec_id]?.document_note || values[s.spec_id]?.document_file || s.document_required
    );
    return hasAnyDoc;
  }, [checklist, values]);

  const setActual = (specId, val) => {
    setValues((prev) => ({
      ...prev,
      [specId]: { ...(prev[specId] || {}), actual_value: val },
    }));
    setErrors((prev) => {
      if (!prev[specId]) return prev;
      const next = { ...prev };
      delete next[specId];
      return next;
    });
  };

  const setDocFile = (specId, file) => {
    setValues((prev) => ({
      ...prev,
      [specId]: { ...(prev[specId] || {}), document_file: file },
    }));
    setErrors((prev) => {
      if (!prev[specId]) return prev;
      const next = { ...prev };
      delete next[specId];
      return next;
    });
  };

  const buildItemsPayload = () =>
    checklist.map((s) => ({
      spec_id: s.spec_id,
      actual_value: String(values[s.spec_id]?.actual_value || "").trim(),
      document_file: values[s.spec_id]?.document_file || null,
    }));

  const handleSaveDraft = async () => {
    if (readOnly || !canWrite || isEditMode) return;
    const coilUid = detail?.coil_no_uid || row?.coil_no_uid;
    if (!coilUid && !detail?.qc_check_uid) return;

    setSubmitting(true);
    try {
      const res = await qcCheckService.submit({
        ...(detail?.qc_check_uid ? { qc_check_uid: detail.qc_check_uid } : { coil_no_uid: coilUid }),
        remarks: remarks.trim() || null,
        failure_reason: String(autoFailureReason || "").trim() || null,
        is_draft: true,
        items: buildItemsPayload(),
      });
      toast.success(res?.message || "Draft saved.");
      onSuccess?.({ isDraft: true });
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not save the draft. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (readOnly || !canWrite) return;
    const coilUid = detail?.coil_no_uid || row?.coil_no_uid;
    if (!coilUid && !detail?.qc_check_uid) return;
    const nextErrors = {};
    for (const spec of checklist) {
      const v = values[spec.spec_id] || {};
      if (!String(v.actual_value || "").trim()) {
        nextErrors[spec.spec_id] = "This field is required.";
      } else if (spec.document_required && !v.document_file && !v.document_note) {
        nextErrors[spec.spec_id] = "A document is required.";
      }
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error(
        (isApproveMode || isEditMode) && approveOnSave
          ? "Complete every specification line before approving."
          : "Complete every specification line before submitting."
      );
      return;
    }

    const willFail = overallResult === "fail";
    const reason = willFail ? String(autoFailureReason || "").trim() || (isSuperAdmin && overallOverride === "fail" ? "Marked as failed by administrator override." : "") : "";
    const itemsPayload = buildItemsPayload();
    const qcId = detail?.qc_check_uid || row?.qc_check_uid;
    const doApproveNow = showApprovalToggle && approveOnSave;

    setSubmitting(true);
    try {
      if (doApproveNow) {
        if (!qcId) {
          toast.error("QC check ID is missing. Close and reopen the record.");
          return;
        }
        const statusNow = String(detail?.status || row?.status || "").toLowerCase();
        // Register edit of passed/failed: submit first so row is awaiting_approval, then approve
        if (isEditMode && ["passed", "failed"].includes(statusNow)) {
          await qcCheckService.submit({
            qc_check_uid: qcId,
            remarks: remarks.trim() || null,
            failure_reason: willFail ? reason || null : null,
            is_draft: false,
            items: itemsPayload,
          });
        }
        const res = await qcCheckService.approve({
          qc_check_uid: qcId,
          remarks: remarks.trim() || null,
          failure_reason: willFail ? reason || null : null,
          ...(isSuperAdmin && (overallResult === "pass" || overallResult === "fail")
            ? { overall_result: overallResult }
            : {}),
          items: itemsPayload,
        });
        toast.success(
          res?.message ||
            (willFail
              ? "QC approved as failed and moved to Rejection Pending."
              : "QC approved.")
        );
      } else {
        const res = await qcCheckService.submit({
          ...(qcId ? { qc_check_uid: qcId } : { coil_no_uid: coilUid }),
          remarks: remarks.trim() || null,
          failure_reason: willFail ? reason || null : null,
          is_draft: false,
          items: itemsPayload,
        });
        toast.success(
          res?.message ||
            (willFail
              ? "QC submitted with mismatches and is awaiting approval."
              : isEditMode
                ? "QC updated and is awaiting approval."
                : "QC submitted for approval.")
        );
      }
      onSuccess?.({ isDraft: false });
      onClose?.();
    } catch (err) {
      toast.error(
        err?.message ||
          (doApproveNow
            ? "Could not approve the QC check. Please try again."
            : "Could not submit the QC check. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimaryAction = () => {
    if (isApproveMode || isEditMode || allFilled) void handleSubmit();
    else void handleSaveDraft();
  };

  const primaryDisabled =
    submitting ||
    loading ||
    totalCount === 0 ||
    ((isEditMode || isApproveMode) && !allFilled);
  const isPrimaryApprove = showApprovalToggle && approveOnSave;
  const isPrimarySubmit = !isPrimaryApprove && (isEditMode || allFilled);

  const footer = (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className={readOnly ? IMS_DRAWER_BTN_CLOSE : IMS_DRAWER_BTN_CANCEL}
      >
        {readOnly ? "Close" : "Cancel"}
      </button>
      {!readOnly && canWrite && (
        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={primaryDisabled}
          title="Ctrl+S"
          className={isPrimaryApprove ? IMS_DRAWER_BTN_APPROVE : IMS_DRAWER_BTN_PRIMARY}
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              {isPrimaryApprove ? <Shield size={18} /> : <Check size={18} />}
              {!isPrimaryApprove && !isPrimarySubmit && totalCount
                ? `Save Draft (${filledCount}/${totalCount})`
                : isPrimaryApprove
                  ? "Approve"
                  : "Save"}
            </>
          )}
        </button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={
        readOnly || !canWrite || submitting || loading || totalCount === 0
          ? undefined
          : handlePrimaryAction
      }
      title={
        readOnly
          ? `QC Check #${row?.qc_check_uid || detail?.qc_check_uid || ""}`
          : isApproveMode
            ? `Approve QC #${row?.qc_check_uid || detail?.qc_check_uid || ""}`
            : isEditMode
              ? `Edit QC #${row?.qc_check_uid || detail?.qc_check_uid || ""}`
              : "QC Spec Check"
      }
      description={
        readOnly
          ? "Recorded expected and actual values"
          : isApproveMode
            ? "Review values, then approve (fail → Rejection Pending)"
            : isEditMode
              ? "Update values and save"
              : `Fill specs for ${row?.coil_no_uid || detail?.coil_no_uid || "coil"} · draft anytime, submit when complete`
      }
      footer={footer}
      maxWidth="max-w-5xl"
      bodyScrollable
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
          <p className="text-sm font-bold text-rose-800">Specifications could not be loaded</p>
          <p className="text-[12px] text-rose-700 leading-relaxed">{loadError}</p>
          <p className="text-[11px] text-rose-600">
            Add or authorize the item in RM Spec Master, then scan the QC sticker again.
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <Info label="Coil UID" value={detail?.coil_no_uid} mono />
            <Info label="MRN" value={detail?.mrn_no} />
            <Info label="Heat No." value={detail?.heat_no} mono />
            <Info label="Qty" value={detail?.qty != null ? Number(detail.qty).toLocaleString() : "—"} />
            <Info label="Item" value={detail?.item_code} className="col-span-2" />
            <Info label="Description" value={detail?.item_desc} className="col-span-2" />
          </div>

          {readOnly && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <Eye size={13} className="text-slate-400 shrink-0" />
              <p className="text-[11px] text-slate-600 font-medium truncate">
                Status: <span className="font-bold uppercase">{detail?.status}</span>
                {detail?.inspected_by_name || detail?.inspected_by
                  ? ` · ${detail.inspected_by_name || detail.inspected_by}`
                  : ""}
                {detail?.failure_reason ? ` · ${detail.failure_reason}` : ""}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="uppercase text-[9px] tracking-wider text-slate-500">
                    <th className="px-2 py-1.5 w-8">#</th>
                    <th className="px-2 py-1.5">Spec</th>
                    <th className="px-2 py-1.5 w-16">Type</th>
                    {showExpectedResultCols && <th className="px-2 py-1.5">Expected</th>}
                    <th className="px-2 py-1.5 min-w-[120px]">Actual</th>
                    {showExpectedResultCols && <th className="px-2 py-1.5 w-16">Result</th>}
                    {showDocColumn && <th className="px-2 py-1.5 w-[160px]">Document</th>}
                  </tr>
                </thead>
                <tbody>
                  {checklist.map((spec) => {
                    const sid = spec.spec_id;
                    const isDropdown = String(spec.spec_type || "").toLowerCase() === "dropdown";
                    const hasErr = !!errors[sid];
                    const result = lineResults[sid];
                    const needsDoc = Boolean(spec.document_required);
                    const showUpload =
                      Boolean(values[sid]?.document_file || values[sid]?.document_note) ||
                      (needsDoc && !readOnly);
                    const inputClass = `${hasErr ? ERR_INPUT : OK_INPUT} text-[11px] h-7 rounded-md px-2`;
                    return (
                      <tr key={sid} className="border-b border-slate-100 align-middle">
                        <td className="px-2 py-1 font-bold text-slate-400">{spec.sno}</td>
                        <td className="px-2 py-1">
                          <div className="font-bold text-slate-800 leading-tight">{spec.spec_name || "—"}</div>
                          {hasErr && <div className="text-[9px] text-rose-600 font-bold">{errors[sid]}</div>}
                        </td>
                        <td className="px-2 py-1 uppercase font-bold text-slate-500 text-[10px]">{spec.spec_type}</td>
                        {showExpectedResultCols && (
                          <td className="px-2 py-1 font-mono text-slate-700 text-[10px]">
                            {spec.expected_display || formatExpectedLocal(spec)}
                          </td>
                        )}
                        <td className="px-2 py-1">
                          {isDropdown ? (
                            <select
                              disabled={readOnly}
                              value={values[sid]?.actual_value || ""}
                              onChange={(e) => setActual(sid, e.target.value)}
                              className={inputClass}
                            >
                              <option value="">Select…</option>
                              {(spec.dropdown_options || buildDropdownOptions(spec)).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              disabled={readOnly}
                              value={values[sid]?.actual_value || ""}
                              onChange={(e) => setActual(sid, e.target.value)}
                              className={inputClass}
                              placeholder="Value"
                            />
                          )}
                        </td>
                        {showExpectedResultCols && (
                          <td className="px-2 py-1">
                            <ResultPill result={result} />
                          </td>
                        )}
                        {showDocColumn && (
                          <td className="px-2 py-1">
                            {showUpload ? (
                              <DocUploadCell
                                file={values[sid]?.document_file || null}
                                savedNote={values[sid]?.document_note || ""}
                                hasErr={hasErr && needsDoc}
                                disabled={readOnly}
                                onChange={(file) => setDocFile(sid, file)}
                                onClear={() => setDocFile(sid, null)}
                              />
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!checklist.length && (
                    <tr>
                      <td
                        colSpan={
                          showExpectedResultCols
                            ? showDocColumn
                              ? 7
                              : 6
                            : showDocColumn
                              ? 5
                              : 4
                        }
                        className="px-3 py-6 text-center text-slate-400"
                      >
                        No specification lines
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <RemarksTextarea
            value={remarks}
            onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
            placeholder="Enter remarks (optional)"
            disabled={readOnly}
          />

          {checklist.length > 0 && (
            <OverallResultSelect
              value={overallResult}
              readOnly={readOnly}
              canEdit={isSuperAdmin && !readOnly}
              onChange={(val) => {
                if (!isSuperAdmin || readOnly) return;
                if (!val) {
                  setOverallOverride(null);
                  return;
                }
                setOverallOverride(val === "pass" || val === "fail" ? val : null);
              }}
            />
          )}

          {mismatchLines.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 overflow-hidden">
              <div className="px-2.5 py-1.5 border-b border-rose-100 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  Mismatch · {mismatchLines.length}
                </p>
              </div>
              <ul className="divide-y divide-rose-100/80 max-h-36 overflow-y-auto">
                {mismatchLines.map((line) =>
                  typeof line === "string" ? (
                    <li key={line} className="px-2.5 py-1.5 text-[11px] font-medium text-rose-900">
                      {line}
                    </li>
                  ) : (
                    <li
                      key={line.key}
                      className="px-2.5 py-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]"
                    >
                      <span className="font-bold text-rose-900">{line.name}</span>
                      <span className="text-rose-700/80">
                        expected{" "}
                        <span className="font-mono font-semibold text-rose-900">{line.expected}</span>
                        <span className="mx-1 text-rose-300">→</span>
                        got <span className="font-mono font-semibold text-rose-900">{line.got}</span>
                      </span>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {!readOnly && (
            <ApprovalStatusToggle
              show={showApprovalToggle}
              checked={approveOnSave}
              onChange={setApproveOnSave}
              disabled={submitting}
              pendingHint={
                isApproveMode || isEditMode
                  ? "Submit only — turn on approval when you can authorize."
                  : `Incomplete stays draft (${filledCount}/${totalCount || 0}). Submit when all lines are filled.`
              }
              lockedLabel="Final & Locked · save and approve"
              draftLabel="Draft Mode · submit only"
            />
          )}
        </div>
      )}
    </Drawer>
  );
}

function Info({ label, value, mono, className = "" }) {
  return (
    <div className={`rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 ${className}`}>
      <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-none">
        {label}
      </div>
      <div
        className={`text-[11px] font-bold text-slate-800 truncate mt-0.5 ${mono ? "font-mono" : ""}`}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function formatExpectedLocal(spec) {
  const t = String(spec?.spec_type || "").toLowerCase();
  if (t === "min") return `≥ ${Number(spec?.min_value) || 0}`;
  if (t === "max") return `≤ ${Number(spec?.max_value) || 0}`;
  if (t === "range") return `${Number(spec?.min_value) || 0} – ${Number(spec?.max_value) || 0}`;
  if (t === "dropdown") {
    return String(spec?.correct_option || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" | ") || "—";
  }
  return "—";
}

function buildDropdownOptions(spec) {
  const parts = [
    ...String(spec?.correct_option || "").split(","),
    ...String(spec?.incorrect_option || "").split(","),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.filter((v, i, arr) => arr.findIndex((t) => t.toLowerCase() === v.toLowerCase()) === i);
}
