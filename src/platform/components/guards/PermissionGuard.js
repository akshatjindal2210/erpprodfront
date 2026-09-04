"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { selectRole } from "@/platform/store/slices/authSlice";
import { NAV_REGISTRY } from "@/apps/ims/lib/config/navRegistry";
import { SETTINGS_NAV_REGISTRY } from "@/apps/settings/configuration/config/settingsNavRegistry";
import { RM_STORE_NAV_REGISTRY } from "@/apps/rmstore/lib/config/navRegistry";
import { HRMS_NAV_REGISTRY } from "@/apps/hrms/lib/config/navRegistry";
import { ROUTES } from "@/config/routes";
import { useAppLogout } from "@/platform/hooks/auth/useLogout";
import { THEME_CONFIG } from "@/config/theme";

const normalizePath = (value) => {
  const path = String(value || "").trim();
  if (!path) return "/";
  if (path === "/") return path;
  return path.replace(/\/+$/, "");
};

export default function PermissionGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { handleLogout } = useAppLogout();
  const canAccess = useCanAccess();
  const role = useSelector(selectRole);
  const currentPath = useMemo(() => normalizePath(pathname), [pathname]);

  const canSeeNavItem = useCallback((item) => {
    if (item.roles?.length) {
      return item.roles.includes(role?.toLowerCase());
    }
    return true;
  }, [role]);

  const hasPermissionOnly = useCallback((module) => {
    const access = canAccess(module, "view");
    return access.allowed;
  }, [canAccess]);

  const allowedModules = useMemo(() => {
    const list = [];
    const seen = new Set();
    const add = (entry) => {
      const href = normalizePath(entry?.href);
      if (!entry?.href || seen.has(href)) return;
      seen.add(href);
      list.push(entry);
    };

    const home = NAV_REGISTRY.find((i) => i.id === "dashboard");
    if (home?.href) add(home);

    const collectFromRegistry = (registry) => {
      registry.forEach((item) => {
        if (!canSeeNavItem(item)) return;
        if (item.href && (!item.module || hasPermissionOnly(item.module))) add(item);
        item.subItems?.forEach((sub) => {
          if (!canSeeNavItem(sub)) return;
          if (sub.href && (!sub.module || hasPermissionOnly(sub.module))) add(sub);
        });
      });
    };

    collectFromRegistry(NAV_REGISTRY);
    collectFromRegistry(SETTINGS_NAV_REGISTRY);
    collectFromRegistry(RM_STORE_NAV_REGISTRY);
    collectFromRegistry(HRMS_NAV_REGISTRY);
    return list;
  }, [hasPermissionOnly, canSeeNavItem]);

  const { authorized, noAccessAtAll } = useMemo(() => {
    if (!NAV_REGISTRY || !Array.isArray(NAV_REGISTRY)) {
      return { authorized: true, noAccessAtAll: false };
    }

    if (allowedModules.length === 0) {
      return { authorized: false, noAccessAtAll: true };
    }

    let currentModule = null;
    let requiredRoles = null;
    let matchedRoute = false;
    const resolveModule = (registry) => {
      registry.forEach((item) => {
        if (normalizePath(item.href) === currentPath) {
          currentModule = item.module;
          requiredRoles = item.roles;
          matchedRoute = true;
        }
        item.subItems?.forEach((sub) => {
          if (normalizePath(sub.href) === currentPath) {
            currentModule = sub.module;
            requiredRoles = sub.roles;
            matchedRoute = true;
          }
        });
      });
    };
    resolveModule(NAV_REGISTRY);
    resolveModule(SETTINGS_NAV_REGISTRY);
    resolveModule(RM_STORE_NAV_REGISTRY);
    resolveModule(HRMS_NAV_REGISTRY);

    if (currentPath === "/") {
      return { authorized: false, noAccessAtAll: false };
    }

    if (requiredRoles && !requiredRoles.includes(role?.toLowerCase())) {
      return { authorized: false, noAccessAtAll: false };
    }

    if (currentModule) {
      if (hasPermissionOnly(currentModule)) {
        return { authorized: true, noAccessAtAll: false };
      } else {
        return { authorized: false, noAccessAtAll: false };
      }
    }

    // Route exists in nav registry and has no module gate.
    if (matchedRoute) {
      return { authorized: true, noAccessAtAll: false };
    }

    // Route not in nav registry — only app dashboard home is open without a module gate.
    const isOpenDashboard =
      currentPath === normalizePath(ROUTES.DASHBOARD) ||
      currentPath === "/ims/dashboard" ||
      currentPath === "/ims/dashboard/builder" ||
      currentPath === "/rmstore/dashboard" ||
      currentPath === "/hrms/dashboard" ||
      currentPath === "/task/dashboard" ||
      currentPath === "/settings" ||
      currentPath === normalizePath(ROUTES.SETTINGS_DASHBOARD) ||
      currentPath === normalizePath(ROUTES.SETTINGS_DASHBOARD_BUILDER) ||
      currentPath === normalizePath(ROUTES.SETTINGS_NOTIFICATIONS) ||
      currentPath === normalizePath(ROUTES.DASHBOARD_BUILDER);
    return { authorized: isOpenDashboard, noAccessAtAll: false };
  }, [currentPath, hasPermissionOnly, allowedModules, role]);

  useEffect(() => {
    if (pathname === "/" && allowedModules.length > 0) {
      router.push(allowedModules[0]?.href || ROUTES.DASHBOARD);
    } else if (!authorized && !noAccessAtAll && allowedModules.length > 0) {
      router.push(allowedModules[0].href);
    }
  }, [pathname, authorized, noAccessAtAll, allowedModules, router]);
  
  
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
              Please wait…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
