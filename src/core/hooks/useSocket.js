import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials, selectRole, selectUser } from "@/core/store/slices/authSlice";
import { normalizeAppAccess } from "@/config/moduleAppRegistry";
import { io } from "socket.io-client";
import { FILE_BASE_URL } from "@/core/utils/lib";
import { userService } from "@/features/shared/auth/services/userService";

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
    if (!userId) return;

    const socket = io(FILE_BASE_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
    });

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

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      socket.off("connect", onConnect);
      socket.off("permissions_updated", onPermissionsUpdated);
      socket.off("module_status_updated", onPermissionsUpdated);
      socket.disconnect();
    };
  }, [userId]);
};
