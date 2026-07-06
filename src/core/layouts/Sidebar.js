"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { LogOut, ChevronLeft, ChevronRight, ChevronDown, Zap, Circle, Activity, Clock, LayoutDashboard, History, Store, Box, Truck, Users, FileText,  Layout,  Link as LinkIcon,  Boxes, Package, Database, 
  FileSearch, BarChart3, Map, ClipboardCheck, Locate, ClipboardList, Scale, Sticker, ShieldAlert, Home, Toolbox, Wrench, Hammer, Briefcase, Calendar, Cloud, Filter, Flag, Folder, Layers, LifeBuoy, PieChart, 
  Printer, ShoppingCart, Tag, Target, TrendingUp, Wallet
} from "lucide-react";
import { NAV_REGISTRY } from "@/features/apps/ims/config/navRegistry";
import { THEME_CONFIG } from "@/config/theme";
import { useAppLogout } from "@/core/hooks/useLogout";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useSelector } from "react-redux";
import { selectRole, selectPermissions, selectUser } from "@/core/store/slices/authSlice";
import { APP_VERSION } from "@/config/appVersion";
import { ROUTES } from "@/config/routes";
import { useEscapeKey } from "@/core/hooks/useEscapeKey";
import { appConfigService } from "@/features/admin/services/appConfigService";

const DYNAMIC_SHORTCUTS_KEY = "dynamic_shortcuts";

