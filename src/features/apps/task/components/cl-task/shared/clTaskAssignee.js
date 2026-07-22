/**
 * CL Task assignee helpers.
 * One master stores department / designation / person scope.
 * Backend resolves people when spawning Due instances (not at create time as N masters).
 */

export const ASSIGNMENT_TYPE = {
  DEPT_DESIG: "DEPT_DESIG",
  PERSON: "PERSON",
};

/** User is assignable when status is missing or explicitly active. */
export function isActiveTaskUser(user) {
  if (!user) return false;
  const status = String(user.status ?? user.user_status ?? "").toLowerCase();
  if (!status) return true;
  return status === "active";
}

function userDeptId(user) {
  return user?.department?.id ?? user?.department_id ?? null;
}

function userDesigId(user) {
  return user?.designation?.id ?? user?.designation_id ?? null;
}

/**
 * Resolve active users for the current assignment mode.
 * @returns {{ users: object[], error?: string }}
 */
export function resolveAssigneeUsers({
  assignmentType,
  departmentId,
  designationIds = [],
  assignedUserIds = [],
  users = [],
}) {
  const active = users.filter(isActiveTaskUser);

  if (assignmentType === ASSIGNMENT_TYPE.PERSON) {
    const ids = [...new Set((assignedUserIds || []).map(String).filter(Boolean))];
    if (!ids.length) {
      return { users: [], error: "Select at least one person" };
    }
    const matched = active.filter((u) => ids.includes(String(u.id)));
    if (!matched.length) {
      return { users: [], error: "No active users match the selected person(s)" };
    }
    return { users: matched };
  }

  // DEPT_DESIG
  if (!departmentId) {
    return { users: [], error: "Department is required" };
  }
  const desigSet = new Set((designationIds || []).map(String).filter(Boolean));
  const matched = active.filter((u) => {
    if (Number(userDeptId(u)) !== Number(departmentId)) return false;
    if (desigSet.size > 0 && !desigSet.has(String(userDesigId(u)))) return false;
    return true;
  });
  if (!matched.length) {
    return {
      users: [],
      error: desigSet.size
        ? "No active users match this department and designation(s)"
        : "No active users found in this department",
    };
  }
  const seen = new Set();
  const unique = [];
  for (const u of matched) {
    const id = String(u.id);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(u);
  }
  return { users: unique };
}

/**
 * Logical payload shape (for docs / debugging).
 * Create stores one master with department / designation / person scope.
 */
export function buildAssignmentPayloadPreview(form) {
  if (form.assignment_type === ASSIGNMENT_TYPE.PERSON) {
    return {
      assignmentType: ASSIGNMENT_TYPE.PERSON,
      assignedUserIds: (form.assigned_user_ids || []).map(String),
    };
  }
  return {
    assignmentType: ASSIGNMENT_TYPE.DEPT_DESIG,
    departmentId: form.department_id ? String(form.department_id) : null,
    designationIds: (form.designation_ids || []).map(String),
  };
}

/** Per-person fields to append onto existing CL create/update FormData keys. */
export function personAssignmentFields(user, fallbackDepartmentId = "") {
  const deptId = userDeptId(user) ?? fallbackDepartmentId;
  const desigId = userDesigId(user);
  return {
    person_id: String(user.id),
    department_id: deptId != null && deptId !== "" ? String(deptId) : "",
    designation_id: desigId != null && desigId !== "" ? String(desigId) : "",
  };
}
