import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { departmentService } from "@/apps/settings/lib/services/departmentService";
import { designationService } from "@/apps/settings/lib/services/designationService";
import { formatTaskUserOptionLabel, extractList } from "@/apps/task/lib/helpers/utilHelper";
import { userService } from "@/apps/task/lib/services/userApi";

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
        setAllUsers(extractList(userRes));
      })
      .catch(() => toast.error("Failed to load filter data"));
  }, []);

  const filteredPersons = useMemo(() => {
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
