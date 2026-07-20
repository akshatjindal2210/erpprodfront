"use client";

import { Pencil, Trash2, Calendar, RepeatIcon, Eye, Copy, Activity, RefreshCw } from "lucide-react";
import { PRIORITY_CONFIG, TASK_STATUS_CONFIG, TASK_STATUS_CONFIG_FOR_TABLE } from "@/features/apps/task/components/common/Constants";
import { formatDate, formatDateTime } from "@/features/apps/task/helpers/utilHelper";
import { IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_TEXT } from "@/features/apps/ims/helpers/listPageShellClasses";
import { getTaskRowColor, getRowMeta } from "@/features/apps/task/components/tasks_common_component/TaskHelper";

function statusExportLabel(status) {
  return (
    TASK_STATUS_CONFIG[status]?.label ||
    TASK_STATUS_CONFIG_FOR_TABLE[status]?.label ||
    status ||
    "—"
  );
}

function assignedToExportLabel(row) {
  const first = row.first_assigned_to_name;
  const current = row.current_holder_name;
  if (!first && !current) return "—";
  if (first === current || !current) return first ?? current;
  return `${current} (Forwarded from ${first})`;
}

function lastRemarkExportLabel(row) {
  if (!row.last_message || row.status === "pending") return "—";
  const when = row.last_message_at ? ` (${formatDateTime(row.last_message_at)})` : "";
  return `${row.last_message}${when}`;
}

/**
 * Export headers — same columns/values as the Tasks / Report table (PDF / Excel / CSV).
 */
export function buildTaskExportHeaders() {
  return [
    ["Task ID", "task_id", null, { copyValue: (row) => row.task_id ?? "" }],
    [
      "Title",
      "title",
      null,
      {
        copyValue: (row) => {
          const parts = [row.title || "—"];
          if (row.is_recurring === 1 || row.is_recurring === true) parts.push("(Recurring)");
          return parts.join(" ");
        },
      },
    ],
    ["Last Remark", "last_remark", null, { copyValue: (row) => lastRemarkExportLabel(row) }],
    ["Status", "status", null, { copyValue: (row) => statusExportLabel(row.status) }],
    ["Due Date", "due_date", null, { copyValue: (row) => formatDate(row.due_date) ?? "—" }],
    [
      "Reminder Date",
      "reminder_date",
      null,
      { copyValue: (row) => formatDate(row.reminder_date ?? row.self_reminder_date) ?? "—" },
    ],
    ["Category", "category_id", null, { copyValue: (row) => row.category_name || "—" }],
    [
      "Priority",
      "priority",
      null,
      { copyValue: (row) => PRIORITY_CONFIG[row.priority]?.label ?? row.priority ?? "—" },
    ],
    ["Assigned By", "assigned_by", null, { copyValue: (row) => row.assigned_by_name || "—" }],
    ["Assigned To", "first_assigned_to_name", null, { copyValue: (row) => assignedToExportLabel(row) }],
    ["Created At", "created_at", null, { copyValue: (row) => (row.created_at ? formatDateTime(row.created_at) : "—") }],
    [
      "Type",
      "task_type",
      null,
      { copyValue: (row) => (row.task_type === "self" ? "Self" : "Assigned") },
    ],
    ["Created By", "created_by_name", null, { copyValue: (row) => row.created_by_name || "—" }],
  ];
}

