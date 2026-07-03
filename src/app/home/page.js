import DashboardBuilder from "@/features/dashboard-builder/components/DashboardBuilder";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full">
      <DashboardBuilder readOnly={true} appKey="home" pageKey="dashboard" emptyTitle="Home" />
    </div>
  );
}
