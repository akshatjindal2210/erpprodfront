"use client";

import { useCallback } from "react";
import { clearAuthSession } from "@/platform/utils/auth/clearAuthSession";

export const useAppLogout = () => {
  const handleLogout = useCallback(async () => {
    if (!window.confirm("Are you sure you want to logout?")) return;
    await clearAuthSession();
  }, []);

  return { handleLogout };
};
