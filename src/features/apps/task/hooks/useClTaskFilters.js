import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { departmentService } from "@/features/admin/services/departmentService";
import { designationService } from "@/features/admin/services/designationService";
import { formatTaskUserOptionLabel } from "@/features/apps/task/helpers/utilHelper";
import { userService } from "@/features/apps/task/services/userApi";

function mapOptions(list) {
  return (list || []).map((item) => ({
    id: item.id,
    name: item.name,
  }));
}

export function useClTaskFilters() {
  const [selectedDepartment, setSelectedDepartmentRaw] = useState("");
  const [selectedDesignation, setSelectedDesignationRaw] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [departmentsLists, setDepartmentsLists] = useState([]);
  const [designationsLists, setDesignationsLists] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    Promise.all([
      departmentService.getViews(),
      designationService.getViews(),
      userService.getViews(),
    ])
      .then(([deptRes, desRes, userRes]) => {
        setDepartmentsLists(mapOptions(deptRes.data));
        setDesignationsLists(mapOptions(desRes.data));
        setAllUsers(userRes.data?.data || []);
      })
      .catch(() => toast.error("Failed to load filter data"));
  }, []);

  const filteredPersons = useMemo(() => {
    let users = allUsers;
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
  }, [allUsers, selectedDepartment, selectedDesignation]);

  const personOptions = useMemo(
    () =>
      filteredPersons.map((u) => ({
        id: u.id,
        name: formatTaskUserOptionLabel(u),
      })),
    [filteredPersons],
  );

  const setSelectedDepartment = useCallback((id) => {
    setSelectedDepartmentRaw(id);
    setSelectedPerson("");
  }, []);

  const setSelectedDesignation = useCallback((id) => {
    setSelectedDesignationRaw(id);
    setSelectedPerson("");
  }, []);

  const clearFilters = useCallback((resetPage) => {
    setSelectedDepartmentRaw("");
    setSelectedDesignationRaw("");
    setSelectedPerson("");
    resetPage?.();
  }, []);

  return {
    selectedDepartment,
    setSelectedDepartment,
    selectedDesignation,
    setSelectedDesignation,
    selectedPerson,
    setSelectedPerson,
    departmentsLists,
    designationsLists,
    personOptions,
    filteredPersons,
    allUsers,
    clearFilters,
  };
}
