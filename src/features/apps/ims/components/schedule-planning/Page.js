"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CalendarClock, Info, X, Calendar, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import ActionButton from "@/core/components/ui/ActionButton";
import DataTable from "@/core/components/ui/DataTable";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { useViewMode } from "@/core/hooks/useViewMode";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ImsSegmentedTabs from "@/features/apps/ims/components/common/ImsSegmentedTabs";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { applyClientSearch, sortRowsByKey, nextSortParams } from "@/features/apps/ims/helpers/clientListSearch";
import { schedulePlanningService } from "@/features/apps/ims/services/schedulePlanning";
import { SCHEDULE_LIST_FILTER, canOpenPlanModal, SCHEDULE_REPORT_FILTER } from "./schedulePlanStatus";
import { SCHEDULE_PAGE_TABS, MONTH_FILTER_OPTIONS, currentScheduleMonthValue, SCHEDULE_STATUS_FILTER_OPTIONS, SCHEDULE_REPORT_FILTER_OPTIONS, scheduleItemRowKey, scheduleSchnoKey, canDeleteRow, scheduleItemWiseSearchParts,
  scheduleUniqueSearchParts, toUniqueScheduleRows, SCHEDULE_UNIQUE_HEADERS, buildScheduleUniqueHeaders, buildScheduleItemWiseHeaders, buildScheduleItemWiseComparisonHeaders, buildScheduleUniqueComparisonHeaders } from "./schedulePlanningColumns";
import SchedulePlanModal from "./SchedulePlanModal";
import SchedulePlanHistoryModal from "./SchedulePlanHistoryModal";
import SchedulePlanRemoveConfirmModal from "./SchedulePlanRemoveConfirmModal";
import { MasterListFooter, MasterRefreshButton } from "../../helpers/masterListUi";

