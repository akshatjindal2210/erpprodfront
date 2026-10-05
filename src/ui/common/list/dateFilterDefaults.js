"use client";

import { useMemo, useSyncExternalStore } from "react";
import dayjs from "dayjs";
import { subscribeListViewSpan, getListViewSpanSnapshot } from "@/platform/utils/global";

function clampSpanDays(n) {
  const x = parseInt(String(n), 10);
  if (!Number.isFinite(x)) return getListViewSpanSnapshot();
  return Math.max(1, Math.min(3650, x));
}

/**
 * @param {object} viewAccess - from `useCanAccess(module, "view")`
 * @param {number} [listViewSpanDays] - from store or API; defaults to `getListViewSpanSnapshot()`
 * @param {number} [defaultSpanDays] - optional override for From/To default length (e.g. 1 = today only)
 */
export function buildViewDateFilterDefaults(viewAccess, listViewSpanDays, defaultSpanDays) {
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

  // Optional page override (e.g. Daily Attendance → always 1 day).
  const forced = Number(defaultSpanDays);
  if (Number.isFinite(forced) && forced >= 1) {
    const span = hasCap ? Math.min(forced, raw) : forced;
    return {
      from: dayjs().subtract(span - 1, "day").format("YYYY-MM-DD"),
      to: today,
      minDate,
      maxDate,
    };
  }

  const span = hasCap ? Math.min(spanBase, raw) : spanBase;
  return { from: dayjs().subtract(span - 1, "day").format("YYYY-MM-DD"), to: today, minDate, maxDate };
}

/** Subscribes to DB-backed span from `ListViewSpanBootstrap`. */
export function useViewDateFilterDefaults(viewAccess, defaultSpanDays) {
  const spanDays = useSyncExternalStore(subscribeListViewSpan, getListViewSpanSnapshot);
  return useMemo(
    () => buildViewDateFilterDefaults(viewAccess, spanDays, defaultSpanDays),
    [viewAccess, spanDays, defaultSpanDays]
  );
}
