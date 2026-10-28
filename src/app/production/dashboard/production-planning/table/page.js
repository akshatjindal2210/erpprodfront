import { Suspense } from "react";
import PlanTablePage from "@/apps/production/modules/plan/PlanTablePage";

export const metadata = {
  title: "Planning Table",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlanTablePage />
    </Suspense>
  );
}
