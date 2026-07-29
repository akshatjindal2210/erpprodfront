"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isLaserCommitKey, laserScanChar } from "@/platform/utils/device/deviceScanSettings";
import { normalizeScanInput, scanBufferLooksIncomplete } from "@/apps/ims/lib/helpers/qrScan";

const DEDUP_MS = 1500;
const IDLE_COMMIT_MS = 450;
const URL_IDLE_COMMIT_MS = 1000;
/** Ignore trailing Enter from scanner right after a successful commit. */
const TRAILING_ENTER_IGNORE_MS = 1200;

function isTypableElement(el, laserEl) {
  if (!el || el === document.body) return false;
  if (laserEl && el === laserEl) return false;
  const tag = el.tagName?.toUpperCase();
  if (tag === "INPUT") {
    const type = (el.type || "text").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "reset", "file", "hidden", "image"].includes(type);
  }
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

function blurTypableFocus(laserEl) {
  if (typeof document === "undefined") return;
  const ae = document.activeElement;
  if (ae instanceof HTMLElement && isTypableElement(ae, laserEl)) {
    ae.blur();
  }
}

function blurDrawerTypables(laserEl) {
  blurTypableFocus(laserEl);
  if (typeof document === "undefined") return;
  const root = document.querySelector("[data-app-drawer-root]");
  if (!root) return;
  root.querySelectorAll("input, textarea, select").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node === laserEl) return;
    if (isTypableElement(node, laserEl)) node.blur();
  });
}

