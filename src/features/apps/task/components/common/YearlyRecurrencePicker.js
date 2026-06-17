import { useState, useEffect } from "react";
import { MONTHS } from "./Constants";

export default function YearlyRecurrencePicker({ yearDates = [], onChange, resetKey }) {
  const safeYearDates = Array.isArray(yearDates) ? yearDates : [];
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, "0");
  const [selectedMonths, setSelectedMonths] = useState([currentMonthNum]);
  const [activeMonth, setActiveMonth] = useState(currentMonthNum);

  useEffect(() => {
    const monthsFromDates = [...new Set(safeYearDates.map((d) => d.split("-")[0]))].sort(
      (a, b) => Number(a) - Number(b),
    );
    if (monthsFromDates.length > 0) {
      setSelectedMonths(monthsFromDates);
      setActiveMonth(monthsFromDates[0]);
    } else {
      setSelectedMonths([currentMonthNum]);
      setActiveMonth(currentMonthNum);
    }
  }, [resetKey]);

  const toggleYearDate = (mmdd) => {
    const arr = [...safeYearDates];
    onChange(arr.includes(mmdd) ? arr.filter((d) => d !== mmdd) : [...arr, mmdd]);
  };

  const handleMonthClick = (monthValue) => {
    if (!selectedMonths.includes(monthValue)) {
      const next = [...selectedMonths, monthValue].sort((a, b) => Number(a) - Number(b));
      setSelectedMonths(next);
      setActiveMonth(monthValue);
      return;
    }
    if (activeMonth === monthValue) {
      const next = selectedMonths.filter((m) => m !== monthValue);
      setSelectedMonths(next);
      onChange(safeYearDates.filter((d) => !d.startsWith(`${monthValue}-`)));
      const fallback = next[0] || currentMonthNum;
      setActiveMonth(fallback);
      if (!next.length) {
        setSelectedMonths([currentMonthNum]);
        setActiveMonth(currentMonthNum);
      }
      return;
    }
    setActiveMonth(monthValue);
  };

  const editingMonth = selectedMonths.includes(activeMonth) ? activeMonth : selectedMonths[0];
  const editingDateCount = safeYearDates.filter((d) => d.startsWith(`${editingMonth}-`)).length;

  return (
    <div className="space-y-2.5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Select Month(s)
          </label>
          {selectedMonths.length > 0 && (
            <span className="text-[10px] text-indigo-500 font-medium whitespace-nowrap">
              {selectedMonths.length} month(s)
            </span>
          )}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {MONTHS.map((m) => {
            const isSelected = selectedMonths.includes(m.value);
            const isActive = activeMonth === m.value && isSelected;
            const dateCount = safeYearDates.filter((d) => d.startsWith(`${m.value}-`)).length;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => handleMonthClick(m.value)}
                className={`py-1 rounded-md text-[10px] font-semibold border transition-all ${
                  isActive
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 ring-offset-1"
                    : isSelected
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                }`}
              >
                {m.short}
                {dateCount > 0 && (
                  <span className={`block text-[8px] font-bold mt-px ${
                    isActive ? "text-indigo-200" : "text-indigo-500"
                  }`}>
                    {dateCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          Tap month to add dates · tap active month again to remove
        </p>
      </div>

      {editingMonth && (
        <div className="rounded-lg border border-indigo-100 bg-white p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-600">
              {MONTHS.find((m) => m.value === editingMonth)?.label} — pick date(s)
            </label>
            {editingDateCount > 0 && (
              <span className="text-[10px] text-indigo-500 font-medium shrink-0">
                {editingDateCount} selected
              </span>
            )}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: MONTHS.find((m) => m.value === editingMonth)?.days ?? 31 }, (_, i) => {
              const day = String(i + 1).padStart(2, "0");
              const mmdd = `${editingMonth}-${day}`;
              return (
                <button
                  key={mmdd}
                  type="button"
                  onClick={() => toggleYearDate(mmdd)}
                  className={`h-7 rounded-md text-[10px] font-semibold border transition-all ${
                    safeYearDates.includes(mmdd)
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-300"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
