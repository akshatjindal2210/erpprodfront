/** Super Admin / Admin → any task. Others → only own (self creator / assigned_by). */
export function isTaskStaffFullAccess(roleOrType) {
  const r = String(roleOrType || "").toLowerCase().trim();
  return r === "super_admin" || r === "admin";
}

export function isTaskRowOwner(row, currentUserId) {
  if (!row || currentUserId == null || currentUserId === "") return false;
  const uid = String(currentUserId);
  if (row.task_type === "self") {
    return String(row.created_by_id ?? row.created_by ?? "") === uid;
  }
  return String(row.assigned_by_id ?? row.assigned_by ?? "") === uid;
}

/**
 * Table / card Edit–Delete visibility.
 * `tasks` is not a portal permission module — do not gate on can_edit/can_delete.
 * Staff: any row. Others: own task only (same as backend canManageTask).
 */

export function getTaskRowManageFlags({ row, currentUserId, userRole }) {
  const isStaff = isTaskStaffFullAccess(userRole);
  const isOwner = isTaskRowOwner(row, currentUserId);
  return {
    isStaff,
    isOwner,
    showEdit: isStaff || isOwner,
    showDelete: isStaff || isOwner,
  };
}
