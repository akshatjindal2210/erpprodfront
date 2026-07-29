"use client";

import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
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
 * Report click → one load per instance. Fill Edit switches locally (no drawer blink).
 */
export default function TaskReportFormModal({ open, task, onClose, onSaved, onSwitchTask }) {
  const role = useSelector((s) => s.auth?.role);
  const userType = useSelector((s) => s.auth?.user?.type || s.auth?.user?.role);
  const isSuperAdmin =
    String(role || "").toLowerCase() === "super_admin" ||
    String(userType || "").toLowerCase() === "super_admin";

  const [fullTask, setFullTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadedInstanceRef = useRef(null);

  useEffect(() => {
    if (!open || !task?.instance_id) {
      setFullTask(null);
      loadedInstanceRef.current = null;
      setLoading(false);
      return undefined;
    }

    const instanceId = Number(task.instance_id);
    if (loadedInstanceRef.current === instanceId) {
      return undefined;
    }

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
          setFullTask(payload);
          loadedInstanceRef.current = instanceId;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per instance open
  }, [open, task?.instance_id]);

  if (!open || !task) return null;

  if (loading || !fullTask) {
    return (
      <Drawer
        isOpen
        onClose={onClose}
        title="CL Task Report"
        description={task.title || ""}
        headerVariant="form"
        maxWidth="max-w-2xl"
        closeOnOutside={false}
        footer={
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-slate-500"
          >
            Close
          </button>
        }
      >
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm font-medium">Loading…</span>
        </div>
      </Drawer>
    );
  }

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
        /** Different instance not in list — soft parent switch (rare). */
        if (!next?.instance_id) return;
        loadedInstanceRef.current = null;
        onSwitchTask?.({
          instance_id: next.instance_id,
          fill_id: next.fill_id || undefined,
          title: next.title || task?.title,
          scheduled_date: next.scheduled_date,
        });
      }}
      onClose={() => {
        setFullTask(null);
        loadedInstanceRef.current = null;
        onClose?.();
      }}
      onSuccess={() => {
        setFullTask(null);
        loadedInstanceRef.current = null;
        onSaved?.();
        onClose?.();
      }}
    />
  );
}
