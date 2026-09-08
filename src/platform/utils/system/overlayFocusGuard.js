import { isFilePreviewOpen } from "@/platform/utils/system/filePreviewGate";

const OVERLAY_SELECTOR = "[data-app-overlay-root], [data-app-drawer-root]";
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function skipInert(el) {
  return (
    el.classList?.contains("searchable-select-dropdown") ||
    el.hasAttribute?.("data-searchable-select-portal") ||
    el.hasAttribute?.("data-file-preview-overlay")
  );
}

function overlayZ(el) {
  const z = parseInt(getComputedStyle(el).zIndex, 10);
  if (!Number.isNaN(z)) return z;
  const stack = Number(el.dataset.drawerStackLevel || el.dataset.overlayStackLevel || 0);
  return 1000 + stack * 50;
}

function getBodyOverlays() {
  return [...document.body.children].filter((el) => el.matches?.(OVERLAY_SELECTOR));
}

function getTopOverlay() {
  const overlays = getBodyOverlays();
  if (!overlays.length) return null;
  return overlays.reduce((top, el) => (overlayZ(el) >= overlayZ(top) ? el : top));
}

/** One global Tab trap + inert for all portaled overlays (drawers + center modals). */
export function installOverlayFocusGuard() {
  let inerted = new Set();

  const syncInert = () => {
    const top = getTopOverlay();
    const nextInerted = new Set();

    if (!top) {
      for (const el of inerted) {
        try {
          el.inert = false;
        } catch {
          /* ignore */
        }
      }
      inerted.clear();
      return;
    }

    for (const child of document.body.children) {
      if (child === top || skipInert(child)) continue;
      if (!child.inert) child.inert = true;
      nextInerted.add(child);
    }

    for (const el of inerted) {
      if (!nextInerted.has(el)) {
        try {
          el.inert = false;
        } catch {
          /* ignore */
        }
      }
    }
    inerted = nextInerted;
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Tab" || isFilePreviewOpen()) return;

    const trapRoot = getTopOverlay();
    if (!trapRoot) return;

    const activeEl = document.activeElement;
    if (activeEl?.closest?.(".searchable-select-dropdown")) return;

    const list = [...trapRoot.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length);
    if (!list.length) {
      e.preventDefault();
      return;
    }

    const first = list[0];
    const last = list[list.length - 1];

    if (!trapRoot.contains(activeEl)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && activeEl === first) {
      e.preventDefault();
      last.focus();
      return;
    }
    if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const observer = new MutationObserver(syncInert);
  observer.observe(document.body, {
    childList: true,
    attributes: true,
    attributeFilter: ["data-app-overlay-root", "data-app-drawer-root", "style", "class"],
  });

  window.addEventListener("keydown", handleKeyDown, true);
  syncInert();
  const raf = requestAnimationFrame(syncInert);

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    window.removeEventListener("keydown", handleKeyDown, true);
    for (const el of inerted) {
      try {
        el.inert = false;
      } catch {
        /* ignore */
      }
    }
    inerted.clear();
  };
}
