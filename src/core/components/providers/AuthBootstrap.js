"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import { selectUser } from "@/core/store/slices/authSlice";
import { useSyncAuthSession } from "@/core/hooks/useSyncAuthSession";
import { useSocket } from "@/core/hooks/useSocket";
import FormPanelLoader from "@/core/components/common/FormPanelLoader";
import { COMPANY_WIFI_HINT, COMPANY_WIFI_MESSAGE } from "@/core/utils/global/messages";

/** Wait for redux-persist rehydrate (via PersistGate) then sync cookie session if Redux is empty. */
export default function AuthBootstrap({ children }) {
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const sessionReady = useSyncAuthSession();
  const isLoginPage = pathname === "/login" || pathname?.startsWith("/login/");
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (!isLoginPage && !user && !sessionReady) {
      const timer = setTimeout(() => setShowRetry(true), 6000);
      return () => clearTimeout(timer);
    } else {
      setShowRetry(false);
    }
  }, [isLoginPage, user, sessionReady]);

  // Live permission / app_access updates (admin saves → this user's socket → /me).
  const socketUserId =
    !isLoginPage && user?.id != null && user.id !== ""
      ? Number(user.id)
      : null;
  useSocket(socketUserId != null && !Number.isNaN(socketUserId) ? socketUserId : null);

  if (!isLoginPage && !user && !sessionReady) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#f8fafc]">
        <FormPanelLoader
          label="Loading..."
          hint="Please wait."
          minHeight="min-h-screen"
          className="border-0 rounded-none bg-transparent w-full"
        />
        {showRetry && (
          <div className="absolute bottom-12 text-center animate-in slide-in-from-bottom-2 duration-500 px-6 max-w-sm">
            <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">{COMPANY_WIFI_MESSAGE}</p>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{COMPANY_WIFI_HINT}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm text-[11px] text-indigo-600 font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  return children;
}
