import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { departmentService } from "@/features/admin/services/departmentService";
import { designationService } from "@/features/admin/services/designationService";
import { formatTaskUserOptionLabel } from "@/features/apps/task/helpers/utilHelper";
import { isManagerDesignation, hasFullTaskReportAccess } from "@/features/apps/task/config/appConfig";
import { userService } from "@/features/apps/task/services/userApi";

export function useReportFilters(currentUser) {
  const role = useSelector((state) => state.auth.role);
  
  const [selectedAssignedBy, setSelectedAssignedBy] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_assigned_by") || "";
    }
    return "";
  });
  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_department") || "";
    }
    return "";
  });
  const [selectedDesignation, setSelectedDesignation] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_designation") || "";
    }
    return "";
  });
  const [selectedUser, setSelectedUser] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("report_filter_user") || "";
    }
    return "";
  });

  // Sync with sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("report_filter_assigned_by", selectedAssignedBy || "");
    }
  }, [selectedAssignedBy]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("report_filter_department", selectedDepartment || "");
    }
  }, [selectedDepartment]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("report_filter_designation", selectedDesignation || "");
    }
  }, [selectedDesignation]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("report_filter_user", selectedUser || "");
    }
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

  // Reset selectedUser if it's no longer in filteredUsers or if department changed
  useEffect(() => {
    if (filteredUsers.length > 0 && selectedUser) {
      const exists = filteredUsers.some(u => String(u.id) === String(selectedUser));
      if (!exists) {
        setSelectedUser(prev => prev === "" ? prev : "");
      }
    } else if (filteredUsers.length === 0 && selectedUser) {
      setSelectedUser(prev => prev === "" ? prev : "");
    }
  }, [filteredUsers, selectedUser]);

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
    
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("report_filter_assigned_by");
      sessionStorage.removeItem("report_filter_department");
      sessionStorage.removeItem("report_filter_designation");
      sessionStorage.removeItem("report_filter_user");
    }
    
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

