import { Repeat, Calendar } from "lucide-react";
import {
  RECURRENCE_TYPES,
  WEEKDAYS,
} from "@/features/apps/task/components/common/Constants";
import { ClFormError } from "./clTaskFormUi";
import YearlyRecurrencePicker from "../../common/YearlyRecurrencePicker";

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export default function ClTaskRecurrenceSection({ form, onChange, errors = {}, compact = false }) {
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

  return (
    <div className={compact
      ? "space-y-2 p-2 border border-indigo-100/80 rounded-md bg-white"
      : "space-y-4 p-3 md:p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl"
    }>
      {compact ? (
        <div className="flex items-center gap-1.5">
          <Repeat size={12} className="text-indigo-600" />
          <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Recurrence</p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Repeat size={13} className="text-indigo-600" />
          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Recurrence Settings</p>
        </div>
      )}

      <div className={`grid grid-cols-1 ${compact ? "gap-2" : "md:grid-cols-2 gap-3"}`}>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Frequency
          </label>
          <div className="flex gap-1 flex-wrap">
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
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                  form.recurrence_type === t
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                }`}
              >
                {capitalize(t)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-500">
        No end date — task keeps cycling while <span className="font-semibold text-slate-600">Active</span>.
        Deactivate on CL Task page to stop new cycles.
      </p>

      <ClFormError msg={errors.recurring} />

      {form.recurrence_type === "daily" && (
        <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
          <Calendar size={12} className="text-indigo-500" /> Repeats every day while active
        </p>
      )}

      {form.recurrence_type === "weekly" && (
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Days</label>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleWeekday(d.key)}
                className={`px-1.5 py-1 rounded text-[10px] font-semibold border ${
                  safeWeekdays.includes(d.key)
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.recurrence_type === "monthly" && (
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Dates</label>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleMonthDate(d)}
                className={`h-7 rounded text-[10px] font-semibold border ${
                  safeMonthDates.includes(d)
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-500"
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
