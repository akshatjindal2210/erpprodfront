"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NETWORK_REACHABLE_EVENT,
  NETWORK_UNREACHABLE_EVENT,
  checkCompanyBackendReachable,
  isBrowserOffline,
} from "@/core/utils/companyNetwork";

const ONLINE_RECHECK_MS = 1500;

export function useCompanyNetworkGuard() {
  const [blocked, setBlocked] = useState(() => isBrowserOffline());
  const [checking, setChecking] = useState(false);
  const onlineRecheckRef = useRef(null);

  const verifyReachability = useCallback(async () => {
    if (isBrowserOffline()) {
      setBlocked(true);
      return false;
    }

    setChecking(true);
    try {
      const ok = await checkCompanyBackendReachable();
      setBlocked(!ok);
      return ok;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const onOffline = () => setBlocked(true);

    const onOnline = () => {
      if (onlineRecheckRef.current) clearTimeout(onlineRecheckRef.current);
      onlineRecheckRef.current = setTimeout(() => {
        void verifyReachability();
      }, ONLINE_RECHECK_MS);
    };

    const onUnreachable = () => setBlocked(true);
    const onReachable = () => setBlocked(false);

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener(NETWORK_UNREACHABLE_EVENT, onUnreachable);
    window.addEventListener(NETWORK_REACHABLE_EVENT, onReachable);

    return () => {
      if (onlineRecheckRef.current) clearTimeout(onlineRecheckRef.current);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(NETWORK_UNREACHABLE_EVENT, onUnreachable);
      window.removeEventListener(NETWORK_REACHABLE_EVENT, onReachable);
    };
  }, [verifyReachability]);

  return { blocked, checking, retry: verifyReachability };
}
