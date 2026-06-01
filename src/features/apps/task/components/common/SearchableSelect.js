import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, AlertCircle } from "lucide-react";
import { sortOptionsByNameAsc } from "@/features/apps/task/helpers/sortOptions";

const SearchableSelect = ({ label, options = [], value, onChange, placeholder, selectCls, disabled = false, isMulti = false, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const buttonRef = useRef(null);
  const optionsContainerRef = useRef(null);
  const listRef = useRef(null);

  const sortedOptions = useMemo(() => sortOptionsByNameAsc(options), [options]);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (!buttonRef.current?.contains(e.target) && !optionsContainerRef.current?.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filter logic
  const filtered = sortedOptions.filter((opt) =>
    opt.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Selected options logic (handles both string and array)
  const selectedOptions = isMulti 
    ? sortedOptions.filter(opt => Array.isArray(value) && value.includes(opt.id))
    : sortedOptions.find(opt => String(opt.id) === String(value));

  const openDropdown = () => {
    if (buttonRef.current && !disabled) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
      setIsOpen(true);
    }
  };

  const handleSelect = (id) => {
    if (isMulti) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValue = currentValues.includes(id)
        ? currentValues.filter((v) => v !== id)
        : [...currentValues, id];
      onChange(newValue);
    } else {
      onChange(id);
      setIsOpen(false);
      setSearch("");
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
          {label}
        </label>
      )}

      <div
        ref={buttonRef}
        onClick={openDropdown}
        className={`${selectCls} relative flex flex-wrap items-center gap-1.5 w-full text-left transition-all duration-200 bg-white border 
        ${error ? "border-rose-400 ring-1 ring-rose-50" : "border-slate-200"} 
        ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "hover:border-slate-300 cursor-pointer"} 
        ${isOpen ? "ring-2 ring-indigo-50 border-indigo-400 shadow-sm" : ""} p-2 min-h-[42px] rounded-xl`}
      >
        {/* MULTI SELECT VIEW */}
        {isMulti && Array.isArray(value) && value.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((opt) => (
              <span key={opt.id} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-indigo-100">
                {opt.name}
                {!disabled && (
                  <X size={12} className="hover:text-indigo-900 cursor-pointer" 
                    onClick={(e) => { e.stopPropagation(); handleSelect(opt.id); }} 
                  />
                )}
              </span>
            ))}
          </div>
        ) : !isMulti && selectedOptions ? (
          /* SINGLE SELECT VIEW */
          <span className="text-sm text-slate-700 pl-1">{selectedOptions.name}</span>
        ) : (
          /* PLACEHOLDER */
          <span className="text-sm text-slate-400 pl-1">{placeholder}</span>
        )}

        <ChevronDown size={14} className={`ml-auto text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <div
          ref={optionsContainerRef}
          className="fixed !z-[999999] bg-white border border-slate-200 shadow-2xl rounded-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: "280px" }}
        >
          <div className="p-2 border-b border-slate-100 bg-white sticky top-0">
            <div className="flex items-center w-full bg-slate-50 rounded-lg px-2 border border-slate-100 focus-within:border-indigo-300 transition-colors">
              <Search size={14} className="text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="bg-transparent border-none outline-none w-full py-2 px-2 text-sm text-slate-600 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div ref={listRef} className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200" style={{ maxHeight: "200px" }}>
            {filtered.length > 0 ? (
              filtered.map((opt) => {
                const isSelected = isMulti 
                  ? (Array.isArray(value) && value.map(String).includes(String(opt.id)))
                  : String(value) === String(opt.id);
                
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors border-b border-slate-50 last:border-0
                      ${isSelected ? "bg-indigo-50 text-indigo-600 font-semibold" : "hover:bg-slate-50 text-slate-600"}`}
                    onClick={() => handleSelect(opt.id)}
                  >
                    <span className="truncate">{opt.name}</span>
                    {isSelected && <Check size={14} className="text-indigo-600 flex-shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-xs text-slate-400">No results found</div>
            )}
          </div>
        </div>
      )}
      {error && (
        <p className="flex items-center gap-1 text-xs text-rose-500 mt-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
};

export default SearchableSelect;