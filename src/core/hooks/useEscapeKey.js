import { useEffect } from 'react';

/**
 * Hook to handle Escape key press to close modals/drawers.
 * @param {Function} onClose - Callback function to call when Escape is pressed.
 * @param {boolean} active - Whether the listener should be active.
 */
export function useEscapeKey(onClose, active = true) {
  useEffect(() => {
    if (!active || !onClose) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose, active]);
}
