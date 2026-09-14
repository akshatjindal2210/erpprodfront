"use client";

/**
 * Global Ctrl/Cmd + K quick launch — user types a short code (e.g. "IS" for
 * Store In) and presses Enter to jump directly to that page. Suggestions
 * shown below the input are exact-prefix filtered by typed text.
 *
 * Codes are gated by the SAME permission stack used everywhere else:
 *   - app-level: userHasAppAccess (Redux state.auth.app_access)
 *   - page-level: useCanAccess(module, "view")   (Redux state.auth.permissions)
 *
 * A user without app access to, say, HRMS won't see HRMS codes and typing
 * one won't navigate.
 *
 * Stays dormant while any drawer / center modal / file preview is open so
 * those overlays keep keyboard focus and their own hotkeys.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { Zap, X, CornerDownLeft } from "lucide-react";
import { selectRole, selectPermissions, selectAppAccess } from "@/platform/store/slices/authSlice";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { userHasAppAccess } from "@/config/moduleAppRegistry";
import { QUICK_LAUNCH_CODES } from "@/config/quickLaunchCodes";
import { isFilePreviewOpen } from "@/platform/utils/system/filePreviewGate";

function isTypingTarget(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  const tag = String(el.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest?.("[contenteditable='true']"));
}

/**
 * Block Quick Launch while ANY overlay owns the screen:
 * - top-level drawer OR nested/sub-drawer (`data-app-drawer-root`)
 * - center OverlayModal / app overlays (`data-app-overlay-root`)
 * - any other modal (`role="dialog"`), except Quick Launch itself
 * - file preview
 */
function shouldBlockQuickLaunchOpen() {
  if (typeof document === "undefined") return false;
  if (isFilePreviewOpen()) return true;

  // Nested drawers each mount their own root — any count > 0 means block.
  if (document.documentElement.hasAttribute("data-app-drawer-open")) return true;
  if (document.querySelector("[data-app-drawer-root]")) return true;

  // OverlayModal + drawers also mark this; covers center modals.
  if (document.querySelector("[data-app-overlay-root]")) return true;

  // Custom modals that only set role=dialog (exclude our own palette).
  for (const el of document.querySelectorAll('[role="dialog"]')) {
    if (el.hasAttribute("data-quick-launch-root")) continue;
    if (el.closest?.("[data-quick-launch-root]")) continue;
    return true;
  }

  return false;
}

