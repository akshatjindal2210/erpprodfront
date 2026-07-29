import { Plus } from "lucide-react";
import SearchableSelect from "@/apps/task/lib/ui/common/SearchableSelect";

const ORG_FILTER_WRAP = "w-48 shrink-0 space-y-1.5";

export default function ClTaskTopFilters({
  onAdd,
  canAdd = true,
  departmentsLists,
  designationsLists,
  personOptions,
  selectedDepartment,
  selectedDesignation,
  selectedPerson,
  onDepartmentChange,
  onDesignationChange,
  onPersonChange,
}) {
  return (
    <div className="mb-6 space-y-4">
      {/* Row 1 — title + Add (right) */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Dashboard</span>
            <span>/</span>
            <span className="font-medium text-slate-500">CL Task</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">CL Task Management</h1>
        </div>
        {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md"
        >
          <Plus size={16} />
          Add CL Task
        </button>
        )}
      </div>

      {/* Row 2 — filters always open, left → right */}
      <div className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-0.5 custom-scrollbar">
        <div className={ORG_FILTER_WRAP}>
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

        <div className={ORG_FILTER_WRAP}>
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Designation
          </label>
          <SearchableSelect
            options={designationsLists}
            value={selectedDesignation}
            onChange={onDesignationChange}
            placeholder="All Designations"
          />
        </div>

        <div className={ORG_FILTER_WRAP}>
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Users
          </label>
          <SearchableSelect
            options={personOptions}
            value={selectedPerson}
            onChange={onPersonChange}
            placeholder="All Users"
          />
        </div>
      </div>
    </div>
  );
}
