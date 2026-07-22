"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useAppLogout } from "@/core/hooks/useLogout";
import { SIDEBAR_MENU, hasAccess, canShowTaskReportMenu } from "@/features/apps/task/config/appConfig";
import { useSidebarCollapse } from "@/features/apps/task/hooks/useViewMode";
import { useCanAccess } from "@/core/hooks/useCanAccess";

export default function Sidebar({ sidebarOpen, setSidebarOpen, userRole, currentUser }) {
  const pathname = usePathname();
  const { handleLogout } = useAppLogout();
  const canAccess = useCanAccess();
  const [openMenus, setOpenMenus] = useState({});

  const toggleAccordion = (name) => {
    setOpenMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const getAccess = (item) => {
    // Task Report — manager/admin only (not executive user)
    if (item.href === "/task/dashboard/reports") {
      return canShowTaskReportMenu(userRole, currentUser);
    }

    // 1. Check App Level Access (via global canAccess hook)
    if (item.module) {
      const access = canAccess(item.module, "view");
      if (!access.allowed) return false;
    }

    // 2. Check Code Level Access (via Task-specific role logic)
    if (item.roles) {
      const normalizedRole =
        userRole === "team" ? "executive_assistant" : String(userRole || "").toLowerCase();
      if (!item.roles.includes(normalizedRole)) return false;
    }

    return hasAccess(userRole, item.href, currentUser);
  };

  const menuItems = SIDEBAR_MENU.filter(item => {
    const hasParentAccess = getAccess(item);
    const hasSubAccess = item.subItems?.some(sub => getAccess(sub));
    return hasParentAccess || hasSubAccess;
  });

  const [collapsed, toggleCollapsed, isLoaded] = useSidebarCollapse(false);

  useEffect(() => {
    const newOpenMenus = {};
    menuItems.forEach((item) => {
      if (item.subItems && item.subItems.some((sub) => pathname.startsWith(sub.href))) {
        newOpenMenus[item.name] = true;
      }
    });
    setOpenMenus((prev) => ({ ...prev, ...newOpenMenus }));
  }, [pathname, menuItems.length]);

  if (!isLoaded) return null;

  const renderNavItem = (item, isSub = false) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    const hasSub = item.subItems && item.subItems.length > 0;
    const isOpen = openMenus[item.name];

    if (hasSub) {
      const filteredSubs = item.subItems.filter(sub => getAccess(sub.module));
      if (filteredSubs.length === 0) return null;

      return (
        <div key={item.name} className="w-full">
          <div
            onClick={() => toggleAccordion(item.name)}
            className={`flex items-center justify-between px-2.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer group mb-1 ${
              isOpen ? "bg-slate-50 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <span className={`shrink-0 ${isOpen ? "text-blue-600" : "text-slate-400 group-hover:text-slate-500"}`}>
                <Icon size={20} />
              </span>
              {!collapsed && <span className="font-semibold text-[13px] whitespace-nowrap">{item.name}</span>}
            </div>
            {!collapsed && <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />}
          </div>
          {isOpen && !collapsed && (
            <div className="ml-4 border-l border-slate-100 pl-2 space-y-1 mb-2">
              {filteredSubs.map(sub => renderNavItem(sub, true))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        title={collapsed ? item.name : undefined}
        className={`flex items-center px-2.5 py-2.5 rounded-xl transition-all duration-200 group ${
          collapsed ? "md:justify-center" : "space-x-3"
        } ${
          isActive
            ? "bg-blue-50 text-blue-600 shadow-sm"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        } ${isSub ? "py-2" : "mb-1"}`}
      >
        <span
          className={`shrink-0 ${
            isActive
              ? "text-blue-600"
              : "text-slate-400 group-hover:text-slate-500"
          }`}
        >
          {Icon ? <Icon size={isSub ? 16 : 20} /> : <div className="w-1.5 h-1.5 rounded-full bg-current ml-1" />}
        </span>

        {!collapsed && (
          <>
            <span className={`${isSub ? "text-[12px]" : "text-[13px]"} font-semibold whitespace-nowrap`}>
              {item.name}
            </span>
            {isActive && !isSub && (
              <div className="ml-auto w-1 h-5 bg-blue-600 rounded-full" />
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-50 flex flex-col transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-[64px]" : "md:w-56"}`}
      >
        {/* Logo — click returns to portal home */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-slate-100 shrink-0 overflow-hidden">
          <Link
            href="/home"
            title="Go to Home"
            className={`flex items-center gap-2 min-w-0 hover:opacity-90 transition-opacity ${
              collapsed ? "md:justify-center md:w-full" : ""
            }`}
          >
              <img src="/logo.png" alt="Home" className="w-20 object-contain" />
            {!collapsed && (
              <span className="font-bold text-lg tracking-tight text-slate-800 whitespace-nowrap">
                TaskApp
              </span>
            )}
          </Link>

          {/* Mobile close button */}
          <button
            className="md:hidden p-1 text-slate-400 hover:text-slate-600 shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
          {menuItems.map(item => renderNavItem(item))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all font-medium group ${
              collapsed ? "md:justify-center" : ""
            }`}
          >
            <LogOut
              size={20}
              className="text-slate-400 group-hover:text-rose-500 shrink-0"
            />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex absolute -right-3 top-[72px] w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 shadow-sm transition-all z-10"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>
      </aside>
    </>
  );
}
