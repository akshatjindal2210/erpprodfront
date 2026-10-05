"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { selectUser } from "@/platform/store/slices/authSlice";
import { NETWORK_REACHABLE_EVENT, NETWORK_UNREACHABLE_EVENT, checkCompanyBackendReachable, isBrowserOffline, isExternalFrontendHost, isInternalFrontendHost, shouldShowCompanyWifiGate } from "@/platform/utils/auth/companyNetwork";

function isLoginPath(pathname = "") {
  return pathname === "/login" || pathname.startsWith("/login/");
}

/** Office gate only after login — login page stays usable (external portal link, etc.). */
function shouldRunGate(pathname, userId) {
  if (!userId) return false;
  if (isLoginPath(pathname)) return false;
  return isInternalFrontendHost() && !isExternalFrontendHost();
}

export function useCompanyNetworkGuard() {
  const pathname = usePathname() || "";
  const userId = useSelector(selectUser)?.id;
  const gateEnabled = shouldRunGate(pathname, userId);

  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [offline, setOffline] = useState(false);

  const verifyReachability = useCallback(async ({ manual = false } = {}) => {
    if (!shouldRunGate(pathname, userId)) {
      setBlocked(false);
      setOffline(false);
      return true;
    }

    if (isBrowserOffline()) {
      const show = await shouldShowCompanyWifiGate({ offline: true });
      setBlocked(show);
      setOffline(show);
      return !show;
    }

    setOffline(false);
    if (manual) setChecking(true);
    try {
      const ok = await checkCompanyBackendReachable();
      setBlocked(!ok);
      return ok;
    } finally {
      if (manual) setChecking(false);
    }
  }, [pathname, userId]);

  useEffect(() => {
    if (!gateEnabled) {
      setBlocked(false);
      setOffline(false);
      return;
    }
    void verifyReachability();
  }, [gateEnabled, verifyReachability]);

  useEffect(() => {
    const onOffline = () => {
      if (!shouldRunGate(pathname, userId)) return;
      void (async () => {
        const show = await shouldShowCompanyWifiGate({ offline: true });
        setBlocked(show);
        setOffline(show);
      })();
    };

    const onUnreachable = () => {
      if (!shouldRunGate(pathname, userId)) return;
      void (async () => {
        const show = await shouldShowCompanyWifiGate({ transportFailure: true });
        if (show) setBlocked(true);
      })();
    };
    const onReachable = () => {
      setBlocked(false);
      setOffline(false);
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener(NETWORK_UNREACHABLE_EVENT, onUnreachable);
    window.addEventListener(NETWORK_REACHABLE_EVENT, onReachable);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(NETWORK_UNREACHABLE_EVENT, onUnreachable);
      window.removeEventListener(NETWORK_REACHABLE_EVENT, onReachable);
    };
  }, [pathname, userId]);

  const gateActive = blocked && gateEnabled;

  return {
    blocked: gateActive,
    checking,
    offline: offline && gateActive,
    retry: () => verifyReachability({ manual: true }),
  };
}
