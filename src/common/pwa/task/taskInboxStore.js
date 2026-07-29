const EMPTY = { items: [], total: 0, hasMore: false };

let state = { ...EMPTY };
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(state));
}

export function getInboxState() {
  return state;
}

export function getInboxItems() {
  return state.items;
}

export function setInboxPage({ items, total = 0, hasMore = false }) {
  state = {
    items: (items ?? []).filter((row) => !row.is_read),
    total: Number(total) || 0,
    hasMore: !!hasMore,
  };
  notify();
}

export function appendInboxPage({ items, total, hasMore }) {
  const ids = new Set(state.items.map((i) => i.inbox_id));
  const more = (items ?? []).filter((row) => !row.is_read && !ids.has(row.inbox_id));
  state = {
    items: [...state.items, ...more],
    total: total != null ? Number(total) : state.total,
    hasMore: hasMore != null ? !!hasMore : state.hasMore,
  };
  notify();
}

export function addInboxItem(row) {
  if (!row?.inbox_id || row.is_read) return;
  if (state.items.some((i) => i.inbox_id === row.inbox_id)) return;
  state = {
    items: [row, ...state.items],
    total: state.total + 1,
    hasMore: state.hasMore || state.items.length >= 15,
  };
  notify();
}

export function removeInboxItem(inboxId) {
  const had = state.items.some((i) => i.inbox_id === inboxId);
  state = {
    items: state.items.filter((i) => i.inbox_id !== inboxId),
    total: had ? Math.max(0, state.total - 1) : state.total,
    hasMore: state.items.length < state.total,
  };
  notify();
}

export function clearInbox() {
  state = { ...EMPTY };
  notify();
}

export function subscribeInbox(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
