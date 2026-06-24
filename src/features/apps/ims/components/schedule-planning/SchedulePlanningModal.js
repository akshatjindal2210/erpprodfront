"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Save, Loader2, Calendar } from "lucide-react";
import Drawer from "@/core/components/ui/Drawer";
import ModuleSopAcknowledgment from "@/core/components/common/ModuleSopAcknowledgment";

export default function SchedulePlanningModal({ open, onClose, editData, mode }) {
  const [entries, setEntries] = useState([{ date: "", qty: "" }]);
  const [loading, setLoading] = useState(false);
  const sopAckRef = useRef(null);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && editData?.plans) {
        setEntries(editData.plans);
      } else {
        setEntries([{ date: "", qty: "" }]);
      }
    }
  }, [open, mode, editData]);

  const addEntry = () => {
    setEntries([...entries, { date: "", qty: "" }]);
  };

  const removeEntry = (index) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    setEntries(newEntries);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    
    const validEntries = entries.filter(e => e.date && e.qty);
    if (validEntries.length === 0) {
      alert("Please add at least one valid dispatch entry.");
      return;
    }

    // Standard ERP pattern: Check SOP acknowledgment before submit
    if (sopAckRef.current && !sopAckRef.current.assertAcknowledged()) {
      return;
    }

    setLoading(true);
    
    const payload = {
      id: editData?.id,
      item_code: editData?.item_code,
      mode: mode,
      plans: validEntries,
      timestamp: new Date().toISOString(),
    };
    
    console.log("FINAL PAYLOAD LOGGED:", payload);
    
    // Simulate a small delay for better UX
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 500);
  };

  const footer = (
    <div className="flex justify-end gap-3 w-full">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="min-w-[140px] px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        {mode === "add" ? "Save Plan" : "Update Plan"}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={mode === "add" ? "Add Dispatch Plan" : "Edit Dispatch Plan"}
      description={mode === "add" ? "Plan multiple dispatch dates for this item" : "Update existing dispatch plan"}
      maxWidth="max-w-2xl"
      footer={footer}
    >
      <div className="space-y-6 pb-4">
        {/* Item Context Header */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-sm">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Code</label>
            <p className="text-sm font-black text-slate-800 uppercase">{editData?.item_code || "—"}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</label>
            <p className="text-sm font-bold text-slate-700 truncate" title={editData?.customer_name || ""}>
              {editData?.customer_name || "—"}
            </p>
          </div>
        </div>

        {/* Entries Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
              <Calendar size={14} /> Dispatch Schedule
            </h3>
            <button
              type="button"
              onClick={addEntry}
              className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} /> Add Row
            </button>
          </div>

          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div key={index} className="flex items-end gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block ml-1">Dispatch Date</label>
                  <input
                    type="date"
                    required
                    value={entry.date}
                    onChange={(e) => updateEntry(index, "date", e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block ml-1">Quantity</label>
                  <input
                    type="number"
                    required
                    placeholder="Enter qty"
                    value={entry.qty}
                    onChange={(e) => updateEntry(index, "qty", e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeEntry(index)}
                  disabled={entries.length === 1}
                  className="h-10 w-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-20 transition-all shrink-0"
                  title="Remove row"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Summary / Info */}
        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg">
          <p className="text-[10px] text-indigo-700 font-medium leading-relaxed">
            <span className="font-bold uppercase tracking-tight">Note:</span> Each entry represents a separate dispatch planned for this item. Total planned quantity will be updated upon saving.
          </p>
        </div>

        {/* SOP Acknowledgment */}
        <ModuleSopAcknowledgment
          ref={sopAckRef}
          moduleSlug="schedule_planning"
          permissionType={mode === "edit" ? "edit" : "add"}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}
