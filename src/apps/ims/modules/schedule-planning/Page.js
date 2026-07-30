"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CalendarClock, Info, X, Calendar, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import ActionButton from "@/ui/primitives/ActionButton";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useSelector } from "react-redux";
import { selectUser, selectRole } from "@/platform/store/slices/authSlice";
import { applyClientSearch, sortRowsByKey, nextSortParams } from "@/ui/common/list/clientListSearch";
import { schedulePlanningService } from "@/apps/ims/lib/services/schedulePlanning";
import { SCHEDULE_LIST_FILTER, canOpenPlanModal, SCHEDULE_REPORT_FILTER, getDefaultScheduleStatusFilter, getScheduleStatusFilterOptions, filterScheduleItemsForPermission, isSalesDepartmentUser, isScheduleCompleteRow } from "./schedulePlanStatus";
import { SCHEDULE_PAGE_TABS, MONTH_FILTER_OPTIONS, SCHEDULE_REPORT_FILTER_OPTIONS, scheduleItemRowKey, scheduleSchnoKey, resolveScheduleItemdcode, canDeleteRow, scheduleItemWiseSearchParts,
  scheduleUniqueSearchParts, toUniqueScheduleRows, buildScheduleUniqueHeaders, buildScheduleItemWiseHeaders, buildScheduleItemWiseComparisonHeaders, buildScheduleUniqueComparisonHeaders, getScheduleListRowClassName, SCHEDULE_LIST_ROW_LEGEND } from "./schedulePlanningColumns";
import SchedulePlanModal from "./SchedulePlanModal";
import SchedulePlanHistoryModal from "./SchedulePlanHistoryModal";
import SchedulePlanRemoveConfirmModal from "./SchedulePlanRemoveConfirmModal";
import { MasterRefreshButton } from "../../lib/helpers/masterListUi";

function buildScheduleListFilters(query, status = SCHEDULE_LIST_FILTER.ALL) {
  const reportType = String(query?.reportType ?? SCHEDULE_REPORT_FILTER.DEFAULT).toLowerCase();
  const body = {
    reportType,
    status: String(status ?? SCHEDULE_LIST_FILTER.ALL).toLowerCase(),
  };

  if (reportType === SCHEDULE_REPORT_FILTER.CUSTOM) {
    const month = query?.month;
    const fromDate = String(query?.fromDate ?? "").trim();
    const toDate = String(query?.toDate ?? "").trim();
    const hasMonth = month && String(month).toLowerCase() !== "all";
    if (hasMonth) body.month = month;
    if (fromDate) body.fromDate = fromDate;
    if (toDate) body.toDate = toDate;
  }

  return body;
}

