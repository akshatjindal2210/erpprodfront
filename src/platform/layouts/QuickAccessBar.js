"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import { HelpCircle, Info, ChevronDown, BookOpen, Loader2, VideoOff, Keyboard, Tag, RefreshCw } from "lucide-react";
import FilterDateInput from "@/ui/common/date/FilterDateInput";
import { useSelector } from "react-redux";
import { getQuickLinksForPathname } from "@/config/quickAccess";
import { NAV_REGISTRY } from "@/apps/ims/lib/config/navRegistry";
import { RM_STORE_NAV_REGISTRY } from "@/apps/rmstore/lib/config/navRegistry";
import { THEME_CONFIG } from "@/config/theme";
import Drawer from "@/ui/primitives/Drawer";
import { trainingVideoService } from "@/apps/settings/lib/services/trainingService";
import { selectPermissions, selectUser, selectRole } from "@/platform/store/slices/authSlice";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { isPwaStandalone, getListHotkeyParts } from "@/platform/utils/pwa/pwa";
import { APP_VERSION } from "@/config/appVersion";
import { api } from "@/platform/api/apiClient";
import { CORE_ENDPOINTS } from "@/platform/api/endpoints";
import { getDashboardStatus, getUserDashboards } from "@/common/dashboard-builder/services/dashboardApi";
import { canFilterDashboardByUser } from "@/common/dashboard-builder/utils/dashboardFilterAccess";

// const DASHBOARD_AUTO_REFRESH_MS = 60 * 1000; // used when auto-refresh is re-enabled below
const DASHBOARD_SYNC_TICK_MS = 30 * 1000;
const DASHBOARD_SYNC_EVENT = "erp-dashboard-sync";
const DASHBOARD_SYNC_START_EVENT = "erp-dashboard-sync-start";
const DASHBOARD_SYNC_ERROR_EVENT = "erp-dashboard-sync-error";

