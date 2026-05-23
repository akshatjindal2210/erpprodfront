"use client";

import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { logout } from "@/features/authSlice";
import { userService } from "@/services/user";
import { masterService } from "@/services/master";
import { toast } from "react-toastify";
import { persistor } from "@/store";

export const useAppLogout = () => {
  const router = useRouter();
  const dispatch = useDispatch();

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to logout?")) return;

    /* Stop useSyncAuthSession from calling /users/me after cookie is cleared (would 401). */
    if (typeof window !== "undefined") {
      sessionStorage.setItem("imp_skip_auth_sync", "1");
    }

    try {
      await userService.logout(); // backend logout & cookie clear
      masterService.clearCache(); // clear preloaded master data cache
      dispatch(logout()); // redux state clear
      await persistor.purge(); // persisted storage clear
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      dispatch(logout());
      await persistor.purge();
      toast.error("Logout failed, cleared locally");
      router.push("/login");
    }
  };

  return { handleLogout };
};