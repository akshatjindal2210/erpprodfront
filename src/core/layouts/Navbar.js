"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Menu, X, LogOut, Clock, KeyRound, Settings, Calendar, ChevronDown } from "lucide-react";
import { ROUTES } from "@/config/routes";
import { useAppLogout } from "@/core/hooks/useLogout";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { THEME_CONFIG } from "@/config/theme";
import { QUICK_LINKS_CONFIG } from "@/features/apps/ims/config/quickLinks";
import { NAV_REGISTRY } from "@/features/apps/ims/config/navRegistry";
import { SETTINGS_NAV_REGISTRY } from "@/features/admin/configuration/config/settingsNavRegistry";
import QuickAccessBar from "./QuickAccessBar";
import PortalAppLauncherButton from "@/features/shared/portal/components/PortalAppLauncherButton";
import ChangePasswordModal from "@/features/admin/identity/users/ChangePasswordModal";
import DeviceSettingsModal from "@/features/shared/settings/DeviceSettingsModal";
import FinancialYearModal from "./FinancialYearModal";
import TaskBellMenu from "@/features/apps/task/pwa/TaskBellMenu";
import { masterService } from "@/features/apps/ims/services/master";
import { getSelectedFinancialYear, setSelectedFinancialYear } from "@/features/apps/ims/helpers/financialYear";
import { toast } from "react-toastify";

