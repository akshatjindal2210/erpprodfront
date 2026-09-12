"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

function resolveRowColumnValue(row, columnKey) {
  if (!row || typeof row !== "object") return "";
  if (row[columnKey] !== undefined && row[columnKey] !== null) return row[columnKey];
  const target = String(columnKey || "").trim().toLowerCase();
  const matchedKey = Object.keys(row).find((key) => String(key).trim().toLowerCase() === target);
  return matchedKey ? row[matchedKey] : row[columnKey];
}

function isInsideFilterUi(target) {
  if (!target?.closest) return false;
  return Boolean(
    target.closest("[data-dashboard-column-filter], [data-dashboard-column-filter-menu]"),
  );
}

export default function DashboardTableColumnFilter({
  columnKey,
  data = [],
  getCellText,
  selected = [],
  onChange,
  compact = false,
  isPhoneMode = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 220, maxHeight: 260 });
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);

  const options = useMemo(() => {
    const seen = new Set();
    const out = [];
    (Array.isArray(data) ? data : []).forEach((row) => {
      const raw = resolveRowColumnValue(row, columnKey);
      const text = String(getCellText(raw) ?? "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      out.push(text);
    });
    return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  }, [columnKey, data, getCellText]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  const syncMenuPos = () => {
    const node = rootRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const width = Math.max(rect.width, isPhoneMode ? 180 : 240);
    const maxHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const top = openUp
      ? Math.max(8, rect.top - maxHeight - 4)
      : rect.bottom + 4;
    setMenuPos({
      top,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
      width,
      maxHeight,
    });
  };

  const openMenu = () => {
    syncMenuPos();
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  useEffect(() => {
    optionRefs.current = optionRefs.current.slice(0, filteredOptions.length);
  }, [filteredOptions.length]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;
    const onTabExit = () => closeMenu();
    input.addEventListener("dashboard-column-filter-tab-exit", onTabExit);
    return () => input.removeEventListener("dashboard-column-filter-tab-exit", onTabExit);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    syncMenuPos();
    const closeIfOutside = (event) => {
      if (isInsideFilterUi(event.target)) return;
      closeMenu();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeMenu();
    };
    const onResize = () => syncMenuPos();
    const onScroll = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      syncMenuPos();
    };
    document.addEventListener("mousedown", closeIfOutside, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", closeIfOutside, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, isPhoneMode]);

  const picked = Array.isArray(selected) ? selected : [];

  const toggleValue = (value) => {
    const set = new Set(picked);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange(Array.from(set));
  };

  const clearAll = () => {
    onChange([]);
    setQuery("");
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openMenu();
      if (!filteredOptions.length) return;
      setActiveIndex((prev) => {
        if (event.key === "ArrowDown") {
          return prev < 0 ? 0 : Math.min(prev + 1, filteredOptions.length - 1);
        }
        return prev <= 0 ? 0 : prev - 1;
      });
      return;
    }

    if (!open) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeIndex >= 0 && filteredOptions[activeIndex]) {
        toggleValue(filteredOptions[activeIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }
  };

  const heightPx = isPhoneMode ? 22 : compact ? 24 : 26;
  const fs = isPhoneMode ? 11 : 10;
  const placeholder = picked.length
    ? (picked.length === 1 ? picked[0] : `${picked.length} selected`)
    : "Filter…";
  const listMaxHeight = menuPos.maxHeight - (picked.length ? 34 : 0);
  const listId = `dcf-list-${String(columnKey).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

  const menu = open ? (
    <div
      ref={menuRef}
      data-dashboard-column-filter-menu
      data-no-widget-link
      id={listId}
      role="listbox"
      aria-label={`Filter options for ${columnKey}`}
      aria-multiselectable="true"
      className="simple-no-drag flex flex-col overflow-hidden rounded border border-slate-300 bg-white shadow-2xl"
      style={{
        position: "fixed",
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
        maxHeight: menuPos.maxHeight,
        zIndex: 10050,
        fontSize: `${fs}px`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="overflow-y-auto overscroll-y-contain py-1 custom-scrollbar"
        style={{ maxHeight: listMaxHeight, touchAction: "pan-y" }}
        onWheel={(e) => e.stopPropagation()}
      >
        {filteredOptions.length ? filteredOptions.map((opt, idx) => {
          const checked = picked.includes(opt);
          const highlighted = activeIndex === idx;
          return (
            <button
              key={opt}
              ref={(node) => { optionRefs.current[idx] = node; }}
              type="button"
              id={`${listId}-opt-${idx}`}
              role="option"
              aria-selected={checked}
              className={`flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                checked ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
              } ${highlighted ? "ring-2 ring-inset ring-blue-400/50" : ""}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (e.button === 0) e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleValue(opt);
              }}
              onFocus={() => setActiveIndex(idx)}
            >
              <span
                className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded border ${
                  checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                }`}
              >
                {checked ? <Check size={10} strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1 break-words leading-snug">{opt}</span>
            </button>
          );
        }) : (
          <div className="px-2 py-3 text-center text-slate-400">
            {options.length ? "No matches" : "No values"}
          </div>
        )}
      </div>
      {picked.length ? (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-2 py-1">
          <button
            type="button"
            className="w-full text-left text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            onMouseDown={(e) => {
              e.stopPropagation();
              if (e.button === 0) e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
          >
            Clear ({picked.length})
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <div
        ref={rootRef}
        data-dashboard-column-filter
        data-no-widget-link
        className="simple-no-drag relative z-[80] w-full min-w-0 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex w-full min-w-0 items-center rounded border border-slate-300 bg-white"
          style={{ height: heightPx, boxSizing: "border-box" }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
              if (!open) openMenu();
            }}
            onFocus={() => openMenu()}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent px-1.5 focus:outline-none"
            style={{ color: "#334155", fontSize: `${fs}px`, height: heightPx }}
            aria-label={`Filter column ${columnKey}`}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              open && activeIndex >= 0 && filteredOptions[activeIndex]
                ? `${listId}-opt-${activeIndex}`
                : undefined
            }
            autoComplete="off"
          />
          {picked.length ? (
            <button
              type="button"
              className="shrink-0 p-1 text-slate-500 hover:text-slate-800"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAll();
              }}
              aria-label="Clear column filter"
            >
              <X size={12} />
            </button>
          ) : null}
          <button
            type="button"
            className="shrink-0 p-1 text-slate-500 hover:text-slate-800"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (open) closeMenu();
              else openMenu();
            }}
            aria-label={`Toggle filter options for ${columnKey}`}
          >
            <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
