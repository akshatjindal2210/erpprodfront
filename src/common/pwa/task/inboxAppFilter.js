export function getInboxAppFilter(pathname = "") {
  if (!pathname) return null;
  if (pathname === "/task" || pathname.startsWith("/task/")) return "task";
  if (pathname === "/ims" || pathname.startsWith("/ims/")) return "ims";
  return null;
}

export function matchesInboxAppFilter(appType, filter = null) {
  if (!filter) return true;
  return String(appType || "").toLowerCase() === String(filter).toLowerCase();
}
