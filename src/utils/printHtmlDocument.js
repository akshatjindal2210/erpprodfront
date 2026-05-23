/**
 * Print a full HTML document without opening a focused pop-up window.
 * Uses a hidden iframe so the main app tab keeps focus; print runs in the iframe only.
 * @returns {boolean} false if printing could not be started (e.g. no document)
 */
export function printFromBackendHtml(html) {
  if (typeof document === "undefined") return false;
  const markup = html != null ? String(html) : "";
  if (!markup.trim()) return false;

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
  let objectUrl = null;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      win.removeEventListener("afterprint", cleanup);
    } catch {
      /* ignore */
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    iframe.remove();
  };

  const schedulePrint = () => {
    if (cleaned) return;
    try {
      win.addEventListener("afterprint", cleanup, { once: true });
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
    // Base64 QR images should load instantly; short cap avoids long stalls
    setTimeout(schedulePrint, 350);
  };

  const onFrameLoaded = () => {
    queueMicrotask(triggerPrintWhenReady);
  };

  try {
    const blob = new Blob([markup], { type: "text/html;charset=utf-8" });
    objectUrl = URL.createObjectURL(blob);
    iframe.addEventListener("load", onFrameLoaded, { once: true });
    iframe.src = objectUrl;
  } catch {
    const doc = win.document;
    if (!doc) {
      cleanup();
      return false;
    }
    doc.open();
    doc.write(markup);
    doc.close();
    if (doc.readyState === "complete") {
      queueMicrotask(triggerPrintWhenReady);
    } else {
      iframe.addEventListener("load", onFrameLoaded, { once: true });
    }
  }

  return true;
}
