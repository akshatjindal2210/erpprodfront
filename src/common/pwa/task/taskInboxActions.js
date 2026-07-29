import {
  setInboxPage,
  appendInboxPage,
  removeInboxItem,
  clearInbox,
  addInboxItem,
} from "./taskInboxStore";
import { fetchTaskInbox, markTaskInboxRead, markAllTaskInboxRead } from "./taskInboxApi";
import { getTriggerLabel, getAppTypeLabel } from "./taskNotifyConfig";
import { matchesInboxAppFilter } from "./inboxAppFilter";

export const INBOX_PAGE_SIZE = 15;

let inboxAppFilter = null;

export function getInboxAppFilterScope() {
  return inboxAppFilter;
}

export function setInboxAppScope(appType = null) {
  inboxAppFilter = appType || null;
  clearInbox();
}

export async function loadUnreadInbox(appType = inboxAppFilter) {
  const { items, meta } = await fetchTaskInbox({
    appType,
    limit: INBOX_PAGE_SIZE,
    offset: 0,
  });
  setInboxPage({
    items,
    total: meta.total,
    hasMore: meta.has_more,
  });
  return meta;
}

export async function loadMoreInbox(offset, appType = inboxAppFilter) {
  const { items, meta } = await fetchTaskInbox({
    appType,
    limit: INBOX_PAGE_SIZE,
    offset: offset ?? 0,
  });
  appendInboxPage({
    items,
    total: meta.total,
    hasMore: meta.has_more,
  });
  return meta;
}

export async function markOneInboxRead(inboxId) {
  if (!inboxId) return;
  removeInboxItem(inboxId);
  try {
    await markTaskInboxRead(inboxId);
  } catch {}
}

export async function markAllInboxRead(appType = inboxAppFilter) {
  clearInbox();
  try {
    await markAllTaskInboxRead(appType);
  } catch {}
}

export function addInboxFromSocket(payload = {}) {
  if (!payload.inbox_id) return;
  if (!matchesInboxAppFilter(payload.app_type, inboxAppFilter)) return;
  addInboxItem({
    inbox_id: payload.inbox_id,
    app_type: payload.app_type || "task",
    app_type_label: payload.app_type_label || getAppTypeLabel(payload.app_type),
    title: payload.title,
    body: payload.body,
    url: payload.url,
    task_id: payload.task_id,
    trigger: payload.trigger,
    trigger_label: payload.trigger_label || getTriggerLabel(payload.trigger),
    is_read: false,
    created_at: payload.created_at,
  });
}
