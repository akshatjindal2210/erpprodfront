"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "react-toastify";

import { attendanceService } from "@/apps/hrms/lib/services/hrms";
import { ATTENDANCE_HEADERS } from "@/apps/hrms/lib/columns/attendanceColumns";
import { useHrmsEmployeeHelper } from "@/apps/hrms/lib/hooks/useHrmsEmployeeHelper";
import ServerListPage from "@/ui/common/list/ServerListPage";
import { ListPageAddButton, ListPageApproveButton, ListPageDeleteButton, ListPageEditButton, ListPageViewButton } from "@/ui/common/list/listPageCrud";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import AttendanceDrawer from "@/apps/hrms/modules/attendance/AttendanceDrawer";

const MODULE = "hrms_attendance";
const EXTRA_FILTER_KEYS = ["employee_code", "shift", "status", "approval_status"];

const SHIFT_OPTIONS = [
  { label: "All Shifts", value: "" },
  { label: "Day (A)", value: "A" },
  { label: "Night (B)", value: "B" },
];

const STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Present", value: "Present" },
  { label: "Absent", value: "Absent" },
];

const APPROVAL_OPTIONS = [
  { label: "All Approval", value: "" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "unapproved" },
];

function isUnapproved(row) {
  const s = String(row?.approval_status || "").trim().toLowerCase();
  return !s || s === "unapproved" || s === "pending";
}

export default function AttendancePage() {
  const { loadEmployeeViews } = useHrmsEmployeeHelper(MODULE, "view");
  const [employeeOptions, setEmployeeOptions] = useState([{ label: "All Users", value: "" }]);
  const [drawer, setDrawer] = useState({ open: false, mode: "add", record: null });
  const [deleteItem, setDeleteItem] = useState(null);
  const reloadRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadEmployeeViews({ page: 1, limit: 50000, sortBy: "emp_code", order: "ASC" });
        const rows = res.data ?? [];
        if (cancelled) return;
        setEmployeeOptions([
          { label: "All Users", value: "" },
          ...rows.map((row) => ({
            label: `${row.emp_code || ""} — ${row.emp_name || ""}`.trim(),
            value: row.emp_code || "",
          })),
        ]);
      } catch {
        if (!cancelled) setEmployeeOptions([{ label: "All Users", value: "" }]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadEmployeeViews]);

  const extraFilters = useMemo(
    () => [
      {
        label: "User",
        key: "employee_code",
        searchable: true,
        options: employeeOptions,
      },
      {
        label: "Shift",
        key: "shift",
        options: SHIFT_OPTIONS,
        preserveOrder: true,
      },
      {
        label: "Status",
        key: "status",
        options: STATUS_OPTIONS,
        preserveOrder: true,
      },
      {
        label: "Approval",
        key: "approval_status",
        options: APPROVAL_OPTIONS,
        preserveOrder: true,
      },
    ],
    [employeeOptions]
  );

  const openDrawer = useCallback((mode, record = null) => {
    setDrawer({ open: true, mode, record });
  }, []);

  const handleApprove = useCallback(async (row, reload) => {
    if (!row?.id) return;
    try {
      await attendanceService.approve({ id: row.id });
      toast.success("Attendance approved.");
      reload?.();
    } catch (err) {
      toast.error(err?.message || "Failed to approve attendance.");
    }
  }, []);

  return (
    <ServerListPage
      emptyIcon={Clock}
      fetchList={attendanceService.list}
      headers={ATTENDANCE_HEADERS}
      getRowId={(row) => row.id ?? `${row.employee_code}-${row.attendance_date}-${row.shift || "A"}`}
      extraFilterKeys={EXTRA_FILTER_KEYS}
      extraFilters={extraFilters}
      searchPlaceholder="Code, name, status, shift, approval…"
      clientQuickSearch
      applyExtrasOnChange
      selectionLabel={(row) => `Selected: ${row.employee_code} | ${row.name || "—"} | ${row.attendance_date_display || row.attendance_date}`}
      toolbarActions={(api) => {
        reloadRef.current = api.reload;
        const { selected, selectedRecord, reload } = api;
        return (
          <>
            <ListPageAddButton module={MODULE} onClick={() => openDrawer("add")} />
            <ListPageEditButton
              module={MODULE}
              disabled={!selected}
              record={selectedRecord}
              onClick={() => openDrawer("edit", selectedRecord)}
            />
            <ListPageViewButton
              module={MODULE}
              disabled={!selected}
              record={selectedRecord}
              onClick={() => openDrawer("view", selectedRecord)}
            />
            <ListPageApproveButton
              module={MODULE}
              disabled={!selected || !isUnapproved(selectedRecord)}
              record={selectedRecord}
              onClick={() => handleApprove(selectedRecord, reload)}
            />
            <ListPageDeleteButton
              module={MODULE}
              disabled={!selected}
              onClick={() => setDeleteItem(selectedRecord)}
            />
          </>
        );
      }}
    >
      <AttendanceDrawer
        open={drawer.open}
        mode={drawer.mode}
        record={drawer.record}
        onClose={() => setDrawer({ open: false, mode: "add", record: null })}
        onSuccess={() => reloadRef.current?.()}
      />
      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => reloadRef.current?.()}
        service={attendanceService}
        entityLabel="Attendance"
        idKey="id"
        titleKey="employee_code"
        moduleSlug={MODULE}
      />
    </ServerListPage>
  );
}
