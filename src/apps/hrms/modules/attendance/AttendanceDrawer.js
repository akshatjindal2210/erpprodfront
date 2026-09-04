"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import dayjs from "dayjs";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { FormLabel, OK_INPUT } from "@/ui/common/Constants";
import { attendanceService } from "@/apps/hrms/lib/services/hrms";
import { useHrmsEmployeeHelper } from "@/apps/hrms/lib/hooks/useHrmsEmployeeHelper";

const MODULE = "hrms_attendance";
const STATUSES = ["Present", "Absent"];
const SHIFTS = [
  { value: "A", label: "Day (A)" },
  { value: "B", label: "Night (B)" },
];

function shiftLabel(code) {
  if (code === "B") return "Night";
  if (code === "A") return "Day";
  return "";
}

const FIELD =
  `${OK_INPUT} min-h-10 sm:min-h-9 text-slate-900 placeholder:text-slate-500 scheme-light [color-scheme:light] [&::-webkit-datetime-edit]:text-slate-900 [&::-webkit-datetime-edit-fields-wrapper]:text-slate-900 [&::-webkit-date-and-time-value]:min-h-[1.25em] [&::-webkit-date-and-time-value]:text-slate-900 [&::-webkit-calendar-picker-indicator]:opacity-80`;
const ACTION_BTN =
  "h-10 sm:h-9 min-h-10 sm:min-h-9 px-4 w-full sm:w-auto shrink-0 rounded-lg text-xs sm:text-[10px] font-black uppercase tracking-wide shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-55";

function todayYmd() {
  return dayjs().format("YYYY-MM-DD");
}

function toTimeInput(value) {
  if (value == null || String(value).trim() === "") return "";
  const s = String(value).trim();
  const iso = s.match(/T(\d{2}):(\d{2})/i);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const plain = s.match(/^(\d{1,2}):(\d{2})/);
  if (plain) return `${String(plain[1]).padStart(2, "0")}:${plain[2]}`;
  return "";
}

function fingerprint(row) {
  return [
    toTimeInput(row?.check_in),
    toTimeInput(row?.check_out),
    String(row?.status ?? "Present").trim().toLowerCase(),
    row?.shift === "B" ? "B" : "A",
  ].join("|");
}

function rowKey(row, index) {
  return String(row?.employee_code || row?.id || index);
}

