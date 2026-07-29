"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit3, Trash2, Info } from "lucide-react";
import { toast } from "react-toastify";
import { trainingVideoService } from "@/apps/settings/lib/services/trainingService";
import RichTextEditor from "@/ui/primitives/RichTextEditor";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { focusFirstError } from "@/platform/utils/form/formFocus";

const FIELD_ORDER = ["title", "video_url"];

function getYouTubeEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = new URLSearchParams(u.search).get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    return url;
  } catch {
    return url;
  }
}

export default function VideoModal({ slot, onClose, onSuccess }) {
  const [form, setForm] = useState({ title: "", description: "", video_url: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const sopAckRef = useRef(null);
  const sopDeleteAckRef = useRef(null);
  const formRef = useRef(null);

  const readOnly = slot?.isEdit && !slot?.canEdit;
  const ex = slot?.existingData;

  useEffect(() => {
    if (ex) {
      setForm({
        title: ex.title || "",
        description: ex.description || "",
        video_url: ex.video_url || "",
      });
    } else {
      setForm({ title: "", description: "", video_url: "" });
    }
    setErrors({});
  }, [slot]);

  const handleSave = async () => {
    if (readOnly) return;
    if (slot.isEdit && !slot.canEdit) {
      toast.error("You do not have permission to edit training videos.");
      return;
    }
    if (!slot.isEdit && !slot.canAdd) {
      toast.error("You do not have permission to add training videos.");
      return;
    }

    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.video_url.trim()) e.video_url = "Video URL is required";

    if (Object.keys(e).length) {
      setErrors(e);
      toast.warning("Please fill required fields");
      focusFirstError(e, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }

    if (!sopAckRef.current?.assertAcknowledged()) return;

    setSaving(true);
    try {
      const payload = {
        module_id: slot.modId,
        permission_type: slot.perm,
        ...form,
      };

      if (slot.isEdit) {
        await trainingVideoService.update(slot.id, payload);
        toast.success("Video updated successfully");
      } else {
        await trainingVideoService.create(payload);
        toast.success("Video saved successfully");
      }
      onSuccess();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!slot.canDelete) {
      toast.error("You do not have permission to remove training videos.");
      return;
    }
    if (sopDeleteAckRef.current && !sopDeleteAckRef.current.assertAcknowledged()) return;
    if (!confirm("Are you sure you want to remove this video?")) return;
    setSaving(true);
    try {
      await trainingVideoService.delete(slot.id);
      toast.success("Video removed successfully");
      onSuccess();
    } catch (err) {
      toast.error(err?.message || "Failed to remove video");
    } finally {
      setSaving(false);
    }
  };

  const footerActions = (
    <div className="flex items-center justify-between w-full gap-2 flex-wrap">
      {slot.isEdit && slot.canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving || readOnly}
          className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} />
          Remove
        </button>
      )}
      <div className="flex-1 min-w-[8px]" />
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || readOnly || (slot.isEdit ? !slot.canEdit : !slot.canAdd)}
          className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
        >
          {saving ? "Processing..." : "Save"}
        </button>
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={!!slot}
      onClose={onClose}
      onSubmit={readOnly ? undefined : handleSave}
      title={
        <div className="flex items-center gap-2">
          {slot.isEdit ? <Edit3 size={20} className="text-indigo-600" /> : <Plus size={20} className="text-indigo-600" />}
          <span className="font-bold">{slot.perm.toUpperCase()} Permission Video</span>
        </div>
      }
      description={slot.modLabel}
      footer={footerActions}
      maxWidth="max-w-2xl"
    >
      <div ref={formRef} className="space-y-6 pb-24">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Video Title *</label>
          <input
            data-field="title"
            readOnly={readOnly}
            disabled={readOnly}
            className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${errors.title ? "border-red-500" : "border-slate-200"}`}
            placeholder="e.g. How to manage inventory..."
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          {errors.title && <p className="text-red-500 text-[10px] font-medium ml-1">{errors.title}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1">
            <Info size={12} /> Description / Notes
          </label>
          <div className={readOnly ? "pointer-events-none opacity-70" : ""}>
            <RichTextEditor value={form.description} onChange={(html) => setForm({ ...form, description: html })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Video URL *</label>
          <input
            data-field="video_url"
            readOnly={readOnly}
            disabled={readOnly}
            className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${errors.video_url ? "border-red-500" : "border-slate-200"}`}
            placeholder="YouTube or MP4 link..."
            value={form.video_url}
            onChange={(e) => setForm({ ...form, video_url: e.target.value })}
          />
          {errors.video_url && <p className="text-red-500 text-[10px] font-medium ml-1">{errors.video_url}</p>}

          {form.video_url && (
            <div className="mt-3 flex justify-center">
              <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-md">
                {(form.video_url.includes("youtube.com") || form.video_url.includes("youtu.be")) ? (
                  <iframe className="w-full h-full" src={getYouTubeEmbedUrl(form.video_url)} title="Preview" allowFullScreen />
                ) : form.video_url.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video className="w-full h-full" controls><source src={form.video_url} /></video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-white/50 text-xs italic">Preview not available</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`video-sop-${slot.modId}-${slot.perm}-${slot.isEdit ? "e" : "a"}`}
          fetchEnabled={false}
          sopOverride={slot?.sopDef ?? null}
          moduleSlug="training_videos"
          permissionType={slot.perm}
          isOpen={!!slot}
          readOnly={readOnly}
        />

        {slot.isEdit && slot.canDelete && !readOnly ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Before remove</p>
            <ModuleSopAcknowledgment
              ref={sopDeleteAckRef}
              key={`video-sop-del-${slot.modId}-${slot.perm}`}
              moduleSlug="training_videos"
              permissionType="delete"
              isOpen={!!slot}
            />
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

