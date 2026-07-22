/** Parse assignee_person_ids from master row (array or JSON string). */
export function parseAssigneePersonIds(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    } catch {
      /* ignore */
    }
  }
  return [];
}

/**
 * True if a master/Due row is assigned to personScope.
 * Covers person_id, assignee_person_ids, and department(+designation) scope.
 */
export function rowMatchesPersonScope(row, personScope, users = []) {
  const pid = Number(personScope);
  if (!Number.isFinite(pid) || !row) return false;
  if (Number(row.person_id) === pid) return true;

  const ids = parseAssigneePersonIds(row.assignee_person_ids);
  if (ids.some((id) => id === pid)) return true;

  // Dept / designation scope (no explicit person list)
  if (!row.person_id && !ids.length && row.department_id) {
    const user = users.find((u) => Number(u.id) === pid);
    if (!user) return false;
    const userDept = Number(user.department?.id ?? user.department_id);
    const userDesig = Number(user.designation?.id ?? user.designation_id);
    if (userDept !== Number(row.department_id)) return false;
    if (row.designation_id && userDesig !== Number(row.designation_id)) return false;
    return true;
  }

  return false;
}

/** Dept filter for Due/admin: instance dept OR master assignment dept. */
export function rowMatchesDepartmentScope(row, departmentId, users = []) {
  const deptId = Number(departmentId);
  if (!Number.isFinite(deptId) || !row) return false;
  if (Number(row.department_id) === deptId) return true;

  const ids = parseAssigneePersonIds(row.assignee_person_ids);
  if (ids.length && users.length) {
    return ids.some((pid) => {
      const u = users.find((x) => Number(x.id) === Number(pid));
      return u && Number(u.department?.id ?? u.department_id) === deptId;
    });
  }
  return false;
}

/** Designation filter for Due/admin. */
export function rowMatchesDesignationScope(row, designationId, users = []) {
  const desigId = Number(designationId);
  if (!Number.isFinite(desigId) || !row) return false;
  if (Number(row.designation_id) === desigId) return true;

  const ids = parseAssigneePersonIds(row.assignee_person_ids);
  if (ids.length && users.length) {
    return ids.some((pid) => {
      const u = users.find((x) => Number(x.id) === Number(pid));
      return u && Number(u.designation?.id ?? u.designation_id) === desigId;
    });
  }
  return false;
}

/** Equal width for Department / Designation / Users on CL Task list filters only */
export const CL_ORG_FILTER_CLASS =
  "min-w-0 w-full md:min-w-[12rem] md:w-[12rem] md:max-w-[12rem] md:shrink-0 md:grow-0";
