import { CalendarClock, Zap } from "lucide-react";
import { ClFormLabel, ClFormError, inputBase, inputError } from "./clTaskFormUi";
import ClTaskRecurrenceSection from "./ClTaskRecurrenceSection";

const TASK_TYPES = [
  { value: "open", label: "Open", hint: "One-time task — no repeat" },
  { value: "frequently", label: "Frequently", hint: "Repeats daily, weekly, monthly or yearly" },
];

export default function ClTaskScheduleSection({ form, onChange, errors = {} }) {
  const isFrequent = form.task_type === "frequently";

  const handleTaskTypeChange = (type) => {
    if (type === "open") {
      onChange({
        task_type: "open",
        recurrence_type: "daily",
        recurrence_weekdays: [],
        recurrence_month_dates: [],
        recurrence_year_dates: [],
        end_date: "",
      });
      return;
    }
    onChange({
      task_type: "frequently",
      recurrence_type: form.recurrence_type || "daily",
      end_date_time: "",
    });
  };

  const handleWattageChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange({ wastage: "" });
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    onChange({ wastage: Math.min(10, Math.max(1, Math.floor(n))) });
  };

  return (
    <div className="space-y-4">
      <div className="p-3 md:p-4 bg-white border border-slate-200 rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={13} className="text-indigo-600" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Task Type</p>
        </div>
        <ClFormLabel required>Select type</ClFormLabel>
        <div className="grid grid-cols-2 gap-2">
          {TASK_TYPES.map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTaskTypeChange(value)}
              className={`px-3 py-2.5 rounded-xl text-left border transition-all ${
                form.task_type === value
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              }`}
            >
              <span className="block text-sm font-bold">{label}</span>
              <span className={`block text-[10px] mt-0.5 ${
                form.task_type === value ? "text-indigo-100" : "text-slate-400"
              }`}>
                {hint}
              </span>
            </button>
          ))}
        </div>
        <ClFormError msg={errors.task_type} />
      </div>

      {isFrequent && (
        <ClTaskRecurrenceSection form={form} onChange={onChange} errors={errors} />
      )}

      <div className="p-3 md:p-4 bg-white border border-slate-200 rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-amber-500" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Wattage</p>
        </div>
        <ClFormLabel required>Wattage (1–10)</ClFormLabel>
        <input
          type="number"
          min={1}
          max={10}
          step={1}
          value={form.wastage ?? ""}
          onChange={handleWattageChange}
          placeholder="Enter 1 to 10"
          className={errors.wastage ? inputError : inputBase}
        />
        <p className="text-[11px] text-slate-400">Priority level from 1 (low) to 10 (high)</p>
        <ClFormError msg={errors.wastage} />
      </div>
    </div>
  );
}
