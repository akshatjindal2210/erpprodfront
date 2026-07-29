/** Navigate when a live (read-only) dashboard widget is clicked. */

export function normalizeWidgetLinkType(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "URL" || raw === "APP") return raw;
  return "NONE";
}

export function getWidgetClickUrl(widget = {}) {
  const url = String(widget?.linkUrl || widget?.link_url || "").trim();
  return url || "";
}

export function widgetHasClickLink(widget = {}) {
  const type = normalizeWidgetLinkType(widget?.linkType || widget?.link_type);
  if (type === "NONE") return false;
  return Boolean(getWidgetClickUrl(widget));
}

/** Skip navigation when user is interacting with controls inside the widget. */
export function shouldIgnoreWidgetLinkClick(event) {
  const target = event?.target;
  if (!target?.closest) return false;
  return Boolean(
    target.closest(
      "a, button, input, textarea, select, label, [role='button'], [contenteditable='true'], table th, [data-no-widget-link]",
    ),
  );
}

/**
 * Open external URLs in a new tab; push internal paths in the same tab.
 * @param {string} url
 * @param {{ push?: (href: string) => void }} [router]
 */
export function navigateWidgetClickUrl(url, router) {
  const href = String(url || "").trim();
  if (!href) return;
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) {
    if (typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
    return;
  }
  const path = href.startsWith("/") ? href : `/${href}`;
  if (typeof router?.push === "function") {
    router.push(path);
    return;
  }
  if (typeof window !== "undefined") {
    window.location.assign(path);
  }
}
