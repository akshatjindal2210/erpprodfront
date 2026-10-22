"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { GitMerge, Loader2, CheckCircle, XCircle, Undo2, Shield, MessageSquareQuote } from "lucide-react";
import { toast } from "react-toastify";

import { shortageService } from "@/apps/production/lib/services/shortage";
import DataTable from "@/ui/primitives/DataTable";
import Drawer from "@/ui/primitives/Drawer";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import AppListFooter from "@/ui/common/list/listPageFooter";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { DrawerSection, PRIME_STATUS_OPTIONS, PrimeItemSummary, usePrimeItemList } from "@/apps/production/modules/shortage/primeItem";
import { FormLabel } from "@/ui/common/Constants";
import {
  IMS_DRAWER_FOOTER_WRAP,
  IMS_DRAWER_BTN_CANCEL,
  IMS_DRAWER_BTN_APPROVE,
  IMS_DRAWER_BTN_AMBER,
} from "@/apps/ims/lib/helpers/masterListUi";

const SET = (v) => v !== undefined && v !== null && v !== "";
const ROW_TONE = {
  yes: "[&_td]:bg-emerald-50/50",
  no: "[&_td]:bg-rose-50/40",
  pending: "[&_td]:bg-amber-50/40",
  status: {
    pending: "[&_td]:bg-amber-50/70",
    approved: "[&_td]:bg-emerald-50/30",
    rejected: "[&_td]:bg-rose-50/30",
  },
};
const rowTone = (row) => ROW_TONE[row.tooling] || ROW_TONE.status[row.status] || "";

/** Production → Shortage → Prime Item (shortage approve / reject only). */
const PrimeItemTab = forwardRef(function PrimeItemTab({ refreshKey = 0, active = true, viewMode = "table", onSelectionChange, onDataChange }, ref) {
  const [status, setStatus] = useState("pending");
  const [drawerMode, setDrawerMode] = useState(null); // decide | reset

  const list = usePrimeItemList({
    load: shortageService.getPrimeItems,
    refreshKey,
    status,
    showRemark: false,
    showTooling: false,
    showRm: false,
    onDataChange,
  });
  const { selectedRow } = list;
  const canDecide = status === "pending";

  useEffect(() => {
    onSelectionChange?.({ row: selectedRow, status });
  }, [selectedRow, status, onSelectionChange]);

  const openAction = (mode) => (selectedRow ? setDrawerMode(mode) : toast.info("Select a prime item first."));
  useImperativeHandle(ref, () => ({ openAction }));

  useListDrawerHotkeys({
    module: "production_shortage",
    modalOpen: !active || Boolean(drawerMode),
    selectedId: list.selected,
    getSelectedRow: () => selectedRow,
    openApprove: canDecide ? () => setDrawerMode("decide") : null,
    canApproveSelection: () => Boolean(selectedRow),
    approveBlockedMessage: "Select a prime item first.",
  });

  const applyFilters = (data = {}) => {
    if (SET(data.primeStatus)) setStatus(data.primeStatus);
    list.resetView();
  };

  const resetFilters = () => {
    list.setSearch("");
    setStatus("pending");
    list.resetView();
  };

  const emptyMessage = list.error
    ? "Could not load prime items"
    : status === "pending"
      ? "No pending prime items"
      : status === "approved"
        ? "No approved prime items"
        : status === "rejected"
          ? "No rejected prime items"
          : "No prime items";

  return (
    <>
      <ListPageFilterStrip>
        <DateRangeFilter
          showDate={false}
          extraFilters={[
            { label: "Status", key: "primeStatus", value: status, options: PRIME_STATUS_OPTIONS, preserveOrder: true },
          ]}
          quickSearchOnly={status === "pending"}
          applyOnSearchEnter={false}
          searchVariant="quick"
          onApply={applyFilters}
          onReset={resetFilters}
          searchValue={list.search}
          onSearchChange={list.setSearch}
          searchPlaceholder="Search prime item, item code..."
          searchLabel="Search Prime Item"
        />
      </ListPageFilterStrip>

      <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
        <DataTable
          {...list.tableProps}
          viewMode={viewMode}
          hotkeysDisabled={!active || Boolean(drawerMode)}
          onRowDoubleClick={undefined}
          getRowClassName={rowTone}
          emptyIcon={GitMerge}
          emptyMessage={emptyMessage}
          emptySubMessage={
            list.error
              ? `${list.error} — use the refresh button to try again.`
              : "Shortage entries are grouped by their prime item from IMS."
          }
        />
      </div>

      <AppListFooter {...list.footerProps} />

      {drawerMode && selectedRow ? (
        <ActionDrawer
          mode={drawerMode}
          item={selectedRow}
          onClose={() => setDrawerMode(null)}
          onSaved={() => {
            setDrawerMode(null);
            list.resetView();
            void list.reload();
          }}
        />
      ) : null}
    </>
  );
});

