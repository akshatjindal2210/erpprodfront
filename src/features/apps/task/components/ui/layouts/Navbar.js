"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Menu, ChevronDown, LogOut, Shield, X, KeyRound } from "lucide-react";
import { useAppLogout } from "@/core/hooks/useLogout";
import reminderService from "@/features/apps/task/services/reminderApi";
import { NAVBAR_PAGES, getProfileDropdown, getRoleConfig, hasAccess } from "@/features/apps/task/config/appConfig";
import PortalAppLauncherButton from "@/features/shared/portal/components/PortalAppLauncherButton";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import ChangePasswordModal from "@/features/admin/identity/users/ChangePasswordModal";
import TaskBellMenu from "@/features/apps/task/pwa/TaskBellMenu";

export default function Navbar({ setSidebarOpen, userRole, whoAmi }) {
  const { handleLogout } = useAppLogout();
  const router = useRouter();
  const canAccess = useCanAccess();

  const [profileOpen,   setProfileOpen]   = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [mounted,       setMounted]       = useState(false);
  const [reminders,     setReminders]     = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const profileRef = useRef(null);
  const notifRef   = useRef(null);
  const searchRef  = useRef(null);

  // Role-based config
  const allowedPages = NAVBAR_PAGES.filter(page => {
    // 1. Check App Level Access
    if (page.module) {
      const access = canAccess(page.module, "view");
      if (!access.allowed) return false;
    }
    // 2. Check Code Level Access
    if (page.roles) {
      const normalizedRole = userRole === "executive_assistant" ? "team" : userRole;
      return page.roles.includes(normalizedRole);
    }
    return hasAccess(userRole, page.path);
  });
  const profileDropdown = getProfileDropdown(userRole);
  const roleConfig      = getRoleConfig(userRole);

  useEffect(() => setMounted(true), []);

  // Search — filter only in allowed pages
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSearchResults([]); return; }
    setSearchResults(
      allowedPages.filter(
        (p) => p.label.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, userRole]);

  // Outside click close
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target))   setNotifOpen(false);
      if (searchRef.current  && !searchRef.current.contains(e.target))  setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reminders fetch on mount (badge count)
  useEffect(() => {
    reminderService.getAll()
      .then((res) => setUnreadCount(res.data?.data?.length ?? 0))
      .catch(() => {});
  }, []);

  const fetchReminders = async () => {
    setRemindersLoading(true);
    try {
      const res = await reminderService.getAll();
      const list = res.data?.data ?? [];
      setReminders(list);
      setUnreadCount(list.length);
    } catch {
      setReminders([]);
    } finally {
      setRemindersLoading(false);
    }
  };

  const handleNotifOpen = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) fetchReminders();
  };

  const navigate = (href) => {
    setProfileOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
    router.push(href);
  };

  const avatarGradient = mounted ? roleConfig.avatarGradient : "from-slate-500 to-slate-400";
  const initials = whoAmi?.name ? whoAmi.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(): "AD";

  return (
    <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200 px-3 md:px-5 flex items-center justify-between sticky top-0 z-30">

      {/* ── Left ── */}
      <div className="flex items-center gap-2.5">
        <button
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>

        {/* Search */}
        <div className="relative" ref={searchRef}>
          <div className={`hidden sm:flex items-center bg-slate-100 px-2.5 py-1 rounded-lg border transition-all w-64
            ${searchOpen ? "border-blue-400 bg-white shadow-sm" : "border-transparent"}`}>
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              placeholder="Search pages…"
              className="bg-transparent border-none focus:ring-0 text-sm w-full ml-2 outline-none"
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {searchOpen && searchQuery.length >= 1 && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
              {searchResults.length === 0 ? (
                <div className="p-6 text-center">
                  <Search size={22} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400">No pages found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto py-1">
                  {Array.from(new Set(searchResults.map((r) => r.category))).map((cat) => (
                    <div key={cat}>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                        {cat}
                      </div>
                      {searchResults.filter((r) => r.category === cat).map((page, i) => (
                        <button key={i} onClick={() => navigate(page.path)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left group">
                          <span className="text-base">{page.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 group-hover:text-indigo-700">{page.label}</p>
                            <p className="text-[10px] text-slate-400">{page.path}</p>
                          </div>
                          <ChevronDown size={12} className="text-slate-300 -rotate-90 group-hover:text-indigo-400 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right ── */}
      <div className="flex items-center gap-1.5 md:gap-3">

        <TaskBellMenu theme="light" />

        {/* Legacy reminders bell — kept for reference
        <div className="relative" ref={notifRef}>
          <button onClick={handleNotifOpen}
            className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-[9px] text-white font-bold px-0.5">{unreadCount > 9 ? "9+" : unreadCount}</span>
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={13} className="text-amber-500" />
                  <span className="text-sm font-semibold text-slate-700">Reminders</span>
                </div>
                {unreadCount > 0 && (
                  <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                    {unreadCount} upcoming
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {remindersLoading ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading…</div>
                ) : reminders.length === 0 ? (
                  <div className="p-8 flex flex-col items-center text-slate-400">
                    <Bell size={24} className="opacity-20 mb-2" />
                    <p className="text-xs">No upcoming reminders</p>
                  </div>
                ) : (
                  reminders.map((r) => (
                    <div key={r.id}
                      className="px-4 py-3 border-b border-slate-50 hover:bg-amber-50 transition-colors cursor-pointer"
                      onClick={() => {setNotifOpen(false); navigate(`/task/dashboard/tasks/${r.id}`)}}>
                      <div className="flex items-start gap-2.5">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[r.priority] ?? "bg-slate-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{r.title}</p>
                          {r.assigned_to && <p className="text-[10px] text-slate-400 mt-0.5">👤 {r.assigned_to}</p>}
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock size={10} className="text-amber-500" />
                            <span className="text-[10px] text-amber-600 font-medium">
                              {new Date(r.reminder_date).toLocaleString("en-IN", {
                                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize flex-shrink-0 ${STATUS_BADGE[r.status] ?? ""}`}>
                          {r.status?.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {reminders.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100">
                  <button onClick={() => {setNotifOpen(false); navigate("/task/dashboard/reminders")}}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium w-full text-center">
                    View all reminders →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        */}

        <PortalAppLauncherButton theme="light" />

        <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden md:block" />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-1.5 p-1 pr-1.5 rounded-full hover:bg-slate-100 transition-all">
            <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${avatarGradient} flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}>
              {mounted ? initials : "AD"}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-slate-700 leading-none">{mounted ? whoAmi?.name : ""}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{mounted ? whoAmi?.email : ""}</p>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-3 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50">

              <div className="px-4 py-3 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                      {mounted ? whoAmi?.name : ""}{whoAmi?.username ? ` (${whoAmi.username})` : ""}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {mounted ? whoAmi?.email : ""}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 inline-block ${roleConfig.badgeClass}`}>
                  {roleConfig.label}
                </span>
              </div>

              {/* ── Role-based dropdown items — icon from config ── */}
              <div className="py-1">
                {profileDropdown.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={() => navigate(item.href)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors group"
                    >
                      <span className="text-slate-400 group-hover:text-blue-500 transition-colors">
                        <Icon size={16} />
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Change Password & Logout ── */}
              <div className="border-t border-slate-100">
                <button
                  onClick={() => { setProfileOpen(false); setChangePassOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors group"
                >
                  <KeyRound size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <span className="font-medium">Change Password</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors group"
                >
                  <LogOut size={16} className="group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
      <ChangePasswordModal open={changePassOpen} onClose={() => setChangePassOpen(false)} />
    </header>
  );
}
