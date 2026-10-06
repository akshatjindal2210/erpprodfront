"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DoorOpen, Download } from "lucide-react";
import { toast } from "react-toastify";

import { gatePassService } from "@/apps/hrms/lib/services/hrms";
import { fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { GATE_PASS_HEADERS } from "@/apps/hrms/lib/columns/gatePassColumns";
import { isPendingApprove, isPendingManager, isFullyApproved, PASS_TYPE_FILTER_OPTIONS, canApproveAsManager, downloadGatePassQr, resolveGatePassPkId } from "@/apps/hrms/lib/gatePassUtils";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { hrmsSelectionLabel } from "@/apps/hrms/lib/hrmsSelectionLabel";
import ServerListPage from "@/ui/common/list/ServerListPage";
import { ListPageAddButton, ListPageApproveButton, ListPageDeleteButton, ListPageEditButton, ListPageViewButton, LIST_PAGE_OUTLINE_ACTION } from "@/ui/common/list/listPageCrud";
import ActionButton from "@/ui/primitives/ActionButton";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import GatePassDrawer from "@/apps/hrms/modules/gate-pass/GatePassDrawer";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useSelector } from "react-redux";

const MODULE = "hrms_gate_pass";

function gatePassModePermission(mode, canAccess, canSup) {
  if (mode === "add") return canAccess(MODULE, "add").allowed;
  if (mode === "edit") return canAccess(MODULE, "edit").allowed;
  if (mode === "verify-manager") return canSup;
  if (mode === "verify-approve") return canAccess(MODULE, "authorize").allowed;
  if (mode === "view") return canAccess(MODULE, "view").allowed;
  return false;
}

const STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Pending Manager", value: "pending_manager" },
  { label: "Pending Approve", value: "pending_approve" },
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
  const authUser = useSelector((s) => s.auth?.user);
  const authRole = useSelector((s) => s.auth?.role);
  const canSup = canApproveAsManager({ ...authUser, type: authUser?.type || authRole, role: authRole });
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
      if (!gatePassModePermission(mode, canAccess, canSup)) {
        toast.error("You do not have permission for this action.");
        return;
      }
      setDrawer({ open: true, mode, record });
    },
    [canAccess, canSup]
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
    openApprove: (row) => openDrawer("verify-approve", row),
    canApproveSelection: () =>
      Boolean(selectedRecord && isPendingApprove(selectedRecord) && canAccess(MODULE, "authorize").allowed),
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
        badgeIndices: [11],
        detailKeys: ["emp_name", "out_time_display", "in_time_display", "pass_type_display"],
        footerKey: "status_display",
      }}
      extraFilterKeys={["emp_dcode", "pass_type", "status"]}
      extraFilters={extraFilters}
      searchPlaceholder="Code, name, reason…"
      clientQuickSearch
      applyExtrasOnChange
      showSearchButton={false}
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
              action="view"
              variant="outline"
              label="Download QR"
              icon={Download}
              disabled={!selected || !resolveGatePassPkId(row)}
              record={row}
              onClick={() => {
                void downloadGatePassQr(row)
                  .then(() => toast.success("Downloaded."))
                  .catch((e) => toast.error(e?.message || "Download failed."));
              }}
              className={LIST_PAGE_OUTLINE_ACTION}
            />
            {canSup ? (
              <ActionButton
                module={MODULE}
                action="view"
                variant="outline"
                label="Manager Approve"
                disabled={!selected || !isPendingManager(row)}
                record={row}
                onClick={() => openDrawer("verify-manager", row)}
                className={LIST_PAGE_OUTLINE_ACTION}
              />
            ) : null}
            <ListPageApproveButton
              module={MODULE}
              label="Approve"
              disabled={!selected || !isPendingApprove(row)}
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
