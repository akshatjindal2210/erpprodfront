"use client";

import { useEffect } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "@/core/store/slices/authSlice";
import { linkPushSubscriptionToUser, syncPushApiBaseToServiceWorker, syncPushSubscriptionIfGranted } from "../webPushSubscribe";

/** Registers/syncs Web Push on app load and links device subscription after login. */
export default function WebPushRegistrar() {
  const user = useSelector(selectUser);

  useEffect(() => {
    syncPushApiBaseToServiceWorker();
    void syncPushSubscriptionIfGranted().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void linkPushSubscriptionToUser({ userId: user.id }).catch(() => {});
  }, [user?.id]);

  return null;
}
