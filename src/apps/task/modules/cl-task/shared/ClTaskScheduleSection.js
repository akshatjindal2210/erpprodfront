import { CalendarClock } from "lucide-react";
import { ClFormLabel, ClFormError, inputBase, inputError } from "./clTaskFormUi";
import ClTaskRecurrenceSection from "./ClTaskRecurrenceSection";

const TASK_TYPES = [
  { value: "open", label: "Open", hint: "Multi fill · no due time" },
  { value: "frequently", label: "Frequently", hint: "Once · before due time" },
];

const DAY_OFFSET_OPTIONS = [
  { value: 0, label: "0 Day (Same Day)" },
  { value: 1, label: "+1 Day (Next Day)" },
  { value: 2, label: "+2 Days" },
  { value: 3, label: "+3 Days" },
  { value: 4, label: "+4 Days" },
  { value: 5, label: "+5 Days" },
  { value: 6, label: "+6 Days" },
  { value: 7, label: "+7 Days" },
  { value: 14, label: "+14 Days" },
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
      due_time: "",
      day_offset: 0,
      include_sunday: false,
    });
      return;
    }
    onChange({
      task_type: "frequently",
      recurrence_type: form.recurrence_type || "daily",
      due_time: form.due_time || "11:00",
      day_offset: form.day_offset ?? 0,
    });
  };

  const handleWeightageChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange({ weightage: "" });
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    onChange({ weightage: Math.min(10, Math.max(1, Math.floor(n))) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <div className="grid grid-cols-2 gap-1.5 flex-1 min-w-0">
          {TASK_TYPES.map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTaskTypeChange(value)}
              className={`px-2 py-1.5 rounded-md text-left border transition-all ${
                form.task_type === value
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              }`}
            >
              <span className="block text-xs font-bold">{label}</span>
              <span
                className={`block text-[9px] mt-0.5 ${
                  form.task_type === value ? "text-indigo-100" : "text-slate-400"
                }`}
              >
                {hint}
              </span>
            </button>
          ))}
        </div>
        <div className="w-[88px] shrink-0">
          <ClFormLabel required>Weightage</ClFormLabel>
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            value={form.weightage ?? ""}
            onChange={handleWeightageChange}
            placeholder="1–10"
            title="Weightage (1–10)"
            className={`${errors.weightage ? inputError : inputBase} text-center tabular-nums px-1`}
          />
          <ClFormError msg={errors.weightage} />
        </div>
      </div>

      {isFrequent ? (
        <div className="rounded-md border border-indigo-200 bg-indigo-50/50 p-2.5 space-y-2.5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <CalendarClock size={13} className="text-indigo-600 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider leading-none">
                Frequently schedule
              </p>
              {/* <p className="text-[9px] text-indigo-500/90 mt-0.5">
                Fill-before time · how often it repeats · stop via Deactivate
              </p> */}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <ClFormLabel required>Fill before</ClFormLabel>
              <input
                type="time"
                className={errors.due_time ? inputError : inputBase}
                value={form.due_time || "11:00"}
                onChange={(e) => onChange({ due_time: e.target.value })}
              />
              <ClFormError msg={errors.due_time} />
                {/* <p className="text-[9px] text-slate-500 mt-1 leading-snug">
                  Fill before this time (IST). Avoid 12:00 AM — it means end of day; prefer e.g. 11:00 AM.
                </p> */}
            </div>
            <div>
              <ClFormLabel required>Day offset</ClFormLabel>
              <select
                className={errors.day_offset ? inputError : inputBase}
                value={Number(form.day_offset) || 0}
                onChange={(e) => onChange({ day_offset: Number(e.target.value) || 0 })}
              >
                {DAY_OFFSET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ClFormError msg={errors.day_offset} />
              {/* <p className="text-[9px] text-slate-500 mt-1 leading-snug">
                Fill window ends on scheduled day + offset at fill-before time. Also sets first occurrence = create date (IST) + offset (0 = same day).
              </p> */}
            </div>
          </div>

          <ClTaskRecurrenceSection form={form} onChange={onChange} errors={errors} compact />

          <label className="flex items-start gap-2 rounded-md border border-indigo-100 bg-white/80 px-2.5 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.include_sunday}
              onChange={(e) => onChange({ include_sunday: e.target.checked })}
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="min-w-0">
              <span className="block text-[11px] font-bold text-slate-700">Include Sunday</span>
              <span className="block text-[9px] text-slate-500 leading-snug mt-0.5">
                Off by default — task will not open or count on Sundays
              </span>
            </span>
          </label>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-2.5 py-2 flex gap-2">
          <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-slate-600 leading-snug">
              Open — no schedule extras
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
              Multiple fills allowed. Switch to Frequently for due time &amp; recurrence (no end date — deactivate to stop).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
