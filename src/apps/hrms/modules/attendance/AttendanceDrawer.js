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
import { todayYmd, toTimeInput, rowIn, rowOut, rowFingerprint, defaultShift, defaultTimesFromEmployee, 
  isUnapproved, formatDefaultTimeLabel, rowTotals, toDateTimeInput, dateTimeFieldValue,
  normalizeInDateTime, normalizeOutDateTime, dateRangeForIn, dateRangeForOut, inOutOrderError,
  withDerivedFields, suggestShiftFromIn, DAY_TYPES, DEFAULT_DAY_TYPE, OUT_NEXT_DAY_CUTOFF } from "@/apps/hrms/lib/attendanceUtils";

const MODULE = "hrms_attendance";
const SHIFTS = [
  { value: "A", label: "Day (A)" },
  { value: "B", label: "Night (B)" },
];
const FIELD = `${OK_INPUT} min-h-10 sm:min-h-9 text-slate-900 placeholder:text-slate-500 scheme-light [color-scheme:light]`;
const FIELD_ERR = "border-red-500 bg-red-50 ring-1 ring-red-300 focus:border-red-600 focus:ring-red-400";
const ROW_ERR = "bg-red-50 [&_td]:border-red-100";
const ACTION_BTN = "h-10 sm:h-9 min-h-10 sm:min-h-9 px-4 shrink-0 rounded-lg text-xs font-black uppercase tracking-wide shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-55";
const BTN_CANCEL = "px-5 py-2.5 text-sm font-bold text-slate-500 disabled:opacity-50";
const BTN_SECONDARY = "px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-50";
const BTN_PRIMARY = "min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50";
const BTN_APPROVE = "min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50";
const EMPTY_MANUAL = { employee_code: "", name: "", shift: "A", in: "", out: "" };
const EMPTY_ROW = { employee_code: "", name: "", shift: "A", in: "", out: "", lunch: "no", day_type: DEFAULT_DAY_TYPE, default_in: "", default_out: "" };
const HOURS_TONE = {
  slate: "text-slate-800",
  muted: "text-slate-700",
  green: "text-emerald-600",
  ot: "text-amber-700",
  neg: "text-red-600",
  lunch: "text-red-600",
};

function outErrorText(code) {
  if (code === "before_in") return "Out must be after In";
  if (code === "after_cutoff") return `Out max next day ${OUT_NEXT_DAY_CUTOFF}`;
  if (code) return "Out required";
  return null;
}

