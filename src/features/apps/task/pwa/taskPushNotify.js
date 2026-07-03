"use client";

import { ROUTES } from "./taskNotifyConfig";
import { notifyIconUrl, stripHtml, formatPushTitle, resolvePushAppBrand } from "./taskNotifyHelpers";
import { markOneInboxRead } from "./taskInboxActions";

export function getTaskNotifyPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestTaskNotifyPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

function buildOptions(payload = {}) {
  const appType = payload.app_type || "task";
  const brand = resolvePushAppBrand(appType);
  const title = formatPushTitle(appType, stripHtml(payload.title) || brand.label);
  const body = stripHtml(payload.body);
  const url = payload.url || ROUTES.TASK_LIST;
  const tag = payload.inbox_id ? `inbox-${payload.inbox_id}` : `${appType}-${payload.task_id || Date.now()}`;
  const icon = notifyIconUrl(appType);

  return {
    title,
    url,
    options: {
      body,
      icon,
      badge: icon,
      tag,
      renotify: true,
      data: { url, inbox_id: payload.inbox_id ?? "", app_type: appType, app_label: brand.label },
    },
  };
}

async function tryServiceWorker(title, options) {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(), 2500)),
    ]);
    await reg.showNotification(title, options);
    return true;
  } catch {
    return false;
  }
}

export async function showNativeOsNotification(payload = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;

  const { title, url, options } = buildOptions(payload);

  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      void markOneInboxRead(payload.inbox_id);
      window.focus();
      window.location.href = url;
      n.close();
    };
    return true;
  } catch {
    return tryServiceWorker(title, options);
  }
}

function alreadyShown(payload) {
  if (!payload.inbox_id) return false;
  const key = `mst_inbox_${payload.inbox_id}`;
  try {
    const ts = Number(sessionStorage.getItem(key) || 0);
    if (ts && Date.now() - ts < 120000) return true;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {}
  return false;
}

export async function handleOsNotification(payload = {}) {
  if (!payload?.title && !payload?.body) return;
  if (alreadyShown(payload)) return;
  await showNativeOsNotification(payload);
}

function listenForSwRead() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (e) => {
    const type = e.data?.type;
    if (type === "INBOX_READ" || type === "TASK_INBOX_READ") {
      void markOneInboxRead(e.data.inbox_id);
    }
  });
}

if (typeof window !== "undefined") {
  listenForSwRead();
}
