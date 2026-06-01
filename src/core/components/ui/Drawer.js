"use client";
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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
  /** Ctrl+Alt+P / Ctrl+P (PWA) — same as a toolbar Print action while this drawer is open. */
  onPrintHotkey,
  canPrintHotkey,
  title, 
  description, 
  children, 
  footer, 
  maxWidth = "max-w-2xl", 
  closeOnOutside = false, 
  noPadding = false,
  /** When false, body does not scroll — child must use flex + min-h-0 for inner scroll (wide drawers). */
  bodyScrollable = true,
  /** `form` = sentence-case title, softer subtitle (user modals, etc.). */
  headerVariant = "default",
}) => {
  const isFormHeader = headerVariant === "form";
  const printHotkeyRef = useRef({ onPrintHotkey, canPrintHotkey });
  printHotkeyRef.current = { onPrintHotkey, canPrintHotkey };
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.setAttribute('data-app-drawer-open', 'true');

      const handleKeyDown = (e) => {
        // 1. ESC to Close
        if (e.key === 'Escape') {
          onClose?.();
          return;
        }
        
        // 2. Ctrl + S to Submit/Save
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          if (onSubmit) {
            e.preventDefault();
            onSubmit();
          }
          return;
        }

        // 3. Print hotkey (capture early — Ctrl+Alt+P in browser; Ctrl+P in PWA)
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
        document.body.style.overflow = 'unset';
        document.documentElement.removeAttribute('data-app-drawer-open');
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.removeAttribute('data-app-drawer-open');
    }
  }, [isOpen, onClose, onSubmit]);

  const blockBackdropInteraction = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (closeOnOutside) onClose?.();
  };

  if (!isOpen || !mounted) return null;

  const drawerTree = (
    <div data-app-drawer-root className="fixed inset-0 z-[1050] overflow-hidden flex justify-end isolate">
      <div
        role="presentation"
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-slate-900/50 transition-opacity duration-200 touch-none"
        onMouseDown={blockBackdropInteraction}
        onTouchStart={blockBackdropInteraction}
        onClick={blockBackdropInteraction}
      />

      <div className={`relative z-10 ml-auto w-full min-w-0 ${maxWidth} bg-white flex flex-col h-[100dvh] max-h-[100dvh] min-h-0 animate-in slide-in-from-right duration-200 border-l border-slate-300 shadow-2xl`}>
        
        <div className={`flex items-start sm:items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 shrink-0 z-30 min-w-0 ${isFormHeader ? "bg-white" : "bg-slate-50"}`}>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            {isFormHeader ? (
              <>
                <h3 className="text-base font-semibold text-slate-900 min-w-0 break-words">{title}</h3>
                {description ? (
                  <p className="text-sm text-slate-500 leading-snug break-words">{description}</p>
                ) : null}
              </>
            ) : (
              <>
                <h3 className="text-[11px] sm:text-[12px] font-black text-slate-800 uppercase tracking-wider flex items-start gap-2 min-w-0">
                  <span className="w-1 h-4 bg-indigo-600 inline-block shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words leading-snug">{title}</span>
                </h3>
                {description && (
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight ml-3 sm:ml-4 leading-snug break-words">
                    {description}
                  </p>
                )}
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
          className={`flex-1 min-h-0 overflow-x-hidden custom-scrollbar bg-white flex flex-col ${
            bodyScrollable ? "overflow-y-auto" : "overflow-hidden"
          } ${noPadding ? "p-0" : "p-3 sm:p-4"}`}
        >
          {children}
        </div>

        {footer && (
          <div className="px-3 sm:px-4 py-2 border-t border-slate-200 flex justify-end items-center bg-slate-50 sticky bottom-0 z-30">
            <div className="flex w-full sm:w-auto gap-2 items-center justify-end flex-wrap">
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(drawerTree, document.body);
};

export default Drawer;