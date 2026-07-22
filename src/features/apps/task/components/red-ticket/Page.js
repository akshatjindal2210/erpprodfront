"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, RefreshCcw, Edit3, X, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useViewMode } from "@/core/hooks/useViewMode";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_TEXT } from "@/features/apps/ims/helpers/listPageShellClasses";
import { applyClientSearch, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { useAppliedListSearch } from "@/features/apps/ims/helpers/useAppliedListSearch";

import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import DataTable from "@/core/components/ui/DataTable";
import ActionButton from "@/core/components/ui/ActionButton";

import { redTicketService } from "@/features/apps/task/services/redTicketApi";
import { useClTaskFilters } from "@/features/apps/task/hooks/useClTaskFilters";
import { formatTaskUserOptionLabel, formatDateTime } from "@/features/apps/task/helpers/utilHelper";
import { filterRowsByViewDays, isOutsidePermissionDays } from "@/core/utils/permissionDays";
import { editTimeBlockedByAccess } from "@/core/hooks/useListDrawerHotkeys";
import SearchableSelect from "@/features/apps/task/components/common/SearchableSelect";
import DeleteModal from "@/features/apps/task/components/common/DeleteModal";
import Drawer from "@/core/components/ui/Drawer";

function TicketDrawer({
  open,
  onClose,
  onSave,
  initial,
  saving,
  allUsers,
}) {
  const [form, setForm] = useState({
    department_id: "",
    designation_id: "",
    person_id: "",
    description: "",
    score_penalty: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      department_id: initial?.department_id ? String(initial.department_id) : "",
      designation_id: initial?.designation_id ? String(initial.designation_id) : "",
      person_id: initial?.person_id ? String(initial.person_id) : "",
      description: initial?.description ?? "",
      score_penalty: initial?.score_penalty != null ? String(initial.score_penalty) : "",
    });
  }, [open, initial]);

  const modalPersonOptions = useMemo(() => {
    let users = allUsers ?? [];
    if (form.department_id) {
      users = users.filter((u) => Number(u.department?.id) === Number(form.department_id));
    }
    if (form.designation_id) {
      users = users.filter((u) => Number(u.designation?.id) === Number(form.designation_id));
    }
    return users.map((u) => ({ id: u.id, name: formatTaskUserOptionLabel(u) }));
  }, [allUsers, form.department_id, form.designation_id]);

  const handlePersonChange = (personId) => {
    const user = (allUsers ?? []).find((u) => String(u.id) === String(personId));
    setForm((p) => ({
      ...p,
      person_id: personId,
      department_id: user?.department?.id ? String(user.department.id) : p.department_id,
      designation_id: user?.designation?.id ? String(user.designation.id) : p.designation_id,
    }));
  };

  const canSave =
    form.person_id &&
    form.description.trim() &&
    form.score_penalty !== "" &&
    Number(form.score_penalty) > 0;

  const handleSubmit = () => {
    if (!canSave || saving) return;
    onSave(form);
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      closeOnOutside={false}
      title={initial ? "Edit Red Ticket" : "Create Red Ticket"}
      description="Person, description & score — minus MIS impact"
      headerVariant="form"
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !canSave}
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-500">Person *</label>
          <SearchableSelect
            options={modalPersonOptions}
            value={form.person_id}
            onChange={handlePersonChange}
            placeholder="Select person"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={5}
            className="mt-1 w-full border border-slate-200 rounded-none px-3 py-2 text-sm outline-none resize-none focus:border-rose-400"
            placeholder="What happened? Full details of the red ticket…"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Score Penalty (minus MIS) *</label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.score_penalty}
            onChange={(e) => setForm((p) => ({ ...p, score_penalty: e.target.value }))}
            className="mt-1 w-full border border-rose-200 rounded-none px-3 py-2 text-sm focus:border-rose-400"
            placeholder="e.g. 5"
          />
          <p className="text-[11px] text-rose-500 mt-1">This amount will be deducted from the person&apos;s MIS score.</p>
        </div>
      </div>
    </Drawer>
  );
}

