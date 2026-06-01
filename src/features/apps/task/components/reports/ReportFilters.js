import { X } from "lucide-react";
import SearchableSelect from "@/features/apps/task/components/common/SearchableSelect";

export default function ReportFilters({
  // data
  currentUser,
  departmentsLists,
  filteredUsers,
  teamMemberOptions,
  assignedByOptions,
  
  // state
  selectedAssignedBy,
  selectedDepartment,
  selectedUser,
  
  // derived
  isAdmin,
  isManager,
  showDepartmentDropdown,
  showAssignedByDropdown,
  showTeamMemberDropdown,
  
  // handlers
  onAssignedByChange,
  onDepartmentChange,
  onUserChange,
  onClearAll,
  
  title = "Reports",
  description = "Reports Management",
  teamTitle = "Assigned To"
}) {
  const showClearButton =
    (showDepartmentDropdown || showAssignedByDropdown || showTeamMemberDropdown) &&
    (selectedDepartment || selectedAssignedBy || selectedUser);

  return (
    <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
      {/* Left: Breadcrumb & Title */}
      <div className="shrink-0">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
          <span>Dashboard</span>
          <span>/</span>
          <span className="font-medium text-slate-500">{title}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {description}
        </h1>
      </div>

      {/* Right: filters — laptop = one row + Clear aligned; narrow = stack / wrap without overflow */}
      {(showAssignedByDropdown || showDepartmentDropdown || showTeamMemberDropdown) && (
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3 lg:flex-1 lg:flex-nowrap lg:justify-end">
          {showAssignedByDropdown && (
            <div className="min-w-0 w-full space-y-1.5 sm:min-w-[10rem] sm:flex-1 lg:max-w-xs">
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
            <div className="min-w-0 w-full space-y-1.5 sm:min-w-[10rem] sm:flex-1 lg:max-w-xs">
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

          {showTeamMemberDropdown && (
            <div className="min-w-0 w-full space-y-1.5 sm:min-w-[10rem] sm:flex-1 lg:max-w-xs">
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

          <div className="flex h-[42px] w-full items-end sm:w-auto sm:shrink-0">
            {showClearButton && (
              <button
                type="button"
                onClick={onClearAll}
                className="flex h-[42px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-rose-600 shadow-sm transition-all hover:border-rose-200 hover:bg-rose-50 active:scale-95 sm:w-auto"
              >
                <X size={14} strokeWidth={3} />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
