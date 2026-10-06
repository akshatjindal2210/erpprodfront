"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "react-toastify";

import { attendanceService } from "@/apps/hrms/lib/services/hrms";
import { isUnapproved } from "@/apps/hrms/lib/attendanceUtils";
import { ATTENDANCE_HEADERS } from "@/apps/hrms/lib/columns/attendanceColumns";
import { useHrmsUserQuickFilter } from "@/apps/hrms/lib/useHrmsUserQuickFilter";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { hrmsSelectionLabel } from "@/apps/hrms/lib/hrmsSelectionLabel";
import ServerListPage from "@/ui/common/list/ServerListPage";
import { ListPageAddButton, ListPageApproveButton, ListPageDeleteButton, ListPageEditButton, ListPageViewButton } from "@/ui/common/list/listPageCrud";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import AttendanceDrawer from "@/apps/hrms/modules/attendance/AttendanceDrawer";

const MODULE = "hrms_attendance";
/** temp "quick" = instant client | later "server" = API + Search (BE already ready) */
const FILTER = "quick";

const SHIFT_OPTIONS = [
  { label: "All Shifts", value: "" },
  { label: "A", value: "A" },
  { label: "B", value: "B" },
];

const APPROVAL_OPTIONS = [
  { label: "All Approval", value: "" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "unapproved" },
];

export default function AttendancePage() {
  const [drawer, setDrawer] = useState({ open: false, mode: "add", record: null });
  const [deleteItem, setDeleteItem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const reloadRef = useRef(null);
  const quick = FILTER === "quick";
  const userFilter = useHrmsUserQuickFilter(MODULE, FILTER);

  const extraFilters = useMemo(
    () => [
      userFilter,
      { label: "Shift", key: "shift", variant: FILTER, options: SHIFT_OPTIONS, preserveOrder: true },
      { label: "Approval", key: "approval_status", variant: FILTER, options: APPROVAL_OPTIONS, preserveOrder: true },
    ],
    [userFilter]
  );

  const openDrawer = useCallback((mode, record = null) => setDrawer({ open: true, mode, record }), []);
  const closeDrawer = useCallback(() => setDrawer({ open: false, mode: "add", record: null }), []);

  const onSelectionChange = useCallback((id, record) => {
    setSelectedId(id ?? null);
    setSelectedRecord(record ?? null);
  }, []);

  const openApproveWithLock = useCallback(
    (row) => {
      const record = row ?? selectedRecord;
      if (!isUnapproved(record)) {
        toast.info("This record is already approved. Edit it before approving again.");
        return;
      }
      openDrawer("approve", record);
    },
    [openDrawer, selectedRecord]
  );

  const { openNewModal, openEditModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: drawer.open || Boolean(deleteItem),
    selectedId,
    getSelectedRow: () => selectedRecord,
    openAdd: () => openDrawer("add"),
    openEdit: (row) => openDrawer("edit", row),
    openApprove: (row) => openApproveWithLock(row),
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
      dateDefaultSpanDays={2}
      getRowId={(row) => row.id ?? `${row.emp_dcode}-${row.attendance_date}`}
      cardConfig={{
        titleKey: "emp_code",
        badgeIndices: [16],
        detailKeys: ["name", "attendance_date_display", "shift_display", "in_display", "out_display", "total_minutes", "worked_minutes", "ot_minutes", "entry_type_display"],
        footerKey: "name",
      }}
      extraFilterKeys={["emp_dcode", "shift", "approval_status"]}
      extraFilters={extraFilters}
      searchPlaceholder="Code, name, shift, approval…"
      clientQuickSearch={quick}
      applyExtrasOnChange={quick}
      showSearchButton={!quick}
      selectionLabel={hrmsSelectionLabel.attendance}
      tableHotkeyProps={tableHotkeyProps}
      onSelectionChange={onSelectionChange}
      getRowClassName={(row) => (isUnapproved(row) ? "[&_td]:!bg-amber-50 [&_td:first-child]:!shadow-[inset_3px_0_0_0_#f59e0b]" : "")}
      toolbarActions={(api) => {
        reloadRef.current = api.reload;
        const { selected, selectedRecord: row } = api;
        return (
          <>
            <ListPageAddButton module={MODULE} onClick={openNewModal} />
            <ListPageEditButton module={MODULE} disabled={!selected} record={row} onClick={openEditModal} />
            <ListPageViewButton module={MODULE} disabled={!selected} record={row} onClick={() => openDrawer("view", row)} />
            <ListPageApproveButton module={MODULE} disabled={!selected || !isUnapproved(row)} record={row} onClick={() => openApproveWithLock(row)} />
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
