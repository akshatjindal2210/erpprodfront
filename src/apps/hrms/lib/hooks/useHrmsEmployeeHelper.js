"use client";

import { useCallback, useMemo } from "react";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { fetchEmployeeForPage, fetchEmployeesForPage, fetchEmployeeViews, hasEmployeeMasterAccess } from "@/apps/hrms/lib/helpers/employeeHelper";

/**
 * Hook for HRMS modules that need employee master data.
 * @param {string} pageModule — portal module name of the current page (e.g. "hrms_attendance")
 */
export function useHrmsEmployeeHelper(pageModule, pageAction = "view") {
  const canAccess = useCanAccess();

  const hasMasterAccess = useMemo(() => hasEmployeeMasterAccess(canAccess), [canAccess]);

  const loadEmployees = useCallback(
    (params = {}) => fetchEmployeesForPage({canAccess, pageModule, pageAction, ...params}),
    [canAccess, pageModule, pageAction]
  );

  const loadEmployee = useCallback(
    (params = {}) => fetchEmployeeForPage({canAccess, pageModule, pageAction, ...params}),
    [canAccess, pageModule, pageAction]
  );

  const loadEmployeeViews = useCallback(
    (params = {}) => fetchEmployeeViews({canAccess, pageModule, pageAction, ...params}),
    [canAccess, pageModule, pageAction]
  );

  return { canAccess, hasMasterAccess, loadEmployees, loadEmployee, loadEmployeeViews };
}