function isFutureDate(value) {
  const d = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d > todayYmd();
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
  /** { [rowIndex]: { in?: true, out?: true } } + manual form uses key "manual" */
  const [fieldErrors, setFieldErrors] = useState({});

  const resetForm = useCallback((nextRecord) => {
    setEntryType(nextRecord ? (nextRecord.entry_type === "manual" ? "manual" : "automatic") : "");
    setDate(nextRecord?.attendance_date || todayYmd());
    setLoaded(Boolean(nextRecord));
    setRows([]);
    setBaselines({});
    setRowSearch("");
    setAddEmployeeCode("");
    setExistingCodes(new Set());
    setFieldErrors({});
    setManual(
      nextRecord
        ? {
            employee_code: nextRecord.employee_code || "",
            name: nextRecord.name || "",
            shift: defaultShift(nextRecord),
            in: toDateTimeInput(rowIn(nextRecord), nextRecord?.attendance_date || todayYmd()),
            out: (() => {
              const d = nextRecord?.attendance_date || todayYmd();
              const inVal = toDateTimeInput(rowIn(nextRecord), d);
              return (
                normalizeOutDateTime(rowOut(nextRecord), d, inVal) ||
                toDateTimeInput(rowOut(nextRecord), d)
              );
            })(),
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
    setFieldErrors({});
  }, []);

  const loadEmployees = useCallback(
    (params = {}) => fetchEmployeeViews({ pageModule: MODULE, pageAction: "view", ...params }),
    []
  );

  /** Codes already on another row in this form (not the whole-date existing set). */
  const codesInForm = useMemo(() => {
    const taken = new Set();
    rows.forEach((row) => {
      const code = String(row.employee_code || "").trim();
      if (code) taken.add(code);
    });
    return taken;
  }, [rows]);

  const fetchEmployees = useCallback(async (params = {}) => {
    const res = await loadEmployees(params);
    const data = Array.isArray(res.data) ? res.data : [];
    return { data, total: res.total ?? data.length };
  }, [loadEmployees]);

  const isEmployeeOptionDisabled = useCallback(
    (item, keepCode = null) => {
      const code = String(item?.emp_code ?? "").trim();
      if (!code) return true;
      if (keepCode && code === String(keepCode).trim()) return false;
      if (existingCodes.has(code)) return true;
      if (codesInForm.has(code)) return true;
      return false;
    },
    [existingCodes, codesInForm]
  );

  const buildManualRow = useCallback(
    (code, item) => {
      const times = defaultTimesFromEmployee(item);
      const inRaw = times.in ? `${date}T${times.in}` : "";
      const outRaw = times.out ? `${date}T${times.out}` : "";
      return withDerivedFields({
        employee_code: code,
        name: item?.emp_name || item?.name || "",
        shift: "A",
        in: normalizeInDateTime(inRaw, date) || null,
        out: normalizeOutDateTime(outRaw, date, inRaw) || null,
        default_in: times.in || "",
        default_out: times.out || "",
      }, { syncShift: true });
    },
    [date]
  );

  const patchRow = useCallback((index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setFieldErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      const cleared = { ...next[index] };
      if (patch.employee_code !== undefined && String(patch.employee_code || "").trim()) delete cleared.blank;
      if (patch.in !== undefined && String(patch.in || "").trim()) delete cleared.in;
      if (patch.out !== undefined && String(patch.out || "").trim()) delete cleared.out;
      if (!cleared.in && !cleared.out && !cleared.blank) delete next[index];
      else next[index] = cleared;
      return next;
    });
  }, []);

  const patchRowDateTime = useCallback((index, key, value) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (key === "in") {
          const nextIn = normalizeInDateTime(value, date) || null;
          const nextOut = row.out ? normalizeOutDateTime(row.out, date, nextIn) || null : null;
          // In change → auto Day/Night from In (≥17:00 → Night)
          return withDerivedFields({ ...row, in: nextIn, out: nextOut }, { syncShift: true });
        }
        const nextOut = normalizeOutDateTime(value, date, row.in) || null;
        // Out change → keep user's shift selection
        return withDerivedFields({ ...row, out: nextOut }, { syncShift: false });
      })
    );
    if (String(value || "").trim()) {
      setFieldErrors((prev) => {
        if (!prev[index]?.[key] && !(key === "in" && prev[index]?.out)) return prev;
        const next = { ...prev, [index]: { ...prev[index] } };
        delete next[index][key];
        if (key === "in") delete next[index].out;
        if (!next[index].in && !next[index].out) delete next[index];
        return next;
      });
    }
  }, [date]);

  const addEmptyRow = useCallback(() => {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }, []);

  const loadAutomatic = useCallback(async (attendanceDate) => {
    setLoadingPreview(true);
    try {
      const res = await attendanceService.preview({ date: attendanceDate, entry_type: "automatic" });
      const list = (res.data ?? []).map((row) => {
        const inVal = toDateTimeInput(rowIn(row), attendanceDate) || normalizeInDateTime(rowIn(row), attendanceDate) || null;
        const outVal =
          normalizeOutDateTime(rowOut(row), attendanceDate, inVal) ||
          toDateTimeInput(rowOut(row), attendanceDate) ||
          null;
        const shiftFromApi = row.shift === "B" || row.shift === "A" ? row.shift : null;
        return withDerivedFields({
          ...row,
          in: inVal,
          out: outVal,
          shift: shiftFromApi || (inVal ? suggestShiftFromIn(inVal) : "A"),
          already_exists: Boolean(row.already_exists || row.id),
          override: false,
          default_in: toTimeInput(row.default_in) || toTimeInput(row.emp_intime_display) || toTimeInput(row.emp_intime) || "",
          default_out: toTimeInput(row.default_out) || toTimeInput(row.emp_outtime_display) || toTimeInput(row.emp_outtime) || "",
        }, { syncShift: false });
      });
      const nextBaseline = {};
      list.forEach((row, index) => {
        nextBaseline[rowKey(row, index)] = rowFingerprint(row);
      });
      setRows(list);
      setBaselines(nextBaseline);
      setFieldErrors({});
      setLoaded(true);
      const existsN = list.filter((r) => r.already_exists).length;
      if (existsN > 0) {
        toast.info(`${existsN} already saved for this date — tick Override to replace, or Remove to skip.`);
      }
    } catch (err) {
      toast.error(err?.message || "Load failed.");
      clearLoaded();
    } finally {
      setLoadingPreview(false);
    }
  }, [clearLoaded]);

  const removeRowAt = useCallback((index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors({});
  }, []);

  const willSubmitRow = useCallback((row) => {
    if (!String(row?.employee_code || "").trim()) return false;
    if (row.already_exists && !row.override) return false;
    return true;
  }, []);

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
        setFieldErrors({});
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
    () =>
      rows.filter((row, index) => {
        if (row.already_exists && !row.override) return false;
        return rowFingerprint(row) !== (baselines[rowKey(row, index)] || "");
      }).length,
    [rows, baselines]
  );

  const existingCount = useMemo(() => rows.filter((row) => row.already_exists).length, [rows]);
  const overrideCount = useMemo(
    () => rows.filter((row) => row.already_exists && row.override).length,
    [rows]
  );

  const visibleRows = useMemo(() => {
    const q = rowSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.employee_code || ""} ${row.name || ""}`.toLowerCase().includes(q));
  }, [rows, rowSearch]);

  const addEmployeeRow = useCallback((code, item) => {
    const employeeCode = String(code || "").trim();
    if (!employeeCode) return;
    if (existingCodes.has(employeeCode)) {
      toast.warning("Already saved for this date.");
      return;
    }
    let filled = false;
    setRows((prev) => {
      if (prev.some((row) => String(row.employee_code || "").trim() === employeeCode)) {
        toast.warning("Already in list.");
        return prev;
      }
      const nextRow = buildManualRow(employeeCode, item);
      const emptyIdx = prev.findIndex((row) => !String(row.employee_code || "").trim());
      filled = true;
      if (emptyIdx >= 0) return prev.map((row, i) => (i === emptyIdx ? nextRow : row));
      return [...prev, nextRow];
    });
    if (filled) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const key of Object.keys(next)) {
          if (next[key]?.blank) {
            delete next[key];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
    setAddEmployeeCode("");
  }, [existingCodes, buildManualRow]);

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
        const manualErr = {};
        if (!String(manual.in || "").trim()) manualErr.in = true;
        if (!String(manual.out || "").trim()) manualErr.out = true;
        else {
          const order = inOutOrderError(manual.in, manual.out, date);
          if (order) manualErr.out = order;
        }
        if (manualErr.in || manualErr.out) {
          setFieldErrors({ manual: manualErr });
          toast.warning(
            manualErr.out === "before_in"
              ? "Out must be after In."
              : manualErr.out === "after_cutoff"
                ? `Out cannot be after next day ${OUT_NEXT_DAY_CUTOFF}.`
                : "In and Out both required."
          );
          return;
        }
        setFieldErrors({});
        let approved;
        if (statusOverride !== null) approved = statusOverride;
        else if (isEdit && !isUnapproved(record)) approved = false;

        const res = await attendanceService.update({
          id: record.id,
          attendance_date: date,
          shift: manual.shift,
          employee_code: manual.employee_code,
          name: manual.name,
          in: normalizeInDateTime(manual.in, date) || manual.in || null,
          out: normalizeOutDateTime(manual.out, date, manual.in) || manual.out || null,
          ...(approved !== undefined ? { approved } : {}),
        });
        toast.success(res.message || "Saved.");
      } else if (entryType === "manual") {
        const blankIndexes = rows
          .map((row, index) => (!String(row.employee_code || "").trim() ? index : -1))
          .filter((index) => index >= 0);
        if (blankIndexes.length) {
          const blankErr = {};
          blankIndexes.forEach((index) => {
            blankErr[index] = { blank: true };
          });
          setFieldErrors(blankErr);
          setRowSearch("");
          toast.warning(
            blankIndexes.length === 1
              ? "Remove the blank row (trash) or select an employee before save."
              : `Remove ${blankIndexes.length} blank rows (trash) or fill them before save.`
          );
          return;
        }

        const payloadRows = rows.filter((row) => String(row.employee_code || "").trim());
        if (!payloadRows.length) return toast.warning("Add employee.");
        if (payloadRows.some((row) => !row.shift)) return toast.warning("Select shift.");

        const errors = {};
        rows.forEach((row, index) => {
          if (!String(row.employee_code || "").trim()) return;
          const err = {};
          if (!String(rowIn(row) || "").trim()) err.in = true;
          if (!String(rowOut(row) || "").trim()) err.out = true;
          else {
            const order = inOutOrderError(rowIn(row), rowOut(row), date);
            if (order) err.out = order;
          }
          if (err.in || err.out) errors[index] = err;
        });
        if (Object.keys(errors).length) {
          setFieldErrors(errors);
          setRowSearch("");
          const firstKey = Object.keys(errors)[0];
          const firstErr = errors[firstKey];
          const first = rows[Number(firstKey)];
          const who = first?.employee_code ? ` for ${first.employee_code}` : "";
          toast.warning(
            firstErr?.out === "before_in"
              ? `Out must be after In${who}.`
              : firstErr?.out === "after_cutoff"
                ? `Out cannot be after next day ${OUT_NEXT_DAY_CUTOFF}${who}.`
                : `In and Out both required${who}.`
          );
          return;
        }
        setFieldErrors({});

        const res = await attendanceService.submit({
          date,
          entry_type: "manual",
          rows: payloadRows.map((row) => ({
            employee_code: row.employee_code,
            name: row.name,
            shift: defaultShift(row),
            in: normalizeInDateTime(rowIn(row), date) || rowIn(row) || null,
            out: normalizeOutDateTime(rowOut(row), date, rowIn(row)) || rowOut(row) || null,
          })),
        });
        toast.success(res.message || `Saved ${payloadRows.length} employee${payloadRows.length > 1 ? "s" : ""}.`);
      } else {
        if (!rows.length) return toast.warning("No rows.");
        const submitRows = rows.filter(willSubmitRow);
        if (!submitRows.length) {
          return toast.warning(
            existingCount > 0
              ? "Nothing to save — tick Override on existing rows, or keep only new employees."
              : "No rows."
          );
        }
        const errors = {};
        rows.forEach((row, index) => {
          if (!willSubmitRow(row)) return;
          const err = {};
          if (!String(rowIn(row) || "").trim()) err.in = true;
          if (!String(rowOut(row) || "").trim()) err.out = true;
          else {
            const order = inOutOrderError(rowIn(row), rowOut(row), date);
            if (order) err.out = order;
          }
          if (err.in || err.out) errors[index] = err;
        });
        if (Object.keys(errors).length) {
          setFieldErrors(errors);
          setRowSearch("");
          const n = Object.keys(errors).length;
          const firstErr = errors[Object.keys(errors)[0]];
          toast.warning(
            firstErr?.out === "before_in"
              ? `Out must be after In — fix ${n} highlighted row${n > 1 ? "s" : ""}.`
              : firstErr?.out === "after_cutoff"
                ? `Out max next day ${OUT_NEXT_DAY_CUTOFF} — fix ${n} highlighted row${n > 1 ? "s" : ""}.`
                : `${n} employee${n > 1 ? "s" : ""} missing In/Out time — fill highlighted rows.`
          );
          return;
        }
        setFieldErrors({});
        const res = await attendanceService.submit({
          date,
          entry_type: "automatic",
          rows: submitRows.map((row) => {
            const index = rows.indexOf(row);
            return {
              employee_code: row.employee_code,
              name: row.name,
              shift: defaultShift(row),
              in: normalizeInDateTime(rowIn(row), date) || rowIn(row) || null,
              out: normalizeOutDateTime(rowOut(row), date, rowIn(row)) || rowOut(row) || null,
              edited: rowFingerprint(row) !== (baselines[rowKey(row, index)] || ""),
              override: Boolean(row.already_exists && row.override),
            };
          }),
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
                      {entryType === "automatic" && existingCount > 0
                        ? ` · ${existingCount} exist${overrideCount ? ` · ${overrideCount} override` : ""}`
                        : ""}
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
                            key={`add-emp-${date}-${existingCodes.size}`}
                            label=""
                            value={addEmployeeCode || null}
                            onChange={(id, item) => addEmployeeRow(id, item)}
                            fetchService={fetchEmployees}
                            dataKey="emp_code"
                            labelKey="emp_name"
                            subLabelKey="emp_code"
                            placeholder="Search employee to add…"
                            heightClass="h-10 sm:h-9"
                            isOptionDisabled={isEmployeeOptionDisabled}
                            resolvedOption={null}
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
                  <table className="w-full min-w-[62rem] text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Emp</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Name</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Shift</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">In Time</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200">Out Time</th>
                        {/* <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200 w-[6.5rem]">Lunch</th> */}
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200 w-[7.5rem]">Day</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200 w-[11rem]">Working Hours</th>
                        <th className="px-2.5 sm:px-3 py-2 border-b border-slate-200 w-12" aria-label="Remove" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => {
                        const index = rows.indexOf(row);
                        const edited = entryType === "automatic" && rowFingerprint(row) !== (baselines[rowKey(row, index)] || "");
                        const err = fieldErrors[index] || {};
                        const rowHasErr = Boolean(err.in || err.out || err.blank);
                        const alreadyExists = Boolean(row.already_exists);
                        const skipKeep = alreadyExists && !row.override;
                        const baseDate = String(date || "").slice(0, 10);
                        const inRange = dateRangeForIn(baseDate);
                        const outRange = dateRangeForOut(baseDate, rowIn(row));
                        const totals = rowTotals(row);
                        return (
                          <tr
                            key={rowKey(row, index)}
                            className={
                              rowHasErr
                                ? ROW_ERR
                                : skipKeep
                                  ? "bg-slate-50/80"
                                  : alreadyExists && row.override
                                    ? "bg-amber-50/70"
                                    : edited
                                      ? "bg-amber-50/70"
                                      : ""
                            }
                          >
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top min-w-[9rem]">
                              {entryType === "manual" ? (
                                <SearchableSelect
                                  key={`row-emp-${index}-${row.employee_code || "empty"}`}
                                  label=""
                                  value={row.employee_code || null}
                                  onChange={(id, item) => {
                                    const code = String(id || "").trim();
                                    if (!code) {
                                      patchRow(index, { employee_code: "", name: "", in: "", out: "" });
                                      return;
                                    }
                                    if (existingCodes.has(code)) {
                                      toast.warning("Already saved for this date.");
                                      return;
                                    }
                                    if (rows.some((r, i) => i !== index && String(r.employee_code || "").trim() === code)) {
                                      toast.warning("Already in list.");
                                      return;
                                    }
                                    patchRow(index, buildManualRow(code, item));
                                  }}
                                  fetchService={fetchEmployees}
                                  dataKey="emp_code"
                                  labelKey="emp_name"
                                  subLabelKey="emp_code"
                                  placeholder="Select employee…"
                                  heightClass="h-10 sm:h-9"
                                  isOptionDisabled={(item) => isEmployeeOptionDisabled(item, row.employee_code)}
                                  resolvedOption={
                                    row.employee_code
                                      ? { emp_code: row.employee_code, emp_name: row.name || row.employee_code }
                                      : null
                                  }
                                />
                              ) : (
                                <span className="font-mono text-xs font-bold text-indigo-700">{row.employee_code || "—"}</span>
                              )}
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 text-xs font-semibold text-slate-900 align-middle">
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="leading-snug">
                                  {row.name || "—"}
                                  {rowHasErr ? (
                                    <span className="ml-1 text-[10px] font-black uppercase text-red-600">
                                      {err.blank ? "Remove or fill" : "Required"}
                                    </span>
                                  ) : edited && (!alreadyExists || row.override) ? (
                                    <span className="ml-1 text-[10px] font-black uppercase text-amber-700">Edited</span>
                                  ) : null}
                                </span>
                                {alreadyExists ? (
                                  <label className="inline-flex items-center gap-1.5 w-fit cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(row.override)}
                                      onChange={(e) => patchRow(index, { override: e.target.checked })}
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className={`text-[10px] font-bold uppercase ${row.override ? "text-amber-800" : "text-slate-500"}`}>
                                      {row.override ? "Replace saved" : "Already saved — replace?"}
                                    </span>
                                  </label>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                              <select
                                value={defaultShift(row)}
                                onChange={(e) => patchRow(index, { shift: e.target.value })}
                                disabled={skipKeep}
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
                                value={dateTimeFieldValue(rowIn(row), date, "in")}
                                onChange={(e) => patchRowDateTime(index, "in", e.target.value || null)}
                                min={inRange.min || undefined}
                                max={inRange.max || undefined}
                                disabled={skipKeep}
                                aria-invalid={err.in ? "true" : undefined}
                                className={`${FIELD} w-[13.5rem] ${err.in ? FIELD_ERR : ""}`}
                              />
                              <p className="mt-0.5 text-[10px] font-semibold text-slate-500 tabular-nums">
                                Default {formatDefaultTimeLabel(row.default_in)}
                              </p>
                              {err.in ? <p className="mt-0.5 text-[10px] font-bold uppercase text-red-600">In required</p> : null}
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                              <input
                                type="datetime-local"
                                value={dateTimeFieldValue(rowOut(row), date, "out", rowIn(row))}
                                onChange={(e) => patchRowDateTime(index, "out", e.target.value || null)}
                                min={outRange.min || undefined}
                                max={outRange.max || undefined}
                                disabled={skipKeep || !String(rowIn(row) || "").trim()}
                                aria-invalid={err.out ? "true" : undefined}
                                className={`${FIELD} w-[13.5rem] ${err.out ? FIELD_ERR : ""}`}
                              />
                              <p className="mt-0.5 text-[10px] font-semibold text-slate-500 tabular-nums">
                                {!String(rowIn(row) || "").trim()
                                  ? "Set In first"
                                  : `Default ${formatDefaultTimeLabel(row.default_out)}`}
                              </p>
                              {outErrorText(err.out) ? (
                                <p className="mt-0.5 text-[10px] font-bold uppercase text-red-600">{outErrorText(err.out)}</p>
                              ) : null}
                            </td>
                            {/* <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                              <select
                                value={String(row.lunch || "no").toLowerCase() === "yes" ? "yes" : "no"}
                                onChange={(e) => patchRow(index, { lunch: e.target.value })}
                                disabled={skipKeep}
                                className={`${FIELD} w-[5.5rem]`}
                              >
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                              </select>
                              <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Default {LUNCH_DEFAULT_LABEL}</p>
                            </td> */}
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                              {/* Future: auto Full/Half from working vs default hours */}
                              <select
                                value={String(row.day_type || DEFAULT_DAY_TYPE).toLowerCase() === "half" ? "half" : "full"}
                                onChange={(e) => patchRow(index, { day_type: e.target.value })}
                                disabled={skipKeep}
                                className={`${FIELD} w-[7rem]`}
                              >
                                {DAY_TYPES.map((item) => (
                                  <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                              </select>
                              <p className="mt-0.5 text-[10px] font-semibold text-slate-500 tabular-nums">
                                Default {totals.defaultLabel}
                              </p>
                            </td>
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                              <div className="space-y-0.5 text-[10px] font-semibold text-slate-500 leading-tight min-w-[10.5rem]">
                                {totals.lines.map((line) => (
                                  <p key={line.key} className="flex justify-between gap-2">
                                    <span>{line.label}</span>
                                    <span className={`tabular-nums font-black ${line.mins == null ? "text-slate-400" : HOURS_TONE[line.tone] || HOURS_TONE.muted}`}>
                                      {line.value}
                                    </span>
                                  </p>
                                ))}
                              </div>
                            </td>
                            
                            <td className="px-2.5 sm:px-3 py-1.5 border-b border-slate-100 align-top">
                              <button
                                type="button"
                                onClick={() => removeRowAt(index)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                aria-label="Remove row"
                                title="Remove from this list"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!visibleRows.length ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-500">
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
                      value={dateTimeFieldValue(manual.in, date, "in")}
                      disabled={isView}
                      min={date ? dateRangeForIn(date).min : undefined}
                      max={date ? dateRangeForIn(date).max : undefined}
                      onChange={(e) => {
                        const v = e.target.value;
                        setManual((p) => {
                          const nextIn = normalizeInDateTime(v, date) || "";
                          const nextOut = p.out
                            ? normalizeOutDateTime(p.out, date, nextIn) || ""
                            : "";
                          return { ...p, in: nextIn, out: nextOut };
                        });
                        if (String(v || "").trim()) {
                          setFieldErrors((prev) => {
                            if (!prev.manual?.in && !prev.manual?.out) return prev;
                            const manualErr = { ...prev.manual };
                            delete manualErr.in;
                            delete manualErr.out;
                            if (!manualErr.in && !manualErr.out) {
                              const next = { ...prev };
                              delete next.manual;
                              return next;
                            }
                            return { ...prev, manual: manualErr };
                          });
                        }
                      }}
                      aria-invalid={fieldErrors.manual?.in ? "true" : undefined}
                      className={`${FIELD} mt-1 w-full ${fieldErrors.manual?.in ? FIELD_ERR : ""}`}
                    />
                    {fieldErrors.manual?.in ? <p className="mt-0.5 text-[10px] font-bold uppercase text-red-600">In required</p> : null}
                  </div>
                  <div>
                    <FormLabel>Out Date & Time</FormLabel>
                    <input
                      type="datetime-local"
                      value={dateTimeFieldValue(manual.out, date, "out", manual.in)}
                      disabled={isView || !String(manual.in || "").trim()}
                      min={date ? dateRangeForOut(date, manual.in).min : undefined}
                      max={date ? dateRangeForOut(date, manual.in).max : undefined}
                      onChange={(e) => {
                        const v = e.target.value;
                        setManual((p) => ({ ...p, out: normalizeOutDateTime(v, date, p.in) || "" }));
                        if (String(v || "").trim()) {
                          setFieldErrors((prev) => {
                            if (!prev.manual?.out) return prev;
                            const manualErr = { ...prev.manual };
                            delete manualErr.out;
                            if (!manualErr.in && !manualErr.out) {
                              const next = { ...prev };
                              delete next.manual;
                              return next;
                            }
                            return { ...prev, manual: manualErr };
                          });
                        }
                      }}
                      aria-invalid={fieldErrors.manual?.out ? "true" : undefined}
                      className={`${FIELD} mt-1 w-full ${fieldErrors.manual?.out ? FIELD_ERR : ""}`}
                    />
                    {!String(manual.in || "").trim() && !isView ? (
                      <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Set In first</p>
                    ) : null}
                    {outErrorText(fieldErrors.manual?.out) ? (
                      <p className="mt-0.5 text-[10px] font-bold uppercase text-red-600">{outErrorText(fieldErrors.manual?.out)}</p>
                    ) : null}
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
