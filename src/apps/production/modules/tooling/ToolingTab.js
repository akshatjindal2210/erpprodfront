"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { GitMerge, Loader2, CheckCircle, MessageSquareQuote } from "lucide-react";
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
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";
import DeleteModal from "@/ui/common/modals/DeleteModal";

const SET = (v) => v !== undefined && v !== null && v !== "";
const ROW_TONE = {
  yes: "[&_td]:bg-emerald-50/50",
  no: "[&_td]:bg-slate-50/50",
  pending: "[&_td]:bg-amber-50/40",
  status: {
    pending: "[&_td]:bg-amber-50/70",
    approved: "[&_td]:bg-emerald-50/30",
    rejected: "[&_td]:bg-rose-50/30",
  },
};
const rowTone = (row) => ROW_TONE[row.tooling] || ROW_TONE.status[row.status] || "";

/** Production → Tooling — Pending: Accept only (no Reject / No on this tab). */
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
    showTooling: true,
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
              : "From prod_job_card — Pending: tooling not decided; Register: Yes/No saved with remark."
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
          warningMessage="This clears the Yes/No decision on the job card. The prime item will appear on Pending again."
        />
      ) : null}
    </>
  );
});

export default ToolingTab;

function ToolingActionDrawer({ item, onClose, onSaved }) {
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  if (!item) return null;

  const remarkMissing = !remark.trim();
  const close = () => !saving && onClose();

  const submit = async () => {
    if (saving) return;
    if (remarkMissing) return toast.error("Please enter remark.");
    setSaving(true);
    try {
      const res = await toolingService.save(item.prime_key, true, remark.trim());
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
      title="Accept Tooling"
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
            disabled={saving || remarkMissing}
            title="Ctrl+S"
            className={IMS_DRAWER_BTN_APPROVE}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            Accept
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        <DrawerSection title="Prime Item Details" bar="bg-indigo-500">
          <PrimeItemSummary item={item} compact />
        </DrawerSection>

        <div className="pt-1 space-y-4">
          <div className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50/80 px-3 py-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <p className="text-[11px] font-semibold text-emerald-800">Pending — save as tooling <span className="uppercase">Yes</span> (Reject is not available on this tab).</p>
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
