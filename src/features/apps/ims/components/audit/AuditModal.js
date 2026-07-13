"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { Check, AlertCircle, Loader2, Shield, User, Calendar, MapPin, Plus, Trash2, MessageSquareQuote } from "lucide-react";
import { toast } from "react-toastify";

import { auditService } from "@/features/apps/ims/services/audit";
import { userService } from "@/features/shared/auth/services/userService";
import { locationService } from "@/features/apps/ims/services/location";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import RemarksTextarea from "@/core/components/common/RemarksTextarea";
import Drawer from "@/core/components/ui/Drawer";
import ModuleSopAcknowledgment from "@/core/components/common/ModuleSopAcknowledgment";
import {
  FORM_LABEL_CLASS,
  FORM_MICRO_LABEL_CLASS,
  FORM_ERROR_CLASS,
} from "@/core/components/common/Constants";
import { focusFirstError } from "@/core/utils/formFocus";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { selectUser } from "@/core/store/slices/authSlice";
import { getActiveLabel } from "./auditStatusHelpers";
import { getOriginalAssignedUserId } from "./auditScanHelpers";

const ADD_FIELD_ORDER = ["start_date", "end_date", "assignments"];

function formatAuditDateDisplay(value) {
  if (!value) return "";
  const [y, m, d] = String(value).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function openNativeDatePicker(inputEl) {
  if (!inputEl) return;
  if (typeof inputEl.showPicker === "function") {
    inputEl.showPicker();
  } else {
    inputEl.focus();
  }
}

function AuditDateInput({ label, value, onChange, error, placeholder, dataField, min }) {
  const display = formatAuditDateDisplay(value);
  const boxClass = error
    ? "border-rose-300 bg-rose-50/40"
    : "border-slate-200 bg-white hover:border-slate-300";

  return (
    <div className="space-y-1.5 min-w-0" data-field={dataField}>
      <label className={FORM_LABEL_CLASS}>
        {label} <span className="text-rose-500">*</span>
      </label>
      <div
        className={`relative flex h-[38px] items-center gap-2 rounded-lg border px-2.5 cursor-pointer ${boxClass}`}
        onClick={(e) => openNativeDatePicker(e.currentTarget.querySelector('input[type="date"]'))}
      >
        <Calendar size={14} className="text-slate-400 shrink-0 pointer-events-none" />
        <span
          className={`pointer-events-none flex-1 truncate text-xs ${
            display ? "font-medium text-slate-800" : "text-slate-400"
          }`}
        >
          {display || placeholder}
        </span>
        <input
          type="date"
          value={value || ""}
          min={min || undefined}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      {error && (
        <p className={FORM_ERROR_CLASS}>
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function makeAssignmentRow() {
  return {
    row_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    assigned_user_id: "",
    location_ids: [],
  };
}

const INITIAL_FORM = {
  start_date: "",
  end_date: "",
  remarks: "",
  approved: false,
  assignments: [makeAssignmentRow()],
};

function getTakenIdsExcludingRow(assignments, currentRowId, field) {
  const taken = new Set();
  for (const row of assignments || []) {
    if (row.row_id === currentRowId) continue;
    const val = row[field];
    if (field === "location_ids") {
      for (const id of val || []) taken.add(String(id));
    } else if (val != null && val !== "") {
      taken.add(String(val));
    }
  }
  return taken;
}

function wrapExcludeFetcher(baseFetch, excludeIds, idKey, { excludeNames = [] } = {}) {
  const exclude = excludeIds instanceof Set ? excludeIds : new Set((excludeIds || []).map(String));
  const names = new Set(
    (excludeNames || []).map((n) => String(n || "").trim().toLowerCase()).filter(Boolean)
  );
  return async (params) => {
    const res = await baseFetch(params);
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    const filtered = list.filter((item) => {
      if (exclude.has(String(item?.[idKey]))) return false;
      if (names.size && names.has(String(item?.name || "").trim().toLowerCase())) return false;
      return true;
    });
    if (Array.isArray(res?.data)) return { ...res, data: filtered };
    if (Array.isArray(res)) return filtered;
    return res;
  };
}

function groupLocationsByUser(locations = []) {
  const byUser = new Map();
  const seenLocations = new Set();
  for (const loc of locations) {
    if (loc.is_active === false) continue;
    const locId = loc?.location_id;
    if (locId == null) continue;
    const locKey = String(locId);
    if (seenLocations.has(locKey)) continue;
    seenLocations.add(locKey);

    const userId = getOriginalAssignedUserId(loc) ?? "";
    const key = String(userId);
    if (!byUser.has(key)) {
      byUser.set(key, {
        row_id: makeAssignmentRow().row_id,
        assigned_user_id: userId,
        location_ids: [],
      });
    }
    byUser.get(key).location_ids.push(locId);
  }
  return [...byUser.values()];
}

export default function AuditModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess("audit", "authorize").allowed;
  const currentUser = useSelector(selectUser);

  const isEdit = mode === "edit";
  const isAdd = mode === "add";

  /** Audit creator cannot be assigned — they manage/activate the audit. */
  const excludeCreatorName = useMemo(() => {
    if (isEdit) return String(editData?.created_by_name || editData?.created_by || "").trim();
    return String(currentUser?.name || "").trim();
  }, [isEdit, editData?.created_by_name, editData?.created_by, currentUser?.name]);

  const excludeCreatorUserId = useMemo(() => {
    if (!isEdit && currentUser?.id != null) return Number(currentUser.id);
    if (
      isEdit &&
      excludeCreatorName &&
      currentUser?.id != null &&
      String(currentUser?.name || "").trim().toLowerCase() === excludeCreatorName.toLowerCase()
    ) {
      return Number(currentUser.id);
    }
    return null;
  }, [isEdit, excludeCreatorName, currentUser?.id, currentUser?.name]);
  
  const showApproval = canApprove && (isAdd || isEdit);
  const sopPermissionType = isAdd ? "authorize" : isEdit ? "edit" : "add";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        const grouped = groupLocationsByUser(editData.locations);
        setForm({
          start_date: editData.start_date ? editData.start_date.split("T")[0] : "",
          end_date: editData.end_date ? editData.end_date.split("T")[0] : "",
          remarks: editData.remarks || "",
          approved: Boolean(editData.approved),
          assignments: grouped.length ? grouped : [makeAssignmentRow()],
        });
      } else {
        setForm({ ...INITIAL_FORM, assignments: [makeAssignmentRow()] });
      }
      setErrors({});
    } else {
      timeoutId = setTimeout(() => {
        setForm({ ...INITIAL_FORM, assignments: [makeAssignmentRow()] });
        setErrors({});
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [open, editData?.audit_id]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleAssignmentChange = (rowId, patch) => {
    setForm((prev) => {
      let assignments = prev.assignments.map((row) =>
        row.row_id === rowId ? { ...row, ...patch } : row
      );

      if (patch.location_ids) {
        const claimed = new Set(
          (assignments.find((r) => r.row_id === rowId)?.location_ids || []).map(String)
        );
        assignments = assignments.map((row) => {
          if (row.row_id === rowId) return row;
          const nextIds = (row.location_ids || []).filter((id) => !claimed.has(String(id)));
          return nextIds.length === (row.location_ids || []).length
            ? row
            : { ...row, location_ids: nextIds };
        });
      }

      return { ...prev, assignments };
    });
    if (errors.assignments) setErrors((prev) => ({ ...prev, assignments: "" }));
  };

  const fetchAuditUsers = useCallback(
    (params) =>
      userService.getViews({
        ...params,
        permission_module: "audit",
        permission_action: "view",
      }),
    []
  );

  const fetchAuditLocations = useCallback(
    (params) =>
      locationService.getViews({
        ...params,
        permission_module: "audit",
        permission_action: "view",
      }),
    []
  );

  const addAssignmentRow = () => {
    setForm((prev) => ({
      ...prev,
      assignments: [...prev.assignments, makeAssignmentRow()],
    }));
  };

  const removeAssignmentRow = (rowId) => {
    setForm((prev) => {
      if (prev.assignments.length <= 1) return prev;
      return {
        ...prev,
        assignments: prev.assignments.filter((row) => row.row_id !== rowId),
      };
    });
  };

  const validate = () => {
    const e = {};
    if (!form.start_date) e.start_date = "Start date is required";
    if (!form.end_date) e.end_date = "End date is required";
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) {
      e.end_date = "End date cannot be before start date";
    }

    const rows = form.assignments || [];
    if (!rows.length) {
      e.assignments = "Add at least one user row";
      return e;
    }

    const seenUsers = new Set();
    const seenLocations = new Set();
    let rowError = "";

    rows.forEach((row, index) => {
      if (!row.assigned_user_id) {
        rowError = `Row ${index + 1}: select a user`;
        return;
      }
      const userKey = String(row.assigned_user_id);
      if (seenUsers.has(userKey)) {
        rowError = `Row ${index + 1}: duplicate user`;
        return;
      }
      seenUsers.add(userKey);

      if (!row.location_ids?.length) {
        rowError = `Row ${index + 1}: select at least one location`;
        return;
      }

      for (const locId of row.location_ids) {
        const locKey = String(locId);
        if (seenLocations.has(locKey)) {
          rowError = `Location already assigned in another row`;
          return;
        }
        seenLocations.add(locKey);
      }
    });

    if (rowError) e.assignments = rowError;
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error("Please fix the highlighted fields before saving.");
      focusFirstError(e, ADD_FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setLoading(true);

    try {
      const payload = {
        start_date: form.start_date,
        end_date: form.end_date,
        remarks: form.remarks,
        assignments: form.assignments.map(({ assigned_user_id, location_ids }) => ({
          assigned_user_id,
          location_ids,
        })),
      };

      if (showApproval) {
        payload.approved = form.approved;
      }

      const request = isEdit
        ? auditService.update(editData.audit_id, payload)
        : auditService.create(payload);

      const response = await request;
      toast.success(response?.message || "Successfully saved");

      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full">
      <button
        onClick={onClose}
        disabled={loading}
        className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white"
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full sm:w-auto min-w-[160px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-indigo-400 active:scale-95"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Saving...
          </>
        ) : (
          <>
            <Check size={18} /> Save
          </>
        )}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSave}
      title={isEdit ? "Edit Audit" : "New Audit"}
      description="Schedule inventory location audit"
      footer={footer}
      maxWidth="max-w-4xl"
    >
      <div ref={formRef} className="space-y-6 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AuditDateInput
            label="Start Date"
            value={form.start_date}
            onChange={(v) => handleChange("start_date", v)}
            error={errors.start_date}
            placeholder="dd/mm/yyyy"
            dataField="start_date"
          />
          <AuditDateInput
            label="End Date"
            value={form.end_date}
            onChange={(v) => handleChange("end_date", v)}
            error={errors.end_date}
            placeholder="dd/mm/yyyy"
            dataField="end_date"
            min={form.start_date || undefined}
          />
        </div>

        <div className="space-y-3" data-field="assignments">
          <label className={`${FORM_LABEL_CLASS} !ml-0`}>
            User assignments <span className="text-rose-500">*</span>
          </label>

          {errors.assignments && (
            <p className={FORM_ERROR_CLASS}>
              <AlertCircle size={12} className="shrink-0" />
              {errors.assignments}
            </p>
          )}

          <div className="space-y-3">
            {form.assignments.map((row, index) => {
              const takenUserIds = getTakenIdsExcludingRow(form.assignments, row.row_id, "assigned_user_id");
              if (excludeCreatorUserId != null) takenUserIds.add(String(excludeCreatorUserId));
              const takenLocationIds = getTakenIdsExcludingRow(form.assignments, row.row_id, "location_ids");

              return (
              <div
                key={row.row_id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={FORM_MICRO_LABEL_CLASS}>
                    Row {index + 1}
                  </span>
                  {form.assignments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAssignmentRow(row.row_id)}
                      className="p-1 text-rose-400 hover:bg-rose-50 rounded-md transition-colors"
                      aria-label={`Remove row ${index + 1}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SearchableSelect
                    label="Assigned User"
                    value={row.assigned_user_id}
                    onChange={(id) => handleAssignmentChange(row.row_id, { assigned_user_id: id ?? "" })}
                    fetchService={wrapExcludeFetcher(fetchAuditUsers, takenUserIds, "id", {
                      excludeNames: excludeCreatorName ? [excludeCreatorName] : [],
                    })}
                    getByIdService={(id) => userService.getById(id)}
                    dataKey="id"
                    labelKey="name"
                    subLabelKey="usercode"
                    icon={User}
                    placeholder="Select user…"
                  />

                  <SearchableSelect
                    label="Locations"
                    multiple
                    compactMulti
                    value={row.location_ids}
                    onChange={(ids) => handleAssignmentChange(row.row_id, { location_ids: ids ?? [] })}
                    fetchService={wrapExcludeFetcher(fetchAuditLocations, takenLocationIds, "location_id")}
                    getByIdService={(id) => locationService.getById(id)}
                    dataKey="location_id"
                    labelKey="location_no"
                    icon={MapPin}
                    placeholder="Select locations…"
                  />
                </div>
              </div>
            );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={addAssignmentRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <Plus size={13} /> Add row
            </button>
          </div>
        </div>

        <RemarksTextarea
          label="Remarks"
          labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
          labelClassName={FORM_LABEL_CLASS}
          className="[&_textarea]:!min-h-[4.5rem] [&_textarea]:!py-2"
          value={form.remarks}
          onChange={(e) => handleChange("remarks", e.target.value)}
          placeholder="Audit instructions or notes…"
          rows={4}
        />

        <div className="h-px bg-slate-100" />

        {showApproval ? (
          <div
            className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
              form.approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${form.approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`${FORM_MICRO_LABEL_CLASS} mt-1 leading-none ${form.approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {form.approved ? "Active" : "Inactive"}
                </p>  
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.approved}
                onChange={(e) => handleChange("approved", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : isEdit ? (
          <div className={`p-3 rounded-xl border flex items-center justify-between ${editData?.approved ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${editData?.approved ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className="text-xs font-bold leading-none text-slate-700">Approval Status</p>
                <p className={`${FORM_MICRO_LABEL_CLASS} mt-1 leading-none text-slate-400`}>
                  {getActiveLabel(Boolean(editData?.approved))}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500 italic leading-relaxed">
              This audit will remain inactive until activated by an authorized user.
            </p>
          </div>
        )}

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${sopPermissionType}`}
          moduleSlug="audit"
          permissionType={sopPermissionType}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}
