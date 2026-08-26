import { getBoxNoUidPrefixFromFinancialYear } from "@/platform/utils/core/indianFinancialYear";

const LIST_MIN = 1;
const LIST_MAX = 3650;
export const LIST_VIEW_SPAN_FALLBACK = 7;

let listViewSpanDays = LIST_VIEW_SPAN_FALLBACK;
const listViewListeners = new Set();

let inwardLocationValidationEnabled = false;
let locationCapacityValidationEnabled = false;

function clampListSpan(n) {
  const x = parseInt(String(n), 10);
  if (!Number.isFinite(x)) return LIST_VIEW_SPAN_FALLBACK;
  return Math.max(LIST_MIN, Math.min(LIST_MAX, x));
}

export function subscribeListViewSpan(listener) {
  listViewListeners.add(listener);
  return () => listViewListeners.delete(listener);
}

export function getListViewSpanSnapshot() {
  return listViewSpanDays;
}

export function setListViewSpanDays(n) {
  const next = clampListSpan(n);
  if (next === listViewSpanDays) return;
  listViewSpanDays = next;
  listViewListeners.forEach((l) => l());
}

export function setInwardLocationValidationEnabled(value) {
  inwardLocationValidationEnabled = value === true;
}

export function isInwardLocationValidationEnabled() {
  return inwardLocationValidationEnabled;
}

export function setLocationCapacityValidationEnabled(value) {
  locationCapacityValidationEnabled = value === true;
}

export function isLocationCapacityValidationEnabled() {
  return locationCapacityValidationEnabled;
}

export function getBoxNoUidPrefix() {
  return getBoxNoUidPrefixFromFinancialYear();
}

export function applySessionFromLogin(payload) {
  if (payload?.default_list_view_span_days != null) {
    setListViewSpanDays(payload.default_list_view_span_days);
  }
  if (payload?.inward_location_validation != null) {
    setInwardLocationValidationEnabled(payload.inward_location_validation === true);
  }
  if (payload?.location_capacity_validation != null) {
    setLocationCapacityValidationEnabled(payload.location_capacity_validation === true);
  }
}

