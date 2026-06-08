"use client";

import { useEffect, useState } from "react";
import { detectPwaInstalledOnDevice, openInstalledPwa } from "@/core/utils/pwaInstalled";
import { useSelector } from "react-redux";
import { selectUser } from "@/core/store/slices/authSlice";
import { isPwaStandalone } from "@/core/utils/pwa";
import { X, ExternalLink } from "lucide-react";

/**
 * Detects if the PWA is installed but the user is currently in a browser tab.
 * If so, shows a prompt to switch to the app for a better experience.
 */
export default function PwaAutoOpenHandler() {
  const user = useSelector(selectUser);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. If already in standalone mode, do nothing and clear any PWA hashes/params.
    if (isPwaStandalone()) {
      if (window.location.hash.includes("pwa-open") || window.location.search.includes("pwa_click")) {
        // Clean up the URL without triggering a navigation
        const url = new URL(window.location.href);
        url.hash = url.hash.replace("pwa-open", "");
        if (url.hash === "#") url.hash = "";
        url.searchParams.delete("pwa_click");
        window.history.replaceState(null, "", url.href);
      }
      setShowPrompt(false);
      return;
    }

    // 2. If we already have the PWA hash, it means we already tried to redirect
    // but we are still in the browser. Show the prompt as a fallback.
    if (window.location.hash.includes("pwa-open")) {
      setShowPrompt(true);
      return;
    }

    if (!user) return;

    const check = async () => {
      // Re-check standalone mode just in case
      if (isPwaStandalone()) return;

      // 3. Check if PWA is installed on this device.
      const isInstalled = await detectPwaInstalledOnDevice();
      if (!isInstalled) return;

      // 3. Check if we already tried to auto-open in this session.
      const attempted = sessionStorage.getItem("pwa_auto_open_attempted");
      const dismissed = sessionStorage.getItem("pwa_auto_open_dismissed");

      if (!attempted && !dismissed) {
        sessionStorage.setItem("pwa_auto_open_attempted", "1");
        // Do not auto-navigate — it reloads the page and clears in-progress forms.
        setShowPrompt(true);
        return;
      }

      if (dismissed) return;

      // 4. Show a prompt to open in app as a fallback.
      setShowPrompt(true);
    };

    // Small delay to let the page load and avoid jarring the user immediately.
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  const handleOpen = () => {
    openInstalledPwa(true, { sameTab: true });
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("pwa_auto_open_dismissed", "1");
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[9999] sm:left-auto sm:right-6 sm:w-80 animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 p-4 flex flex-col gap-4 overflow-hidden relative">
        {/* Decorative background element */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none" />
        
        <div className="flex items-start justify-between gap-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
              <ExternalLink size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Open in App?</h3>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                JFL ERP is installed. Switch to the app for a better experience.
              </p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={handleOpen}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-[0.98]"
          >
            Open App
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold py-2.5 rounded-xl transition-all border border-slate-200"
          >
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}