export default function QuickLaunchDialog() {
  const router = useRouter();
  const canAccess = useCanAccess();
  const role = useSelector(selectRole);
  const permissions = useSelector(selectPermissions);
  const appAccess = useSelector(selectAppAccess);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Only codes the user is actually allowed to reach — same rules as sidebar.
  const permittedCodes = useMemo(() => {
    return QUICK_LAUNCH_CODES.filter((entry) => {
      if (entry.app && !userHasAppAccess(entry.app, role, permissions, appAccess)) {
        return false;
      }
      if (!entry.module) return true;
      const access = canAccess(entry.module, "view");
      return access.allowed;
    });
  }, [canAccess, role, permissions, appAccess]);

  // Blank → full permitted list (scrollable). Typing → prefix-filter by code.
  const suggestions = useMemo(() => {
    const q = String(query || "").trim().toUpperCase();
    if (!q) return permittedCodes;
    return permittedCodes.filter((entry) => entry.code.toUpperCase().startsWith(q));
  }, [permittedCodes, query]);

  // Reset highlight when the filtered list changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, suggestions.length]);

  // Keep the highlighted row visible inside the scrollable list.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector(`[data-quick-launch-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const closeDialog = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const navigateTo = useCallback(
    (entry) => {
      if (!entry?.route) return;
      // Final safety check — permission may have changed between render + click.
      const isPermitted = permittedCodes.some((e) => e.code === entry.code);
      if (!isPermitted) return;
      router.push(entry.route);
      closeDialog();
    },
    [router, permittedCodes, closeDialog],
  );

  const tryExactJump = useCallback(
    (raw) => {
      const q = String(raw || "").trim().toUpperCase();
      if (!q) return false;
      const exact = permittedCodes.find((entry) => entry.code.toUpperCase() === q);
      if (!exact) return false;
      navigateTo(exact);
      return true;
    },
    [permittedCodes, navigateTo],
  );

  // Lock page scroll while open; list scrolls on its own.
  useEffect(() => {
    if (!open) return undefined;
    const scrollY = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Ctrl/Cmd+K opens the palette. Letter/digit keys also open it when you
  // are not typing in a field — so "IS" / "TR" work without a modifier.
  // Never open over an existing drawer / modal / file preview.
  useEffect(() => {
    const onKey = (e) => {
      const isMod = e.ctrlKey || e.metaKey;
      const key = String(e.key || "");
      const lower = key.toLowerCase();

      if (isMod && lower === "k") {
        e.preventDefault();
        if (openRef.current) {
          closeDialog();
          return;
        }
        if (shouldBlockQuickLaunchOpen()) return;
        openRef.current = true;
        setOpen(true);
        setQuery("");
        setActiveIndex(0);
        return;
      }

      if (lower === "escape" && openRef.current) {
        e.preventDefault();
        closeDialog();
        return;
      }

      if (isMod || e.altKey) return;
      if (e.repeat) return;
      if (key.length !== 1 || !/[a-z0-9]/i.test(key)) return;

      // Dialog input already has focus — let onChange handle it.
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      // Only gate *opening*. Once open, our own role="dialog" would otherwise
      // trip isAppOverlayOpen and block further bare-key typing.
      if (!openRef.current && shouldBlockQuickLaunchOpen()) return;

      e.preventDefault();
      const ch = key.toUpperCase();
      if (!openRef.current) {
        openRef.current = true;
        setOpen(true);
        setQuery(ch);
        setActiveIndex(0);
      } else {
        setQuery((prev) => `${prev}${ch}`.slice(0, 4));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDialog]);

  // Exact code (e.g. IS, TR) jumps after a short pause so barcode scanners
  // that dump a longer string don't get stolen by a 2-letter code.
  useEffect(() => {
    if (!open) return undefined;
    const q = String(query || "").trim().toUpperCase();
    if (!q) return undefined;
    const id = window.setTimeout(() => {
      tryExactJump(q);
    }, 280);
    return () => window.clearTimeout(id);
  }, [open, query, tryExactJump]);

  // Autofocus when opened.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  const moveActive = (delta) => {
    if (!suggestions.length) return;
    setActiveIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return suggestions.length - 1;
      if (next >= suggestions.length) return 0;
      return next;
    });
  };

  const handleInputKeyDown = (e) => {
    if (!suggestions.length) return;
    const key = e.key;

    if (key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
      return;
    }
    if (key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
      return;
    }
    // Tab / Shift+Tab cycles the highlighted option without leaving the dialog.
    if (key === "Tab") {
      e.preventDefault();
      moveActive(e.shiftKey ? -1 : 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = String(query || "").trim().toUpperCase();

    // 1. Exact permitted code wins (do not use unfiltered catalog).
    if (q) {
      const exact = permittedCodes.find((entry) => entry.code.toUpperCase() === q);
      if (exact) {
        navigateTo(exact);
        return;
      }
    }

    // 2. Else jump to the highlighted (or first) permitted suggestion.
    if (suggestions.length > 0) {
      const pick = suggestions[Math.min(Math.max(activeIndex, 0), suggestions.length - 1)];
      navigateTo(pick);
    }
  };

  if (!open) return null;

  return (
    <div
      data-quick-launch-root
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[10vh] px-4 overscroll-none"
      onMouseDown={(e) => {
        // click on backdrop closes; click inside panel does not.
        if (e.target === e.currentTarget) closeDialog();
      }}
      onWheel={(e) => {
        // Stop background page scroll; the suggestions list handles its own wheel.
        if (!listRef.current?.contains(e.target)) {
          e.preventDefault();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Quick Launch"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
            <Zap size={16} className="text-indigo-600 shrink-0" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a code (IS, TR…) — Enter to jump"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-bold uppercase tracking-wider text-slate-800 placeholder:normal-case placeholder:font-medium placeholder:text-slate-400 placeholder:tracking-normal"
              aria-label="Quick launch code"
              aria-activedescendant={
                suggestions[activeIndex]
                  ? `quick-launch-option-${suggestions[activeIndex].code}`
                  : undefined
              }
              autoComplete="off"
              spellCheck={false}
              maxLength={4}
            />
            <button
              type="button"
              onClick={closeDialog}
              className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              aria-label="Close quick launch"
            >
              <X size={14} />
            </button>
          </div>
        </form>

        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto overscroll-contain"
          role="listbox"
          aria-label="Quick launch suggestions"
        >
          {suggestions.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                No matching code
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Try a different code or clear the input to browse everything you can access.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {suggestions.map((entry, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <li key={entry.code} role="presentation">
                    <button
                      type="button"
                      id={`quick-launch-option-${entry.code}`}
                      data-quick-launch-index={idx}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => navigateTo(entry)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors group ${
                        isActive ? "bg-indigo-50" : "hover:bg-indigo-50"
                      }`}
                    >
                      <span
                        className={`shrink-0 min-w-[2.75rem] inline-flex items-center justify-center px-1.5 py-0.5 rounded border text-[10px] font-black uppercase tracking-widest ${
                          isActive
                            ? "border-indigo-300 bg-white text-indigo-700"
                            : "border-slate-300 bg-slate-50 text-slate-700 group-hover:border-indigo-300 group-hover:bg-white group-hover:text-indigo-700"
                        }`}
                      >
                        {entry.code}
                      </span>
                      <span
                        className={`flex-1 min-w-0 text-[12px] font-semibold truncate ${
                          isActive ? "text-indigo-800" : "text-slate-700 group-hover:text-indigo-800"
                        }`}
                      >
                        {entry.label}
                      </span>
                      {isActive ? (
                        <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Enter <CornerDownLeft size={10} />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-slate-400">
          <span>↑↓ / Tab to select · Enter to jump</span>
          <span>
            or{" "}
            <kbd className="px-1 py-0.5 border border-slate-300 bg-white text-slate-600 rounded">Ctrl</kbd>
            {" + "}
            <kbd className="px-1 py-0.5 border border-slate-300 bg-white text-slate-600 rounded">K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
