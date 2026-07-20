"use client";

import { useRef } from "react";
import { ImageIcon, FileText, ClipboardList, X } from "lucide-react";
import { FILE_BASE_URL } from "@/core/utils/lib";

/** Normalize DB / form value → array of meta objects or File. Legacy single object supported. */
export function parseAttachments(raw) {
  if (!raw) return [];
  if (raw instanceof File) return [raw];
  if (Array.isArray(raw)) {
    return raw.filter((a) => a instanceof File || a?.file_path);
  }
  if (typeof raw === "object" && raw.file_path) return [raw];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.filter((a) => a?.file_path);
      if (p?.file_path) return [p];
    } catch {
      return [];
    }
  }
  return [];
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "";
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(0)} KB`;
}

function fileUrl(file) {
  if (!file) return null;
  if (file instanceof File) return URL.createObjectURL(file);
  if (file.preview) return file.preview;
  if (file.file_path) return `${FILE_BASE_URL}/${file.file_path}`;
  return null;
}

function fileMeta(file) {
  if (!file) return { name: "", size: 0, mime: "" };
  if (file instanceof File) {
    return { name: file.name, size: file.size, mime: file.type || "" };
  }
  return {
    name: file.file_name || file.name || "Attachment",
    size: file.size || file.file_size || 0,
    mime: file.mime_type || file.type || "",
  };
}

/**
 * IMS-style ATTACHMENTS block (multiple files):
 * dashed upload zone + emerald/rose file rows; click name/row opens file.
 */
export default function ClTaskAttachmentsField({
  /** File[] | meta[] | single File/meta | null */
  value = null,
  onChange,
  /** When true, upload zone hidden (view-only list) */
  readOnly = false,
  label = "ATTACHMENTS",
  accept = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx",
  inputId = "cl-task-attachment-input",
  maxFiles = 10,
}) {
  const inputRef = useRef(null);
  const items = parseAttachments(value);

  const handlePick = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length || !onChange) return;
    const next = [...items, ...picked].slice(0, maxFiles);
    onChange(next);
  };

  const removeAt = (e, index) => {
    e.stopPropagation();
    if (!onChange) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const canUpload = !readOnly && items.length < maxFiles;

  return (
    <div>
      {label ? (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
      ) : null}

      {canUpload && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="hidden"
            accept={accept}
            multiple
            onChange={handlePick}
          />
          <p className="text-xs text-slate-500 font-medium">Click to upload files</p>
          <p className="text-xs text-slate-300 mt-0.5">
            Multiple · Images (JPG, PNG, GIF, WEBP) · Documents (PDF, DOC, DOCX) · Max {maxFiles}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className={`${canUpload || !label ? "mt-2" : ""} space-y-1.5`}>
          {items.map((file, i) => {
            const { name, size, mime } = fileMeta(file);
            const url = fileUrl(file);
            const isImage = mime.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name);
            const isPdf = mime === "application/pdf" || /\.pdf$/i.test(name);
            const key =
              file instanceof File
                ? `new-${name}-${file.size}-${i}`
                : `${file.file_path || name}-${i}`;

            return (
              <div
                key={key}
                className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <a
                  href={url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-90"
                  onClick={(e) => {
                    if (!url) e.preventDefault();
                  }}
                >
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                      isImage ? "bg-emerald-100" : isPdf ? "bg-rose-100" : "bg-indigo-100"
                    }`}
                  >
                    {isImage ? (
                      <ImageIcon size={11} className="text-emerald-600" />
                    ) : isPdf ? (
                      <FileText size={11} className="text-rose-600" />
                    ) : (
                      <ClipboardList size={11} className="text-indigo-600" />
                    )}
                  </div>
                  <span className="text-xs text-slate-700 truncate">{name}</span>
                  {size > 0 && (
                    <span className="text-xs text-slate-400 flex-shrink-0">{formatSize(size)}</span>
                  )}
                </a>
                {!readOnly && onChange && (
                  <button
                    type="button"
                    onClick={(e) => removeAt(e, i)}
                    className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0 ml-2"
                    aria-label="Remove attachment"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Read-only compact / full preview — backs into same rows for click-open. */
export function ClTaskAttachmentView({ attachment, compact = false }) {
  const list = parseAttachments(attachment);
  if (!list.length) return null;
  return (
    <ClTaskAttachmentsField
      value={list}
      readOnly
      label={compact ? "" : "ATTACHMENTS"}
    />
  );
}
