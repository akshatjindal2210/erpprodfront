"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { unlockScanAudio } from "@/features/apps/ims/helpers/scanFeedback";

const DEFAULT_QRBOX = { width: 200, height: 200 };
const DEFAULT_FPS = 8;

function readTorchSupport(scanner) {
  try {
    const torch = scanner?.getRunningTrackCameraCapabilities?.()?.torchFeature?.();
    if (!torch?.isSupported?.()) return { supported: false, on: false };
    return { supported: true, on: Boolean(torch.value()) };
  } catch {
    return { supported: false, on: false };
  }
}

async function turnTorchOff(scanner) {
  if (!scanner) return;
  try {
    const torch = scanner.getRunningTrackCameraCapabilities?.()?.torchFeature?.();
    if (torch?.isSupported?.() && torch.value()) {
      await torch.apply(false);
    }
  } catch {
    // Ignore — camera may already be stopped.
  }
}

export function useHtml5QrScanner({
  active,
  elementId,
  onDecoded,
  fps = DEFAULT_FPS,
  qrbox = DEFAULT_QRBOX,
  onCameraFailed,
  onDecodeSuppressed,
  decodeCooldownMs = 900,
}) {
  const scannerRef = useRef(null);
  const onDecodedRef = useRef(onDecoded);
  const onCameraFailedRef = useRef(onCameraFailed);
  const onDecodeSuppressedRef = useRef(onDecodeSuppressed);
  const lastDecodeRef = useRef({ text: "", at: 0 });
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const syncTorchState = useCallback((scanner) => {
    const { supported, on } = readTorchSupport(scanner);
    setTorchSupported(supported);
    setTorchOn(on);
  }, []);

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return false;
    try {
      const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
      if (!torch.isSupported()) return false;
      const next = !Boolean(torch.value());
      await torch.apply(next);
      setTorchOn(Boolean(torch.value()));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    onDecodedRef.current = onDecoded;
    onCameraFailedRef.current = onCameraFailed;
    onDecodeSuppressedRef.current = onDecodeSuppressed;
  });

  const qrboxWidth = qrbox?.width ?? DEFAULT_QRBOX.width;
  const qrboxHeight = qrbox?.height ?? DEFAULT_QRBOX.height;

  useEffect(() => {
    const stopScanner = async (s) => {
      if (!s) return;
      await turnTorchOff(s);
      try {
        const state = s.getState();
        if (state !== 1) {
          await s.stop();
        }
      } catch {
        // Ignore
      }
    };

    if (!active || !elementId) {
      const s = scannerRef.current;
      scannerRef.current = null;
      setTorchSupported(false);
      setTorchOn(false);
      if (s) {
        void stopScanner(s);
      }
      return undefined;
    }

    let cancelled = false;

    const handleDecoded = (text) => {
      const normalized = String(text ?? "").trim();
      if (!normalized) return;
      const now = Date.now();
      const last = lastDecodeRef.current;
      if (last.text === normalized && now - last.at < decodeCooldownMs) {
        onDecodeSuppressedRef.current?.(normalized);
        return;
      }
      lastDecodeRef.current = { text: normalized, at: now };
      onDecodedRef.current?.(normalized);
    };

    const handleVisibilityChange = () => {
      const s = scannerRef.current;
      if (!s) return;
      const state = s.getState();
      if (document.hidden) {
        if (state === 2) s.pause(true).catch(() => {});
      } else if (state === 3) {
        s.resume().catch(() => {});
      }
    };

    const afterCameraStart = (html5QrCode) => {
      if (cancelled) return;
      syncTorchState(html5QrCode);
      void unlockScanAudio();
      document.addEventListener("visibilitychange", handleVisibilityChange);
    };

    const start = async () => {
      if (!window.isSecureContext) {
        if (!cancelled) {
          onCameraFailedRef.current?.({ name: "InsecureContext" });
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
      if (cancelled) return;

      let html5QrCode;
      try {
        html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (cancelled) return;
        try {
          html5QrCode = new Html5Qrcode(elementId);
          scannerRef.current = html5QrCode;
        } catch (e2) {
          if (!cancelled) onCameraFailedRef.current?.(e2);
          return;
        }
      }

      const config = { fps, qrbox: { width: qrboxWidth, height: qrboxHeight } };

      try {
        await html5QrCode.start({ facingMode: "environment" }, config, handleDecoded, () => {});

        if (!cancelled) {
          afterCameraStart(html5QrCode);
        } else {
          void stopScanner(html5QrCode);
        }
      } catch (err) {
        if (cancelled) return;

        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const cameraId = cameras[cameras.length - 1].id;
            await html5QrCode.start(cameraId, config, handleDecoded, () => {});

            if (!cancelled) {
              afterCameraStart(html5QrCode);
            } else {
              void stopScanner(html5QrCode);
            }
          } else {
            throw err;
          }
        } catch (err2) {
          if (!cancelled) {
            onCameraFailedRef.current?.(err2);
          }
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const s = scannerRef.current;
      scannerRef.current = null;
      setTorchSupported(false);
      setTorchOn(false);
      if (s) {
        void stopScanner(s);
      }
    };
  }, [active, elementId, fps, qrboxWidth, qrboxHeight, decodeCooldownMs, syncTorchState]);

  return { torchSupported, torchOn, toggleTorch };
}
