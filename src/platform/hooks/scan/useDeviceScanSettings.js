"use client";

import { useCallback, useEffect, useState } from "react";
import { isMobileDevice } from "@/platform/utils/pwa/pwa";
import { DEVICE_SCAN_DEFAULTS, getDeviceScanSettings, saveDeviceScanSettings } from "@/platform/utils/device/deviceScanSettings";

export function useDeviceScanSettings() {
  const [settings, setSettings] = useState(DEVICE_SCAN_DEFAULTS);

  useEffect(() => {
    setSettings(getDeviceScanSettings());
  }, []);

  const setLaserScan = useCallback((value) => {
    setSettings((prev) => {
      const next = { ...prev, laserScan: value };
      saveDeviceScanSettings(next);
      return next;
    });
  }, []);

  const setKeyboardType = useCallback((value) => {
    setSettings((prev) => {
      const next = { ...prev, keyboardType: value };
      saveDeviceScanSettings(next);
      return next;
    });
  }, []);

  const setPhoneQrScan = useCallback((value) => {
    setSettings((prev) => {
      const next = { ...prev, phoneQrScan: value };
      saveDeviceScanSettings(next);
      return next;
    });
  }, []);

  const showPhoneQr = settings.phoneQrScan && isMobileDevice();

  return {
    ...settings,
    showPhoneQr,
    setLaserScan,
    setKeyboardType,
    setPhoneQrScan,
  };
}
