"use client";

import React from "react";
import { GripVertical, Pencil, Trash2, Copy, ArrowDownToLine } from "lucide-react";
import { DASHBOARD_CONTAINER_BG, DASHBOARD_WIDGET_BG, DASHBOARD_WIDGET_BORDER, resolveDashboardThemeBg, resolvePublishWidgetBorder, shadowForPublish } from "../utils/dashboardBuilderTheme";

export const HANDLE_STYLES = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true,
};

/** Class used with Rnd `dragHandleClassName` for containers (and toolbar grip). */
export const DRAG_HANDLE_CLASS = "simple-drag-handle";

const RESIZE_HANDLE_STYLE = {
  width: "10px",
  height: "10px",
  background: "#3b82f6",
  border: "2px solid #fff",
  borderRadius: "2px",
  zIndex: 50,
};

export const RESIZE_HANDLE_STYLES = {
  top: { ...RESIZE_HANDLE_STYLE, width: "24px", height: "8px", top: "2px", left: "50%", marginLeft: "-12px", cursor: "ns-resize" },
  right: { ...RESIZE_HANDLE_STYLE, width: "8px", height: "24px", right: "2px", top: "50%", marginTop: "-12px", cursor: "ew-resize" },
  bottom: { ...RESIZE_HANDLE_STYLE, width: "24px", height: "8px", bottom: "2px", left: "50%", marginLeft: "-12px", cursor: "ns-resize" },
  left: { ...RESIZE_HANDLE_STYLE, width: "8px", height: "24px", left: "2px", top: "50%", marginTop: "-12px", cursor: "ew-resize" },
  topRight: { ...RESIZE_HANDLE_STYLE, top: "2px", right: "2px", cursor: "nesw-resize" },
  bottomRight: { ...RESIZE_HANDLE_STYLE, bottom: "2px", right: "2px", cursor: "nwse-resize" },
  bottomLeft: { ...RESIZE_HANDLE_STYLE, bottom: "2px", left: "2px", cursor: "nesw-resize" },
  topLeft: { ...RESIZE_HANDLE_STYLE, top: "2px", left: "2px", cursor: "nwse-resize" },
};

/** Hide handles without disableResizing — that can break Rnd pointer hit-testing. */
export function resizeHandleStylesForSelection(isSelected) {
  if (isSelected) return RESIZE_HANDLE_STYLES;
  const hidden = {};
  Object.keys(RESIZE_HANDLE_STYLES).forEach((key) => {
    hidden[key] = {
      ...RESIZE_HANDLE_STYLES[key],
      opacity: 0,
      pointerEvents: "none",
      width: 0,
      height: 0,
    };
  });
  return hidden;
}

export function selectionStyle(isSelected, isContainer = false) {
  if (!isSelected) return {};
  return {
    borderRadius: isContainer ? 10 : 6,
  };
}

/** Builder-only shell so widgets/containers are visually distinct on the canvas. */
export function builderWidgetShellClass(widget = {}, isContainer = false) {
  if (isContainer) {
    return "bg-slate-100/90 border-2 border-dashed border-slate-300";
  }
  const raw = String(widget.rawType || widget.type || "").toLowerCase();
  if (raw === "heading") return "bg-transparent border border-transparent";
  return "bg-white border border-slate-200 shadow-sm";
}

