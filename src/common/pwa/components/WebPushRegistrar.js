"use client";

import { useEffect } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "@/platform/store/slices/authSlice";
import { flushPushDeliveryQueue, linkPushSubscriptionToUser, syncPushApiBaseToServiceWorker, syncPushSubscriptionIfGranted } from "../webPushSubscribe";
import { syncGlobalIconBadge } from "@/platform/utils/pwa/pwaAppBadge";

export default function WebPushRegistrar() {
  const user = useSelector(selectUser);

  useEffect(() => {
    const syncPush = () => {
      syncPushApiBaseToServiceWorker();
      void syncPushSubscriptionIfGranted().catch(() => {});
      flushPushDeliveryQueue();
    };
    syncPush();
    window.addEventListener("online", syncPush);
    return () => window.removeEventListener("online", syncPush);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void linkPushSubscriptionToUser({ userId: user.id }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const onSwMessage = (event) => {
      if (event.data?.type === "SYNC_APP_BADGE") void syncGlobalIconBadge();
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, [user?.id]);

  return null;
}
