"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DoorOpen } from "lucide-react";
import { toast } from "react-toastify";

import { gatePassService } from "@/apps/hrms/lib/services/hrms";
import { fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { GATE_PASS_HEADERS } from "@/apps/hrms/lib/columns/gatePassColumns";
import { isPendingHr, isPendingManager, isFullyApproved, PASS_TYPE_FILTER_OPTIONS } from "@/apps/hrms/lib/gatePassUtils";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { hrmsSelectionLabel } from "@/apps/hrms/lib/hrmsSelectionLabel";
import ServerListPage from "@/ui/common/list/ServerListPage";
import { ListPageAddButton, ListPageApproveButton, ListPageDeleteButton, ListPageEditButton, ListPageViewButton, LIST_PAGE_OUTLINE_ACTION } from "@/ui/common/list/listPageCrud";
import ActionButton from "@/ui/primitives/ActionButton";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import GatePassDrawer from "@/apps/hrms/modules/gate-pass/GatePassDrawer";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";

const MODULE = "hrms_gate_pass";

function gatePassModePermission(mode, canAccess) {
  if (mode === "add") return canAccess(MODULE, "add").allowed;
  if (mode === "edit" || mode === "verify-manager") return canAccess(MODULE, "edit").allowed;
  if (mode === "verify-hr") return canAccess(MODULE, "authorize").allowed;
  if (mode === "view") return canAccess(MODULE, "view").allowed;
  return false;
}

const STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Pending Supervisor", value: "pending_manager" },
  { label: "Pending HR", value: "pending_hr" },
  { label: "Approved", value: "approved" },
];

function toFilterRow(row) {
  const code = String(row?.emp_code ?? "").trim();
  const name = String(row?.emp_name ?? "").trim();
  const dcode = row?.emp_dcode != null ? String(row.emp_dcode) : "";
  return { ...row, value: dcode, rawValue: dcode, label: code && name ? `${code} — ${name}` : code || name };
}

export default function GatePassPage() {
  const canAccess = useCanAccess();
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

  const getEmployeeFilterById = useCallback(
    async (dcode) => {
      const key = String(dcode ?? "").trim();
      if (!key) return { value: "", rawValue: "", label: "All Users" };
      const cached = employeeCache.current.get(key);
      if (cached) return cached;
      const item = await fetchEmployeeByDcode({ pageModule: MODULE, pageAction: "view", emp_dcode: key });
      const row = item ? toFilterRow(item) : null;
      if (row?.value) employeeCache.current.set(String(row.value), row);
      return row?.value ? row : null;
    },
    []
  );

  const extraFilters = useMemo(
    () => [
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
      { label: "Type", key: "pass_type", variant: "quick", options: PASS_TYPE_FILTER_OPTIONS, preserveOrder: true },
      { label: "Status", key: "status", variant: "quick", options: STATUS_OPTIONS, preserveOrder: true },
    ],
    [fetchEmployeeFilterOptions, getEmployeeFilterById]
  );

  const openDrawer = useCallback(
    (mode, record = null) => {
      if (!gatePassModePermission(mode, canAccess)) {
        toast.error("You do not have permission for this action.");
        return;
      }
      setDrawer({ open: true, mode, record });
    },
    [canAccess]
  );
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
    openApprove: (row) => openDrawer("verify-hr", row),
    canApproveSelection: () =>
      Boolean(selectedRecord && isPendingHr(selectedRecord) && canAccess(MODULE, "authorize").allowed),
    openDelete: (row) => {
      if (!canAccess(MODULE, "delete").allowed) {
        toast.error("You do not have permission to delete.");
        return;
      }
      setDeleteItem(row);
    },
    canDeleteSelection: () => Boolean(selectedRecord && canAccess(MODULE, "delete").allowed),
    canEditSelection: () =>
      Boolean(selectedRecord && !isFullyApproved(selectedRecord) && canAccess(MODULE, "edit").allowed),
  });

  return (
    <ServerListPage
      emptyIcon={DoorOpen}
      fetchList={gatePassService.list}
      headers={GATE_PASS_HEADERS}
      moduleName="Gate Pass"
      viewModule={MODULE}
      getRowId={(row) => row.id}
      cardConfig={{
        titleKey: "emp_code",
        badgeIndices: [8],
        detailKeys: ["emp_name", "out_time_display", "in_time_display", "pass_type_display"],
        footerKey: "status_display",
      }}
      extraFilterKeys={["emp_dcode", "pass_type", "status"]}
      extraFilters={extraFilters}
      searchPlaceholder="Code, name, reason…"
      applyExtrasOnChange
      selectionLabel={hrmsSelectionLabel.gatePass}
      tableHotkeyProps={tableHotkeyProps}
      onSelectionChange={onSelectionChange}
      toolbarActions={(api) => {
        reloadRef.current = api.reload;
        const { selected, selectedRecord: row } = api;
        return (
          <>
            <ListPageAddButton module={MODULE} onClick={openNewModal} />
            <ListPageEditButton module={MODULE} disabled={!selected || isFullyApproved(row)} record={row} onClick={openEditModal} />
            <ListPageViewButton module={MODULE} disabled={!selected} record={row} onClick={() => openDrawer("view", row)} />
            <ActionButton
              module={MODULE}
              action="edit"
              variant="outline"
              label="Supervisor Approve"
              disabled={!selected || !isPendingManager(row)}
              record={row}
              onClick={() => openDrawer("verify-manager", row)}
              className={LIST_PAGE_OUTLINE_ACTION}
            />
            <ListPageApproveButton
              module={MODULE}
              label="HR Approve"
              disabled={!selected || !isPendingHr(row)}
              record={row}
              onClick={openApproveModal}
            />
            <ListPageDeleteButton module={MODULE} disabled={!selected} onClick={openDeleteModal} />
          </>
        );
      }}
    >
      <GatePassDrawer
        key={drawer.open ? `${drawer.mode}-${drawer.record?.id ?? "new"}` : "closed"}
        open={drawer.open}
        mode={drawer.mode}
        record={drawer.record}
        onClose={closeDrawer}
        onSuccess={() => reloadRef.current?.()}
      />
      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => reloadRef.current?.()}
        service={gatePassService}
        entityLabel="Gate Pass"
        idKey="id"
        titleKey="emp_code"
        moduleSlug={MODULE}
      />
    </ServerListPage>
  );
}
