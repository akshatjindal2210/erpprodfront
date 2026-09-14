"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Download, Loader2, Printer, Square } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { isTrayPrintable } from "@/apps/ims/lib/helpers/trayHelper";
import { runTrayLabelBulkExport } from "@/apps/ims/lib/helpers/trayQrLabel";

export default function TrayBulkQRDrawer({
  isOpen,
  onClose,
  trays = [],
  loading = false,
  stackLevel = 0,
}) {
  const canAccess = useCanAccess();
  const canPrint = canAccess("tray_master", "view").allowed;

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const selectAllRef = useRef(null);

  const printable = useMemo(() => trays.filter(isTrayPrintable), [trays]);
  const selectedRows = useMemo(
    () => printable.filter((row) => selectedIds.has(row.id)),
    [printable, selectedIds]
  );
  const allSelected = printable.length > 0 && printable.every((row) => selectedIds.has(row.id));
  const someSelected = printable.some((row) => selectedIds.has(row.id));

  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setBusy(false);
      return;
    }
    setSelectedIds(new Set(printable.map((row) => row.id)));
  }, [isOpen, printable]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(printable.map((row) => row.id)));
  const clearAll = () => setSelectedIds(new Set());

  const runBulk = useCallback(
    async (mode) => {
      if (!canPrint) return;
      if (!selectedRows.length) return;
      setBusy(true);
      try {
        const result = await runTrayLabelBulkExport(mode, selectedRows);
        if (result.ok) {
          toast.success(mode === "print" ? `Printing ${result.count} label(s)...` : `Downloaded ${result.count} label(s).`);
        } else if (result.reason === "popup") {
          toast.error("Allow pop-ups for this site.");
        }
      } catch (err) {
        toast.error(err?.message || "Export failed");
      } finally {
        setBusy(false);
      }
    },
    [canPrint, selectedRows]
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk QR labels"
      description="Active authorized trays"
      maxWidth="max-w-lg"
      stackLevel={stackLevel}
      bodyScrollable={false}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-xs font-bold uppercase">Loading...</span>
          </div>
        ) : null}

        {canPrint ? (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={busy || loading || !selectedRows.length}
              onClick={() => void runBulk("print")}
              className="flex-1 h-10 flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-800 rounded-lg font-bold text-[11px] uppercase disabled:opacity-50 active:scale-95 transition-all"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              Print ({selectedRows.length})
            </button>
            <button
              type="button"
              disabled={busy || loading || !selectedRows.length}
              onClick={() => void runBulk("download")}
              className="w-10 h-10 flex items-center justify-center border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition-all shrink-0"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            </button>
          </div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg">
          {!loading && printable.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">No printable trays.</p>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-200">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  disabled={busy || loading || !printable.length}
                  onChange={() => (allSelected ? clearAll() : selectAll())}
                  className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600"
                />
                <span className="text-[10px] font-bold uppercase text-slate-600 flex-1">
                  Select all ({printable.length})
                </span>
                {selectedIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={busy || loading}
                    className="text-[10px] font-bold uppercase text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="divide-y divide-slate-100">
                {printable.map((row) => {
                  const checked = selectedIds.has(row.id);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      disabled={busy || loading}
                      onClick={() => toggleOne(row.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${checked ? "bg-indigo-50/80" : "bg-white hover:bg-slate-50"} disabled:opacity-60`}
                    >
                      <span className="shrink-0 text-indigo-600">
                        {checked ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono font-bold text-[11px] text-indigo-600 uppercase">{row.code || "—"}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          {row.type || "—"} · {row.batch_id || "—"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
