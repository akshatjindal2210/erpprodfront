"use client";

import { forwardRef, useCallback, useEffect, useRef } from "react";
import { isLaserCommitKey } from "@/platform/utils/device/deviceScanSettings";
import { SCAN_INPUT_CLASS } from "@/ui/common/Constants";

const IDLE_MS = 200;

/** Manual keyboard — type + Enter. Laser uses LaserScanField. */
const ScanEnterInput = forwardRef(function ScanEnterInput(
  { onEnter, className, placeholder },
  ref
) {
  const idleRef = useRef(null);
  const inputRef = useRef(null);

  const setRef = useCallback(
    (el) => {
      inputRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref]
  );

  const commit = useCallback(
    (el) => {
      const node = el || inputRef.current;
      if (!node) return;
      const code = String(node.value ?? "").trim();
      node.value = "";
      if (idleRef.current) {
        clearTimeout(idleRef.current);
        idleRef.current = null;
      }
      if (code) onEnter(code);
    },
    [onEnter]
  );

  useEffect(
    () => () => {
      if (idleRef.current) clearTimeout(idleRef.current);
    },
    []
  );

  return (
    <input
      ref={setRef}
      type="text"
      data-allow-scan-keyboard="true"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      placeholder={placeholder}
      className={className || SCAN_INPUT_CLASS}
      onKeyDown={(e) => {
        if (!isLaserCommitKey(e)) return;
        e.preventDefault();
        commit(e.currentTarget);
      }}
    />
  );
});

export default ScanEnterInput;
