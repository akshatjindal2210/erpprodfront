"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Loader2, AlertTriangle, LayoutGrid, List, Minimize2, Maximize2 } from "lucide-react";
import { toast } from "react-toastify";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import {
  SearchBar,
  Pagination,
  DeleteModal,
  EmptyState,
  FilterButtonsRecurrence,
} from "@/features/apps/task/common";
import { redTicketService } from "@/features/apps/task/services/redTicketApi";
import { useClTaskFilters } from "@/features/apps/task/hooks/useClTaskFilters";
import { useViewMode } from "@/features/apps/task/hooks/useViewMode";
import { formatTaskUserOptionLabel } from "@/features/apps/task/helpers/utilHelper";
import SearchableSelect from "@/features/apps/task/components/common/SearchableSelect";
import RedTicketTopFilters from "./RedTicketTopFilters";
import RedTicketTableRow from "./RedTicketTableRow";
import RedTicketCard from "./RedTicketCard";

const TABLE_COLS = [
  { label: "#", key: "index" },
  { label: "Person", key: "person_name" },
  { label: "Department", key: "department_name", hideBelow: "md" },
  { label: "Designation", key: "designation_name", hideBelow: "lg" },
  { label: "Description", key: "description" },
  { label: "Score", key: "score_penalty" },
  { label: "Date", key: "ticket_date" },
];

