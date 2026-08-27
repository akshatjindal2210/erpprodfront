"use client";

import { Users, Building2 } from "lucide-react";
import SearchableSelect from "../../../lib/ui/common/SearchableSelect";
import { ClFormLabel, ClFormHint } from "./clTaskFormUi";
import {
  ASSIGNMENT_TYPE,
  isActiveTaskUser,
  resolveAssigneeUsers,
} from "./clTaskAssignee";

/**
 * Mutually exclusive assignee UI for CL Task wizard Assign step.
 * Add / Clone / Edit all use multi Person(s) when Assign by = Person.
 */
export default function ClAssigneeSection({
  form,
  errors,
  departments = [],
  designations = [],
  users = [],
  isEdit = false,
  isClone = false,
  onAssignmentTypeChange,
  onChange,
}) {
  const mode = form.assignment_type || ASSIGNMENT_TYPE.PERSON;
  const isDeptMode = mode === ASSIGNMENT_TYPE.DEPT_DESIG;

  const activeUsers = users.filter(isActiveTaskUser);

  const personOptions = activeUsers.filter((u) => {
    if (!isDeptMode) return true;
    if (form.department_id && Number(u.department?.id ?? u.department_id) !== Number(form.department_id)) {
      return false;
    }
    const desigIds = form.designation_ids || [];
    if (desigIds.length) {
      const uid = String(u.designation?.id ?? u.designation_id ?? "");
      if (!desigIds.map(String).includes(uid)) return false;
    }
    return true;
  });

  const matchPreview = !isEdit
    ? resolveAssigneeUsers({
        assignmentType: mode,
        departmentId: form.department_id,
        designationIds: form.designation_ids,
        assignedUserIds: form.assigned_user_ids,
        users,
      })
    : null;

  const matchCount = matchPreview?.users?.length ?? 0;

  const ALL_DESIGNATION = { id: "", name: "All" };
  const designationOptions = [
    ALL_DESIGNATION,
    ...designations.filter((d) => d?.id != null && d.id !== ""),
  ];
  const selectedDesignationId =
    (form.designation_ids || [])[0] != null && (form.designation_ids || [])[0] !== ""
      ? String(form.designation_ids[0])
      : form.designation_id
        ? String(form.designation_id)
        : "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <ClFormLabel required>Assign by</ClFormLabel>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-xl border border-slate-200 bg-slate-50/70"
          role="radiogroup"
          aria-label="Assignment mode"
        >
          <ModeButton
            active={isDeptMode}
            icon={Building2}
            label="Department / Designation"
            description="All matching active users"
            onClick={() => onAssignmentTypeChange(ASSIGNMENT_TYPE.DEPT_DESIG)}
          />
          <ModeButton
            active={!isDeptMode}
            icon={Users}
            label="Person"
            description="Pick one or more people"
            onClick={() => onAssignmentTypeChange(ASSIGNMENT_TYPE.PERSON)}
          />
        </div>
      </div>

      {isDeptMode && (
        <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SearchableSelect
              label="Department"
              required
              options={departments}
              value={form.department_id}
              onChange={(id) =>
                onChange({
                  department_id: id || "",
                  designation_id: "",
                  designation_ids: [],
                })
              }
              placeholder="Select department"
              clearable
              error={errors.department_id}
            />
            <div>
              <SearchableSelect
                label="Designation"
                options={designationOptions}
                value={selectedDesignationId}
                onChange={(id) => {
                  const sid = id != null && id !== "" ? String(id) : "";
                  onChange({
                    designation_id: sid,
                    designation_ids: sid ? [sid] : [],
                  });
                }}
                placeholder="All"
                clearable
                error={errors.designation_ids || errors.designation_id}
              />
              <ClFormHint>Optional — defaults to All.</ClFormHint>
            </div>
          </div>
          {form.department_id ? (
            <p className={`text-xs font-medium ml-1 ${matchCount ? "text-indigo-600" : "text-amber-600"}`}>
              {matchCount
                ? `1 CL Task · ${matchCount} assignee${matchCount === 1 ? "" : "s"} get Due tasks.`
                : matchPreview?.error || "No matching active users."}
            </p>
          ) : null}
        </div>
      )}

      {!isDeptMode && (
        <div className="space-y-1.5">
          <SearchableSelect
            label="Person(s)"
            required
            options={personOptions}
            value={form.assigned_user_ids || []}
            onChange={(val) => {
              const ids = Array.isArray(val) ? val.map(String) : [];
              onChange({
                assigned_user_ids: ids,
                person_id: ids[0] || "",
              });
            }}
            placeholder={
              isClone ? "Select new person(s)" : "Search and select person(s)"
            }
            isMulti
            compactMulti
            clearable
            error={errors.person_id || errors.assigned_user_ids}
          />
          {isClone ? (
            <ClFormHint>
              <span className="text-indigo-600 font-medium">
                Clone clears the old assignee — pick new person(s) here.
              </span>
            </ClFormHint>
          ) : (
            <ClFormHint>
              One CL Task is saved. Selected people each get their own Due assignment.
            </ClFormHint>
          )}
          {(form.assigned_user_ids || []).length > 0 ? (
            <p className="text-xs font-medium text-indigo-600 ml-1">
              1 CL Task · {(form.assigned_user_ids || []).length} assignee
              {(form.assigned_user_ids || []).length === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ModeButton({ active, icon: Icon, label, description, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex items-start gap-2.5 text-left rounded-lg px-2.5 py-2.5 transition-all border ${
        active
          ? "bg-white border-indigo-300 shadow-sm ring-1 ring-indigo-100"
          : "bg-transparent border-transparent hover:bg-white/80 hover:border-slate-200"
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"
        }`}
      >
        <Icon size={15} />
      </span>
      <span className="min-w-0">
        <span className={`block text-xs font-semibold ${active ? "text-indigo-700" : "text-slate-700"}`}>
          {label}
        </span>
        <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">{description}</span>
      </span>
    </button>
  );
}
