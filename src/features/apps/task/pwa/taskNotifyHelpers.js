import { formatPushTitle, pushIconUrl, resolvePushAppBrand } from "@/config/pushAppBrand";

export function stripHtml(text) {
  return String(text ?? "").replace(/<[^>]+>/g, "").trim();
}

export function notifyIconUrl(appType = "task") {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return pushIconUrl(appType, origin);
}

export { formatPushTitle, resolvePushAppBrand };
