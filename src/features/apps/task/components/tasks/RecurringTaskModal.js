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
import Drawer from "@/core/components/ui/Drawer";
import {
  OK_INPUT,
  ERR_INPUT,
  FORM_LABEL_CLASS,
  FORM_ERROR_CLASS,
} from "@/core/components/common/Constants";
import SelectField      from "../common/SelectField";
import SearchableSelect from "../common/SearchableSelect";
import { recurringTaskService } from "@/features/apps/task/services/recurringTaskApi";
import { FILE_BASE_URL } from "@/core/utils/lib";
import RichTextEditor from "../common/RichTextEditor";
import YearlyRecurrencePicker from "../common/YearlyRecurrencePicker";

// ─── IMS drawer density — same height / radius as SearchableSelect ─────────────
const okCls   = OK_INPUT;
const errCls  = ERR_INPUT;
const lockCls = `${OK_INPUT} !bg-slate-50 !text-slate-500 !border-slate-100 cursor-not-allowed opacity-90`;
const selCls  = `${OK_INPUT} appearance-none pr-9`;
 

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
    <p className={`${FORM_ERROR_CLASS} mt-1`}>
      <AlertCircle size={12} className="shrink-0" /> {msg}
    </p>
  );
}

function Label({ children, required }) {
  return (
    <label className={`block mb-1 ${FORM_LABEL_CLASS}`}>
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
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

          {!disabled && (
            <button 
              type="button" 
              onClick={() => removeUser(su.user_id)}
              className="text-slate-300 hover:text-rose-500 transition-colors mt-0.5 flex-shrink-0"
              title="Remove">
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
              <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    form.is_active
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <span>{form.is_active ? "Active" : "Inactive"}</span>
                  <div
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      form.is_active ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        form.is_active ? "translate-x-4" : ""
                      }`}
                    />
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
        <YearlyRecurrencePicker
          yearDates={safeYearDates}
          resetKey={form.recurrence_type}
          onChange={(dates) => setForm((p) => ({ ...p, recurrence_year_dates: dates }))}
        />
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
export default function RecurringTaskModal({open, onClose, onSuccess, editTask, prefillTask, taskType = "assigned", currentUser}) {
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
        const userPromise = isSelf
          ? Promise.resolve(null)
          : userService.getViews().then((res) => {
              setUsers(extractList(res));
            }).catch(() => {
              setUsers([]);
            });

        const categoryPromise = categoryService.getViews({
          permission_module: "recurring_task",
          permission_action: "add",
          limit: 200,
        })
          .then((res) => {
            setCategories(extractList(res));
          })
          .catch(() => {
            setCategories([]);
          });

        await Promise.all([userPromise, categoryPromise]);
      } finally {
        setFetchingMeta(false);
      }
    };
    load();
  }, [open, isSelf]);

  // ── Edit: fetch full task detail ──────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setTaskDetail(null);
      return;
    }

    if (isEdit && editTask?.recurring_id) {
      const fetchTaskDetail = async () => {
        setFetchingDetail(true);
        try {
          const res = await recurringTaskService.getById(editTask.recurring_id);
          const data = res.data.data;

          // Collect attachments from chat
          const chatAttachments = (data.chat || []).flatMap(c => 
            (c.attachments || []).map(a => ({
              ...a,
              isExisting: true, // mark as already uploaded
            }))
          );
          const mappedTask = {
            ...data,
            is_recurring: true,
            recurrence_weekdays: parseArr(data.recurrence_weekdays),
            recurrence_month_dates: parseArr(data.recurrence_month_dates),
            recurrence_year_dates: parseArr(data.recurrence_year_dates),
            assigned_by: data.assigned_by ?? "",
            assigned_by_name: data.assigned_by_name ?? "",
            assigned_to: data.assigned_to ?? "",
            assigned_to_name: data.assigned_to_name ?? "",
            sub_users: data.sub_users?.map(u => ({
              assignment_id: u.assignment_id,
              assigned_by: u.assigned_by,
              assigned_to: u.assigned_to,
              name: u.name,
              role: u.role,
              is_level_one: !!u.is_level_one,
              level: u.level,
              parent_assignment_id: u.parent_assignment_id,
            })) || [],
            attachments: chatAttachments, // 👈 use chat attachments
          };

          setTaskDetail(mappedTask);
          setForm(prev => ({ ...prev, attachments: chatAttachments }));

        } catch (err) {
          console.error(err);
          toast.error("Failed to load task details");
        } finally {
          setFetchingDetail(false);
        }
      };

      fetchTaskDetail();
    }
  }, [open, isEdit, editTask]);

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
    // const buildSubUsers = (chain = []) =>
    //   chain
    //     .filter((a) => a.role === "sub_user")
    //     .map((a) => ({
    //       user_id:   a.assigned_to_id,
    //       name:      a.assigned_to_name,
    //       type:      a.assigned_to_type ?? "",
    //       note:      a.note ?? "",
    //       is_active: a.is_active === 1 || a.is_active === true,
    //     }));

  const buildSubUsers = (users = []) =>
    users
      .filter(u => u.role === "sub_user") // only sub-users
      .map(u => ({
        user_id:   u.assigned_to,
        name:      u.name,
        type:      u.type ?? "",  // optional
        note:      u.note ?? "",  // optional
        is_active: u.is_active === 1 || u.is_active === true,
      }));

    if (isEdit) {
      if (!taskDetail) return;
      const activeL1 = taskDetail.sub_users?.find(
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
          is_active: taskDetail.is_active === 1 || taskDetail.is_active === true,
          attachments: taskDetail.attachments || [],
        });
      } else {
        setForm({
          title:                  taskDetail.title              ?? "",
          description:            taskDetail.description        ?? "",
          assigned_by:            taskDetail.assigned_by_id     ?? taskDetail.assigned_by   ?? "",
          assigned_by_name:       taskDetail.assigned_by_name   ?? "",
          assigned_to:            activeL1?.assigned_to ?? activeL1?.assigned_to_id ?? taskDetail.assigned_to ?? "",
          assigned_to_name:       taskDetail.assigned_to_name   ?? "",
          sub_users:              buildSubUsers(taskDetail.sub_users),
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
          is_active: taskDetail.is_active === 1 || taskDetail.is_active === true,
          attachments: taskDetail.attachments || [],
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
    if (!form.category_id) e.category_id = "Category is required";

    // Validate assignment fields only in create mode
    if (!isEdit && !isSelf) {
      if (!form.assigned_by) e.assigned_by = "Please select the assigner";
      if (!form.assigned_to) e.assigned_to = "Please select the Level-1 assignee";
      else if (
        form.assigned_by &&
        String(form.assigned_by) === String(form.assigned_to)
      ) {
        e.assigned_to = "Assign To cannot be the same as Assign By";
      }
      const badSub = form.sub_users.find((s) => String(s.user_id) === String(form.assigned_to));
      if (badSub) e.sub_users = "Sub-user cannot be same as Level-1";
    }

    // Recurring validation only in create mode
    if (!isEdit && form.is_recurring) {
      if (form.recurrence_type === "weekly"  && form.recurrence_weekdays.length    === 0) e.recurring = "Select at least one day";
      if (form.recurrence_type === "monthly" && form.recurrence_month_dates.length === 0) e.recurring = "Select at least one date";
      if (form.recurrence_type === "yearly"  && form.recurrence_year_dates.length  === 0) e.recurring = "Select at least one date";
    }

    return e;
  };

  // ── Build FormData ────────────────────────────────────────────────────────
  const buildFormData = () => {
    const fd = new FormData();

    fd.append("title", form.title.trim());
    fd.append("description", form.description || "");
    fd.append("category_id", form.category_id || "");
    fd.append("priority", form.priority);

    if (isEdit) {
      // Recurring fields
      fd.append("recurrence_type", form.recurrence_type);
      fd.append("end_date", form.end_date || "");
      fd.append("is_active", form.is_active ? "true" : "false");
      fd.append("recurrence_weekdays",    JSON.stringify(form.recurrence_weekdays    ?? []));
      fd.append("recurrence_month_dates", JSON.stringify(form.recurrence_month_dates ?? []));
      fd.append("recurrence_year_dates",  JSON.stringify(form.recurrence_year_dates  ?? []));

      // Assignment fields — only send when actually changed
      if (!isSelf && taskDetail) {
        const activeL1 = taskDetail.sub_users?.find(
          (a) => a.role === "level_one" && (a.is_active === 1 || a.is_active === true)
        );
        const originalL1 = String(activeL1?.assigned_to ?? activeL1?.assigned_to_id ?? taskDetail.assigned_to ?? "");
        const normalizeSubs = (subs = []) =>
          subs
            .map((s) => ({ user_id: String(s.user_id ?? s.assigned_to), note: (s.note || "").trim() }))
            .sort((a, b) => a.user_id.localeCompare(b.user_id));
        const originalSubs = normalizeSubs(
          (taskDetail.sub_users ?? [])
            .filter((a) => a.role === "sub_user")
            .map((a) => ({ user_id: a.assigned_to, note: a.note ?? "" }))
        );
        const currentSubs = normalizeSubs(form.sub_users ?? []);

        if (String(form.assigned_by || "") !== String(taskDetail.assigned_by_id ?? taskDetail.assigned_by ?? "")) {
          fd.append("assigned_by", form.assigned_by || "");
        }
        if (String(form.assigned_to || "") !== originalL1) {
          fd.append("assigned_to", form.assigned_to || "");
        }
        if (JSON.stringify(currentSubs) !== JSON.stringify(originalSubs)) {
          fd.append("sub_users", JSON.stringify(form.sub_users ?? []));
        }
      }
    } else {
      // Create mode
      fd.append("is_recurring", form.is_recurring ? "true" : "false");

      if (!isSelf) {
        fd.append("assigned_by", form.assigned_by || "");
        fd.append("assigned_to", form.assigned_to || "");
        if (form.sub_users.length > 0)
          fd.append("sub_users", JSON.stringify(form.sub_users));
      }

      if (form.is_recurring) {
        fd.append("recurrence_type",        form.recurrence_type);
        fd.append("create_today",           form.create_today ? "true" : "false");
        fd.append("end_date",               form.end_date || "");
        fd.append("recurrence_weekdays",    JSON.stringify(form.recurrence_weekdays    ?? []));
        fd.append("recurrence_month_dates", JSON.stringify(form.recurrence_month_dates ?? []));
        fd.append("recurrence_year_dates",  JSON.stringify(form.recurrence_year_dates  ?? []));
      } else {
        fd.append("due_date", form.due_date || "");
      }

      if (!isSelf) fd.append("status", form.status || "pending");
    }

    
    // form.attachments
    //   .filter(f => !f.isExisting)
    //   .forEach(f => fd.append("attachments", f));

    // // ✅ Existing files to keep
    // const keepFiles = form.attachments
    //   .filter(f => f.isExisting)
    //   .map(f => f.file_path);
    // fd.append("keep_attachments", JSON.stringify(keepFiles));


    form.attachments
      .filter(f => !f.isExisting)
      .forEach(f => fd.append("attachments", f));

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
        await recurringTaskService.update(editTask.recurring_id, fd);
        toast.success("Recurring schedule updated!");
      } else if (isSelf) {
        await taskService.createSelf(fd);
        toast.success("Self task created!");
      } else {
        await taskService.create(fd);
        toast.success("Task created successfully");
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const isLoadingDetail = isEdit && fetchingDetail;
  const headerTitle =
    isEdit  ? (isSelf ? "Edit Self Task"   : "Edit Task")       :
    isClone ? (isSelf ? "Clone Self Task"  : "Clone Task")      :
    isSelf  ? "New Self Task"                                   : "Assign New Task";
  const headerDescription =
    isEdit && !isSelf
      ? (canEditAssignment
        ? "You can change Assign To and sub-users"
        : "Only the assigner can change Assign To or sub-users")
      : !isEdit && isSelf
        ? "Create a personal task for yourself"
        : !isEdit && !isSelf
          ? "Assign task to Assign To + optional sub-users"
          : "";

  // In sub-user selector: filter out L1 and assigner
  const subUserOptions = users.filter(
    (u) =>
      String(u.id) !== String(form.assigned_to) &&
      String(u.id) !== String(form.assigned_by)
  );

  // Assign To: creator OK; Assign By person must not appear (cannot be both)
  const assignedToOptions = users
    .filter((u) => !form.assigned_by || String(u.id) !== String(form.assigned_by))
    .map(mapTaskUserToOption);
  const allOptionsForDisplay = assignedToOptions;
  const assignByOptions = users.map(mapTaskUserToOption);

  const handleRemoveAttachment = async (file, index) => {
    if (file.isExisting && isEdit) {
      try {
        await recurringTaskService.removeAttachment(editTask.recurring_id, file.file_path);
        setForm(p => ({
          ...p,
          attachments: p.attachments.filter((_, idx) => idx !== index),
        }));
        toast.success("Attachment removed");
      } catch {
        toast.error("Failed to remove attachment");
      }
    } else {
      setForm(p => ({
        ...p,
        attachments: p.attachments.filter((_, idx) => idx !== index),
      }));
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSave}
      closeOnOutside={false}
      title={headerTitle}
      description={headerDescription}
      headerVariant="form"
      maxWidth="max-w-3xl"
      banner={
        (isEdit && !isSelf && !canEditAssignment && taskDetail) || (isSelf && !isEdit) || isClone ? (
          <>
            {isEdit && !isSelf && !canEditAssignment && taskDetail ? (
              <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-amber-50 border-b border-amber-100">
                <Lock size={12} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Assign To and sub-users can only be edited by{" "}
                  <span className="font-semibold">{taskDetail.assigned_by_name ?? "Assigner"}</span> (assigner)
                </p>
              </div>
            ) : null}
            {isSelf && !isEdit ? (
              <div className="flex items-center gap-2.5 px-4 sm:px-6 py-2.5 bg-violet-50 border-b border-violet-100">
                <User size={13} className="text-violet-600 flex-shrink-0" />
                <p className="text-xs text-violet-700">
                  This task will be <span className="font-semibold">visible only to you</span>.
                </p>
              </div>
            ) : null}
            {isClone ? (
              <div className="flex items-center gap-2.5 px-4 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-100">
                <Copy size={13} className="text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Cloning task —<span className="font-semibold"> due date and reminder are reset</span>, please set them.
                </p>
              </div>
            ) : null}
          </>
        ) : null
      }
      footer={
        <>
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave}
            disabled={loading || fetchingMeta || isLoadingDetail}
            title="Ctrl+S"
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
        </>
      }
    >
        <div className="space-y-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    {/* ASSIGN BY */}
                    <div className="min-w-0 w-full">
                      {(!isEdit || canEditAssignedBy) ? (
                        <>
                          <SearchableSelect
                            label="Assign By"
                            required
                            clearable
                            options={assignByOptions}
                            value={form.assigned_by}
                            onChange={(id) => {
                              setForm((p) => ({
                                ...p,
                                assigned_by: id || "",
                                assigned_by_name: id
                                  ? (users.find((u) => String(u.id) === String(id))?.name ?? "")
                                  : "",
                                assigned_to:
                                  id && String(p.assigned_to) === String(id) ? "" : p.assigned_to,
                                sub_users: id
                                  ? p.sub_users.filter((s) => String(s.user_id) !== String(id))
                                  : p.sub_users,
                              }));
                              setErrors((p) => ({ ...p, assigned_by: "", assigned_to: "" }));
                            }}
                            placeholder={fetchingMeta ? "Loading…" : "Who is assigning?"}
                          />
                          <FieldError msg={errors.assigned_by} />
                        </>
                      ) : (
                        <div className="min-w-0 w-full">
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
                    <div className="min-w-0 w-full">
                      {canEditAssignment ? (
                        <>
                          <SearchableSelect
                            label="Assign To"
                            required
                            clearable
                            options={assignedToOptions}
                            displayOptions={allOptionsForDisplay}
                            value={form.assigned_to}
                            onChange={(id) => {
                              setForm((p) => ({
                                ...p,
                                assigned_to: id || "",
                                sub_users: id
                                  ? p.sub_users.filter((s) => String(s.user_id) !== String(id))
                                  : p.sub_users,
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
                        <div className="min-w-0 w-full">
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
              <div>
                <Label>Attachments</Label>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                  onClick={() => document.getElementById("recurring-file-input").click()}>
                  <input
                    id="recurring-file-input" 
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
                      const isExisting = file.isExisting;
                      const name = file.name || file.file_name;
                      const size = file.size || file.file_size || 0;

                      const fileUrl = isExisting ? `${FILE_BASE_URL}/${file.file_path}` : URL.createObjectURL(file);

                      const isImage = (file.type || file.mime_type || "").startsWith("image/");
                      const isPdf   = (file.type || file.mime_type) === "application/pdf";

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

                            {/* Wrap name in a link to open in new tab */}
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-slate-700 truncate hover:underline"
                            >
                              {name}
                            </a>

                            <span className="text-xs text-slate-400 flex-shrink-0">{(size / 1024).toFixed(0)} KB</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(file, i)}
                            // onClick={() => setForm(p => ({
                            //   ...p,
                            //   attachments: p.attachments.filter((_, idx) => idx !== i),
                            // }))}
                            className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0 ml-2"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recurring toggle */}
              <div className="flex items-center gap-3 py-1">
                {/* Recurring Task Toggle */}
                <button
                  type="button"
                  // onClick={() => setForm((p) => ({...p, is_recurring: !p.is_recurring, ...(!p.is_recurring ? { due_date: "", create_today: false } : {}), }))}
                  onClick={() =>
                    setForm((p) => {
                      const next = !p.is_recurring;

                      return {
                        ...p,
                        is_recurring: next,
                        ...(next ? { due_date: "" } : {}),
                        ...(!next ? { create_today: false } : {}),
                      };
                    })
                  }
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.is_recurring ? "bg-indigo-600" : "bg-slate-200"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_recurring ? "translate-x-5" : ""}`}/>
                </button>
                <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Repeat size={14} className={form.is_recurring ? "text-indigo-600" : "text-slate-400"} />
                  Recurring Task
                </span>

                {/* Create Today Toggle: only visible when Recurring is ON */}
                {form.is_recurring && !isEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, create_today: !p.create_today }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${form.create_today ? "bg-green-500" : "bg-slate-200"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.create_today ? "translate-x-5" : ""}`}/>
                    </button>
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Calendar1 size={14} className={form.create_today ? "text-green-500" : "text-slate-400"} />
                      Create Today
                    </span>
                  </>
                )}
              </div>
 
              {form.is_recurring && (
                <>
                  <RecurringSection form={form} setForm={setForm} isEdit={isEdit} />
                  <FieldError msg={errors.recurring} />
                </>
              )}
            </>
          )}
        </div>
    </Drawer>
  );
}
