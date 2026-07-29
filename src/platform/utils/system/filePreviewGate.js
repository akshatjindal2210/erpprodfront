/**
 * Shared gate so ESC closes file preview before drawer/modal.
 * Module-level count (not only DOM) — reliable across listener order.
 */
let filePreviewDepth = 0;

function syncDomFlag() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (filePreviewDepth > 0) {
    root.dataset.filePreviewOpen = String(filePreviewDepth);
    root.setAttribute("data-file-preview-open", "true");
  } else {
    delete root.dataset.filePreviewOpen;
    root.removeAttribute("data-file-preview-open");
  }
}

export function isFilePreviewOpen() {
  return filePreviewDepth > 0;
}

export function enterFilePreview() {
  filePreviewDepth += 1;
  syncDomFlag();
}

export function leaveFilePreview() {
  filePreviewDepth = Math.max(0, filePreviewDepth - 1);
  syncDomFlag();
}
