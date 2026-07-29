"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NETWORK_REACHABLE_EVENT, NETWORK_UNREACHABLE_EVENT, checkCompanyBackendReachable, isBrowserOffline, shouldShowCompanyWifiGate } from "@/platform/utils/auth/companyNetwork";
import { isPwaStandalone } from "@/platform/utils/pwa/pwa";

const ONLINE_RECHECK_MS = 1500;
const BLOCKED_RECHECK_MS = 3000;

export function useCompanyNetworkGuard() {
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const onlineRecheckRef = useRef(null);

  const verifyReachability = useCallback(async () => {
    if (!isPwaStandalone()) {
      setBlocked(false);
      return true;
    }

    if (isBrowserOffline()) {
      const show = await shouldShowCompanyWifiGate({ offline: true });
      setBlocked(show);
      return !show;
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
    void verifyReachability();
  }, [verifyReachability]);

  useEffect(() => {
    const onOffline = () => {
      void (async () => {
        const show = await shouldShowCompanyWifiGate({ offline: true });
        setBlocked(show);
      })();
    };

    const onOnline = () => {
      if (onlineRecheckRef.current) clearTimeout(onlineRecheckRef.current);
      onlineRecheckRef.current = setTimeout(() => {
        void verifyReachability();
      }, ONLINE_RECHECK_MS);
    };

    const onUnreachable = () => {
      void (async () => {
        const show = await shouldShowCompanyWifiGate({ transportFailure: true });
        if (show) setBlocked(true);
      })();
    };
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

  useEffect(() => {
    if (!blocked || !isPwaStandalone()) return undefined;

    const id = setInterval(() => {
      void verifyReachability();
    }, BLOCKED_RECHECK_MS);

    return () => clearInterval(id);
  }, [blocked, verifyReachability]);

  return { blocked: blocked && isPwaStandalone(), checking };
}
