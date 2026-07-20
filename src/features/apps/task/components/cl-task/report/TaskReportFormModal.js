"use client";

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { reportPanelService } from "@/features/apps/task/services/reportApi";
import ClVerificationFormModal from "../verification/ClVerificationFormModal";

/**
 * Report score click → load full CL instance, then show CL create/verify form.
 * Super Admin: can Update user fill + score/weightage.
 * Everyone else: view only (and report list already scopes to own rows).
 */
export default function TaskReportFormModal({ open, task, onClose, onSaved, onSwitchTask }) {
  const role = useSelector((s) => s.auth?.role);
  const userType = useSelector((s) => s.auth?.user?.type || s.auth?.user?.role);
  const isSuperAdmin =
    String(role || "").toLowerCase() === "super_admin" ||
    String(userType || "").toLowerCase() === "super_admin";

  const [fullTask, setFullTask] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !task?.instance_id) {
      setFullTask(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setFullTask(null);
      try {
        const res = await reportPanelService.getInstance(task.instance_id);
        const payload = res?.data?.data ?? res?.data ?? null;
        if (!cancelled) {
          if (!payload) {
            toast.error("Task details not found");
            onClose?.();
            return;
          }
          setFullTask(payload);
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
    // intentionally omit onClose — parent often passes inline fn (re-fetch loop)
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
            className="px-5 py-2.5 text-sm font-bold text-slate-500"
          >
            Close
          </button>
        }
      >
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm font-medium">Loading form…</span>
        </div>
      </Drawer>
    );
  }

  return (
    <ClVerificationFormModal
      task={fullTask}
      reportVariant
      /** Super Admin: update even after complete. All other users: view only. */
      permissions={isSuperAdmin ? ["APPROVE"] : ["VIEW"]}
      onSwitchFill={(next) => {
        if (!next?.instance_id) return;
        setFullTask(null);
        onSwitchTask?.(next);
      }}
      onClose={() => {
        setFullTask(null);
        onClose?.();
      }}
      onSuccess={() => {
        setFullTask(null);
        onSaved?.();
        onClose?.();
      }}
    />
  );
}
