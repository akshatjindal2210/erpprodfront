import { useEffect } from "react";

export function usePersistedScroll(ref, storageKey, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const saved = sessionStorage.getItem(storageKey);
    if (saved != null) {
      el.scrollTop = Number(saved) || 0;
    }

    const onScroll = () => {
      sessionStorage.setItem(storageKey, String(el.scrollTop));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref, storageKey, enabled]);
}
