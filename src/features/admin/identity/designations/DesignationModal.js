"use client";
import { useState, useEffect } from "react";
import { X, Save, Award } from "lucide-react";
import { toast } from "react-toastify";
import { designationService } from "@/features/admin/services/designationService";

export default function DesignationModal({ open, onClose, onSuccess, editData }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
  });

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name || "",
      });
    } else {
      setFormData({
        name: "",
      });
    }
  }, [editData, open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return toast.error("Designation name is required");
    }

    setLoading(true);
    try {
      if (editData) {
        await designationService.update(editData.id, formData);
        toast.success("Designation updated successfully");
      } else {
        await designationService.create(formData);
        toast.success("Designation created successfully");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md shadow-2xl border border-slate-200 rounded-none overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 flex items-center justify-center rounded-none shadow-sm">
              <Award size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                {editData ? "Edit Designation" : "New Designation"}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">
                {editData ? `ID: ${editData.id}` : "Create a new entry"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors rounded-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-0.5">
                Designation Name <span className="text-rose-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Manager, Developer, Executive..."
                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none rounded-none placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 rounded-none"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {editData ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

