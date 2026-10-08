"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Timer } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import { otApprovalService } from "@/apps/hrms/lib/services/hrms";
import { formatDuration } from "@/apps/hrms/lib/attendanceUtils";
import { useHrmsUserQuickFilter } from "@/apps/hrms/lib/useHrmsUserQuickFilter";
import { hrmsSelectionLabel } from "@/apps/hrms/lib/hrmsSelectionLabel";
import { hrmsAuditAt, hrmsAuditBy, hrmsDateCell, hrmsEmpCodeCell, hrmsEmpty, hrmsMutedTimeCell, hrmsNameCell, hrmsTimeCell } from "@/apps/hrms/lib/columns/hrmsListCells";
import { GP_ROW2, ReadonlyField } from "@/apps/hrms/lib/gatePassForm";
import ServerListPage from "@/ui/common/list/ServerListPage";
import { ListPageApproveButton, ListPageViewButton, LIST_PAGE_OUTLINE_ACTION } from "@/ui/common/list/listPageCrud";
import ActionButton from "@/ui/primitives/ActionButton";
import Drawer from "@/ui/primitives/Drawer";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { IMS_DRAWER_BTN_AMBER, IMS_DRAWER_BTN_APPROVE, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_FOOTER_WRAP } from "@/apps/ims/lib/helpers/masterListUi";

const MODULE = "hrms_ot_approval";
/** User/search = quick (tint). Status = server so large OT sets stay fast. */
const FILTER_USER = "quick";
const FILTER_STATUS = "server";
const PENDING_ROW = "[&_td]:!bg-amber-50 [&_td:first-child]:!shadow-[inset_3px_0_0_0_#f59e0b]";
const REJECTED_ROW = "[&_td]:!bg-rose-50 [&_td:first-child]:!shadow-[inset_3px_0_0_0_#f43f5e]";
const minsLabel = (m) => {
  if (m == null || m === "") return "—";
  const n = Number(m);
  if (!Number.isFinite(n)) return "—";
  return formatDuration(n);
};

/** 0 pending | 1 approved | 2 rejected */
const otFlag = (r) => {
  const n = Number(r?.ot_approved);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 0;
};
const isPending = (r) => Number(r?.ot_minutes) > 0 && Number.isFinite(Number(r?.ot_minutes)) && otFlag(r) === 0;
const isRejected = (r) => otFlag(r) === 2;
const isDecided = (r) => otFlag(r) === 1 || otFlag(r) === 2;
const statusLabel = (r) => r?.ot_status_display || (otFlag(r) === 1 ? "Approved" : otFlag(r) === 2 ? "Rejected" : "Pending");

