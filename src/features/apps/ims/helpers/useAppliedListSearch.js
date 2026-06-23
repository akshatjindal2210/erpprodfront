import { useState, useCallback } from "react";

/**
 * List quick search — type freely (client-side filter on loaded rows).
 * DB/API search runs only when applySearch() is called (Search button or Enter).
 */
export function useAppliedListSearch() {
  const [tempSearch, setTempSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const applySearch = useCallback((value) => {
    const q = String(value ?? "").trim();
    setAppliedSearch(q);
    return q;
  }, []);

  const applySearchFromInput = useCallback(() => applySearch(tempSearch), [applySearch, tempSearch]);

  const resetSearch = useCallback(() => {
    setTempSearch("");
    setAppliedSearch("");
  }, []);

  return {
    tempSearch,
    setTempSearch,
    appliedSearch,
    applySearch,
    applySearchFromInput,
    resetSearch,
  };
}