function buildScheduleListFilters(query) {
  const reportType = String(query?.reportType ?? SCHEDULE_REPORT_FILTER.DEFAULT).toLowerCase();
  const body = {
    reportType,
    status: query?.status ?? SCHEDULE_LIST_FILTER.PENDING,
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
  const viewAccess = useMemo(() => canAccess("schedule_planning", "view"), [canAccess]);
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);
  const [viewMode, handleViewMode] = useViewMode();

  const [pageTab, setPageTab] = useState("schedule");
  const [itemWiseSchnoFilter, setItemWiseSchnoFilter] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [tempSearch, setTempSearch] = useState("");
  const [params, setParams] = useState({ sortKey: "", sortDir: "asc" });
  const [appliedQuery, setAppliedQuery] = useState(null);
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

  const canRemovePlan = useMemo(() => canAccess("schedule_planning", "delete").allowed, [canAccess]);
  const canAddPlan = useMemo(() => canAccess("schedule_planning", "add").allowed, [canAccess]);

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    if (initialQuerySet.current) return;
    initialQuerySet.current = true;
    setAppliedQuery({
      reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
      status: SCHEDULE_LIST_FILTER.PENDING,
      month: currentScheduleMonthValue(),
    });
    setDraftReportType(SCHEDULE_REPORT_FILTER.DEFAULT);
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const isCustomReport = String(draftReportType) === SCHEDULE_REPORT_FILTER.CUSTOM;

  const fetchData = useCallback(async () => {
    if (!appliedQuery) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await schedulePlanningService.list(buildScheduleListFilters(appliedQuery));
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
  }, [appliedQuery]);

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
    const scheduleItems = modalScheduleItems;
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
  }, [selectedRecord, planModalOpen, modalScheduleItems, modalItemsLoading]);

  const canOpenPlan = Boolean(canOpenPlanModal(appliedQuery?.status) && selectedRecord);

  const deleteSchno = selectedRecord ? scheduleSchnoKey(selectedRecord) : "";

  const canDeleteSelection = useMemo(() => {
    if (!deleteSchno) return false;
    const schedule = uniqueSchedules.find((row) => scheduleSchnoKey(row) === deleteSchno);
    if (schedule && canDeleteRow(schedule)) return true;
    return rows.some((row) => scheduleSchnoKey(row) === deleteSchno && canDeleteRow(row));
  }, [deleteSchno, uniqueSchedules, rows]);

  const deleteItemCount = useMemo(() => {
    if (!deleteSchno) return 0;
    const schedule = uniqueSchedules.find((row) => scheduleSchnoKey(row) === deleteSchno);
    if (schedule?.item_count) return Number(schedule.item_count) || 0;
    return rows.filter((row) => scheduleSchnoKey(row) === deleteSchno).length;
  }, [deleteSchno, uniqueSchedules, rows]);

  const openPlanModal = useCallback(() => {
    if (!canAddPlan) return;
    if (!canOpenPlan) {
      toast.info(isScheduleTab ? "Select a pending schedule row to plan." : "Select a pending item row to plan.");
      return;
    }
    setPlanModalMode("plan");
    setPlanModalOpen(true);
  }, [canAddPlan, canOpenPlan, isScheduleTab]);

  const handleRowDoubleClick = useCallback(
    (_item, id) => {
      if (!canAddPlan) return;
      if (!canOpenPlanModal(appliedQuery?.status)) return;
      setSelected(id);
      setPlanModalMode("plan");
      setPlanModalOpen(true);
    },
    [canAddPlan, appliedQuery?.status]
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

  const removePlanLabel = deleteSchno
    ? `Sch No ${deleteSchno} (${deleteItemCount || 0} items)`
    : "";

  const handleRemovePlan = useCallback(async () => {
    if (!canRemovePlan || !deleteSchno || !canDeleteSelection) return;
    setRemovePlanLoading(true);
    try {
      const res = await schedulePlanningService.remove({ schno: deleteSchno });
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
  }, [canRemovePlan, deleteSchno, canDeleteSelection, fetchData]);

  const openDeleteConfirm = useCallback(() => {
    if (!selected || !deleteSchno) return;
    if (!canDeleteSelection) {
      toast.info("Select a schedule with saved plan data to delete.");
      return;
    }
    setRemovePlanOpen(true);
  }, [selected, deleteSchno, canDeleteSelection]);

  const { openNewModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "schedule_planning",
    modalOpen: planModalOpen || removePlanOpen || Boolean(historyItem),
    selectedId: selected,
    getSelectedRow: () => selectedRecord,
    openAdd: openPlanModal,
    canOpenNew: () => Boolean(canOpenPlan && selected),
    openDelete: openDeleteConfirm,
    canDeleteSelection: () => canDeleteSelection,
    deleteBlockedMessage: "Select a schedule with saved plan data to delete.",
  });

  const extraFilters = useMemo(
    () => [
      { label: "Month", key: "month", value: isCustomReport ? (appliedQuery?.month ?? "all") : (appliedQuery?.month ?? currentScheduleMonthValue()), options: MONTH_FILTER_OPTIONS, preserveOrder: true, disabled: !isCustomReport },
      { label: "Status", key: "status", value: appliedQuery?.status ?? SCHEDULE_LIST_FILTER.PENDING, options: SCHEDULE_STATUS_FILTER_OPTIONS },
      { label: "Report", key: "reportType", value: draftReportType, options: SCHEDULE_REPORT_FILTER_OPTIONS, preserveOrder: false },
    ],
    [appliedQuery?.month, appliedQuery?.status, draftReportType, isCustomReport]
  );

  const emptyState = useMemo(() => {
    const st = String(appliedQuery?.status ?? SCHEDULE_LIST_FILTER.PENDING).toLowerCase();
    const map = {
      [SCHEDULE_LIST_FILTER.SCHEDULE]: { message: "No active schedules", subMessage: "Planned / running rows saved in database" },
      [SCHEDULE_LIST_FILTER.COMPLETE]: { message: "No completed schedules", subMessage: "Finished schedules appear here" },
      [SCHEDULE_LIST_FILTER.COMPARISON]: { message: "No IMS vs DB mismatches", subMessage: "Live IMS matches the DB snapshot saved at plan time" },
      [SCHEDULE_LIST_FILTER.ALL]: { message: "No schedule records", subMessage: "Try a different date range or month" },
      [SCHEDULE_LIST_FILTER.REJECT]: { message: "No rejected schedules", subMessage: "Rejected from Pending tab" },
      [SCHEDULE_LIST_FILTER.HOLD]: { message: "No items on hold", subMessage: "Held schedule items appear here" },
    };
    return map[st] || { message: "No pending schedule items", subMessage: "IMS rows not yet entered in database" };
  }, [appliedQuery?.status]);

  const isComparisonView = String(appliedQuery?.status ?? "").toLowerCase() === SCHEDULE_LIST_FILTER.COMPARISON;

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
                  action="add"
                  label="Plan"
                  icon={CalendarClock}
                  onClick={openNewModal}
                  disabled={!canOpenPlan}
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
            fromDate={isCustomReport ? (appliedQuery?.fromDate ?? dateFilterDefaults.from) : ""}
            toDate={isCustomReport ? (appliedQuery?.toDate ?? dateFilterDefaults.to) : ""}
            dateDisabled={!isCustomReport}
            extraFilters={extraFilters}
            extraFiltersBeforeDate={["month"]}
            applyOnSearchEnter={false}
            onExtraFilterChange={(key, value) => {
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
                status: data.status ?? SCHEDULE_LIST_FILTER.PENDING,
                ...(isCustom
                  ? { month, fromDate: hasDate ? fromDate : "", toDate: hasDate ? toDate : "" }
                  : { month: currentScheduleMonthValue() }),
              });
              setSelected(null);
              setItemWiseSchnoFilter(null);
            }}
            onReset={() => {
              setTempSearch("");
              setDraftReportType(SCHEDULE_REPORT_FILTER.DEFAULT);
              setAppliedQuery({
                reportType: SCHEDULE_REPORT_FILTER.DEFAULT,
                status: SCHEDULE_LIST_FILTER.PENDING,
                month: currentScheduleMonthValue(),
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
            emptyIcon={Calendar}
            emptyMessage={hasSearch ? "No matches for your search" : emptyState.message}
            emptySubMessage={hasSearch ? "Try a different search term" : emptyState.subMessage}
            onLoadMore={() => { if (!loading && displayRows.length < activeTotal) setDisplayLimit((n) => n + 100); }}
            hasMore={displayRows.length < activeTotal}
            totalItems={activeTotal}
            {...tableHotkeyProps}
          />
        </div>
        <MasterListFooter shown={displayRows.length} total={activeTotal} noun="entries" />
      </div>

      <SchedulePlanModal
        open={planModalOpen && canAddPlan}
        mode={planModalMode}
        onClose={() => setPlanModalOpen(false)}
        schedule={planSchedule}
        itemsLoading={modalItemsLoading}
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
        description="All items and history for this Sch No will be permanently deleted."
        loading={removePlanLoading}
        onClose={() => { if (!removePlanLoading) setRemovePlanOpen(false); }}
        onConfirm={() => void handleRemovePlan()}
      />
    </div>
  );
}
