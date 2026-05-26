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

export function printFromBackendHtml(html, options) {
  if (typeof document === "undefined") return false;
  const markup = html != null ? String(html) : "";
  if (!markup.trim()) return false;

  const documentTitle = resolvePrintDocumentTitle(markup, options);
  let previousParentTitle = null;

  const restoreParentTitle = () => {
    if (previousParentTitle === null) return;
    try {
      document.title = previousParentTitle;
    } catch {}
    previousParentTitle = null;
  };

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Print preview");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
    left: "-9999px",
    top: "0",
  });

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return false;
  }

  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      win.removeEventListener("afterprint", onAfterPrint);
    } catch {}
    try {
      window.removeEventListener("afterprint", onAfterPrint);
    } catch {}
    restoreParentTitle();
    iframe.remove();
  };

  const onAfterPrint = () => cleanup();

  const applyDocumentTitle = () => {
    if (!documentTitle) return;
    try {
      const doc = win.document;
      if (doc) doc.title = documentTitle;
    } catch {}
    try {
      if (previousParentTitle === null) previousParentTitle = document.title;
      document.title = documentTitle;
    } catch {}
  };

  const schedulePrint = () => {
    if (cleaned) return;
    applyDocumentTitle();
    try {
      win.addEventListener("afterprint", onAfterPrint, { once: true });
      window.addEventListener("afterprint", onAfterPrint, { once: true });
      win.focus();
      win.print();
    } catch {
      cleanup();
      return;
    }
    setTimeout(cleanup, 120_000);
  };

  const triggerPrintWhenReady = () => {
    const doc = win.document;
    if (!doc) {
      schedulePrint();
      return;
    }
    applyDocumentTitle();
    const imgs = Array.from(doc.images || []);
    const pending = imgs.filter((img) => !img.complete);
    if (!pending.length) {
      schedulePrint();
      return;
    }
    let left = pending.length;
    const done = () => {
      left -= 1;
      if (left <= 0) schedulePrint();
    };
    pending.forEach((img) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
    setTimeout(schedulePrint, 350);
  };

  try {
    const doc = win.document;
    if (!doc) {
      cleanup();
      return false;
    }
    doc.open();
    doc.write(markup);
    doc.close();
    applyDocumentTitle();
    if (doc.readyState === "complete") {
      queueMicrotask(triggerPrintWhenReady);
    } else {
      iframe.addEventListener("load", () => queueMicrotask(triggerPrintWhenReady), { once: true });
    }
  } catch {
    cleanup();
    return false;
  }

  return true;
}
