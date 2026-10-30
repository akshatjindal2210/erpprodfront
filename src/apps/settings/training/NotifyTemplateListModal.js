"use client";

import { Plus, Pencil, Trash2, Bell, Loader2, Check, Copy } from "lucide-react";
import { toast } from "react-toastify";
import { useState } from "react";
import Drawer from "@/ui/primitives/Drawer";
import { FormLabel } from "@/ui/common/Constants";
import { notificationTemplateService } from "@/apps/settings/lib/services/notificationTemplateService";
import { TRIGGER_EVENT_LABELS, recipientText, channelText } from "@/apps/settings/notifications/moduleTemplateConfig";

/**
 * Multi-template picker in the same Drawer design as New Notification form.
 */
export default function NotifyTemplateListModal({
  slot,
  templates = [],
  options = null,
  canAdd = false,
  canEdit = false,
  canDelete = false,
  viewOnly = false,
  onClose,
  onAdd,
  onEdit,
  onDeleted,
  onCloned,
}) {
  const [busyId, setBusyId] = useState(null);
  const showClone = canAdd && !viewOnly;
  if (!slot) return null;

  const eventLabel = TRIGGER_EVENT_LABELS[slot.event] || slot.event;
  const headerDesc = [slot.modLabel, eventLabel].filter(Boolean).join(" · ");

  const handleClone = async (row, e) => {
    e?.stopPropagation?.();
    if (!showClone) return;
    setBusyId(row.id);
    try {
      await notificationTemplateService.clone(row.id);
      toast.success("Template cloned");
      onCloned?.();
    } catch (err) {
      toast.error(err?.message || "Failed to clone template");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row, e) => {
    e?.stopPropagation?.();
    if (!canDelete || viewOnly) return;
    if (!confirm(`Delete template "${row.name}"?`)) return;
    setBusyId(row.id);
    try {
      await notificationTemplateService.delete(row.id);
      toast.success("Template deleted successfully");
      onDeleted?.(row.id);
    } catch (err) {
      toast.error(err?.message || "Failed to delete template");
    } finally {
      setBusyId(null);
    }
  };

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-xl"
      >
        Close
      </button>
      {canAdd && !viewOnly ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full sm:w-auto sm:min-w-[160px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
        >
          <Plus size={18} /> Add Template
        </button>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={!!slot}
      onClose={onClose}
      title="Notification Templates"
      description={headerDesc || "Module notification templates"}
      footer={footer}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <FormLabel>Templates for this action</FormLabel>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {templates.length} saved
          </span>
        </div>

        {!templates.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
              <Bell size={18} className="text-amber-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">No templates yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[260px] leading-relaxed">
              Add a template to notify people when this action runs. You can add more later with different recipients or conditions.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((row) => {
              const condCount = (row.conditions || []).length;
              const recipients = recipientText(row, options);
              const channels = channelText(row);
              const open = () => {
                if (viewOnly || canEdit) onEdit?.(row);
              };

              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open();
                    }
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all px-4 py-3 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                      <Bell size={16} className={row.is_active ? "text-amber-600" : "text-slate-400"} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800 truncate">{row.name}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            row.is_active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {row.is_active ? <Check size={10} strokeWidth={3} /> : null}
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {row.subject ? (
                        <p className="text-xs text-slate-500 mt-1 truncate">{row.subject}</p>
                      ) : null}

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Send to</p>
                          <p className="text-[11px] text-slate-700 mt-0.5 line-clamp-2">
                            <span className="font-semibold text-slate-500">{recipients.type}: </span>
                            {recipients.label || "-"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Channels · Conditions</p>
                          <p className="text-[11px] text-slate-700 mt-0.5">
                            {channels || "—"}
                            <span className="text-slate-300 mx-1.5">·</span>
                            {condCount > 0
                              ? `${condCount} condition${condCount === 1 ? "" : "s"} (${row.condition_logic || "AND"})`
                              : "Always send"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {showClone && (
                        <button
                          type="button"
                          title="Clone"
                          disabled={busyId === row.id}
                          onClick={(e) => handleClone(row, e)}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-transparent hover:border-indigo-100 transition-colors disabled:opacity-50"
                        >
                          {busyId === row.id ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                        </button>
                      )}
                      {(canEdit || viewOnly) && (
                        <button
                          type="button"
                          title={viewOnly ? "View" : "Edit"}
                          onClick={() => onEdit?.(row)}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-transparent hover:border-indigo-100 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {canDelete && !viewOnly && (
                        <button
                          type="button"
                          title="Delete"
                          disabled={busyId === row.id}
                          onClick={(e) => handleDelete(row, e)}
                          className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 transition-colors disabled:opacity-50"
                        >
                          {busyId === row.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}
