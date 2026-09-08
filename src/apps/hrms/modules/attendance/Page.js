"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";

import { attendanceService } from "@/apps/hrms/lib/services/hrms";
import { fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { isUnapproved } from "@/apps/hrms/lib/attendanceUtils";
import { ATTENDANCE_HEADERS } from "@/apps/hrms/lib/columns/attendanceColumns";
import ServerListPage from "@/ui/common/list/ServerListPage";
import { ListPageAddButton, ListPageApproveButton, ListPageDeleteButton, ListPageEditButton, ListPageViewButton } from "@/ui/common/list/listPageCrud";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import AttendanceDrawer from "@/apps/hrms/modules/attendance/AttendanceDrawer";

const MODULE = "hrms_attendance";

const SHIFT_OPTIONS = [
  { label: "All Shifts", value: "" },
  { label: "Day (A)", value: "A" },
  { label: "Night (B)", value: "B" },
];

const APPROVAL_OPTIONS = [
  { label: "All Approval", value: "" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "unapproved" },
];

function toFilterRow(row) {
  const code = String(row?.emp_code ?? "").trim();
  const name = String(row?.emp_name ?? "").trim();
  return { ...row, value: code, rawValue: code, label: code && name ? `${code} — ${name}` : code || name };
}

export default function AttendancePage() {
  const [drawer, setDrawer] = useState({ open: false, mode: "add", record: null });
  const [deleteItem, setDeleteItem] = useState(null);
  const reloadRef = useRef(null);
  const employeeCache = useRef(new Map());

  const loadEmployees = useCallback(
    (params = {}) => fetchEmployeeViews({ pageModule: MODULE, pageAction: "view", ...params }),
    []
  );

  const fetchEmployeeFilterOptions = useCallback(
    async ({ search = "", page = 1, limit = 50 } = {}) => {
      const res = await loadEmployees({ search, page, limit, sortBy: "emp_code", order: "ASC" });
      const rows = (res.data ?? []).map(toFilterRow);
      rows.forEach((row) => {
        if (row.value) employeeCache.current.set(String(row.value), row);
      });
      const data = page === 1 && !search.trim() ? [{ value: "", rawValue: "", label: "All Users" }, ...rows] : rows;
      return { data, total: res.total ?? rows.length };
    },
    [loadEmployees]
  );

  const getEmployeeFilterById = useCallback(
    async (code) => {
      const key = String(code ?? "").trim();
      if (!key) return { value: "", rawValue: "", label: "All Users" };
      const cached = employeeCache.current.get(key);
      if (cached) return cached;
      const res = await loadEmployees({ search: key, page: 1, limit: 1, sortBy: "emp_code", order: "ASC" });
      const row = toFilterRow(res.data?.[0]);
      if (row.value) employeeCache.current.set(String(row.value), row);
      return row.value ? row : null;
    },
    [loadEmployees]
  );

  const extraFilters = useMemo(
    () => [
      { label: "User", key: "employee_code", searchable: true, fetchService: fetchEmployeeFilterOptions, getByIdService: getEmployeeFilterById, dataKey: "value", labelKey: "label", preserveOrder: true },
      { label: "Shift", key: "shift", options: SHIFT_OPTIONS, preserveOrder: true },
      { label: "Approval", key: "approval_status", options: APPROVAL_OPTIONS, preserveOrder: true },
    ],
    [fetchEmployeeFilterOptions, getEmployeeFilterById]
  );

  const openDrawer = useCallback((mode, record = null) => setDrawer({ open: true, mode, record }), []);
  const closeDrawer = useCallback(() => setDrawer({ open: false, mode: "add", record: null }), []);

  return (
    <ServerListPage
      emptyIcon={Clock}
      fetchList={attendanceService.list}
      headers={ATTENDANCE_HEADERS}
      moduleName="Daily Attendance"
      getRowId={(row) => row.id ?? `${row.employee_code}-${row.attendance_date}`}
      cardConfig={{
        titleKey: "employee_code",
        badgeIndices: [8],
        detailKeys: ["name", "attendance_date_display", "shift_display", "in_display", "out_display", "punch_count", "entry_type_display"],
        footerKey: "name",
      }}
      extraFilterKeys={["employee_code", "shift", "approval_status"]}
      extraFilters={extraFilters}
      searchPlaceholder="Code, name, shift, approval…"
      clientQuickSearch
      applyExtrasOnChange
      selectionLabel={(row) => `Selected: ${row.employee_code} | ${row.name || "—"} | ${row.attendance_date_display || row.attendance_date}`}
      toolbarActions={(api) => {
        reloadRef.current = api.reload;
        const { selected, selectedRecord } = api;
        return (
          <>
            <ListPageAddButton module={MODULE} onClick={() => openDrawer("add")} />
            <ListPageEditButton module={MODULE} disabled={!selected} record={selectedRecord} onClick={() => openDrawer("edit", selectedRecord)} />
            <ListPageViewButton module={MODULE} disabled={!selected} record={selectedRecord} onClick={() => openDrawer("view", selectedRecord)} />
            <ListPageApproveButton module={MODULE} disabled={!selected || !isUnapproved(selectedRecord)} record={selectedRecord} onClick={() => openDrawer("approve", selectedRecord)} />
            <ListPageDeleteButton module={MODULE} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)} />
          </>
        );
      }}
    >
      <AttendanceDrawer open={drawer.open} mode={drawer.mode} record={drawer.record} onClose={closeDrawer} onSuccess={() => reloadRef.current?.()} />
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => reloadRef.current?.()} service={attendanceService} entityLabel="Attendance" idKey="id" titleKey="employee_code" moduleSlug={MODULE} />
    </ServerListPage>
  );
}
