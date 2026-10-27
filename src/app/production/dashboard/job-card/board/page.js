import { redirect } from "next/navigation";
import { ROUTES } from "@/apps/production/lib/utils/routes";

/** Legacy path — Board moved under Production Planning. */
export default function Page() {
  redirect(ROUTES.PRODUCTION_JOB_CARD_BOARD);
}
