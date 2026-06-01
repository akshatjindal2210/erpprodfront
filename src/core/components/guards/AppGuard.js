"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { selectRole, selectPermissions, selectAppAccess } from "@/core/store/slices/authSlice";
import { userHasAppAccess } from "@/config/moduleAppRegistry";
import { ROUTES } from "@/config/routes";
import { THEME_CONFIG } from "@/config/theme";

export default function AppGuard({ children, appId }) {
  const role = useSelector(selectRole);
  const permissions = useSelector(selectPermissions);
  const appAccess = useSelector(selectAppAccess);
  const router = useRouter();
  
  const allowed = userHasAppAccess(appId, role, permissions, appAccess);

  useEffect(() => {
    if (!allowed) {
      router.replace(ROUTES.HOME + "?unauthorized=" + appId);
    }
  }, [allowed, router, appId]);

  if (!allowed) {
    return (
      <div className={`flex h-screen w-full items-center justify-center ${THEME_CONFIG.sidebarBg}`}>
        <div className={`w-10 h-10 border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin`} />
      </div>
    );
  }

  return children;
}

