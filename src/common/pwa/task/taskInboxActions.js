import {
  setInboxPage,
  appendInboxPage,
  removeInboxItem,
  clearInbox,
  addInboxItem,
  setInboxTotal,
} from "./taskInboxStore";
import { fetchTaskInbox, markTaskInboxRead, markAllTaskInboxRead, fetchInboxUnreadCount } from "./taskInboxApi";
import { getTriggerLabel, getAppTypeLabel } from "./taskNotifyConfig";
import { getInboxAppFilter, matchesInboxAppFilter } from "./inboxAppFilter";
import { syncGlobalIconBadge } from "@/platform/utils/pwa/pwaAppBadge";

export const INBOX_PAGE_SIZE = 15;

let inboxAppFilter = null;
let loadInboxSeq = 0;

export function setInboxAppScope(appType = null) {
  inboxAppFilter = appType || null;
  clearInbox();
}

export async function loadUnreadInbox(appType) {
  const scope = appType ?? getInboxAppFilter();
  const seq = ++loadInboxSeq;
  inboxAppFilter = scope;
  const { items, meta } = await fetchTaskInbox({
    appType: scope,
    limit: INBOX_PAGE_SIZE,
    offset: 0,
  });
  if (seq !== loadInboxSeq) return meta;
  setInboxPage({ items, total: meta.total, hasMore: meta.has_more });
  void syncGlobalIconBadge();
  return meta;
}

export async function loadMoreInbox(offset, appType = inboxAppFilter) {
  const scope = appType ?? getInboxAppFilter();
  const seq = loadInboxSeq;
  const { items, meta } = await fetchTaskInbox({
    appType: scope,
    limit: INBOX_PAGE_SIZE,
    offset: offset ?? 0,
  });
  if (seq !== loadInboxSeq) return meta;
  appendInboxPage({ items, total: meta.total, hasMore: meta.has_more });
  return meta;
}

async function refreshCounts(appType) {
  const scope = appType ?? getInboxAppFilter();
  try {
    const count = await fetchInboxUnreadCount(scope);
    setInboxTotal(count);
    void syncGlobalIconBadge();
  } catch {
    /* keep local */
  }
}

export async function markOneInboxRead(inboxId) {
  if (!inboxId) return;
  removeInboxItem(inboxId);
  try {
    await markTaskInboxRead(inboxId);
    void refreshCounts();
  } catch {}
}

export async function markAllInboxRead(appType) {
  const scope = appType ?? getInboxAppFilter();
  clearInbox();
  try {
    await markAllTaskInboxRead(scope);
    void refreshCounts(scope);
  } catch {}
}

export function addInboxFromSocket(payload = {}) {
  if (!payload.inbox_id) return;
  const scope = getInboxAppFilter();
  if (!matchesInboxAppFilter(payload.app_type, scope)) return;
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
  void refreshCounts(scope);
}