export default function SchedulePlanningPage() {
  const canAccess = useCanAccess();
  const currentUser = useSelector(selectUser);
  const role = useSelector(selectRole);
  const isSuperAdmin =
    String(role || "").toLowerCase() === "super_admin" ||
    String(currentUser?.type || currentUser?.role || "").toLowerCase() === "super_admin";
  const viewAccess = useMemo(() => canAccess("schedule_planning", "view"), [canAccess]);
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);
  const [viewMode, handleViewMode] = useViewMode();

  const canRemovePlan = useMemo(() => canAccess("schedule_planning", "delete").allowed, [canAccess]);
  const canAddPlan = useMemo(() => canAccess("schedule_planning", "add").allowed, [canAccess]);
  const canApprovePlan = useMemo(() => canAccess("schedule_planning", "authorize").allowed, [canAccess]);
  const isSalesDepartment = useMemo(() => isSalesDepartmentUser(currentUser), [currentUser]);
  const defaultStatusFilter = useMemo(
    () =>
      getDefaultScheduleStatusFilter({
        canAdd: canAddPlan,
        canApprove: canApprovePlan,
        isSalesDepartment,
        isSuperAdmin,
      }),
    [canAddPlan, canApprovePlan, isSalesDepartment, isSuperAdmin]
  );
  const statusFilterOptions = useMemo(() => getScheduleStatusFilterOptions(), []);
  const canOpenScheduleActions = canAddPlan || canApprovePlan;

  const [pageTab, setPageTab] = useState("item-wise");
  const [itemWiseSchnoFilter, setItemWiseSchnoFilter] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [tempSearch, setTempSearch] = useState("");
  const [params, setParams] = useState({ sortKey: "", sortDir: "asc" });
  const [appliedQuery, setAppliedQuery] = useState(null);
  const [statusFilter, setStatusFilter] = useState(SCHEDULE_LIST_FILTER.ALL);
  const [draftReportType, setDraftReportType] = useState(SCHEDULE_REPORT_FILTER.DEFAULT);
  const initialQuerySet = useRef(false);

  const [selected, setSelected] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalMode, setPlanModalMode] = useState("plan");
  const [removePlanOpen, setRemovePlanOpen] = useState(false);
  const [removePlanLoading, setRemovePlanLoading] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [modalScheduleItems, setModalScheduleItems] = useState([]);
  const [modalItemsLoading, setModalItemsLoading] = useState(false);

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    if (initialQuerySet.current) return;
    initialQuerySet.current = true;
    setAppliedQuery({
      reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
      status: SCHEDULE_LIST_FILTER.ALL,
    });
    setDraftReportType(SCHEDULE_REPORT_FILTER.DEFAULT);
    setStatusFilter(defaultStatusFilter);
  }, [dateFilterDefaults.from, dateFilterDefaults.to, defaultStatusFilter]);

  const isCustomReport = String(draftReportType) === SCHEDULE_REPORT_FILTER.CUSTOM;

  const fetchData = useCallback(async () => {
    if (!appliedQuery) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await schedulePlanningService.list(buildScheduleListFilters(appliedQuery, statusFilter));
      setRows(Array.isArray(res?.data) ? res.data : []);
      setDisplayLimit(100);
      if (!res?.success) {
        toast.warning(res?.message || "Could not load schedule data. Check filters or try again.");
      }
    } catch {
      toast.error("Failed to load schedule data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, statusFilter]);

  useEffect(() => {
    if (appliedQuery) void fetchData();
  }, [appliedQuery, fetchData]);

  const loadAllScheduleItems = useCallback(async (schno) => {
    if (!schno) return [];
    try {
      const res = await schedulePlanningService.list({ schno });
      return Array.isArray(res?.data) ? res.data : [];
    } catch {
      return [];
    }
  }, []);

  const refreshModalScheduleItems = useCallback(
    async (schno) => {
      if (!schno) {
        setModalScheduleItems([]);
        return;
      }
      const items = await loadAllScheduleItems(schno);
      setModalScheduleItems(items);
    },
    [loadAllScheduleItems]
  );

  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch, pageTab]);

  const uniqueSchedulesAll = useMemo(() => toUniqueScheduleRows(rows), [rows]);
  const uniqueSchedules = useMemo(() => {
    const q = String(tempSearch || "").trim();
    let data = uniqueSchedulesAll;
    if (q) {
      data = applyClientSearch(uniqueSchedulesAll, tempSearch, { getParts: scheduleUniqueSearchParts, skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [uniqueSchedulesAll, tempSearch, params.sortKey, params.sortDir]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    let data = itemWiseSchnoFilter
      ? rows.filter((row) => scheduleSchnoKey(row) === itemWiseSchnoFilter)
      : [...rows];
    if (q) {
      data = applyClientSearch(data, tempSearch, { getParts: scheduleItemWiseSearchParts, skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [rows, itemWiseSchnoFilter, tempSearch, params.sortKey, params.sortDir]);

  const drillToItemWise = useCallback((scheduleRow) => {
    const schno = scheduleSchnoKey(scheduleRow);
    if (!schno) return;
    setItemWiseSchnoFilter(schno);
    setPageTab("item-wise");
    setSelected(null);
    setDisplayLimit(100);
  }, []);

  const toggleSort = useCallback((key) => {
    setParams((prev) => nextSortParams(prev, key));
    setDisplayLimit(100);
  }, []);

  const isScheduleTab = pageTab === "schedule";

  const handleSelect = useCallback((id) => {
    setSelected(id);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const pool = isScheduleTab ? uniqueSchedules : filteredRows;
    const idFn = isScheduleTab ? scheduleSchnoKey : scheduleItemRowKey;
    if (!pool.some((row) => idFn(row) === selected)) setSelected(null);
  }, [selected, isScheduleTab, uniqueSchedules, filteredRows]);

  const activeTotal = isScheduleTab ? uniqueSchedules.length : filteredRows.length;
  const displayRows = useMemo(
    () => (isScheduleTab ? uniqueSchedules : filteredRows).slice(0, displayLimit),
    [isScheduleTab, uniqueSchedules, filteredRows, displayLimit]
  );

  const selectedRecord = useMemo(() => {
    if (!selected) return null;
    if (isScheduleTab) return uniqueSchedules.find((row) => scheduleSchnoKey(row) === selected) ?? null;
    return filteredRows.find((row) => scheduleItemRowKey(row) === selected) ?? null;
  }, [selected, isScheduleTab, uniqueSchedules, filteredRows]);

  useEffect(() => {
    if (!planModalOpen || !selectedRecord?.schno) {
      setModalScheduleItems([]);
      setModalItemsLoading(false);
      return undefined;
    }
    const schno = scheduleSchnoKey(selectedRecord);
    let cancelled = false;
    setModalItemsLoading(true);
    void loadAllScheduleItems(schno)
      .then((items) => {
        if (!cancelled) setModalScheduleItems(items);
      })
      .finally(() => {
        if (!cancelled) setModalItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planModalOpen, selectedRecord, loadAllScheduleItems]);

  const planSchedule = useMemo(() => {
    if (!selectedRecord || !planModalOpen) return null;
    // Modal only: Plan user → Ready/Plan rows; Hold only for APPROVE.
    const scheduleItems = filterScheduleItemsForPermission(modalScheduleItems, {
      canAdd: canAddPlan,
      canApprove: canApprovePlan,
    });
    if (!scheduleItems.length && modalItemsLoading) {
      return {
        schno: selectedRecord.schno,
        schdt: selectedRecord.schdt,
        acc_name: selectedRecord.acc_name,
        schmonth: selectedRecord.schmonth,
        acc_code: selectedRecord.acc_code,
        item_count: 0,
        _items: [],
        overall_remark: null,
      };
    }
    if (!scheduleItems.length) return null;
    return {
      schno: selectedRecord.schno,
      schdt: selectedRecord.schdt,
      acc_name: selectedRecord.acc_name,
      schmonth: selectedRecord.schmonth,
      acc_code: selectedRecord.acc_code,
      item_count: scheduleItems.length,
      _items: scheduleItems,
      overall_remark: scheduleItems.find((i) => i.overall_remark)?.overall_remark ?? null,
    };
  }, [selectedRecord, planModalOpen, modalScheduleItems, modalItemsLoading, canAddPlan, canApprovePlan]);

  const canOpenPlan = Boolean(
    canOpenPlanModal(statusFilter) &&
      selectedRecord &&
      !isScheduleCompleteRow(selectedRecord)
  );

  const deleteSchno = selectedRecord ? scheduleSchnoKey(selectedRecord) : "";
  const deleteItemdcode = useMemo(() => {
    if (isScheduleTab || !selectedRecord) return null;
    return resolveScheduleItemdcode(selectedRecord, selected);
  }, [isScheduleTab, selectedRecord, selected]);

  const canDeleteSelection = useMemo(() => {
    if (!deleteSchno) return false;
    if (!isScheduleTab) return canDeleteRow(selectedRecord);
    const schedule = uniqueSchedules.find((row) => scheduleSchnoKey(row) === deleteSchno);
    if (schedule && canDeleteRow(schedule)) return true;
    return rows.some((row) => scheduleSchnoKey(row) === deleteSchno && canDeleteRow(row));
  }, [deleteSchno, isScheduleTab, selectedRecord, uniqueSchedules, rows]);

  const deleteItemCount = useMemo(() => {
    if (!deleteSchno) return 0;
    const schedule = uniqueSchedules.find((row) => scheduleSchnoKey(row) === deleteSchno);
    if (schedule?.item_count) return Number(schedule.item_count) || 0;
    return rows.filter((row) => scheduleSchnoKey(row) === deleteSchno).length;
  }, [deleteSchno, uniqueSchedules, rows]);

  const actionButtonLabel = canApprovePlan && !canAddPlan ? "Authorize" : "Plan";

  const openPlanModal = useCallback(() => {
    if (!canOpenScheduleActions) return;
    if (selectedRecord && isScheduleCompleteRow(selectedRecord)) {
      toast.info("Completed items cannot be planned or rejected.");
      return;
    }
    if (!canOpenPlan) {
      toast.info(
        canApprovePlan && !canAddPlan
          ? isScheduleTab
            ? "Select a schedule row to authorize (Hold / Ready)."
            : "Select an item row to authorize (Hold / Ready)."
          : isScheduleTab
            ? "Select a schedule row to plan."
            : "Select an item row to plan."
      );
      return;
    }
    setPlanModalMode(canApprovePlan && !canAddPlan ? "authorize" : "plan");
    setPlanModalOpen(true);
  }, [canOpenScheduleActions, canOpenPlan, isScheduleTab, canApprovePlan, canAddPlan, selectedRecord]);

  const handleRowDoubleClick = useCallback(
    (_item, id) => {
      if (!canOpenScheduleActions) return;
      if (!canOpenPlanModal(statusFilter)) return;
      const pool = isScheduleTab ? uniqueSchedules : filteredRows;
      const idFn = isScheduleTab ? scheduleSchnoKey : scheduleItemRowKey;
      const clicked = pool.find((row) => idFn(row) === id);
      if (clicked && isScheduleCompleteRow(clicked)) {
        toast.info("Completed items cannot be planned or rejected.");
        return;
      }
      setSelected(id);
      setPlanModalMode(canApprovePlan && !canAddPlan ? "authorize" : "plan");
      setPlanModalOpen(true);
    },
    [
      canOpenScheduleActions,
      statusFilter,
      canApprovePlan,
      canAddPlan,
      isScheduleTab,
      uniqueSchedules,
      filteredRows,
    ]
  );

  const handleViewHistory = useCallback((row) => {
    setHistoryItem(row);
  }, []);

  const refreshListOnly = useCallback(async () => {
    await fetchData();
    if (planModalOpen && selectedRecord?.schno) {
      await refreshModalScheduleItems(scheduleSchnoKey(selectedRecord));
    }
  }, [fetchData, planModalOpen, selectedRecord, refreshModalScheduleItems]);

  const refreshAfterSave = useCallback(async () => {
    setSelected(null);
    await refreshListOnly();
  }, [refreshListOnly]);

  const removePlanLabel = useMemo(() => {
    if (!deleteSchno) return "";
    if (!isScheduleTab && selectedRecord) {
      const item = selectedRecord.item_code || selectedRecord.itemdcode || "item";
      return `Sch ${deleteSchno} · ${item}`;
    }
    return `Sch No ${deleteSchno} (${deleteItemCount || 0} items)`;
  }, [deleteSchno, deleteItemCount, isScheduleTab, selectedRecord]);

  const removePlanDescription = useMemo(() => {
    if (!isScheduleTab && deleteItemdcode != null) {
      return "Only the selected item row and its history will be permanently deleted. Other items in this schedule are not affected.";
    }
    return "All items and history for this Sch No will be permanently deleted.";
  }, [isScheduleTab, deleteItemdcode]);

  const handleRemovePlan = useCallback(async () => {
    if (!canRemovePlan || !deleteSchno || !canDeleteSelection) return;

    if (isScheduleTab) {
      // Schedule master tab → delete entire Sch No (all items at once).
      setRemovePlanLoading(true);
      try {
        const res = await schedulePlanningService.remove({ schno: deleteSchno, delete_scope: "schedule" });
        if (!res?.success) throw new Error(res?.message || "Delete failed");
        toast.success(res.message || "Schedule deleted.");
        setRemovePlanOpen(false);
        setSelected(null);
        setItemWiseSchnoFilter(null);
        await fetchData();
      } catch (err) {
        toast.error(err?.message || "Delete failed");
      } finally {
        setRemovePlanLoading(false);
      }
      return;
    }

    // Schedule Item Wise tab → delete only the selected item row.
    if (deleteItemdcode == null) {
      toast.error("Could not identify the selected item. Select one item row and try again.");
      return;
    }

    setRemovePlanLoading(true);
    try {
      const res = await schedulePlanningService.remove({
        schno: deleteSchno,
        itemdcode: deleteItemdcode,
        delete_scope: "item",
      });
      if (!res?.success) throw new Error(res?.message || "Delete failed");
      toast.success(res.message || "Schedule item deleted.");
      setRemovePlanOpen(false);
      setSelected(null);
      await fetchData();
    } catch (err) {
      toast.error(err?.message || "Delete failed");
    } finally {
      setRemovePlanLoading(false);
    }
  }, [canRemovePlan, deleteSchno, deleteItemdcode, canDeleteSelection, fetchData, isScheduleTab]);

  const openDeleteConfirm = useCallback(() => {
    if (!selected || !deleteSchno) return;
    if (!canDeleteSelection) {
      toast.info(isScheduleTab ? "Select a schedule with saved plan data to delete." : "Select an item row with saved plan data to delete.");
      return;
    }
    if (!isScheduleTab && deleteItemdcode == null) {
      toast.error("Could not identify the selected item. Select one item row and try again.");
      return;
    }
    setRemovePlanOpen(true);
  }, [selected, deleteSchno, canDeleteSelection, isScheduleTab, deleteItemdcode]);

  const { openNewModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "schedule_planning",
    addActions: ["add", "authorize"],
    modalOpen: planModalOpen || removePlanOpen || Boolean(historyItem),
    selectedId: selected,
    getSelectedRow: () => selectedRecord,
    openAdd: openPlanModal,
    canOpenNew: () => Boolean(canOpenScheduleActions && canOpenPlan && selected),
    openDelete: openDeleteConfirm,
    canDeleteSelection: () => canDeleteSelection,
    deleteBlockedMessage: "Select a schedule with saved plan data to delete.",
  });

  const extraFilters = useMemo(() => {
    const filters = [
      { label: "Status", key: "status", value: statusFilter, options: statusFilterOptions, variant: "quick" },
      { label: "Report", key: "reportType", value: draftReportType, options: SCHEDULE_REPORT_FILTER_OPTIONS, preserveOrder: false },
    ];
    if (isCustomReport) {
      filters.unshift({
        label: "Month",
        key: "month",
        value: appliedQuery?.month ?? "all",
        options: MONTH_FILTER_OPTIONS,
        preserveOrder: true,
      });
    }
    return filters;
  }, [appliedQuery?.month, draftReportType, isCustomReport, statusFilter, statusFilterOptions]);

  const emptyState = useMemo(() => {
    const st = String(statusFilter ?? SCHEDULE_LIST_FILTER.ALL).toLowerCase();
    const map = {
      [SCHEDULE_LIST_FILTER.PLAN]: {
        message: "No Plan items",
        subMessage: "Planned / Running with remaining balance appear here",
      },
      [SCHEDULE_LIST_FILTER.PENDING]: {
        message: "No Pending items",
        subMessage: "IMS schedules not yet authorized",
      },
      [SCHEDULE_LIST_FILTER.READY_TO_DISPATCH]: {
        message: "No Ready to Dispatch items",
        subMessage: "Authorized — waiting to be planned",
      },
      [SCHEDULE_LIST_FILTER.PENDING_HOLD_REJECT]: {
        message: "No Pending / Hold / Reject items",
        subMessage: "Authorize queue — Pending, Hold, or Reject",
      },
      [SCHEDULE_LIST_FILTER.COMPLETE]: { message: "No completed schedules", subMessage: "Manual Complete or fully dispatched (balance 0) items appear here" },
      [SCHEDULE_LIST_FILTER.COMPARISON]: { message: "No ERP vs DB mismatches", subMessage: "Live ERP matches the DB snapshot saved at plan time" },
      [SCHEDULE_LIST_FILTER.ALL]: {
        message: isCustomReport ? "No schedules in this range" : "No schedule records",
        subMessage: isCustomReport ? "Try a different month or date range (From / To)." : "Try a different status filter",
      },
      [SCHEDULE_LIST_FILTER.REJECT]: { message: "No rejected schedules", subMessage: "Rejected items appear here" },
      [SCHEDULE_LIST_FILTER.HOLD]: { message: "No items on hold", subMessage: "Held schedule items appear here" },
    };
    return map[st] || { message: "No schedule items", subMessage: "Try a different status or date range" };
  }, [statusFilter, isCustomReport]);

  const isComparisonView = String(statusFilter ?? "").toLowerCase() === SCHEDULE_LIST_FILTER.COMPARISON;

  const scheduleHeaders = useMemo(
    () => (isComparisonView ? buildScheduleUniqueComparisonHeaders({ onDrillToItems: drillToItemWise }) : buildScheduleUniqueHeaders({ onDrillToItems: drillToItemWise })),
    [isComparisonView, drillToItemWise]
  );
  const itemWiseHeaders = useMemo(
    () => (isComparisonView
      ? buildScheduleItemWiseComparisonHeaders({ onDrillToItems: drillToItemWise })
      : buildScheduleItemWiseHeaders({ onDrillToItems: drillToItemWise, onViewHistory: handleViewHistory })),
    [isComparisonView, drillToItemWise, handleViewHistory]
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Schedule Planning",
    rows: isScheduleTab ? uniqueSchedules : filteredRows,
    headers: isScheduleTab ? scheduleHeaders : itemWiseHeaders,
  });
  const exportBlocked = exportDisabled;

  const hasSearch = Boolean(String(tempSearch || "").trim());

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                active={pageTab}
                onChange={(id) => {
                  setPageTab(id);
                  setSelected(null);
                  setDisplayLimit(100);
                  if (id === "schedule") setItemWiseSchnoFilter(null);
                }}
                tabs={SCHEDULE_PAGE_TABS}
              />
            }
            actions={
              <>
                <ActionButton
                  module="schedule_planning"
                  action={canAddPlan ? "add" : "authorize"}
                  label={actionButtonLabel}
                  icon={CalendarClock}
                  onClick={openNewModal}
                  disabled={!canOpenPlan || !canOpenScheduleActions}
                  title={
                    canApprovePlan && !canAddPlan
                      ? "Select row(s) → Hold or Ready to Dispatch (same as Plan flow)"
                      : "Select row(s) → Plan / Reject"
                  }
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none"
                />
                <ActionButton
                  module="schedule_planning"
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!canDeleteSelection || removePlanLoading || loading}
                  onClick={openDeleteModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none"
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
                <MasterRefreshButton loading={loading} onClick={() => fetchData()} />
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || exportBlocked}
                onExport={handleExport}
              />
            }
          />

          {itemWiseSchnoFilter && !isScheduleTab ? (
            <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-50 border border-cyan-100">
              <span className="text-[10px] font-bold text-cyan-800 uppercase flex items-center gap-2">
                <Info size={12} /> Showing items for Sch {itemWiseSchnoFilter}
              </span>
              <button
                type="button"
                onClick={() => setItemWiseSchnoFilter(null)}
                className="text-cyan-600 hover:text-cyan-800 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Show all schedules
              </button>
            </div>
          ) : null}
          {selected ? (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-2">
                <Info size={12} /> Selected: Sch {selectedRecord?.schno || "—"} · {selectedRecord?.acc_name || "—"}
                {!isScheduleTab && selectedRecord?.item_code ? ` · ${selectedRecord.item_code}` : ""}
              </span>
              <button type="button" onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={draftReportType}
            fromDate={isCustomReport ? (appliedQuery?.fromDate ?? "") : ""}
            toDate={isCustomReport ? (appliedQuery?.toDate ?? "") : ""}
            dateDisabled={!isCustomReport}
            extraFilters={extraFilters}
            extraFiltersBeforeDate={isCustomReport ? ["month"] : []}
            applyOnSearchEnter={false}
            onExtraFilterChange={(key, value) => {
              if (key === "status") {
                setStatusFilter(value ?? SCHEDULE_LIST_FILTER.ALL);
                setSelected(null);
                setItemWiseSchnoFilter(null);
              }
              if (key === "reportType") setDraftReportType(value ?? SCHEDULE_REPORT_FILTER.DEFAULT);
            }}
            onApply={(data) => {
              const reportType = data.reportType ?? SCHEDULE_REPORT_FILTER.DEFAULT;
              const isCustom = reportType === SCHEDULE_REPORT_FILTER.CUSTOM;
              const month = data.month ?? "all";
              const fromDate = data.fromDate || "";
              const toDate = data.toDate || "";
              const hasMonth = month && String(month).toLowerCase() !== "all";
              const hasDate = Boolean(fromDate.trim()) || Boolean(toDate.trim());

              if (isCustom && !hasMonth && !hasDate) {
                toast.warning("Custom report: select Month or Date (From/To), or both.");
                return;
              }

              setDraftReportType(reportType);
              setAppliedQuery({
                reportType,
                status: SCHEDULE_LIST_FILTER.ALL,
                ...(isCustom
                  ? { month, fromDate: hasDate ? fromDate : "", toDate: hasDate ? toDate : "" }
                  : {}),
              });
              if (data.status != null) {
                setStatusFilter(data.status);
              }
              setSelected(null);
              setItemWiseSchnoFilter(null);
            }}
            onReset={() => {
              setTempSearch("");
              setDraftReportType(SCHEDULE_REPORT_FILTER.DEFAULT);
              setStatusFilter(defaultStatusFilter);
              setAppliedQuery({
                reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
                status: SCHEDULE_LIST_FILTER.ALL,
              });
              setSelected(null);
              setItemWiseSchnoFilter(null);
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder={isScheduleTab ? "Sch no, party, item code..." : "Sch no, party, item, qty..."}
            searchLabel="Quick Search"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            key={pageTab}
            headers={isScheduleTab ? scheduleHeaders : itemWiseHeaders}
            data={displayRows}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            showSelection
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={toggleSort}
            selectedId={selected}
            onSelect={handleSelect}
            onRowDoubleClick={handleRowDoubleClick}
            getRowId={(item) => (isScheduleTab ? scheduleSchnoKey(item) : scheduleItemRowKey(item))}
            getRowClassName={getScheduleListRowClassName}
            emptyIcon={Calendar}
            emptyMessage={hasSearch ? "No matches for your search" : emptyState.message}
            emptySubMessage={hasSearch ? "Try a different search term" : emptyState.subMessage}
            onLoadMore={() => { if (!loading && displayRows.length < activeTotal) setDisplayLimit((n) => n + 100); }}
            hasMore={displayRows.length < activeTotal}
            totalItems={activeTotal}
            {...tableHotkeyProps}
          />
        </div>
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center shrink-0 gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 min-w-0 sm:w-[28%]">
            {hasSearch
              ? `${displayRows.length} of ${activeTotal} matching`
              : `Showing ${displayRows.length} of ${activeTotal} entries`}
            {selected ? " · 1 selected" : ""}
          </span>
          <div className="flex-1 flex justify-center min-w-0 px-1">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {SCHEDULE_LIST_ROW_LEGEND.map(({ swatch, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  <span className={`w-3 h-3 rounded-sm shrink-0 ${swatch}`} aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 sm:w-[28%] justify-end">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <SchedulePlanModal
        open={planModalOpen && canOpenScheduleActions}
        mode={planModalMode}
        onClose={() => setPlanModalOpen(false)}
        schedule={planSchedule}
        itemsLoading={modalItemsLoading}
        canAdd={canAddPlan}
        canApprove={canApprovePlan}
        isSuperAdmin={isSuperAdmin}
        onSaved={() => { void refreshAfterSave(); }}
      />

      <SchedulePlanHistoryModal
        open={Boolean(historyItem)}
        item={historyItem}
        onClose={() => setHistoryItem(null)}
      />

      <SchedulePlanRemoveConfirmModal
        open={removePlanOpen}
        title={removePlanLabel}
        description={removePlanDescription}
        loading={removePlanLoading}
        onClose={() => { if (!removePlanLoading) setRemovePlanOpen(false); }}
        onConfirm={() => void handleRemovePlan()}
      />
    </div>
  );
}
