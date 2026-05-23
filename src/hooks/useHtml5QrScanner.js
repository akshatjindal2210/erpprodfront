"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { unlockScanAudio, warmUpCameraPermission } from "@/helpers/scanFeedback";

const DEFAULT_QRBOX = { width: 240, height: 240 };

// Start/stop html5-qrcode when `active` toggles. Caller renders a div with `elementId` first.
export function useHtml5QrScanner({ active, elementId, onDecoded, fps = 12, qrbox = DEFAULT_QRBOX, onCameraFailed, decodeCooldownMs = 900 }) {
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
    if (!active || !elementId) {
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => {});
      }
      return undefined;
    }

    let cancelled = false;
    const config = { fps, qrbox: { width: qrboxWidth, height: qrboxHeight } };
    const html5QrCode = new Html5Qrcode(elementId);
    scannerRef.current = html5QrCode;

    const handleDecoded = (text) => {
      const normalized = String(text ?? "").trim();
      if (!normalized) return;
      const now = Date.now();
      const last = lastDecodeRef.current;
      if (last.text === normalized && now - last.at < decodeCooldownMs) return;
      lastDecodeRef.current = { text: normalized, at: now };
      onDecodedRef.current?.(normalized);
    };

    const start = async () => {
      await warmUpCameraPermission().catch(() => {});
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          handleDecoded,
          () => {}
        );
      } catch {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras?.length) throw new Error("No camera");
        await html5QrCode.start(cameras[0].id, config, handleDecoded, () => {});
      }
      void unlockScanAudio();
    };

    start().catch(() => {
      if (!cancelled) {
        onCameraFailedRef.current?.();
      }
      scannerRef.current = null;
      try {
        html5QrCode.stop().catch(() => {});
      } catch {
        /* ignore */
      }
    });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => {});
      }
    };
  }, [active, elementId, fps, qrboxWidth, qrboxHeight]);
}
