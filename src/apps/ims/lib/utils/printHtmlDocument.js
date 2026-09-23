import { isMobileDevice } from "@/platform/utils/pwa/pwa";

function extractHtmlDocumentTitle(markup) {
  const m = String(markup ?? "").match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1]?.trim() || "";
}

function resolvePrintDocumentTitle(html, options) {
  if (typeof options === "string" && options.trim()) return options.trim();
  if (options && typeof options === "object") {
    const t = options.title ?? options.print_title;
    if (t != null && String(t).trim()) return String(t).trim();
  }
  return extractHtmlDocumentTitle(html);
}

function printWaitMs(doc) {
  const imgs = doc?.images?.length || 0;
  if (imgs > 6) return 2500;
  if (imgs > 0) return 1200;
  return 400;
}

async function waitForImages(doc) {
  if (!doc) return;
  const imgs = Array.from(doc.images || []);
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

/**
 * Ensure print document forces A4 layout (phones often shrink to viewport width).
 * Idempotent — safe if CSS already present.
 */
/** RM/QC coil stickers, IMS packing stickers, etc. — not A4 reports. */
const DOCUMENT_PAGE_SIZE_RE = /@page[^{]*\{[^}]*\bsize:\s*([\d.]+\s*(?:mm|in|cm))\s+([\d.]+\s*(?:mm|in|cm))/i;

function normalizeCssLength(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function parseDocumentPageSize(markup) {
  const m = String(markup ?? "").match(DOCUMENT_PAGE_SIZE_RE);
  if (!m) return null;
  const width = normalizeCssLength(m[1]);
  const height = normalizeCssLength(m[2]);
  if (/^210mm$/i.test(width) && /^297mm$/i.test(height)) return null;
  return { width, height };
}

function cssLengthToPx(len) {
  const s = normalizeCssLength(len).toLowerCase();
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return 794;
  if (s.endsWith("in")) return n * 96;
  if (s.endsWith("cm")) return n * (96 / 2.54);
  return n * (96 / 25.4);
}

function withA4PrintLock(markup) {
  const lock = `
<meta name="viewport" content="width=210mm, initial-scale=1" />
<style id="erp-a4-print-lock">
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  @media print {
    html, body {
      width: 210mm !important;
      min-width: 210mm !important;
      max-width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
  }
</style>`;
  if (/erp-a4-print-lock/i.test(markup)) return markup;
  if (/<\/head>/i.test(markup)) return markup.replace(/<\/head>/i, `${lock}</head>`);
  return `<!DOCTYPE html><html><head>${lock}</head><body>${markup}</body></html>`;
}

const MOBILE_SHEET_ID = "erp-mobile-print-sheet";

/**
 * Same A4 iframe print path for laptop and phone (after optional user tap).
 * Returns a Promise<boolean>.
 */
function printViaIframe(markup, options, pageSize = { width: "210mm", height: "297mm" }) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(false);
      return;
    }
    const documentTitle = resolvePrintDocumentTitle(markup, options);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Print preview");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: pageSize.width,
      height: pageSize.height,
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    });

    let cleaned = false;
    let previousParentTitle = null;
    let settled = false;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const restoreParentTitle = () => {
      if (previousParentTitle === null) return;
      try {
        document.title = previousParentTitle;
      } catch {
        /* ignore */
      }
      previousParentTitle = null;
    };

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try {
        iframe.contentWindow?.removeEventListener("afterprint", onAfterPrint);
      } catch {
        /* ignore */
      }
      try {
        window.removeEventListener("afterprint", onAfterPrint);
      } catch {
        /* ignore */
      }
      restoreParentTitle();
      iframe.remove();
    };

    const onAfterPrint = () => cleanup();

    const schedulePrint = () => {
      if (cleaned) {
        finish(false);
        return false;
      }
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        finish(false);
        return false;
      }
      try {
        if (documentTitle) {
          win.document.title = documentTitle;
          if (previousParentTitle === null) previousParentTitle = document.title;
          document.title = documentTitle;
        }
        win.addEventListener("afterprint", onAfterPrint, { once: true });
        window.addEventListener("afterprint", onAfterPrint, { once: true });
        win.focus();
        win.print();
        finish(true);
      } catch {
        cleanup();
        finish(false);
        return false;
      }
      setTimeout(cleanup, 120_000);
      return true;
    };

    const triggerPrintWhenReady = async () => {
      const doc = iframe.contentWindow?.document;
      const timer = window.setTimeout(() => schedulePrint(), printWaitMs(doc));
      try {
        await waitForImages(doc);
      } catch {
        /* print anyway */
      }
      window.clearTimeout(timer);
      schedulePrint();
    };

    try {
      document.body.appendChild(iframe);
      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!doc) {
        cleanup();
        finish(false);
        return;
      }
      doc.open();
      doc.write(markup);
      doc.close();
      queueMicrotask(() => triggerPrintWhenReady());
    } catch {
      cleanup();
      finish(false);
    }
  });
}

