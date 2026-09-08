"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Check, Shield, Plus } from "lucide-react";
import dayjs from "dayjs";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { FormLabel, OK_INPUT } from "@/ui/common/Constants";
import { attendanceService } from "@/apps/hrms/lib/services/hrms";
import { fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import {
  todayYmd,
  toTimeInput,
  rowIn,
  rowOut,
  rowFingerprint,
  defaultShift,
  defaultTimesFromEmployee,
  isUnapproved,
} from "@/apps/hrms/lib/attendanceUtils";

const MODULE = "hrms_attendance";
const SHIFTS = [
  { value: "A", label: "Day (A)" },
  { value: "B", label: "Night (B)" },
];
const FIELD = `${OK_INPUT} min-h-10 sm:min-h-9 text-slate-900 placeholder:text-slate-500 scheme-light [color-scheme:light]`;
const ACTION_BTN = "h-10 sm:h-9 min-h-10 sm:min-h-9 px-4 shrink-0 rounded-lg text-xs font-black uppercase tracking-wide shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-55";
const BTN_CANCEL = "px-5 py-2.5 text-sm font-bold text-slate-500 disabled:opacity-50";
const BTN_SECONDARY = "px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-50";
const BTN_PRIMARY = "min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50";
const BTN_APPROVE = "min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50";
const EMPTY_MANUAL = { employee_code: "", name: "", shift: "A", in: "", out: "" };
const EMPTY_ROW = { employee_code: "", name: "", shift: "A", in: "", out: "" };

function isFutureDate(value) {
  const d = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d > todayYmd();
}

function toDateTimeInput(value, baseDate = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}T${iso[2]}:${iso[3]}`;
  const hhmm = toTimeInput(raw);
  if (hhmm && baseDate) return `${String(baseDate).slice(0, 10)}T${hhmm}`;
  return "";
}

function nextDateYmd(date) {
  if (!date) return "";
  return dayjs(date).add(1, "day").format("YYYY-MM-DD");
}

function dateRangeForIn(date) {
  const base = String(date || "").slice(0, 10);
  if (!base) return { min: "", max: "" };
  return { min: `${base}T00:00`, max: `${base}T23:59` };
}

function dateRangeForOut(date) {
  const base = String(date || "").slice(0, 10);
  if (!base) return { min: "", max: "" };
  const next = nextDateYmd(base);
  return { min: `${base}T00:00`, max: `${next}T08:00` };
}

function readHHmm(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const m = v.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

function normalizeInDateTime(value, date) {
  const base = String(date || "").slice(0, 10);
  const hhmm = readHHmm(value);
  if (!base || !hhmm) return "";
  return `${base}T${hhmm}`;
}

function normalizeOutDateTime(value, date) {
  const base = String(date || "").slice(0, 10);
  const next = nextDateYmd(String(date || "").slice(0, 10));
  const hhmm = readHHmm(value);
  if (!hhmm) return "";
  const datePart = String(value || "").slice(0, 10);
  const useDate = datePart === base || datePart === next ? datePart : next || base;
  if (!useDate) return "";
  return `${useDate}T${hhmm}`;
}

function rowKey(row, index) {
  return String(row?.employee_code || row?.id || index);
}

export default function AttendanceDrawer({ open, mode = "add", record = null, onClose, onSuccess }) {
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const isAdd = mode === "add";

  const [entryType, setEntryType] = useState("");
  const [date, setDate] = useState(todayYmd);
  const [loaded, setLoaded] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [baselines, setBaselines] = useState({});
  const [rowSearch, setRowSearch] = useState("");
  const [addEmployeeCode, setAddEmployeeCode] = useState("");
  const [existingCodes, setExistingCodes] = useState(() => new Set());
  const [manual, setManual] = useState(EMPTY_MANUAL);

  const resetForm = useCallback((nextRecord) => {
    setEntryType(nextRecord ? (nextRecord.entry_type === "manual" ? "manual" : "automatic") : "");
    setDate(nextRecord?.attendance_date || todayYmd());
    setLoaded(Boolean(nextRecord));
    setRows([]);
    setBaselines({});
    setRowSearch("");
    setAddEmployeeCode("");
    setExistingCodes(new Set());
    setManual(
      nextRecord
        ? {
            employee_code: nextRecord.employee_code || "",
            name: nextRecord.name || "",
            shift: defaultShift(nextRecord),
            in: toDateTimeInput(rowIn(nextRecord), nextRecord?.attendance_date || todayYmd()),
            out: toDateTimeInput(rowOut(nextRecord), nextRecord?.attendance_date || todayYmd()),
          }
        : EMPTY_MANUAL
    );
  }, []);

  useEffect(() => {
    if (open) resetForm(record);
  }, [open, record, resetForm]);

  const clearLoaded = useCallback(() => {
    setLoaded(false);
    setRows([]);
    setBaselines({});
    setRowSearch("");
    setAddEmployeeCode("");
    setExistingCodes(new Set());
  }, []);

  const loadEmployees = useCallback(
    (params = {}) => fetchEmployeeViews({ pageModule: MODULE, pageAction: "view", ...params }),
    []
  );

  const takenEmployeeCodes = useMemo(() => {
    const taken = new Set(existingCodes);
    rows.forEach((row) => {
      const code = String(row.employee_code || "").trim();
      if (code) taken.add(code);
    });
    return taken;
  }, [existingCodes, rows]);

  const fetchEmployees = useCallback(
    async (params = {}, exceptIndex = null) => {
      const taken = new Set(existingCodes);
      rows.forEach((row, i) => {
        if (exceptIndex != null && i === exceptIndex) return;
        const code = String(row.employee_code || "").trim();
        if (code) taken.add(code);
      });
      const res = await loadEmployees(params);
      const data = (res.data ?? []).filter((row) => !taken.has(String(row.emp_code || "").trim()));
      return { data, total: data.length };
    },
    [loadEmployees, existingCodes, rows]
  );

  const fetchEmployeesForRow = useCallback(
    (rowIndex) => (params = {}) => fetchEmployees(params, rowIndex),
    [fetchEmployees]
  );

  const patchRow = useCallback((index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  const patchRowDateTime = useCallback((index, key, value) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const nextValue = key === "in" ? normalizeInDateTime(value, date) : normalizeOutDateTime(value, date);
        return { ...row, [key]: nextValue || null };
      })
    );
  }, [date]);

  const addEmptyRow = useCallback(() => {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }, []);

  const loadAutomatic = useCallback(async (attendanceDate) => {
    setLoadingPreview(true);
    try {
      const res = await attendanceService.preview({ date: attendanceDate, entry_type: "automatic" });
      const list = (res.data ?? []).map((row) => ({ ...row, shift: defaultShift(row) }));
      const nextBaseline = {};
      list.forEach((row, index) => {
        nextBaseline[rowKey(row, index)] = rowFingerprint(row);
      });
      setRows(list);
      setBaselines(nextBaseline);
      setLoaded(true);
    } catch (err) {
      toast.error(err?.message || "Load failed.");
      clearLoaded();
    } finally {
      setLoadingPreview(false);
    }
  }, [clearLoaded]);

  const handleLoad = async () => {
    if (!entryType) return toast.warning("Select type.");
    if (!date) return toast.warning("Date required.");
    if (isFutureDate(date)) return toast.warning("Future date is not allowed.");
    if (entryType === "manual") {
      setLoadingPreview(true);
      try {
        const res = await attendanceService.preview({ date, entry_type: "manual" });
        const taken = new Set(
          (res.data ?? [])
            .filter((row) => row.id != null && String(row.employee_code || "").trim())
            .map((row) => String(row.employee_code).trim())
        );
        setExistingCodes(taken);
        setRows([{ ...EMPTY_ROW }]);
        setBaselines({});
        setLoaded(true);
      } catch (err) {
        toast.error(err?.message || "Load failed.");
        clearLoaded();
      } finally {
        setLoadingPreview(false);
      }
      return;
    }
    await loadAutomatic(date);
  };

  const editedCount = useMemo(
    () => rows.filter((row, index) => rowFingerprint(row) !== (baselines[rowKey(row, index)] || "")).length,
    [rows, baselines]
  );

  const visibleRows = useMemo(() => {
    const q = rowSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.employee_code || ""} ${row.name || ""}`.toLowerCase().includes(q));
  }, [rows, rowSearch]);

  const addEmployeeRow = useCallback((code, item) => {
    const employeeCode = String(code || "").trim();
    if (!employeeCode) return;
    if (existingCodes.has(employeeCode)) return toast.warning("Already exists.");
    setRows((prev) => {
      if (prev.some((row) => String(row.employee_code || "").trim() === employeeCode)) {
        toast.warning("Already in list.");
        return prev;
      }
      return [
        ...prev,
        { employee_code: employeeCode, name: item?.emp_name || item?.name || "", shift: "A", ...defaultTimesFromEmployee(item) },
      ];
    });
    setAddEmployeeCode("");
  }, [existingCodes]);

  const handleSubmit = async (statusOverride = null) => {
    if (isView) return onClose?.();
    if (!date) return toast.warning("Date required.");
    if (isFutureDate(date)) return toast.warning("Future date is not allowed.");

    setSaving(true);
    try {
      if (isEdit || isApprove) {
        if (!manual.shift) {
          toast.warning("Select shift.");
          return;
        }
        if (!String(manual.in || "").trim() || !String(manual.out || "").trim()) {
          toast.warning("In and Out both required.");
          return;
        }
        let approved;
        if (statusOverride !== null) approved = statusOverride;
        else if (isEdit && !isUnapproved(record)) approved = false;

        const res = await attendanceService.update({
          id: record.id,
          attendance_date: date,
          shift: manual.shift,
          employee_code: manual.employee_code,
          name: manual.name,
          in: manual.in || null,
          out: manual.out || null,
          ...(approved !== undefined ? { approved } : {}),
        });
        toast.success(res.message || "Saved.");
      } else if (entryType === "manual") {
        const payloadRows = rows.filter((row) => String(row.employee_code || "").trim());
        if (!payloadRows.length) return toast.warning("Add employee.");
        if (payloadRows.some((row) => !row.shift)) return toast.warning("Select shift.");
        const missingManual = payloadRows.find((row) => !String(rowIn(row) || "").trim() || !String(rowOut(row) || "").trim());
        if (missingManual) return toast.warning(`In and Out both required for ${missingManual.employee_code}.`);

        const res = await attendanceService.submit({
          date,
          entry_type: "manual",
          rows: payloadRows.map((row) => ({
            employee_code: row.employee_code,
            name: row.name,
            shift: defaultShift(row),
            in: rowIn(row) || null,
            out: rowOut(row) || null,
          })),
        });
        toast.success(res.message || "Saved.");
      } else {
        if (!rows.length) return toast.warning("No rows.");
        const missingAuto = rows.find((row) => String(row.employee_code || "").trim() && (!String(rowIn(row) || "").trim() || !String(rowOut(row) || "").trim()));
        if (missingAuto) return toast.warning(`In and Out both required for ${missingAuto.employee_code}.`);
        const res = await attendanceService.submit({
          date,
          entry_type: "automatic",
          rows: rows.map((row, index) => ({
            employee_code: row.employee_code,
            name: row.name,
            shift: defaultShift(row),
            in: rowIn(row) || null,
            out: rowOut(row) || null,
            edited: rowFingerprint(row) !== (baselines[rowKey(row, index)] || ""),
          })),
        });
        toast.success(res.message || "Saved.");
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const showBulkTable = loaded && isAdd && (entryType === "automatic" || entryType === "manual");
  const showSingleForm = isEdit || isView || isApprove;
  const title = isView ? "View attendance" : isApprove ? "Approve attendance" : isEdit ? "Edit attendance" : "Add daily attendance";

  const footer =
    isAdd && !loaded ? null : (
      <div className="flex items-center justify-end gap-3 w-full">
        <button type="button" onClick={onClose} disabled={saving || loadingPreview} className={BTN_CANCEL}>
          {isView ? "Close" : "Cancel"}
        </button>
        {!isView && isApprove ? (
          <>
            <button type="button" onClick={() => handleSubmit(false)} disabled={saving || loadingPreview} className={BTN_SECONDARY}>Keep Pending</button>
            <button type="button" onClick={() => handleSubmit(true)} disabled={saving || loadingPreview} className={BTN_APPROVE}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
            </button>
          </>
        ) : !isView ? (
          <button type="button" onClick={() => handleSubmit()} disabled={saving || loadingPreview} className={BTN_PRIMARY}>
            {saving ? <><Loader2 size={18} className="animate-spin" /> Processing</> : <><Check size={18} /> {isEdit ? "Save" : "Submit"}</>}
          </button>
        ) : null}
      </div>
    );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={isView || (isAdd && !loaded) ? undefined : handleSubmit}
      title={title}
      maxWidth={showBulkTable ? "max-w-full xl:max-w-7xl" : "max-w-2xl"}
      noPadding
      bodyScrollable={false}
      footer={footer}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
        {isAdd && !loaded ? (
          <div className="shrink-0 border-b border-slate-200 px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full min-[400px]:w-44">
                <FormLabel htmlFor="att-gate-type">Type</FormLabel>
                <select id="att-gate-type" value={entryType} disabled={loadingPreview || saving}
                  onChange={(e) => { setEntryType(e.target.value); clearLoaded(); setManual(EMPTY_MANUAL); }}
                  className={`${FIELD} mt-1`}>
                  <option value="">Select…</option>
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div className="w-full min-[400px]:w-40">
                <FormLabel htmlFor="att-gate-date">Date</FormLabel>
                <input id="att-gate-date" type="date" value={date} disabled={loadingPreview || saving}
                  max={todayYmd()}
                  onChange={(e) => { setDate(e.target.value); if (isAdd) clearLoaded(); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && isAdd && !loaded) { e.preventDefault(); handleLoad(); } }}
                  className={`${FIELD} mt-1`} />
              </div>
              <button type="button" onClick={handleLoad} disabled={loadingPreview || !entryType || !date}
                className={`${ACTION_BTN} bg-indigo-600 text-white hover:bg-indigo-700`}>
                {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Load
              </button>
            </div>
          </div>
        ) : null}

        {loadingPreview ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <p className="text-xs font-bold uppercase text-slate-600">Loading…</p>
          </div>
        ) : !loaded && isAdd ? (
          <div className="flex-1 flex items-center justify-center py-10 text-xs font-bold uppercase text-slate-700">
            {!entryType ? "Select type" : !date ? "Select date" : "Click Load"}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {showBulkTable ? (
              <>
                <div className="shrink-0 px-3 py-2.5 sm:px-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-xs font-black uppercase text-slate-800">
                      {entryType === "automatic" ? "Automatic" : "Manual"} · {dayjs(date).format("DD MMM YYYY")} · {rows.length} employees
                      {entryType === "automatic" && editedCount > 0 ? ` · ${editedCount} edited` : ""}
                    </p>
                    {rows.length > 0 ? (
                      <input type="search" value={rowSearch} onChange={(e) => setRowSearch(e.target.value)} placeholder="Filter employees…" className={`${FIELD} sm:max-w-[16rem]`} />
                    ) : null}
                  </div>
                  {entryType === "manual" ? (
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <FormLabel>Add employee</FormLabel>
                        <div className="mt-1">
                          <SearchableSelect
                            key={`add-emp-${takenEmployeeCodes.size}`}
                            label=""
                            value={addEmployeeCode}
                            onChange={(id, item) => addEmployeeRow(id, item)}
                            fetchService={fetchEmployees}
                            dataKey="emp_code"
                            labelKey="emp_name"
                            subLabelKey="emp_code"
                            placeholder="Search employee to add…"
                            heightClass="h-10 sm:h-9"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addEmptyRow}
                        className={`${ACTION_BTN} bg-indigo-600 text-white hover:bg-indigo-700 shrink-0`}
                      >
                        <Plus size={12} /> Add Row
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full min-w-[42rem] text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Emp</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Name</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Shift</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">In Date & Time</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Out Date & Time</th>
                        {entryType === "manual" ? <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200 w-12" aria-label="Remove" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => {
                        const index = rows.indexOf(row);
                        const edited = entryType === "automatic" && rowFingerprint(row) !== (baselines[rowKey(row, index)] || "");
                        const baseDate = String(date || "").slice(0, 10);
                        const inRange = dateRangeForIn(baseDate);
                        const outRange = dateRangeForOut(baseDate);
                        return (
                          <tr key={rowKey(row, index)} className={edited ? "bg-amber-50/70" : ""}>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top min-w-[9rem]">
                              {entryType === "manual" ? (
                                <SearchableSelect
                                  key={`row-emp-${index}-${takenEmployeeCodes.size}`}
                                  label=""
                                  value={row.employee_code}
                                  onChange={(id, item) => {
                                    const code = String(id || "").trim();
                                    if (!code) {
                                      patchRow(index, { employee_code: "", name: "", in: "", out: "" });
                                      return;
                                    }
                                    if (rows.some((r, i) => i !== index && String(r.employee_code || "").trim() === code)) {
                                      toast.warning("Already in list.");
                                      return;
                                    }
                                    if (existingCodes.has(code)) {
                                      toast.warning("Already exists.");
                                      return;
                                    }
                                    patchRow(index, {
                                      employee_code: code,
                                      name: item?.emp_name || item?.name || "",
                                      ...defaultTimesFromEmployee(item),
                                    });
                                  }}
                                  fetchService={fetchEmployeesForRow(index)}
                                  dataKey="emp_code"
                                  labelKey="emp_name"
                                  subLabelKey="emp_code"
                                  placeholder="Select employee…"
                                  heightClass="h-10 sm:h-9"
                                />
                              ) : (
                                <span className="font-mono text-xs font-bold text-indigo-700">{row.employee_code || "—"}</span>
                              )}
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 text-xs font-semibold text-slate-900 align-middle">
                              {row.name || "—"}
                              {edited ? <span className="ml-1 text-[10px] font-black uppercase text-amber-700">Edited</span> : null}
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                              <select
                                value={defaultShift(row)}
                                onChange={(e) => patchRow(index, { shift: e.target.value })}
                                className={`${FIELD} w-[7.5rem]`}
                              >
                                {SHIFTS.map((item) => (
                                  <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                              <input
                                type="datetime-local"
                                value={toDateTimeInput(rowIn(row), date) || normalizeInDateTime(rowIn(row), date)}
                                onChange={(e) => patchRowDateTime(index, "in", e.target.value || null)}
                                min={inRange.min || undefined}
                                max={inRange.max || undefined}
                                className={`${FIELD} w-[13rem]`}
                              />
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                              <input
                                type="datetime-local"
                                value={toDateTimeInput(rowOut(row), nextDateYmd(date)) || normalizeOutDateTime(rowOut(row), date)}
                                onChange={(e) => patchRowDateTime(index, "out", e.target.value || null)}
                                min={outRange.min || undefined}
                                max={outRange.max || undefined}
                                className={`${FIELD} w-[13rem]`}
                              />
                            </td>
                            {entryType === "manual" ? (
                              <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                                <button
                                  type="button"
                                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remove row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                      {!visibleRows.length ? (
                        <tr>
                          <td colSpan={entryType === "manual" ? 6 : 5} className="px-3 py-10 text-center text-xs text-slate-500">
                            {entryType === "manual" ? "Add employee using search or Add Row." : "No rows."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {showSingleForm ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 sm:p-5">
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">Type</p>
                    <p className="mt-0.5 text-sm font-semibold">{record?.entry_type_display || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">Date</p>
                    <p className="mt-0.5 text-sm font-semibold">{record?.attendance_date_display || dayjs(date).format("DD MMM YYYY")}</p>
                  </div>
                  {isView ? (
                    <>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">In Time</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">{record?.in_display || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">Out Time</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">{record?.out_display || "—"}</p>
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                  <div className="min-[400px]:col-span-2">
                    <FormLabel>Employee</FormLabel>
                    <input value={`${manual.employee_code || ""}${manual.name ? ` — ${manual.name}` : ""}`} disabled className={`${FIELD} mt-1`} />
                  </div>
                  <div>
                    <FormLabel>Shift</FormLabel>
                    <select value={manual.shift} disabled={isView} onChange={(e) => setManual((p) => ({ ...p, shift: e.target.value }))} className={`${FIELD} mt-1`}>
                      {SHIFTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                  <div />
                  <div>
                    <FormLabel>In Date & Time</FormLabel>
                    <input
                      type="datetime-local"
                      value={toDateTimeInput(manual.in, date) || normalizeInDateTime(manual.in, date)}
                      disabled={isView}
                      min={date ? dateRangeForIn(date).min : undefined}
                      max={date ? dateRangeForIn(date).max : undefined}
                      onChange={(e) => {
                        const v = e.target.value || "";
                        setManual((p) => ({ ...p, in: normalizeInDateTime(v, date) || "" }));
                      }}
                      className={`${FIELD} mt-1`}
                    />
                  </div>
                  <div>
                    <FormLabel>Out Date & Time</FormLabel>
                    <input
                      type="datetime-local"
                      value={toDateTimeInput(manual.out, nextDateYmd(date)) || normalizeOutDateTime(manual.out, date)}
                      disabled={isView}
                      min={date ? dateRangeForOut(date).min : undefined}
                      max={date ? dateRangeForOut(date).max : undefined}
                      onChange={(e) => {
                        const v = e.target.value || "";
                        setManual((p) => ({ ...p, out: normalizeOutDateTime(v, date) || "" }));
                      }}
                      className={`${FIELD} mt-1`}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Drawer>
  );
}
