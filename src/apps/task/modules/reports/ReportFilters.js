import { X } from "lucide-react";
import SearchableSelect from "@/apps/task/lib/ui/common/SearchableSelect";

export default function ReportFilters({
  // data
  currentUser,
  departmentsLists,
  filteredUsers,
  teamMemberOptions,
  assignedByOptions,
  designationOptions = [],

  // state
  selectedAssignedBy,
  selectedDepartment,
  selectedDesignation,
  selectedUser,
  
  // derived
  isAdmin,
  isManager,
  showDepartmentDropdown,
  showDesignationDropdown,
  showAssignedByDropdown,
  showTeamMemberDropdown,
  
  // handlers
  onAssignedByChange,
  onDepartmentChange,
  onDesignationChange,
  onUserChange,
  onClearAll,
  
  title = "Reports",
  description = "Reports Management",
  teamTitle = "Assigned To",
  compact = false,
}) {
  const showClearButton =
    (showDepartmentDropdown || showDesignationDropdown || showAssignedByDropdown || showTeamMemberDropdown) &&
    (selectedDepartment || selectedDesignation || selectedAssignedBy || selectedUser);

  const hasFilters =
    showAssignedByDropdown || showDepartmentDropdown || showDesignationDropdown || showTeamMemberDropdown;

  if (compact) {
    if (!hasFilters) return null;
    return (
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2 lg:flex-nowrap">
        {showAssignedByDropdown && (
          <div className="min-w-0 w-full space-y-1 sm:min-w-[9rem] sm:flex-1 lg:max-w-[12rem]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Assigned By
            </label>
            <SearchableSelect
              options={assignedByOptions}
              value={selectedAssignedBy}
              onChange={onAssignedByChange}
              placeholder="All Assigned By"
            />
          </div>
        )}

        {showDepartmentDropdown && (
          <div className="min-w-0 w-full space-y-1 sm:min-w-[9rem] sm:flex-1 lg:max-w-[12rem]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Department
            </label>
            <SearchableSelect
              options={departmentsLists}
              value={selectedDepartment}
              onChange={onDepartmentChange}
              placeholder="All Departments"
            />
          </div>
        )}

        {showDesignationDropdown && (
          <div className="min-w-0 w-full space-y-1 sm:min-w-[9rem] sm:flex-1 lg:max-w-[12rem]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Designation
            </label>
            <SearchableSelect
              options={designationOptions}
              value={selectedDesignation}
              onChange={onDesignationChange}
              placeholder="All Designations"
            />
          </div>
        )}

        {showTeamMemberDropdown && (
          <div className="min-w-0 w-full space-y-1 sm:min-w-[9rem] sm:flex-1 lg:max-w-[12rem]">
            <label className="block truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {teamTitle}
              {selectedDepartment && filteredUsers.length > 0 && (
                <span className="ml-1 font-medium lowercase normal-case text-indigo-400">
                  ({filteredUsers.length})
                </span>
              )}
            </label>
            <SearchableSelect
              options={teamMemberOptions}
              value={selectedUser}
              onChange={onUserChange}
              placeholder={selectedDepartment ? "All members" : "All Assigned To"}
              disabled={
                filteredUsers.length === 0 &&
                !(currentUser?.type === "admin" || currentUser?.type === "super_admin")
              }
            />
          </div>
        )}

        {showClearButton && (
          <button
            type="button"
            onClick={onClearAll}
            className="h-9 shrink-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-slate-300 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-rose-600 hover:border-rose-300 hover:bg-rose-50"
          >
            <X size={14} strokeWidth={3} />
            Clear
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div className="shrink-0">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Dashboard</span>
          <span>/</span>
          <span className="text-slate-500">{title}</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight text-slate-800 uppercase">
          {description}
        </h1>
      </div>

      {hasFilters && (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2 lg:flex-1 lg:flex-nowrap lg:justify-end">
          {showAssignedByDropdown && (
            <div className="min-w-0 w-full space-y-1 sm:min-w-[10rem] sm:flex-1 lg:max-w-xs">
              <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Assigned By
              </label>
              <SearchableSelect
                options={assignedByOptions}
                value={selectedAssignedBy}
                onChange={onAssignedByChange}
                placeholder="All Assigned By"
              />
            </div>
          )}

          {showDepartmentDropdown && (
            <div className="min-w-0 w-full space-y-1 sm:min-w-[10rem] sm:flex-1 lg:max-w-xs">
              <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Department
              </label>
              <SearchableSelect
                options={departmentsLists}
                value={selectedDepartment}
                onChange={onDepartmentChange}
                placeholder="All Departments"
              />
            </div>
          )}

          {showDesignationDropdown && (
            <div className="min-w-0 w-full space-y-1 sm:min-w-[10rem] sm:flex-1 lg:max-w-xs">
              <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Designation
              </label>
              <SearchableSelect
                options={designationOptions}
                value={selectedDesignation}
                onChange={onDesignationChange}
                placeholder="All Designations"
              />
            </div>
          )}

          {showTeamMemberDropdown && (
            <div className="min-w-0 w-full space-y-1 sm:min-w-[10rem] sm:flex-1 lg:max-w-xs">
              <label className="ml-1 block truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {teamTitle}
                {selectedDepartment && filteredUsers.length > 0 && (
                  <span className="ml-1 font-medium lowercase normal-case text-indigo-400">
                    ({filteredUsers.length})
                  </span>
                )}
              </label>
              <SearchableSelect
                options={teamMemberOptions}
                value={selectedUser}
                onChange={onUserChange}
                placeholder={selectedDepartment ? "All members" : "All Assigned To"}
                disabled={
                  filteredUsers.length === 0 &&
                  !(currentUser?.type === "admin" || currentUser?.type === "super_admin")
                }
              />
            </div>
          )}

          {showClearButton && (
            <button
              type="button"
              onClick={onClearAll}
              className="h-9 shrink-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-slate-300 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-rose-600 hover:border-rose-300 hover:bg-rose-50"
            >
              <X size={14} strokeWidth={3} />
              Clear All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
