"use client";

import DashboardBuilder from "@/common/dashboard-builder/components/DashboardBuilder";

export default function HrmsDashboardPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full">
      <DashboardBuilder readOnly={true} appKey="hrms" pageKey="dashboard" emptyTitle="HRMS" />
    </div>
  );
}
