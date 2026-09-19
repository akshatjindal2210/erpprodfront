"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";

import { attendanceService } from "@/apps/hrms/lib/services/hrms";
import { fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { isUnapproved } from "@/apps/hrms/lib/attendanceUtils";
import { ATTENDANCE_HEADERS } from "@/apps/hrms/lib/columns/attendanceColumns";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { hrmsSelectionLabel } from "@/apps/hrms/lib/hrmsSelectionLabel";
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
  const dcode = row?.emp_dcode != null ? String(row.emp_dcode) : "";
  return { ...row, value: dcode, rawValue: dcode, label: code && name ? `${code} — ${name}` : code || name };
}

export default function AttendancePage() {
  const [drawer, setDrawer] = useState({ open: false, mode: "add", record: null });
  const [deleteItem, setDeleteItem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
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

  const getEmployeeFilterById = useCallback(async (dcode) => {
    const key = String(dcode ?? "").trim();
    if (!key) return { value: "", rawValue: "", label: "All Users" };
    const cached = employeeCache.current.get(key);
    if (cached) return cached;
    const item = await fetchEmployeeByDcode({ pageModule: MODULE, pageAction: "view", emp_dcode: key });
    const row = item ? toFilterRow(item) : null;
    if (row?.value) employeeCache.current.set(String(row.value), row);
    return row?.value ? row : null;
  }, []);

  const extraFilters = useMemo(
    () => [
      // Client (indigo) — filter rows already loaded for the date range
      {
        label: "User",
        key: "emp_dcode",
        variant: "quick",
        searchable: true,
        fetchService: fetchEmployeeFilterOptions,
        getByIdService: getEmployeeFilterById,
        dataKey: "value",
        labelKey: "label",
        preserveOrder: true,
      },
      { label: "Shift", key: "shift", variant: "quick", options: SHIFT_OPTIONS, preserveOrder: true },
      { label: "Approval", key: "approval_status", variant: "quick", options: APPROVAL_OPTIONS, preserveOrder: true },
    ],
    [fetchEmployeeFilterOptions, getEmployeeFilterById]
  );

  const openDrawer = useCallback((mode, record = null) => setDrawer({ open: true, mode, record }), []);
  const closeDrawer = useCallback(() => setDrawer({ open: false, mode: "add", record: null }), []);

  const onSelectionChange = useCallback((id, record) => {
    setSelectedId(id ?? null);
    setSelectedRecord(record ?? null);
  }, []);

  const getSelectedRow = useCallback(() => selectedRecord, [selectedRecord]);

  const { openNewModal, openEditModal, openApproveModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: drawer.open || Boolean(deleteItem),
    selectedId,
    getSelectedRow,
    openAdd: () => openDrawer("add"),
    openEdit: (row) => openDrawer("edit", row),
    openApprove: (row) => openDrawer("approve", row),
    canApproveSelection: () => Boolean(selectedRecord && isUnapproved(selectedRecord)),
    openDelete: (row) => setDeleteItem(row),
    canDeleteSelection: () => Boolean(selectedRecord),
  });

  return (
    <ServerListPage
      emptyIcon={Clock}
      fetchList={attendanceService.list}
      headers={ATTENDANCE_HEADERS}
      moduleName="Daily Attendance"
      viewModule={MODULE}
      getRowId={(row) => row.id ?? `${row.emp_dcode}-${row.attendance_date}`}
      cardConfig={{
        titleKey: "emp_code",
        badgeIndices: [8],
        detailKeys: ["name", "attendance_date_display", "shift_display", "in_display", "out_display", "punch_count", "entry_type_display"],
        footerKey: "name",
      }}
      extraFilterKeys={["emp_dcode", "shift", "approval_status"]}
      extraFilters={extraFilters}
      searchPlaceholder="Code, name, shift, approval…"
      clientQuickSearch
      applyExtrasOnChange
      selectionLabel={hrmsSelectionLabel.attendance}
      tableHotkeyProps={tableHotkeyProps}
      onSelectionChange={onSelectionChange}
      toolbarActions={(api) => {
        reloadRef.current = api.reload;
        const { selected, selectedRecord: row } = api;
        return (
          <>
            <ListPageAddButton module={MODULE} onClick={openNewModal} />
            <ListPageEditButton module={MODULE} disabled={!selected} record={row} onClick={openEditModal} />
            <ListPageViewButton module={MODULE} disabled={!selected} record={row} onClick={() => openDrawer("view", row)} />
            <ListPageApproveButton module={MODULE} disabled={!selected || !isUnapproved(row)} record={row} onClick={openApproveModal} />
            <ListPageDeleteButton module={MODULE} disabled={!selected} onClick={openDeleteModal} />
          </>
        );
      }}
    >
      <AttendanceDrawer open={drawer.open} mode={drawer.mode} record={drawer.record} onClose={closeDrawer} onSuccess={() => reloadRef.current?.()} />
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => reloadRef.current?.()} service={attendanceService} entityLabel="Attendance" idKey="id" titleKey="emp_code" moduleSlug={MODULE} />
    </ServerListPage>
  );
}
