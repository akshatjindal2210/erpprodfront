export function getInboxAppFilter(pathname = "") {
  if (!pathname) return null;
  if (pathname === "/task" || pathname.startsWith("/task/")) return "task";
  if (pathname === "/ims" || pathname.startsWith("/ims/")) return "ims";
  if (pathname === "/rmstore" || pathname.startsWith("/rmstore/")) return "rmstore";
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "core";
  if (pathname === "/hrms" || pathname.startsWith("/hrms/")) return "hrms";
  return null;
}

export function matchesInboxAppFilter(appType, filter = null) {
  if (!filter) return true;
  return String(appType || "").toLowerCase() === String(filter).toLowerCase();
}
