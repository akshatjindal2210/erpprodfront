"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { GitMerge, Loader2, CheckCircle, XCircle, Shield, MessageSquareQuote } from "lucide-react";
import { toast } from "react-toastify";

import { toolingService } from "@/apps/production/lib/services/tooling";
import DataTable from "@/ui/primitives/DataTable";
import Drawer from "@/ui/primitives/Drawer";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import AppListFooter from "@/ui/common/list/listPageFooter";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { DrawerSection, TOOLING_FILTER_OPTIONS, PrimeItemSummary, usePrimeItemList } from "@/apps/production/modules/shortage/primeItem";
import { FormLabel } from "@/ui/common/Constants";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";
import DeleteModal from "@/ui/common/modals/DeleteModal";

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

const BTN_REJECT =
  "shrink-0 min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-rose-100 disabled:opacity-50";

/** Production → Tooling — same list / drawer UX as Shortage → Prime Item (tooling). */
const ToolingTab = forwardRef(function ToolingTab(
  { surface = "pending", refreshKey = 0, active = true, viewMode = "table", onDataChange, onSelectionChange },
  ref
) {
  const isRegister = surface === "register";
  const [toolingFilter, setToolingFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  const load = useMemo(
    () => () => toolingService.list(isRegister ? "register" : "pending"),
    [isRegister]
  );

  const list = usePrimeItemList({
    load,
    refreshKey,
    status: "all",
    tooling: isRegister ? toolingFilter : "all",
    showRemark: false,
    showTooling: isRegister,
    toolingModule: true,
    onDataChange,
  });
  const { selectedRow } = list;

  useEffect(() => {
    onSelectionChange?.(selectedRow);
  }, [selectedRow, onSelectionChange]);

  const openAction = () => (selectedRow ? setDrawerOpen(true) : toast.info("Select a prime item first."));
  const openDelete = () => (selectedRow ? setDeleteItem(selectedRow) : toast.info("Select a register row to delete."));
  useImperativeHandle(ref, () => ({ openAction, openDelete }));

  useListDrawerHotkeys({
    module: "production_tooling",
    modalOpen: !active || drawerOpen || Boolean(deleteItem),
    selectedId: list.selected,
    getSelectedRow: () => selectedRow,
    openApprove: !isRegister ? openAction : null,
    canApproveSelection: () => Boolean(!isRegister && selectedRow),
    approveBlockedMessage: "Select a prime item first.",
    openDelete: isRegister ? (row) => setDeleteItem(row) : null,
    canDeleteSelection: () => Boolean(isRegister && selectedRow),
  });

  const applyFilters = (data = {}) => {
    if (isRegister && SET(data.tooling)) setToolingFilter(data.tooling === "all" ? "all" : data.tooling);
    list.resetView();
  };

  const resetFilters = () => {
    list.setSearch("");
    if (isRegister) setToolingFilter("all");
    list.resetView();
  };

  const emptyMessage = list.error
    ? "Could not load prime items"
    : isRegister
      ? toolingFilter !== "all"
        ? `No tooling ${toolingFilter} items`
        : "No register entries"
      : "No pending tooling items";

  return (
    <>
      <ListPageFilterStrip>
        <DateRangeFilter
          showDate={false}
          extraFilters={
            isRegister
              ? [{ label: "Tooling", key: "tooling", value: toolingFilter, options: TOOLING_FILTER_OPTIONS, preserveOrder: true }]
              : []
          }
          quickSearchOnly={!isRegister}
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
          hotkeysDisabled={!active || drawerOpen}
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

      {drawerOpen ? (
        <ToolingActionDrawer
          item={selectedRow}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            setDrawerOpen(false);
            list.resetView();
            void list.reload();
          }}
        />
      ) : null}

      {deleteItem ? (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            setDeleteItem(null);
            list.setSelected(null);
            list.resetView();
            void list.reload();
          }}
          service={toolingService}
          entityLabel="Tooling register entry"
          idKey="prime_key"
          titleKey="prime_item_code"
          moduleSlug="production_tooling"
          warningMessage="This clears the Yes/No decision in prod_shortage. The prime item will appear on Pending again."
        />
      ) : null}
    </>
  );
});

export default ToolingTab;

const TYPE_BUTTONS = {
  approve: {
    label: "Approve",
    icon: CheckCircle,
    bar: "bg-emerald-500",
    pick: "border-emerald-600 bg-emerald-50 text-emerald-700",
    idle: "border-emerald-300 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-50",
  },
  reject: {
    label: "Reject",
    icon: XCircle,
    bar: "bg-rose-500",
    pick: "border-rose-600 bg-rose-50 text-rose-700",
    idle: "border-rose-300 bg-rose-50/70 text-rose-700 hover:bg-rose-50",
  },
};

function ToolingActionDrawer({ item, onClose, onSaved }) {
  const [type, setType] = useState(() => {
    if (item?.tooling === "yes") return "approve";
    if (item?.tooling === "no") return "reject";
    return null;
  });
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  if (!item) return null;

  const remarkMissing = !remark.trim();
  const close = () => !saving && onClose();
  const saveClass = type === "reject" ? BTN_REJECT : type ? IMS_DRAWER_BTN_APPROVE : `${IMS_DRAWER_BTN_APPROVE} opacity-50`;

  const submit = async () => {
    if (saving) return;
    if (!type) return toast.error("Please select Approve or Reject.");
    if (remarkMissing) return toast.error("Please enter remark.");
    setSaving(true);
    try {
      const res = await toolingService.save(item.prime_key, type === "approve", remark.trim());
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
      title="Tooling Approve / Reject"
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
            disabled={saving || !type || remarkMissing}
            title="Ctrl+S"
            className={saveClass}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : type === "reject" ? <XCircle size={18} /> : <Shield size={18} />}
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        <DrawerSection title="Prime Item Details" bar="bg-indigo-500">
          <PrimeItemSummary item={item} compact />
        </DrawerSection>

        <div className="pt-1 space-y-4">
          <div className="space-y-1.5">
            <FormLabel required>Tooling</FormLabel>
            <div className="grid grid-cols-2 gap-2 w-full">
              {["approve", "reject"].map((key) => {
                const t = TYPE_BUTTONS[key];
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

          <FormTextarea
            label="Remarks"
            labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
            rows={3}
            required
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
