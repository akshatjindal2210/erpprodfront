"use client";

import { useMemo, useSyncExternalStore } from "react";
import dayjs from "dayjs";
import { subscribeListViewSpan, getListViewSpanSnapshot } from "@/core/utils/global";

function clampSpanDays(n) {
  const x = parseInt(String(n), 10);
  if (!Number.isFinite(x)) return getListViewSpanSnapshot();
  return Math.max(1, Math.min(3650, x));
}

/**
 * @param {object} viewAccess - from `useCanAccess(module, "view")`
 * @param {number} [listViewSpanDays] - from store or API; defaults to `getListViewSpanSnapshot()`
 */
export function buildViewDateFilterDefaults(viewAccess, listViewSpanDays) {
  const spanBase =
    listViewSpanDays != null && Number.isFinite(Number(listViewSpanDays))
      ? clampSpanDays(listViewSpanDays)
      : getListViewSpanSnapshot();

  const empty = { from: "", to: "", minDate: "", maxDate: "" };
  if (!viewAccess?.allowed) return empty;

  const raw = Number(viewAccess.days);
  const hasCap = Number.isFinite(raw) && raw > 0;
  const today = dayjs().format("YYYY-MM-DD");

  let minDate = "";
  let maxDate = "";
  if (hasCap) {
    minDate = dayjs().subtract(raw - 1, "day").format("YYYY-MM-DD");
    maxDate = today;
  }

  const span = hasCap ? Math.min(spanBase, raw) : spanBase;
  const to = today;
  const from = dayjs().subtract(span - 1, "day").format("YYYY-MM-DD");

  return { from, to, minDate, maxDate };
}

/** Subscribes to DB-backed span from `ListViewSpanBootstrap`; use on list pages instead of raw `buildViewDateFilterDefaults`. */
export function useViewDateFilterDefaults(viewAccess) {
  const spanDays = useSyncExternalStore(subscribeListViewSpan, getListViewSpanSnapshot);
  return useMemo(() => buildViewDateFilterDefaults(viewAccess, spanDays), [viewAccess, spanDays]);
}
