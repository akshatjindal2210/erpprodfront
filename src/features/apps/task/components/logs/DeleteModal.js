"use client";

import { useState } from "react";
import { Trash2, X, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import { logService } from "@/features/apps/task/services/logApi";

export default function LogDeleteModal({ item, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);

  if (!item) return null;

  const handleDelete = async () => {
    setLoading(true);
    try {
      await logService.delete(item.id);
      toast.success("Log deleted successfully");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete log");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Trash2 size={15} className="text-red-500" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Delete Log</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to delete this log? This action cannot be undone.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-16">User</span>
              <span className="text-xs font-medium text-slate-700">
                {item.user?.name ?? `User #${item.root_user_id}`}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-slate-400 w-16 flex-shrink-0">Action</span>
              <span className="text-xs font-medium text-slate-700 break-words line-clamp-2">
                {item.action}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-16">Time</span>
              <span className="text-xs font-medium text-slate-700">
                {new Date(item.created_at).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="text-sm font-medium px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all shadow-sm disabled:opacity-60"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Deleting…</>
              : <><Trash2 size={14} /> Delete</>
            }
          </button>
        </div>

      </div>
    </div>
  );
}
