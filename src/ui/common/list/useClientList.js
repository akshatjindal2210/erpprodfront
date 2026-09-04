"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { toastDataRefreshed } from "@/platform/utils/core/toastNotify";
import { applyClientSearch, sortRowsByKey, nextSortParams } from "@/ui/common/list/clientListSearch";

export const CLIENT_LIST_PAGE_SIZE = 100;

function indexRowsByKey(rows, getRowKey) {
  const map = new Map();
  for (const row of rows) {
    map.set(getRowKey(row), row);
  }
  return map;
}

/** Client-side list state — search, sort, selection, load-more (shared across apps). */
export function useClientList({
  loadData,
  errorMessage = "Failed to load data",
  getSearchParts,
  pageSize = CLIENT_LIST_PAGE_SIZE,
  getRowKey,
  initialSort = { sortKey: "", sortDir: "asc" },
}) {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(pageSize);
  const [tempSearch, setTempSearch] = useState("");
  const [params, setParams] = useState(initialSort);
  const [selected, setSelected] = useState(null);

  const reload = useCallback(
    async (isManualRefresh = false) => {
      setLoading(true);
      try {
        const list = await loadData();
        const rows = Array.isArray(list) ? list : [];
        setAllData(rows);
        if (isManualRefresh) toastDataRefreshed();
        return rows;
      } catch (err) {
        toast.error(err?.message || errorMessage);
        setAllData([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [loadData, errorMessage]
  );

  useEffect(() => {
    reload(false);
  }, [reload]);

  const rowByKey = useMemo(
    () => (getRowKey ? indexRowsByKey(allData, getRowKey) : null),
    [allData, getRowKey]
  );

  const selectedRecord = useMemo(() => {
    if (selected == null) return null;
    if (rowByKey) return rowByKey.get(selected) ?? null;
    return allData.find((row) => getRowKey?.(row) === selected) ?? null;
  }, [allData, selected, rowByKey, getRowKey]);

  const filteredData = useMemo(() => {
    let data = allData;
    const q = tempSearch.trim();
    if (q && getSearchParts) {
      data = applyClientSearch(data, q, { getParts: getSearchParts, skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allData, tempSearch, params.sortKey, params.sortDir, getSearchParts]);

  const items = useMemo(() => filteredData.slice(0, displayLimit), [filteredData, displayLimit]);
  const totalItems = filteredData.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((prev) => prev + pageSize);
    }
  }, [loading, items.length, totalItems, pageSize]);

  const toggleSort = useCallback(
    (key) => {
      setParams((prev) => nextSortParams(prev, key));
      setDisplayLimit(pageSize);
    },
    [pageSize]
  );

  const resetDisplayLimit = useCallback(() => {
    setDisplayLimit(pageSize);
  }, [pageSize]);

  return {
    loading,
    reload,
    tempSearch,
    setTempSearch,
    params,
    selected,
    setSelected,
    selectedRecord,
    filteredData,
    items,
    totalItems,
    handleLoadMore,
    toggleSort,
    resetDisplayLimit,
  };
}
