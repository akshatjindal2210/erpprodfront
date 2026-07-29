"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { ChevronDown, Filter } from "lucide-react";

const FilterStripContext = createContext(null);

/** Collapse mobile filter strip after Apply / Reset (used by DateRangeFilter). */
export function useMobileFilterStrip() {
  return useContext(FilterStripContext);
}

/** Common padded strip below toolbar — collapsible on phone to save vertical space. */
export default function ListPageFilterStrip({ children, className = "" }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const collapseMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <FilterStripContext.Provider value={{ collapseMobile }}>
      <div
        data-list-page-filter-strip
        className={`px-2 md:px-4 py-2 md:py-2.5 bg-slate-50 border-b border-slate-200 shrink-0 min-w-0 ${className}`.trim()}
      >
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex w-full items-center justify-between gap-1.5 h-8 min-h-8 px-2 rounded border border-slate-200 bg-white text-slate-700 text-[10px] font-bold uppercase tracking-wide"
          aria-expanded={mobileOpen}
        >
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <Filter size={13} className="text-indigo-600 shrink-0" />
            <span className="truncate">Filters &amp; Search</span>
          </span>
          <ChevronDown
            size={14}
            className={`shrink-0 text-slate-400 transition-transform duration-200 ${mobileOpen ? "rotate-180" : ""}`}
          />
        </button>

        <div className={`${mobileOpen ? "block mt-1 pb-0.5" : "hidden"} md:block md:mt-0 md:pb-0`}>{children}</div>
      </div>
    </FilterStripContext.Provider>
  );
}
