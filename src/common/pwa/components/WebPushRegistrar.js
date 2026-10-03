"use client";

import { useEffect } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "@/platform/store/slices/authSlice";
import { flushPushDeliveryQueue, linkPushSubscriptionToUser, syncPushApiBaseToServiceWorker, syncPushSubscriptionIfGranted } from "../webPushSubscribe";
import { clearAppBadge, syncAppBadgeFromServer } from "@/platform/utils/pwa/pwaAppBadge";

/** Registers/syncs Web Push on app load and links device subscription after login. */
export default function WebPushRegistrar() {
  const user = useSelector(selectUser);

  useEffect(() => {
    const syncAll = () => {
      syncPushApiBaseToServiceWorker();
      void syncPushSubscriptionIfGranted().catch(() => {});
      flushPushDeliveryQueue();
    };

    syncAll();

    const onOnline = () => syncAll();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        syncAll();
        if (user?.id) void syncAppBadgeFromServer();
      }
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      clearAppBadge();
      return;
    }
    void linkPushSubscriptionToUser({ userId: user.id }).catch(() => {});
    void syncAppBadgeFromServer();
  }, [user?.id]);

  return null;
}
