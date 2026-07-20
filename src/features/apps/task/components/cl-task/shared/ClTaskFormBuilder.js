"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, LayoutTemplate } from "lucide-react";
import { getFieldGridClass } from "@/features/apps/task/helpers/clTaskFormHelper";
import ClTaskFormFieldModal from "./ClTaskFormFieldModal";
import ClTaskFormFieldPreview from "./ClTaskFormFieldPreview";

export default function ClTaskFormBuilder({ fields = [], onChange }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  const openAdd = () => {
    setEditIndex(null);
    setModalOpen(true);
  };

  const openEdit = (idx) => {
    setEditIndex(idx);
    setModalOpen(true);
  };

  const handleSave = (field) => {
    if (editIndex == null) {
      onChange([...fields, field]);
    } else {
      onChange(fields.map((f, i) => (i === editIndex ? field : f)));
    }
  };

  const removeField = (idx) => onChange(fields.filter((_, i) => i !== idx));

  const moveField = (idx, dir) => {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Form fields</p>
          <p className="text-[9px] text-slate-400">Assignee preview</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <Plus size={12} /> Add Field
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="flex items-center justify-between gap-3 border border-dashed border-slate-200 rounded-md bg-slate-50/70 py-2.5 px-3">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutTemplate size={16} className="text-slate-300 shrink-0" />
            <p className="text-[11px] text-slate-500 truncate">
              No fields yet — assignee gets an empty form
            </p>
          </div>
          <button type="button" onClick={openAdd} className="shrink-0 text-[11px] font-bold text-indigo-600 hover:underline">
            Add first field
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-2.5 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
            User preview · {fields.length} field{fields.length === 1 ? "" : "s"} · short fields share a row
          </p>
          <div className="grid grid-cols-2 gap-2">
            {fields.map((field, idx) => (
              <div key={field.id} className={`relative group min-w-0 ${getFieldGridClass(field)}`}>
                <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white/95 border border-slate-200 rounded-md shadow-sm px-0.5 py-0.5">
                  <button type="button" disabled={idx === 0} onClick={() => moveField(idx, -1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move up">
                    <ChevronUp size={12} />
                  </button>
                  <button type="button" disabled={idx === fields.length - 1} onClick={() => moveField(idx, 1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move down">
                    <ChevronDown size={12} />
                  </button>
                  <button type="button" onClick={() => openEdit(idx)} className="p-1 text-slate-400 hover:text-indigo-600" title="Edit">
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => removeField(idx)} className="p-1 text-slate-400 hover:text-rose-600" title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
                <ClTaskFormFieldPreview field={field} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="w-full py-1.5 rounded-md border border-dashed border-slate-200 text-[11px] font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-white flex items-center justify-center gap-1"
          >
            <Plus size={12} /> Add another field
          </button>
        </div>
      )}

      <ClTaskFormFieldModal
        open={modalOpen}
        initialField={editIndex != null ? fields[editIndex] : null}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
