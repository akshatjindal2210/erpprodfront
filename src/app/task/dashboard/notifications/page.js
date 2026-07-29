"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/apps/settings/configuration/utils/routes";

/** Legacy Task URL — notifications live in Admin Console now. */
export default function TaskNotificationsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(ROUTES.SETTINGS_NOTIFICATIONS);
  }, [router]);

  return null;
}
