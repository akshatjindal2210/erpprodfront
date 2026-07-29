"use client";
import ActivityLogList from "@/common/dashboard/components/ActivityLogList";

export default function ActivityLogsPage() {
  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <ActivityLogList appType="portal" title="Portal Activity Logs" />
      </div>
    </div>
  );
}
