import { redirect } from "next/navigation";
import { ROUTES } from "@/apps/rmstore/lib/utils/routes";

export default function Page() {
  redirect(ROUTES.RM_MRN_PORTAL);
}
