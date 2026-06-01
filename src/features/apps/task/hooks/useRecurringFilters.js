import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import { departmentService } from "@/features/admin/services/departmentService";
import { formatTaskUserOptionLabel } from "@/features/apps/task/helpers/utilHelper";
import { userService } from "@/features/apps/task/services/userApi";

export function useRecurringFilters(currentUser) {
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [departmentsLists, setDepartmentsLists] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  // Tracks if selectedUser was set manually or automatically
  const externalUserSet = useRef(false);
  // Tracks if the filter has run for the first time
  const isFirstFilterRun = useRef(true);

  useEffect(() => {
    Promise.all([
      departmentService.getViews(),
      userService.getViews(),
    ])
      .then(([deptRes, userRes]) => {
        const depts = deptRes.data || [];
        const users = userRes.data?.data || [];
        setDepartmentsLists(depts);
        setAllUsers(users);
      })
      .catch(() => toast.error("Failed to load departments/users"));
  }, []);

  const loggedInUser = useMemo(
    () => allUsers.find((u) => u.id === currentUser?.id),
    [allUsers, currentUser],
  );

  const isAdmin = currentUser?.type === "admin" || currentUser?.type === "super_admin" || currentUser?.type === "executive_assistant";
  const isManager = !isAdmin && String(loggedInUser?.designation?.name || "").toLowerCase() === "manager";
  const isUser = currentUser?.type === "user";

  const showDepartmentDropdown = isAdmin || isUser;
  const showTeamMemberDropdown = isAdmin || isManager || isUser;

  useEffect(() => {
    if (isAdmin) return;
    const userDeptId = loggedInUser?.department?.id;
    if (!userDeptId) return;
    
    // Use a functional update to avoid unnecessary re-renders if the value is already the same
    setSelectedDepartment(prev => {
      const next = String(userDeptId);
      return prev === next ? prev : next;
    });
  }, [isAdmin, loggedInUser?.department?.id]);

  // ── KEY FIX: Filter users but don't reset selectedUser if set externally ──
  useEffect(() => {
    if (!allUsers.length) return;

    if (isAdmin) {
      const filtered = !selectedDepartment
        ? allUsers
        : allUsers.filter(
            (u) => Number(u.department?.id) === Number(selectedDepartment),
          );
      setFilteredUsers(filtered);

      // Only reset when:
      // 1. Department has changed (not the first run)
      // 2. And the user hasn't set it externally
      if (!isFirstFilterRun.current && !externalUserSet.current) {
        setSelectedUser("");
      }
    } else if (isManager || isUser) {
      setFilteredUsers(
        allUsers.filter(
          (u) =>
            Number(u.department?.id) === Number(loggedInUser?.department?.id) &&
            u.id !== loggedInUser?.id,
        ),
      );
      if (!isFirstFilterRun.current && !externalUserSet.current) {
        setSelectedUser("");
      }
    } else {
      setFilteredUsers([]);
      if (!isFirstFilterRun.current && !externalUserSet.current) {
        setSelectedUser("");
      }
    }

    isFirstFilterRun.current = false;
    // Reset external set flag after filter run
    externalUserSet.current = false;

  }, [selectedDepartment, allUsers, isAdmin, isManager, isUser, loggedInUser]);

  const teamMemberOptions = useMemo(
    () =>
      filteredUsers.map((u) => ({
        id: u.id,
        name: formatTaskUserOptionLabel(u),
      })),
    [filteredUsers],
  );

  // ── Wrapped setSelectedUser that sets the external flag ──────────────────────
  const setSelectedUserExternal = (val) => {
    externalUserSet.current = true;
    setSelectedUser(val);
  };

  const clearFilters = (resetPage) => {
    externalUserSet.current = false; // Normal behavior on clear
    setSelectedUser("");
    if (showDepartmentDropdown) setSelectedDepartment("");
    resetPage?.();
  };

  return {
    selectedDepartment,
    setSelectedDepartment,
    selectedUser,
    setSelectedUser: setSelectedUserExternal, // ← return the wrapped version

    departmentsLists,
    filteredUsers,
    teamMemberOptions,

    isAdmin,
    isManager,
    showDepartmentDropdown,
    showTeamMemberDropdown,

    clearFilters,
  };
}
