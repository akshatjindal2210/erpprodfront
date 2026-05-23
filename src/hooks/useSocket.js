import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials, selectRole, selectUser } from "@/features/authSlice";
import { io } from "socket.io-client";
import { FILE_BASE_URL } from "@/utils/lib";
import { userService } from "@/services/user";

export const useSocket = (userId) => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const role = useSelector(selectRole);

  useEffect(() => {
    if (!userId) return;

    const socket = io(FILE_BASE_URL, { withCredentials: true });
    // const socket = io("http://localhost:8000", { withCredentials: true });

    socket.on("connect", () => {
      // console.log("Connected to socket server");
    });

    socket.on("permissions_updated", (permissions) => {
      if (user && user.id != null) {
        dispatch(
          setCredentials({
            id: user.id,
            name: user.name,
            email: user.email,
            role,
            permissions: Array.isArray(permissions) ? permissions : [],
          }),
        );
      }
    });

    const refreshAuthFromServer = async () => {
      try {
        const res = await userService.me();
        const me = res?.data;
        if (!me) return;
        dispatch(
          setCredentials({
            id: me.id,
            name: me.name,
            email: me.email,
            role: me.type || role || "user",
            permissions: me.permissions || [],
          }),
        );
      } catch (err) {
        // Silent fail: existing session state remains until next normal refresh.
        console.error("Failed to refresh auth after socket update:", err);
      }
    };

    socket.on("module_status_updated", refreshAuthFromServer);

    return () => {
      socket.off("module_status_updated", refreshAuthFromServer);
      socket.disconnect();
    };
  }, [userId, user, role, dispatch]);
};
