import DashboardBuilder from "@/features/dashboard-builder/components/DashboardBuilder";

export default function DashboardViewerPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full">
      <DashboardBuilder readOnly={true} appKey="ims" pageKey="dashboard" emptyTitle="IMS" />
    </div>
  );
}
