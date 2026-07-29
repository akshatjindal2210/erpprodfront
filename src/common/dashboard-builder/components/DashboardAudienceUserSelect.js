"use client";

import { useCallback } from "react";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";

export default function DashboardAudienceUserSelect({ selectedUserIds = [], onSelectedUserIdsChange, userOptions = [], className = "", compact = false }) {
  const fetchUsers = useCallback(
    async ({ search, page = 1, limit = 50 }) => {
      const q = String(search || "").trim().toLowerCase();
      let rows = userOptions
        .map((option) => ({
          id: Number(option.value),
          name: String(option.label || option.name || "").trim(),
        }))
        .filter((row) => Number.isFinite(row.id) && row.name);
      if (q) {
        rows = rows.filter((row) => row.name.toLowerCase().includes(q));
      }
      const start = (page - 1) * limit;
      return {
        data: rows.slice(start, start + limit),
        total: rows.length,
      };
    },
    [userOptions],
  );

  const getUserById = useCallback(
    async (id) => {
      const found = userOptions.find((option) => String(option.value) === String(id));
      if (!found) return null;
      return { id: Number(found.value), name: String(found.label || "") };
    },
    [userOptions],
  );

  const handleUsersChange = (ids) => {
    const normalized = Array.isArray(ids)
      ? ids.map((value) => Number(value)).filter(Number.isFinite)
      : [];
    onSelectedUserIdsChange?.(normalized);
  };

  const selectedCount = Array.isArray(selectedUserIds) ? selectedUserIds.length : 0;

  return (
    <div className={`flex items-center gap-1.5 min-w-0 shrink-0 ${className}`}>
      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 shrink-0 whitespace-nowrap">
        Users
      </label>
      <div
        className={compact ? "w-[162px] min-w-[162px] shrink-0" : "w-[220px] min-w-[200px] flex-1"}
        title={selectedCount > 0 ? `${selectedCount} user${selectedCount === 1 ? "" : "s"} selected` : "Select users"}
      >
        <SearchableSelect
          multiple
          compactMulti
          showAllOption
          allOptionLabel="All Users"
          value={selectedUserIds}
          onChange={handleUsersChange}
          fetchService={fetchUsers}
          getByIdService={getUserById}
          placeholder="Select users…"
          label=""
          variant="form"
          heightClass={compact ? "h-7" : "h-8"}
          dataKey="id"
          labelKey="name"
          usePortal
        />
      </div>
    </div>
  );
}
