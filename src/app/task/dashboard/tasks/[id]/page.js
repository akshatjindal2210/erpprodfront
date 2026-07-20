"use client";

import { Suspense } from "react";
import TaskDetailPage from "@/features/apps/task/components/tasks/SubPage";

function DetailFallback() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[40vh] text-slate-400 text-sm">
      Loading task…
    </div>
  );
}

export default function TaskDetailRoutePage() {
  return (
    <Suspense fallback={<DetailFallback />}>
      <TaskDetailPage />
    </Suspense>
  );
}
