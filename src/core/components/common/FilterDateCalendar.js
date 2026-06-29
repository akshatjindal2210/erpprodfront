"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isDisabledYmd(ymd, minYmd, maxYmd) {
  if (!ymd) return true;
  const d = dayjs(ymd);
  if (!d.isValid()) return true;
  if (minYmd && ymd < minYmd) return true;
  if (maxYmd && ymd > maxYmd) return true;
  return false;
}

/**
 * Small month grid for filter date fields — does not steal focus from the text input.
 */
export default function FilterDateCalendar({
  viewMonth,
  onViewMonthChange,
  selectedYmd = "",
  highlightDay = null,
  minYmd,
  maxYmd,
  onPickYmd,
  onClear,
  onToday,
}) {
  const month = useMemo(() => dayjs(viewMonth).startOf("month"), [viewMonth]);

  const cells = useMemo(() => {
    const start = month.startOf("week");
    const end = month.endOf("month").endOf("week");
    const out = [];
    let cursor = start;
    while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
      out.push(cursor);
      cursor = cursor.add(1, "day");
    }
    return out;
  }, [month]);

  const monthLabel = month.format("MMMM YYYY");

  return (
    <div
      className="w-[17rem] rounded-sm border border-slate-200 bg-white shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between gap-1 border-b border-slate-100 px-2 py-1.5">
        <button
          type="button"
          onClick={() => onViewMonthChange?.(month.subtract(1, "month"))}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{monthLabel}</span>
        <button
          type="button"
          onClick={() => onViewMonthChange?.(month.add(1, "month"))}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px px-2 pt-1.5">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="pb-1 text-center text-[9px] font-bold uppercase text-slate-400">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px px-2 pb-2">
        {cells.map((d) => {
          const ymd = d.format("YYYY-MM-DD");
          const inMonth = d.month() === month.month();
          const disabled = !inMonth || isDisabledYmd(ymd, minYmd, maxYmd);
          const isSelected = selectedYmd === ymd;
          const isTypingHighlight =
            !isSelected &&
            highlightDay != null &&
            inMonth &&
            d.date() === highlightDay &&
            !disabled;

          return (
            <button
              key={ymd}
              type="button"
              disabled={disabled}
              onClick={() => onPickYmd?.(ymd)}
              className={[
                "h-8 w-full text-[11px] font-medium transition-colors",
                disabled ? "cursor-default text-slate-300" : "text-slate-700 hover:bg-indigo-50",
                isSelected ? "bg-indigo-600 text-white hover:bg-indigo-700" : "",
                isTypingHighlight ? "ring-2 ring-indigo-400 ring-inset bg-indigo-50" : "",
                !inMonth ? "text-slate-300" : "",
              ].join(" ")}
            >
              {d.date()}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1.5">
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 hover:text-indigo-800"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onToday}
          className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 hover:text-indigo-800"
        >
          Today
        </button>
      </div>
    </div>
  );
}