export default function AttendanceDrawer({ open, mode = "add", record = null, onClose, onSuccess }) {
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd = mode === "add";
  const { loadEmployeeViews } = useHrmsEmployeeHelper(MODULE, isAdd ? "add" : isEdit ? "edit" : "view");

  const [entryType, setEntryType] = useState("");
  const [date, setDate] = useState(todayYmd);
  const [loaded, setLoaded] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [baselines, setBaselines] = useState({});
  const [rowSearch, setRowSearch] = useState("");
  const [manual, setManual] = useState({
    employee_code: "",
    name: "",
    shift: "A",
    check_in: "",
    check_out: "",
    status: "Present",
  });

  const resetForm = useCallback((nextRecord) => {
    setEntryType(nextRecord ? (nextRecord.entry_type === "manual" ? "manual" : "automatic") : "");
    setDate(nextRecord?.attendance_date || todayYmd());
    setLoaded(Boolean(nextRecord));
    setRows([]);
    setBaselines({});
    setRowSearch("");
    setManual({
      employee_code: nextRecord?.employee_code || "",
      name: nextRecord?.name || "",
      shift: nextRecord?.shift === "B" ? "B" : "A",
      check_in: toTimeInput(nextRecord?.check_in),
      check_out: toTimeInput(nextRecord?.check_out),
      status: nextRecord?.status || "Present",
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm(record);
  }, [open, record, resetForm]);

  const clearLoaded = useCallback(() => {
    setLoaded(false);
    setRows([]);
    setBaselines({});
    setRowSearch("");
  }, []);

  const resetManualFields = useCallback(() => {
    setManual({
      employee_code: "",
      name: "",
      shift: "A",
      check_in: "",
      check_out: "",
      status: "Present",
    });
  }, []);

  const loadPreview = useCallback(async (attendanceDate) => {
    if (!attendanceDate) {
      toast.warning("Date is required.");
      return false;
    }
    setLoadingPreview(true);
    try {
      const res = await attendanceService.preview({ date: attendanceDate });
      const list = (res.data ?? []).map((row) => ({
        ...row,
        shift: row.shift === "B" ? "B" : "A",
      }));
      const nextBaseline = {};
      list.forEach((row, index) => {
        nextBaseline[rowKey(row, index)] = fingerprint(row);
      });
      setRows(list);
      setBaselines(nextBaseline);
      setLoaded(true);
      return true;
    } catch (err) {
      toast.error(err?.message || "Failed to load attendance for this date.");
      setRows([]);
      setBaselines({});
      setLoaded(false);
      return false;
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const handleLoad = async () => {
    if (!entryType) {
      toast.warning("Select type first.");
      return;
    }
    if (!date) {
      toast.warning("Date is required.");
      return;
    }
    if (entryType === "manual") {
      setRows([]);
      setBaselines({});
      setLoaded(true);
      return;
    }
    await loadPreview(date);
  };

  const editedCount = useMemo(
    () => rows.filter((row, index) => fingerprint(row) !== (baselines[rowKey(row, index)] || "")).length,
    [rows, baselines]
  );

  const visibleRows = useMemo(() => {
    const q = rowSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.employee_code || ""} ${row.name || ""}`.toLowerCase().includes(q));
  }, [rows, rowSearch]);

  const fetchEmployees = useCallback(
    async ({ search = "", page = 1, limit = 50 } = {}) => {
      const res = await loadEmployeeViews({ search, page, limit });
      return { data: res.data ?? [], total: res.total ?? 0 };
    },
    [loadEmployeeViews]
  );

  const patchRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSubmit = async () => {
    if (isView) return onClose?.();
    if (!date) {
      toast.warning("Date is required.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        if (!manual.shift) {
          toast.warning("Select shift for this employee.");
          setSaving(false);
          return;
        }
        await attendanceService.update({
          id: record.id,
          attendance_date: date,
          shift: manual.shift,
          employee_code: manual.employee_code,
          name: manual.name,
          check_in: manual.check_in || null,
          check_out: manual.check_out || null,
          status: manual.status,
        });
        toast.success("Attendance updated.");
      } else if (entryType === "manual") {
        if (!manual.employee_code) {
          toast.warning("Select an employee.");
          setSaving(false);
          return;
        }
        if (!manual.shift) {
          toast.warning("Select shift for this employee.");
          setSaving(false);
          return;
        }
        await attendanceService.submit({
          date,
          entry_type: "manual",
          rows: [
            {
              employee_code: manual.employee_code,
              name: manual.name,
              shift: manual.shift,
              check_in: manual.check_in || null,
              check_out: manual.check_out || null,
              status: manual.status,
            },
          ],
        });
        toast.success("Manual attendance submitted for approval.");
      } else {
        if (!rows.length) {
          toast.warning("No attendance rows to submit.");
          setSaving(false);
          return;
        }
        const payloadRows = rows.map((row, index) => {
          const changed = fingerprint(row) !== (baselines[rowKey(row, index)] || "");
          return {
            employee_code: row.employee_code,
            name: row.name,
            shift: row.shift === "B" ? "B" : "A",
            check_in: toTimeInput(row.check_in) || null,
            check_out: toTimeInput(row.check_out) || null,
            punch_count: row.punch_count,
            status: row.status,
            edited: changed === true,
          };
        });
        const res = await attendanceService.submit({
          date,
          entry_type: "automatic",
          rows: payloadRows,
        });
        toast.success(res.message || "Daily attendance saved.");
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const title = isView ? "View attendance" : isEdit ? "Edit attendance" : "Add daily attendance";
  const showAutomaticTable = loaded && isAdd && entryType === "automatic";
  const showSingleForm = isEdit || isView || (isAdd && loaded && entryType === "manual");

  const emptyHint = !entryType
    ? { title: "Select type first", sub: "Choose Automatic or Manual, pick a date, then Load." }
    : !date
      ? { title: "Select date", sub: "Pick a date, then Load." }
      : { title: "Click Load", sub: entryType === "automatic"
        ? "Device/log data unchanged → Approved. Agar time/status/shift change kiya → Unapproved (Approve chahiye)."
        : "Select employee, shift, times — then submit for approval." };

  const typeDateFields = (
    <>
      <div className="w-full min-[400px]:w-44 shrink-0">
        <FormLabel htmlFor="att-gate-type">Type</FormLabel>
        <select
          id="att-gate-type"
          value={entryType}
          disabled={!isAdd || loadingPreview || saving}
          onChange={(e) => {
            setEntryType(e.target.value);
            clearLoaded();
            resetManualFields();
          }}
          className={`${FIELD} mt-1`}
        >
          <option value="">Select…</option>
          <option value="automatic">Automatic</option>
          <option value="manual">Manual</option>
        </select>
      </div>
      <div className="w-full min-[400px]:w-40 shrink-0">
        <FormLabel htmlFor="att-gate-date">Date</FormLabel>
        <input
          id="att-gate-date"
          type="date"
          value={date}
          disabled={isView || isEdit || loadingPreview || saving}
          onChange={(e) => {
            setDate(e.target.value);
            if (isAdd) {
              clearLoaded();
              resetManualFields();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && isAdd && !loaded) {
              e.preventDefault();
              handleLoad();
            }
          }}
          className={`${FIELD} mt-1`}
        />
      </div>
    </>
  );

  const footer =
    isAdd && !loaded ? null : (
      <>
        <button
          type="button"
          onClick={onClose}
          className={`${ACTION_BTN} bg-white border border-slate-300 text-slate-800 hover:bg-slate-50`}
        >
          {isView ? "Close" : "Cancel"}
        </button>
        {!isView ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || loadingPreview}
            className={`${ACTION_BTN} bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-700/20`}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {saving ? "Saving..." : isEdit ? "Save" : "Submit"}
          </button>
        ) : null}
      </>
    );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={isView || (isAdd && !loaded) ? undefined : handleSubmit}
      title={title}
      maxWidth={showAutomaticTable ? "max-w-full xl:max-w-7xl" : "max-w-2xl"}
      noPadding
      bodyScrollable={false}
      footer={footer}
    >
      <div className="flex h-full min-h-0 flex-col w-full overflow-hidden bg-white">
        {isAdd && !loaded ? (
          <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-end gap-3">
              {typeDateFields}
                  <button
                type="button"
                onClick={handleLoad}
                disabled={loadingPreview || !entryType || !date}
                className={`${ACTION_BTN} shrink-0 bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-700/20`}
              >
                {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : null}
                Load
              </button>
            </div>
          </div>
        ) : null}

        {loadingPreview ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Loading attendance…</p>
          </div>
        ) : !loaded && isAdd ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center py-10">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{emptyHint.title}</p>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">{emptyHint.sub}</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
            {showAutomaticTable ? (
              <>
                <div className="shrink-0 px-3 py-2.5 sm:px-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-tight text-slate-800">
                    {entryType === "automatic" ? "Automatic" : "Manual"} · {dayjs(date).format("DD MMM YYYY")} · {rows.length} employees
                    {editedCount > 0 ? ` · ${editedCount} edited` : ""}
                  </p>
                  <input
                    type="search"
                    value={rowSearch}
                    onChange={(e) => setRowSearch(e.target.value)}
                    placeholder="Filter employees…"
                    className={`${FIELD} sm:max-w-[16rem]`}
                  />
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full min-w-[36rem] text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Emp</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Name</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Shift</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">In</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Out</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => {
                        const index = rows.indexOf(row);
                        const edited = fingerprint(row) !== (baselines[rowKey(row, index)] || "");
                        return (
                          <tr key={rowKey(row, index)} className={edited ? "bg-amber-50/70" : "bg-white"}>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 font-mono text-xs font-bold text-indigo-700">
                              {row.employee_code}
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 text-xs font-semibold text-slate-900">
                              {row.name || "—"}
                              {edited ? <span className="ml-1 text-[10px] font-black uppercase text-amber-700">Edited</span> : null}
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100">
                              <select
                                value={row.shift === "B" ? "B" : "A"}
                                onChange={(e) => patchRow(index, { shift: e.target.value })}
                                className={`${FIELD} w-[7.5rem]`}
                              >
                                {SHIFTS.map((item) => (
                                  <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100">
                              <input
                                type="time"
                                value={toTimeInput(row.check_in)}
                                onChange={(e) => patchRow(index, { check_in: e.target.value || null })}
                                className={`${FIELD} w-[7.75rem]`}
                              />
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100">
                              <input
                                type="time"
                                value={toTimeInput(row.check_out)}
                                onChange={(e) => patchRow(index, { check_out: e.target.value || null })}
                                className={`${FIELD} w-[7.75rem]`}
                              />
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100">
                              <select
                                value={row.status || "Present"}
                                onChange={(e) => patchRow(index, { status: e.target.value })}
                                className={`${FIELD} w-[7.5rem]`}
                              >
                                {STATUSES.map((status) => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                      {!visibleRows.length ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-10 text-center text-xs text-slate-500">
                            No employees for this date.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {showSingleForm ? (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 sm:p-5">
                {isAdd ? (
                  <p className="mb-3 text-xs font-black uppercase tracking-tight text-slate-800">
                    {entryType === "automatic" ? "Automatic" : "Manual"} · {dayjs(date).format("DD MMM YYYY")}
                  </p>
                ) : null}
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 sm:gap-4">
                  {!isAdd ? typeDateFields : null}
                  <div className="min-[400px]:col-span-2 min-w-0">
                    <FormLabel>Employee</FormLabel>
                    {isAdd ? (
                      <div className="mt-1">
                        <SearchableSelect
                          label=""
                          value={manual.employee_code}
                          onChange={(id, item) => {
                            setManual((prev) => ({
                              ...prev,
                              employee_code: id || "",
                              name: item?.emp_name || item?.name || prev.name,
                            }));
                          }}
                          fetchService={fetchEmployees}
                          dataKey="emp_code"
                          labelKey="emp_name"
                          subLabelKey="emp_code"
                          placeholder="Search employee…"
                          heightClass="h-10 sm:h-9"
                        />
                      </div>
                    ) : (
                      <input
                        value={`${manual.employee_code || ""}${manual.name ? ` — ${manual.name}` : ""}`}
                        disabled
                        className={`${FIELD} mt-1`}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <FormLabel>Shift</FormLabel>
                    <select
                      value={manual.shift === "B" ? "B" : "A"}
                      disabled={isView}
                      onChange={(e) => setManual((prev) => ({ ...prev, shift: e.target.value }))}
                      className={`${FIELD} mt-1`}
                    >
                      {SHIFTS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <FormLabel>Status</FormLabel>
                    <select
                      value={manual.status}
                      disabled={isView}
                      onChange={(e) => setManual((prev) => ({ ...prev, status: e.target.value }))}
                      className={`${FIELD} mt-1`}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <FormLabel>Check in</FormLabel>
                    <input
                      type="time"
                      value={manual.check_in}
                      disabled={isView}
                      onChange={(e) => setManual((prev) => ({ ...prev, check_in: e.target.value }))}
                      className={`${FIELD} mt-1`}
                    />
                  </div>
                  <div className="min-w-0">
                    <FormLabel>Check out</FormLabel>
                    <input
                      type="time"
                      value={manual.check_out}
                      disabled={isView}
                      onChange={(e) => setManual((prev) => ({ ...prev, check_out: e.target.value }))}
                      className={`${FIELD} mt-1`}
                    />
                  </div>
                  {record ? (
                    <p className="min-[400px]:col-span-2 text-xs font-bold uppercase text-slate-600">
                      {record.entry_type_display || "Automatic"} · {record.shift_display || shiftLabel(manual.shift)} ({manual.shift || "—"}) · {record.approval_status_display || "Pending"}
                      {record.updated_by ? ` · ${record.updated_by}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Drawer>
  );
}
