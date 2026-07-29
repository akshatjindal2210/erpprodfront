"use client";

import { useState } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import { useEscapeKey } from "@/platform/hooks/system/useEscapeKey";

/**
 * Centered delete confirm — same pattern as IMS (`core/components/common/DeleteModal`).
 */
export default function DeleteModal({
  item,
  onClose,
  onSuccess,
  service,
  entityLabel,
  idKey = "id",
  nameKey = "name",
  warningMessage,
}) {
  const [loading, setLoading] = useState(false);

  useEscapeKey(onClose, !!item);

  if (!item) return null;

  const recordId = item[idKey] ?? item.id ?? item.task_id;
  const recordTitle =
    item[nameKey] ?? item.name ?? item.title ?? item.person_name ?? recordId;

  const handleDelete = async () => {
    setLoading(true);
    try {
      await service.delete(recordId);
      toast.success(`${entityLabel} deleted`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg =
        err?.message ||
        err?.payload?.message ||
        err?.response?.data?.message ||
        "";
      if (
        msg.toLowerCase().includes("foreign") ||
        msg.toLowerCase().includes("constraint") ||
        msg.toLowerCase().includes("referenced")
      ) {
        toast.error(
          `Cannot delete — this ${entityLabel.toLowerCase()} is currently in use`,
        );
      } else {
        toast.error(msg || "Failed to delete");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center">
              <Trash2 size={14} className="text-rose-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              Delete {entityLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-3">
          <div className="flex gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
            <AlertTriangle
              size={15}
              className="text-rose-500 flex-shrink-0 mt-0.5"
            />
            <p className="text-xs text-rose-700">
              {warningMessage ||
                `This action cannot be undone. If this ${entityLabel.toLowerCase()} is assigned to any records, deletion will fail.`}
            </p>
          </div>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-slate-800">&quot;{recordTitle}&quot;</span>?
          </p>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Deleting…
              </>
            ) : (
              <>
                <Trash2 size={14} /> Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
