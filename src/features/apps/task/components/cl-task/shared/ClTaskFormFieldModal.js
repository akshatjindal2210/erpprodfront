"use client";

import { useEffect, useState } from "react";
import Drawer from "@/core/components/ui/Drawer";
import {
  CL_FORM_FIELD_TYPES,
  FIELDS_WITH_OPTIONS,
  newFormField,
  getFieldTypeMeta,
  getDefaultFieldWidth,
  validateFormSchemaFields,
} from "@/features/apps/task/helpers/clTaskFormHelper";
import { inputBase } from "./clTaskFormUi";
import ClTaskFormOptionEditor from "./ClTaskFormOptionEditor";

const GROUPS = [...new Set(CL_FORM_FIELD_TYPES.map((t) => t.group))];

export default function ClTaskFormFieldModal({ open, initialField = null, onClose, onSave }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setDraft(initialField ? { ...initialField, options: [...(initialField.options || [])] } : newFormField("short_text"));
  }, [open, initialField]);

  const isSection = draft?.type === "section";
  const hasOptions = draft ? FIELDS_WITH_OPTIONS.includes(draft.type) : false;
  const meta = draft ? getFieldTypeMeta(draft.type) : { label: "Field" };

  const setType = (type) => {
    if (!draft) return;
    const next = newFormField(type);
    setDraft({
      ...next,
      id: draft.id,
      label: draft.label,
      help_text: draft.help_text,
      required: draft.required,
      width: getDefaultFieldWidth(type),
      ...(FIELDS_WITH_OPTIONS.includes(type) ? { options: draft.options?.length ? draft.options : next.options } : {}),
      ...(type === "query_dropdown" ? { queryOptions: draft.queryOptions || "" } : {}),
    });
  };

  const handleOk = () => {
    if (!draft) return;
    const err = validateFormSchemaFields([draft]);
    if (err) {
      setError(err);
      return;
    }
    onSave?.(draft);
    onClose?.();
  };

  return (
    <Drawer
      isOpen={open && !!draft}
      onClose={onClose}
      onSubmit={handleOk}
      closeOnOutside={false}
      stackLevel={1}
      title={initialField ? "Edit Field" : "Add Field"}
      description={`${meta.label} · choose type & label, then OK`}
      headerVariant="form"
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOk}
            className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700"
          >
            OK
          </button>
        </>
      }
    >
      {draft && (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Field type</p>
            <div className="space-y-2">
              {GROUPS.map((group) => (
                <div key={group}>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">{group}</p>
                  <div className="flex flex-wrap gap-1">
                    {CL_FORM_FIELD_TYPES.filter((t) => t.group === group).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                          draft.type === value
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {isSection ? "Section Title *" : "Field Label *"}
            </label>
            <input
              className={inputBase}
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder={isSection ? "e.g. Machine Details" : "e.g. Machine Name"}
              autoFocus
            />
          </div>

          {!isSection && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Row width</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: "half", label: "Half row", hint: "Shares space with next field" },
                  { value: "full", label: "Full row", hint: "Takes entire width" },
                ].map(({ value, label, hint }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, width: value }))}
                    className={`px-2 py-1.5 rounded-md text-left border transition-all ${
                      (draft.width || getDefaultFieldWidth(draft.type)) === value
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                    }`}
                  >
                    <span className="block text-[11px] font-bold">{label}</span>
                    <span
                      className={`block text-[9px] mt-0.5 ${
                        (draft.width || getDefaultFieldWidth(draft.type)) === value ? "text-indigo-100" : "text-slate-400"
                      }`}
                    >
                      {hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Help text</label>
            <input
              className={inputBase}
              value={draft.help_text || ""}
              onChange={(e) => setDraft((d) => ({ ...d, help_text: e.target.value }))}
              placeholder="Optional hint for the user"
            />
          </div>

          {(draft.type === "short_text" || draft.type === "text" || draft.type === "numeric" || draft.type === "email" || draft.type === "phone") && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Placeholder</label>
              <input
                className={inputBase}
                value={draft.placeholder || ""}
                onChange={(e) => setDraft((d) => ({ ...d, placeholder: e.target.value }))}
              />
            </div>
          )}

          {draft.type === "numeric" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Min</label>
                <input
                  type="number"
                  className={inputBase}
                  value={draft.min ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value === "" ? null : Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Max</label>
                <input
                  type="number"
                  className={inputBase}
                  value={draft.max ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value === "" ? null : Number(e.target.value) }))}
                />
              </div>
            </div>
          )}

          {hasOptions && (
            <ClTaskFormOptionEditor
              label={draft.type === "radio" ? "Radio Options" : draft.type === "multiselect" ? "Multi-Select Values" : "Dropdown Values"}
              hint="One value per row"
              options={draft.options || []}
              onChange={(options) => setDraft((d) => ({ ...d, options }))}
            />
          )}

          {draft.type === "query_dropdown" && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Suggestions</label>
              <textarea
                className={`${inputBase} min-h-[72px] resize-y font-mono text-xs`}
                value={draft.queryOptions || ""}
                onChange={(e) => setDraft((d) => ({ ...d, queryOptions: e.target.value }))}
                rows={4}
                placeholder={"One per line"}
              />
            </div>
          )}

          {!isSection && (
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={!!draft.required}
                onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
                className="rounded border-slate-300 accent-indigo-600"
              />
              Required field
            </label>
          )}

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
      )}
    </Drawer>
  );
}
