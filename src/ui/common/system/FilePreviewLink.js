"use client";

import { useCallback, useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, Image as ImageIcon, Maximize, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { ALLOW_FILE_DOWNLOAD } from "@/platform/config/filePreviewConfig";
import { enterFilePreview, leaveFilePreview } from "@/platform/utils/system/filePreviewGate";

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

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;
const INITIAL_VIEW = { scale: 1, x: 0, y: 0 };

const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

function pointFromCenter(element, e) {
  const rect = element?.getBoundingClientRect();
  if (!rect) return undefined;
  return {
    x: e.clientX - rect.left - rect.width / 2,
    y: e.clientY - rect.top - rect.height / 2,
  };
}

function ToolbarButton({ onClick, label, shortcut, disabled = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/15 active:bg-white/20 disabled:opacity-35 disabled:pointer-events-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />;
}

function FilePreviewOverlay({ url, fileName, kind, onClose }) {
  const [rotation, setRotation] = useState(0);
  const [view, setView] = useState(INITIAL_VIEW);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const imageSideways = rotation % 180 !== 0;
  const isImage = kind === "image";
  const zoomed = view.scale > 1;

  /** `point` is relative to the stage center; omitted means zoom around the center. */
  const zoomBy = useCallback((factor, point) => {
    setView((v) => {
      const scale = clampZoom(v.scale * factor);
      if (scale === v.scale) return v;
      if (scale <= 1) return { scale, x: 0, y: 0 };
      const px = point?.x ?? 0;
      const py = point?.y ?? 0;
      const ratio = scale / v.scale;
      return { scale, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  }, []);

  const resetView = useCallback(() => setView(INITIAL_VIEW), []);

  // Non-passive listener so the wheel zooms the image instead of scrolling the page.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isImage) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.002);
      zoomBy(factor, pointFromCenter(stage, e));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [isImage, zoomBy]);

  const handlePointerDown = (e) => {
    if (!isImage || !zoomed || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: view.x, originY: view.y };
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    setView((v) => ({
      ...v,
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    }));
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const handleDoubleClick = (e) => {
    if (!isImage) return;
    if (view.scale !== 1) resetView();
    else zoomBy(2.5, pointFromCenter(stageRef.current, e));
  };

  // Gate before paint. Defer leave so other ESC handlers on the same keydown
  // still see the preview as open (drawer must not close on this ESC).
  useLayoutEffect(() => {
    enterFilePreview();
    return () => {
      queueMicrotask(() => leaveFilePreview());
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onCloseRef.current?.();
        return;
      }
      if (!isImage || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") zoomBy(ZOOM_STEP);
      else if (e.key === "-" || e.key === "_") zoomBy(1 / ZOOM_STEP);
      else if (e.key === "0") resetView();
      else if (e.key === "r" || e.key === "R") {
        setRotation((deg) => (deg + (e.shiftKey ? 270 : 90)) % 360);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isImage, zoomBy, resetView]);

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
      data-file-preview-overlay="true"
      onClick={() => onCloseRef.current?.()}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 bg-black/40 border-b border-white/10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0 text-white">
          {isImage ? (
            <ImageIcon size={16} className="shrink-0 opacity-80" />
          ) : (
            <FileText size={16} className="shrink-0 opacity-80" />
          )}
          <span className="text-sm font-medium truncate">{fileName || "Preview"}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isImage ? (
            <>
              <div className="flex items-center gap-0.5 rounded-xl bg-white/10 px-1 py-0.5">
                <ToolbarButton
                  onClick={() => zoomBy(1 / ZOOM_STEP)}
                  label="Zoom out"
                  shortcut="-"
                  disabled={view.scale <= MIN_ZOOM}
                >
                  <ZoomOut size={18} />
                </ToolbarButton>
                <button
                  type="button"
                  onClick={resetView}
                  className="min-w-[3.5rem] px-1.5 py-1 rounded-md text-xs font-semibold tabular-nums text-white/90 hover:bg-white/15 transition-colors"
                  aria-label="Reset zoom to 100%"
                  title="Reset zoom (0)"
                >
                  {Math.round(view.scale * 100)}%
                </button>
                <ToolbarButton
                  onClick={() => zoomBy(ZOOM_STEP)}
                  label="Zoom in"
                  shortcut="+"
                  disabled={view.scale >= MAX_ZOOM}
                >
                  <ZoomIn size={18} />
                </ToolbarButton>
              </div>
              <ToolbarButton
                onClick={resetView}
                label="Fit to screen"
                shortcut="0"
                disabled={view.scale === 1 && view.x === 0 && view.y === 0}
              >
                <Maximize size={18} />
              </ToolbarButton>
              <ToolbarDivider />
              <ToolbarButton
                onClick={() => setRotation((deg) => (deg + 270) % 360)}
                label="Rotate left"
                shortcut="Shift+R"
              >
                <RotateCcw size={18} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => setRotation((deg) => (deg + 90) % 360)}
                label="Rotate right"
                shortcut="R"
              >
                <RotateCw size={18} />
              </ToolbarButton>
              <ToolbarDivider />
            </>
          ) : null}
          {ALLOW_FILE_DOWNLOAD ? (
            <ToolbarButton onClick={() => downloadFileInPlace(url, fileName)} label="Download">
              <Download size={18} />
            </ToolbarButton>
          ) : null}
          <ToolbarButton onClick={() => onCloseRef.current?.()} label="Close" shortcut="Esc">
            <X size={20} />
          </ToolbarButton>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`relative flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6 ${isImage ? "overflow-hidden select-none touch-none" : ""} ${isImage ? (dragging ? "cursor-grabbing" : zoomed ? "cursor-grab" : "cursor-zoom-in") : ""}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={handleDoubleClick}
      >
        {isImage ? (
          <>
            <img
              src={url}
              alt={fileName || "Attachment"}
              className={`object-contain rounded-lg shadow-2xl ease-out ${dragging ? "" : "transition-transform duration-150"} ${imageSideways ? "max-h-[85vmin] max-w-[85vmin]" : "max-w-full max-h-full"}`}
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale}) rotate(${rotation}deg)`,
              }}
              draggable={ALLOW_FILE_DOWNLOAD && !zoomed}
              onContextMenu={ALLOW_FILE_DOWNLOAD ? undefined : (e) => e.preventDefault()}
            />
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white/75 whitespace-nowrap">
              {zoomed
                ? "Scroll to zoom · Drag to move · Double-click to reset"
                : "Scroll or double-click to zoom"}
            </div>
          </>
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
          key={href}
          url={href}
          fileName={fileName}
          kind={kind}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
