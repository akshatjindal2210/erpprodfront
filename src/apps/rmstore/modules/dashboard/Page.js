"use client";

import DashboardBuilder from "@/common/dashboard-builder/components/DashboardBuilder";

export default function RmStoreDashboardPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full">
      <DashboardBuilder
        readOnly={true}
        appKey="rmstore"
        pageKey="dashboard"
        emptyTitle="RM Store"
      />
    </div>
  );
}
