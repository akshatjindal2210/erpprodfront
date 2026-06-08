"use client";

import { APP_CONFIG_TABS } from "@/features/admin/configuration/config/appConfigTabsRegistry";

/** Bordered tabs — active wala content se juda dikhe. */
export default function AppConfigTabBar({ activeId, onSelect }) {
  return (
    <div className="shrink-0 bg-slate-50 border-b border-slate-300 px-3 md:px-4 pt-2">
      <div
        className="flex items-end gap-1 overflow-x-auto no-scrollbar -mb-px"
        role="tablist"
        aria-label="Configuration scope"
      >
        {APP_CONFIG_TABS.map((tab) => {
          const selected = activeId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`app-config-panel-${tab.id}`}
              id={`app-config-tab-${tab.id}`}
              onClick={() => onSelect(tab.id)}
              className={`shrink-0 min-w-[96px] px-4 py-2 text-[11px] uppercase tracking-wider whitespace-nowrap border transition-all duration-150 ${
                selected
                  ? "border-slate-300 border-b-white bg-white text-indigo-700 font-black z-[1]"
                  : "border-transparent bg-transparent text-slate-500 font-bold hover:border-slate-200 hover:bg-white/80 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

