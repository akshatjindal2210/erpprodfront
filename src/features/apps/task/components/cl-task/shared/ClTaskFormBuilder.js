"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  CheckSquare,
  CircleDot,
  List,
  Paperclip,
} from "lucide-react";
import { getFieldTypeMeta, newFormField } from "@/features/apps/task/helpers/clTaskFormHelper";
import ClTaskFormFieldEditor from "./ClTaskFormFieldEditor";

const QUICK_ADD = [
  { type: "short_text", label: "Text", icon: null },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "radio", label: "Radio", icon: CircleDot },
  { type: "dropdown", label: "Dropdown", icon: List },
  { type: "attachment", label: "File", icon: Paperclip },
];

export default function ClTaskFormBuilder({ fields = [], onChange }) {
  const [editing, setEditing] = useState(null); // null | "new" | number
  const [quickSeed, setQuickSeed] = useState(null);

  const openAdd = (seedType = null) => {
    setQuickSeed(seedType ? newFormField(seedType) : null);
    setEditing("new");
  };
  const openEdit = (idx) => {
    setQuickSeed(null);
    setEditing(idx);
  };
  const closeEditor = () => {
    setEditing(null);
    setQuickSeed(null);
  };

  const handleSave = (field) => {
    if (editing === "new") {
      onChange([...fields, field]);
    } else if (typeof editing === "number") {
      onChange(fields.map((f, i) => (i === editing ? field : f)));
    }
    closeEditor();
  };

  const removeField = (idx) => {
    onChange(fields.filter((_, i) => i !== idx));
    if (editing === idx) closeEditor();
    else if (typeof editing === "number" && editing > idx) setEditing(editing - 1);
  };

  const moveField = (idx, dir) => {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
    if (editing === idx) setEditing(target);
    else if (editing === target) setEditing(idx);
  };

  const isEditing = editing !== null;

  const fieldSummary = (field) => {
    if (field.type === "attachment") return "File upload";
    if (field.type === "checkbox") return "Yes / No";
    if (["dropdown", "radio", "multiselect"].includes(field.type)) {
      const n = (field.options || []).filter(Boolean).length;
      return n ? `${n} option${n === 1 ? "" : "s"}` : "No options yet";
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">What should they fill in?</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
          Optional — add text, checkbox, radio, dropdown (with your own options), or file upload.
        </p>
      </div>

      {fields.length === 0 && !isEditing ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5">
          <div className="text-center mb-4">
            <HelpCircle size={22} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-600 font-medium">No questions yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Start with a common type, or skip and create the task.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 mb-3">
            {QUICK_ADD.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => openAdd(type)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
              >
                {Icon ? <Icon size={12} /> : null}
                {label}
              </button>
            ))}
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={() => openAdd()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <Plus size={14} /> Add a question
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {fields.map((field, idx) =>
            editing === idx ? (
              <li key={field.id}>
                <ClTaskFormFieldEditor
                  initialField={field}
                  onSave={handleSave}
                  onCancel={closeEditor}
                />
              </li>
            ) : (
              <li
                key={field.id}
                className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {getFieldTypeMeta(field.type).label}
                    </span>
                    {field.required ? (
                      <span className="text-[10px] font-semibold text-rose-500">Required</span>
                    ) : null}
                    {fieldSummary(field) ? (
                      <span className="text-[10px] text-slate-400">· {fieldSummary(field)}</span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate mt-0.5">
                    {field.label || "Untitled"}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0 || isEditing}
                    onClick={() => moveField(idx, -1)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg"
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === fields.length - 1 || isEditing}
                    onClick={() => moveField(idx, 1)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg"
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={isEditing}
                    onClick={() => openEdit(idx)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30 rounded-lg"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={isEditing}
                    onClick={() => removeField(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {editing === "new" ? (
        <ClTaskFormFieldEditor
          initialField={quickSeed}
          onSave={handleSave}
          onCancel={closeEditor}
        />
      ) : null}

      {!isEditing && fields.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ADD.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => openAdd(type)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
              >
                {Icon ? <Icon size={11} /> : null}
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => openAdd()}
            className="w-full py-2.5 rounded-xl border border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> Add another question
          </button>
        </div>
      ) : null}
    </div>
  );
}
