"use client";

import { Plus } from "lucide-react";
import SearchableSelect from "@/apps/task/lib/ui/common/SearchableSelect";

export default function RedTicketTopFilters({
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Dashboard</span>
            <span>/</span>
            <span className="font-medium text-slate-500">Red Ticket</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Red Ticket Panel</h1>
          <p className="text-sm text-slate-500 mt-1">Minus score impacts overall MIS score</p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700"
          >
            <Plus size={16} />
            Create Red Ticket
          </button>
        )}
      </div>

      <div className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-0.5">
        <div className="w-44 shrink-0 space-y-1.5 sm:w-52">
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Department</label>
          <SearchableSelect options={departmentsLists} value={selectedDepartment} onChange={onDepartmentChange} placeholder="All Departments" />
        </div>
        <div className="w-44 shrink-0 space-y-1.5 sm:w-52">
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Designation</label>
          <SearchableSelect options={designationsLists} value={selectedDesignation} onChange={onDesignationChange} placeholder="All Designations" />
        </div>
        <div className="w-52 shrink-0 space-y-1.5 sm:w-64">
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Users</label>
          <SearchableSelect options={personOptions} value={selectedPerson} onChange={onPersonChange} placeholder="All Users" />
        </div>
      </div>
    </div>
  );
}
