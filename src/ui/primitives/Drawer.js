"use client";
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { isFilePreviewOpen } from "@/platform/utils/system/filePreviewGate";

function drawerIsTypingTarget(target) {
  if (!target?.tagName) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return !!target.isContentEditable;
}

const Drawer = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onPrintHotkey,
  canPrintHotkey,
  title, 
  description, 
  children,
  banner,
  footer, 
  maxWidth = "max-w-2xl", 
  closeOnOutside = false, 
  noPadding = false,
  bodyScrollable = true,
  headerVariant = "default",
  stackLevel = 0,
}) => {
  const drawerRootRef = useRef(null);
  const zBase = 1050 + stackLevel * 50;
  const isFormHeader = headerVariant === "form";
  const printHotkeyRef = useRef({ onPrintHotkey, canPrintHotkey });
  const onCloseRef = useRef(onClose);
  const onSubmitRef = useRef(onSubmit);
  const scrollLockYRef = useRef(0);
  printHotkeyRef.current = { onPrintHotkey, canPrintHotkey };
  onCloseRef.current = onClose;
  onSubmitRef.current = onSubmit;
  const [mounted, setMounted] = useState(false);
  const [alive, setAlive] = useState(false);
  const [openAnim, setOpenAnim] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;
    if (isOpen) {
      setAlive(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpenAnim(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setOpenAnim(false);
    const t = setTimeout(() => setAlive(false), 180);
    return () => clearTimeout(t);
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!alive) {
      document.documentElement.removeAttribute("data-app-drawer-open");
      return undefined;
    }

    scrollLockYRef.current = window.scrollY;
    const prevBody = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollLockYRef.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.documentElement.setAttribute("data-app-drawer-open", "true");

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // First ESC closes file preview only — do not close drawer yet.
        if (isFilePreviewOpen()) return;
        const roots = [...document.querySelectorAll("[data-app-drawer-root]")];
        const topLevel = roots.reduce((max, el) => {
          const level = Number(el.dataset.drawerStackLevel || 0);
          return level > max ? level : max;
        }, -1);
        if (stackLevel < topLevel) return;
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (onSubmitRef.current) {
          e.preventDefault();
          onSubmitRef.current();
        }
        return;
      }

      const { onPrintHotkey: onPrint, canPrintHotkey: canPrint } = printHotkeyRef.current;
      if (typeof onPrint !== "function") return;
      if (drawerIsTypingTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const isP =
        e.key?.toLowerCase() === "p" ||
        e.code === "KeyP";
      if (!isP) return;

      const listChord = mod && e.altKey && !e.shiftKey;
      const listChordPwa = mod && !e.altKey && !e.shiftKey;
      if (!listChord && !listChordPwa) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();

      const allowed = typeof canPrint === "function" ? canPrint() : true;
      if (!allowed) return;
      onPrint();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.body.style.overflow = prevBody.overflow;
      document.body.style.position = prevBody.position;
      document.body.style.top = prevBody.top;
      document.body.style.left = prevBody.left;
      document.body.style.right = prevBody.right;
      document.body.style.width = prevBody.width;
      document.documentElement.removeAttribute('data-app-drawer-open');
      window.removeEventListener('keydown', handleKeyDown, true);
      window.scrollTo(0, scrollLockYRef.current);
    };
  }, [alive, stackLevel]);

  const handleBackdropPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (closeOnOutside) onClose?.();
  };

  if (!alive || !mounted) return null;

  const drawerTree = (
    <div
      ref={drawerRootRef}
      data-app-drawer-root
      data-drawer-stack-level={stackLevel}
      className="fixed inset-0 isolate"
      style={{ zIndex: zBase }}
    >
      <div
        role="presentation"
        aria-hidden="true"
        className={`absolute inset-0 z-0 bg-slate-900/45 touch-none cursor-default erp-drawer-backdrop${openAnim ? " is-open" : ""}`}
        onPointerDown={handleBackdropPointerDown}
      />

      <div
        className={`fixed inset-y-0 right-0 z-10 flex w-full min-w-0 flex-col overflow-hidden bg-white border-l border-slate-300 shadow-2xl erp-drawer-panel${openAnim ? " is-open" : " is-closing"} ${maxWidth}`}
        style={{ height: "100dvh", maxHeight: "100dvh" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        
        <div className={`flex items-start sm:items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 shrink-0 z-30 min-w-0 ${isFormHeader ? "bg-white" : "bg-slate-50"}`}>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            {isFormHeader ? (
              <>
                <h3 className="text-base font-semibold text-slate-900 min-w-0 break-words">{title}</h3>
                {description != null && description !== "" ? (
                  typeof description === "string" ? (
                    <p className="text-sm text-slate-500 leading-snug break-words">{description}</p>
                  ) : (
                    <div className="text-sm text-slate-500 leading-snug break-words">{description}</div>
                  )
                ) : null}
              </>
            ) : (
              <>
                <h3 className="text-[11px] sm:text-[12px] font-black text-slate-800 uppercase tracking-wider flex items-start gap-2 min-w-0">
                  <span className="w-1 h-4 bg-indigo-600 inline-block shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words leading-snug">{title}</span>
                </h3>
                {description != null && description !== "" ? (
                  typeof description === "string" ? (
                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight ml-3 sm:ml-4 leading-snug break-words">
                      {description}
                    </p>
                  ) : (
                    <div className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight ml-3 sm:ml-4 leading-snug break-words">
                      {description}
                    </div>
                  )
                ) : null}
              </>
            )}
          </div>
          
          <button 
            type="button"
            aria-label="Close"
            onClick={onClose} 
            className="p-1.5 shrink-0 border border-transparent hover:border-slate-200 hover:bg-white text-slate-400 hover:text-rose-600 transition-all shadow-none"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div
          className={`flex flex-1 min-h-0 flex-col overflow-x-hidden bg-white ${
            bodyScrollable
              ? "overflow-y-auto overscroll-y-contain touch-pan-y custom-scrollbar"
              : "overflow-hidden"
          }`}
        >
          {banner ? <div className="shrink-0">{banner}</div> : null}

          {/* When bodyScrollable=false, children manage scroll — wrapper must constrain height. */}
          <div
            className={
              bodyScrollable
                ? noPadding
                  ? "p-0"
                  : "p-3 sm:p-4"
                : `flex flex-1 min-h-0 flex-col overflow-hidden ${noPadding ? "p-0" : "p-3 sm:p-4"}`
            }
          >
            {children}
          </div>
        </div>

        {footer ? (
          <div className="shrink-0 px-3 sm:px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-slate-200 flex justify-end items-center bg-slate-50">
            <div className="flex w-full items-center justify-end gap-3 flex-row flex-nowrap">
              {footer}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(drawerTree, document.body);
};

export default Drawer;
