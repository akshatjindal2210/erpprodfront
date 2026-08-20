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

export function printFromBackendHtml(html, options) {
  if (typeof document === "undefined") return false;
  const markup = html != null ? String(html) : "";
  if (!markup.trim()) return false;

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
