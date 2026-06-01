import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { departmentService } from "@/features/admin/services/departmentService";
import { formatTaskUserOptionLabel } from "@/features/apps/task/helpers/utilHelper";
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
      sessionStorage.setItem("report_filter_user", selectedUser || "");
    }
  }, [selectedUser]);

  const [departmentsLists, setDepartmentsLists] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Master data fetch
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

  const isAdmin = role === "super_admin" || role === "admin" || role === "executive_assistant";
  const isManager = String(loggedInUser?.designation?.name || "").toLowerCase() === "manager";
  const isUser = role === "user";

  // Admin/super_admin/ea: see everything
  // Manager: see Assigned By + Team Member (Department fixed)
  // User: see Team Member (Department fixed)
  const showDepartmentDropdown = isAdmin;
  const showAssignedByDropdown = isAdmin || isManager;
  const showTeamMemberDropdown = isAdmin || isManager || isUser;

  // Department remains fixed for Manager/User (default selected)
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

  // Filter users on dept/role change
  const filteredUsers = useMemo(() => {
    if (!allUsers.length) return [];

    if (isAdmin) {
      return !selectedDepartment
        ? allUsers
        : allUsers.filter(
            (u) => Number(u.department?.id) === Number(selectedDepartment),
          );
    } else if (isManager || isUser) {
      const userDeptId = loggedInUser?.department?.id;
      return allUsers.filter(
        (u) =>
          Number(u.department?.id) === Number(userDeptId) &&
          Number(u.id) !== Number(currentUser?.id),
      );
    } else {
      return [];
    }
  }, [selectedDepartment, allUsers, isAdmin, isManager, isUser, loggedInUser?.department?.id, currentUser?.id]);

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
    if (!(isAdmin || isManager)) return [];
    return allUsers.map((u) => ({
      id: u.id,
      name: formatTaskUserOptionLabel(u),
    }));
  }, [allUsers, isAdmin, isManager]);

  const departmentOptions = useMemo(() => {
    return departmentsLists.map((d) => ({
      id: d.id,
      name: d.name,
    }));
  }, [departmentsLists]);

  const clearFilters = (resetPage) => {
    setSelectedAssignedBy("");
    setSelectedUser("");
    if (showDepartmentDropdown) setSelectedDepartment("");
    
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("report_filter_assigned_by");
      sessionStorage.removeItem("report_filter_department");
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
    selectedUser,
    setSelectedUser,

    // data
    departmentsLists,
    filteredUsers,
    teamMemberOptions,
    assignedByOptions,

    // derived
    isAdmin,
    isManager,
    showDepartmentDropdown,
    showAssignedByDropdown,
    showTeamMemberDropdown,
    
    // actions
    clearFilters,
    departmentOptions,
  };
}