function findScrollContainer(el) {
  if (typeof document === "undefined" || !el) return null;
  let node = el.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function restoreScrollPosition(scrollEl, scrollTop, winY) {
  if (scrollEl) scrollEl.scrollTop = scrollTop;
  if (typeof window !== "undefined" && Math.abs(window.scrollY - winY) > 1) {
    window.scrollTo(0, winY);
  }
}

export function useLaserScanCapture(active, onScanned, options = {}) {
  const {
    keyboardInputRef,
    formatPreview,
    requireArmToCapture = false,
    showPreview = false,
    autoArmOnActive = false,
    rootRef,
    onScanRejected,
  } = options;
  const onScanRejectedRef = useRef(onScanRejected);
  const onScannedRef = useRef(onScanned);
  const formatPreviewRef = useRef(formatPreview);
  const showPreviewRef = useRef(showPreview);
  const laserInputRef = useRef(null);
  const laserBufferRef = useRef("");
  const laserIdleRef = useRef(null);
  const lastLaserRef = useRef({ code: "", at: 0 });
  const lastSuccessAtRef = useRef(0);
  const activeRef = useRef(active);
  const armedRef = useRef(false);
  const armedAtRef = useRef(0);
  const requireArmRef = useRef(requireArmToCapture);
  const autoArmRef = useRef(autoArmOnActive);
  const [scanPreview, setScanPreview] = useState("");
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    requireArmRef.current = requireArmToCapture;
  }, [requireArmToCapture]);

  useEffect(() => {
    autoArmRef.current = autoArmOnActive;
  }, [autoArmOnActive]);

  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  useEffect(() => {
    onScannedRef.current = onScanned;
  }, [onScanned]);

  useEffect(() => {
    formatPreviewRef.current = formatPreview;
  }, [formatPreview]);

  useEffect(() => {
    showPreviewRef.current = showPreview;
  }, [showPreview]);

  useEffect(() => {
    onScanRejectedRef.current = onScanRejected;
  }, [onScanRejected]);

  const previewLabel = useCallback((raw) => {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    const fmt = formatPreviewRef.current;
    return fmt ? fmt(s) : s;
  }, []);

  const setPreviewIfEnabled = useCallback(
    (raw) => {
      if (!showPreviewRef.current) {
        setScanPreview("");
        return;
      }
      setScanPreview(previewLabel(raw));
    },
    [previewLabel]
  );

  const lockLaserInput = useCallback((el) => {
    if (!el) return;
    if ("showSoftInputOnFocus" in el) el.showSoftInputOnFocus = false;
    el.readOnly = true;
  }, []);

  const unlockLaserInput = useCallback((el) => {
    if (el?.readOnly) el.readOnly = false;
  }, []);

  const resetLaser = useCallback(() => {
    setScanPreview("");
    laserBufferRef.current = "";
    if (laserIdleRef.current) {
      clearTimeout(laserIdleRef.current);
      laserIdleRef.current = null;
    }
    const el = laserInputRef.current;
    if (el) {
      el.value = "";
      lockLaserInput(el);
      el.blur();
    }
  }, [lockLaserInput]);

  const armLaserFocus = useCallback(() => {
    const el = laserInputRef.current;
    if (!el) return;
    const scrollEl = findScrollContainer(el);
    const scrollTop = scrollEl?.scrollTop ?? 0;
    const winY = typeof window !== "undefined" ? window.scrollY : 0;
    lockLaserInput(el);
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    const restore = () => restoreScrollPosition(scrollEl, scrollTop, winY);
    requestAnimationFrame(restore);
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 50);
  }, [lockLaserInput]);

  const scheduleLaserFocus = useCallback(() => {
    [0, 50, 150, 350, 700].forEach((ms) => {
      window.setTimeout(() => {
        if (!activeRef.current || (requireArmRef.current && !armedRef.current)) return;
        armLaserFocus();
      }, ms);
    });
  }, [armLaserFocus]);

  const armScan = useCallback(() => {
    if (!activeRef.current) return;
    setArmed(true);
    armedRef.current = true;
    armedAtRef.current = Date.now();
    keyboardInputRef?.current?.blur();
    blurDrawerTypables(laserInputRef.current);
    laserBufferRef.current = "";
    setScanPreview("");
    scheduleLaserFocus();
  }, [scheduleLaserFocus, keyboardInputRef]);

  const setLaserInputRef = useCallback(
    (el) => {
      laserInputRef.current = el;
      if (!el) return;
      if ("showSoftInputOnFocus" in el) el.showSoftInputOnFocus = false;
      el.readOnly = true;
      if (!activeRef.current || !requireArmRef.current) return;
      if (autoArmRef.current && !armedRef.current) {
        window.setTimeout(() => armScan(), 0);
        return;
      }
      if (armedRef.current) {
        scheduleLaserFocus();
      }
    },
    [scheduleLaserFocus, armScan]
  );

  const disarmScan = useCallback(() => {
    setArmed(false);
    armedRef.current = false;
    resetLaser();
  }, [resetLaser]);

  const onLaserScanned = useCallback(
    (raw, { fromCommitKey = false } = {}) => {
      const code = normalizeScanInput(raw);
      const now = Date.now();
      if (!code) {
        if (
          fromCommitKey &&
          now - lastSuccessAtRef.current < TRAILING_ENTER_IGNORE_MS
        ) {
          return;
        }
        if (fromCommitKey || String(raw ?? "").length > 0) {
          onScanRejectedRef.current?.({ reason: "empty" });
        }
        return;
      }

      if (code === lastLaserRef.current.code && now - lastLaserRef.current.at < DEDUP_MS) {
        onScanRejectedRef.current?.({ reason: "duplicate", code });
        return;
      }
      lastLaserRef.current = { code, at: now };
      lastSuccessAtRef.current = now;

      laserBufferRef.current = "";
      void onScannedRef.current(code);

      setPreviewIfEnabled("");
      const el = laserInputRef.current;
      if (el) {
        el.value = "";
        lockLaserInput(el);
      }

      if (requireArmRef.current && activeRef.current && armedRef.current) {
        scheduleLaserFocus();
      }
    },
    [lockLaserInput, setPreviewIfEnabled, scheduleLaserFocus]
  );

  const commitLaserNow = useCallback(
    (fromCommitKey = false) => {
      if (laserIdleRef.current) {
        clearTimeout(laserIdleRef.current);
        laserIdleRef.current = null;
      }
      const raw = laserBufferRef.current || String(laserInputRef.current?.value ?? "");
      if (!fromCommitKey && scanBufferLooksIncomplete(raw)) {
        laserIdleRef.current = setTimeout(() => commitLaserNow(false), URL_IDLE_COMMIT_MS);
        return;
      }
      laserBufferRef.current = "";
      onLaserScanned(raw, { fromCommitKey });
    },
    [onLaserScanned]
  );

  const processLaserKeyEvent = useCallback(
    (e) => {
      if (requireArmRef.current && !armedRef.current) return;
      if (isLaserCommitKey(e)) {
        e.preventDefault();
        commitLaserNow(true);
        return;
      }
      const ch = laserScanChar(e) || (e.key?.length === 1 ? e.key : "");
      if (!ch || e.repeat) return;
      e.preventDefault();
      laserBufferRef.current += ch;
      setPreviewIfEnabled(laserBufferRef.current);
      if (laserIdleRef.current) clearTimeout(laserIdleRef.current);
      const idleMs = scanBufferLooksIncomplete(laserBufferRef.current)
        ? URL_IDLE_COMMIT_MS
        : IDLE_COMMIT_MS;
      laserIdleRef.current = setTimeout(commitLaserNow, idleMs);
    },
    [commitLaserNow, setPreviewIfEnabled]
  );

  const handleLaserKeyDown = useCallback(
    (e) => {
      if (requireArmRef.current && !armedRef.current) return;
      unlockLaserInput(e.currentTarget);
      processLaserKeyEvent(e);
    },
    [processLaserKeyEvent, unlockLaserInput]
  );

  const handleLaserChange = useCallback(
    (e) => {
      if (requireArmRef.current && !armedRef.current) return;
      unlockLaserInput(e.currentTarget);
      const v = String(e.target.value ?? "");
      setPreviewIfEnabled(v);
      laserBufferRef.current = v;
      if (laserIdleRef.current) clearTimeout(laserIdleRef.current);
      const idleMs = scanBufferLooksIncomplete(v) ? URL_IDLE_COMMIT_MS : IDLE_COMMIT_MS;
      laserIdleRef.current = setTimeout(commitLaserNow, idleMs);
    },
    [commitLaserNow, unlockLaserInput, setPreviewIfEnabled]
  );

  useEffect(() => {
    if (!active) {
      setArmed(false);
      armedRef.current = false;
      resetLaser();
      return undefined;
    }
    if (requireArmToCapture) {
      if (autoArmOnActive) {
        const timers = [80, 200, 400, 700, 1000].map((ms) =>
          window.setTimeout(() => armScan(), ms)
        );
        return () => timers.forEach(clearTimeout);
      }
      return undefined;
    }
    keyboardInputRef?.current?.blur();
    const timers = [80, 250, 500].map((ms) => window.setTimeout(() => armLaserFocus(), ms));
    return () => timers.forEach(clearTimeout);
  }, [active, requireArmToCapture, autoArmOnActive, armLaserFocus, armScan, keyboardInputRef, resetLaser]);

  /** Disarm when user taps outside the scan control or into a typing field. */
  useEffect(() => {
    if (!active || !requireArmToCapture) return undefined;

    const onPointerDown = (e) => {
      if (!armedRef.current) return;
      if (Date.now() - armedAtRef.current < 800) return;
      const root = rootRef?.current;
      const target = e.target;
      if (root && target instanceof Node && root.contains(target)) return;
      disarmScan();
    };

    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("touchstart", onPointerDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("touchstart", onPointerDown, true);
    };
  }, [active, requireArmToCapture, rootRef, disarmScan]);

  /** Capture scanner keys when focus is on buttons/tables (not typing fields). */
  useEffect(() => {
    if (!active) return undefined;

    const onDocumentKeyDown = (e) => {
      if (!activeRef.current) return;
      if (requireArmRef.current && !armedRef.current) return;
      const laserEl = laserInputRef.current;
      const ae = document.activeElement;
      if (laserEl && ae === laserEl) return;
      if (ae instanceof HTMLElement && isTypableElement(ae, laserEl)) {
        if (!requireArmRef.current || !armedRef.current) return;
        ae.blur();
      }
      processLaserKeyEvent(e);
    };

    document.addEventListener("keydown", onDocumentKeyDown, true);
    return () => document.removeEventListener("keydown", onDocumentKeyDown, true);
  }, [active, processLaserKeyEvent]);

  /** Re-arm hidden input when focus leaves scan field (finder / always-on mode only). */
  useEffect(() => {
    if (!active || requireArmToCapture) return undefined;

    const onBlur = () => {
      window.setTimeout(() => {
        if (!activeRef.current || requireArmRef.current) return;
        const laserEl = laserInputRef.current;
        const ae = document.activeElement;
        if (isTypableElement(ae, laserEl)) return;
        armLaserFocus();
      }, 120);
    };

    const el = laserInputRef.current;
    if (!el) return undefined;
    el.addEventListener("blur", onBlur);
    return () => el.removeEventListener("blur", onBlur);
  }, [active, requireArmToCapture, armLaserFocus]);

  return {
    scanPreview,
    armed,
    armScan,
    disarmScan,
    laserInputRef,
    setLaserInputRef,
    lockLaserInput,
    resetLaser,
    handleLaserKeyDown,
    handleLaserChange,
  };
}
