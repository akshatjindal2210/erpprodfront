"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, X } from "lucide-react";
import { useEscapeKey } from "@/core/hooks/useEscapeKey";
import { ALLOW_FILE_DOWNLOAD } from "@/core/config/filePreviewConfig";

export function getFilePreviewKind(fileName = "", mimeType = "") {
  const name = String(fileName || "");
  const mime = String(mimeType || "").toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(name)) {
    return "image";
  }
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) {
    return "pdf";
  }
  return "other";
}

export async function downloadFileInPlace(url, fileName = "download") {
  if (!url || !ALLOW_FILE_DOWNLOAD) return false;

  try {
    const res = await fetch(url, { credentials: "include", mode: "cors" });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "download";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "download";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }
}

function FilePreviewOverlay({ url, fileName, kind, onClose }) {
  useEscapeKey(onClose, true);

  const pdfSrc =
    kind === "pdf" && !ALLOW_FILE_DOWNLOAD
      ? `${String(url).split("#")[0]}#toolbar=0`
      : url;

  const body = (
    <div
      className="fixed inset-0 z-[10050] flex flex-col bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={fileName || "File preview"}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 bg-black/40 border-b border-white/10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0 text-white">
          <FileText size={16} className="shrink-0 opacity-80" />
          <span className="text-sm font-medium truncate">{fileName || "Preview"}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {ALLOW_FILE_DOWNLOAD ? (
            <button
              type="button"
              onClick={() => downloadFileInPlace(url, fileName)}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Download"
              title="Download"
            >
              <Download size={18} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "image" ? (
          <img
            src={url}
            alt={fileName || "Attachment"}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            draggable={ALLOW_FILE_DOWNLOAD}
            onContextMenu={ALLOW_FILE_DOWNLOAD ? undefined : (e) => e.preventDefault()}
          />
        ) : (
          <iframe
            src={pdfSrc}
            title={fileName || "Document"}
            className="w-full h-full max-w-5xl rounded-lg bg-white shadow-2xl border-0"
          />
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

export default function FilePreviewLink({
  href,
  fileName = "",
  mimeType = "",
  className = "",
  title,
  children,
  onClick,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const kind = getFilePreviewKind(fileName, mimeType);
  const canPreview = kind === "image" || kind === "pdf";

  const handleClick = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick?.(e);
      if (!href) return;

      if (canPreview) {
        setOpen(true);
        return;
      }

      await downloadFileInPlace(href, fileName || "download");
    },
    [href, fileName, canPreview, onClick]
  );

  return (
    <>
      <a
        href={href || "#"}
        className={className}
        title={title || fileName}
        onClick={handleClick}
        {...rest}
      >
        {children}
      </a>
      {open && href ? (
        <FilePreviewOverlay
          url={href}
          fileName={fileName}
          kind={kind}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
