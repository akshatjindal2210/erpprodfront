"use client";

import SearchableSelect from "@/features/apps/task/components/common/SearchableSelect";

export default function ClTaskReportTopFilters({
  departmentsLists,
  designationsLists,
  personOptions,
  selectedDepartment,
  selectedDesignation,
  selectedPerson,
  onDepartmentChange,
  onDesignationChange,
  onPersonChange,
  onClearAll,
}) {
  const showClear = !!(selectedDepartment || selectedDesignation || selectedPerson);

  return (
    <div className="mb-6 space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
          <span>Dashboard</span>
          <span>/</span>
          <span>CL Task</span>
          <span>/</span>
          <span className="font-medium text-slate-500">Report</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">CL Task Report</h1>
        <p className="text-sm text-slate-500 mt-1">Day-wise CL task performance, scores & MIS impact</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-44 shrink-0 space-y-1.5">
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Department</label>
          <SearchableSelect options={departmentsLists} value={selectedDepartment} onChange={onDepartmentChange} placeholder="All Departments" />
        </div>
        <div className="w-full sm:w-44 shrink-0 space-y-1.5">
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Designation</label>
          <SearchableSelect options={designationsLists} value={selectedDesignation} onChange={onDesignationChange} placeholder="All Designations" />
        </div>
        <div className="w-full sm:w-52 shrink-0 space-y-1.5 md:w-64">
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Person</label>
          <SearchableSelect options={personOptions} value={selectedPerson} onChange={onPersonChange} placeholder="All Persons" />
        </div>
        {showClear && (
          <button
            type="button"
            onClick={onClearAll}
            className="h-[42px] px-4 text-xs font-bold text-rose-600 border border-slate-200 rounded-xl hover:bg-rose-50"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
