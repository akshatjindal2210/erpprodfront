"use client";

import PwaInstallGate from "@/features/shared/pwa/components/PwaInstallGate";
import TaskRootLayout from "@/features/apps/task/components/ui/layouts/RootLayout";

export default function TaskAppLayout({ children }) {
  return (
    <PwaInstallGate>
      <TaskRootLayout>{children}</TaskRootLayout>
    </PwaInstallGate>
  );
}

