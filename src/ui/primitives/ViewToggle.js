"use client";
import { List, LayoutGrid } from "lucide-react";

export default function ViewToggle({
  mode,
  setMode,
  showTable = true,
  showCard = true,
  className = "",
  embedded = false,
}) {

  if (!showTable && !showCard) return null;

  const baseClass = "px-3 transition-all flex items-center justify-center h-full min-w-[36px]";
  const activeClass = "bg-slate-800 text-white shadow-inner"; 
  const inactiveClass = "text-slate-500 hover:text-slate-700 hover:bg-slate-50";

  const rootClass = embedded
    ? `flex items-stretch shrink-0 h-full overflow-hidden ${className}`
    : `flex items-center border border-slate-300 rounded-none bg-white shrink-0 h-9 overflow-hidden ${className}`;

  return (
    <div className={rootClass}>
      
      {/* TABLE BUTTON */}
      {showTable && (
        <button
          type="button"
          onClick={() => setMode("table")}
          className={`${baseClass} ${mode === "table" ? activeClass : inactiveClass}`}
          title="Table view"
        >
          <List size={16} strokeWidth={2.5} />
        </button>
      )}

      {/* Divider */}
      {showTable && showCard && <div className="w-px h-full bg-slate-300" />}

      {/* CARD BUTTON */}
      {showCard && (
        <button
          type="button"
          onClick={() => setMode("card")}
          className={`${baseClass} ${mode === "card" ? activeClass : inactiveClass}`}
          title="Card view"
        >
          <LayoutGrid size={16} strokeWidth={2.5} />
        </button>
      )}
      
    </div>
  );
}