export default function Navbar({ setSidebarOpen, whoAmi, hideQuickLinks = false, hideSearch = false }) {
  const { handleLogout } = useAppLogout();
  const canAccess = useCanAccess();
  const router = useRouter();
  const pathname = usePathname();
  
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [fyModalOpen, setFyModalOpen] = useState(false);
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedFyName, setSelectedFyName] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [dateTime, setDateTime] = useState(new Date());

  const profileRef = useRef(null);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const { name } = getSelectedFinancialYear();
    
    masterService.getFinancialYears()
      .then(response => {
        const years = Array.isArray(response?.data) ? response.data : [];
        setFinancialYears(years);
        
        if (name && years.some(y => y.fyname === name)) {
          setSelectedFyName(name);
        } else if (years.length > 0) {
          const lastFy = years[years.length - 1];
          setSelectedFyName(lastFy.fyname);
          setSelectedFinancialYear(lastFy.fyid, lastFy.fyname);
        }
      })
      .catch(err => console.error("Error fetching FY list:", err));
  }, []);

  const handleFyChange = (fyname) => {
    const fy = financialYears.find(y => y.fyname === fyname);
    if (fy) {
      setSelectedFyName(fy.fyname);
      setSelectedFinancialYear(fy.fyid, fy.fyname);
      toast.success(`Financial Year changed to ${fy.fyname}`);
      window.location.reload(); // Reload to apply FY change globally
    }
  };

  useEffect(() => {
    if (hideSearch) {
      setShowMobileSearch(false);
      setSearchQuery("");
      setShowResults(false);
    }
  }, [hideSearch]);

  const currentPage = useMemo(() => {
    const getAccess = (module) => {
      const access = canAccess(module, "view");
      return access.allowed;
    };

    for (const item of NAV_REGISTRY) {
      const hasParentAccess = item.module ? getAccess(item.module) : false;
      if (item.href === pathname && (hasParentAccess || item.module === null)) return item.name;
      
      if (item.subItems) {
        const sub = item.subItems.find(s => s.href === pathname);
        if (sub && getAccess(sub.module)) return sub.name;
      }
    }
    if (pathname === ROUTES.HOME || pathname.startsWith(`${ROUTES.HOME}/`)) {
      return "Home";
    }
    if (pathname === ROUTES.SETTINGS || pathname.startsWith(`${ROUTES.SETTINGS}/`)) {
      const settingsItem = SETTINGS_NAV_REGISTRY.find((item) => item.href === pathname);
      return settingsItem?.name || "Settings";
    }
    return "Dashboard";
  }, [pathname, canAccess]);

  const searchableItems = useMemo(() => {
    const items = [];
    QUICK_LINKS_CONFIG.forEach(link => 
      items.push({ name: link.label, path: link.path, type: "Quick Access", icon: link.icon })
    );

    const getAccess = (module) => {
      if (!module) return false;
      const access = whoAmi?.permissions?.[module];
      if (!access) return false;
      return typeof access === 'object' ? access.view?.allowed : access.view;
    };

    NAV_REGISTRY.forEach(item => {
      const isPublicHome = !item.module && item.href && !item.subItems?.length;
      const hasParentAccess = item.module ? getAccess(item.module) : isPublicHome;
      const filteredSubs = (item.subItems || []).filter(sub => getAccess(sub.module));
      const hasSub = filteredSubs.length > 0;

      if (hasParentAccess || hasSub) {
        if (item.href && hasParentAccess) {
          items.push({ name: item.name, path: item.href, type: "Menu", icon: item.icon });
        }
        filteredSubs.forEach(sub => {
          if (sub.href) items.push({ name: sub.name, path: sub.href, type: item.name, icon: sub.icon });
        });
      }
    });
    return items;
  }, [whoAmi]);

  const results = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchableItems.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 8);
  }, [searchQuery, searchableItems]);

  const handleSelect = (path) => {
    router.push(path);
    setSearchQuery("");
    setShowResults(false);
    setShowMobileSearch(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex flex-col sticky top-0 z-[110]">
      <header className={`h-12 ${THEME_CONFIG.sidebarBg} border-b ${THEME_CONFIG.sidebarBorder} px-4 flex items-center justify-between`}>
        
        {/* LEFT: Search & Title */}
        <div className="flex items-center gap-4">
          <button className="lg:hidden p-1 text-slate-400" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          <h1 className="text-[13px] font-bold text-white tracking-tight uppercase border-l-2 border-blue-500 pl-3 leading-none">
            {currentPage}
          </h1>
        </div>

        {/* RIGHT: Linear Order Container */}
        <div className="flex items-center gap-2 md:gap-3.5">
          
          {!hideSearch && (
            <div className="hidden lg:block relative" ref={searchContainerRef}>
              <div className={`flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border ${THEME_CONFIG.sidebarBorder} w-64 focus-within:w-72 focus-within:border-blue-500/40 transition-all`}>
                <Search size={14} className="text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setShowResults(true)}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="bg-transparent border-none focus:ring-0 text-[12px] text-slate-300 outline-none w-full"
                />
              </div>
              {showResults && results.length > 0 && (
                <div className={`absolute top-full mt-2 w-full ${THEME_CONFIG.sidebarBg} border ${THEME_CONFIG.sidebarBorder} rounded-md shadow-2xl py-1 z-[111]`}>
                  {results.map((item, idx) => (
                    <button key={idx} onClick={() => handleSelect(item.path)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left">
                      <span className="text-slate-500">{item.icon}</span>
                      <span className="text-[11px] text-slate-300">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Date & Time */}
          <div className="hidden lg:flex items-center gap-1.5 text-slate-300 bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/5">
            {financialYears.length > 0 && (
              <button 
                onClick={() => setFyModalOpen(true)}
                className="relative group flex items-center gap-1.5 hover:bg-white/5 px-1.5 py-0.5 rounded transition-colors"
              >
                <Calendar size={11} className="text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-emerald-400 p-0">
                  {selectedFyName}
                </span>
                <span className="text-[10px] text-slate-600 font-light ml-1">|</span>
              </button>
            )}
            <Clock size={11} className="text-blue-400" />
            <span className="text-[10px] font-bold tabular-nums">
              {dateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
            <span className="text-[10px] text-slate-600 font-light">|</span>
            <span className="text-[10px] font-medium uppercase tracking-tight text-slate-400">
              {dateTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* Icons & Profile Group */}
          <div className="flex items-center gap-1 md:gap-2">
            {!hideSearch && (
              <button className="xl:hidden text-slate-400 p-1.5" onClick={() => setShowMobileSearch(!showMobileSearch)}>
                {showMobileSearch ? <X size={17} /> : <Search size={17} />}
              </button>
            )}
            <TaskBellMenu theme="dark" />

            <PortalAppLauncherButton />

            {/* User Section */}
            <div className="flex items-center gap-2 border-l border-slate-800/60 pl-2 md:pl-3 ml-1" ref={profileRef}>
              <div className="hidden md:flex flex-col items-end leading-none gap-0.5">
                <span className="text-[10px] font-bold text-slate-100 uppercase tracking-tight italic">{whoAmi?.name || "Admin"}</span>
                <span className="text-[8px] font-medium text-slate-500 truncate max-w-[100px]">{whoAmi?.email}</span>
              </div>
              <div className="relative">
                <button onClick={() => setProfileOpen(!profileOpen)} className="p-0.5 rounded-md hover:ring-1 ring-slate-700 transition-all">
                  <div className={`w-7 h-7 rounded-md ${THEME_CONFIG.primary} flex items-center justify-center text-white text-[9px] font-black shadow-inner`}>
                    {whoAmi?.name?.split(" ").map(word => word[0]).join("").toUpperCase() || "AD"}</div>
                </button>
                {profileOpen && (
                  <div className={`absolute right-0 mt-2 w-48 ${THEME_CONFIG.sidebarBg} border ${THEME_CONFIG.sidebarBorder} rounded shadow-2xl py-1 z-50`}>
                    <button
                      onClick={() => { setProfileOpen(false); setDeviceSettingsOpen(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-slate-300 hover:bg-white/5 font-bold transition-colors"
                    >
                      <Settings size={12} /> Settings
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); setFyModalOpen(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-slate-300 hover:bg-white/5 font-bold transition-colors border-t border-white/5"
                    >
                      <Calendar size={12} /> Financial Year
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); setChangePassOpen(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-slate-300 hover:bg-white/5 font-bold transition-colors border-t border-white/5"
                    >
                      <KeyRound size={12} /> Change Password
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-rose-500 hover:bg-rose-500/10 font-bold transition-colors border-t border-white/5">
                      <LogOut size={12} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search Input WITH SUGGESTIONS */}
      {!hideSearch && showMobileSearch && (
        <div className={`xl:hidden w-full ${THEME_CONFIG.sidebarBg} border-b border-slate-800 px-4 py-2`}>
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded border border-slate-700">
            <Search size={14} className="text-blue-500" />
            <input 
              autoFocus
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Quick Search..." 
              className="bg-transparent border-none focus:ring-0 text-[12px] text-white outline-none w-full" 
            />
          </div>
          
          {/* Mobile Results Mapping */}
          {results.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
              {results.map((item, idx) => (
                <button key={idx} onClick={() => handleSelect(item.path)} className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded text-[11px] text-slate-300 transition-colors">
                  <span className="text-slate-500">{item.icon}</span>
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <QuickAccessBar hideQuickLinks={hideQuickLinks} />
      <ChangePasswordModal open={changePassOpen} onClose={() => setChangePassOpen(false)} />
      <DeviceSettingsModal open={deviceSettingsOpen} onClose={() => setDeviceSettingsOpen(false)} />
      <FinancialYearModal open={fyModalOpen} onClose={() => setFyModalOpen(false)} onSaveSuccess={(name) => setSelectedFyName(name)} />
    </div>
  );
}
