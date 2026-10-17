"use client";

import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { reportPanelService } from "@/apps/task/lib/services/reportApi";
import ClVerificationFormModal from "../verification/ClVerificationFormModal";

/** Apply a submission_fills row onto the open report task (no remount / refetch). */
function hydrateTaskFromFill(base, fill) {
  if (!base || !fill) return base;
  const fillId =
    fill.fill_id != null && fill.fill_id !== ""
      ? fill.fill_id
      : fill.id != null && String(fill.id).startsWith("fill_")
        ? fill.id
        : null;
  return {
    ...base,
    instance_id: fill.instance_id || base.instance_id,
    fill_id: fillId,
    status: fill.status || base.status,
    score: fill.score != null ? fill.score : null,
    person_remark: fill.person_remark ?? null,
    verifier_remark: fill.verifier_remark ?? null,
    submitted_at: fill.submitted_at || null,
    completed_at: fill.completed_at || null,
    reject_count: fill.reject_count ?? 0,
    form_responses: fill.form_responses || { entries: [] },
    form_schema: fill.form_schema || base.form_schema,
    scheduled_date: fill.scheduled_date || base.scheduled_date,
    submission_fills: base.submission_fills,
    sibling_fills: base.sibling_fills,
    fill_count: base.fill_count,
  };
}

function fillIdOf(row) {
  if (row?.fill_id != null && row.fill_id !== "") return String(row.fill_id);
  if (row?.id != null && String(row.id).startsWith("fill_")) return String(row.id);
  return "";
}

function findFill(fills, next) {
  if (!next) return null;
  const nextFillId = fillIdOf(next);
  const pool = fills || [];

  if (nextFillId) {
    const byFill = pool.find((f) => fillIdOf(f) === nextFillId);
    if (byFill) return byFill;
  }

  if (!next.instance_id) return null;
  return pool.find((f) => {
    if (Number(f.instance_id) !== Number(next.instance_id)) return false;
    return fillIdOf(f) === nextFillId;
  });
}

/**
 * Report click → load instance for that cell's day. One drawer open (no loading drawer).
 */
export default function TaskReportFormModal({ open, task, onClose, onSaved, onSwitchTask }) {
  const role = useSelector((s) => s.auth?.role);
  const userType = useSelector((s) => s.auth?.user?.type || s.auth?.user?.role);
  const isSuperAdmin =
    String(role || "").toLowerCase() === "super_admin" ||
    String(userType || "").toLowerCase() === "super_admin";

  const [fullTask, setFullTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadedKeyRef = useRef(null);

  useEffect(() => {
    if (!open || !task?.instance_id) {
      setFullTask(null);
      loadedKeyRef.current = null;
      setLoading(false);
      return undefined;
    }

    const instanceId = Number(task.instance_id);
    const day = task.report_day || task.scheduled_date || "";
    const loadKey = `${instanceId}:${task.fill_id || ""}:${day}`;
    if (loadedKeyRef.current === loadKey) return undefined;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setFullTask(null);
      try {
        const res = await reportPanelService.getInstance(instanceId, {
          fill_id: task.fill_id || undefined,
        });
        const payload = res?.data?.data ?? res?.data ?? null;
        if (!cancelled) {
          if (!payload) {
            toast.error("Task details not found");
            onClose?.();
            return;
          }
          setFullTask({
            ...payload,
            scheduled_date: day || payload.scheduled_date,
            report_day: day || null,
          });
          loadedKeyRef.current = loadKey;
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Failed to load CL task");
          onClose?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, task?.instance_id, task?.fill_id, task?.report_day, task?.scheduled_date]);

  if (!open || !task || loading || !fullTask) return null;

  return (
    <ClVerificationFormModal
      task={fullTask}
      reportVariant
      permissions={isSuperAdmin ? ["APPROVE"] : ["VIEW"]}
      onSwitchFill={(next) => {
        if (!next?.instance_id && !next?.fill_id) return;
        const pool = [
          ...(fullTask.submission_fills || []),
          ...(fullTask.sibling_fills || []),
        ];
        const match = findFill(pool, next);
        if (match) {
          setFullTask((prev) => hydrateTaskFromFill(prev, match));
          return;
        }
        if (!next?.instance_id) return;
        loadedKeyRef.current = null;
        onSwitchTask?.({
          instance_id: next.instance_id,
          fill_id: next.fill_id || undefined,
          title: next.title || task?.title,
          scheduled_date: next.scheduled_date,
          report_day: next.scheduled_date,
        });
      }}
      onClose={() => {
        setFullTask(null);
        loadedKeyRef.current = null;
        onClose?.();
      }}
      onSuccess={() => {
        setFullTask(null);
        loadedKeyRef.current = null;
        onSaved?.();
        onClose?.();
      }}
    />
  );
}
