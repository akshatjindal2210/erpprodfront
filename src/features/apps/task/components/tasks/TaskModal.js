import { useState, useEffect } from "react";
import { X, Check, ClipboardList, AlertCircle, Repeat, Calendar, CheckCircle2, Copy, User, Users, Crown, Lock, ImageIcon, FileText, Calendar1 } from "lucide-react";
import { toast }           from "react-toastify";
import { taskService }     from "@/features/apps/task/services/taskApi";
import { userService }     from "@/features/apps/task/services/userApi";
import { categoryService } from "@/features/apps/task/services/categoryApi";
import { PRIORITIES, TASK_STATUSES, RECURRENCE_TYPES, WEEKDAYS, MONTHS, TASK_STATUSES_OPTIONS, } from "@/features/apps/task/components/common/Constants";
import { extractList, mapTaskUserToOption }  from "@/features/apps/task/helpers/utilHelper";
import { parseArr } from "@/features/apps/task/helpers/formArrays";
import { compareLabelAsc } from "@/features/apps/task/helpers/sortOptions";
import SelectField      from "../common/SelectField";
import SearchableSelect from "../common/SearchableSelect";
import RichTextEditor from "../common/RichTextEditor";

// ─── Styles ───────────────────────────────────────────────────────────────────
const base    = "w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all";
const okCls   = `${base} border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`;
const errCls  = `${base} border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 bg-rose-50/30`;
const lockCls = `${base} border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed`;
const selCls  = "w-full appearance-none bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all pr-9";
 

// ─── Empty states ─────────────────────────────────────────────────────────────
const EMPTY_ASSIGNED = {
  title:                  "",
  description:            "",
  assigned_by:            "",
  assigned_to:            "",   // L1 Authority
  sub_users:              [],   // [{ user_id, note }]
  category_id:            "",
  priority:               "low",
  status:                 "pending",
  due_date:               "",
  is_recurring:           false,
  recurrence_type:        "weekly",
  recurrence_weekdays:    [],
  recurrence_month_dates: [],
  recurrence_year_dates:  [],
  end_date:               "",
  attachments:            [],
};

const EMPTY_SELF = {
  title:                  "",
  description:            "",
  category_id:            "",
  priority:               "low",
  due_date:               "",
  is_recurring:           false,
  recurrence_type:        "weekly",
  recurrence_weekdays:    [],
  recurrence_month_dates: [],
  recurrence_year_dates:  [],
  end_date:               "",
  attachments:            [],
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const getToday   = () => new Date().toISOString().slice(0, 10);

const calcAutoReminder = (due) => {
  if (!due) return "";
  const today  = getToday();
  const dueD   = new Date(due   + "T00:00:00");
  const todayD = new Date(today + "T00:00:00");
  const diff   = Math.round((dueD - todayD) / 864e5);
  if (diff <= 1) return today;
  const r = new Date(dueD);
  r.setDate(r.getDate() - 1);
  return r.toISOString().slice(0, 10);
};

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-rose-500 mt-1">
      <AlertCircle size={11} /> {msg}
    </p>
  );
}

