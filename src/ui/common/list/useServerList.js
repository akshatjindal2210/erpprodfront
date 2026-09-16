"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { fetchAllListPages } from "@/ui/common/list/clientListSearch";

function todayRange() {
  const today = dayjs().format("YYYY-MM-DD");
  return { from: today, to: today };
}

function rangeFromDefaults(dateDefaults, defaultToday) {
  if (dateDefaults && (dateDefaults.from || dateDefaults.to)) {
    return { from: dateDefaults.from || "", to: dateDefaults.to || "" };
  }
  if (defaultToday) return todayRange();
  return { from: "", to: "" };
}

/** Server list state — loads the matching set once, then the page reveals rows on scroll (IMS-style). */
export function useServerList({
  fetchList,
  getRowId,
  defaultToday = true,
  extraFilterKeys = [],
  /**
   * Keys that hit the API. When set, other extraFilterKeys stay in params for client-only filters.
   * When omitted, all extraFilterKeys go to the API (legacy).
   */
  serverExtraFilterKeys,
  /** When true, search box filters loaded rows in the browser (not sent to API). */
  clientQuickSearch = false,
  /** Permission span from `useViewDateFilterDefaults`. When set, replaces the today-only default. */
  dateDefaults = null,
}) {
  const extraKeys = Array.isArray(extraFilterKeys) ? extraFilterKeys : [];
  const serverKeys = Array.isArray(serverExtraFilterKeys) ? serverExtraFilterKeys : null;
  const extraSig = extraKeys.join("|");
  const serverSig = serverKeys ? serverKeys.join("|") : "";
  const dateDefaultsRef = useRef(dateDefaults);
  dateDefaultsRef.current = dateDefaults;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [queryVersion, setQueryVersion] = useState(0);
  const [tempSearch, setTempSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useState(() => {
    const extras = Object.fromEntries(extraKeys.map((k) => [k, ""]));
    const { from, to } = rangeFromDefaults(dateDefaults, defaultToday);
    return { fromDate: from, toDate: to, ...extras };
  });

  // Only server extras (not client/quick keys) belong in the API payload signature.
  const serverExtrasSnapshot = useMemo(() => {
    const keys = serverKeys ?? extraKeys;
    return keys.map((key) => `${key}=${params[key] ?? ""}`).join("&");
  }, [params, extraSig, serverSig]);

  const listFilters = useMemo(() => {
    const f = {};
    if (params.fromDate) f.from_date = params.fromDate;
    if (params.toDate) f.to_date = params.toDate;
    if (!clientQuickSearch && appliedSearch?.trim()) f.search = appliedSearch.trim();
    const keysToSend = serverKeys ?? extraKeys;
    keysToSend.forEach((key) => {
      const value = params[key];
      if (value != null && String(value).trim() !== "" && String(value).trim().toLowerCase() !== "all") {
        f[key] = value;
      }
    });
    return f;
    // Omit full `params` so client-only filter changes do not refetch
  }, [params.fromDate, params.toDate, appliedSearch, clientQuickSearch, serverExtrasSnapshot, extraSig, serverSig]);

  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    void queryVersion;
    const id = ++requestIdRef.current;
    setLoading(true);
    try {
      const { data, total: loadedTotal } = await fetchAllListPages(async (page, limit) => {
        const res = await fetchList({ page, limit, filters: listFilters });
        const chunk = Array.isArray(res?.data) ? res.data : [];
        const reported = Number(res?.total);
        return { data: chunk, total: Number.isFinite(reported) ? reported : chunk.length };
      }, 1000);
      if (id !== requestIdRef.current) return;
      setRows(data);
      setTotal(loadedTotal);
    } catch (err) {
      if (id !== requestIdRef.current) return;
      toast.error(err?.message || "Failed to load data.");
      setRows([]);
      setTotal(0);
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [fetchList, listFilters, queryVersion]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!dateDefaults?.from && !dateDefaults?.to) return;
    setParams((prev) => {
      if (prev.fromDate === dateDefaults.from && prev.toDate === dateDefaults.to) return prev;
      return { ...prev, fromDate: dateDefaults.from || "", toDate: dateDefaults.to || "" };
    });
  }, [dateDefaults?.from, dateDefaults?.to]);

  const applyFilters = useCallback(() => {
    setQueryVersion((v) => v + 1);
    if (!clientQuickSearch) setAppliedSearch(tempSearch);
  }, [tempSearch, clientQuickSearch]);

  const resetFilters = useCallback(() => {
    setTempSearch("");
    setAppliedSearch("");
    setQueryVersion((v) => v + 1);
    const extras = Object.fromEntries(extraSig.split("|").filter(Boolean).map((k) => [k, ""]));
    const { from, to } = rangeFromDefaults(dateDefaultsRef.current, defaultToday);
    setParams({ fromDate: from, toDate: to, ...extras });
  }, [defaultToday, extraSig]);

  const selectedRecord = useMemo(() => {
    if (selected == null) return null;
    const match = (row) => String(getRowId ? getRowId(row) : row.id) === String(selected);
    return rows.find(match) ?? null;
  }, [rows, selected, getRowId]);

  return {
    loading,
    rows,
    total,
    tempSearch,
    setTempSearch,
    params,
    setParams,
    selected,
    setSelected,
    selectedRecord,
    listFilters,
    load,
    applyFilters,
    resetFilters,
    clientQuickSearch,
  };
}
