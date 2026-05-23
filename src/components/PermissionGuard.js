"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCanAccess } from "@/hooks/useCanAccess";
import { useEffect, useState, useMemo, useCallback } from "react";
import { NAV_REGISTRY } from "@/config/navRegistry";
import { ROUTES } from "@/utils/routes";
import { useAppLogout } from "@/hooks/useLogout";
import { THEME_CONFIG } from "@/config/theme";

export default function PermissionGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { handleLogout } = useAppLogout();
  const canAccess = useCanAccess();
  const [authorized, setAuthorized] = useState(false);
  const [noAccessAtAll, setNoAccessAtAll] = useState(false);

  const hasPermissionOnly = useCallback((module) => {
    const access = canAccess(module, "view");
    return access.allowed;
  }, [canAccess]);

  const allowedModules = useMemo(() => {
    const list = [];
    const seen = new Set();
    const add = (entry) => {
      if (!entry?.href || seen.has(entry.href)) return;
      seen.add(entry.href);
      list.push(entry);
    };

    const home = NAV_REGISTRY.find((i) => i.id === "dashboard");
    if (home?.href) add(home);

    NAV_REGISTRY.forEach((item) => {
      if (item.href && item.module && hasPermissionOnly(item.module)) add(item);
      item.subItems?.forEach((sub) => {
        if (sub.href && sub.module && hasPermissionOnly(sub.module)) add(sub);
      });
    });
    return list;
  }, [hasPermissionOnly]);

  useEffect(() => {
    if (!NAV_REGISTRY || !Array.isArray(NAV_REGISTRY)) {
      setAuthorized(true);
      return;
    }

    if (allowedModules.length === 0) {
      setNoAccessAtAll(true);
      return;
    }

    let currentModule = null;
    NAV_REGISTRY.forEach((item) => {
      if (item.href === pathname) currentModule = item.module;
      if (item.subItems) {
        item.subItems.forEach((sub) => {
          if (sub.href === pathname) currentModule = sub.module;
        });
      }
    });

    if (pathname === "/") {
      router.push(allowedModules[0]?.href || ROUTES.DASHBOARD);
      return;
    }

    if (currentModule) {
      // Route visibility should follow permission only.
      // If module is deactivated, page will still open and show deactivated message.
      if (hasPermissionOnly(currentModule)) {
        setAuthorized(true);
      } else {
        router.push(allowedModules[0].href);
      }
    } else {
      setAuthorized(true);
    }
  }, [pathname, hasPermissionOnly, router, allowedModules]);
  
  
  if (noAccessAtAll) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-md text-center space-y-4 border border-slate-800 p-8 rounded-xl bg-slate-900/50 shadow-2xl">
          <div className="text-rose-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold uppercase tracking-widest text-rose-400">Access Denied</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Sorry, you do not currently have access to this portal.
            Please contact authorized personnel to assign the required permissions.
          </p>
          <button 
            onClick={handleLogout} 
            className="mt-4 px-6 py-2 bg-slate-800 hover:bg-rose-600 text-white text-xs font-bold rounded-md transition-all uppercase tracking-tighter"
          >
            Logout & Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      // <div className={`flex flex-col h-screen w-full items-center justify-center ${THEME_CONFIG.sidebarBg} `}>
      <div className={`flex flex-col h-screen w-full items-center justify-center `}>
        <div className="flex flex-col items-center gap-4">
          <div className={`w-10 h-10 border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin ${THEME_CONFIG.sidebarBorder}`} />
          
          <div className="flex flex-col items-center">
            <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${THEME_CONFIG.sidebarAccent}`}>
              JFL ERP Portal
            </p>
            <p className={`text-[9px] mt-1 opacity-50 ${THEME_CONFIG.sidebarText} animate-pulse`}>
              Verifying System Credentials...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
}