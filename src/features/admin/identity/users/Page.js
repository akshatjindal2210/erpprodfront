"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Users, RefreshCcw, Edit3, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime, getInitials } from "@/core/utils/utilHelper";
import { userService } from "@/features/shared/auth/services/userService";

import ActionButton from "@/core/components/ui/ActionButton";
import ViewToggle from "@/core/components/ui/ViewToggle";
import DeleteModal from "@/core/components/common/DeleteModal";
import DataTable from "@/core/components/ui/DataTable";
import UserModal from "./UserModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import { useViewMode } from "@/core/hooks/useViewMode";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, sortRowsByKey, fetchAllListPages } from "@/core/utils/listSearch";

import { USER_STATUS_CONFIG, USER_TYPE_CONFIG, getAvatarColor, ROLE_LABELS, TYPES, USER_STATUSES } from "@/core/components/common/Constants";

function matchesRoleStatus(row, roleFilter, statusFilter) {
  if (roleFilter && roleFilter !== "all" && row.type !== roleFilter) return false;
  if (statusFilter && statusFilter !== "all" && row.status !== statusFilter) return false;
  return true;
}

function isPendingRecordId(id) {
  return id != null && String(id).startsWith("pending_");
}

function avatarKey(row) {
  if (typeof row.id === "number" && Number.isFinite(row.id)) return row.id;
  const code = Number(row.usercode ?? row.ims_usercode);
  return Number.isFinite(code) ? code : 0;
}

function rowKey(row) {
  if (row?.id != null && row.id !== "") return row.id;
  return `${row.username ?? ""}_${row.usercode ?? ""}`;
}

/** Stable row id when ERP + App lists are merged (avoids id collisions). */
function tableRowKey(row) {
  const src = row?._listSource;
  if (src) return `${src}:${rowKey(row)}`;
  return rowKey(row);
}

function deptLabel(row) {
  return row?.department_name || row?.department?.name || "—";
}

function desigLabel(row) {
  return row?.designation_name || row?.designation?.name || "—";
}

const DEPT_DESIG_HEADERS = [
  // ["Department", "department_name", (_v, row) => <span className="text-xs text-slate-700">{deptLabel(row)}</span>],
  // ["Designation", "designation_name", (_v, row) => <span className="text-xs text-slate-700">{desigLabel(row)}</span>],
];

const LIST_SCOPE_ERP = "erp_directory";
const LIST_SCOPE_APP = "application_db";
const LIST_SCOPE_ALL = "all";

