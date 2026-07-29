const STORAGE_KEY = "erp_device_scan_settings";

export const DEVICE_SCAN_DEFAULTS = {
  laserScan: false,
  keyboardType: true,
  phoneQrScan: true,
};

export function getDeviceScanSettings() {
  if (typeof window === "undefined") return { ...DEVICE_SCAN_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEVICE_SCAN_DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      laserScan: parsed.laserScan === true,
      keyboardType: parsed.keyboardType === true,
      phoneQrScan: parsed.phoneQrScan === true,
    };
  } catch {
    return { ...DEVICE_SCAN_DEFAULTS };
  }
}

export function saveDeviceScanSettings(next) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Blur focused field so mobile keyboard does not open during laser scan. */
export function blurActiveElement() {
  if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

/** Laser on → scan-only UI; soft keyboard must not open on scan fields. */
export function isLaserScanUi(settings) {
  const s = settings || getDeviceScanSettings();
  return s.laserScan === true;
}

/** Manual typing when keyboard type is on in settings. */
export function allowsScanKeyboardTyping(settings) {
  const s = settings || getDeviceScanSettings();
  return s.keyboardType === true;
}

export function getScanInputPlaceholder() {
  return "Type the code, then press Enter";
}

export function isLaserScanEnabled() {
  return getDeviceScanSettings().laserScan === true;
}

export function isLaserCommitKey(e) {
  return (
    e.key === "Enter" ||
    e.key === "NumpadEnter" ||
    e.keyCode === 13 ||
    e.which === 13
  );
}

/** Printable char from keydown (Android scanners often send keyCode only). */
export function laserScanChar(e) {
  if (e.key && e.key.length === 1 && e.key !== "Unidentified") return e.key;
  const code = e.keyCode || e.which;
  if (code >= 32 && code <= 126) return String.fromCharCode(code);
  return "";
}
