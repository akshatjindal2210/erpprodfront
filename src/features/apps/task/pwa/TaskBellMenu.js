"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { Bell, CheckCheck, ChevronDown } from "lucide-react";
import { selectUser } from "@/core/store/slices/authSlice";
import { subscribeInbox, getInboxState } from "./taskInboxStore";
import {
  loadUnreadInbox,
  loadMoreInbox,
  markOneInboxRead,
  markAllInboxRead,
  setInboxAppScope,
} from "./taskInboxActions";
import { getInboxAppFilter } from "./inboxAppFilter";
import { stripHtml } from "./taskNotifyHelpers";

const APP_TAG = {
  task: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/25 dark:text-indigo-200 dark:border-indigo-500/40",
  ims: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/25 dark:text-emerald-200 dark:border-emerald-500/40",
  default: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600",
};

function appTagClass(appType) {
  return APP_TAG[appType] ?? APP_TAG.default;
}

function badgeCount(total) {
  if (total <= 0) return null;
  return String(total);
}

function badgeSizeClass(countText) {
  const len = countText?.length ?? 0;
  if (len >= 3) return "min-w-[18px] h-3.5 px-0.5 text-[7px]";
  if (len >= 2) return "min-w-[15px] h-3.5 px-0.5 text-[8px]";
  return "min-w-[14px] h-3.5 px-0.5 text-[8px]";
}

export default function TaskBellMenu({ theme = "dark", appFilter: appFilterProp = undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const light = theme === "light";
  const appFilter = appFilterProp !== undefined ? appFilterProp : getInboxAppFilter(pathname);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [{ items, total, hasMore }, setInbox] = useState(getInboxState);
  const menuRef = useRef(null);

  useEffect(() => subscribeInbox(setInbox), []);

  useEffect(() => {
    if (!user?.id) return;
    setInboxAppScope(appFilter);
    void loadUnreadInbox(appFilter).catch(() => {});
  }, [user?.id, appFilter]);

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!user?.id) return null;

  const badge = badgeCount(total);
  const remaining = Math.max(0, total - items.length);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        await loadUnreadInbox(appFilter);
      } finally {
        setLoading(false);
      }
    }
  };

  const onLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadMoreInbox(items.length, appFilter);
    } finally {
      setLoadingMore(false);
    }
  };

  const openItem = async (item) => {
    setOpen(false);
    await markOneInboxRead(item.inbox_id);
    router.push(item.url || "/");
  };

  const panel = light ? "bg-white border-slate-200 shadow-lg" : "bg-slate-900 border-slate-700/80 shadow-xl";
  const divider = light ? "border-slate-100" : "border-white/10";
  const titleText = light ? "text-slate-800" : "text-slate-100";
  const mutedText = light ? "text-slate-500" : "text-slate-400";
  const itemHover = light ? "hover:bg-slate-50" : "hover:bg-white/[0.04]";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={toggle}
        className={`relative rounded-full transition-colors ${
          light ? "p-1.5 text-slate-500 hover:bg-slate-100" : "p-1 text-slate-400 hover:text-white"
        }`}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={light ? 18 : 16} />
        {badge && (
          <span
            className={`absolute top-0 right-0 rounded-full font-bold text-white flex items-center justify-center ${badgeSizeClass(badge)} ${
              light ? "bg-rose-500 ring-1 ring-white" : "bg-blue-500 ring-1 ring-slate-900"
            }`}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-1.5 w-72 border rounded-lg z-50 overflow-hidden ${panel}`}>
          <div className={`flex items-center justify-between px-2.5 py-2 border-b ${divider}`}>
            <h3 className={`text-xs font-semibold ${titleText}`}>Notifications</h3>
            {total > 0 && (
              <span
                className={`text-[9px] font-semibold uppercase px-1.5 py-px rounded ${
                  light ? "bg-rose-50 text-rose-600" : "bg-blue-500/20 text-blue-300"
                }`}
              >
                {total} new
              </span>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto overscroll-contain">
            {loading && items.length === 0 ? (
              <p className={`py-6 text-center text-[10px] ${mutedText}`}>Loading...</p>
            ) : total === 0 ? (
              <div className={`py-7 px-3 text-center ${mutedText}`}>
                <Bell className="w-5 h-5 mx-auto mb-1 opacity-25" strokeWidth={1.5} />
                <p className="text-[10px] font-medium">No new notifications</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-slate-100 dark:divide-white/10">
                  {items.map((item) => (
                    <li key={item.inbox_id}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className={`w-full text-left px-2.5 py-2 transition-colors group ${itemHover}`}
                      >
                        <div className="flex gap-2">
                          <span
                            className={`mt-1 w-1.5 h-1.5 shrink-0 rounded-full ${light ? "bg-indigo-500" : "bg-blue-400"}`}
                            aria-hidden
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className={`text-[8px] font-semibold uppercase px-1 py-px rounded border leading-tight ${appTagClass(item.app_type)}`}
                              >
                                {item.app_type_label || "App"}
                              </span>
                              <span className={`text-[9px] truncate ${mutedText}`}>
                                {item.trigger_label || "Alert"}
                              </span>
                            </div>
                            <p
                              className={`text-[11px] font-medium truncate leading-tight ${titleText} group-hover:text-indigo-600 dark:group-hover:text-indigo-300`}
                            >
                              {stripHtml(item.title)}
                            </p>
                            {item.body && (
                              <p className={`text-[10px] mt-0.5 line-clamp-1 leading-snug ${mutedText}`}>
                                {stripHtml(item.body)}
                              </p>
                            )}
                            {item.created_at && (
                              <p className={`text-[9px] mt-0.5 tabular-nums ${mutedText} opacity-75`}>
                                {item.created_at}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                {hasMore && remaining > 0 && (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={onLoadMore}
                    className={`w-full flex items-center justify-center gap-1 py-2 text-[10px] font-medium border-t ${divider} ${
                      light ? "text-indigo-600 hover:bg-slate-50" : "text-indigo-400 hover:bg-white/5"
                    } disabled:opacity-50`}
                  >
                    <ChevronDown size={12} className={loadingMore ? "animate-pulse" : ""} />
                    {loadingMore ? "Loading..." : `Load more (${remaining})`}
                  </button>
                )}
              </>
            )}
          </div>

          {total > 0 && (
            <div className={`border-t px-2 py-1.5 ${divider}`}>
              <button
                type="button"
                onClick={() => {
                  markAllInboxRead(appFilter);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-center gap-1 text-[10px] font-medium py-1 rounded transition-colors ${
                  light ? "text-slate-600 hover:bg-slate-100" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <CheckCheck size={11} strokeWidth={2} />
                Mark all {total} as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
