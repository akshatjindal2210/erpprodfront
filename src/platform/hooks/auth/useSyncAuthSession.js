"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import { setCredentials } from "@/platform/store/slices/authSlice";
import { userService } from "@/common/auth/services/userService";
import { applyListViewSpanFromSession } from "@/platform/utils/global";
import { isNetworkReachabilityError, notifyNetworkUnreachable } from "@/platform/utils/auth/companyNetwork";
import { buildCredentialsFromMe } from "@/platform/utils/auth/authProfile";
import { clearAuthSession } from "@/platform/utils/auth/clearAuthSession";

/**
 * When the cookie session is still valid but Redux is empty — refetch user + permissions from `/users/me`.
 * @returns {boolean} sessionReady — true once rehydrated user exists or `/me` has finished (success or fail).
 */
export function useSyncAuthSession() {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const user = useSelector((state) => state.auth.user);
  const userId = user?.id;
  const [sessionReady, setSessionReady] = useState(() => Boolean(userId));

  useEffect(() => {
    if (userId) {
      setSessionReady(true);
      return;
    }

    const isLoginPage = pathname === "/login" || pathname?.startsWith("/login/");
    if (isLoginPage) {
      setSessionReady(true);
      return;
    }

    // After intentional/forced logout — cookie already cleared; do not call /me.
    if (typeof window !== "undefined" && sessionStorage.getItem("imp_skip_auth_sync") === "1") {
      sessionStorage.removeItem("imp_skip_auth_sync");
      setSessionReady(true);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (active) controller.abort();
    }, 10000);

    setSessionReady(false);

    (async () => {
      try {
        const res = await userService.me({
          signal: controller.signal,
          expectStatuses: [401, 403, 404],
        });
        clearTimeout(timeoutId);
        if (!active) return;

        if (res?.success && res.data?.id) {
          applyListViewSpanFromSession(res.data);
          dispatch(setCredentials(buildCredentialsFromMe(res.data)));
        } else if (res?.status === 401 || res?.status === 403 || res?.status === 404) {
          await clearAuthSession();
        }
      } catch (err) {
        if (!active) return;

        if (isNetworkReachabilityError(err)) {
          notifyNetworkUnreachable();
        } else if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
          await clearAuthSession();
        }
      } finally {
        if (active) {
          setSessionReady(true);
        }
      }
    })();

    return () => {
      active = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [userId, dispatch, pathname]);

  return sessionReady;
}
