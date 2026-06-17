"use client";

import { AlertTriangle } from "lucide-react";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useClTaskFilters } from "@/features/apps/task/hooks/useClTaskFilters";
import ClTaskReportTopFilters from "./ClTaskReportTopFilters";
import ReportDayView from "./ReportDayView";

export default function ClTaskReportPage() {
  const canAccess = useCanAccess();
  const canView = canAccess("task_report", "view").allowed;

  const {
    selectedDepartment,
    setSelectedDepartment,
    selectedDesignation,
    setSelectedDesignation,
    selectedPerson,
    setSelectedPerson,
    departmentsLists,
    designationsLists,
    personOptions,
    clearFilters,
  } = useClTaskFilters();

  if (!canView) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertTriangle className="mx-auto mb-3 text-amber-400" size={32} />
        <p className="font-medium">You do not have permission to view CL Task Report.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-screen text-slate-800">
      <ClTaskReportTopFilters
        departmentsLists={departmentsLists}
        designationsLists={designationsLists}
        personOptions={personOptions}
        selectedDepartment={selectedDepartment}
        selectedDesignation={selectedDesignation}
        selectedPerson={selectedPerson}
        onDepartmentChange={setSelectedDepartment}
        onDesignationChange={setSelectedDesignation}
        onPersonChange={setSelectedPerson}
        onClearAll={() => clearFilters()}
      />

      <ReportDayView
        filters={{
          selectedDepartment,
          selectedDesignation,
          selectedPerson,
        }}
      />
    </div>
  );
}
