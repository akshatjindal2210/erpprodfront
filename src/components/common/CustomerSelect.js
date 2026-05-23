"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Search, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { masterService } from "@/services/master";

const PAGE_SIZE = 50;

export default function CustomerSelect({ 
  value, 
  onChange, 
  error = "", 
  required = false, 
  disabled = false, 
  placeholder = "Search customer name...", 
  label = "Customer", 
  showLabel = true, 
  className = "" 
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  // ── Position Logic ──────────────────────────────────────────────────
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropHeight = 260;
    const openBelow = spaceBelow >= dropHeight || spaceBelow >= rect.top;

    setDropPos({
      width: rect.width,
      left: rect.left + window.scrollX,
      top: openBelow
        ? rect.bottom + window.scrollY + 4
        : rect.top + window.scrollY - dropHeight - 4,
    });
  }, []);

  // ── Pre-fill Edit Mode (Using acc_code) ──────────────────────────────
  useEffect(() => {
    if (!value) { setSelected(null); setSearch(""); return; }
    if (selected?.acc_code == value) return;

    masterService.getLedgerById(value).then((res) => {
      const item = res?.data || res;
      if (item?.acc_code) {
        setSelected(item);
        setSearch(item.acc_name);
      }
    }).catch(() => {
      setSelected({ acc_code: value, acc_name: String(value) });
      setSearch(String(value));
    });
  }, [value]);

  // ── Fetch Logic (Using getLedgers) ──────────────────────────────────
  const fetchCustomers = useCallback(async (query, p = 1) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await masterService.getLedgers({ search: query, page: p, limit: PAGE_SIZE });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      
      setItems(prev => p === 1 ? list : [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
      setPage(p);
    } catch (err) {
      if (p === 1) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCustomers(search, 1), 300);
  }, [search, open, fetchCustomers]);

  // ── Event Handlers ──────────────────────────────────────────────────
  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      calcPosition();
      setOpen(true);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  };

  const handleSelect = (customer) => {
    setSelected(customer);
    setSearch(customer.acc_name);
    onChange(customer.acc_code, customer);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelected(null);
    setSearch("");
    onChange(null, null);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) && 
          !document.getElementById("customer-portal")?.contains(e.target)) {
        setOpen(false);
        setSearch(selected ? selected.acc_name : "");
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, selected]);

  // ── UI Styles ──────────────────────────────────────────────────────
  const baseBox = "w-full bg-white border rounded-xl text-sm transition-all duration-200 flex items-center gap-2 px-3 py-2.5";
  const boxClass = disabled ? `${baseBox} bg-slate-50 opacity-60 cursor-not-allowed`
    : error ? `${baseBox} border-rose-400 ring-4 ring-rose-50`
    : open ? `${baseBox} border-indigo-400 ring-4 ring-indigo-50 shadow-sm`
    : `${baseBox} border-slate-200 hover:border-slate-300 cursor-text`;

  // ── Portal Dropdown ─────────────────────────────────────────────────
  const dropdown = open && createPortal(
    <div id="customer-portal" style={{ ...dropPos, position: "absolute", zIndex: 99999 }}
      className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <ul ref={listRef} 
        className="max-h-[210px] overflow-y-auto divide-y divide-slate-50"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20 && hasMore && !loadingMore) {
            fetchCustomers(search, page + 1);
          }
        }}
      >
        {loading ? (
          <li className="p-4 text-center"><Loader2 size={18} className="animate-spin mx-auto text-indigo-500" /></li>
        ) : items.length === 0 ? (
          <li className="p-4 text-center text-slate-400 text-xs">No customers found</li>
        ) : (
          items.map((item) => (
            <li key={item.acc_code} onClick={() => handleSelect(item)}
              className={`px-3 py-2.5 cursor-pointer hover:bg-indigo-50/30 flex flex-col gap-0.5 ${selected?.acc_code === item.acc_code ? "bg-indigo-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="font-semibold text-slate-700 text-sm min-w-0 flex-1 whitespace-normal break-words leading-snug">{item.acc_name}</span>
                {selected?.acc_code === item.acc_code && <CheckCircle2 size={13} className="text-indigo-500 shrink-0 mt-0.5" />}
              </div>
              <span className="text-[10px] text-slate-400 font-mono uppercase">Code: {item.acc_code}</span>
            </li>
          ))
        )}
        {loadingMore && <li className="p-2 text-center"><Loader2 size={12} className="animate-spin mx-auto text-slate-300" /></li>}
      </ul>
    </div>,
    document.body
  );

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showLabel && (
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
          {label}{required && <span className="text-rose-500"> *</span>}
        </label>
      )}

      <div ref={triggerRef} className={boxClass} onClick={handleToggle}>
        <Search size={14} className={open ? "text-indigo-500" : "text-slate-400"} />
        
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400 font-medium"
        />

        <div className="flex items-center gap-1.5 ml-auto pl-2 border-l border-slate-100">
          {search && !disabled && (
            <button type="button" onClick={handleClear} className="text-slate-300 hover:text-rose-500">
              <X size={14} />
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {error && (
        <p className="text-[10px] text-rose-500 flex items-center gap-1 ml-1">
          <AlertCircle size={10} /> {error}
        </p>
      )}

      {dropdown}
    </div>
  );
}