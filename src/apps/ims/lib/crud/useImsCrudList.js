/**
 * Shared list-page state for IMS CRUD modules (fetch, search, sort, pagination).
 *
 * Usage:
 *   const list = useImsCrudList({
 *     service: shortageService,
 *     buildFilters: (params) => params.type !== "all" ? { type: params.type } : {},
 *   });
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";

export function useImsCrudList({
  service,
  pageSize = 1000,
  displayChunk = 100,
  defaultSort = { key: "id", dir: "desc" },
  buildFilters = () => ({}),
  errorMessage = "Failed to load records",
  extraParams = {},
}) {
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState({
    pageSize,
    sortKey: defaultSort.key,
    sortDir: defaultSort.dir,
    ...extraParams,
  });
  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(displayChunk);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || defaultSort.key,
        order: (params.sortDir || defaultSort.dir).toUpperCase(),
        filters: buildFilters(params),
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await service.getAll({ ...base, page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(displayChunk);
    } catch (err) {
      toast.error(err?.message || errorMessage);
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [service, params, buildFilters, errorMessage, defaultSort.key, defaultSort.dir, displayChunk]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(allRows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + displayChunk);
    }
  }, [loading, items.length, totalItems, displayChunk]);

  const handleSort = useCallback((key) => {
    setDisplayLimit(displayChunk);
    setParams((p) => ({
      ...p,
      sortKey: key,
      sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
    }));
  }, [displayChunk]);

  return {
    loading,
    params,
    setParams,
    tempSearch,
    setTempSearch,
    allRows,
    filteredRows,
    items,
    totalItems,
    fetchRows,
    handleLoadMore,
    handleSort,
  };
}