function Badge({ cfg, colorOverride }) {
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-medium border leading-tight ${cfg.badge}`}
      style={{ borderColor: colorOverride ?? "", color: colorOverride ?? "" }}
    >
      <span
        className={`w-1 h-1 rounded-full flex-shrink-0 ${cfg.dot}`}
        style={{ backgroundColor: colorOverride ?? "" }}
      />
      {cfg.label}
    </span>
  );
}

function AssignmentInfo({ task }) {
  const first = task.first_assigned_to_name;
  const current = task.current_holder_name;

  if (!first && !current) return <span className="text-slate-300 text-[10px]">—</span>;
  if (first === current || !current) {
    return (
      <div>
        <p className="text-[11px] font-medium text-slate-700 truncate max-w-[110px] leading-tight">{first ?? current}</p>
        <p className="text-[9px] text-slate-400 leading-tight">Assigned</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] font-medium text-slate-700 truncate max-w-[110px] leading-tight">{current}</p>
      <p className="text-[9px] text-slate-400 leading-tight">Forwarded</p>
    </div>
  );
}

/**
 * IMS DataTable headers for Tasks list — color codes via getTaskRowColor / getRowMeta.
 */
export function buildTaskListHeaders({
  activeTab,
  currentUserId,
  quickFilter,
  statusFilter,
  canEdit,
  canDelete,
  onNavigate,
  onEdit,
  onDelete,
  onClone,
  onReassign = null,
  showReassign = false,
}) {
  return [
    [
      "#",
      "task_id",
      (v) => <span className={`${IMS_TABLE_CELL_TEXT} font-mono tabular-nums`}>{v ?? "—"}</span>,
      { fixed: true, width: "70px", align: "center", copyValue: (row) => row.task_id ?? "" },
    ],
    [
      "Title",
      "title",
      (v, row) => {
        const meta = getRowMeta(row, activeTab, currentUserId, quickFilter, statusFilter);
        const finalColor = getTaskRowColor(row);
        return (
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            <span
              className="font-semibold text-slate-800 text-[12px] leading-tight line-clamp-1"
              title={v}
              style={{ borderLeft: `3px solid ${finalColor}`, paddingLeft: 6 }}
            >
              {v || "—"}
            </span>
            {(row.is_recurring === 1 || row.is_recurring === true) && (
              <RepeatIcon size={10} className="text-indigo-400 flex-shrink-0" title="Recurring" />
            )}
            {meta.badge && (
              <span className={`text-[8px] font-bold px-1 py-px rounded border leading-none flex-shrink-0 ${meta.badgeCls}`}>
                {meta.badge}
              </span>
            )}
          </div>
        );
      },
      { width: "240px", wrap: true, copyValue: (row) => row.title || "—" },
    ],
    [
      "Last Remark",
      "last_remark",
      (_v, row) =>
        row.last_message && row.status !== "pending" ? (
          <div className="flex flex-col min-w-0">
            <p className="text-[11px] font-medium text-slate-800 leading-tight line-clamp-2" title={row.last_message}>
              {row.last_message}
            </p>
            <p className="text-[9px] text-slate-400 mt-px leading-tight">{formatDateTime(row.last_message_at)}</p>
          </div>
        ) : (
          <span className="text-slate-300 text-[10px]">—</span>
        ),
      { width: "180px", wrap: true, copyValue: (row) => lastRemarkExportLabel(row) },
    ],
    [
      "Status",
      "status",
      (_v, row) => {
        const statusCfg = TASK_STATUS_CONFIG_FOR_TABLE[row.status] ?? TASK_STATUS_CONFIG_FOR_TABLE.pending;
        return <Badge cfg={statusCfg} colorOverride={getTaskRowColor(row)} />;
      },
      { width: "110px", copyValue: (row) => statusExportLabel(row.status) },
    ],
    [
      "Due Date",
      "due_date",
      (_v, row) => {
        const meta = getRowMeta(row, activeTab, currentUserId, quickFilter, statusFilter);
        return (
          <span className={`inline-flex items-center gap-0.5 text-[11px] whitespace-nowrap ${meta.dueDateCls || IMS_TABLE_CELL_DATE}`}>
            <Calendar size={9} /> {formatDate(row.due_date) ?? "—"}
          </span>
        );
      },
      { width: "100px", copyValue: (row) => formatDate(row.due_date) ?? "—" },
    ],
    [
      "Reminder Date",
      "reminder_date",
      (_v, row) => {
        const meta = getRowMeta(row, activeTab, currentUserId, quickFilter, statusFilter);
        return (
          <span className={`inline-flex items-center gap-0.5 text-[11px] whitespace-nowrap ${meta.reminderDateCls || IMS_TABLE_CELL_DATE}`}>
            <Calendar size={9} /> {formatDate(row.reminder_date ?? row.self_reminder_date) ?? "—"}
          </span>
        );
      },
      { width: "110px", copyValue: (row) => formatDate(row.reminder_date ?? row.self_reminder_date) ?? "—" },
    ],
    [
      "Category",
      "category_id",
      (_v, row) =>
        row.category_name ? (
          <span className="px-1.5 py-px rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
            {row.category_name}
          </span>
        ) : (
          <span className="text-slate-300 text-[10px]">—</span>
        ),
      { width: "110px", copyValue: (row) => row.category_name || "—" },
    ],
    [
      "Priority",
      "priority",
      (_v, row) => {
        const priorityCfg = PRIORITY_CONFIG[row.priority] ?? PRIORITY_CONFIG.medium;
        return <Badge cfg={priorityCfg} colorOverride={getTaskRowColor(row)} />;
      },
      { width: "90px", copyValue: (row) => PRIORITY_CONFIG[row.priority]?.label ?? row.priority ?? "—" },
    ],
    [
      "Assigned By",
      "assigned_by",
      (_v, row) =>
        row.assigned_by_name ? (
          <p className="text-[11px] font-medium text-slate-700 truncate max-w-[90px] leading-tight">{row.assigned_by_name}</p>
        ) : (
          <span className="text-slate-300 text-[10px]">—</span>
        ),
      { width: "110px", copyValue: (row) => row.assigned_by_name || "—" },
    ],
    [
      "Assigned To",
      "first_assigned_to_name",
      (_v, row) => <AssignmentInfo task={row} />,
      { width: "120px", copyValue: (row) => assignedToExportLabel(row) },
    ],
    [
      "Created At",
      "created_at",
      (v) => <span className={IMS_TABLE_CELL_DATE}>{v ? formatDateTime(v) : "—"}</span>,
      { width: "130px", copyValue: (row) => (row.created_at ? formatDateTime(row.created_at) : "—") },
    ],
    [
      "Type",
      "task_type",
      (v) => (
        <span
          className={`text-[10px] font-semibold px-1 py-px rounded border ${
            v === "self"
              ? "bg-violet-50 text-violet-600 border-violet-200"
              : "bg-slate-50 text-slate-600 border-slate-200"
          }`}
        >
          {v === "self" ? "Self" : "Assigned"}
        </span>
      ),
      { width: "90px", copyValue: (row) => (row.task_type === "self" ? "Self" : "Assigned") },
    ],
    [
      "Created By",
      "created_by_name",
      (v) =>
        v ? (
          <p className="text-[11px] font-medium text-slate-700 truncate max-w-[90px] leading-tight">{v}</p>
        ) : (
          <span className="text-slate-300 text-[10px]">—</span>
        ),
      { width: "110px", copyValue: (row) => row.created_by_name || "—" },
    ],
    [
      "Actions",
      "_actions",
      (_v, row) => {
        const isOwner =
          row.task_type === "self"
            ? String(row.created_by_id) === String(currentUserId)
            : String(row.assigned_by_id) === String(currentUserId);
        return (
          <div className="flex items-center justify-center gap-0" onClick={(e) => e.stopPropagation()}>
            {showReassign && onReassign && (
              <button
                type="button"
                onClick={() => onReassign(row)}
                className="p-1 rounded text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-all"
                title="Reassign"
              >
                <RefreshCw size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate?.(row)}
              className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
              title="View"
            >
              <Eye size={12} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.(row)}
              className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
              title="Activity"
            >
              <Activity size={12} />
            </button>
            {canEdit && isOwner && (
              <button
                type="button"
                onClick={() => onEdit?.(row)}
                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                title="Edit"
              >
                <Pencil size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onClone?.(row)}
              className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
              title="Clone"
            >
              <Copy size={12} />
            </button>
            {canDelete && isOwner && (
              <button
                type="button"
                onClick={() => onDelete?.(row)}
                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        );
      },
      { width: showReassign ? "140px" : "120px", sortable: false, fixedRight: true, export: false },
    ],
  ];
}
