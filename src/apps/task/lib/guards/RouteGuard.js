"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { selectRole, selectPermissions, selectAppAccess } from "@/platform/store/slices/authSlice";
import { userHasAppAccess } from "@/config/moduleAppRegistry";
import { hasAccess, getTaskHomePath } from "@/apps/task/lib/config/appConfig";

export default function RouteGuard({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const user     = useSelector((s) => s.auth.user);
  const role     = useSelector(selectRole);
  const permissions = useSelector(selectPermissions);
  const appAccess   = useSelector(selectAppAccess);

  const [status, setStatus] = useState("checking");

  useEffect(() => {
    if (!user) {
      if (pathname !== "/login" && !pathname?.startsWith("/login/")) {
        router.replace(`/login?redirect=${pathname}`);
      }
      return;
    }

    // 1. Check App Level Access
    if (!userHasAppAccess("task", role, permissions, appAccess)) {
      setStatus("denied");
      router.replace("/home?unauthorized=task");
      return;
    }

    // 2. Check Code Level Access (Role-based)
    if (!hasAccess(role, pathname, user)) {
      setStatus("denied");
      router.replace(`${getTaskHomePath(role)}?unauthorized=true`);
      return;
    }

    setStatus("allowed");
  }, [pathname, user, role, permissions, appAccess, router]);

  if (status === "checking") return null;
  if (status === "denied")   return null;
  return <>{children}</>;
}
