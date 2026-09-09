"use client";

import { useState, useCallback } from "react";
import { RefreshCw, Users } from "lucide-react";
import { toast } from "react-toastify";

import { employeeService } from "@/apps/hrms/lib/services/hrms";
import { EMPLOYEE_HEADERS } from "@/apps/hrms/lib/columns/employeeColumns";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import ClientListPage from "@/ui/common/list/ClientListPage";
import { LIST_PAGE_OUTLINE_ACTION, LIST_PAGE_PRIMARY_ACTION, ListPageAddButton, ListPageViewButton } from "@/ui/common/list/listPageCrud";
import ActionButton from "@/ui/primitives/ActionButton";
import EmployeeDetailModal from "@/apps/hrms/modules/employee/EmployeeDetailModal";

const MODULE = "hrms_employee";

function rowKey(row) {
  return row.emp_dcode ?? row.emp_code;
}

export default function EmployeePage() {
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [pushing, setPushing] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadData = useCallback(async () => {
    const body = await employeeService.list({ page: 1, limit: 50000, sortBy: "emp_code", order: "ASC" });
    return body?.data ?? [];
  }, []);

  const handleUpdateMachine = useCallback(async (record, reload) => {
    if (!record) return;
    setPushing(true);
    try {
      const res = await employeeService.updateMachine({ employee: record });
      toast.success(res?.message || "Machine updated.");
      await reload?.();
    } catch (err) {
      toast.error(err?.message || "Machine update failed.");
    } finally {
      setPushing(false);
    }
  }, []);

  const handleDeactivateMachine = useCallback(async (record, reload) => {
    if (!record) return;
    setDeactivating(true);
    try {
      const res = await employeeService.deactivateMachine({ employee: record });
      toast.success(res?.message || "Machine user deactivated.");
      await reload?.();
    } catch (err) {
      toast.error(err?.message || "Machine deactivation failed.");
    } finally {
      setDeactivating(false);
    }
  }, []);

  const openView = useCallback((record) => {
    if (!record) return;
    setViewRecord(record);
    setViewOpen(true);
  }, []);

  const handleSyncFromMachine = useCallback(async (reload) => {
    setSyncing(true);
    try {
      await employeeService.sync({ page: 1, limit: 50000, sortBy: "emp_code", order: "ASC" });
      await reload?.();
      toast.success("Machine data synced.");
    } catch (err) {
      toast.error(err?.message || "Machine sync failed.");
    } finally {
      setSyncing(false);
    }
  }, []);

  const onSelectionChange = useCallback((id, record) => {
    setSelectedId(id ?? null);
    setSelectedRecord(record ?? null);
  }, []);

  const getSelectedRow = useCallback(() => selectedRecord, [selectedRecord]);

  // F2 / Edit → View Details (no standard New/Delete on this list)
  const { openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    editAction: "view",
    modalOpen: viewOpen,
    selectedId,
    getSelectedRow,
    openEdit: (row) => openView(row),
    canEditSelection: () => Boolean(selectedRecord),
  });

  return (
    <>
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
        cardConfig={{
          titleKey: "emp_code",
          badgeIndices: [7],
          detailKeys: ["emp_name", "deptname", "brcode", "machine_sync_display", "emp_intime_display", "emp_outtime_display"],
          footerKey: "emp_name",
        }}
        tableHotkeyProps={tableHotkeyProps}
        onSelectionChange={onSelectionChange}
        toolbarActions={({ selected, selectedRecord: row, reload }) => (
          <>
            <ActionButton
              module={MODULE}
              action="view"
              label={syncing ? "Sync..." : "Sync"}
              icon={RefreshCw}
              disabled={syncing || pushing || deactivating}
              onClick={() => handleSyncFromMachine(reload)}
              className={`${LIST_PAGE_PRIMARY_ACTION} rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shadow-none`}
            />
            <ListPageAddButton
              module={MODULE}
              label="Update Machine"
              disabled={!selected || pushing || syncing || deactivating}
              record={row}
              onClick={() => handleUpdateMachine(row, reload)}
              className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shadow-none"
            />
            <ActionButton
              module={MODULE}
              action="add"
              label={deactivating ? "Deactivating..." : "Deactivate Machine"}
              variant="outline"
              disabled={!selected || syncing || pushing || deactivating}
              record={row}
              onClick={() => handleDeactivateMachine(row, reload)}
              className={`${LIST_PAGE_OUTLINE_ACTION} rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4`}
            />
            <ListPageViewButton
              module={MODULE}
              label="View Details"
              disabled={!selected || syncing || pushing || deactivating}
              record={row}
              onClick={openEditModal}
              className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shadow-none"
            />
          </>
        )}
        selectionLabel={(row) => `Selected: ${row.emp_code} | ${row.emp_name}`}
      />
      <EmployeeDetailModal
        open={viewOpen}
        record={viewRecord}
        onClose={() => {
          setViewOpen(false);
          setViewRecord(null);
        }}
      />
    </>
  );
}
