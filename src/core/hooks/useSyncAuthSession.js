"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { setCredentials, logout } from "@/core/store/slices/authSlice";
import { userService } from "@/features/shared/auth/services/userService";
import { applyListViewSpanFromSession } from "@/core/utils/global";
import { persistor } from "@/core/store/index";
import { isNetworkReachabilityError, notifyNetworkUnreachable } from "@/core/utils/companyNetwork";
import { buildCredentialsFromMe } from "@/core/utils/authProfile";

/**
 * When the cookie session is still valid but Redux is empty — refetch user + permissions from `/users/me`.
 * @returns {boolean} sessionReady — true once rehydrated user exists or `/me` has finished (success or fail).
 */
export function useSyncAuthSession() {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector((state) => state.auth.user);
  const userId = user?.id;
  const [sessionReady, setSessionReady] = useState(() => Boolean(userId));

  useEffect(() => {
    if (userId) {
      setSessionReady(true);
      return;
    }

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
        const res = await userService.me({ signal: controller.signal });
        clearTimeout(timeoutId);
        if (!active) return;

        if (res?.success && res.data?.id) {
          applyListViewSpanFromSession(res.data);
          dispatch(setCredentials(buildCredentialsFromMe(res.data)));
        }
      } catch (err) {
        if (!active) return;

        if (isNetworkReachabilityError(err)) {
          notifyNetworkUnreachable();
        } else {
          const st = err?.status;
          if (st === 401 || st === 403 || st === 404) {
            dispatch(logout());
            try {
              await persistor.purge();
            } catch {
              /* ignore */
            }
            if (pathname !== "/login" && !pathname?.startsWith("/login/")) {
              router.replace(`/login?redirect=${pathname}`);
            }
          }
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
  }, [userId, dispatch, router, pathname]);

  return sessionReady;
}
