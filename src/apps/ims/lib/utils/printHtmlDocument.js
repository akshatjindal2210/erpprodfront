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

function isMobilePrintDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

/** Mobile browsers often block print() on hidden iframes — use a blob-backed visible iframe. */
function printFromBackendHtmlMobile(markup, documentTitle) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Print preview");
  Object.assign(iframe.style, {
    position: "fixed",
    width: "100%",
    height: "100%",
    border: "0",
    left: "0",
    top: "0",
    zIndex: "2147483647",
    background: "#fff",
  });

  let blobUrl = null;
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
      const win = iframe.contentWindow;
      if (win) win.removeEventListener("afterprint", onAfterPrint);
    } catch {}
    try {
      window.removeEventListener("afterprint", onAfterPrint);
    } catch {}
    restoreParentTitle();
    iframe.remove();
    if (blobUrl) {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
      blobUrl = null;
    }
  };

  const onAfterPrint = () => cleanup();

  const schedulePrint = () => {
    if (cleaned) return;
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

  const triggerPrintWhenReady = () => {
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      schedulePrint();
      return;
    }
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
    setTimeout(schedulePrint, 500);
  };

  try {
    document.body.appendChild(iframe);
    const blob = new Blob([markup], { type: "text/html;charset=utf-8" });
    blobUrl = URL.createObjectURL(blob);
    iframe.addEventListener("load", () => queueMicrotask(triggerPrintWhenReady), { once: true });
    iframe.src = blobUrl;
    return true;
  } catch {
    cleanup();
    return false;
  }
}

export function printFromBackendHtml(html, options) {
  if (typeof document === "undefined") return false;
  const markup = html != null ? String(html) : "";
  if (!markup.trim()) return false;

  const documentTitle = resolvePrintDocumentTitle(markup, options);
  if (isMobilePrintDevice()) {
    return printFromBackendHtmlMobile(markup, documentTitle);
  }
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
