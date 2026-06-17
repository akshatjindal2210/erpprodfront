"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGrid, List, Loader2, Minimize2, Maximize2 } from "lucide-react";
import { SearchBar, FilterButtonsRecurrence, EmptyState } from "@/features/apps/task/common";
import MyClTaskTableRow from "./MyClTaskTableRow";
import MyClTaskCard from "./MyClTaskCard";

const TABLE_COLS = ["#", "Title", "Type", "Scheduled", "Wattage", "Due", "Status", "Score"];

export default function MyClTaskPanel({
  title,
  icon: Icon,
  iconClass = "text-indigo-500",
  count,
  countClass = "bg-indigo-100 text-indigo-700",
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  alert,
  search,
  onSearchChange,
  onRefresh,
  onReset,
  hasFilter,
  viewMode,
  onViewModeChange,
  loading,
  tasks,
  variant,
  tab = "today",
  onSubmit,
  emptyMessage,
  tableHeight = "h-[400px]",
  className = "",
}) {
  const containerRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullScreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullScreen = () => {
    if (!isFullScreen) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div
      ref={containerRef}
      className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all duration-300 mb-5 ${
        isFullScreen ? "fixed inset-0 z-[999] rounded-none h-screen w-screen" : ""
      } ${className}`}
    >
      <div className={`flex flex-col overflow-hidden ${isFullScreen ? "h-full" : ""}`}>
        {/* Section title */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={16} className={iconClass} />}
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            {count != null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${countClass}`}>{count}</span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-1 ml-6">{subtitle}</p>}
        </div>

        {/* Tabs (All Tasks only) */}
        {tabs && (
          <div className="px-5 pt-3 flex-shrink-0 bg-white">
            <div className="flex flex-wrap gap-2">
              {tabs.map(({ key, label, icon: TabIcon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTabChange(key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    activeTab === key
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <TabIcon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {alert && <div className="px-5 pt-3 flex-shrink-0 bg-white">{alert}</div>}

        {/* Toolbar — same as admin CL Task page */}
        <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 bg-white z-[10]">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div className="flex-1 min-w-0">
              <SearchBar
                value={search}
                onChange={onSearchChange}
                placeholder="Search by title, description…"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 sm:gap-3">
              <FilterButtonsRecurrence onRefresh={onRefresh} onReset={onReset} />
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shrink-0 shadow-sm">
                <button
                  type="button"
                  onClick={() => onViewModeChange("table")}
                  className={`px-3 py-2.5 transition-all ${viewMode === "table" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                  title="Table view"
                >
                  <List size={15} />
                </button>
                <div className="w-px h-5 bg-slate-200" />
                <button
                  type="button"
                  onClick={() => onViewModeChange("card")}
                  className={`px-3 py-2.5 transition-all ${viewMode === "card" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                  title="Card view"
                >
                  <LayoutGrid size={15} />
                </button>
                <div className="w-px h-5 bg-slate-200" />
                <button
                  type="button"
                  onClick={toggleFullScreen}
                  className="px-3 py-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"
                  title={isFullScreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === "table" ? (
          <div
            className={
              isFullScreen
                ? "flex-1 min-h-0 overflow-auto border-t border-slate-100"
                : `overflow-auto border-t border-slate-100 ${tableHeight}`
            }
          >
            <table className="w-full text-sm min-w-[900px] border-separate border-spacing-0">
              <thead className="sticky top-0 z-[5] shadow-sm">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-1 p-0 sticky left-0 z-[5] bg-slate-50 border-b border-slate-200" />
                  {TABLE_COLS.map((label, i) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 ${
                        i === 0
                          ? "sticky left-[5px] z-[5] bg-slate-50 border-r"
                          : i === 1
                            ? "sticky left-[42px] z-[5] bg-slate-50 border-r min-w-[160px]"
                            : "bg-slate-50"
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                  <th className="px-3 py-3 w-28 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky right-0 z-[5] bg-slate-50 border-l border-slate-200 border-b">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={TABLE_COLS.length + 2} className="py-16 text-center text-slate-400">
                      <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                      <p className="text-sm">Loading tasks…</p>
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={TABLE_COLS.length + 2} className="py-16 text-center">
                      {hasFilter ? (
                        <EmptyState activeTab="" hasFilter onReset={onReset} />
                      ) : (
                        <span className="text-slate-400 text-sm">{emptyMessage}</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  tasks.map((task, i) => (
                    <MyClTaskTableRow
                      key={task.instance_id}
                      task={task}
                      index={i + 1}
                      tab={tab}
                      variant={variant}
                      onSubmit={onSubmit}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className={
              isFullScreen
                ? "flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar border-t border-slate-100"
                : "overflow-y-auto p-4 custom-scrollbar border-t border-slate-100 min-h-[320px]"
            }
          >
            {loading ? (
              <div className="py-16 text-center text-slate-400">
                <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                <p className="text-sm">Loading tasks…</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-16 text-center">
                {hasFilter ? (
                  <EmptyState activeTab="" hasFilter onReset={onReset} />
                ) : (
                  <span className="text-slate-400 text-sm">{emptyMessage}</span>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tasks.map((task) => (
                  <MyClTaskCard
                    key={task.instance_id}
                    task={task}
                    variant={variant}
                    tab={tab}
                    onSubmit={onSubmit}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
