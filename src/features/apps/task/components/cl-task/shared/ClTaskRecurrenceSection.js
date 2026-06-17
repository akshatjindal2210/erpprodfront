import { Repeat, Calendar, CheckCircle2 } from "lucide-react";
import {
  RECURRENCE_TYPES,
  WEEKDAYS,
  MONTHS,
} from "@/features/apps/task/components/common/Constants";
import { ClFormError, inputBase } from "./clTaskFormUi";
import YearlyRecurrencePicker from "../../common/YearlyRecurrencePicker";

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export default function ClTaskRecurrenceSection({ form, onChange, errors = {} }) {
  const safeWeekdays = Array.isArray(form.recurrence_weekdays) ? form.recurrence_weekdays : [];
  const safeMonthDates = Array.isArray(form.recurrence_month_dates) ? form.recurrence_month_dates : [];
  const safeYearDates = Array.isArray(form.recurrence_year_dates) ? form.recurrence_year_dates : [];

  const patch = (updates) => onChange(updates);

  const toggleWeekday = (key) => {
    const arr = [...safeWeekdays];
    patch({
      recurrence_weekdays: arr.includes(key) ? arr.filter((d) => d !== key) : [...arr, key],
    });
  };

  const toggleMonthDate = (date) => {
    const arr = [...safeMonthDates];
    patch({
      recurrence_month_dates: arr.includes(date) ? arr.filter((d) => d !== date) : [...arr, date],
    });
  };

  const selectionSummary = () => {
    if (form.recurrence_type === "weekly" && safeWeekdays.length > 0) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-indigo-600 rounded-lg">
          <CheckCircle2 size={12} className="text-white shrink-0" />
          <span className="text-xs text-white font-semibold">{safeWeekdays.length} day(s):</span>
          <span className="text-xs text-indigo-200 font-medium">
            {safeWeekdays.map((k) => WEEKDAYS.find((d) => d.key === k)?.label || k).join(" · ")}
          </span>
        </div>
      );
    }
    if (form.recurrence_type === "monthly" && safeMonthDates.length > 0) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-indigo-600 rounded-lg">
          <CheckCircle2 size={12} className="text-white shrink-0" />
          <span className="text-xs text-white font-semibold">{safeMonthDates.length} date(s):</span>
          <span className="text-xs text-indigo-200 font-medium">
            {[...safeMonthDates].sort((a, b) => Number(a) - Number(b)).join(", ")}
          </span>
        </div>
      );
    }
    if (form.recurrence_type === "yearly" && safeYearDates.length > 0) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-indigo-600 rounded-lg">
          <CheckCircle2 size={12} className="text-white shrink-0" />
          <span className="text-xs text-white font-semibold">{safeYearDates.length} date(s):</span>
          <span className="text-xs text-indigo-200 font-medium">
            {[...safeYearDates].sort().map((mmdd) => {
              const [mm, dd] = mmdd.split("-");
              const mon = MONTHS.find((m) => m.value === mm)?.short ?? mm;
              return `${mon} ${parseInt(dd, 10)}`;
            }).join(", ")}
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 p-3 md:p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
      <div className="flex items-center gap-2">
        <Repeat size={13} className="text-indigo-600" />
        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Recurrence Settings</p>
      </div>

      {selectionSummary()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Frequency
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {RECURRENCE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => patch({
                  recurrence_type: t,
                  recurrence_weekdays: [],
                  recurrence_month_dates: [],
                  recurrence_year_dates: [],
                })}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  form.recurrence_type === t
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {capitalize(t)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            End Date
          </label>
          <input
            type="date"
            value={form.end_date || ""}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => {
              const val = e.target.value;
              patch({
                end_date: val,
                end_date_time: val ? `${val}T23:59` : "",
              });
            }}
            className={`${inputBase} w-full`}
          />
          <ClFormError msg={errors.end_date} />
        </div>
      </div>

      <ClFormError msg={errors.recurring} />

      {form.recurrence_type === "daily" && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-indigo-100 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Calendar size={14} className="text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-700">Every Day</p>
            <p className="text-[10px] md:text-xs text-slate-400">Task repeats daily until end date</p>
          </div>
        </div>
      )}

      {form.recurrence_type === "weekly" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Repeat On Days
            </label>
            {safeWeekdays.length > 0 && (
              <span className="text-xs text-indigo-500 font-medium">{safeWeekdays.length} selected</span>
            )}
          </div>
          <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleWeekday(d.key)}
                className={`px-2 py-2 rounded-lg text-[10px] md:text-xs font-semibold border transition-all ${
                  safeWeekdays.includes(d.key)
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.recurrence_type === "monthly" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Repeat On Dates
            </label>
            {safeMonthDates.length > 0 && (
              <span className="text-xs text-indigo-500 font-medium">{safeMonthDates.length} selected</span>
            )}
          </div>
          <div className="grid grid-cols-7 sm:grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1">
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleMonthDate(d)}
                className={`h-8 md:h-9 rounded-lg text-[10px] md:text-xs font-semibold border transition-all ${
                  safeMonthDates.includes(d)
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.recurrence_type === "yearly" && (
        <YearlyRecurrencePicker
          yearDates={safeYearDates}
          resetKey={form.recurrence_type}
          onChange={(dates) => patch({ recurrence_year_dates: dates })}
        />
      )}
    </div>
  );
}
