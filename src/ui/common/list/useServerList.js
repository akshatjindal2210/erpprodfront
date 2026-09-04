"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { toast } from "react-toastify";

function todayRange() {
  const today = dayjs().format("YYYY-MM-DD");
  return { from: today, to: today };
}

/** Server-paginated list state — shared by ServerListPage and future CRUD modules. */
export function useServerList({
  fetchList,
  getRowId,
  pageSize = 100,
  defaultToday = true,
  extraFilterKeys = [],
  /** When true, search box filters loaded rows in the browser (not sent to API). */
  clientQuickSearch = false,
}) {
  const extraKeys = Array.isArray(extraFilterKeys) ? extraFilterKeys : [];
  const extraSig = extraKeys.join("|");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tempSearch, setTempSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useState(() => {
    const extras = Object.fromEntries(extraKeys.map((k) => [k, ""]));
    if (!defaultToday) return { fromDate: "", toDate: "", ...extras };
    const { from, to } = todayRange();
    return { fromDate: from, toDate: to, ...extras };
  });

  const listFilters = useMemo(() => {
    const f = {};
    if (params.fromDate) f.from_date = params.fromDate;
    if (params.toDate) f.to_date = params.toDate;
    if (!clientQuickSearch && appliedSearch?.trim()) f.search = appliedSearch.trim();
    extraKeys.forEach((key) => {
      const value = params[key];
      if (value != null && String(value).trim() !== "" && String(value).trim().toLowerCase() !== "all") {
        f[key] = value;
      }
    });
    return f;
  }, [params, appliedSearch, extraSig, clientQuickSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchList({ page, limit: pageSize, filters: listFilters });
      setRows(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      toast.error(err?.message || "Failed to load data.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fetchList, page, pageSize, listFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = useCallback(() => {
    setPage(1);
    if (!clientQuickSearch) setAppliedSearch(tempSearch);
  }, [tempSearch, clientQuickSearch]);

  const resetFilters = useCallback(() => {
    setTempSearch("");
    setAppliedSearch("");
    setPage(1);
    const extras = Object.fromEntries(extraSig.split("|").filter(Boolean).map((k) => [k, ""]));
    if (defaultToday) {
      const { from, to } = todayRange();
      setParams({ fromDate: from, toDate: to, ...extras });
    } else {
      setParams({ fromDate: "", toDate: "", ...extras });
    }
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
    page,
    setPage,
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
