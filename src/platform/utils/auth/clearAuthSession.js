"use client";

import { store, persistor } from "@/platform/store/index";
import { logout } from "@/platform/store/slices/authSlice";
import { API_BASE_URL } from "@/platform/utils/core/lib";
import { CORE_ENDPOINTS } from "@/platform/api/endpoints";

let clearing = false;

/** Cookie clear + Redux clear + go to /login. */
export async function clearAuthSession() {
  if (clearing) return;
  clearing = true;
  try {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("imp_skip_auth_sync", "1");
    }
    try {
      await fetch(`${API_BASE_URL}${CORE_ENDPOINTS.AUTH.LOGOUT}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch {
      /* still clear local */
    }
    store.dispatch(logout());
    try {
      await persistor.purge();
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const path = `${window.location.pathname}${window.location.search || ""}`;
      window.location.assign(`/login?redirect=${encodeURIComponent(path)}`);
    }
  } finally {
    clearing = false;
  }
}

export function isAuthSessionClearing() {
  return clearing;
}
