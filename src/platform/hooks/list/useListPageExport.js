"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import { exportListPageTable, notifyListPageExportResult } from "@/platform/utils/list/listPageExport";

/**
 * Export exactly what the list table shows (pass filtered rows, not paginated slice).
 */
export function useListPageExport({
  moduleName,
  rows = [],
  headers,
  onExport,
  xlsxPreambleRows,
  getXlsxRowStyles,
}) {
  const [exporting, setExporting] = useState(false);
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const xlsxPreambleRef = useRef(xlsxPreambleRows);
  xlsxPreambleRef.current = xlsxPreambleRows;
  const getXlsxRowStylesRef = useRef(getXlsxRowStyles);
  getXlsxRowStylesRef.current = getXlsxRowStyles;

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

        const preamble = typeof xlsxPreambleRef.current === "function"
          ? xlsxPreambleRef.current()
          : xlsxPreambleRef.current;

        const { filename } = await exportListPageTable({
          moduleName,
          headers: headersRef.current,
          rows: exportRows,
          format,
          xlsxPreambleRows: preamble,
          getXlsxRowStyles: getXlsxRowStylesRef.current,
        });
        const { message } = notifyListPageExportResult(format, filename);
        toast.success(message);
      } catch (err) {
        toast.error(err?.message || "Export failed.");
      } finally {
        setExporting(false);
      }
    },
    [moduleName, rows, onExport],
  );

  return {
    exporting,
    handleExport,
    exportDisabled: !rows?.length,
  };
}
