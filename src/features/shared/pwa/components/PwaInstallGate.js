"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2, LogOut, Share } from "lucide-react";
import { isPwaInstallRequired } from "@/core/utils/pwa";
import { openInstalledPwa } from "@/core/utils/pwaInstalled";
import { usePwaInstall } from "@/core/hooks/usePwaInstall";
import { useAppLogout } from "@/core/hooks/useLogout";

export default function PwaInstallGate({ children }) {
  const { isStandalone, isIos, installing, installStateReady, showInstall, showOpen, promptInstall } = usePwaInstall();
  const { handleLogout } = useAppLogout();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isPwaInstallRequired() || isStandalone) {
    return children;
  }

  const primaryClass = "w-full bg-[#1e293b] hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2";

  const handleBypass = () => {
    sessionStorage.setItem("pwa_gate_bypassed", "1");
    window.location.reload();
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#f8fafc] flex items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-sm mx-auto text-center">
        <img
          src="/logo.png"
          alt="JFL ERP"
          className="h-14 sm:h-16 w-auto max-w-[12rem] sm:max-w-[14rem] mx-auto mb-5 object-contain"
        />
        <h1 className="text-xl font-bold text-slate-900">Login successful</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">
          {isIos ? "Add app to home screen, then open from there." : showOpen ? "Open the installed app to continue." : "Install the app to continue."}
        </p>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          {!installStateReady ? (
            <Loader2 className="w-7 h-7 animate-spin text-slate-400 mx-auto" aria-label="Loading" />
          ) : isIos ? (
            <ol className="text-left text-sm text-slate-700 space-y-2 list-decimal list-inside">
              <li className="flex items-center gap-1 flex-wrap">Safari <Share className="w-4 h-4 text-blue-600 inline" /> Share</li>
              <li><strong>Add to Home Screen</strong></li>
              <li>Open <strong>JFL ERP</strong> from home screen</li>
            </ol>
          ) : showInstall ? (
            <button type="button" onClick={() => promptInstall()} disabled={installing} className={primaryClass}>
              {installing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Download size={18} />
                  Install App
                </>
              )}
            </button>
          ) : (
            <button type="button" onClick={() => openInstalledPwa(true, { sameTab: true })} className={primaryClass}>
              <ExternalLink size={18} />
              Open App
            </button>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-800 py-1"
            >
              <LogOut size={16} />
              Sign out
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

