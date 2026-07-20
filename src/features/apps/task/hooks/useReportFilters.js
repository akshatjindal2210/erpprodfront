import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { departmentService } from "@/features/admin/services/departmentService";
import { designationService } from "@/features/admin/services/designationService";
import { formatTaskUserOptionLabel } from "@/features/apps/task/helpers/utilHelper";
import { isManagerDesignation, hasFullTaskReportAccess } from "@/features/apps/task/config/appConfig";
import { userService } from "@/features/apps/task/services/userApi";
import { REPORT_FILTER_SS, readSessionString, writeSessionString, clearSessionKeys } from "@/features/apps/task/helpers/taskListFilterSession";

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
        const depts = deptRes.data || [];
        const desigs = desRes.data || [];
        const users = userRes.data?.data || [];
        setDepartmentsLists(depts);
        setDesignationsLists(desigs);
        setAllUsers(users);
      })
      .catch(() => toast.error("Failed to load departments/users"));
  }, []);

  const loggedInUser = useMemo(
    () => allUsers.find((u) => u.id === currentUser?.id),
    [allUsers, currentUser],
  );

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
    const userDeptId = loggedInUser?.department?.id;
    if (!userDeptId) return;
    
    // Use a functional update to avoid unnecessary re-renders if the value is already the same
    setSelectedDepartment(prev => {
      const next = String(userDeptId);
      return prev === next ? prev : next;
    });
  }, [hasFullReportAccess, loggedInUser?.department?.id]);

  // Designation filter — staff only; clear stale session for others
  useEffect(() => {
    if (showDesignationDropdown) return;
    setSelectedDesignation((prev) => (prev ? "" : prev));
  }, [showDesignationDropdown]);

  // Filter users on dept/role change
  const filteredUsers = useMemo(() => {
    if (!allUsers.length) return [];

    let users = allUsers;

    if (hasFullReportAccess) {
      if (selectedDepartment) {
        users = users.filter(
          (u) => Number(u.department?.id) === Number(selectedDepartment),
        );
      }
      if (selectedDesignation) {
        users = users.filter(
          (u) => Number(u.designation?.id) === Number(selectedDesignation),
        );
      }
      return users;
    } else if (isManager) {
      const userDeptId = loggedInUser?.department?.id;
      users = allUsers.filter(
        (u) =>
          Number(u.department?.id) === Number(userDeptId) &&
          Number(u.id) !== Number(currentUser?.id),
      );
      return users;
    } else {
      return [];
    }
  }, [selectedDepartment, selectedDesignation, allUsers, hasFullReportAccess, isManager, loggedInUser?.department?.id, currentUser?.id]);

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
      setSelectedUser(prev => prev === "" ? prev : "");
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

  const assignedByOptions = useMemo(() => {
    if (!(hasFullReportAccess || isManager)) return [];
    return allUsers.map((u) => ({
      id: u.id,
      name: formatTaskUserOptionLabel(u),
    }));
  }, [allUsers, hasFullReportAccess, isManager]);

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

