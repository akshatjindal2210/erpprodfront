"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import { exportListPageTable, notifyListPageExportResult } from "@/core/utils/listPageExport";

/**
 * Export exactly what the list table shows (pass filtered rows, not paginated slice).
 */
export function useListPageExport({ moduleName, rows = [], headers, onExport }) {
  const [exporting, setExporting] = useState(false);
  const headersRef = useRef(headers);
  headersRef.current = headers;

  const handleExport = useCallback(
    async (format) => {
      let exportRows = rows;
      
      setExporting(true);
      try {
        if (typeof onExport === "function") {
          exportRows = await onExport(format);
        }

        if (!exportRows?.length) {
          toast.info("No rows to export.");
          return;
        }

        const { filename } = await exportListPageTable({
          moduleName,
          headers: headersRef.current,
          rows: exportRows,
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
    [moduleName, rows, onExport]
  );

  return {
    exporting,
    handleExport,
    exportDisabled: !rows?.length,
  };
}