function otStatusCell(_, r) {
  const flag = otFlag(r);
  const label = statusLabel(r);
  const tone =
    flag === 1
      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
      : flag === 2
        ? "bg-rose-50 text-rose-600 border-rose-100"
        : "bg-amber-50 text-amber-700 border-amber-100";
  return (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${tone}`}>
      {label}
    </span>
  );
}

const HEADERS = [
  ["Emp Code", "emp_code", hrmsEmpCodeCell, { fixed: true, width: "100px" }],
  ["Name", "name", hrmsNameCell, { width: "140px" }],
  ["Date", "attendance_date_display", hrmsDateCell, { width: "100px" }],
  ["Shift", "shift_display", hrmsEmpty, { width: "70px" }],
  ["In", "in_display", hrmsTimeCell, { width: "155px" }],
  ["Out", "out_display", hrmsMutedTimeCell, { width: "155px" }],
  ["Total Hours", "total_minutes", (v) => hrmsEmpty(minsLabel(v)), { width: "145px", exportType: "number", copyValue: (row) => row.total_minutes ?? "" }],
  ["OT", "ot_minutes", (_, r) => (
    <span className={`text-[10px] font-bold tabular-nums ${isPending(r) ? "text-red-600" : isRejected(r) ? "text-rose-600" : "text-emerald-600"}`}>
      {minsLabel(r?.ot_minutes)}
    </span>
  ), { width: "145px", exportType: "number", copyValue: (row) => row.ot_minutes ?? "" }],
  ["Status", "ot_status_display", otStatusCell, { width: "100px", align: "center" }],
  ["Approved By", "ot_approved_by_name", hrmsAuditBy, { width: "110px" }],
  ["Approved At", "ot_approved_at", hrmsAuditAt, { width: "150px" }],
  ["Remark", "ot_remarks", hrmsAuditBy, { width: "140px" }],
];

const STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
  { label: "Rejected", value: "rejected" },
];

function OtDrawer({ open, mode, record: r, onClose, onSuccess, canOverride }) {
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const sopAckRef = useRef(null);
  const isReject = mode === "reject";
  const canDecide = mode !== "view" && (isPending(r) || (canOverride && isDecided(r)));
  const existingRemark = String(r?.ot_remarks ?? "").trim();

  useEffect(() => {
    if (!open) return;
    setRemark(existingRemark);
  }, [open, r?.id, existingRemark]);

  const save = async () => {
    if (!sopAckRef.current?.assertAcknowledged()) return;
    const text = String(remark).trim();
    if (!text) return toast.warning("Remark is required.");
    setSaving(true);
    try {
      const res = await (isReject ? otApprovalService.reject : otApprovalService.approve)({ id: r.id, ot_remarks: text });
      if (!res?.success) throw new Error(res?.message || "Request failed.");
      toast.success(res.message || (isReject ? "OT rejected." : "OT approved."));
      onSuccess?.();
      onClose?.();
    } catch (e) {
      toast.error(e.message || "Request failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={canDecide ? save : undefined}
      title={isReject ? "Reject Overtime" : mode === "approve" ? "Approve Overtime" : "View Overtime"}
      description={canOverride && isDecided(r) && mode !== "view" ? "Super admin override — change previous decision" : "Overtime approval"}
      maxWidth="max-w-2xl"
      footer={
        <div className={IMS_DRAWER_FOOTER_WRAP}>
          <button type="button" onClick={onClose} disabled={saving} className={canDecide ? IMS_DRAWER_BTN_CANCEL : IMS_DRAWER_BTN_CLOSE}>
            {canDecide ? "Cancel" : "Close"}
          </button>
          {canDecide ? (
            <button type="button" title="Ctrl+S" disabled={saving} className={isReject ? IMS_DRAWER_BTN_AMBER : IMS_DRAWER_BTN_APPROVE} onClick={save}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : isReject ? null : <Check size={18} />}
              {isReject ? "Reject" : "Approve"}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <div className={GP_ROW2}>
          <ReadonlyField label="Emp Code" value={r?.emp_code || "—"} />
          <ReadonlyField label="Name" value={r?.name || "—"} />
        </div>
        <div className={GP_ROW2}>
          <ReadonlyField label="Date" value={r?.attendance_date_display || "—"} tabular />
          <ReadonlyField label="Shift" value={r?.shift_display || "—"} />
        </div>
        <div className={GP_ROW2}>
          <ReadonlyField label="In" value={r?.in_display || "—"} tabular />
          <ReadonlyField label="Out" value={r?.out_display || "—"} tabular />
        </div>
        <div className={GP_ROW2}>
          <ReadonlyField label="Total Hours" value={minsLabel(r?.total_minutes)} tabular />
          <ReadonlyField label="OT" value={minsLabel(r?.ot_minutes)} tabular />
        </div>
        <div className={GP_ROW2}>
          <ReadonlyField label="Status" value={statusLabel(r)} />
          <ReadonlyField label="Decided By" value={r?.ot_approved_by_name || "—"} />
        </div>
        {canDecide ? (
          <FormTextarea label="Remark" required rows={4} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Enter remark" disabled={saving} />
        ) : (
          <ReadonlyField label="Remark" value={existingRemark || "—"} />
        )}
        {canDecide ? (
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={`${open}-authorize-${mode}`}
            isOpen={open}
            moduleSlug={MODULE}
            permissionType="authorize"
          />
        ) : null}
      </div>
    </Drawer>
  );
}

export default function OtApprovalPage() {
  const canAuthorize = useCanAccess()(MODULE, "authorize").allowed;
  const authUser = useSelector((s) => s.auth?.user);
  const authRole = useSelector((s) => s.auth?.role);
  const isSuperAdmin = useMemo(() => {
    const role = String(authUser?.type || authRole || "").toLowerCase().trim();
    return role === "super_admin";
  }, [authUser, authRole]);

  const [drawer, setDrawer] = useState({ open: false, mode: "view", record: null });
  const [selectedId, setSelectedId] = useState(null);
  const [row, setRow] = useState(null);
  const reloadRef = useRef(null);
  const userFilter = useHrmsUserQuickFilter(MODULE, FILTER_USER);

  const extraFilters = useMemo(
    () => [
      userFilter,
      { label: "Status", key: "ot_status", variant: FILTER_STATUS, preserveOrder: true, options: STATUS_OPTIONS },
    ],
    [userFilter]
  );

  const canActOn = useCallback(
    (record) => Boolean(record && (isPending(record) || (isSuperAdmin && isDecided(record)))),
    [isSuperAdmin]
  );

  const openDrawer = useCallback(
    (mode, record) => {
      if (mode !== "view" && !canActOn(record)) {
        return toast.warning(
          isDecided(record)
            ? "Only super admin can change approved/rejected OT."
            : "Select a pending overtime record."
        );
      }
      setDrawer({ open: true, mode, record });
    },
    [canActOn]
  );

  const { openApproveModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: drawer.open,
    selectedId,
    getSelectedRow: () => row,
    openApprove: (r) => openDrawer("approve", r),
    canApproveSelection: () => Boolean(canActOn(row) && canAuthorize),
    openDelete: (r) => openDrawer("reject", r),
    canDeleteSelection: () => Boolean(canActOn(row) && canAuthorize),
  });

  return (
    <ServerListPage
      emptyIcon={Timer}
      fetchList={otApprovalService.list}
      headers={HEADERS}
      moduleName="OT Approval"
      viewModule={MODULE}
      dateDefaultSpanDays={0}
      defaultToday={false}
      getRowId={(r) => r.id}
      initialSort={{ sortKey: "ot_minutes", sortDir: "desc" }}
      extraFilters={extraFilters}
      extraFilterKeys={["emp_dcode", "ot_status"]}
      defaultExtraFilters={{ ot_status: "pending" }}
      searchPlaceholder="Search code, name…"
      clientQuickSearch
      applyExtrasOnChange={false}
      showSearchButton
      selectionLabel={hrmsSelectionLabel.attendance}
      tableHotkeyProps={tableHotkeyProps}
      onSelectionChange={(id, record) => {
        setSelectedId(id ?? null);
        setRow(record ?? null);
      }}
      getRowClassName={(r) => (isPending(r) ? PENDING_ROW : isRejected(r) ? REJECTED_ROW : "")}
      toolbarActions={(api) => {
        reloadRef.current = api.reload;
        const { selected, selectedRecord: r } = api;
        const actionable = canActOn(r);
        return (
          <>
            <ListPageViewButton module={MODULE} disabled={!selected} record={r} onClick={() => openDrawer("view", r)} />
            {canAuthorize ? (
              <>
                <ListPageApproveButton
                  module={MODULE}
                  label={isDecided(r) && isSuperAdmin ? "Re-Approve" : "Approve"}
                  disabled={!selected || !actionable}
                  record={r}
                  onClick={openApproveModal}
                />
                <ActionButton
                  module={MODULE}
                  action="authorize"
                  variant="outline"
                  label={isDecided(r) && isSuperAdmin ? "Re-Reject" : "Reject"}
                  disabled={!selected || !actionable}
                  record={r}
                  onClick={() => openDrawer("reject", r)}
                  className={LIST_PAGE_OUTLINE_ACTION}
                />
              </>
            ) : null}
          </>
        );
      }}
    >
      <OtDrawer
        open={drawer.open}
        mode={drawer.mode}
        record={drawer.record}
        canOverride={isSuperAdmin}
        onClose={() => setDrawer({ open: false, mode: "view", record: null })}
        onSuccess={() => reloadRef.current?.()}
      />
    </ServerListPage>
  );
}