export default PrimeItemTab;

const TYPES = {
  approve: {
    label: "Accept",
    icon: CheckCircle,
    pick: "border-emerald-600 bg-emerald-50 text-emerald-700",
    idle: "border-emerald-300 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-50",
    call: shortageService.approvePrimeItems,
  },
  reject: {
    label: "Reject",
    icon: XCircle,
    pick: "border-rose-600 bg-rose-50 text-rose-700",
    idle: "border-rose-300 bg-rose-50/70 text-rose-700 hover:bg-rose-50",
    call: shortageService.rejectPrimeItems,
  },
};

const BTN_REJECT =
  "shrink-0 min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-rose-100 disabled:opacity-50";

function ActionDrawer({ mode, item, onClose, onSaved }) {
  const isDecide = mode === "decide";
  const [type, setType] = useState(() => (isDecide ? null : "reset"));
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  if (!item) return null;

  const remarkMissing = isDecide && !remark.trim();
  const close = () => !saving && onClose();
  const saveClass = type === "reject" ? BTN_REJECT : type ? IMS_DRAWER_BTN_APPROVE : `${IMS_DRAWER_BTN_APPROVE} opacity-50`;

  const submit = async () => {
    if (saving) return;
    if (isDecide) {
      if (!type) return toast.error("Please select Accept or Reject.");
      if (remarkMissing) return toast.error("Please enter remark.");
      setSaving(true);
      try {
        const res = await TYPES[type].call([item.prime_key], remark.trim());
        if (res?.success === false) throw new Error(res?.message);
        toast.success(res?.message || "Done.");
        onSaved();
      } catch (err) {
        toast.error(err?.message || "Action failed.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    try {
      const res = await shortageService.resetPrimeItems([item.prime_key], remark.trim());
      if (res?.success === false) throw new Error(res?.message);
      toast.success(res?.message || "Done.");
      onSaved();
    } catch (err) {
      toast.error(err?.message || "Action failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen
      onClose={close}
      onSubmit={() => void submit()}
      title={isDecide ? "Accept / Reject Prime Item" : "Move to Pending"}
      description={item.prime_item_code ? `Prime item ${item.prime_item_code}` : undefined}
      maxWidth="max-w-2xl"
      footer={
        <div className={IMS_DRAWER_FOOTER_WRAP}>
          <button type="button" onClick={close} disabled={saving} className={IMS_DRAWER_BTN_CANCEL}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || (isDecide && (!type || remarkMissing))}
            title="Ctrl+S"
            className={isDecide ? saveClass : IMS_DRAWER_BTN_AMBER}
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isDecide ? (
              type === "reject" ? <XCircle size={18} /> : <Shield size={18} />
            ) : (
              <Undo2 size={18} />
            )}
            {isDecide ? "Save" : "Move to Pending"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        <DrawerSection title="Prime Item Details" bar="bg-indigo-500">
          <PrimeItemSummary item={item} />
        </DrawerSection>

        <div className="pt-1 space-y-4">
          {isDecide ? (
            <div className="space-y-1.5">
              <FormLabel required>Decision</FormLabel>
              <div className="grid grid-cols-2 gap-2 w-full">
                {["approve", "reject"].map((key) => {
                  const t = TYPES[key];
                  const Icon = t.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={saving}
                      onClick={() => setType(key)}
                      aria-pressed={type === key}
                      className={`w-full min-w-0 h-9 border rounded-none flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase transition-colors disabled:opacity-50 ${type === key ? t.pick : t.idle}`}
                    >
                      <Icon size={14} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 leading-snug">Status returns to Pending for this prime item.</p>
          )}

          <FormTextarea
            label="Remarks"
            labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
            rows={3}
            required={isDecide}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Optional notes"
            disabled={saving}
          />
        </div>
      </div>
    </Drawer>
  );
}