/** Shared widget card shell — identical in builder preview + publish (WYSIWYG). */
export function parityWidgetBodyShellStyle(style = {}, { isContainer = false, nested = false, publish = false } = {}) {
  const s = style && typeof style === "object" ? style : {};
  const css = {};
  const savedBg = resolveDashboardThemeBg(s.bg, null);
  if (savedBg && !isContainer) css.backgroundColor = savedBg;
  if (isContainer && savedBg) css.backgroundColor = savedBg;
  if (Number.isFinite(Number(s.borderRadius))) css.borderRadius = `${Number(s.borderRadius)}px`;
  if (s.border && !(publish && isContainer)) {
    const border = publish ? resolvePublishWidgetBorder(s.border) : s.border;
    if (border) css.border = border;
  }
  if (publish && isContainer) css.border = "none";
  if (!publish && s.boxShadow && s.boxShadow !== "none") css.boxShadow = s.boxShadow;
  if (publish) css.boxShadow = shadowForPublish(s.boxShadow);
  const pad = Number.isFinite(Number(s.padding)) ? Number(s.padding) : null;
  if (pad != null) css.padding = `${pad}px`;
  if (isContainer) {
    return {
      ...css,
      backgroundColor: css.backgroundColor || DASHBOARD_CONTAINER_BG,
    };
  }
  if (nested) {
    const resolvedBorder = publish
      ? resolvePublishWidgetBorder(s.border)
      : (css.border || DASHBOARD_WIDGET_BORDER);
    return {
      ...css,
      backgroundColor: css.backgroundColor || DASHBOARD_WIDGET_BG,
      border: publish ? (resolvedBorder || "none") : (resolvedBorder || DASHBOARD_WIDGET_BORDER),
      boxShadow: publish ? "none" : (css.boxShadow || "inset 0 0 0 1px rgba(15, 23, 42, 0.06)"),
    };
  }
  const resolvedBorder = publish
    ? resolvePublishWidgetBorder(s.border)
    : (css.border || DASHBOARD_WIDGET_BORDER);
  return {
    ...css,
    backgroundColor: css.backgroundColor || DASHBOARD_WIDGET_BG,
    border: publish ? (resolvedBorder || "none") : (resolvedBorder || DASHBOARD_WIDGET_BORDER),
    boxShadow: publish ? "none" : (css.boxShadow || "0 1px 2px rgba(15, 23, 42, 0.06)"),
  };
}

export function builderWidgetTypeLabel(widget = {}, isContainer = false) {
  if (isContainer) return "Container";
  const raw = String(widget.rawType || widget.type || "widget").toLowerCase();
  if (raw === "kpi" || raw === "count" || raw === "sum") return "KPI";
  if (raw === "graph" || raw === "bar" || raw === "line" || raw === "pie" || raw === "area") return "Chart";
  if (raw === "hybrid") return "Hybrid";
  if (raw === "heading") return "Heading";
  if (raw === "table") return "Table";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Do not stopPropagation on the toolbar root — that blocks react-rnd drag.
 *  Fire on pointerdown: react-rnd often swallows the subsequent click. */
function toolbarAction(handler) {
  return (e) => {
    e.preventDefault();
    e.stopPropagation();
    handler?.(e);
  };
}

function swallowClick(e) {
  e.preventDefault();
  e.stopPropagation();
}

export function SimpleWidgetToolbar({ onEdit, onClone, onDelete, onSendToBottom }) {
  return (
    <div
      className="simple-widget-toolbar absolute top-1 left-1 z-30 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 shadow-sm"
      data-simple-toolbar="true"
    >
      <div
        className={`${DRAG_HANDLE_CLASS} grid h-5 w-5 cursor-grab place-items-center rounded hover:bg-slate-100 hover:cursor-grab active:cursor-grabbing`}
        title="Move"
        style={{ cursor: "grab" }}
      >
        <GripVertical size={11} className="pointer-events-none text-slate-400" />
      </div>
      <button
        type="button"
        title="Edit"
        className="simple-no-drag grid h-5 w-5 place-items-center rounded text-slate-600 hover:bg-slate-100"
        onPointerDown={toolbarAction(onEdit)}
        onClick={swallowClick}
      >
        <Pencil size={10} />
      </button>
      <button
        type="button"
        title="Clone"
        className="simple-no-drag grid h-5 w-5 place-items-center rounded text-slate-600 hover:bg-slate-100"
        onPointerDown={toolbarAction(onClone)}
        onClick={swallowClick}
      >
        <Copy size={10} />
      </button>
      {typeof onSendToBottom === "function" ? (
        <button
          type="button"
          title="Send to bottom"
          className="simple-no-drag grid h-5 w-5 place-items-center rounded text-slate-600 hover:bg-slate-100"
          onPointerDown={toolbarAction(onSendToBottom)}
          onClick={swallowClick}
        >
          <ArrowDownToLine size={10} />
        </button>
      ) : null}
      <button
        type="button"
        title="Delete"
        className="simple-no-drag grid h-5 w-5 place-items-center rounded text-rose-500 hover:bg-rose-50"
        onPointerDown={toolbarAction(onDelete)}
        onClick={swallowClick}
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}
