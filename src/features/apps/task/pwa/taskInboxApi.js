import { api } from "@/core/api/apiClient";
import { CORE_ENDPOINTS } from "@/core/api/endpoints";

function withQuery(path, params) {
  if (!params || !Object.keys(params).length) return path;
  const q = new URLSearchParams(params).toString();
  return `${path}?${q}`;
}

export async function fetchTaskInbox({ appType = null, limit = 15, offset = 0 } = {}) {
  const params = { limit: String(limit), offset: String(offset) };
  if (appType) params.app_type = appType;
  const path = withQuery(CORE_ENDPOINTS.INBOX.LIST, params);
  const res = await api(path);
  return {
    items: res.data ?? [],
    meta: res.meta ?? { total: 0, has_more: false, limit, offset },
  };
}

export async function fetchInboxUnreadCount(appType = null) {
  const path = withQuery(
    CORE_ENDPOINTS.INBOX.UNREAD_COUNT,
    appType ? { app_type: appType } : null
  );
  const res = await api(path);
  return res.data?.count ?? 0;
}

export async function markTaskInboxRead(inboxId) {
  await api(CORE_ENDPOINTS.INBOX.read(inboxId), { method: "PATCH" });
}

export async function markAllTaskInboxRead(appType = null) {
  const path = withQuery(CORE_ENDPOINTS.INBOX.READ_ALL, appType ? { app_type: appType } : null);
  await api(path, { method: "POST" });
}
