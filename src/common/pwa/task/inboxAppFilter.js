import { getShellAppFromPathname } from "@/config/appsRegistry";

const SHELL_ID_TO_INBOX_APP = {
  task: "task",
  ims: "ims",
  rmstore: "rmstore",
  purchase: "purchase",
  production: "production",
  hrms: "hrms",
  settings: "core",
};

/** null = all apps (/home); else inbox `app_type` for bell + PWA icon. */
export function getInboxAppFilter(pathname = "") {
  const path = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
  if (!path) return null;
  const shell = getShellAppFromPathname(path);
  if (!shell || shell.id === "home") return null;
  return SHELL_ID_TO_INBOX_APP[shell.id] ?? null;
}

export function matchesInboxAppFilter(appType, filter = null) {
  if (!filter) return true;
  return String(appType || "").toLowerCase() === String(filter).toLowerCase();
}
