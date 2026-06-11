"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import { exportListPageTable, notifyListPageExportResult } from "@/core/utils/listPageExport";

/**
 * Export exactly what the list table shows (pass filtered rows, not paginated slice).
 */
export function useListPageExport({ moduleName, rows = [], headers }) {
  const [exporting, setExporting] = useState(false);
  const headersRef = useRef(headers);
  headersRef.current = headers;

  const handleExport = useCallback(
    async (format) => {
      if (!rows?.length) {
        toast.info("No rows to export.");
        return;
      }
      setExporting(true);
      try {
        const { filename } = await exportListPageTable({
          moduleName,
          headers: headersRef.current,
          rows,
          format,
        });
        const { message } = notifyListPageExportResult(format, filename);
        toast.success(message);
      } catch (err) {
        toast.error(err?.message || "Export failed.");
      } finally {
        setExporting(false);
      }
    },
    [moduleName, rows]
  );

  return {
    exporting,
    handleExport,
    exportDisabled: !rows?.length,
  };
}
