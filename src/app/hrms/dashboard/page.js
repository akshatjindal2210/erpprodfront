import { redirect } from "next/navigation";
import { ROUTES } from "@/apps/hrms/lib/utils/routes";

export default function HrmsDashboardHome() {
  redirect(ROUTES.HRMS_ATTENDANCE);
}