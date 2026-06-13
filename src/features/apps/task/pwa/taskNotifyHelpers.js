export function stripHtml(text) {
  return String(text ?? "").replace(/<[^>]+>/g, "").trim();
}

export function notifyIconUrl() {
  if (typeof window === "undefined") return "/icon-192.png";
  return `${window.location.origin}/icon-192.png`;
}
