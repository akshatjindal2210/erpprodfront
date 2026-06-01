"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { LogOut, ChevronLeft, ChevronRight, ChevronDown, Zap, Circle } from "lucide-react";
import { NAV_REGISTRY } from "@/features/apps/ims/config/navRegistry";
import { THEME_CONFIG } from "@/config/theme";
import { useAppLogout } from "@/core/hooks/useLogout";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useSelector } from "react-redux";
import { selectRole } from "@/core/store/slices/authSlice";

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  collapsed,
  toggleCollapsed,
  hideNav = false,
  navRegistry = NAV_REGISTRY,
  brandLabel = "JFL ERP Portal",
}) {
  const pathname = usePathname();
  const { handleLogout } = useAppLogout();
  const canAccess = useCanAccess();
  const role = useSelector(selectRole);
  const [openMenus, setOpenMenus] = useState({});

  const canSeeNavItem = (item) => {
    if (item.roles?.length) {
      return item.roles.includes(role);
    }
    return true;
  };

  const toggleAccordion = (id) => {
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getAccess = (module) => {
    const access = canAccess(module, "view");
    return access.allowed;
  };

  const filteredNav = useMemo(() => {
    return navRegistry.filter((item) => {
      if (!canSeeNavItem(item)) return false;
      const isPublicHome = !item.module && item.href && !item.subItems?.length;
      const hasParentAccess = item.module ? getAccess(item.module) : isPublicHome;
      const hasSubAccess = item.subItems?.some(
        (sub) => canSeeNavItem(sub) && (sub.module ? getAccess(sub.module) : true)
      );
      return hasParentAccess || hasSubAccess;
    });
  }, [canAccess, role, navRegistry]);

  useEffect(() => {
    const newOpenMenus = {};
    filteredNav.forEach((item) => {
      if (item.subItems && item.subItems.some((sub) => pathname.startsWith(sub.href))) {
        newOpenMenus[item.id || item.name] = true;
      }
    });
    setOpenMenus((prev) => ({ ...prev, ...newOpenMenus }));
  }, [pathname, filteredNav]);

  const renderNavItems = (items, level = 1) => {
    return items.map((item) => {
      const key = item.id || item.name;

      const isPublicHome = !item.module && item.href && !item.subItems?.length;
      const hasParentAccess = item.module ? getAccess(item.module) : isPublicHome;
      const filteredSubs = (item.subItems || []).filter(
        (sub) => canSeeNavItem(sub) && (sub.module ? getAccess(sub.module) : true)
      );
      const hasSub = filteredSubs.length > 0;

      if (!hasParentAccess && !hasSub) return null;

      const isOpen = openMenus[key];
      const isCollapsed = collapsed && !sidebarOpen;
      const active = item.href && pathname === item.href;

      return (
        <div key={key} className="w-full">
          {hasSub ? (
            <div
              onClick={() => toggleAccordion(key)}
              className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer transition-all group mb-0.5
              ${isOpen ? `${THEME_CONFIG.itemGroupBg} ${THEME_CONFIG.sidebarAccent}` : `${THEME_CONFIG.sidebarHover} ${THEME_CONFIG.sidebarText} ${THEME_CONFIG.sidebarHoverText}`}`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span className={`shrink-0 ${isOpen ? THEME_CONFIG.sidebarAccent : `${THEME_CONFIG.sidebarIcon} group-hover:text-current`}`}>
                  {item.icon ? item.icon : <Circle size={4} />}
                </span>
                {!isCollapsed && <span className="text-[12px] font-semibold truncate tracking-tight">{item.name}</span>}
              </div>
              {!isCollapsed && <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />}
            </div>
          ) : (
            <Link href={item.href || "#"} prefetch={false} onClick={() => setSidebarOpen(false)}>
              <div
                className={`flex items-center px-2.5 py-2 rounded-md transition-all group mb-0.5
              ${active ? `${THEME_CONFIG.primary} ${THEME_CONFIG.itemActiveText} shadow-md` : `${THEME_CONFIG.sidebarHover} ${THEME_CONFIG.sidebarText} ${THEME_CONFIG.sidebarHoverText}`}`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className={`shrink-0 ${active ? THEME_CONFIG.itemActiveText : `${THEME_CONFIG.sidebarIcon} group-hover:text-current`}`}>
                    {item.icon ? item.icon : <Circle size={4} />}
                  </span>
                  {!isCollapsed && <span className="text-[12px] font-semibold truncate tracking-tight">{item.name}</span>}
                </div>
              </div>
            </Link>
          )}

          {hasSub && isOpen && (
            <div className={`${!isCollapsed ? `ml-4 border-l ${THEME_CONFIG.sidebarBorder} pl-2.5` : "ml-0 pl-0"} mt-0.5 space-y-0.5`}>
              {renderNavItems(filteredSubs, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-[100] ${THEME_CONFIG.sidebarBg} flex flex-col h-screen transition-all duration-300 border-r ${THEME_CONFIG.sidebarBorder}
        ${sidebarOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full"} md:translate-x-0 ${collapsed ? "md:w-14" : "md:w-56"}`}
      >
        <div className={`h-12 flex items-center px-4 border-b ${THEME_CONFIG.sidebarBorder} shrink-0`}>
          <Zap size={16} className={`${THEME_CONFIG.sidebarAccent} shrink-0`} fill="currentColor" />
          {(!collapsed || sidebarOpen) && (
            <span className={`ml-2 font-bold text-[11px] ${THEME_CONFIG.sidebarText} uppercase tracking-wider truncate`}>{brandLabel}</span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5 custom-scrollbar">
          {!hideNav && renderNavItems(filteredNav)}
        </nav>

        <div className={`p-2 border-t ${THEME_CONFIG.sidebarBorder} bg-black/5`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center py-2 px-2 rounded-md transition-all ${THEME_CONFIG.danger} ${THEME_CONFIG.sidebarText} ${collapsed && !sidebarOpen ? "justify-center" : "gap-3"}`}
          >
            <LogOut size={16} />
            {(!collapsed || sidebarOpen) && <span className="text-[11px] font-bold uppercase tracking-widest">Logout</span>}
          </button>
        </div>

        <button
          onClick={toggleCollapsed}
          className={`hidden md:flex absolute -right-2.5 top-8 w-5 h-5 ${THEME_CONFIG.primary} text-white rounded-full items-center justify-center shadow-lg border-2 border-slate-200/50 hover:scale-110 active:scale-95 transition-all z-50`}
        >
          {collapsed ? <ChevronRight size={10} strokeWidth={4} /> : <ChevronLeft size={10} strokeWidth={4} />}
        </button>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-[90] md:hidden bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
      `}</style>
    </>
  );
}

