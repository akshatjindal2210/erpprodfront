"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Search, Menu, X, LogOut, Clock, Settings } from "lucide-react";
import { useSelector } from "react-redux";
import { selectRole } from "@/features/authSlice";
import { ROUTES } from "@/utils/routes";
import { useAppLogout } from "@/hooks/useLogout";
import { useCanAccess } from "@/hooks/useCanAccess";
import { THEME_CONFIG } from "@/config/theme";
import { QUICK_LINKS_CONFIG } from "@/config/quickLinks";
import { NAV_REGISTRY } from "@/config/navRegistry";
import QuickAccessBar from "./QuickAccessBar";

export default function Navbar({ setSidebarOpen, whoAmi }) {
  const { handleLogout } = useAppLogout();
  const canAccess = useCanAccess();
  const role = useSelector(selectRole);
  const isSuperAdmin = role === "super_admin";
  const router = useRouter();
  const pathname = usePathname();
  
  const [profileOpen, setProfileOpen] = useState(false);
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
    <div className="flex flex-col sticky top-0 z-[90]">
      <header className={`h-12 ${THEME_CONFIG.sidebarBg} border-b ${THEME_CONFIG.sidebarBorder} px-4 flex items-center justify-between`}>
        
        {/* LEFT: Title */}
        <div className="flex items-center gap-3">
          <button className="lg:hidden p-1 text-slate-400" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="text-[13px] font-bold text-white tracking-tight uppercase border-l-2 border-blue-500 pl-3 leading-none">
            {currentPage}
          </h1>
        </div>

        {/* RIGHT: Linear Order Container */}
        <div className="flex items-center gap-2 md:gap-3.5">
          
          {/* Desktop Search Suggestions */}
          <div className="hidden xl:block relative" ref={searchContainerRef}>
            <div className={`flex items-center gap-2 bg-black/20 px-2.5 py-1 rounded border ${THEME_CONFIG.sidebarBorder} w-48 focus-within:w-56 focus-within:border-blue-500/40 transition-all`}>
              <Search size={13} className="text-slate-500" />
              <input 
                type="text" 
                value={searchQuery}
                onFocus={() => setShowResults(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..." 
                className="bg-transparent border-none focus:ring-0 text-[11px] text-slate-300 outline-none w-full" 
              />
            </div>
            {/* Suggestions for Desktop */}
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

          {/* Date & Time */}
          <div className="hidden lg:flex items-center gap-1.5 text-slate-300 bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/5">
            <Clock size={11} className="text-blue-400" />
            <span className="text-[10px] font-bold tabular-nums">
              {dateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
            <span className="text-[10px] text-slate-600 font-light">|</span>
            <span className="text-[10px] font-medium uppercase tracking-tight text-slate-400">
              {dateTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* Icons & Profile Group */}
          <div className="flex items-center gap-1 md:gap-2">
            <button className="xl:hidden text-slate-400 p-1.5" onClick={() => setShowMobileSearch(!showMobileSearch)}>
              {showMobileSearch ? <X size={17} /> : <Search size={17} />}
            </button>
            <button className="text-slate-400 hover:text-white relative p-1.5 transition-colors">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-slate-900"></span>
            </button>

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
                    {isSuperAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            router.push(ROUTES.APP_CONFIG);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-slate-200 hover:bg-slate-700/50 font-bold transition-colors"
                        >
                          <Settings size={12} /> System configuration
                        </button>
                        <div className="my-1 border-t border-slate-700/80" />
                      </>
                    )}
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-rose-500 hover:bg-rose-500/10 font-bold transition-colors">
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
      {showMobileSearch && (
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

      <QuickAccessBar />
    </div>
  );
}