/** Phone: edge-to-edge preview (A4 scaled to full width, like laptop print page). Print still uses A4 iframe. */
function openMobilePrintPreview(markup, options, nativePage = null) {
  document.getElementById(MOBILE_SHEET_ID)?.remove();

  const locked = nativePage ? markup : withA4PrintLock(markup);
  const pageW = nativePage?.width ?? "210mm";
  const pageH = nativePage?.height ?? "297mm";
  const PAGE_CSS_PX = cssLengthToPx(pageW);

  const wrap = document.createElement("div");
  wrap.id = MOBILE_SHEET_ID;
  wrap.setAttribute("role", "dialog");
  wrap.style.cssText =
    "position:fixed;inset:0;z-index:5000;background:#fff;display:flex;flex-direction:column;font-family:sans-serif;";

  const bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:6px 8px;border-bottom:1px solid #e2e8f0;background:#fff;flex-shrink:0;";

  const printBtn = document.createElement("button");
  printBtn.type = "button";
  printBtn.textContent = "Print";
  printBtn.style.cssText =
    "height:36px;padding:0 14px;border:0;border-radius:8px;background:#0f172a;color:#fff;font-size:12px;font-weight:700;";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.style.cssText =
    "height:36px;padding:0 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:12px;font-weight:700;";
  closeBtn.onclick = () => {
    window.removeEventListener("resize", onResize);
    wrap.remove();
  };

  const stage = document.createElement("div");
  stage.style.cssText =
    "flex:1;min-height:0;width:100%;overflow:auto;-webkit-overflow-scrolling:touch;background:#fff;padding:0;margin:0;";

  /* Holds scaled iframe; height = content × scale so scroll works edge-to-edge */
  const frame = document.createElement("div");
  frame.style.cssText = "position:relative;width:100%;overflow:hidden;background:#fff;";

  const iframe = document.createElement("iframe");
  iframe.title = "Print preview";
  iframe.style.cssText = `position:absolute;top:0;left:0;width:${pageW};min-height:${pageH};border:0;background:#fff;transform-origin:top left;`;
  iframe.srcdoc = locked;

  const layoutEdgeToEdge = () => {
    try {
      const doc = iframe.contentDocument;
      const minH = cssLengthToPx(pageH);
      const contentH = Math.max(
        doc?.documentElement?.scrollHeight || 0,
        doc?.body?.scrollHeight || 0,
        minH,
      );
      const stageW = stage.clientWidth || window.innerWidth;
      const scale = stageW / PAGE_CSS_PX;
      iframe.style.width = `${PAGE_CSS_PX}px`;
      iframe.style.height = `${Math.ceil(contentH)}px`;
      iframe.style.transform = `scale(${scale})`;
      frame.style.height = `${Math.ceil(contentH * scale)}px`;
      frame.style.width = "100%";
    } catch {
      /* keep defaults */
    }
  };

  const onResize = () => layoutEdgeToEdge();

  printBtn.onclick = async () => {
    printBtn.disabled = true;
    printBtn.textContent = "Preparing…";
    try {
      const ok = await printViaIframe(
        locked,
        options,
        nativePage ?? { width: "210mm", height: "297mm" },
      );
      if (!ok) {
        try {
          await waitForImages(iframe.contentDocument);
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          /* preview stays open */
        }
      }
    } finally {
      printBtn.disabled = false;
      printBtn.textContent = "Print";
    }
  };

  bar.append(printBtn, closeBtn);
  frame.append(iframe);
  stage.append(frame);
  wrap.append(bar, stage);
  document.body.appendChild(wrap);
  window.addEventListener("resize", onResize, { passive: true });

  iframe.addEventListener("load", () => {
    layoutEdgeToEdge();
    /* Images may finish after first layout */
    void waitForImages(iframe.contentDocument).then(() => layoutEdgeToEdge());
    window.setTimeout(layoutEdgeToEdge, 400);
  });

  return true;
}

export function printFromBackendHtml(html, options) {
  if (typeof document === "undefined") return false;
  const markup = html != null ? String(html) : "";
  if (!markup.trim()) return false;

  const nativePage = parseDocumentPageSize(markup);
  const pageSize = nativePage ?? { width: "210mm", height: "297mm" };
  const docMarkup = nativePage ? markup : withA4PrintLock(markup);

  if (isMobileDevice()) return openMobilePrintPreview(docMarkup, options, nativePage);

  void printViaIframe(docMarkup, options, pageSize);
  return true;
}
