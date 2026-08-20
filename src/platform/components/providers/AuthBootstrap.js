"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import { selectUser } from "@/platform/store/slices/authSlice";
import { useSyncAuthSession } from "@/platform/hooks/auth/useSyncAuthSession";
import { useSocket } from "@/platform/hooks/system/useSocket";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import { SESSION_SLOW_HINT, SESSION_SLOW_MESSAGE } from "@/platform/utils/global/messages";

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
        <FormPanelLoader fullScreen />
        {showRetry && (
          <div className="absolute bottom-12 text-center animate-in slide-in-from-bottom-2 duration-500 px-6 max-w-sm">
            <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">{SESSION_SLOW_MESSAGE}</p>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{SESSION_SLOW_HINT}</p>
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
