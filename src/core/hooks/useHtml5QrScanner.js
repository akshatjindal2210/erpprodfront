"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { unlockScanAudio } from "@/features/apps/ims/helpers/scanFeedback";

const DEFAULT_QRBOX = { width: 200, height: 200 };
const DEFAULT_FPS = 8;

export function useHtml5QrScanner({
  active,
  elementId,
  onDecoded,
  fps = DEFAULT_FPS,
  qrbox = DEFAULT_QRBOX,
  onCameraFailed,
  decodeCooldownMs = 900,
}) {
  const scannerRef = useRef(null);
  const onDecodedRef = useRef(onDecoded);
  const onCameraFailedRef = useRef(onCameraFailed);
  const lastDecodeRef = useRef({ text: "", at: 0 });

  useEffect(() => {
    onDecodedRef.current = onDecoded;
    onCameraFailedRef.current = onCameraFailed;
  });

  const qrboxWidth = qrbox?.width ?? DEFAULT_QRBOX.width;
  const qrboxHeight = qrbox?.height ?? DEFAULT_QRBOX.height;

  useEffect(() => {
    const stopScanner = async (s) => {
      if (!s) return;
      try {
        const state = s.getState();
        if (state !== 1) { // 1 = IDLE
          await s.stop();
        }
      } catch (err) {
        // Ignore
      }
    };

    if (!active || !elementId) {
      const s = scannerRef.current;
      scannerRef.current = null;
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
      if (last.text === normalized && now - last.at < decodeCooldownMs) return;
      lastDecodeRef.current = { text: normalized, at: now };
      onDecodedRef.current?.(normalized);
    };

    const handleVisibilityChange = () => {
      const s = scannerRef.current;
      if (!s) return;
      const state = s.getState();
      if (document.hidden) {
        if (state === 2) s.pause(true).catch(() => {});
      } else {
        if (state === 3) s.resume().catch(() => {});
      }
    };

    const start = async () => {
      // 1. Check for secure context (HTTPS)
      if (!window.isSecureContext) {
        if (!cancelled) {
          onCameraFailedRef.current?.({ name: "InsecureContext" });
        }
        return;
      }

      // 2. Small delay to ensure the DOM element is actually rendered and ready
      // We keep this short (150ms) to stay within the "user gesture" window if possible
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (cancelled) return;

      let html5QrCode;
      try {
        html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;
      } catch (e) {
        // Retry once if element not found
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
        // 3. Start scanning
        // This will trigger the browser permission prompt
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          handleDecoded,
          () => {}
        );
        
        if (!cancelled) {
          void unlockScanAudio();
          document.addEventListener("visibilitychange", handleVisibilityChange);
        } else {
          void stopScanner(html5QrCode);
        }
      } catch (err) {
        if (cancelled) return;
        
        // 4. Fallback: try to get all cameras and use the last one
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const cameraId = cameras[cameras.length - 1].id;
            await html5QrCode.start(cameraId, config, handleDecoded, () => {});
            
            if (!cancelled) {
              void unlockScanAudio();
              document.addEventListener("visibilitychange", handleVisibilityChange);
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
      if (s) {
        void stopScanner(s);
      }
    };
  }, [active, elementId, fps, qrboxWidth, qrboxHeight, decodeCooldownMs]);
}