function formatDashboardSyncTime(syncedAt) {
  // null/undefined must not become Number(null)===0 (Unix epoch → "5:30 AM" in IST).
  if (syncedAt == null || syncedAt === "") return "—";
  const ts = Number(syncedAt);
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  const at = dayjs(ts);
  if (!at.isValid()) return "—";
  const diffSec = dayjs().diff(at, "second");
  if (diffSec < 0) return "Just now";
  if (diffSec < 15) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function formatDashboardSyncTitle(syncedAt) {
  if (syncedAt == null || syncedAt === "") return "Dashboard not synced yet";
  const ts = Number(syncedAt);
  if (!Number.isFinite(ts) || ts <= 0) return "Dashboard not synced yet";
  const at = dayjs(ts);
  if (!at.isValid()) return "Dashboard not synced yet";
  return `Last synced: ${at.format("DD MMM YYYY, h:mm:ss A")}`;
}

const kbdClass = "px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[9px] font-black shadow-sm text-slate-900 leading-none";

function normalizeDashboardDateRange(fromRaw = "", toRaw = "", fallbackToday = "", { anchor = "from" } = {}) {
  const today = fallbackToday || dayjs().format("YYYY-MM-DD");
  let from = dayjs(fromRaw, "YYYY-MM-DD", true).isValid() ? fromRaw : today;
  let to = dayjs(toRaw, "YYYY-MM-DD", true).isValid() ? toRaw : today;
  if (dayjs(from).isAfter(dayjs(to), "day")) {
    if (anchor === "to") {
      from = to;
    } else {
      to = from;
    }
  }
  return { from, to };
}

function ShortcutKbdParts({ parts }) {
  return (
    <div className="flex gap-1 items-center flex-wrap justify-end">
      {parts.map((part, i) => (
        <span key={`${part}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="text-slate-400 font-bold">+</span>}
          <kbd className={kbdClass}>{part}</kbd>
        </span>
      ))}
    </div>
  );
}

function ShortcutRow({ label, parts }) {
  return (
    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
      <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{label}</span>
      <ShortcutKbdParts parts={parts} />
    </div>
  );
}

export default function QuickAccessBar({ hideQuickLinks = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const permissions = useSelector(selectPermissions);
  const role = useSelector(selectRole);
  const user = useSelector(selectUser);
  const canAccess = useCanAccess();
  const canFilterByUser = useMemo(() => canFilterDashboardByUser(role, user), [role, user]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState({});
  const [trainingData, setTrainingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPwa, setIsPwa] = useState(false);
  const [dashboardUsers, setDashboardUsers] = useState([]);
  const [dashboardActive, setDashboardActive] = useState(null);
  const [userDashboards, setUserDashboards] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [isDashboardSyncing, setIsDashboardSyncing] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  const isDashboardRoute =
    pathname === "/ims/dashboard" ||
    pathname === "/task/dashboard" ||
    pathname === "/rmstore/dashboard" ||
    pathname === "/settings/dashboard" ||
    pathname === "/home";

  const dashboardAppKey = useMemo(() => {
    if (pathname === "/home") return "home";
    if (pathname === "/ims/dashboard") return "ims";
    if (pathname === "/task/dashboard") return "task";
    if (pathname === "/rmstore/dashboard") return "rmstore";
    if (pathname === "/settings/dashboard") return "settings";
    return null;
  }, [pathname]);

  const dashboardFromDate = String(searchParams?.get("df_from") || "");
  const dashboardToDate = String(searchParams?.get("df_to") || "");
  const dashboardUserId = String(searchParams?.get("df_user") || "");
  const dashboardSelectedKey = String(searchParams?.get("df_dash") || "").trim().toLowerCase();
  const dashboardDefaultsAppliedRef = useRef(false);
  const today = dayjs().format("YYYY-MM-DD");
  const { from: activeFromDate, to: activeToDate } = useMemo(
    () => normalizeDashboardDateRange(dashboardFromDate, dashboardToDate, today),
    [dashboardFromDate, dashboardToDate, today],
  );

  const updateDashboardFilterQuery = useCallback((nextValues = {}, forceRefresh = false) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(nextValues).forEach(([key, value]) => {
      const text = String(value || "").trim();
      if (!text) params.delete(key);
      else params.set(key, text);
    });
    if (forceRefresh) {
      params.set("df_r", String(Date.now()));
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }, [pathname, router, searchParams]);

  const refreshDashboardFilters = useCallback(() => {
    updateDashboardFilterQuery({}, true);
  }, [updateDashboardFilterQuery]);

  const showDashboardFilters = isDashboardRoute && dashboardActive === true;
  const lastSyncLabel = useMemo(
    () => formatDashboardSyncTime(lastSyncAt),
    [lastSyncAt, syncTick],
  );
  const lastSyncTitle = useMemo(
    () => formatDashboardSyncTitle(lastSyncAt),
    [lastSyncAt],
  );

  useEffect(() => {
    if (!showDashboardFilters || !dashboardAppKey) {
      setLastSyncAt(null);
      setIsDashboardSyncing(false);
      return undefined;
    }

    const matchesApp = (detail) => !detail?.appKey || detail.appKey === dashboardAppKey;

    const onSyncStart = (event) => {
      if (!matchesApp(event?.detail)) return;
      setIsDashboardSyncing(true);
    };
    const onSyncComplete = (event) => {
      if (!matchesApp(event?.detail)) return;
      setIsDashboardSyncing(false);
      setLastSyncAt(Number(event?.detail?.syncedAt) || Date.now());
    };
    const onSyncError = (event) => {
      if (!matchesApp(event?.detail)) return;
      setIsDashboardSyncing(false);
    };

    window.addEventListener(DASHBOARD_SYNC_START_EVENT, onSyncStart);
    window.addEventListener(DASHBOARD_SYNC_EVENT, onSyncComplete);
    window.addEventListener(DASHBOARD_SYNC_ERROR_EVENT, onSyncError);
    return () => {
      window.removeEventListener(DASHBOARD_SYNC_START_EVENT, onSyncStart);
      window.removeEventListener(DASHBOARD_SYNC_EVENT, onSyncComplete);
      window.removeEventListener(DASHBOARD_SYNC_ERROR_EVENT, onSyncError);
    };
  }, [showDashboardFilters, dashboardAppKey]);

  useEffect(() => {
    if (!showDashboardFilters) return undefined;
    const id = window.setInterval(() => setSyncTick((tick) => tick + 1), DASHBOARD_SYNC_TICK_MS);
    return () => window.clearInterval(id);
  }, [showDashboardFilters]);

  // Auto-refresh disabled for now — sync only on page open + manual refresh button.
  // Re-enable later when needed.
  // useEffect(() => {
  //   if (!showDashboardFilters || dashboardActive !== true) return undefined;
  //   const id = window.setInterval(() => {
  //     if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  //     refreshDashboardFilters();
  //   }, DASHBOARD_AUTO_REFRESH_MS);
  //   return () => window.clearInterval(id);
  // }, [showDashboardFilters, dashboardActive, refreshDashboardFilters]);

  useEffect(() => {
    if (!dashboardAppKey) {
      setDashboardActive(null);
      setUserDashboards(null);
      return undefined;
    }
    let cancelled = false;
    const loadDashboardStatus = async () => {
      try {
        const response = await getDashboardStatus(
          dashboardAppKey,
          dashboardSelectedKey || "default",
        );
        if (!cancelled) {
          setDashboardActive(response?.data?.active === true);
        }
      } catch (_error) {
        if (!cancelled) setDashboardActive(false);
      }
    };
    loadDashboardStatus();
    return () => {
      cancelled = true;
    };
  }, [dashboardAppKey, pathname, dashboardSelectedKey]);

  useEffect(() => {
    if (!dashboardAppKey || dashboardActive !== true) {
      setUserDashboards(null);
      return undefined;
    }
    let cancelled = false;
    const loadUserDashboards = async () => {
      try {
        const response = await getUserDashboards(dashboardAppKey);
        if (!cancelled) {
          setUserDashboards(response?.data || null);
        }
      } catch (_error) {
        if (!cancelled) setUserDashboards(null);
      }
    };
    loadUserDashboards();
    return () => {
      cancelled = true;
    };
  }, [dashboardAppKey, dashboardActive, pathname]);

  const applyDashboardFromDate = useCallback(
    (ymd) => {
      const next = String(ymd || "").trim();
      if (!next || !dayjs(next, "YYYY-MM-DD", true).isValid()) return;
      const { from, to } = normalizeDashboardDateRange(next, dashboardToDate || today, today, { anchor: "from" });
      if (from === activeFromDate && to === activeToDate) return;
      updateDashboardFilterQuery({ df_from: from, df_to: to }, true);
    },
    [activeFromDate, activeToDate, dashboardToDate, today, updateDashboardFilterQuery],
  );

  const applyDashboardToDate = useCallback(
    (ymd) => {
      const next = String(ymd || "").trim();
      if (!next || !dayjs(next, "YYYY-MM-DD", true).isValid()) return;
      const { from, to } = normalizeDashboardDateRange(dashboardFromDate || today, next, today, { anchor: "to" });
      if (from === activeFromDate && to === activeToDate) return;
      updateDashboardFilterQuery({ df_from: from, df_to: to }, true);
    },
    [activeFromDate, activeToDate, dashboardFromDate, today, updateDashboardFilterQuery],
  );

  useEffect(() => {
    if (!isDashboardRoute || dashboardActive !== true) {
      dashboardDefaultsAppliedRef.current = false;
      return;
    }
    const from = String(searchParams?.get("df_from") || "").trim();
    const to = String(searchParams?.get("df_to") || "").trim();
    if (!from && !to && !dashboardDefaultsAppliedRef.current) {
      dashboardDefaultsAppliedRef.current = true;
      updateDashboardFilterQuery({ df_from: today, df_to: today }, true);
      return;
    }
    const { from: normalizedFrom, to: normalizedTo } = normalizeDashboardDateRange(from, to, today);
    if (normalizedFrom !== from || normalizedTo !== to) {
      updateDashboardFilterQuery({ df_from: normalizedFrom, df_to: normalizedTo }, true);
    }
  }, [isDashboardRoute, dashboardActive, searchParams, today, updateDashboardFilterQuery]);

  useEffect(() => {
    const sync = () => setIsPwa(isPwaStandalone());
    sync();
    const mq = window.matchMedia?.("(display-mode: standalone)");
    mq?.addEventListener?.("change", sync);
    return () => mq?.removeEventListener?.("change", sync);
  }, []);

  const isSuperAdmin = useMemo(() => {
    const normalized = String(role || "").toLowerCase().trim();
    return normalized === "super_admin" || normalized === "super admin";
  }, [role]);

  const shortcutRows = useMemo(() => {
    const base = isPwa
      ? [
        { id: "listNew", label: "New Form (list)", parts: ["CTRL", "N"] },
        { id: "listEdit", label: "Edit Selected (list)", parts: ["CTRL", "E"] },
        { id: "listDelete", label: "Delete Selected (list)", parts: ["CTRL", "D"] },
        { id: "authorize", label: "Authorize Selected", parts: ["CTRL", "A"] },
        { id: "save", label: "Save / Submit", parts: ["CTRL", "S"] },
        { id: "closeOverlay", label: "Close Modal / Form", parts: ["ESC"] },
        { id: "copyRow", label: "Copy Row Data", parts: ["CTRL", "C"] },
        { id: "listPrint", label: "Print Selected (list)", parts: ["CTRL", "P"] },
      ]
      : [
        { id: "listNew", label: "New Form (list)", parts: getListHotkeyParts("n", false) },
        { id: "listEdit", label: "Edit Selected (list)", parts: getListHotkeyParts("e", false) },
        { id: "save", label: "Save / Submit", parts: ["CTRL", "S"] },
        { id: "closeOverlay", label: "Close Modal / Form", parts: ["ESC"] },
        { id: "copyRow", label: "Copy Row Data", parts: ["CTRL", "C"] },
        { id: "authorize", label: "Authorize Selected", parts: ["CTRL", "A"] },
        { id: "listPrint", label: "Print Selected (list)", parts: getListHotkeyParts("p", false) },
      ];

    if (!isSuperAdmin) return base;

    return [
      ...base,
      { id: "dashUndo", label: "Widget Builder Undo", parts: ["CTRL", "Z"] },
      { id: "dashRedo", label: "Widget Builder Redo", parts: ["CTRL", "Y"] },
      { id: "dashSave", label: "Widget Builder Save Draft", parts: ["CTRL", "S"] },
      {
        id: "dashPublish",
        label: "Widget Builder Publish",
        parts: getListHotkeyParts("u", isPwa),
      },
    ];
  }, [isPwa, isSuperAdmin]);

  const isRmStorePath = pathname?.startsWith("/rmstore/");
  const navRegistry = isRmStorePath ? RM_STORE_NAV_REGISTRY : NAV_REGISTRY;
  const currentModule = useMemo(() => {
    for (const item of navRegistry) {
      if (item.href === pathname) return item;
      if (item.subItems) {
        const sub = item.subItems.find(s => s.href === pathname);
        if (sub) return sub;
      }
    }
    return null;
  }, [pathname, navRegistry]);

  const filteredQuickLinks = useMemo(() => {
    return getQuickLinksForPathname(pathname).filter((link) => {
      if (!link.module) return true;
      const access = canAccess(link.module, "view");
      return typeof access === "object" ? access.allowed : !!access;
    });
  }, [pathname, canAccess]);

  const fetchVideos = useCallback(async () => {
    const slug = currentModule?.module;
    if (!slug) return;

    setLoading(true);
    try {
      const res = await trainingVideoService.getViews({
        module_slug: slug,
        permission_module: slug,
        permission_action: "view",
      });
      if (res.success) {
        setTrainingData(res.data || []);
      }
    } catch (error) {
      console.error("Help fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentModule]);

  // 3. Trigger fetch when drawer opens or module changes
  useEffect(() => {
    if (helpOpen) {
      fetchVideos();
    } else {
      setTrainingData([]);
    }
  }, [helpOpen, fetchVideos]);

  useEffect(() => {
    if (!isDashboardRoute || dashboardActive !== true || !canFilterByUser) {
      setDashboardUsers([]);
      return undefined;
    }
    const loadUsers = async () => {
      try {
        const response = await api(CORE_ENDPOINTS.USERS.LIST, {
          method: "POST",
          body: { page: 1, limit: 5000, filters: { status: "active" } },
        });
        const rows = Array.isArray(response?.data) ? response.data : [];
        setDashboardUsers(
          rows.map((row) => ({
            value: String(row.id),
            label: row.name || row.username || `User ${row.id}`,
          })),
        );
      } catch (_error) {
        setDashboardUsers([]);
      }
    };
    loadUsers();
  }, [isDashboardRoute, dashboardActive, canFilterByUser]);

  useEffect(() => {
    if (!isDashboardRoute || dashboardActive !== true || canFilterByUser) return;
    const urlUser = String(searchParams?.get("df_user") || "").trim();
    if (urlUser) {
      updateDashboardFilterQuery({ df_user: "" }, true);
    }
  }, [isDashboardRoute, dashboardActive, canFilterByUser, searchParams, updateDashboardFilterQuery]);

  // Helper: YouTube URL parser
  const getEmbedUrl = (url) => {
    if (!url) return "";
    if (url.includes('iframe')) {
      const src = url.match(/src="([^"]+)"/);
      return src ? src[1] : "";
    }
    // Clean URL for embedding
    let videoId = "";
    if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
    else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
    else return url;

    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  };

  const toggleDesc = (id) => {
    setExpandedDesc(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const dashboardList = useMemo(
    () => (Array.isArray(userDashboards?.dashboards) ? userDashboards.dashboards : []),
    [userDashboards],
  );
  const dashboardDefaultKey = String(userDashboards?.default_key || "default").toLowerCase();
  const dashboardActiveKey = dashboardSelectedKey || dashboardDefaultKey;
  const showDashboardSwitcher = showDashboardFilters && (
    dashboardList.length > 1 || (canFilterByUser && dashboardList.length > 0)
  );

  const applyDashboardSelection = useCallback(
    (nextKey = "") => {
      const normalized = String(nextKey || "").trim().toLowerCase();
      if (!normalized) return;
      if (normalized === dashboardDefaultKey) {
        updateDashboardFilterQuery({ df_dash: "" }, true);
        return;
      }
      updateDashboardFilterQuery({ df_dash: normalized }, true);
    },
    [dashboardDefaultKey, updateDashboardFilterQuery],
  );

  useEffect(() => {
    if (!isDashboardRoute || dashboardActive !== true || !dashboardList.length) return;
    const allowed = new Set(
      dashboardList.map((item) => String(item.dashboard_key || "").toLowerCase()),
    );
    const selected = String(dashboardSelectedKey || "").trim().toLowerCase();
    if (selected && !allowed.has(selected)) {
      updateDashboardFilterQuery({ df_dash: "" }, true);
    }
  }, [
    isDashboardRoute,
    dashboardActive,
    dashboardList,
    dashboardSelectedKey,
    updateDashboardFilterQuery,
  ]);

  // Task / Settings: no empty dark spacer when quick links are hidden
  if (hideQuickLinks && !showDashboardFilters) {
    return null;
  }

  return (
    <>
      <nav
        className={`${THEME_CONFIG.footerBg} backdrop-blur-md border-b ${THEME_CONFIG.sidebarBorder} px-2 sm:px-3 py-1.5 sm:py-1.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 shadow-sm min-w-0`}
      >
        {/* Row 1 — Quick Links */}
        {!hideQuickLinks ? (
          <div className="flex items-center gap-3 sm:gap-5 md:gap-7 overflow-x-auto no-scrollbar w-full sm:flex-1 sm:min-w-0 py-0.5">
            {filteredQuickLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => router.push(link.path)}
                className="flex items-center gap-1.5 group shrink-0 hover:opacity-80 transition-opacity"
              >
                <span className={`${THEME_CONFIG.sidebarIcon} dashboard-qab-link-icon`}>{link.icon}</span>
                <span className={`text-[10px] font-bold ${THEME_CONFIG.sidebarText} uppercase tracking-tight whitespace-nowrap`}>
                  {link.label}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Row 2+ on phone — dates, then users/actions; desktop single row */}
        {(showDashboardFilters || (currentModule && !hideQuickLinks)) && (
          <div className="flex flex-col gap-1 w-full sm:flex-row sm:items-center sm:shrink-0 sm:justify-end sm:flex-1 sm:min-w-0 sm:gap-1.5">
            {showDashboardFilters && (
              <div
                data-dashboard-qab=""
                className={`dashboard-qab-filters flex w-full sm:w-auto sm:shrink-0 gap-1.5 ${
                  canFilterByUser
                    ? "flex-col sm:flex-row sm:items-center sm:rounded-md sm:border sm:border-slate-700/70 sm:bg-slate-900/40 sm:px-1.5 sm:py-1"
                    : "flex-row items-center sm:rounded-md sm:border sm:border-slate-700/70 sm:bg-slate-900/40 sm:px-1.5 sm:py-1"
                }`}
              >
                <div
                  className={
                    canFilterByUser
                      ? "grid grid-cols-2 gap-1 w-full sm:flex sm:items-center sm:gap-1 sm:w-auto"
                      : "grid grid-cols-2 gap-1 flex-1 min-w-0 sm:flex sm:items-center sm:gap-1 sm:w-auto"
                  }
                >
                  <div className="dashboard-qab-date min-w-0">
                    <FilterDateInput
                      key={`dash-from-${activeFromDate}`}
                      valueYmd={activeFromDate}
                      onChangeYmd={applyDashboardFromDate}
                      aria-label="From date"
                      placeholder="DD/MM/YY"
                    />
                  </div>
                  <div className="dashboard-qab-date min-w-0">
                    <FilterDateInput
                      key={`dash-to-${activeToDate}`}
                      valueYmd={activeToDate}
                      onChangeYmd={applyDashboardToDate}
                      aria-label="To date"
                      placeholder="DD/MM/YY"
                    />
                  </div>
                </div>
                <div
                  className={
                    canFilterByUser
                      ? "flex items-center gap-1 w-full sm:w-auto"
                      : "flex items-center shrink-0 gap-1"
                  }
                >
                  {showDashboardSwitcher ? (
                    <select
                      value={dashboardActiveKey}
                      onChange={(e) => applyDashboardSelection(e.target.value)}
                      aria-label="Dashboard"
                      className="dashboard-qab-dash h-7 sm:h-6 min-w-0 flex-1 sm:flex-none rounded border border-slate-700/80 sm:border-slate-700 bg-slate-950/40 sm:bg-slate-950/60 px-1.5 text-[10px] font-bold uppercase tracking-tight text-slate-300 sm:text-slate-200 outline-none focus:border-blue-500"
                    >
                      {dashboardList.map((option) => (
                        <option key={option.dashboard_key} value={option.dashboard_key}>
                          {option.dashboard_name}
                          {option.is_default ? " (Default)" : ""}
                          {/* {option.scope === "users" ? " (Clone)" : ""} */}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {canFilterByUser ? (
                    <select
                      value={dashboardUserId}
                      onChange={(e) => updateDashboardFilterQuery({ df_user: e.target.value }, true)}
                      className="dashboard-qab-user h-7 sm:h-6 min-w-0 flex-1 sm:flex-none rounded border border-slate-700/80 sm:border-slate-700 bg-slate-950/40 sm:bg-slate-950/60 px-1.5 text-[10px] font-bold uppercase tracking-tight text-slate-300 sm:text-slate-200 outline-none focus:border-blue-500"
                    >
                      <option value="">All Users</option>
                      {dashboardUsers.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <span
                    className="dashboard-qab-sync hidden md:inline text-[9px] font-semibold text-slate-400 whitespace-nowrap"
                    title={lastSyncTitle}
                  >
                    Sync: {lastSyncLabel}
                  </span>
                  <span
                    className="dashboard-qab-sync-mobile md:hidden text-[8px] font-semibold text-slate-400 whitespace-nowrap max-w-[64px] truncate"
                    title={lastSyncTitle}
                  >
                    {lastSyncLabel}
                  </span>
                  <button
                    type="button"
                    onClick={refreshDashboardFilters}
                    title={isDashboardSyncing ? "Refreshing dashboard..." : lastSyncTitle}
                    className="dashboard-qab-refresh h-7 w-7 sm:h-6 sm:w-auto sm:px-2 shrink-0 rounded border border-blue-500/30 sm:border-blue-500/40 bg-blue-500/10 text-[10px] font-bold uppercase tracking-tight text-blue-300 hover:bg-blue-500/20 inline-flex items-center justify-center gap-0.5 whitespace-nowrap"
                  >
                    <RefreshCw size={12} className={`shrink-0 ${isDashboardSyncing ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                  {currentModule && !hideQuickLinks && (
                    <button
                      type="button"
                      onClick={() => setHelpOpen(true)}
                      title="Help"
                      className="sm:hidden flex items-center justify-center shrink-0 h-7 w-7 rounded bg-indigo-600/90 text-white hover:opacity-90 transition-all active:scale-95"
                    >
                      <HelpCircle size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {currentModule && !hideQuickLinks && (
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                title="Help"
                className="hidden sm:flex items-center justify-center shrink-0 h-6 sm:px-3 sm:py-1.5 sm:border-l sm:border-slate-700/50 sm:pl-2 bg-indigo-600 sm:text-white md:bg-indigo-50 md:text-indigo-600 rounded md:rounded-lg hover:opacity-90 transition-all active:scale-95"
              >
                <HelpCircle size={14} className="md:animate-pulse" />
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Help Drawer */}
      <Drawer
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-600" />
            <span className="text-slate-800 font-bold uppercase text-xs tracking-widest">{currentModule?.name}</span>
          </div>
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-6 pb-10">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-4">
              <Loader2 className="animate-spin text-indigo-500" size={40} strokeWidth={3} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing Module Data</span>
            </div>
          ) : trainingData.length > 0 ? (
            trainingData.map((item) => (
              <div key={item.id} className="mb-5 bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                {/* Video Section */}
                <div className="aspect-video bg-black relative">
                  <iframe 
                    className="w-full h-full"
                    src={getEmbedUrl(item.video_url)}
                    title={item.title}
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                </div>

                {/* Content Section */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-black uppercase tracking-tight">
                      {item.title}
                    </h3>
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                      {item.permission_type}
                    </span>
                  </div>

                  {/* Documentation Button */}
                  <button 
                    onClick={() => toggleDesc(item.id)} 
                    className={expandedDesc[item.id] 
                      ? 'w-full flex items-center justify-between py-2 px-3 rounded-xl bg-black text-white transition-all' 
                      : 'w-full flex items-center justify-between py-2 px-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all'
                    }
                  >
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                      <Info size={14} strokeWidth={3} /> 
                      <span>Documentation</span>
                    </div>
                    <ChevronDown 
                      size={16} 
                      strokeWidth={3}
                      className={expandedDesc[item.id] ? 'rotate-180 transition-transform' : 'transition-transform'} 
                    />
                  </button>

                  {/* Description Content */}
                  {expandedDesc[item.id] && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border-l-4 border-indigo-500">
                      <div 
                        className="text-[12px] text-slate-700 leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: item.description }} 
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 px-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
              <VideoOff className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">No tutorials found</p>
              <p className="text-[10px] text-slate-400 mt-1">Documentation is not yet uploaded for this module.</p>
            </div>
          )}

          {/* Keyboard Shortcuts — not useful on phone / touch; show md+ */}
          <div className="hidden md:block mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard size={16} className="text-indigo-600" />
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Keyboard Shortcuts</h4>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {shortcutRows.map((row) => (
                <ShortcutRow key={row.id} label={row.label} parts={row.parts} />
              ))}
            </div>

          </div>

          <div className="mt-5 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
              <div className="flex items-center gap-2 min-w-0">
                <Tag size={14} className="text-indigo-600 shrink-0" />
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                  App Version
                </span>
              </div>
              <span className="text-sm font-black text-slate-800 font-mono tracking-tight shrink-0">
                v{APP_VERSION}
              </span>
            </div>
          </div>
        </div>
      </Drawer>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .dashboard-qab-link-icon svg {
          width: 14px;
          height: 14px;
        }
        [data-dashboard-qab] input,
        [data-dashboard-qab] select {
          font-family: inherit;
          -webkit-text-size-adjust: 100%;
        }
        .dashboard-qab-date > div {
          gap: 0 !important;
        }
        .dashboard-qab-date label {
          display: none;
        }
        .dashboard-qab-date .relative {
          width: 100%;
        }
        /* Phone — full-width dates, icon text ke upar na aaye */
        .dashboard-qab-date input {
          height: 28px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.25);
          padding: 0 26px 0 8px !important;
          color: rgb(226 232 240);
          outline: none;
        }
        [data-dashboard-qab] .dashboard-qab-dash,
        [data-dashboard-qab] .dashboard-qab-user {
          letter-spacing: -0.025em;
        }
        .dashboard-qab-date button {
          width: 22px !important;
          min-width: 22px !important;
          height: 100% !important;
          right: 0 !important;
          color: rgb(148 163 184);
          padding: 0 !important;
        }
        .dashboard-qab-date button svg {
          width: 12px;
          height: 12px;
        }
        @media (min-width: 640px) {
          .dashboard-qab-date input {
            height: 24px;
            width: 112px;
            min-width: 112px;
            padding: 0 28px 0 6px !important;
            border: 1px solid rgb(51 65 85);
            background: rgba(2, 6, 23, 0.6);
          }
          [data-dashboard-qab] input {
            border: 1px solid rgb(51 65 85);
            background: rgba(2, 6, 23, 0.6);
          }
          .dashboard-qab-user {
            width: 130px;
            min-width: 130px;
          }
          .dashboard-qab-dash {
            width: 148px;
            min-width: 148px;
          }
          .dashboard-qab-date button {
            width: 28px !important;
            min-width: 28px !important;
          }
          .dashboard-qab-date button svg {
            width: 13px;
            height: 13px;
          }
        }
        .dashboard-qab-date input:focus {
          border-color: rgb(59 130 246);
        }
        .dashboard-qab-date input::placeholder {
          color: rgb(100 116 139);
          font-size: 10px;
        }
        .dashboard-qab-date button:hover {
          color: rgb(96 165 250);
        }
      `}</style>
    </>
  );
}
