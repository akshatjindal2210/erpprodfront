"use client";

import { useState, useCallback } from "react";
import { Users } from "lucide-react";

import { employeeService } from "@/apps/hrms/lib/services/hrms";
import { EMPLOYEE_DETAIL_FIELDS, EMPLOYEE_HEADERS } from "@/apps/hrms/lib/columns/employeeColumns";
import ClientListPage from "@/ui/common/list/ClientListPage";
import { ListPageViewButton } from "@/ui/common/list/listPageCrud";

function rowKey(row) {
  return row.emp_dcode ?? row.emp_code;
}

export default function EmployeePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    const body = await employeeService.list({ page: 1, limit: 50000, sortBy: "emp_code", order: "ASC" });
    return body.data ?? [];
  }, []);

  return (
    <ClientListPage
      emptyIcon={Users}
      headers={EMPLOYEE_HEADERS}
      loadData={loadData}
      getRowId={rowKey}
      getSearchParts={(row) => [row.emp_code, row.emp_name, row.deptname, row.deptcode, row.brcode].filter((v) => v != null && String(v).trim())}
      initialSort={{ sortKey: "emp_code", sortDir: "asc" }}
      moduleName="Employee Master"
      noun="Employees"
      searchPlaceholder="Code, name, dept..."
      toolbarActions={({ selected, selectedRecord }) => (
        <ListPageViewButton
          module="hrms_employee"
          label="View Details"
          disabled={!selected}
          record={selectedRecord}
          onClick={() => setIsModalOpen(true)}
        />
      )}
      selectionLabel={(row) => `Selected: ${row.emp_code} | ${row.emp_name}`}
      detailModal={{
        open: isModalOpen,
        onClose: () => setIsModalOpen(false),
        title: "Employee Details",
        icon: Users,
        fields: EMPLOYEE_DETAIL_FIELDS,
      }}
    />
  );
}
