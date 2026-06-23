"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { Bell, X, AlertTriangle } from "lucide-react";
import { selectUser } from "@/core/store/slices/authSlice";
import { getTaskNotifyPermission, requestTaskNotifyPermission } from "@/features/apps/task/pwa/taskPushNotify";

const DISMISS_KEY = "task_notify_banner_dismiss";

export default function TaskNotifyEnableBanner() {
  const user = useSelector(selectUser);
  const [permission, setPermission] = useState("default");
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const secure = typeof window === "undefined" || window.isSecureContext;

  useEffect(() => {
    setPermission(getTaskNotifyPermission());
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [user?.id]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const result = await requestTaskNotifyPermission();
      setPermission(result);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!user?.id) return null;

  if (!secure) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-[9998] mx-auto max-w-lg rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 shadow-lg text-sm text-rose-900 flex gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-semibold">HTTPS required</p>
          <p className="text-xs mt-1">Windows and phone alerts need HTTPS or localhost.</p>
        </div>
      </div>
    );
  }

  if (permission === "granted" || permission === "unsupported") return null;
  if (dismissed) return null;

  if (permission === "denied") {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-[9998] mx-auto max-w-lg rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg text-sm text-amber-900">
        <p className="font-semibold">Notifications blocked</p>
        <p className="text-xs mt-1">Open browser settings → Notifications → Allow, then reload.</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9998] mx-auto max-w-lg rounded-lg border border-indigo-200 bg-white px-4 py-3 shadow-lg flex items-center gap-3">
      <Bell className="w-5 h-5 text-indigo-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">Enable task alerts</p>
        <p className="text-xs text-slate-500">
          You will get a notification on Windows or your phone when a task is assigned to you.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={enable}
        className="shrink-0 px-3 py-1.5 text-xs font-bold uppercase bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? "..." : "Allow"}
      </button>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
        }}
        className="shrink-0 p-1 text-slate-400 hover:text-slate-600"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
