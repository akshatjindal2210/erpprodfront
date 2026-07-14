"use client";

import React from "react";
import { GripVertical, Pencil, Trash2, Copy, ArrowDownToLine } from "lucide-react";

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

const RESIZE_HANDLE_STYLE = {
  width: "12px",
  height: "12px",
  background: "#3b82f6",
  border: "2px solid #fff",
  borderRadius: "2px",
  zIndex: 50,
};

export const RESIZE_HANDLE_STYLES = {
  top: { ...RESIZE_HANDLE_STYLE, width: "28px", height: "10px", top: "-1px", left: "50%", marginLeft: "-14px", cursor: "ns-resize" },
  right: { ...RESIZE_HANDLE_STYLE, width: "10px", height: "28px", right: "-1px", top: "50%", marginTop: "-14px", cursor: "ew-resize" },
  bottom: { ...RESIZE_HANDLE_STYLE, width: "28px", height: "10px", bottom: "-1px", left: "50%", marginLeft: "-14px", cursor: "ns-resize" },
  left: { ...RESIZE_HANDLE_STYLE, width: "10px", height: "28px", left: "-1px", top: "50%", marginTop: "-14px", cursor: "ew-resize" },
  topRight: { ...RESIZE_HANDLE_STYLE, top: "-1px", right: "-1px", cursor: "nesw-resize" },
  bottomRight: { ...RESIZE_HANDLE_STYLE, bottom: "-1px", right: "-1px", cursor: "nwse-resize" },
  bottomLeft: { ...RESIZE_HANDLE_STYLE, bottom: "-1px", left: "-1px", cursor: "nesw-resize" },
  topLeft: { ...RESIZE_HANDLE_STYLE, top: "-1px", left: "-1px", cursor: "nwse-resize" },
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
    outline: "2px solid #3b82f6",
    outlineOffset: 0,
    borderRadius: isContainer ? 8 : 6,
    boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.25)",
  };
}

/** Do not stopPropagation on the toolbar root — that blocks react-rnd drag. */
export function SimpleWidgetToolbar({ onEdit, onClone, onDelete, onSendToBottom }) {
  return (
    <div className="absolute top-1 left-1 z-30 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
      <div
        className="grid h-5 w-5 cursor-grab place-items-center rounded hover:bg-slate-100 active:cursor-grabbing"
        title="Drag"
      >
        <GripVertical size={11} className="pointer-events-none text-slate-400" />
      </div>
      <button
        type="button"
        title="Edit"
        className="simple-no-drag grid h-5 w-5 place-items-center rounded text-slate-600 hover:bg-slate-100"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onEdit}
      >
        <Pencil size={10} />
      </button>
      <button
        type="button"
        title="Clone"
        className="simple-no-drag grid h-5 w-5 place-items-center rounded text-slate-600 hover:bg-slate-100"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onClone}
      >
        <Copy size={10} />
      </button>
      {typeof onSendToBottom === "function" ? (
        <button
          type="button"
          title="Send to bottom"
          className="simple-no-drag grid h-5 w-5 place-items-center rounded text-slate-600 hover:bg-slate-100"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onSendToBottom}
        >
          <ArrowDownToLine size={10} />
        </button>
      ) : null}
      <button
        type="button"
        title="Delete"
        className="simple-no-drag grid h-5 w-5 place-items-center rounded text-rose-500 hover:bg-rose-50"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onDelete}
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}
