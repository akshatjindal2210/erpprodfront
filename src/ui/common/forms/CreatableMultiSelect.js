"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, Plus, Search, X } from "lucide-react";
import { FORM_ERROR_CLASS, FORM_HINT_CLASS } from "@/ui/common/Constants";

const normalizeName = (raw) => String(raw ?? "").replace(/\s+/g, " ").trim();
const nameKey = (raw) => normalizeName(raw).toLowerCase();

/**
 * Multi-select tag input: type to search `fetchService`, pick existing rows, or add a new name.
 * `value` / `onChange` use `[{ id?, name }]` — rows without `id` are new and must be created by the save API.
 */
export default function CreatableMultiSelect({
  value = [],
  onChange,
  fetchService,
  placeholder = "Type to search or add…",
  error = "",
  helperText = "",
  disabled = false,
  maxLength = 100,
  dataField,
  heightClass = "min-h-10",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropPos, setDropPos] = useState(null);

  const shellRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const fetchSeqRef = useRef(0);
  const fetchServiceRef = useRef(fetchService);
  useEffect(() => { fetchServiceRef.current = fetchService; }, [fetchService]);

  const selected = Array.isArray(value) ? value : [];
  const selectedKeys = new Set(selected.map((s) => nameKey(s?.name)));
  const query = normalizeName(search);
  const queryKey = query.toLowerCase();

  const visibleOptions = options.filter((o) => !selectedKeys.has(nameKey(o?.name))).sort((a, b) => (nameKey(b.name) === queryKey) - (nameKey(a.name) === queryKey));
  const hasExactOption = options.some((o) => nameKey(o?.name) === queryKey);
  const canCreate = query !== "" && !hasExactOption && !selectedKeys.has(queryKey);
  const rows = canCreate ? [{ __create: true, name: query }, ...visibleOptions] : visibleOptions;
  const highlighted = Math.min(activeIndex, rows.length - 1);

  const calcPosition = useCallback(() => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelHeight = 240;
    const openUp = window.innerHeight - rect.bottom < panelHeight && rect.top > window.innerHeight - rect.bottom;
    setDropPos({
      left: rect.left,
      width: rect.width,
      top: openUp ? Math.max(8, rect.top - panelHeight - 4) : rect.bottom + 4,
    });
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    calcPosition();
    setOpen(true);
  }, [disabled, calcPosition]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const seq = ++fetchSeqRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchServiceRef.current?.({ search: query });
        if (seq !== fetchSeqRef.current) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setOptions(list.filter((o) => normalizeName(o?.name)));
        setActiveIndex(0);
      } catch {
        if (seq === fetchSeqRef.current) setOptions([]);
      } finally {
        if (seq === fetchSeqRef.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", calcPosition, true);
    window.addEventListener("resize", calcPosition);
    return () => {
      window.removeEventListener("scroll", calcPosition, true);
      window.removeEventListener("resize", calcPosition);
    };
  }, [open, calcPosition]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (shellRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, [open, closeMenu]);

  const addRow = (row) => {
    if (!row) return;
    const name = normalizeName(row.name);
    if (!name || selectedKeys.has(name.toLowerCase())) return;
    onChange?.([...selected, row.__create ? { name } : { id: row.id, name }]);
    setSearch("");
    setActiveIndex(0);
    inputRef.current?.focus();
    calcPosition();
  };

  const removeAt = (idx) => {
    onChange?.(selected.filter((_, i) => i !== idx));
    calcPosition();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!open) return openMenu();
      addRow(rows[highlighted]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return openMenu();
      setActiveIndex(Math.min(highlighted + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(Math.max(highlighted - 1, 0));
    } else if (e.key === "Backspace" && !search && selected.length) {
      removeAt(selected.length - 1);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      closeMenu();
    } else if (e.key === "Tab") {
      closeMenu();
    }
  };

  const dropdown = open && dropPos ? createPortal(
    <div
      ref={dropdownRef}
      data-searchable-select-portal=""
      style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 10050 }}
      className="searchable-select-dropdown bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-100"
    >
      <ul className="max-h-[220px] overflow-y-auto overscroll-y-contain custom-scrollbar">
        {loading && rows.length === 0 ? (
          <li className="p-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin text-indigo-500" /> Loading…
          </li>
        ) : rows.length === 0 ? (
          <li className="p-6 text-center text-xs text-slate-400">
            {query ? "Already added" : "Type a name to add a new one"}
          </li>
        ) : (
          rows.map((row, idx) => (
            <li
              key={row.__create ? "__create" : row.id}
              onMouseDown={(e) => { e.preventDefault(); addRow(row); }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`px-3 py-2 border-b border-slate-50 last:border-0 cursor-pointer text-[13px] leading-snug transition-colors flex items-center gap-2 ${
                highlighted === idx ? "bg-indigo-50/50" : "hover:bg-slate-50"
              } ${row.__create ? "text-indigo-700 font-medium" : "text-slate-700"}`}
            >
              {row.__create ? (
                <>
                  <Plus size={13} className="shrink-0" />
                  <span className="truncate">Add &ldquo;{row.name}&rdquo;</span>
                </>
              ) : (
                <span className="truncate">{row.name}</span>
              )}
            </li>
          ))
        )}
      </ul>
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-1" data-field={dataField}>
      <div
        ref={shellRef}
        onClick={() => {
          if (disabled) return;
          openMenu();
          inputRef.current?.focus();
        }}
        className={`w-full min-w-0 ${heightClass} h-auto py-1 px-3 border bg-white rounded-lg flex items-center gap-1.5 sm:gap-2 transition-all duration-200 ${
          disabled
            ? "bg-slate-50 cursor-not-allowed opacity-75 border-slate-200"
            : open
              ? "border-slate-500 shadow-sm cursor-text"
              : error
                ? "border-rose-400 ring-rose-50 ring-1 cursor-text"
                : "border-slate-200 hover:border-slate-400 cursor-text"
        }`}
      >
        <Search size={13} className={`shrink-0 self-center ${open ? "text-indigo-500" : "text-slate-400"}`} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 py-0.5">
          {selected.map((item, idx) => (
            <span
              key={item.id ?? `new-${nameKey(item.name)}`}
              title={item.id ? undefined : "New — created on save"}
              className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                item.id
                  ? "border-indigo-100 bg-indigo-50 text-indigo-700"
                  : "border-dashed border-emerald-300 bg-emerald-50 text-emerald-700"
              }`}
            >
              <span className="truncate">{item.name}</span>
              {!disabled ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); removeAt(idx); }}
                  className="shrink-0 hover:text-rose-500 transition-colors"
                >
                  <X size={10} />
                </button>
              ) : null}
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={search}
            maxLength={maxLength}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(0);
              if (!open) openMenu();
            }}
            onFocus={openMenu}
            onKeyDown={handleKeyDown}
            placeholder={selected.length ? "Add more…" : placeholder}
            className="min-w-[6rem] flex-1 self-center bg-transparent outline-none text-base md:text-sm font-normal text-slate-800 placeholder:text-slate-400"
          />
        </div>
      </div>
      {helperText ? <p className={FORM_HINT_CLASS}>{helperText}</p> : null}
      {error ? <p className={FORM_ERROR_CLASS}><AlertCircle size={12} /> {error}</p> : null}
      {dropdown}
    </div>
  );
}
