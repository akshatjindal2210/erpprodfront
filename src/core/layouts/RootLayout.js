"use client";
import { useState, useMemo } from "react";
import Sidebar from "./Sidebar"; 
import Navbar from "./Navbar";
import { THEME_CONFIG } from "@/config/theme";
import { useSelector } from "react-redux";
import { selectUser, selectPermissions, selectRole } from "@/core/store/slices/authSlice";
import { usePathname } from "next/navigation";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { NAV_REGISTRY } from "@/features/apps/ims/config/navRegistry";
import { ShieldAlert, Lock } from "lucide-react";
import { APP_SHELL, isPortalShell, isSettingsShell } from "@/config/appsRegistry";
import { SETTINGS_NAV_REGISTRY } from "@/features/admin/configuration/config/settingsNavRegistry";
import { ROUTES } from "@/config/routes";
import { useEscapeKey } from "@/core/hooks/useEscapeKey";

export default function RootLayout({ children, shell = APP_SHELL.IMS }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEscapeKey(() => setSidebarOpen(false), sidebarOpen);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebarCollapsed") === "true";
    }
    return false;
  });
  const userData = useSelector(selectUser);
  const role = useSelector(selectRole);
  const permissions = useSelector(selectPermissions);
  const pathname = usePathname();
  const canAccess = useCanAccess();
  const isPortal = isPortalShell(shell, pathname);
  const isSettings = isSettingsShell(shell, pathname);
  const hideNav = isPortal || shell === APP_SHELL.STANDALONE;
  const hideQuickLinks = hideNav || isSettings;
  const sidebarNav = isSettings ? SETTINGS_NAV_REGISTRY : undefined;
  const sidebarBrand = isSettings ? "Settings" : "JFL ERP Portal";

  const accessState = useMemo(() => {
    // 1. Find the module associated with current path
    let currentModule = null;
    let requiredRoles = null;
    const findModule = (items) => {
      for (const item of items) {
        if (item.href === pathname) {
          currentModule = item.module;
          requiredRoles = item.roles;
          return;
        }
        if (item.subItems) {
          const sub = item.subItems.find(s => s.href === pathname);
          if (sub) {
            currentModule = sub.module;
            requiredRoles = sub.roles;
            return;
          }
        }
      }
    };
    findModule(NAV_REGISTRY);
    findModule(SETTINGS_NAV_REGISTRY);

    // 1.1 Check role restriction if any
    if (requiredRoles && !requiredRoles.includes(role?.toLowerCase())) {
      return { hasPageAccess: false, moduleDeactivated: false };
    }

    // 2. If no module found, it's a public/unknown page (like Dashboard)
    if (!currentModule) return { hasPageAccess: true, moduleDeactivated: false };

    // 3. Gate layout by permission only.
    // Deactivated module pages should still open and show deactivated messaging in-page.
    const access = canAccess(currentModule, "view");
    const hasPageAccess = access.allowed;
    const perm = permissions?.find((p) => p.module_name === currentModule);
    const statusCandidate = perm?.module_is_active;
    const moduleDeactivated =
      statusCandidate !== undefined &&
      statusCandidate !== null &&
      !(
        statusCandidate === true ||
        statusCandidate === 1 ||
        String(statusCandidate).trim().toLowerCase() === "true" ||
        String(statusCandidate).trim().toLowerCase() === "1" ||
        String(statusCandidate).trim().toLowerCase() === "active"
      );

    return { hasPageAccess, moduleDeactivated };
  }, [pathname, canAccess, permissions, role]);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem("sidebarCollapsed", newState.toString());
      return newState;
    });
  };

  const contentMargin = collapsed ? "md:ml-14" : "md:ml-56";

  return (
    <div className={`imp-panel-no-select flex h-screen ${THEME_CONFIG.sidebarBg} overflow-hidden font-sans`}>
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        collapsed={collapsed}
        toggleCollapsed={handleToggleCollapse}
        hideNav={hideNav}
        navRegistry={sidebarNav}
        brandLabel={sidebarBrand}
      />

      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ml-0 ${contentMargin}`}>
        <Navbar
          setSidebarOpen={setSidebarOpen}
          collapsed={collapsed}
          hideQuickLinks={hideQuickLinks}
          hideSearch={false}
          whoAmi={{ name: userData?.name || "JFL Admin", email: userData?.email || "admin@jfl-dynamics.io" }}
        />

        <main className={`flex-1 flex flex-col min-h-0 overflow-hidden ${THEME_CONFIG.footerBg}`}>
          <div className="w-full flex-1 flex flex-col min-h-0 from-black/20 to-transparent bg-[#f0f4f8] overflow-y-auto overflow-x-hidden">
            <div className={`mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500 flex-1 flex flex-col min-h-0 w-full ${
              pathname?.includes("/dashboard") ? "p-0 md:p-2" : "p-2 md:p-2"
            }`}>
              {accessState?.hasPageAccess ? (
                children
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
                  <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-rose-200 animate-pulse">
                    <Lock size={40} className="text-rose-500" />
                  </div>
                  <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Access Restricted</h1>
                  <p className="text-slate-500 text-sm max-w-md leading-relaxed mb-8">
                    You do not have the required permissions to view this module. Please contact authorized personnel for access.
                  </p>
                  <button 
                    onClick={() => { window.location.href = ROUTES.HOME; }}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <ShieldAlert size={16} />
                    Back to Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[115] md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