function Label({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
      {children}{required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
  );
}


// ════════════════════════════════════════════════════════════════════════════════
// SUB-USER SELECTOR — searchable multi-select with chips
//
// Props:
//   users      — full user list (already filtered: L1 + assigned_by removed)
//   value      — [{ user_id, note }]
//   onChange   — (newArr) => void
//   disabled
// ════════════════════════════════════════════════════════════════════════════════
function SubUserSelector({ users, value = [], onChange, disabled }) {
  const [search, setSearch]   = useState("");
  const [open,   setOpen]     = useState(false);

  const selectedIds = value.map((s) => String(s.user_id));

  const filtered = users
    .filter(
      (u) =>
        !selectedIds.includes(String(u.id)) &&
        u.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => compareLabelAsc(a.name, b.name));

  const addUser = (user) => {
    onChange([...value, { user_id: user.id, name: user.name, type: user.type, note: "" }]);
    setSearch("");
  };

  // const removeUser = (uid) =>
  //   onChange(value.filter((s) => String(s.user_id) !== String(uid)));

  // const updateNote = (uid, note) =>
  //   onChange(value.map((s) => String(s.user_id) === String(uid) ? { ...s, note } : s));

  const updateNote = (user_id, note) => {
    onChange(
      value.map((item) =>
        String(item.user_id) === String(user_id)
          ? { ...item, note }
          : item
      )
    );
  };

  const removeUser = (user_id) => {
    onChange(value.filter((u) => String(u.user_id) !== String(user_id)));
  };

  const uniqueUsers = Object.values(
    value.reduce((acc, curr) => {
      acc[curr.user_id] = curr;
      return acc;
    }, {})
  );
  return (
    <div className="space-y-2">

      {/* Search input */}
      {!disabled && (
        <div className="relative">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search and add other users…"
            className={okCls}
          />
          {/* Dropdown */}
          {open && filtered.length > 0 && (
            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
              {filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={() => addUser(u)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-indigo-600">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {open && search && filtered.length === 0 && (
            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs text-slate-400">
              No matching users found
            </div>
          )}
        </div>
      )}

      {/* Selected chips */}
      {uniqueUsers.map((su, index) => (
        <div key={`${su.user_id}-${index}`} 
          className={`flex items-start gap-2 p-2.5 border rounded-xl group ${
            !su.is_active 
              ? "bg-slate-50 border-slate-200" 
              : "bg-slate-100 border-slate-200 opacity-60"
          }`}>

          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-bold text-indigo-600">
              {su.name?.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-slate-700 truncate">{su.name}</span>

              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {su.type}
              </span>

              {su.is_active && (
                <span className="text-[10px] text-rose-400 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100">
                  Active
                </span>
              )}
            </div>

            <input
              value={su.note}
              onChange={(e) => updateNote(su.user_id, e.target.value)}
              placeholder="Note for this person (optional)"
              disabled={disabled || su.is_active === false || su.is_active === true} // only block existing inactive
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
            />
          </div>

          {!disabled && !su.is_active && (
            <button 
              type="button" 
              onClick={() => removeUser(su.user_id)}
              className="text-slate-300 hover:text-rose-500 transition-colors mt-0.5 flex-shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      {value.length === 0 && disabled && (
        <p className="text-xs text-slate-400 text-center py-2">No sub-users assigned</p>
      )}
    </div>
  );
}


// ─── Recurring Section ────────────────────────────────────────────────────────
function RecurringSection({ form, setForm, isEdit }) {
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, "0");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNum);

  const safeWeekdays   = Array.isArray(form.recurrence_weekdays)    ? form.recurrence_weekdays    : [];
  const safeMonthDates = Array.isArray(form.recurrence_month_dates) ? form.recurrence_month_dates : [];
  const safeYearDates  = Array.isArray(form.recurrence_year_dates)  ? form.recurrence_year_dates  : [];

  const toggleWeekday = (key) =>
    setForm((p) => {
      const arr = Array.isArray(p.recurrence_weekdays) ? p.recurrence_weekdays : [];
      return { ...p, recurrence_weekdays: arr.includes(key) ? arr.filter((d) => d !== key) : [...arr, key] };
    });
  const toggleMonthDate = (date) =>
    setForm((p) => {
      const arr = Array.isArray(p.recurrence_month_dates) ? p.recurrence_month_dates : [];
      return { ...p, recurrence_month_dates: arr.includes(date) ? arr.filter((d) => d !== date) : [...arr, date] };
    });
  const toggleYearDate = (mmdd) =>
    setForm((p) => {
      const arr = Array.isArray(p.recurrence_year_dates) ? p.recurrence_year_dates : [];
      return { ...p, recurrence_year_dates: arr.includes(mmdd) ? arr.filter((d) => d !== mmdd) : [...arr, mmdd] };
    });

  const currentMonthDays = MONTHS.find((m) => m.value === selectedMonth)?.days ?? 31;

  const selectionSummary = () => {
    if (form.recurrence_type === "weekly" && safeWeekdays.length > 0)
      return (
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-indigo-600 rounded-lg">
          <CheckCircle2 size={12} className="text-white flex-shrink-0" />
          <span className="text-xs text-white font-semibold">{safeWeekdays.length} day(s):</span>
          <span className="text-xs text-indigo-200 font-medium">{safeWeekdays.map(capitalize).join(" · ")}</span>
        </div>
      );
    if (form.recurrence_type === "monthly" && safeMonthDates.length > 0)
      return (
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-indigo-600 rounded-lg">
          <CheckCircle2 size={12} className="text-white flex-shrink-0" />
          <span className="text-xs text-white font-semibold">{safeMonthDates.length} date(s):</span>
          <span className="text-xs text-indigo-200 font-medium">
            {[...safeMonthDates].sort((a, b) => Number(a) - Number(b)).join(", ")}
          </span>
        </div>
      );
    if (form.recurrence_type === "yearly" && safeYearDates.length > 0)
      return (
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-indigo-600 rounded-lg">
          <CheckCircle2 size={12} className="text-white flex-shrink-0" />
          <span className="text-xs text-white font-semibold">{safeYearDates.length} date(s):</span>
          <span className="text-xs text-indigo-200 font-medium">
            {[...safeYearDates].sort().map((mmdd) => {
              const [mm, dd] = mmdd.split("-");
              const mon = MONTHS.find((m) => m.value === mm)?.short ?? mm;
              return `${mon} ${parseInt(dd)}`;
            }).join(", ")}
          </span>
        </div>
      );
    return null;
  };

  return (
    <div className="space-y-4 p-3 md:p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
      <div className="flex items-center gap-2">
        <Repeat size={13} className="text-indigo-600" />
        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Recurrence Settings</p>
      </div>
      
      {selectionSummary()}

      {/* Here grid-cols-1 md:grid-cols-2 is used for responsiveness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Repeat Type</label>
          <div className="flex gap-1.5 flex-wrap">
            {RECURRENCE_TYPES.map((t) => (
              <button key={t} type="button"
                onClick={() => setForm((p) => ({
                  ...p, recurrence_type: t,
                  recurrence_weekdays: [], recurrence_month_dates: [], recurrence_year_dates: [],
                }))}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  form.recurrence_type === t
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                }`}>
                {capitalize(t)}
              </button>
            ))}
          </div>
        </div>

        {/* Fixed grid behavior on small screens for IsEdit logic */}
        <div className={`grid gap-3 ${isEdit ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
            {/* <input type="date" value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              className={`${okCls} w-full`} /> */}
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                className={`${okCls} w-full`}
                min={new Date().toISOString().split("T")[0]} // disable dates before today
              />
          </div>
          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Recurrence Status</label>
              <button type="button"
                onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  form.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"
                }`}>
                <span>{form.is_active ? "Active" : "Inactive"}</span>
                <div className={`relative w-9 h-5 rounded-full transition-colors ${form.is_active ? "bg-emerald-500" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? "translate-x-4" : ""}`} />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {form.recurrence_type === "daily" && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-indigo-100 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
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
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Repeat On Days</label>
            {safeWeekdays.length > 0 && <span className="text-xs text-indigo-500 font-medium">{safeWeekdays.length} selected</span>}
          </div>
          <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <button key={d.key} type="button" onClick={() => toggleWeekday(d.key)}
                className={`px-2 py-2 rounded-lg text-[10px] md:text-xs font-semibold border transition-all ${
                  safeWeekdays.includes(d.key)
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                }`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.recurrence_type === "monthly" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Repeat On Dates</label>
            {safeMonthDates.length > 0 && <span className="text-xs text-indigo-500 font-medium">{safeMonthDates.length} selected</span>}
          </div>
          <div className="grid grid-cols-7 sm:grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1">
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
              <button key={d} type="button" onClick={() => toggleMonthDate(d)}
                className={`h-8 md:h-9 rounded-lg text-[10px] md:text-xs font-semibold border transition-all ${
                  safeMonthDates.includes(d)
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                }`}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.recurrence_type === "yearly" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Select Month</label>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-1">
              {MONTHS.map((m) => (
                <button key={m.value} type="button" onClick={() => setSelectedMonth(m.value)}
                  className={`py-1.5 rounded-lg text-[10px] md:text-xs font-semibold border transition-all ${
                    selectedMonth === m.value
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                  }`}>
                  {m.short}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider truncate mr-2">
                {MONTHS.find((m) => m.value === selectedMonth)?.label} — Dates
              </label>
              {safeYearDates.filter((d) => d.startsWith(selectedMonth)).length > 0 && (
                <span className="text-[10px] md:text-xs text-indigo-500 font-medium whitespace-nowrap">
                  {safeYearDates.filter((d) => d.startsWith(selectedMonth)).length} selected
                </span>
              )}
            </div>
            <div className="grid grid-cols-7 sm:grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1">
              {Array.from({ length: currentMonthDays }, (_, i) => {
                const day = String(i + 1).padStart(2, "0");
                const mmdd = `${selectedMonth}-${day}`;
                return (
                  <button key={mmdd} type="button" onClick={() => toggleYearDate(mmdd)}
                    className={`h-8 md:h-9 rounded-lg text-[10px] md:text-xs font-semibold border transition-all ${
                      safeYearDates.includes(mmdd)
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                    }`}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT PREVIEW — Creator → L1 → Sub-users visual flow
// ════════════════════════════════════════════════════════════════════════════════
function AssignmentPreview({ users, assignedBy, assignedTo, subUsers }) {
  if (!assignedBy || !assignedTo) return null;
  const assigner = users.find((u) => String(u.id) === String(assignedBy));
  const l1       = users.find((u) => String(u.id) === String(assignedTo));
  if (!assigner || !l1) return null;

  return (
    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">

      {/* Creator → L1 row */}
      <div className="flex items-center gap-2">
        {/* Assigner */}
        <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Assign By</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg w-full justify-center">
            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-slate-500">{assigner.name.charAt(0)}</span>
            </div>
            <span className="text-xs font-semibold text-slate-700 truncate">{assigner.name}</span>
          </div>
        </div>

        {/* Arrow */}
        <svg className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* L1 */}
        <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Crown size={8} className="text-amber-500" /> Assign To
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg w-full justify-center">
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-amber-600">{l1.name.charAt(0)}</span>
            </div>
            <span className="text-xs font-semibold text-amber-700 truncate">{l1.name}</span>
          </div>
        </div>
      </div>

      {/* Sub-users under L1 */}
      {subUsers.length > 0 && (
        <div className="pl-4 border-l-2 border-indigo-200 space-y-1 ml-2">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Users size={9} /> Sub-users ({subUsers.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {subUsers.map((su, index) => (
              <div key={`${su.user_id}-${index}`} 
                className="flex items-center gap-1 px-2 py-1 bg-white border border-indigo-100 rounded-lg">
                <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-indigo-600">
                    {su.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-slate-600 font-medium">{su.name}</span>
                {su.note && (
                  <span className="text-[10px] text-slate-400 italic truncate max-w-[80px]">
                    — {su.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════════
// MAIN MODAL
// ════════════════════════════════════════════════════════════════════════════════
export default function TaskModal({open, onClose, onSuccess, editTask, prefillTask, taskType = "assigned", currentUser}) {
  const isEdit  = !!editTask;
  const isClone = !isEdit && !!prefillTask;
  const isSelf  = taskType === "self";
  const today   = getToday();

  // const emptyForm = isSelf ? EMPTY_SELF : EMPTY_ASSIGNED;
  const emptyForm = isSelf ? EMPTY_SELF : {
    ...EMPTY_ASSIGNED,
    assigned_by:      currentUser?.id   ?? "",
    assigned_by_name: currentUser?.name ?? "",
  };

  const [form,           setForm]           = useState(emptyForm);
  const [errors,         setErrors]         = useState({});
  const [loading,        setLoading]        = useState(false);
  const [users,          setUsers]          = useState([]);
  const [categories,     setCategories]     = useState([]);
  const [fetchingMeta,   setFetchingMeta]   = useState(false);
  const [taskDetail,     setTaskDetail]     = useState(null);
  const [fetchingDetail, setFetchingDetail] = useState(false);

  // Only assigned_by for assigned tasks; creator for self tasks
  const canEditAssignment = !isEdit || (() => {
    if (!taskDetail || !currentUser) return false;
    const uid = String(currentUser.id);
    if (isSelf) {
      return uid === String(taskDetail.created_by_id) || uid === String(taskDetail.created_by);
    }
    return uid === String(taskDetail.assigned_by_id) || uid === String(taskDetail.assigned_by);
  })();

  // Assigner can change Assigned By on assigned tasks
  const canEditAssignedBy = !isEdit || (() => {
    if (!taskDetail || !currentUser) return false;
    const uid = String(currentUser.id);
    if (isSelf) {
      return uid === String(taskDetail.created_by_id) || uid === String(taskDetail.created_by);
    }
    return uid === String(taskDetail.assigned_by_id) || uid === String(taskDetail.assigned_by);
  })();

  // ── Fetch master data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setFetchingMeta(true);
      try {
        const promises = [categoryService.getAll({ limit: 200 })];
        if (!isSelf) promises.unshift(userService.getViews());
        const results = await Promise.all(promises);
        if (!isSelf) setUsers(results[0].data?.data || []);
        setCategories(extractList(isSelf ? results[0] : results[1]));
      } catch {
        toast.error("Failed to load form data");
      } finally {
        setFetchingMeta(false);
      }
    };
    load();
  }, [open, isSelf]);

  // ── Edit: fetch full task detail ──────────────────────────────────────────
  useEffect(() => {
    if (open && isEdit && editTask?.task_id) {
      setFetchingDetail(true);
      setTaskDetail(null);
      taskService.getById(editTask.task_id)
        .then((res) => setTaskDetail(res?.data?.data ?? res?.data ?? null))
        .catch(() => toast.error("Failed to load task details"))
        .finally(() => setFetchingDetail(false));
    }
    if (!open) setTaskDetail(null);
  }, [open, editTask?.task_id]);

  // ── Form fill ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const toDateStr = (val) => {
      if (!val) return "";
      const s = String(val);
      return s.includes("T") ? s.split("T")[0] : s.split(" ")[0];
    };

    // Handle both boolean + integer
    /*
    const buildSubUsers = (chain = []) =>
      chain
        .filter((a) => a.role === "sub_user" && (a.is_active === 1 || a.is_active === true))
        .map((a) => ({
          user_id: a.assigned_to_id,
          name:    a.assigned_to_name,
          type:    a.assigned_to_type ?? "",
          note:    a.note ?? "",
        }));
    */
    const buildSubUsers = (chain = []) => {
      const byId = new Map();
      for (const a of chain.filter((x) => x.role === "sub_user")) {
        const id = String(a.assigned_to_id);
        if (byId.has(id)) continue;
        byId.set(id, {
          user_id:   a.assigned_to_id,
          name:      a.assigned_to_name,
          type:      a.assigned_to_type ?? "",
          note:      a.note ?? "",
          is_active: a.is_active === 1 || a.is_active === true,
        });
      }
      return [...byId.values()];
    };

    if (isEdit) {
      if (!taskDetail) return;
      const activeL1 = taskDetail.assignment_chain?.find(
        (a) => a.role === "level_one" && (a.is_active === 1 || a.is_active === true)
      );
      if (isSelf) {
        setForm({
          title:                  taskDetail.title              ?? "",
          description:            taskDetail.description        ?? "",
          category_id:            taskDetail.category_id        ?? "",
          priority:               taskDetail.priority           ?? "medium",
          due_date:               toDateStr(taskDetail.due_date),
          is_recurring:           !!taskDetail.is_recurring,
          recurrence_type:        taskDetail.recurrence_type    ?? "weekly",
          recurrence_weekdays:    parseArr(taskDetail.recurrence_weekdays),
          recurrence_month_dates: parseArr(taskDetail.recurrence_month_dates),
          recurrence_year_dates:  parseArr(taskDetail.recurrence_year_dates),
          end_date:               toDateStr(taskDetail.end_date),
          is_active:              taskDetail.recurrence_is_active !== undefined
                                    ? !!taskDetail.recurrence_is_active : true,
          attachments: [],
        });
      } else {
        setForm({
          title:                  taskDetail.title              ?? "",
          description:            taskDetail.description        ?? "",
          assigned_by:            taskDetail.assigned_by_id     ?? taskDetail.assigned_by   ?? "",
          assigned_by_name:       taskDetail.assigned_by_name   ?? "",
          assigned_to:            activeL1?.assigned_to_id      ?? taskDetail.first_assigned_to_id ?? "",
          sub_users:              buildSubUsers(taskDetail.assignment_chain),
          category_id:            taskDetail.category_id        ?? "",
          priority:               taskDetail.priority           ?? "medium",
          status:                 taskDetail.status             ?? "pending",
          due_date:               toDateStr(taskDetail.due_date),
          is_recurring:           !!taskDetail.is_recurring,
          recurrence_type:        taskDetail.recurrence_type    ?? "weekly",
          recurrence_weekdays:    parseArr(taskDetail.recurrence_weekdays),
          recurrence_month_dates: parseArr(taskDetail.recurrence_month_dates),
          recurrence_year_dates:  parseArr(taskDetail.recurrence_year_dates),
          end_date:               toDateStr(taskDetail.end_date),
          is_active:              taskDetail.recurrence_is_active !== undefined
                                    ? !!taskDetail.recurrence_is_active : true,
          attachments: [],
        });
      }
    } else if (isClone && prefillTask) {
      setForm({
        ...emptyForm,
        title:       (prefillTask.title ?? "") + " (Copy)",
        description: prefillTask.description ?? "",
        category_id: prefillTask.category_id ?? "",
        priority:    prefillTask.priority    ?? "medium",
        ...(!isSelf && {
          assigned_by:      currentUser?.id   ?? prefillTask.assigned_by_id ?? "",
          assigned_by_name: currentUser?.name ?? "",
          assigned_to:      prefillTask.first_assigned_to_id ?? prefillTask.assigned_to_id ?? "",
          sub_users:        [],
        }),
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [taskDetail, prefillTask, open, isEdit, isClone, isSelf]);

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
    setErrors((p) => ({ ...p, [k]: "" }));
  };

  // ── Validate ──────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.category_id) e.category_id = "Category is required";

    if (!isSelf) {
      if (!form.assigned_by) e.assigned_by = "Please select the assigner";
      if (!form.assigned_to) e.assigned_to = "Please select the Level-1 assignee";
      if (form.assigned_by && form.assigned_to && String(form.assigned_by) === String(form.assigned_to))
        e.assigned_to = "Assigner and Level-1 cannot be the same";

      const subs = Array.isArray(form.sub_users) ? form.sub_users : [];
      const badSub = subs.find((s) => String(s.user_id) === String(form.assigned_to));
      if (badSub) e.sub_users = "Sub-user cannot be same as Level-1";
    }

    // Validate recurring only in create mode
    if (!isEdit && form.is_recurring) {
      const weekdays = Array.isArray(form.recurrence_weekdays) ? form.recurrence_weekdays : [];
      const monthDates = Array.isArray(form.recurrence_month_dates) ? form.recurrence_month_dates : [];
      const yearDates = Array.isArray(form.recurrence_year_dates) ? form.recurrence_year_dates : [];
      if (form.recurrence_type === "weekly"  && weekdays.length === 0) e.recurring = "Select at least one day";
      if (form.recurrence_type === "monthly" && monthDates.length === 0) e.recurring = "Select at least one date";
      if (form.recurrence_type === "yearly"  && yearDates.length === 0) e.recurring = "Select at least one date";
    }

    return e;
  };

  // ── Build FormData ────────────────────────────────────────────────────────
  const buildFormData = () => {
    const payload = {
      title:           form.title.trim(),
      description:     form.description.trim() || null,
      category_id:     form.category_id  || null,
      priority:        form.priority,
      due_date:        form.is_recurring ? null : (form.due_date || null),
      is_recurring:    form.is_recurring,
      recurrence_type: form.is_recurring ? form.recurrence_type : null,
    };

    if (!isSelf) {
      payload.status = form.status;
      const subs = Array.isArray(form.sub_users) ? form.sub_users : [];

      if (!isEdit) {
        payload.assigned_by = form.assigned_by || null;
        payload.assigned_to = form.assigned_to || null;
        payload.sub_users   = subs.length > 0 ? subs : null;
      } else if (canEditAssignment) {
        const activeL1 = taskDetail?.assignment_chain?.find(
          (a) => a.role === "level_one" && (a.is_active === 1 || a.is_active === true)
        );
        const originalL1 = String(activeL1?.assigned_to_id ?? taskDetail?.first_assigned_to_id ?? "");
        const normalizeSubs = (subs = []) => {
          const byId = new Map();
          for (const s of subs) {
            const id = String(s.user_id);
            if (!byId.has(id)) byId.set(id, { user_id: id, note: (s.note || "").trim() });
          }
          return [...byId.values()].sort((a, b) => a.user_id.localeCompare(b.user_id));
        };
        const originalSubs = normalizeSubs(
          (taskDetail?.assignment_chain ?? [])
            .filter((a) => a.role === "sub_user")
            .map((a) => ({ user_id: a.assigned_to_id, note: a.note ?? "" }))
        );
        const currentSubs = normalizeSubs(subs);

        if (String(form.assigned_to || "") !== originalL1) {
          payload.assigned_to = form.assigned_to || null;
        }
        if (JSON.stringify(currentSubs) !== JSON.stringify(originalSubs)) {
          payload.sub_users = subs;
        }
        if (canEditAssignedBy && String(form.assigned_by || "") !== String(taskDetail?.assigned_by_id ?? "")) {
          payload.assigned_by = form.assigned_by || null;
        }
      }
    }

    if (form.is_recurring) {
      payload.create_today           = form.create_today;
      payload.recurrence_weekdays    = form.recurrence_weekdays;
      payload.recurrence_month_dates = form.recurrence_month_dates;
      payload.recurrence_year_dates  = form.recurrence_year_dates;
      payload.end_date               = form.end_date || null;
      payload.is_active              = isEdit ? form.is_active : true;
    }

    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      if (Array.isArray(v) || typeof v === "object") fd.append(k, JSON.stringify(v));
      else fd.append(k, v);
    });
    form.attachments.forEach((f) => fd.append("attachments", f));
    return fd;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Please fix the errors");
      return;
    }
    setLoading(true);
    try {
      const fd = buildFormData();
      if (isEdit) {
        await taskService.update(editTask.task_id, fd);
        toast.success("Task updated successfully");
      } else if (isSelf) {
        await taskService.createSelf(fd);
        toast.success(isClone ? "Self task cloned!" : "Self task created!");
      } else {
        await taskService.create(fd);
        toast.success(isClone ? "Task cloned successfully!" : "Task created successfully");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const isLoadingDetail = isEdit && fetchingDetail;
  const headerTitle =
    isEdit  ? (isSelf ? "Edit Self Task"   : "Edit Task")       :
    isClone ? (isSelf ? "Clone Self Task"  : "Clone Task")      :
    isSelf  ? "New Self Task"                                   : "Assign New Task";

  // In sub-user selector: filter out L1 and assigner
  const subUserOptions = users.filter(
    (u) =>
      String(u.id) !== String(form.assigned_to) &&
      String(u.id) !== String(form.assigned_by)
  );

  // const assignedToOptions = users
  //   .filter((u) => String(u.id) !== String(form.assigned_by))
  //   .map((u) => ({ id: u.id, name: `${u.name} ${u?.department?.name ? ` (${u.department.name})` : ""}` }));
  //   // .map((u) => ({ id: u.id, name: `${u.name} (${u.type}) (${u?.department?.name})` }));

 const assignedToOptions = users
  .filter((u) => 
    String(u.id) !== String(form.assigned_by) &&
    String(u.id) !== String(currentUser?.id)   // 👈 exclude logged-in user (creator)
  )
  .map(mapTaskUserToOption);
    
  // If selected user is assigned_by (edge case), still show their name
  const allOptionsForDisplay = users.map(mapTaskUserToOption);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
              isSelf  ? "bg-violet-50 border-violet-200" :
              isClone ? "bg-amber-50  border-amber-200"  :
                        "bg-indigo-50 border-indigo-200"
            }`}>
              {isSelf   ? <User          size={15} className="text-violet-600" /> :
               isClone  ? <Copy          size={15} className="text-amber-600"  /> :
                           <ClipboardList size={15} className="text-indigo-600" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">{headerTitle}</h3>
              <p className="text-xs text-slate-400">
                {isEdit && !isSelf && (canEditAssignment
                  ? "You can change Assign To and sub-users"
                  : "Only the assigner can change Assign To or sub-users")}
                {!isEdit && isSelf  && "Create a personal task for yourself"}
                {!isEdit && !isSelf && "Assign task to Assign To + optional sub-users"}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Permission warning banner */}
        {isEdit && !isSelf && !canEditAssignment && taskDetail && (
          <div className="flex items-center gap-2 px-6 py-2 bg-amber-50 border-b border-amber-100">
            <Lock size={12} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Assign To and sub-users can only be edited by{" "}
              <span className="font-semibold">{taskDetail.assigned_by_name ?? "Assigner"}</span> (assigner)
            </p>
          </div>
        )}

        {/* Banners */}
        {isSelf && !isEdit && (
          <div className="flex items-center gap-2.5 px-6 py-2.5 bg-violet-50 border-b border-violet-100">
            <User size={13} className="text-violet-600 flex-shrink-0" />
            <p className="text-xs text-violet-700">
              This task will be <span className="font-semibold">visible only to you</span>.
            </p>
          </div>
        )}
        {isClone && (
          <div className="flex items-center gap-2.5 px-6 py-2.5 bg-amber-50 border-b border-amber-100">
            <Copy size={13} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Cloning task —<span className="font-semibold"> due date and reminder are reset</span>, please set them.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {isLoadingDetail ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="w-7 h-7 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm text-slate-400">Loading task details…</p>
            </div>
          ) : (
            <>
              {/* Title */}
              {/* <div>
                <Label required>Title</Label>
                <input value={form.title} onChange={set("title")}
                  placeholder="Task title"
                  className={errors.title ? errCls : okCls} />
                <FieldError msg={errors.title} />
              </div> */}

              <div>
                <div className="flex justify-between items-center">
                  <Label required>Title</Label>
                  <span className={`text-[10px] font-medium ${form.title.length >= 250 ? 'text-red-500' : 'text-slate-400'}`}>
                    {form.title.length}/255
                  </span>
                </div>
                <input 
                  value={form.title} 
                  onChange={set("title")}
                  maxLength={255}
                  placeholder="Task title"
                  className={errors.title ? errCls : okCls} 
                />
                <FieldError msg={errors.title} />
              </div>

              {/* Description */}
              {/* <div>
                <Label>Description</Label>
                <textarea value={form.description} onChange={set("description")}
                  placeholder="Task description (optional)" rows={3}
                  className={`${okCls} resize-none`} />
              </div> */}
{/* 
              <div>
                <Label required>Description</Label>
                <textarea 
                  value={form.description} 
                  onChange={(e) => {
                    set("description")(e);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onFocus={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder="Task description" 
                  rows={3}
                  className={errors.description ? errCls : `${okCls} resize-none overflow-hidden min-h-[80px] transition-[height] duration-100`} 
                />
                <FieldError msg={errors.description} />
              </div> */}

              <div>
                <Label required>Description</Label>
                <div className={errors.description ? "rounded-xl border border-rose-300 bg-rose-50/30 p-1" : ""}>
                  <RichTextEditor
                    value={form.description}
                    onChange={(html) => {
                      setForm((p) => ({ ...p, description: html }));
                      setErrors((p) => ({ ...p, description: "" }));
                    }}
                    placeholder="Task description"
                  />
                </div>

                <FieldError msg={errors.description} />
              </div>

              {/* ── ASSIGNED FIELDS ── */}
              {!isSelf && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {/* ASSIGN BY */}
                    <div>
                      {/* {!isEdit ? (
                        <>
                          <SearchableSelect
                            label="Assign By"
                            required
                            options={users.map((u) => ({ id: u.id, name: `${u.name} ${u?.department?.name ? ` (${u.department.name})` : ""}` }))}
                            value={form.assigned_by}
                            onChange={(id) => {
                              setForm((p) => ({
                                ...p, assigned_by: id,
                                assigned_by_name: users.find(u => String(u.id) === String(id))?.name ?? "",
                                assigned_to:  String(p.assigned_to) === String(id) ? "" : p.assigned_to,
                                sub_users:    p.sub_users.filter((s) => String(s.user_id) !== String(id)),
                              }));
                              setErrors((p) => ({ ...p, assigned_by: "" }));
                            }}
                            placeholder={fetchingMeta ? "Loading…" : "Who is assigning?"}
                          />
                          <FieldError msg={errors.assigned_by} />
                        </>
                      ) : (
                        <div>
                          <Label>
                            <span className="flex items-center gap-1">
                              <Lock size={9} className="text-slate-400" /> Assign By
                            </span>
                          </Label>
                          <div className={lockCls + " flex items-center gap-2"}>
                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-slate-500">{(form.assigned_by_name || "?").charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="truncate">{form.assigned_by_name || "—"}</span>
                          </div>
                        </div>
                      )} */}

                      {/* ASSIGN BY */}
                      {(!isEdit || canEditAssignedBy) ? (
                        <>
                          <SearchableSelect
                            label="Assign By"
                            required
                            // options={users.map((u) => ({ id: u.id, name: `${u.name} ${u?.department?.name ? ` (${u.department.name})` : ""}` }))}
                            options={users
                              .filter((u) => String(u.id) !== String(form.assigned_to))
                              .map(mapTaskUserToOption)
                            }
                            value={form.assigned_by}
                            onChange={(id) => {
                              setForm((p) => ({
                                ...p, assigned_by: id,
                                assigned_by_name: users.find(u => String(u.id) === String(id))?.name ?? "",
                                assigned_to:  String(p.assigned_to) === String(id) ? "" : p.assigned_to,
                                sub_users:    p.sub_users.filter((s) => String(s.user_id) !== String(id)),
                              }));
                              setErrors((p) => ({ ...p, assigned_by: "" }));
                            }}
                            placeholder={fetchingMeta ? "Loading…" : "Who is assigning?"}
                          />
                          <FieldError msg={errors.assigned_by} />
                        </>
                      ) : (
                        <div>
                          <Label>
                            <span className="flex items-center gap-1">
                              <Lock size={9} className="text-slate-400" /> Assign By
                            </span>
                          </Label>
                          <div className={lockCls + " flex items-center gap-2"}>
                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-slate-500">{(form.assigned_by_name || "?").charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="truncate">{form.assigned_by_name || "—"}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ASSIGN TO (L1) */}
                    <div>
                      {canEditAssignment ? (
                        <>
                          <SearchableSelect
                            label={
                              <span className="flex items-center gap-1">
                                <Crown size={9} className="text-amber-500" /> Assign To
                                {isEdit && <span className="text-[9px] text-indigo-400 font-normal normal-case ml-1">(editable)</span>}
                              </span>
                            }
                            required
                            // options={users.filter((u) => String(u.id) !== String(form.assigned_by)).map((u) => ({ id: u.id, name: `${u.name} (${u.type})` }))}
                            options={assignedToOptions}              // filtered — assigned_by hidden from dropdown
                            displayOptions={allOptionsForDisplay}    // full list — so selected name resolves
                            value={form.assigned_to}
                            onChange={(id) => {
                              setForm((p) => ({
                                ...p,
                                assigned_to: id,
                                sub_users: p.sub_users.filter((s) => String(s.user_id) !== String(id)),
                              }));
                              setErrors((p) => ({ ...p, assigned_to: "" }));
                            }}
                            placeholder={fetchingMeta ? "Loading…" : "Who is assigned?"}
                          />
                          {isEdit && (
                            <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                              <AlertCircle size={9} /> If it is assigned to work in the new sub-user, it will be removed.
                            </p>
                          )}
                          <FieldError msg={errors.assigned_to} />
                        </>
                      ) : (
                        <div>
                          <Label>
                            <span className="flex items-center gap-1">
                              <Crown size={9} className="text-amber-500" /> Assign To
                              <Lock size={9} className="text-slate-400" />
                            </span>
                          </Label>
                          <div className={lockCls + " flex items-center gap-2"}>
                            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-amber-600">{(taskDetail?.first_assigned_to_name || "?").charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="truncate">{taskDetail?.first_assigned_to_name || "—"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub-users */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>
                        <span className="flex items-center gap-1.5">
                          <Users size={11} /> Add Other User
                          {form?.sub_users?.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold">{form.sub_users.length}</span>
                          )}
                          {isEdit && !canEditAssignment && (
                            <span className="flex items-center gap-0.5 text-slate-400 font-normal normal-case text-[10px]"><Lock size={9} /> locked</span>
                          )}
                        </span>
                      </Label>
                      {canEditAssignment && <span className="text-[10px] text-slate-400">Optional — Assign To will approve their work</span>}
                    </div>
                    <SubUserSelector
                      users={subUserOptions}
                      value={form.sub_users}
                      onChange={(val) => { setForm((p) => ({ ...p, sub_users: val })); setErrors((p) => ({ ...p, sub_users: "" })); }}
                      disabled={!canEditAssignment}
                    />
                    <FieldError msg={errors.sub_users} />
                  </div>

                  {/* Assignment preview */}
                  <AssignmentPreview
                    users={users}
                    assignedBy={form.assigned_by}
                    assignedTo={form.assigned_to}
                    subUsers={form.sub_users}
                  />
                </>
              )}

              {/* Category + Due Date + Reminder */}
              <div className={`grid ${!form.is_recurring ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
                <div>
                  <SearchableSelect
                    label="Category"
                    required
                    options={categories}
                    value={form.category_id}
                    onChange={(id) => {
                      setForm((p) => ({ ...p, category_id: id }));
                      setErrors((p) => ({ ...p, category_id: "" }));
                    }}
                    placeholder={fetchingMeta ? "Loading…" : "Select category"}
                  />
                  <FieldError msg={errors.category_id} />
                </div>

                {!form.is_recurring && (
                  <div>
                    <Label>Due Date</Label>
                    <input type="date" value={form.due_date} min={today}
                      onChange={(e) => {
                        const due = e.target.value;
                        setForm((p) => ({
                          ...p,
                          due_date: due,
                          ...(isSelf
                            ? { self_reminder_date: isEdit ? p.self_reminder_date : calcAutoReminder(due) }
                            : { reminder_date:      isEdit ? p.reminder_date      : calcAutoReminder(due) }
                          ),
                        }));
                        setErrors((p) => ({ ...p, due_date: "", reminder_date: "", self_reminder_date: "" }));
                      }}
                      className={okCls}
                    />
                  </div>
                )}
              </div>

              {/* Priority + Status */}
              <div className={`grid gap-4 ${isSelf ? "grid-cols-1" : "grid-cols-2"}`}>
                <div>
                  <SelectField label="Priority" value={form.priority} onChange={set("priority")} options={PRIORITIES} selectCls={selCls} />
                </div>
                {!isSelf && (
                  <div>
                    <SelectField label="Status" value={form.status} onChange={set("status")} options={TASK_STATUSES_OPTIONS} selectCls={selCls} />
                  </div>
                )}
              </div>


              {/* Attachments */}
              {/* <div>
                <Label>Attachments</Label>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                  onClick={() => document.getElementById("task-file-input").click()}>
                  <input
                    id="task-file-input"
                    type="file"
                    multiple
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const allowed = [
                        "image/jpeg", "image/png", "image/jpg",
                        "image/gif", "image/webp",
                        "application/pdf",
                        "application/msword",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                      ];
                      const files   = Array.from(e.target.files);
                      const valid   = files.filter((f) => allowed.includes(f.type));
                      const invalid = files.filter((f) => !allowed.includes(f.type));

                      if (invalid.length > 0)
                        toast.error(`${invalid.length} file(s) rejected — only images & documents allowed`);

                      if (valid.length > 0)
                        setForm((p) => ({ ...p, attachments: [...p.attachments, ...valid] }));

                      e.target.value = "";
                    }}
                  />
                  <p className="text-xs text-slate-400">Click to upload files</p>
                  <p className="text-xs text-slate-300 mt-0.5">Images (JPG, PNG, GIF, WEBP) · Documents (PDF, DOC, DOCX)</p>
                </div>

                {form.attachments.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {form.attachments.map((file, i) => {
                      const isImage = file.type.startsWith("image/");
                      const isPdf   = file.type === "application/pdf";
                      return (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                              isImage ? "bg-emerald-100" : isPdf ? "bg-rose-100" : "bg-indigo-100"
                            }`}>
                              {isImage
                                ? <ImageIcon size={11} className="text-emerald-600" />
                                : isPdf
                                  ? <FileText size={11} className="text-rose-600" />
                                  : <ClipboardList size={11} className="text-indigo-600" />
                              }
                            </div>
                            <span className="text-xs text-slate-700 truncate">{file.name}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {(file.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                          <button type="button"
                            onClick={() => setForm((p) => ({
                              ...p, attachments: p.attachments.filter((_, idx) => idx !== i),
                            }))}
                            className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0 ml-2">
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div> */}

              {/* Attachments — show only on create */}
              {!isEdit && (
                <div>
                  <Label>Attachments</Label>
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                    onClick={() => document.getElementById("task-file-input").click()}>
                    <input
                      id="task-file-input"
                      type="file"
                      multiple
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
                      onChange={(e) => {
                        const allowed = [
                          "image/jpeg", "image/png", "image/jpg",
                          "image/gif", "image/webp",
                          "application/pdf",
                          "application/msword",
                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        ];
                        const files   = Array.from(e.target.files);
                        const valid   = files.filter((f) => allowed.includes(f.type));
                        const invalid = files.filter((f) => !allowed.includes(f.type));

                        if (invalid.length > 0)
                          toast.error(`${invalid.length} file(s) rejected — only images & documents allowed`);

                        if (valid.length > 0)
                          setForm((p) => ({ ...p, attachments: [...p.attachments, ...valid] }));

                        e.target.value = "";
                      }}
                    />
                    <p className="text-xs text-slate-400">Click to upload files</p>
                    <p className="text-xs text-slate-300 mt-0.5">Images (JPG, PNG, GIF, WEBP) · Documents (PDF, DOC, DOCX)</p>
                  </div>

                  {form.attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {form.attachments.map((file, i) => {
                        const isImage = file.type.startsWith("image/");
                        const isPdf   = file.type === "application/pdf";
                        return (
                          <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                                isImage ? "bg-emerald-100" : isPdf ? "bg-rose-100" : "bg-indigo-100"
                              }`}>
                                {isImage
                                  ? <ImageIcon size={11} className="text-emerald-600" />
                                  : isPdf
                                    ? <FileText size={11} className="text-rose-600" />
                                    : <ClipboardList size={11} className="text-indigo-600" />
                                }
                              </div>
                              <span className="text-xs text-slate-700 truncate">{file.name}</span>
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                {(file.size / 1024).toFixed(0)} KB
                              </span>
                            </div>
                            <button type="button"
                              onClick={() => setForm((p) => ({
                                ...p, attachments: p.attachments.filter((_, idx) => idx !== i),
                              }))}
                              className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0 ml-2">
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              
              {/* Recurring toggle */}
              {!isEdit && (
                <>
                  <div className="flex items-center gap-3 py-1">
                    {/* Recurring Task Toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          is_recurring: !p.is_recurring,
                          ...(!p.is_recurring
                            ? { due_date: "", create_today: false }
                            : {}),
                        }))
                      }
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        form.is_recurring ? "bg-indigo-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          form.is_recurring ? "translate-x-5" : ""
                        }`}
                      />
                    </button>

                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Repeat
                        size={14}
                        className={
                          form.is_recurring ? "text-indigo-600" : "text-slate-400"
                        }
                      />
                      Recurring Task
                    </span>

                    {/* Create Today Toggle */}
                    {form.is_recurring && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              create_today: !p.create_today,
                            }))
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            form.create_today ? "bg-green-500" : "bg-slate-200"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              form.create_today ? "translate-x-5" : ""
                            }`}
                          />
                        </button>

                        <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                          <Calendar1
                            size={14}
                            className={
                              form.create_today ? "text-green-500" : "text-slate-400"
                            }
                          />
                          Create Today
                        </span>
                      </>
                    )}
                  </div>

                  {form.is_recurring && (
                    <>
                      <RecurringSection
                        form={form}
                        setForm={setForm}
                        isEdit={isEdit}
                      />
                      <FieldError msg={errors.recurring} />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave}
            disabled={loading || fetchingMeta || isLoadingDetail}
            className={`px-5 py-2 text-sm font-medium text-white rounded-xl transition-all flex items-center gap-2 shadow-sm disabled:opacity-60 ${
              isSelf  ? "bg-violet-600 hover:bg-violet-700" :
              isClone ? "bg-amber-500  hover:bg-amber-600"  :
                        "bg-indigo-600 hover:bg-indigo-700"
            }`}>
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Saving…
              </>
            ) : isClone ? <><Copy  size={15} /> Clone Task</>
              : isEdit  ? <><Check size={15} /> Save Changes</>
              : isSelf  ? <><User  size={15} /> Create Self Task</>
                        : <><Check size={15} /> Assign Task</>
            }
          </button>
        </div>

      </div>
    </div>
  );
}
