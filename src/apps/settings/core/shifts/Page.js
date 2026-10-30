"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCcw, Clock, Edit3, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import ActionButton from "@/ui/primitives/ActionButton";
import DataTable from "@/ui/primitives/DataTable";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import AppListFooter from "@/ui/common/list/listPageFooter";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { ROUTES } from "@/apps/settings/configuration/utils/routes";
import { shiftService } from "@/apps/settings/lib/services/shiftService";
import { formatShiftTime } from "@/apps/settings/lib/utils/shiftTimeFormat";
import ShiftModal from "@/apps/settings/core/shifts/ShiftModal";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { sortRowsByKey } from "@/platform/utils/list/listSearch";

function StatusToggle({ active, onToggle, disabled }) {
  return (
    <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-200 disabled:opacity-50 ${
          active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ${
            active ? "translate-x-4" : "translate-x-1"
          }`}
        />
      </button>
      <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-emerald-600" : "text-slate-400"}`}>
        {active ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

export default function ShiftsPage() {
  const router = useRouter();
  const role = useSelector((s) => s.auth?.role);
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const isSuperAdmin = normalizedRole === "super_admin";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [sortKey, setSortKey] = useState("code");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    if (role && !isSuperAdmin) router.replace(ROUTES.SETTINGS_DASHBOARD);
  }, [role, isSuperAdmin, router]);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shiftService.getAll({
        page: 1,
        limit: 5000,
        sortBy: sortKey || "code",
        order: sortDir.toUpperCase(),
      });
      setRows(res?.data ?? []);
    } catch (err) {
      toast.error(err?.message || "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sortKey, sortDir]);

  useEffect(() => {
    if (isSuperAdmin) fetchShifts();
  }, [fetchShifts, isSuperAdmin]);

  const displayRows = useMemo(() => sortRowsByKey(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

  const selectedRow = useMemo(() => rows.find((r) => r.id === selected), [rows, selected]);

  const getSelectedRow = useCallback(() => rows.find((r) => r.id === selected), [rows, selected]);

  const openAdd = useCallback(() => {
    setEditItem(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    setEditItem(row || selectedRow);
    setModalOpen(true);
  }, [selectedRow]);

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "shifts",
    modalOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd,
    openEdit,
  });

  const handleToggle = async (row) => {
    setBusyId(row.id);
    try {
      const res = await shiftService.toggleStatus(row.id);
      const updated = res?.data;
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, ...(updated || { is_active: !r.is_active }) } : r))
      );
    } catch (err) {
      toast.error(err?.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const headers = [
    [
      "Code",
      "code",
      (v) => <span className="font-mono text-xs font-bold uppercase tracking-wide text-slate-800">{v}</span>,
    ],
    [
      "Start",
      "start_time",
      (v) => <span className="text-xs tabular-nums text-slate-600">{formatShiftTime(v)}</span>,
      { width: "110px" },
    ],
    [
      "End",
      "end_time",
      (v, row) => (
        <span className="text-xs tabular-nums text-slate-600">
          {formatShiftTime(v)}
          {row?.overnight ? <span className="ml-1 text-[9px] font-bold uppercase text-indigo-600">+1</span> : null}
        </span>
      ),
      { width: "120px" },
    ],
    [
      "Hours",
      "hours",
      (v, row) => (
        <span className="text-xs font-bold tabular-nums text-slate-700">
          {v != null ? `${v}h` : "—"}
          {row?.lunch ? <span className="ml-1 text-[9px] font-bold text-slate-400">L</span> : null}
        </span>
      ),
      { width: "80px" },
    ],
    [
      "Status",
      "is_active",
      (v, row) => (
        <StatusToggle active={!!v} disabled={busyId === row.id} onToggle={() => handleToggle(row)} />
      ),
      { align: "center", width: "120px" },
    ],
  ];

  if (!isSuperAdmin) return null;

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <ActionButton
                module="shifts"
                action="add"
                label="New"
                icon={Plus}
                onClick={openNewModal}
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none border-slate-300"
              />
              <ActionButton
                module="shifts"
                action="edit"
                variant="outline"
                label="Edit"
                icon={Edit3}
                disabled={selected === null}
                record={selectedRow}
                onClick={openEditModal}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none"
              />
              <ActionButton
                module="shifts"
                action="delete"
                variant="danger"
                label="Delete"
                icon={Trash2}
                disabled={selected === null}
                record={selectedRow}
                onClick={() => setDeleteItem(selectedRow)}
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none"
              />

              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={fetchShifts}
                className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none"
              >
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
          <DataTable
            headers={headers}
            getRowId={(row) => row.id}
            data={displayRows}
            loading={loading}
            viewMode="table"
            allowCopy
            {...tableHotkeyProps}
            showSelection
            emptyIcon={Clock}
            emptyMessage="No shifts found"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(key) => {
              setSortKey(key);
              setSortDir((d) => (sortKey === key && d === "asc" ? "desc" : "asc"));
            }}
            selectedId={selected}
            onSelect={setSelected}
            onRowDoubleClick={(row) => openEdit(row)}
            totalItems={displayRows.length}
          />
        </div>

        <AppListFooter
          shown={displayRows.length}
          total={displayRows.length}
          noun="Shifts"
          selected={selected}
          selectedRecord={selectedRow}
          selectionLabel={(r) => `Selected: ${r?.code ?? "—"}`}
          onClearSelection={() => setSelected(null)}
        />
      </div>

      {modalOpen && (
        <ShiftModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditItem(null);
          }}
          onSuccess={fetchShifts}
          editData={editItem}
        />
      )}

      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            fetchShifts();
            setSelected(null);
          }}
          service={shiftService}
          entityLabel="Shift"
          nameKey="code"
        />
      )}
    </div>
  );
}
