import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { departmentService } from "@/apps/settings/lib/services/departmentService";
import { designationService } from "@/apps/settings/lib/services/designationService";
import { formatTaskUserOptionLabel, extractList } from "@/apps/task/lib/helpers/utilHelper";
import { isManagerDesignation, hasFullTaskReportAccess } from "@/apps/task/lib/config/appConfig";
import { userService } from "@/apps/task/lib/services/userApi";
import { REPORT_FILTER_SS, readSessionString, writeSessionString, clearSessionKeys } from "@/apps/task/lib/helpers/taskListFilterSession";

export function useReportFilters(currentUser) {
  const role = useSelector((state) => state.auth.role);
  
  const [selectedAssignedBy, setSelectedAssignedBy] = useState(() =>
    readSessionString(REPORT_FILTER_SS.assignedBy, ""),
  );
  const [selectedDepartment, setSelectedDepartment] = useState(() =>
    readSessionString(REPORT_FILTER_SS.department, ""),
  );
  const [selectedDesignation, setSelectedDesignation] = useState(() =>
    readSessionString(REPORT_FILTER_SS.designation, ""),
  );
  const [selectedUser, setSelectedUser] = useState(() =>
    readSessionString(REPORT_FILTER_SS.user, ""),
  );

  // Sync with sessionStorage
  useEffect(() => {
    writeSessionString(REPORT_FILTER_SS.assignedBy, selectedAssignedBy || "");
  }, [selectedAssignedBy]);

  useEffect(() => {
    writeSessionString(REPORT_FILTER_SS.department, selectedDepartment || "");
  }, [selectedDepartment]);

  useEffect(() => {
    writeSessionString(REPORT_FILTER_SS.designation, selectedDesignation || "");
  }, [selectedDesignation]);

  useEffect(() => {
    writeSessionString(REPORT_FILTER_SS.user, selectedUser || "");
  }, [selectedUser]);

  const [departmentsLists, setDepartmentsLists] = useState([]);
  const [designationsLists, setDesignationsLists] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Master data fetch
  useEffect(() => {
    Promise.all([
      departmentService.getViews(),
      designationService.getViews(),
      userService.getViews(),
    ])
      .then(([deptRes, desRes, userRes]) => {
        setDepartmentsLists(deptRes.data || []);
        setDesignationsLists(desRes.data || []);
        // Same extraction as Tasks page Assigned By options
        setAllUsers(extractList(userRes));
      })
      .catch(() => toast.error("Failed to load departments/users"));
  }, []);

  const loggedInUser = useMemo(
    () => allUsers.find((u) => Number(u.id) === Number(currentUser?.id)),
    [allUsers, currentUser],
  );

  const managerDeptId = useMemo(() => {
    return (
      loggedInUser?.department?.id ??
      loggedInUser?.department_id ??
      currentUser?.department?.id ??
      currentUser?.department_id ??
      null
    );
  }, [loggedInUser, currentUser]);

  const isStaff = role === "super_admin" || role === "admin";
  const hasFullReportAccess = hasFullTaskReportAccess(role);
  const isManager =
    isManagerDesignation(loggedInUser) || isManagerDesignation(currentUser);

  // Admin / EA on report page: all filters; Manager: own dept
  const showDepartmentDropdown = hasFullReportAccess;
  const showDesignationDropdown = hasFullReportAccess;
  const showAssignedByDropdown = hasFullReportAccess || isManager;
  const showTeamMemberDropdown = hasFullReportAccess || isManager;

  // Department fixed for manager only (not EA/admin)
  useEffect(() => {
    if (hasFullReportAccess) return;
    if (!managerDeptId) return;
    setSelectedDepartment((prev) => {
      const next = String(managerDeptId);
      return prev === next ? prev : next;
    });
  }, [hasFullReportAccess, managerDeptId]);

  // Designation filter — staff only; clear stale session for others
  useEffect(() => {
    if (showDesignationDropdown) return;
    setSelectedDesignation((prev) => (prev ? "" : prev));
  }, [showDesignationDropdown]);

  // Filter users on dept/role change (Assigned By + Assigned To share this list)
  const filteredUsers = useMemo(() => {
    if (!allUsers.length) return [];

    if (hasFullReportAccess) {
      let users = allUsers;
      if (selectedDepartment) {
        users = users.filter(
          (u) => Number(u.department?.id ?? u.department_id) === Number(selectedDepartment),
        );
      }
      if (selectedDesignation) {
        users = users.filter(
          (u) => Number(u.designation?.id ?? u.designation_id) === Number(selectedDesignation),
        );
      }
      return users;
    }

    if (isManager) {
      if (!managerDeptId) return [];
      return allUsers.filter(
        (u) => Number(u.department?.id ?? u.department_id) === Number(managerDeptId),
      );
    }

    return [];
  }, [
    selectedDepartment,
    selectedDesignation,
    allUsers,
    hasFullReportAccess,
    isManager,
    managerDeptId,
  ]);

  // Reset selectedUser only after users load — avoid wiping session restore on remount
  useEffect(() => {
    if (!selectedUser) return;
    if (!allUsers.length) return;
    if (filteredUsers.length > 0) {
      const exists = filteredUsers.some((u) => String(u.id) === String(selectedUser));
      if (!exists) setSelectedUser("");
    } else {
      setSelectedUser("");
    }
  }, [filteredUsers, selectedUser, allUsers.length]);

  // Selected Assigned By should not appear in Assigned To list
  useEffect(() => {
    if (!selectedAssignedBy || !selectedUser) return;
    if (String(selectedAssignedBy) === String(selectedUser)) {
      setSelectedUser((prev) => (prev === "" ? prev : ""));
    }
  }, [selectedAssignedBy, selectedUser]);

  const teamMemberOptions = useMemo(() => {
    const byId = selectedAssignedBy ? String(selectedAssignedBy) : "";
    return filteredUsers
      .filter((u) => !byId || String(u.id) !== byId)
      .map((u) => ({
        id: u.id,
        name: formatTaskUserOptionLabel(u),
      }));
  }, [filteredUsers, selectedAssignedBy]);

  // Same as Tasks page Assigned By filter — full user list (assigners can be any dept).
  // Assigned To stays department-scoped via filteredUsers / teamMemberOptions.
  const assignedByOptions = useMemo(
    () =>
      allUsers.map((u) => ({
        id: u.id,
        name: formatTaskUserOptionLabel(u),
      })),
    [allUsers],
  );

  // Drop stale Assigned By only after users load
  useEffect(() => {
    if (!selectedAssignedBy) return;
    if (!allUsers.length) return;
    const exists = assignedByOptions.some((u) => String(u.id) === String(selectedAssignedBy));
    if (!exists) setSelectedAssignedBy("");
  }, [assignedByOptions, selectedAssignedBy, allUsers.length]);

  const departmentOptions = useMemo(() => {
    return departmentsLists.map((d) => ({
      id: d.id,
      name: d.name,
    }));
  }, [departmentsLists]);

  const designationOptions = useMemo(() => {
    return designationsLists.map((d) => ({
      id: d.id,
      name: d.name,
    }));
  }, [designationsLists]);

  const clearFilters = (resetPage) => {
    setSelectedAssignedBy("");
    setSelectedUser("");
    setSelectedDesignation("");
    if (showDepartmentDropdown) setSelectedDepartment("");
    clearSessionKeys([
      REPORT_FILTER_SS.assignedBy,
      REPORT_FILTER_SS.department,
      REPORT_FILTER_SS.designation,
      REPORT_FILTER_SS.user,
    ]);
    resetPage?.();
  };

  return {
    // state
    selectedAssignedBy,
    setSelectedAssignedBy,
    selectedDepartment,
    setSelectedDepartment,
    selectedDesignation,
    setSelectedDesignation,
    selectedUser,
    setSelectedUser,

    // data
    departmentsLists,
    filteredUsers,
    teamMemberOptions,
    assignedByOptions,

    // derived
    isStaff,
    isManager,
    showDepartmentDropdown,
    showDesignationDropdown,
    showAssignedByDropdown,
    showTeamMemberDropdown,
    
    // actions
    clearFilters,
    departmentOptions,
    designationOptions,
  };
}

