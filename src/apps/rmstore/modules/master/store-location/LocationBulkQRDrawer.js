"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, Download, Loader2, CheckSquare, Square } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { buildLocationLabelDataUrlsForRows, downloadLocationLabelDataUrl, getLocationDisplayNo, printLocationLabelDataUrls } from "@/apps/rmstore/lib/helpers/locationQrLabel";

/** Internal batch size for label generation (not a user-facing limit). Supports 1000+ locations. */
const PROCESS_CHUNK_SIZE = 100;

function chunkRows(rows, size) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

export default function LocationBulkQRDrawer({
  isOpen,
  onClose,
  locations = [],
  initialSelectedId = null,
}) {
  const canAccess = useCanAccess();
  const canPrint = canAccess("rm_store_location_master", "view").allowed;

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  const authorized = useMemo(
    () => locations.filter((r) => r?.approved),
    [locations]
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setBusy(false);
      setProgress(null);
      return;
    }
    const next = new Set();
    if (
      initialSelectedId != null &&
      locations.some((r) => r?.approved && r.location_id === initialSelectedId)
    ) {
      next.add(initialSelectedId);
    }
    setSelectedIds(next);
  }, [isOpen, initialSelectedId, locations]);

  const selectedRows = useMemo(
    () => authorized.filter((r) => selectedIds.has(r.location_id)),
    [authorized, selectedIds]
  );

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(authorized.map((r) => r.location_id)));
  };

  const clearAll = () => setSelectedIds(new Set());

  const runBulk = useCallback(
    async (mode, rowsOverride = null) => {
      if (!canPrint) {
        toast.info("Printing and downloading require view permission for the Location master.");
        return;
      }
      const rows = Array.isArray(rowsOverride) ? rowsOverride : selectedRows;
      if (!rows.length) {
        toast.info("No authorized locations to export.");
        return;
      }

      setBusy(true);
      setProgress({ done: 0, total: rows.length });

      if (rows.length > 500) {
        toast.info(
          `Preparing ${rows.length} labels. This may take a few minutes, so please keep this tab open.`,
          { autoClose: 6000 }
        );
      }

      try {
        const chunks = chunkRows(rows, PROCESS_CHUNK_SIZE);
        const allDataUrls = [];

        for (const chunk of chunks) {
          const urls = await buildLocationLabelDataUrlsForRows(chunk);
          allDataUrls.push(...urls);
          setProgress({ done: allDataUrls.length, total: rows.length });
          await new Promise((r) => setTimeout(r, 0));
        }

        if (mode === "print") {
          const ok = printLocationLabelDataUrls(allDataUrls);
          if (!ok) {
            toast.error("Could not open the print window. Allow popups for this site.");
            return;
          }
          toast.success(`Printing ${rows.length} label(s) in a single job…`);
        } else {
          for (let i = 0; i < rows.length; i++) {
            downloadLocationLabelDataUrl(rows[i], allDataUrls[i]);
            if (i < rows.length - 1) {
              await new Promise((r) => setTimeout(r, 120));
            }
            if ((i + 1) % PROCESS_CHUNK_SIZE === 0 || i === rows.length - 1) {
              setProgress({ done: i + 1, total: rows.length });
            }
          }
          toast.success(`Downloaded ${rows.length} label(s).`);
        }
      } catch (err) {
        toast.error(err?.message || "Could not export the QR labels. Please try again.");
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [selectedRows, canPrint]
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk QR Labels"
      description={
        canPrint
          ? "Print or download every authorized location in a single action. Processing is automatic, however many labels are selected."
          : "View permission is required to print or download location labels."
      }
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-4 min-h-0">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 px-3 py-2.5 shrink-0">
          <p className="text-[10px] font-bold text-indigo-800 uppercase leading-snug">
            All authorized ({authorized.length})
          </p>
          <p className="text-[10px] text-indigo-700 mt-1 leading-snug">
            Use the buttons below to print or download every authorized location in this list in a single job.
          </p>
          <div className="flex items-center gap-2 mt-3">
            {canPrint ? (
            <>
            <button
              type="button"
              disabled={busy || authorized.length === 0}
              onClick={() => void runBulk("print", authorized)}
              className="flex-1 h-10 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-lg font-bold text-[11px] uppercase disabled:opacity-50 active:scale-95 transition-all"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              Print all ({authorized.length})
            </button>
            <button
              type="button"
              disabled={busy || authorized.length === 0}
              onClick={() => void runBulk("download", authorized)}
              title="Download all authorized labels"
              className="w-10 h-10 flex items-center justify-center border border-indigo-200 bg-white text-slate-700 rounded-lg hover:bg-indigo-50 disabled:opacity-50 active:scale-95 transition-all shrink-0"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            </button>
            </>
            ) : null}
          </div>
        </div>

        {canPrint ? (
        <div className="flex items-center gap-3 pb-1 border-b border-slate-100 shrink-0">
          <button
            type="button"
            disabled={busy || selectedRows.length === 0}
            onClick={() => void runBulk("print")}
            className="flex-1 h-10 flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-800 rounded-lg font-bold text-[11px] uppercase disabled:opacity-50 active:scale-95 transition-all"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            Print selected ({selectedRows.length})
          </button>
          <button
            type="button"
            disabled={busy || selectedRows.length === 0}
            onClick={() => void runBulk("download")}
            title="Download selected labels only"
            className="w-10 h-10 flex items-center justify-center border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition-all shrink-0"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          </button>
        </div>
        ) : null}

        {busy && progress?.total > 0 && (
          <p className="text-[10px] font-bold text-indigo-600 uppercase shrink-0">
            Processing {progress.done} / {progress.total}…
          </p>
        )}

        <div className="flex items-center justify-between gap-2 shrink-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Selected {selectedRows.length} / {authorized.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              disabled={busy || authorized.length === 0}
              className="text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy || selectedIds.size === 0}
              className="text-[10px] font-bold uppercase text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 max-h-[min(55vh,28rem)] overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg divide-y divide-slate-100">
          {authorized.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">
              No authorized locations are in the current list. Approve locations first.
            </p>
          ) : (
            authorized.map((row) => {
              const checked = selectedIds.has(row.location_id);
              return (
                <button
                  key={row.location_id}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleOne(row.location_id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                    checked ? "bg-indigo-50/80" : "bg-white hover:bg-slate-50"
                  } disabled:opacity-60`}
                >
                  <span className="mt-0.5 shrink-0 text-indigo-600">
                    {checked ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono font-bold text-[11px] text-slate-800 uppercase">
                      {getLocationDisplayNo(row)}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      RM Rack {row.rack_no || "—"} · RM Row {(row.row_no || "—").toString().toUpperCase()}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Drawer>
  );
}

