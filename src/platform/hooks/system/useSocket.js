import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePathname, useRouter } from "next/navigation";
import { setCredentials, logout, selectRole, selectUser, selectPermissions, selectAppAccess } from "@/platform/store/slices/authSlice";
import { io } from "socket.io-client";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";
import { userService } from "@/common/auth/services/userService";
import { applyListViewSpanFromSession } from "@/platform/utils/global";
import { bindTaskNotifySocket } from "@/common/pwa/task/taskNotifySocket";
import { authProfileUnchanged, buildCredentialsFromMe } from "@/platform/utils/auth/authProfile";
import { persistor } from "@/platform/store/index";

function closeSocketQuietly(socket) {
  if (!socket) return;
  socket.io.opts.reconnection = false;
  const engine = socket.io?.engine;
  if (engine?.readyState === "opening") {
    engine.close();
    return;
  }
  if (socket.connected) {
    socket.disconnect();
  }
}

const VISIBILITY_REFRESH_MS = 60_000;
const AUTH_REFRESH_MS = 8_000;

export const useSocket = (userId) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const role = useSelector(selectRole);
  const permissions = useSelector(selectPermissions);
  const appAccess = useSelector(selectAppAccess);
  const userRef = useRef(user);
  const roleRef = useRef(role);
  const permissionsRef = useRef(permissions);
  const appAccessRef = useRef(appAccess);
  const lastAuthRefreshAtRef = useRef(0);
  const clearingSessionRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
    roleRef.current = role;
    permissionsRef.current = permissions;
    appAccessRef.current = appAccess;
  }, [user, role, permissions, appAccess]);

  const clearSessionAndRedirect = useCallback(async () => {
    if (clearingSessionRef.current) return;
    clearingSessionRef.current = true;
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("imp_skip_auth_sync", "1");
      }
      dispatch(logout());
      try {
        await persistor.purge();
      } catch {
        /* ignore */
      }
      const path = pathname || "/";
      if (path !== "/login" && !path.startsWith("/login/")) {
        router.replace(`/login?redirect=${encodeURIComponent(path)}`);
      }
    } finally {
      clearingSessionRef.current = false;
    }
  }, [dispatch, pathname, router]);

  const refreshAuthFromServer = useCallback(async (force = false) => {
    const currentUser = userRef.current;
    if (!currentUser?.id) return;

    // Logout in progress — cookie already cleared; avoid noisy 401 from /me.
    if (typeof window !== "undefined" && sessionStorage.getItem("imp_skip_auth_sync") === "1") {
      return;
    }

    const now = Date.now();
    if (!force && now - lastAuthRefreshAtRef.current < AUTH_REFRESH_MS) return;

    try {
      const res = await userService.me({ expectStatuses: [401, 403] });
      lastAuthRefreshAtRef.current = Date.now();

      if (res?.status === 401 || res?.status === 403) {
        await clearSessionAndRedirect();
        return;
      }

      const me = res?.data;
      if (!res?.success || !me?.id) return;

      applyListViewSpanFromSession(me);

      if (
        authProfileUnchanged(currentUser, roleRef.current, me, {
          permissions: permissionsRef.current,
          app_access: appAccessRef.current,
        })
      ) {
        return;
      }

      dispatch(setCredentials(buildCredentialsFromMe(me, currentUser)));
    } catch (err) {
      const st = err?.status;
      if (st === 401 || st === 403) {
        await clearSessionAndRedirect();
        return;
      }
      console.error("Failed to refresh auth after socket update:", err);
    }
  }, [dispatch, clearSessionAndRedirect]);

  const refreshRef = useRef(refreshAuthFromServer);
  useEffect(() => {
    refreshRef.current = refreshAuthFromServer;
  }, [refreshAuthFromServer]);

  useEffect(() => {
    const uid = userId != null && userId !== "" ? Number(userId) : null;
    if (!uid || Number.isNaN(uid)) return;

    const socket = io(FILE_BASE_URL, {
      withCredentials: true,
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    let lastVisibilityRefreshAt = 0;

    const onPermissionsUpdated = (data) => {
      const currentUser = userRef.current;
      if (!currentUser?.id) return;
      if (data?.user_id != null && Number(data.user_id) !== Number(currentUser.id)) return;
      void refreshRef.current(true);
    };

    const onConnect = () => {
      void refreshRef.current(false);
    };

    socket.on("connect", onConnect);
    socket.on("permissions_updated", onPermissionsUpdated);
    socket.on("module_status_updated", onPermissionsUpdated);

    const unbindTaskPush = bindTaskNotifySocket(socket);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibilityRefreshAt < VISIBILITY_REFRESH_MS) return;
      lastVisibilityRefreshAt = now;
      void refreshRef.current(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      socket.off("connect", onConnect);
      socket.off("permissions_updated", onPermissionsUpdated);
      socket.off("module_status_updated", onPermissionsUpdated);
      unbindTaskPush();
      closeSocketQuietly(socket);
    };
  }, [userId]);
};
