"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { Bell, AlertTriangle, Smartphone, Loader2 } from "lucide-react";
import { selectHasAppAccess, selectUser } from "@/core/store/slices/authSlice";
import { getTaskNotifyPermission, requestTaskNotifyPermission } from "@/features/apps/task/pwa/taskPushNotify";
import { getIosPushInstallHint, isWebPushSupported, clearPushLinkSessionCache, linkPushSubscriptionToUser, subscribeToWebPush } from "@/features/shared/pwa/webPushSubscribe";

import { isPwaStandalone } from "@/core/utils/pwa";

function readNotifyPermission() {
  return getTaskNotifyPermission();
}

function shouldShowNotifyGate(pathname) {
  if (!pathname) return false;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  return true;
}

function BlockOverlay({ icon: Icon, iconClass, title, children, actions }) {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notify-gate-title"
      >
        {Icon && (
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${iconClass}`}>
            <Icon className="h-7 w-7" />
          </div>
        )}
        <h2 id="notify-gate-title" className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        <div className="mt-2 text-sm text-slate-600 leading-relaxed">{children}</div>
        {actions && <div className="mt-6 flex flex-col gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export default function TaskNotifyEnableBanner() {
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const hasTaskAccess = useSelector(selectHasAppAccess("task"));
  const onNotifyRoute = shouldShowNotifyGate(pathname);
  const canGate = !!user?.id && hasTaskAccess && onNotifyRoute;

  const [permission, setPermission] = useState("default");
  const [busy, setBusy] = useState(false);
  const [iosHint, setIosHint] = useState(null);
  const [declinedAttempt, setDeclinedAttempt] = useState(false);

  const secure = typeof window === "undefined" || window.isSecureContext;
  const pushSupported = isWebPushSupported();
  const iosInstallHint = iosHint || getIosPushInstallHint();

  const refreshPermission = useCallback(() => {
    setPermission(readNotifyPermission());
    setIosHint(getIosPushInstallHint());
  }, []);

  useEffect(() => {
    refreshPermission();
  }, [refreshPermission]);

  useEffect(() => {
    if (!canGate) return undefined;

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshPermission();
    };

    window.addEventListener("focus", refreshPermission);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refreshPermission);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [canGate, refreshPermission]);

  const isBlocked = canGate && permission !== "granted";

  useEffect(() => {
    if (!isBlocked) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isBlocked]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const result = await subscribeToWebPush();
      if (result.ok) {
        setPermission("granted");
        setIosHint(null);
        setDeclinedAttempt(false);
        if (user?.id) {
          clearPushLinkSessionCache();
          void linkPushSubscriptionToUser({ userId: user.id }).catch(() => {});
        }
        return;
      }
      if (result.error === "ios_install_required") {
        setIosHint(result.message);
        return;
      }
      if (result.error === "denied" || result.error === "default") {
        setPermission(result.error);
        if (result.error === "default") setDeclinedAttempt(true);
        return;
      }
      const perm = await requestTaskNotifyPermission();
      setPermission(perm);
      if (perm !== "granted") setDeclinedAttempt(true);
    } finally {
      setBusy(false);
    }
  }, [user?.id]);

  if (!canGate) return null;
  if (permission === "granted") return null;

  if (!secure) {
    return (
      <BlockOverlay
        icon={AlertTriangle}
        iconClass="bg-rose-100 text-rose-600"
        title="HTTPS required"
      >
        <p>Task alerts need a secure connection (HTTPS or localhost). You cannot continue until this is fixed.</p>
      </BlockOverlay>
    );
  }

  if (iosInstallHint) {
    return (
      <BlockOverlay
        icon={Smartphone}
        iconClass="bg-amber-100 text-amber-700"
        title="Install app for iPhone alerts"
      >
        <p>{iosInstallHint}</p>
        <p className="mt-2 text-xs text-slate-500">After installing from Home Screen, open the app and tap Allow.</p>
      </BlockOverlay>
    );
  }

  if (!pushSupported || permission === "unsupported") {
    return (
      <BlockOverlay
        icon={AlertTriangle}
        iconClass="bg-slate-100 text-slate-600"
        title="Push not supported"
      >
        <p>Use Chrome, Edge, or Firefox on desktop, or install the PWA on your phone to receive task alerts.</p>
      </BlockOverlay>
    );
  }

  if (permission === "denied") {
    return (
      <BlockOverlay
        icon={AlertTriangle}
        iconClass="bg-amber-100 text-amber-700"
        title="You did not allow notifications"
        actions={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 text-sm font-bold uppercase rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
          >
            I allowed in browser settings — Reload
          </button>
        }
      >
        <p>
          Aapne notifications allow nahi kiye. App use karne ke liye allow karna zaroori hai.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Browser settings → Site settings → Notifications → Allow for this site, phir Reload karein.
        </p>
      </BlockOverlay>
    );
  }

  return (
    <BlockOverlay
      icon={Bell}
      iconClass="bg-indigo-100 text-indigo-600"
      title="Allow notifications to continue"
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={enable}
          className="w-full py-2.5 text-sm font-bold uppercase rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Please wait…
            </>
          ) : (
            "Allow notifications"
          )}
        </button>
      }
    >
      <p>
        {declinedAttempt
          ? "Aapne abhi notifications allow nahi kiye. Browser popup mein Allow dabana zaroori hai — bina iske app use nahi ho sakti."
          : isPwaStandalone()
            ? "Naye device par alerts ke liye notifications allow karna zaroori hai. Allow ke bina app use nahi ho sakti."
            : "Task updates is device par bheje jayenge — app band ho ya logout ho tab bhi. Allow karna zaroori hai."}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Browser popup mein &quot;Allow&quot; dabayein. Agar Block kiya to yahi screen dubara dikhegi.
      </p>
    </BlockOverlay>
  );
}