export default function RedTicketPage() {
  const canAccess = useCanAccess();
  const canView = canAccess("red_ticket", "view").allowed;
  const canAdd = canAccess("red_ticket", "add").allowed;
  const canEdit = canAccess("red_ticket", "edit").allowed;
  const canDelete = canAccess("red_ticket", "delete").allowed;
  const viewAccess = canAccess("red_ticket", "view");
  const editAccess = canAccess("red_ticket", "edit");

  const {
    selectedDepartment,
    setSelectedDepartment,
    selectedDesignation,
    setSelectedDesignation,
    selectedPerson,
    setSelectedPerson,
    departmentsLists,
    designationsLists,
    personOptions,
    allUsers,
    clearFilters,
  } = useClTaskFilters();

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const [params, setParams] = useState({
    pageSize: 1000,
    sortKey: "ticket_id",
    sortDir: "desc",
  });

  const fetchItems = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Broad list once — dept / desig / person filtered on the frontend.
      // Server search only when Search/Enter applies a query.
      const res = await redTicketService.getAll({
        page: 1,
        limit: params.pageSize,
        ...(appliedSearch ? { search: appliedSearch } : {}),
      });
      const data = res.data?.data;
      const list = data?.items ?? data ?? [];
      setAllRows(Array.isArray(list) ? list : []);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load red tickets");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, params.pageSize, appliedSearch]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredRows = useMemo(() => {
    let data = filterRowsByViewDays(allRows, viewAccess.days, [
      "created_at",
      "ticket_date",
      "updated_at",
    ]);
    if (selectedDepartment) {
      data = data.filter((r) => Number(r.department_id) === Number(selectedDepartment));
    }
    if (selectedDesignation) {
      data = data.filter((r) => Number(r.designation_id) === Number(selectedDesignation));
    }
    if (selectedPerson) {
      data = data.filter((r) => Number(r.person_id) === Number(selectedPerson));
    }
    const q = String(tempSearch || "").trim();
    if (q) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [
    allRows,
    tempSearch,
    params.sortKey,
    params.sortDir,
    viewAccess.days,
    selectedDepartment,
    selectedDesignation,
    selectedPerson,
  ]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const selectedRecord = useMemo(
    () => filteredRows.find((r) => r.ticket_id === selected) || null,
    [filteredRows, selected],
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((r) => r.ticket_id === selected),
    [filteredRows, selected],
  );

  const openNewModal = useCallback(() => {
    setEditItem(null);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((row) => {
    if (!canEdit || !row) return;
    if (editTimeBlockedByAccess(row, editAccess)) {
      toast.info(`Edit time limit exceeded (${editAccess.days} days)`);
      return;
    }
    setEditItem(row);
    setModalOpen(true);
  }, [canEdit, editAccess]);

  const openDeleteModal = useCallback((row) => setDeleteItem(row), []);

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: "red_ticket",
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: canAdd ? openNewModal : undefined,
    openEdit: canEdit ? openEditModal : undefined,
    openDelete: canDelete ? openDeleteModal : undefined,
    canDeleteSelection: useCallback(() => !!selected && canDelete, [selected, canDelete]),
  });

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = {
        description: form.description.trim(),
        department_id: form.department_id || null,
        designation_id: form.designation_id || null,
        person_id: form.person_id || null,
        score_penalty: Number(form.score_penalty),
        ticket_date: new Date().toISOString().slice(0, 10),
        priority: "high",
        status: editItem?.status ?? "open",
      };
      if (editItem) {
        await redTicketService.update(editItem.ticket_id, payload);
        toast.success("Red ticket updated");
      } else {
        await redTicketService.create(payload);
        toast.success("Red ticket created — MIS score updated");
      }
      setModalOpen(false);
      setEditItem(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleFilterApply = (data = {}) => {
    if (data.searchSubmit) {
      applySearchFromInput();
    }
    setSelectedDepartment(data.department_id || "");
    setSelectedDesignation(data.designation_id || "");
    setSelectedPerson(data.person_id || "");
    setDisplayLimit(100);
    setSelected(null);
  };

  const handleReset = () => {
    resetSearch();
    clearFilters();
    setSelected(null);
    setDisplayLimit(100);
    setParams({ pageSize: 1000, sortKey: "ticket_id", sortDir: "desc" });
  };

  const getRedTicketRowClassName = useCallback(
    () => "[&_td]:!bg-rose-50/70 hover:[&_td]:!bg-rose-50",
    [],
  );

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const extraFilters = useMemo(
    () => [
      {
        label: "Department",
        key: "department_id",
        value: selectedDepartment || "",
        searchable: true,
        placeholder: "Search departments…",
        variant: "quick",
        options: [
          { label: "All Departments", value: "" },
          ...departmentsLists.map((d) => ({ label: d.name, value: String(d.id) })),
        ],
      },
      {
        label: "Designation",
        key: "designation_id",
        value: selectedDesignation || "",
        searchable: true,
        placeholder: "Search designations…",
        variant: "quick",
        options: [
          { label: "All Designations", value: "" },
          ...designationsLists.map((d) => ({ label: d.name, value: String(d.id) })),
        ],
      },
      {
        label: "Users",
        key: "person_id",
        value: selectedPerson || "",
        searchable: true,
        placeholder: "Search users…",
        variant: "quick",
        options: [
          { label: "All Users", value: "" },
          ...personOptions.map((p) => ({ label: p.name, value: String(p.id) })),
        ],
      },
    ],
    [selectedDepartment, selectedDesignation, selectedPerson, departmentsLists, designationsLists, personOptions],
  );

  const HEADERS = [
    ["#", "ticket_id", (_v, _row, i) => <span className={IMS_TABLE_CELL_TEXT}>{i + 1}</span>, { fixed: true, width: "50px", align: "center" }],
    ["Person", "person_name", (v) => <span className="font-bold text-slate-800 text-[11px] uppercase tracking-tight">{v || "—"}</span>, { width: "140px" }],
    ["Department", "department_name", (v) => <span className={IMS_TABLE_CELL_TEXT}>{v || "—"}</span>, { width: "130px" }],
    ["Designation", "designation_name", (v) => <span className={IMS_TABLE_CELL_TEXT}>{v || "—"}</span>, { width: "130px" }],
    ["Description", "description", (v) => (
      <span className={`${IMS_TABLE_CELL_TEXT} line-clamp-2`} title={v || ""}>{v || "—"}</span>
    ), { width: "260px" }],
    ["Score", "score_penalty", (v) => (
      <span className="text-[11px] font-black text-rose-600 tabular-nums">−{v ?? "—"}</span>
    ), { width: "80px", align: "center" }],
    ["Date", "ticket_date", (v) => <span className={IMS_TABLE_CELL_DATE}>{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className={IMS_TABLE_CELL_DATE}>{v ? formatDateTime(v) : "—"}</span>, { width: "150px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Red Ticket",
    rows: filteredRows,
    headers: HEADERS,
  });

  if (!canView) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertTriangle className="mx-auto mb-3 text-rose-400" size={32} />
        <p className="font-medium">You do not have permission to view Red Tickets.</p>
      </div>
    );
  }

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <ActionButton
                  module="red_ticket"
                  action="add"
                  label="New"
                  icon={Plus}
                  onClick={openNewModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <ActionButton
                  module="red_ticket"
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={!selectedRecord || isOutsidePermissionDays(selectedRecord, editAccess.days)}
                  record={selectedRecord}
                  onClick={() => openEditModal(selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module="red_ticket"
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selectedRecord}
                  onClick={() => setDeleteItem(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={fetchItems}
                  disabled={loading}
                  className="h-9 shrink-0 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center disabled:opacity-60"
                  aria-label="Refresh"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
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

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">
                Selected: {selectedRecord?.person_name || `#${selected}`}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
            <DateRangeFilter
            showDate={false}
            applyExtrasOnChange
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchVariant="quick"
            searchPlaceholder="Search person or description..."
            searchLabel="Filter Red Tickets"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            showSelection
            idKey="ticket_id"
            getRowId={(row) => row.ticket_id}
            selectedId={selected}
            onSelect={setSelected}
            emptyIcon={AlertTriangle}
            getRowClassName={getRedTicketRowClassName}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={(key) => {
              setDisplayLimit(100);
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }));
            }}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            {...tableHotkeyProps}
            cardConfig={{
              titleKey: "person_name",
              badgeIndices: [5],
              detailIndices: [2, 3, 4],
              footerKey: "ticket_date",
              className: "rounded-none border border-rose-200 bg-rose-50/40 shadow-none",
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Red Tickets
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <TicketDrawer
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
        }}
        onSave={handleSave}
        initial={editItem}
        saving={saving}
        allUsers={allUsers}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          fetchItems();
          setSelected(null);
        }}
        service={redTicketService}
        entityLabel="Red Ticket"
        idKey="ticket_id"
        nameKey="person_name"
        warningMessage="This will permanently remove the red ticket and reverse the MIS score penalty."
      />
    </div>
  );
}
