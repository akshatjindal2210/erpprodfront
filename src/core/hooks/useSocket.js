import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials, selectRole, selectUser } from "@/core/store/slices/authSlice";
import { normalizeAppAccess } from "@/config/moduleAppRegistry";
import { io } from "socket.io-client";
import { FILE_BASE_URL } from "@/core/utils/lib";
import { userService } from "@/features/shared/auth/services/userService";
import { applyListViewSpanFromSession } from "@/core/utils/global";
import { bindTaskNotifySocket } from "@/features/apps/task/pwa/taskNotifySocket";

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

function authPayloadUnchanged(currentUser, role, me) {
  if (!currentUser?.id || !me?.id) return false;
  if (Number(currentUser.id) !== Number(me.id)) return false;

  const nextRole = me.type ?? me.role ?? role ?? "user";
  const prevRole = currentUser.role ?? role ?? "user";
  if (String(prevRole) !== String(nextRole)) return false;

  const prevPerms = JSON.stringify(currentUser.permissions ?? []);
  const nextPerms = JSON.stringify(Array.isArray(me.permissions) ? me.permissions : []);
  if (prevPerms !== nextPerms) return false;

  const prevApps = JSON.stringify(normalizeAppAccess(currentUser.app_access));
  const nextApps = JSON.stringify(normalizeAppAccess(me.app_access));
  return prevApps === nextApps;
}

const VISIBILITY_REFRESH_MS = 60_000;

export const useSocket = (userId) => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const role = useSelector(selectRole);
  const userRef = useRef(user);
  const roleRef = useRef(role);

  useEffect(() => {
    userRef.current = user;
    roleRef.current = role;
  }, [user, role]);

  const refreshAuthFromServer = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser?.id) return;

    try {
      const res = await userService.me();
      const me = res?.data;
      if (!res?.success || !me?.id) return;

      applyListViewSpanFromSession(me);

      if (authPayloadUnchanged(currentUser, roleRef.current, me)) return;

      dispatch(
        setCredentials({
          id: me.id,
          name: me.name ?? currentUser.name,
          email: me.email ?? currentUser.email,
          role: me.type ?? me.role ?? roleRef.current ?? "user",
          permissions: Array.isArray(me.permissions) ? me.permissions : [],
          app_access: normalizeAppAccess(me.app_access),
        }),
      );
    } catch (err) {
      console.error("Failed to refresh auth after socket update:", err);
    }
  }, [dispatch]);

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
      void refreshRef.current();
    };

    const onConnect = () => {
      void refreshRef.current();
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
      void refreshRef.current();
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
