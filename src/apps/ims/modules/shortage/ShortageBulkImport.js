"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, Trash2, Check, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { FormLabel, OK_INPUT } from "@/ui/common/Constants";
import { readSpreadsheetMatrixFromFile } from "@/platform/utils/list/excelWorkbook";
import { shortageService } from "@/apps/ims/lib/services/shortage";
import { parseShortageImportMatrix } from "@/apps/ims/modules/shortage/parseShortageImport";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function collapseRawRows(rows = []) {
  const map = new Map();
  for (const r of rows) {
    const dcode = String(r.item_dcode ?? r.itemdcode ?? "").trim();
    const code = String(r.item_code ?? r.itemcode ?? "").trim();
    const key = dcode || code;
    if (!key) continue;
    const qty = parseInt(String(r.qty ?? "").replace(/,/g, ""), 10);
    if (!Number.isFinite(qty) || qty < 1) continue;
    const prev = map.get(key);
    if (prev) {
      prev.qty += qty;
      continue;
    }
    map.set(key, {
      item_dcode: dcode || undefined,
      item_code: code || undefined,
      qty,
      type: "PPC",
    });
  }
  return Array.from(map.values());
}

export default function ShortageBulkImport({ onSuccess, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState(currentMonthValue);
  const [previewRows, setPreviewRows] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const reset = () => {
    setFile(null);
    setPreviewRows([]);
    setMonth(currentMonthValue());
    setParsing(false);
    setLoading(false);
  };

  const setDrawerOpen = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const close = () => {
    setDrawerOpen(false);
    reset();
  };

  /** Only rows that will insert (valid + not already in DB). */
  const insertRows = useMemo(
    () => previewRows.filter((r) => r.valid !== false && !r.already_exists),
    [previewRows]
  );
  const skippedCount = previewRows.length - insertRows.length;

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!month) {
      toast.error("Select month first.");
      e.target.value = "";
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setPreviewRows([]);
    try {
      const matrix = await readSpreadsheetMatrixFromFile(selectedFile, { defval: "" });
      const parsed = parseShortageImportMatrix(matrix);
      const raw = collapseRawRows(parsed);
      if (!raw.length) {
        throw new Error("No valid rows. A=item_dcode, B=item_code, C=qty.");
      }

      const res = await shortageService.bulkPreview(raw, month);
      if (!res?.success) throw new Error(res?.message || "Preview failed.");
      const rows = Array.isArray(res.data) ? res.data : [];
      setPreviewRows(rows);
      if (!rows.length) toast.warning("No valid rows found.");
    } catch (err) {
      toast.error(err?.message || "Could not read file.");
      setFile(null);
      setPreviewRows([]);
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!insertRows.length || loading) return;
    setLoading(true);
    try {
      const payload = insertRows.map((r) => ({
        itemdcode: r.itemdcode,
        itemcode: r.itemcode || r.item_code || String(r.itemdcode),
        qty: r.qty,
        type: "PPC",
        month: r.month || month,
      }));

      const res = await shortageService.bulkCreate(payload, month);
      if (!res?.success) throw new Error(res?.message || "Import failed.");

      toast.success(res.message || `${res.count || 0} PPC shortage saved.`);
      onSuccess?.();
      close();
    } catch (err) {
      toast.error(err?.message || "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = insertRows.length > 0 && !loading && !parsing;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setDrawerOpen(true);
        }}
        className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border border-slate-300 shadow-none shrink-0 inline-flex items-center gap-2 text-slate-700 hover:bg-slate-50"
      >
        <Upload size={14} /> Import
      </button>

      <Drawer
        isOpen={open}
        onClose={close}
        onSubmit={canSubmit ? () => void handleSubmit() : undefined}
        closeOnOutside={false}
        title="Import Shortage"
        headerVariant="form"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[10px] text-slate-500 tabular-nums font-medium">
              {previewRows.length > 0
                ? `${previewRows.length} total · ${insertRows.length} save${
                    skippedCount > 0 ? ` · ${skippedCount} skip` : ""
                  }`
                : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="px-4 py-2 text-sm font-bold text-slate-500 disabled:opacity-50"
              >
                Close
              </button>
              {previewRows.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {loading ? "Saving…" : `Submit (${insertRows.length})`}
                </button>
              ) : null}
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[150px] shrink-0">
              <FormLabel required>Month</FormLabel>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={Boolean(file) || parsing || loading}
                className={`w-full mt-1 ${OK_INPUT} !py-1.5 text-sm`}
              />
            </div>

            {!file ? (
              <button
                type="button"
                disabled={parsing || !month}
                onClick={() => fileRef.current?.click()}
                className="h-[38px] px-3 border border-dashed border-slate-300 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-[11px] font-bold uppercase text-slate-600 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {parsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {parsing ? "Reading…" : "CSV / Excel"}
              </button>
            ) : (
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2 h-[38px] px-2.5 border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-medium text-slate-700 truncate">
                  {file.name}
                  <span className="text-slate-400 font-normal">
                    {" · "}
                    {insertRows.length} to save
                    {skippedCount > 0 ? ` · ${skippedCount} skip` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={reset}
                  disabled={loading || parsing}
                  className="text-[10px] font-bold uppercase text-rose-500 hover:text-rose-600 inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                >
                  <Trash2 size={12} /> Clear
                </button>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
          </div>

          {file ? (
            <div className="border border-slate-200 overflow-hidden">
              <div className="max-h-[min(62vh,34rem)] overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-[1]">
                    <tr className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      <th className="px-2 py-1.5">Item</th>
                      <th className="px-2 py-1.5">Desc</th>
                      <th className="px-2 py-1.5 w-16 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-8 text-center text-xs text-slate-400">
                          {parsing ? "Loading…" : "No rows"}
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row) => {
                        const skip = row.valid === false || row.already_exists;
                        return (
                          <tr
                            key={row.key}
                            className={`border-b border-slate-100 text-[11px] ${
                              skip ? "bg-slate-50 text-slate-400" : ""
                            }`}
                          >
                            <td className="px-2 py-1 font-bold uppercase whitespace-nowrap">
                              {row.item_code || row.itemcode || "—"}
                            </td>
                            <td className="px-2 py-1 truncate max-w-[240px]" title={row.error || row.item_desc || ""}>
                              {row.error || row.item_desc || "—"}
                            </td>
                            <td className="px-2 py-1 text-right font-bold tabular-nums">
                              {row.qty}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
