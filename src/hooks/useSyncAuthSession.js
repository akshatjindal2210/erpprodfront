"use client";

import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { setCredentials, logout, selectUser } from "@/features/authSlice";
import { userService } from "@/services/user";
import { applyListViewSpanFromSession } from "@/global";
import { persistor } from "@/store/index";

/**
 * When the cookie session is still valid but Redux is empty — refetch user + permissions from `/users/me`.
 */
export function useSyncAuthSession() {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useSelector(selectUser);
  const fetching = useRef(false);

  useEffect(() => {
    if (user) return;
    if (typeof window !== "undefined" && sessionStorage.getItem("imp_skip_auth_sync") === "1") {
      sessionStorage.removeItem("imp_skip_auth_sync");
      return;
    }
    if (fetching.current) return;
    fetching.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await userService.me();
        if (cancelled) return;

        if (!res?.success) return;

        const d = res.data;
        if (!d?.id) return;

        applyListViewSpanFromSession(d);

        dispatch(
          setCredentials({
            id: d.id,
            name: d.name || "",
            email: d.email ?? "",
            role: d.role ?? d.type ?? "user",
            permissions: Array.isArray(d.permissions) ? d.permissions : [],
          })
        );
      } catch (err) {
        if (cancelled) return;

        const st = err?.status;
        if (st === 401 || st === 403 || st === 404) {
          dispatch(logout());
          try {
            await persistor.purge();
          } catch {
            /* ignore */
          }
          router.replace("/login");
        }
      } finally {
        if (!cancelled) fetching.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, dispatch, router]);
}
