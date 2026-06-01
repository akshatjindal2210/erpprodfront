"use client";

import { useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import { selectUser } from "@/core/store/slices/authSlice";
import { useSyncAuthSession } from "@/core/hooks/useSyncAuthSession";
import { useSocket } from "@/core/hooks/useSocket";
import FormPanelLoader from "@/core/components/common/FormPanelLoader";

/** Wait for redux-persist rehydrate (via PersistGate) then sync cookie session if Redux is empty. */
export default function AuthBootstrap({ children }) {
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const sessionReady = useSyncAuthSession();
  const isLoginPage = pathname === "/login" || pathname?.startsWith("/login/");

  // Live permission / app_access updates (admin saves → this user's socket → /me).
  useSocket(!isLoginPage && user?.id ? user.id : null);

  if (!isLoginPage && !user && !sessionReady) {
    return (
      <FormPanelLoader
        label="Loading..."
        hint="Please wait."
        minHeight="min-h-screen"
        className="border-0 rounded-none bg-[#f8fafc] w-full"
      />
    );
  }

  return children;
}