function TicketModal({
  open,
  onClose,
  onSave,
  initial,
  saving,
  departmentsLists,
  designationsLists,
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

  if (!open) return null;

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">
            {initial ? "Edit Red Ticket" : "Create Red Ticket"}
          </h2>
          <p className="text-xs text-rose-600 mt-1">Person, description & score — minus MIS impact</p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Department</label>
              <SearchableSelect
                options={departmentsLists}
                value={form.department_id}
                onChange={(id) => { set("department_id", id); set("person_id", ""); }}
                placeholder="All Departments"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Designation</label>
              <SearchableSelect
                options={designationsLists}
                value={form.designation_id}
                onChange={(id) => { set("designation_id", id); set("person_id", ""); }}
                placeholder="All Designations"
              />
            </div>
          </div>

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
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-rose-400"
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
              onChange={(e) => set("score_penalty", e.target.value)}
              className="mt-1 w-full border border-rose-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400"
              placeholder="e.g. 5"
            />
            <p className="text-[11px] text-rose-500 mt-1">This amount will be deducted from the person&apos;s MIS score.</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !canSave}
            onClick={() => onSave(form)}
            className="px-4 py-2 text-sm font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RedTicketPage() {
  const canAccess = useCanAccess();
  const canView = canAccess("red_ticket", "view").allowed;
  const canAdd = canAccess("red_ticket", "add").allowed;
  const canEdit = canAccess("red_ticket", "edit").allowed;
  const canDelete = canAccess("red_ticket", "delete").allowed;

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

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, handleViewMode] = useViewMode("table");

  const tableContainerRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const fetchItems = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await redTicketService.getAll({
        page,
        limit: pageSize,
        search: search || undefined,
        department_id: selectedDepartment || undefined,
        designation_id: selectedDesignation || undefined,
        person_id: selectedPerson || undefined,
      });
      const data = res.data?.data;
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load red tickets");
    } finally {
      setLoading(false);
    }
  }, [canView, page, pageSize, search, selectedDepartment, selectedDesignation, selectedPerson]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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

  const hasFilter = !!(selectedDepartment || selectedDesignation || selectedPerson || search);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleReset = () => {
    setSearch("");
    setPage(1);
    clearFilters();
  };

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      tableContainerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const openEdit = (row) => {
    setEditItem(row);
    setModalOpen(true);
  };

  if (!canView) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertTriangle className="mx-auto mb-3 text-rose-400" size={32} />
        <p className="font-medium">You do not have permission to view Red Tickets.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-screen text-slate-800">
      <RedTicketTopFilters
        onAdd={() => {
          setEditItem(null);
          setModalOpen(true);
        }}
        canAdd={canAdd}
        departmentsLists={departmentsLists}
        designationsLists={designationsLists}
        personOptions={personOptions}
        selectedDepartment={selectedDepartment}
        selectedDesignation={selectedDesignation}
        selectedPerson={selectedPerson}
        onDepartmentChange={(id) => {
          setSelectedDepartment(id);
          setPage(1);
        }}
        onDesignationChange={(id) => {
          setSelectedDesignation(id);
          setPage(1);
        }}
        onPersonChange={(id) => {
          setSelectedPerson(id);
          setPage(1);
        }}
      />

      <div
        ref={tableContainerRef}
        className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all duration-300 ${
          isFullScreen ? "fixed inset-0 z-[999] rounded-none h-screen w-screen" : ""
        }`}
      >
        <div className={`flex flex-col overflow-hidden ${isFullScreen ? "h-full" : ""}`}>
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 bg-white z-[10]">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              <div className="flex-1 min-w-0">
                <SearchBar
                  value={search}
                  onChange={(val) => {
                    setSearch(val);
                    setPage(1);
                  }}
                  placeholder="Search by person or description…"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 sm:gap-3">
                <FilterButtonsRecurrence onRefresh={fetchItems} onReset={handleReset} accentColor="rose" />

                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shrink-0 shadow-sm">
                  <button
                    type="button"
                    onClick={() => handleViewMode("table")}
                    className={`px-3 py-2.5 transition-all ${
                      viewMode === "table"
                        ? "bg-rose-600 text-white"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    }`}
                    title="Table view"
                  >
                    <List size={15} />
                  </button>
                  <div className="w-px h-5 bg-slate-200" />
                  <button
                    type="button"
                    onClick={() => handleViewMode("card")}
                    className={`px-3 py-2.5 transition-all ${
                      viewMode === "card"
                        ? "bg-rose-600 text-white"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    }`}
                    title="Card view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <div className="w-px h-5 bg-slate-200" />
                  <button
                    type="button"
                    onClick={toggleFullScreen}
                    className="px-3 py-2.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 transition-all"
                    title={isFullScreen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table view */}
          {viewMode === "table" ? (
            <div
              className={
                isFullScreen
                  ? "flex-1 min-h-0 overflow-auto border-t border-slate-100"
                  : "overflow-auto border-t border-slate-100 h-[min(550px,60vh)]"
              }
            >
              <table className="w-full text-sm min-w-[720px] border-separate border-spacing-0">
                <thead className="sticky top-0 z-[5] shadow-sm">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-1 p-0 sticky left-0 z-[5] bg-slate-50 border-b border-slate-200" />
                    {TABLE_COLS.map(({ label, key, hideBelow }, i) => (
                      <th
                        key={key}
                        className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 ${
                          hideBelow === "md" ? "hidden md:table-cell" : ""
                        } ${hideBelow === "lg" ? "hidden lg:table-cell" : ""} ${
                          i === 0
                            ? "sticky left-[5px] z-[5] bg-slate-50 border-r w-8"
                            : i === 1
                              ? "sticky left-[42px] z-[5] bg-slate-50 border-r min-w-[140px]"
                              : "bg-slate-50"
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                    {(canEdit || canDelete) && (
                      <th className="px-3 py-3 w-24 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky right-0 z-[5] bg-slate-50 border-l border-slate-200 border-b">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={TABLE_COLS.length + 1 + (canEdit || canDelete ? 1 : 0)}
                        className="py-16 text-center text-slate-400"
                      >
                        <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                        <p className="text-sm">Loading red tickets…</p>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={TABLE_COLS.length + 1 + (canEdit || canDelete ? 1 : 0)}
                        className="py-16 text-center"
                      >
                        <EmptyState activeTab="" hasFilter={hasFilter} onReset={handleReset} />
                      </td>
                    </tr>
                  ) : (
                    items.map((row, i) => (
                      <RedTicketTableRow
                        key={row.ticket_id}
                        row={row}
                        index={(page - 1) * pageSize + i + 1}
                        onEdit={canEdit ? openEdit : undefined}
                        onDelete={canDelete ? setDeleteItem : undefined}
                        canEdit={canEdit}
                        canDelete={canDelete}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className={
                isFullScreen
                  ? "flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar border-t border-slate-100"
                  : "overflow-y-auto p-4 custom-scrollbar border-t border-slate-100 min-h-[320px] max-h-[min(60vh,600px)]"
              }
            >
              {loading ? (
                <div className="py-16 text-center text-slate-400">
                  <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                  <p className="text-sm">Loading red tickets…</p>
                </div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center">
                  <EmptyState activeTab="" hasFilter={hasFilter} onReset={handleReset} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map((row, i) => (
                    <RedTicketCard
                      key={row.ticket_id}
                      row={row}
                      index={(page - 1) * pageSize + i + 1}
                      onEdit={canEdit ? openEdit : undefined}
                      onDelete={canDelete ? setDeleteItem : undefined}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-shrink-0 mt-auto border-t border-slate-100">
            <Pagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      <TicketModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
        }}
        onSave={handleSave}
        initial={editItem}
        saving={saving}
        departmentsLists={departmentsLists}
        designationsLists={designationsLists}
        allUsers={allUsers}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={fetchItems}
        service={redTicketService}
        entityLabel="Red Ticket"
        idKey="ticket_id"
        nameKey="person_name"
        warningMessage="This will permanently remove the red ticket and reverse the MIS score penalty."
      />
    </div>
  );
}
