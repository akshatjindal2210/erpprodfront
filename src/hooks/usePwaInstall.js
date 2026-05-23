"use client";

import { useCallback, useEffect, useState } from "react";
import { isIosDevice, isPwaStandalone } from "@/helpers/pwa";
import { detectPwaInstalledOnDevice } from "@/helpers/pwaInstalled";
import { clearDeferredInstallPrompt, getDeferredInstallPrompt, subscribeDeferredInstallPrompt } from "@/helpers/pwaInstallPrompt";

export function usePwaInstall() {
  const [standalone, setStandalone] = useState(
    () => typeof window !== "undefined" && isPwaStandalone()
  );
  const [deferredPrompt, setDeferredPrompt] = useState(
    () => getDeferredInstallPrompt()
  );
  const [installing, setInstalling] = useState(false);
  const [installedOnDevice, setInstalledOnDevice] = useState(false);
  const [installStateReady, setInstallStateReady] = useState(false);

  useEffect(() => {
    const syncStandalone = () => setStandalone(isPwaStandalone());
    syncStandalone();

    const unsubscribe = subscribeDeferredInstallPrompt((event) => {
      setDeferredPrompt(event);
      if (!event) syncStandalone();
    });

    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", syncStandalone);

    let cancelled = false;
    detectPwaInstalledOnDevice().then((installed) => {
      if (cancelled) return;
      setInstalledOnDevice(installed);
      setInstallStateReady(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      mq.removeEventListener("change", syncStandalone);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const prompt = getDeferredInstallPrompt();
    if (!prompt) return false;
    setInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      clearDeferredInstallPrompt();
      setDeferredPrompt(null);
      setStandalone(isPwaStandalone());
      if (outcome === "accepted") {
        setInstalledOnDevice(true);
      }
      return outcome === "accepted";
    } catch {
      return false;
    } finally {
      setInstalling(false);
    }
  }, []);

  const canNativeInstall = Boolean(deferredPrompt);
  const showInstall = installStateReady && canNativeInstall && !installedOnDevice;
  const showOpen = installStateReady && (installedOnDevice || (!canNativeInstall && !isIosDevice()));

  return {
    isStandalone: standalone,
    canNativeInstall,
    isInstalledOnDevice: installedOnDevice,
    installStateReady,
    showInstall,
    showOpen,
    isIos: isIosDevice(),
    installing,
    promptInstall,
  };
}
