import DashboardBuilder from "@/common/dashboard-builder/components/DashboardBuilder";

export default function TaskDashboardPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full">
      <DashboardBuilder readOnly={true} appKey="task" pageKey="dashboard" emptyTitle="Task" />
    </div>
  );
}
