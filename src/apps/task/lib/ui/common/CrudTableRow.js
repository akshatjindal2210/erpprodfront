import { Pencil, Trash2 } from "lucide-react";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";

/**
 * Generic table row — categories, departments, designations, holidays
 *
 * columns: same array as CrudPage config columns
 * renderCell: optional custom cell renderer
 *   (key, value, item) => ReactNode | null
 *   Return null to use default rendering
 *
 * entity: permission entity name e.g. "category", "holiday"
 * icon: optional icon component shown in name cell
 * iconBg, iconText: icon styling
 * accentColor: edit button hover color
 * idKey: primary key field (default: "id")
 */
export default function CrudTableRow({
  item,
  index,
  isSelected,
  onToggle,
  onEdit,
  onDelete,
  columns      = [],
  entity       = "",
  icon:  Icon  = null,
  iconBg       = "bg-slate-50",
  iconText     = "text-slate-500",
  iconBorder   = "border-slate-200",
  accentColor  = "indigo",
  idKey        = "id",
  renderCell   = null,   // (key, value, item) => ReactNode | null
  formatters   = {},     // { key: (value, item) => string }
}) {
  const canAccess = useCanAccess();
  const canEdit   = entity ? canAccess(entity, "edit").allowed : true;
  const canDelete = entity ? canAccess(entity, "delete").allowed : true;

  const renderDefaultCell = (col, item) => {
    const val = item[col.key];

    // Custom renderer check
    if (renderCell) {
      const custom = renderCell(col.key, val, item);
      if (custom !== null && custom !== undefined) return custom;
    }

    // Custom formatter
    if (formatters[col.key]) {
      return <span className="text-xs text-slate-500">{formatters[col.key](val, item)}</span>;
    }

    // Name column — show icon if provided
    if (col.key === "name" && Icon) {
      return (
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg ${iconBg} border ${iconBorder} flex items-center justify-center flex-shrink-0`}>
            <Icon size={12} className={iconText} />
          </div>
          <span className="font-medium text-slate-800">{val}</span>
        </div>
      );
    }

    // Index column
    if (col.key === "index") {
      return <span className="text-xs text-slate-400 font-medium">{index}</span>;
    }

    // Default — plain text
    return <span className="text-xs text-slate-500">{val ?? "—"}</span>;
  };

  return (
    <tr className="hover:bg-slate-50/70 transition-colors">

      {/* Checkbox */}
      <td className="px-4 py-3 w-10">
        <input type="checkbox" checked={isSelected}
          onChange={() => onToggle(item[idKey])}
          className={`w-4 h-4 rounded border-slate-300 accent-${accentColor}-600 cursor-pointer`} />
      </td>

      {/* # index */}
      <td className="px-4 py-3 text-xs text-slate-400 font-medium">{index}</td>

      {/* Dynamic columns — skip "#" since we render it above */}
      {columns.filter((c) => c.key !== "id" || columns.indexOf(c) !== 0).map((col) => (
        <td key={col.key} className="px-4 py-3">
          {renderDefaultCell(col, item)}
        </td>
      ))}

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1.5">
          {canEdit && (
            <button onClick={() => onEdit(item)}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-${accentColor}-600 hover:bg-${accentColor}-50 transition-all`}
              title="Edit">
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(item)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
              title="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