const ICON_MAP = {
  Zap: <Zap size={14} />,
  Package: <Package size={14} />,
  Truck: <Truck size={14} />,
  Users: <Users size={14} />,
  Database: <Database size={14} />,
  FileSearch: <FileSearch size={14} />,
  BarChart3: <BarChart3 size={14} />,
  Map: <Map size={14} />,
  Boxes: <Boxes size={14} />,
  ClipboardCheck: <ClipboardCheck size={14} />,
  Locate: <Locate size={14} />,
  ClipboardList: <ClipboardList size={14} />,
  Scale: <Scale size={14} />,
  Sticker: <Sticker size={14} />,
  History: <History size={14} />,
  ShieldAlert: <ShieldAlert size={14} />,
  Home: <Home size={14} />,
  Link: <LinkIcon size={14} />,
  Store: <Store size={14} />,
  Box: <Box size={14} />,
  Layout: <Layout size={14} />,
  Toolbox: <Toolbox size={14} />,
  Wrench: <Wrench size={14} />,
  Hammer: <Hammer size={14} />,
  Briefcase: <Briefcase size={14} />,
  Calendar: <Calendar size={14} />,
  Cloud: <Cloud size={14} />,
  Filter: <Filter size={14} />,
  Flag: <Flag size={14} />,
  Folder: <Folder size={14} />,
  Layers: <Layers size={14} />,
  LifeBuoy: <LifeBuoy size={14} />,
  PieChart: <PieChart size={14} />,
  Printer: <Printer size={14} />,
  ShoppingCart: <ShoppingCart size={14} />,
  Tag: <Tag size={14} />,
  Target: <Target size={14} />,
  TrendingUp: <TrendingUp size={14} />,
  Wallet: <Wallet size={14} />,
};

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
  const userData = useSelector(selectUser);
  const role = useSelector(selectRole);
  const permissions = useSelector(selectPermissions);
  const [openMenus, setOpenMenus] = useState({});
  const [dynamicShortcuts, setDynamicShortcuts] = useState([]);

  useEffect(() => {
    const fetchShortcuts = async () => {
      try {
        const res = await appConfigService.list("shortcut");
        if (res?.success) {
          const configRow = res.data?.find(r => r.key === DYNAMIC_SHORTCUTS_KEY || r.config_key === DYNAMIC_SHORTCUTS_KEY);
          if (configRow?.config_value) {
            const parsed = JSON.parse(configRow.config_value);
            setDynamicShortcuts(Array.isArray(parsed) ? parsed : []);
          }
        }
      } catch (err) {
        if (err?.status !== 403 && err?.status !== 401) {
          console.error("Failed to fetch shortcuts", err);
        }
      }
    };
    fetchShortcuts();
  }, [role, permissions]);

  const PORTAL_NAV = [
    { id: 'home', name: 'Home', href: ROUTES.HOME, icon: <LayoutDashboard size={14} /> },
    { id: 'logs', name: 'Activity Logs', href: ROUTES.ACTIVITY_LOGS, icon: <History size={14} /> },
  ];

  const canSeeNavItem = (item) => {
    // 1. Check for dynamic shortcut specific rules
    if (item.allowedUsers?.length > 0) {
      if (!userData?.id || !item.allowedUsers.includes(userData.id)) return false;
    }

    if (item.requiredPermission) {
      // Super Admin always sees everything
      const isSuperAdmin = role?.toLowerCase() === 'super_admin' || role?.toLowerCase() === 'super admin';
      if (isSuperAdmin) return true;
      
      // Check permissions array from Redux
      return permissions?.some(p => p.module_name === item.requiredPermission && p.can_view);
    }

    // 2. Fallback to standard role-based rules
    if (item.roles?.length) {
      return item.roles.includes(role);
    }
    return true;
  };

  const dynamicNav = useMemo(() => {
    // 1. Filter by permission and user access
    const visible = dynamicShortcuts.filter(canSeeNavItem);
    
    // 2. Sort by rank
    const sorted = [...visible].sort((a, b) => (parseInt(a.rank) || 0) - (parseInt(b.rank) || 0));

    // 3. Transform to Sidebar format with nesting and colors
    const roots = sorted.filter(s => !s.parentId).map(s => ({
      id: s.id,
      name: s.label,
      href: s.url || null,
      icon: (
        <span style={{ color: s.color || 'inherit' }}>
          {ICON_MAP[s.icon] || <Circle size={4} />}
        </span>
      ),
      subItems: sorted.filter(sub => sub.parentId === s.id).map(sub => ({
        id: sub.id,
        name: sub.label,
        href: sub.url,
        icon: (
          <span style={{ color: sub.color || 'inherit' }}>
            {ICON_MAP[sub.icon] || <Circle size={4} />}
          </span>
        ),
      }))
    }));

    return roots;
  }, [role, permissions, userData, dynamicShortcuts]);

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

  const allHrefs = useMemo(() => {
    const hrefs = new Set();
    const walk = (items) => {
      items.forEach((item) => {
        if (item.href) hrefs.add(item.href);
        if (item.subItems) walk(item.subItems);
      });
    };
    walk(filteredNav);
    walk(PORTAL_NAV);
    walk(dynamicNav);
    return Array.from(hrefs);
  }, [filteredNav, dynamicNav, PORTAL_NAV]);

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
      
      // Active logic: 
      // 1. Exact match
      // 2. Or it's a prefix of the current path AND no other link in the sidebar is a better (longer) prefix match
      const active = item.href && (
        pathname === item.href || 
        (pathname.startsWith(item.href + "/") && !allHrefs.some(h => h !== item.href && h.length > item.href.length && pathname.startsWith(h)))
      );

      return (
        <div key={key} className="w-full">
          {hasSub ? (
            <div
              onClick={() => toggleAccordion(key)}
              className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer transition-all group mb-0.5
              ${isOpen ? `bg-white/5 ${THEME_CONFIG.sidebarAccent}` : `${THEME_CONFIG.sidebarHover} ${THEME_CONFIG.sidebarText} ${THEME_CONFIG.sidebarHoverText}`}`}
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
        className={`fixed inset-y-0 left-0 z-[120] ${THEME_CONFIG.sidebarBg} flex flex-col h-screen transition-all duration-300 border-r ${THEME_CONFIG.sidebarBorder}
        ${sidebarOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full"} md:translate-x-0 ${collapsed ? "md:w-14" : "md:w-56"}`}
      >
        <div className={`h-12 flex items-center px-4 border-b ${THEME_CONFIG.sidebarBorder} shrink-0`}>
          <Zap size={16} className={`${THEME_CONFIG.sidebarAccent} shrink-0`} fill="currentColor" />
          {(!collapsed || sidebarOpen) && (
            <span className={`ml-2 font-bold text-[11px] ${THEME_CONFIG.sidebarText} uppercase tracking-wider truncate`}>{brandLabel}</span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5 custom-scrollbar">
          {!hideNav ? (
            <>
              {renderNavItems(filteredNav)}
            </>
          ) : (
            <>
              {renderNavItems(PORTAL_NAV)}
              {dynamicNav.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-700/30">
                  <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Shortcuts</p>
                  {renderNavItems(dynamicNav)}
                </div>
              )}
            </>
          )}
        </nav>

        
        <div className={`p-2 border-t border-b ${THEME_CONFIG.sidebarBorder} bg-black/5`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center py-2 px-2 rounded-md transition-all ${THEME_CONFIG.danger} ${THEME_CONFIG.sidebarText} ${collapsed && !sidebarOpen ? "justify-center" : "gap-3"}`}
          >
            <LogOut size={16} />
            {(!collapsed || sidebarOpen) && <span className="text-[11px] font-bold uppercase tracking-widest">Logout</span>}
          </button>
        </div>

        <p className="text-center text-[12px] text-slate-200 py-1">v{APP_VERSION}</p>

        <button
          onClick={toggleCollapsed}
          className={`hidden md:flex absolute -right-2.5 top-8 w-5 h-5 ${THEME_CONFIG.primary} text-white rounded-full items-center justify-center shadow-lg border-2 border-slate-200/50 hover:scale-110 active:scale-95 transition-all z-[150]`}
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

