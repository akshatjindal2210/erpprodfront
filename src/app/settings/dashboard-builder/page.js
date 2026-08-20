import DashboardBuilder from "@/common/dashboard-builder/components/DashboardBuilder";

export default function SettingsDashboardBuilderPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full">
      <DashboardBuilder appKey="settings" pageKey="dashboard" />
    </div>
  );
}
