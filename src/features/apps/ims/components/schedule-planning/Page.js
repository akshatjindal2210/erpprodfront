"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Edit3, Trash2, Calendar, Truck, X } from "lucide-react";
import { toast } from "react-toastify";

import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import DataTable from "@/core/components/ui/DataTable";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ImsSegmentedTabs from "@/features/apps/ims/components/common/ImsSegmentedTabs";
import ActionButton from "@/core/components/ui/ActionButton";
import DeleteModal from "@/core/components/common/DeleteModal";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useViewMode } from "@/core/hooks/useViewMode";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";

import { SCHEDULE_PLANNING_HEADERS, SCHEDULE_PLANNING_TABS, MOCK_SCHEDULE_DATA, SCHEDULE_PLANNING_CARD_CONFIG } from "./schedulePlanningColumns";
import SchedulePlanningModal from "./SchedulePlanningModal";

// Mock Service for DeleteModal
const mockScheduleService = {
  delete: async (id) => {
    console.log("MOCK DELETE API CALL for ID:", id);
    return { success: true, message: "Record deleted successfully (Mock)" };
  }
};

export default function SchedulePlanningPage() {
  const [activeTab, setActiveTab] = useState("register");
  const [loading, setLoading] = useState(false);
  const [viewMode, handleViewMode] = useViewMode();
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [isDeleting, setIsDeleting] = useState(false);
  const [allRows, setAllRows] = useState(MOCK_SCHEDULE_DATA);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Simulate API call delay
    setTimeout(() => {
      setAllRows(MOCK_SCHEDULE_DATA);
      setLoading(false);
    }, 400);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    if (activeTab === "dispatch") {
      return allRows.filter(row => row.status === "Planned" || row.planned_qty > 0);
    }
    return allRows;
  }, [allRows, activeTab]);

  const selectedRecord = useMemo(
    () => filteredRows.find((row) => String(row.id) === selectedId) || null,
    [filteredRows, selectedId]
  );

  const openModal = useCallback((mode) => {
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const getSelectedRow = useCallback(() => selectedRecord, [selectedRecord]);

  // Using global hotkeys and action handlers
  const { openNewModal, openEditModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "schedule_planning",
    modalOpen: modalOpen || isDeleting,
    selectedId,
    getSelectedRow,
    openAdd: useCallback(() => openModal("add"), [openModal]),
    openEdit: useCallback(() => openModal("edit"), [openModal]),
    openDelete: useCallback(() => setIsDeleting(true), []),
    canEditSelection: useCallback(() => !!selectedId, [selectedId]),
    canDeleteSelection: useCallback(() => !!selectedId, [selectedId]),
    // New is only allowed if a row is selected (as per user request)
    canOpenNew: useCallback(() => !!selectedId, [selectedId]),
    newBlockedMessage: "Please select a row to create a new plan",
  });

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Schedule Planning",
    rows: filteredRows,
    headers: SCHEDULE_PLANNING_HEADERS,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                className="mr-2"
                active={activeTab}
                onChange={(id) => {
                  setActiveTab(id);
                  setSelectedId(null);
                }}
                tabs={SCHEDULE_PLANNING_TABS}
              />
            }
            actions={
              <>
                <ActionButton
                  module="schedule_planning"
                  action="add"
                  label="New"
                  icon={Plus}
                  disabled={!selectedId}
                  onClick={openNewModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                
                <ActionButton
                  module="schedule_planning"
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={!selectedId}
                  record={selectedRecord}
                  onClick={openEditModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />

                <ActionButton
                  module="schedule_planning"
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selectedId}
                  onClick={openDeleteModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />

                <button
                  type="button"
                  onClick={() => fetchData()}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shrink-0"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || exportDisabled}
                onExport={handleExport}
              />
            }
          />

          {selectedId && selectedRecord ? (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase truncate max-w-[min(100%,36rem)]">
                Selected: #{selectedRecord.id}
                {selectedRecord.item_code ? ` · ${selectedRecord.item_code}` : ""}
                {selectedRecord.customer_name ? ` · ${selectedRecord.customer_name}` : ""}
                {selectedRecord.order_qty != null
                  ? ` · Order ${Number(selectedRecord.order_qty).toLocaleString()} qty`
                  : ""}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
                >
                  <X size={14} /> Clear
                </button>
              </div>
            </div>
          ) : null}
        </ListPageToolbar>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={SCHEDULE_PLANNING_HEADERS}
            data={filteredRows}
            allowCopy
            loading={loading}
            viewMode={viewMode}
            {...tableHotkeyProps}
            selectedId={selectedId}
            onSelect={setSelectedId}
            getRowId={(row) => String(row.id)}
            idKey="id"
            emptyMessage={activeTab === "register" ? "No schedule records found" : "No dispatch plans for today"}
            emptyIcon={activeTab === "register" ? Calendar : Truck}
            cardConfig={SCHEDULE_PLANNING_CARD_CONFIG}
          />
        </div>
      </div>

      <SchedulePlanningModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editData={selectedRecord}
        mode={modalMode}
      />

      {isDeleting && (
        <DeleteModal
          item={selectedRecord}
          onClose={() => setIsDeleting(false)}
          onSuccess={() => {
            fetchData();
            setSelectedId(null);
            setIsDeleting(false);
            toast.success("Record deleted successfully");
          }}
          service={mockScheduleService}
          entityLabel="Schedule Plan"
          idKey="id"
          titleKey="item_code"
          moduleSlug="schedule_planning"
        />
      )}
    </div>
  );
}
