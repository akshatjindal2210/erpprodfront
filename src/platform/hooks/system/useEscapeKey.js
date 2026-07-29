import { useEffect } from "react";
import { isFilePreviewOpen } from "@/platform/utils/system/filePreviewGate";

/**
 * Hook to handle Escape key press to close modals/drawers.
 * Skips while a file preview overlay is open so ESC closes preview first.
 * @param {Function} onClose - Callback function to call when Escape is pressed.
 * @param {boolean} active - Whether the listener should be active.
 */
export function useEscapeKey(onClose, active = true) {
  useEffect(() => {
    if (!active || !onClose) return;

    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (isFilePreviewOpen()) return;
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onClose, active]);
}

export { isFilePreviewOpen } from "@/platform/utils/system/filePreviewGate";
