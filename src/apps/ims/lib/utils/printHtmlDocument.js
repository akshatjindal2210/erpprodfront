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

const MOBILE_SHEET_ID = "erp-mobile-print-sheet";

function printHtmlInNewWindow(markup) {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(markup);
  win.document.close();
  const run = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* user can still use the browser print menu */
    }
  };
  if (win.document.readyState === "complete") setTimeout(run, 350);
  else win.addEventListener("load", () => setTimeout(run, 350), { once: true });
  return true;
}

/** Phone cannot print a hidden iframe. Show the document, then print from a tap. */
function openMobilePrintPreview(markup) {
  document.getElementById(MOBILE_SHEET_ID)?.remove();

  const wrap = document.createElement("div");
  wrap.id = MOBILE_SHEET_ID;
  wrap.setAttribute("role", "dialog");
  wrap.style.cssText =
    "position:fixed;inset:0;z-index:5000;background:#fff;display:flex;flex-direction:column;font-family:sans-serif;";

  const bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:8px;border-bottom:1px solid #e2e8f0;background:#f8fafc;";

  const printBtn = document.createElement("button");
  printBtn.type = "button";
  printBtn.textContent = "Print";
  printBtn.style.cssText =
    "height:36px;padding:0 14px;border:0;border-radius:8px;background:#0f172a;color:#fff;font-size:12px;font-weight:700;";
  printBtn.onclick = () => {
    if (!printHtmlInNewWindow(markup)) {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        /* preview stays open */
      }
    }
  };

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.style.cssText =
    "height:36px;padding:0 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-size:12px;font-weight:700;";
  closeBtn.onclick = () => wrap.remove();

  const iframe = document.createElement("iframe");
  iframe.title = "Print preview";
  iframe.style.cssText = "flex:1;width:100%;border:0;background:#fff;";
  iframe.srcdoc = markup;

  bar.append(printBtn, closeBtn);
  wrap.append(bar, iframe);
  document.body.appendChild(wrap);
  return true;
}

export function printFromBackendHtml(html, options) {
  if (typeof document === "undefined") return false;
  const markup = html != null ? String(html) : "";
  if (!markup.trim()) return false;

  if (isMobileDevice()) return openMobilePrintPreview(markup);

  const documentTitle = resolvePrintDocumentTitle(markup, options);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Print preview");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "210mm",
    height: "297mm",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });

  let cleaned = false;
  let previousParentTitle = null;

  const restoreParentTitle = () => {
    if (previousParentTitle === null) return;
    try {
      document.title = previousParentTitle;
    } catch {}
    previousParentTitle = null;
  };

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      iframe.contentWindow?.removeEventListener("afterprint", onAfterPrint);
    } catch {}
    try {
      window.removeEventListener("afterprint", onAfterPrint);
    } catch {}
    restoreParentTitle();
    iframe.remove();
  };

  const onAfterPrint = () => cleanup();

  const schedulePrint = () => {
    if (cleaned) return false;
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
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
    } catch {
      cleanup();
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
      return false;
    }
    doc.open();
    doc.write(markup);
    doc.close();
    queueMicrotask(() => triggerPrintWhenReady());
    return true;
  } catch {
    cleanup();
    return false;
  }
}
