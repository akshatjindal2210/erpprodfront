"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Banknote } from "lucide-react";
import { toast } from "react-toastify";

import { loanDeductionService } from "@/apps/hrms/lib/services/hrms";
import { fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { LOAN_DEDUCTION_HEADERS } from "@/apps/hrms/lib/columns/loanDeductionColumns";
import { DEDUCTION_STATUS_OPTIONS, DEDUCTION_TYPE_FILTER_OPTIONS } from "@/apps/hrms/lib/loanUtils";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { hrmsSelectionLabel } from "@/apps/hrms/lib/hrmsSelectionLabel";
import ServerListPage from "@/ui/common/list/ServerListPage";
import {
  ListPageAddButton,
  ListPageApproveButton,
  ListPageDeleteButton,
  ListPageEditButton,
  ListPageViewButton,
} from "@/ui/common/list/listPageCrud";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import LoanDeductionDrawer from "@/apps/hrms/modules/loan-deduction/LoanDeductionDrawer";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";

const MODULE = "hrms_deduction";

const isManual = (row) => row && row.type !== "loan" && row.type !== "advance";
const canEditRow = (row) => Boolean(isManual(row) && row.status === "pending");
const canDeleteRow = (row) => Boolean(isManual(row) && row.status === "pending");
const canApproveRow = (row) => Boolean(isManual(row) && row.status === "pending");
const canCompleteRow = (row) => Boolean(row?.status === "approved");

function modePermission(mode, canAccess) {
  if (mode === "add") return canAccess(MODULE, "add").allowed;
  if (mode === "edit") return canAccess(MODULE, "edit").allowed;
  if (mode === "verify-approve") return canAccess(MODULE, "authorize").allowed;
  if (mode === "view") return canAccess(MODULE, "view").allowed;
  return false;
}

function toFilterRow(row) {
  const code = String(row?.emp_code ?? "").trim();
  const name = String(row?.emp_name ?? "").trim();
  const dcode = row?.emp_dcode != null ? String(row.emp_dcode) : "";
  return { ...row, value: dcode, rawValue: dcode, label: code && name ? `${code} — ${name}` : code || name };
}

export default function LoanDeductionPage() {
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
      { label: "Type", key: "type", variant: "quick", options: DEDUCTION_TYPE_FILTER_OPTIONS, preserveOrder: true },
      { label: "Status", key: "status", variant: "quick", options: DEDUCTION_STATUS_OPTIONS, preserveOrder: true },
    ],
    [fetchEmployeeFilterOptions, getEmployeeFilterById]
  );

  const openDrawer = useCallback(
    (mode, record = null) => {
      if (!modePermission(mode, canAccess)) {
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
    openApprove: (row) => {
      if (canApproveRow(row)) return openDrawer("verify-approve", row);
      if (canCompleteRow(row)) return openDrawer("verify-approve", row);
    },
    canApproveSelection: () =>
      Boolean(
        selectedRecord &&
          canAccess(MODULE, "authorize").allowed &&
          (canApproveRow(selectedRecord) || canCompleteRow(selectedRecord))
      ),
    openDelete: (row) => {
      if (!canAccess(MODULE, "delete").allowed) {
        toast.error("You do not have permission to delete.");
        return;
      }
      if (!canDeleteRow(row)) {
        toast.warning("Only pending extra deduction can be deleted.");
        return;
      }
      setDeleteItem(row);
    },
    canDeleteSelection: () => Boolean(selectedRecord && canDeleteRow(selectedRecord) && canAccess(MODULE, "delete").allowed),
    canEditSelection: () => Boolean(selectedRecord && canEditRow(selectedRecord) && canAccess(MODULE, "edit").allowed),
  });

  return (
    <ServerListPage
      emptyIcon={Banknote}
      fetchList={loanDeductionService.list}
      headers={LOAN_DEDUCTION_HEADERS}
      moduleName="Deduction"
      viewModule={MODULE}
      getRowId={(row) => row.id}
      cardConfig={{
        titleKey: "emp_code",
        badgeIndices: [7],
        detailKeys: ["emp_name", "type_display", "month", "amount"],
        footerKey: "status_display",
      }}
      extraFilterKeys={["emp_dcode", "type", "status"]}
      extraFilters={extraFilters}
      defaultExtraFilters={{ status: "pending" }}
      searchPlaceholder="Code, name, remark…"
      clientQuickSearch
      applyExtrasOnChange
      showSearchButton={false}
      selectionLabel={hrmsSelectionLabel.loanDeduction}
      tableHotkeyProps={tableHotkeyProps}
      onSelectionChange={onSelectionChange}
      getRowClassName={(row) =>
        row?.status === "pending" || row?.overdue
          ? "[&_td]:!bg-amber-50 [&_td:first-child]:!shadow-[inset_3px_0_0_0_#f59e0b]"
          : row?.status === "deducted"
            ? "[&_td]:!bg-emerald-50/40"
            : ""
      }
      toolbarActions={(api) => {
        reloadRef.current = api.reload;
        const { selected, selectedRecord: row } = api;
        return (
          <>
            <ListPageAddButton module={MODULE} onClick={openNewModal} />
            <ListPageEditButton module={MODULE} disabled={!selected || !canEditRow(row)} record={row} onClick={openEditModal} />
            <ListPageViewButton module={MODULE} disabled={!selected} record={row} onClick={() => openDrawer("view", row)} />
            <ListPageApproveButton
              module={MODULE}
              label={canCompleteRow(row) ? "Complete" : "Approve"}
              disabled={!selected || !(canApproveRow(row) || canCompleteRow(row))}
              record={row}
              onClick={openApproveModal}
            />
            <ListPageDeleteButton module={MODULE} disabled={!selected || !canDeleteRow(row)} onClick={openDeleteModal} />
          </>
        );
      }}
    >
      <LoanDeductionDrawer
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
        service={loanDeductionService}
        entityLabel="Deduction"
        idKey="id"
        titleKey="emp_code"
        moduleSlug={MODULE}
      />
    </ServerListPage>
  );
}