export default function UsersPage() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  const [params, setParams] = useState({
    pageSize: 500,
    sortKey: "created_at",
    sortDir: "desc",
    listScope: LIST_SCOPE_ALL,
    roleFilter: "all",
    statusFilter: "all",
  });

  const [tempSearch, setTempSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState("");

  /** Search is client-only (no API). Filters use Apply / refresh. */
  const displayRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) return applyClientSearch(allRows, tempSearch);
    return sortRowsByKey(allRows, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const fetchUsers = useCallback(async () => {
      setLoading(true);
      try {
        setBlockedMessage("");

        if (params.listScope === LIST_SCOPE_ERP) {
          const body = await userService.getImsUsers({});
          let list = Array.isArray(body.data) ? body.data : [];
          list = Array.isArray(list) ? list : [];
          list = list.filter((row) =>
            matchesRoleStatus(row, params.roleFilter, params.statusFilter)
          );
          setAllRows(list);
          setTotalItems(list.length);
          return;
        }

        const filters = { auth_source: "local" };
        if (params.roleFilter && params.roleFilter !== "all") filters.type = params.roleFilter;
        if (params.statusFilter && params.statusFilter !== "all") filters.status = params.statusFilter;

        const fetchAppPages = () =>
          fetchAllListPages(
            async (page, limit) => {
              const order = params.sortDir === "asc" ? "ASC" : "DESC";
              const body = await userService.getAll({
                page,
                limit,
                filters,
                sortBy: params.sortKey,
                order,
              });
              const list = body?.data ?? [];
              const rows = Array.isArray(list) ? list : [];
              const t = Number(body?.total ?? 0);
              return { data: rows, total: Number.isFinite(t) ? t : rows.length };
            },
            Math.min(Math.max(1, params.pageSize), 1000),
            50000
          );

        if (params.listScope === LIST_SCOPE_ALL) {
          const [erpBody, appResult] = await Promise.all([
            userService.getImsUsers({}),
            fetchAppPages(),
          ]);
          let erpList = Array.isArray(erpBody.data) ? erpBody.data : [];
          erpList = erpList.filter((row) =>
            matchesRoleStatus(row, params.roleFilter, params.statusFilter)
          );
          const erpTagged = erpList.map((row) => ({ ...row, _listSource: LIST_SCOPE_ERP }));
          const appRows = Array.isArray(appResult.data) ? appResult.data : [];
          const appTagged = appRows.map((row) => ({ ...row, _listSource: LIST_SCOPE_APP }));
          const merged = [...erpTagged, ...appTagged];
          setAllRows(merged);
          setTotalItems(merged.length);
          return;
        }

        const { data, total } = await fetchAppPages();

        setAllRows(data);
        setTotalItems(Number.isFinite(Number(total)) ? Number(total) : data.length);
      } catch (err) {
        const msg = err?.message || "";
        const denied =
          err?.status === 403 &&
          (msg.includes("Access Denied — module") || msg.toLowerCase().includes("deactivated"));
        if (denied) {
          setAllRows([]);
          setTotalItems(0);
          setBlockedMessage(msg);
        } else {
          toast.error(err?.message || "Failed to load users");
        }
      } finally {
        setLoading(false);
      }
    }, [params.listScope, params.pageSize, params.roleFilter, params.statusFilter, params.sortKey, params.sortDir]);

  useEffect(() => {
    setSelected(null);
  }, [params.listScope, params.roleFilter, params.statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleLoadMore = useCallback(() => {}, []);

  const handleFilterApply = (data) => {
    setParams((prev) => {
      const nextScope = data.listScope ?? prev.listScope;
      const roleFilter = data.roleFilter !== undefined ? data.roleFilter : prev.roleFilter;
      const statusFilter = data.statusFilter !== undefined ? data.statusFilter : prev.statusFilter;
      const scopeChanged = nextScope !== prev.listScope;
      const sortDefaults =
        nextScope === LIST_SCOPE_APP || nextScope === LIST_SCOPE_ALL
          ? { sortKey: "created_at", sortDir: "desc" }
          : { sortKey: "username", sortDir: "asc" };
      return {
        ...prev,
        listScope: nextScope,
        roleFilter,
        statusFilter,
        ...(scopeChanged ? sortDefaults : {}),
      };
    });
  };

  const handleReset = () => {
    setTempSearch("");
    setParams((prev) => ({
      ...prev,
      listScope: LIST_SCOPE_ALL,
      roleFilter: "all",
      statusFilter: "all",
      sortKey: "created_at",
      sortDir: "desc",
    }));
  };

  const roleFilterOptions = useMemo(
    () => [{ label: "All Roles", value: "all" }, ...TYPES.map((t) => ({ label: ROLE_LABELS[t] || t, value: t }))],
    []
  );

  const statusFilterOptions = useMemo(
    () => [{ label: "All Status", value: "all" }, ...USER_STATUSES.map((s) => ({ label: USER_STATUS_CONFIG[s]?.label ?? s, value: s}))],
    []
  );

  const extraFilters = useMemo(
    () => [
      {
        label: "List",
        key: "listScope",
        value: params.listScope,
        options: [
          { label: "All", value: LIST_SCOPE_ALL },
          { label: "ERP", value: LIST_SCOPE_ERP },
          { label: "App", value: LIST_SCOPE_APP },
        ],
      },
      {
        label: "Role",
        key: "roleFilter",
        value: params.roleFilter,
        options: roleFilterOptions,
      },
      {
        label: "Status",
        key: "statusFilter",
        value: params.statusFilter,
        options: statusFilterOptions,
      },
    ],
    [params.listScope, params.roleFilter, params.statusFilter, roleFilterOptions, statusFilterOptions]
  );

  const selectedRow = useMemo(() => allRows.find((u) => tableRowKey(u) === selected), [allRows, selected]);

  const getSelectedRow = useCallback(
    () => allRows.find((u) => tableRowKey(u) === selected),
    [allRows, selected]
  );

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "users",
    modalOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditUser(null);
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      setEditUser(row);
      setModalOpen(true);
    }, []),
  });

  const erpDirectoryHeaders = useMemo(
    () => [
      [
        "Name",
        "name",
        (v, row) => (
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(avatarKey(row))} flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm`}
            >
              {getInitials(v || row.username)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-xs truncate leading-tight uppercase">{v || "—"}</p>
              <p className="text-[10px] text-slate-400">@{row.username}</p>
            </div>
          </div>
        ),
      ],
      ["Email", "email", (v) => <span className="text-xs">{v || "—"}</span>],
      ["Phone", "phone", (v) => <span className="text-xs">{v || "—"}</span>],
      [
        "Role",
        "type",
        (v) => {
          const cfg = USER_TYPE_CONFIG[v] || { label: ROLE_LABELS[v] || v || "—", bg: "bg-slate-50", text: "text-slate-600" };
          return (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg} ${cfg.text} border-current/10`}
            >
              {cfg.label}
            </span>
          );
        },
      ],
      ...DEPT_DESIG_HEADERS,
      [
        "Status",
        "status",
        (v) => {
          const cfg = USER_STATUS_CONFIG[v] || USER_STATUS_CONFIG["inactive"];
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          );
        },
      ],
      ["Created", "created_at", (v) => <span className="text-xs text-slate-500">{v ? formatDateTime(v) : "—"}</span>],
    ],
    []
  );

  const combinedHeaders = useMemo(
    () => [
      [
        "Name",
        "name",
        (v, row) => (
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(avatarKey(row))} flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm`}
            >
              {getInitials(v || row.username)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-xs truncate leading-tight uppercase">{v || "—"}</p>
              <p className="text-[10px] text-slate-400">@{row.username}</p>
            </div>
          </div>
        ),
      ],
      ["Email", "email", (v) => <span className="text-xs">{v || "—"}</span>],
      ["Phone", "phone", (v) => <span className="text-xs">{v || "—"}</span>],
      [
        "Source",
        "_listSource",
        (v) => {
          const label = v === LIST_SCOPE_ERP ? "ERP" : v === LIST_SCOPE_APP ? "App" : "—";
          const cls =
            v === LIST_SCOPE_ERP
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : v === LIST_SCOPE_APP
                ? "bg-violet-50 text-violet-800 border-violet-200"
                : "bg-slate-50 text-slate-600 border-slate-200";
          return (
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${cls}`}>{label}</span>
          );
        },
      ],
      [
        "Role",
        "type",
        (v) => {
          const cfg = USER_TYPE_CONFIG[v] || { label: ROLE_LABELS[v] || v || "—", bg: "bg-slate-50", text: "text-slate-600" };
          return (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg} ${cfg.text} border-current/10`}
            >
              {cfg.label}
            </span>
          );
        },
      ],
      ...DEPT_DESIG_HEADERS,
      [
        "Status",
        "status",
        (v) => {
          const cfg = USER_STATUS_CONFIG[v] || USER_STATUS_CONFIG["inactive"];
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          );
        },
      ],
      ["Created", "created_at", (v) => <span className="text-xs text-slate-500">{v ? formatDateTime(v) : "—"}</span>],
    ],
    []
  );

  const applicationHeaders = useMemo(
    () => [
      [
        "Name",
        "name",
        (v, row) => (
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(row.id)} flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm`}
            >
              {getInitials(v)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-xs truncate leading-tight uppercase">{v}</p>
              <p className="text-[10px] text-slate-400">@{row.username}</p>
            </div>
          </div>
        ),
      ],
      ["Email", "email", (v) => <span className="text-xs">{v}</span>],
      ["Phone", "phone", (v) => <span className="text-xs">{v || "—"}</span>],
      [
        "Role",
        "type",
        (v) => {
          const cfg = USER_TYPE_CONFIG[v] || { label: ROLE_LABELS[v] || v, bg: "bg-slate-50", text: "text-slate-600" };
          return (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg} ${cfg.text} border-current/10`}
            >
              {cfg.label}
            </span>
          );
        },
      ],
      ...DEPT_DESIG_HEADERS,
      [
        "Status",
        "status",
        (v) => {
          const cfg = USER_STATUS_CONFIG[v] || USER_STATUS_CONFIG["inactive"];
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          );
        },
      ],
      ["Created", "created_at", (v) => <span className="text-xs text-slate-500">{formatDateTime(v)}</span>],
    ],
    []
  );

  const headers = params.listScope === LIST_SCOPE_ERP ? erpDirectoryHeaders
      : params.listScope === LIST_SCOPE_APP ? applicationHeaders : combinedHeaders;

  const deleteDisabled = selected === null || !selectedRow || isPendingRecordId(selectedRow?.id);

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <ActionButton module="users" action="add" label="New" icon={Plus} onClick={openNewModal}
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none border-slate-300"
              />
              <ActionButton module="users" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={selected === null} record={selectedRow} onClick={openEditModal}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none"
              />
              <ActionButton module="users" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={deleteDisabled} record={selectedRow} onClick={() => setDeleteUser(selectedRow)} 
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none"
              />

              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => fetchUsers()}
                className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none"
              >
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="flex items-center">
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
            </div>
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic">
                Selected: {selectedRow?.name || selectedRow?.username || "—"}
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
        </div>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={false}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Name, email, phone..."
            searchLabel="Quick filter"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={headers}
            getRowId={(row) => tableRowKey(row)}
            data={displayRows}
            loading={loading}
            viewMode={viewMode}
            allowCopy={true}
            {...tableHotkeyProps}
            showSelection={true}
            skeletonCount={params.pageSize}
            emptyIcon={Users}
            emptyMessage={blockedMessage || "No users found"}
            emptySubMessage={undefined}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={(key) =>
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }))
            }
            selectedId={selected}
            onSelect={setSelected}
            onLoadMore={handleLoadMore}
            hasMore={false}
            totalItems={displayRows.length}
            cardConfig={{
              titleKey: "name",
              tagsKeys: ["type", "status"],
              detailKeys: ["email", "phone", "usercode"],
              footerKey: "created_at",
              className: "rounded-none shadow-sm border border-slate-200 overflow-hidden",
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            {tempSearch.trim()
              ? `${displayRows.length} shown (search) · ${allRows.length} loaded`
              : `${displayRows.length}${params.listScope === LIST_SCOPE_APP ? ` / ${totalItems}` : ""} ${params.listScope === LIST_SCOPE_APP ? "users" : "rows"}`}
          </span>
        </div>
      </div>

      {modalOpen && (
        <UserModal open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditUser(null);
          }}
          onSuccess={() => fetchUsers()}
          editUser={editUser}
        />
      )}
      {deleteUser && !isPendingRecordId(deleteUser?.id) && (
        <DeleteModal
          item={deleteUser}
          onClose={() => setDeleteUser(null)}
          onSuccess={() => fetchUsers()}
          service={userService}
          entityLabel="User"
          moduleSlug="users"
        />
      )}
    </div>
  );
}

