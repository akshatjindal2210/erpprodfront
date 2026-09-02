"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, Check, Loader2, Download, FileSpreadsheet, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { FormLabel, OK_INPUT } from "@/ui/common/Constants";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { readSpreadsheetMatrixFromFile } from "@/platform/utils/list/excelWorkbook";
import { shortageService, SHORTAGE_BULK_IMPORT_TYPES } from "@/apps/ims/lib/services/shortage";
import { parseShortageImportMatrix, parseImportQty } from "@/apps/ims/modules/shortage/parseShortageImport";
import { downloadShortageImportTemplate } from "@/apps/ims/modules/shortage/shortageImportTemplate";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function collapseRawRows(rows = [], importType = "PPC") {
  const map = new Map();
  for (const r of rows) {
    const dcode = String(r.item_dcode ?? r.itemdcode ?? "").trim();
    const code = String(r.item_code ?? r.itemcode ?? "").trim();
    const key = dcode || code;
    if (!key) continue;
    const qty = parseImportQty(r.qty);
    if (qty == null) continue;
    const prev = map.get(key);
    if (prev) {
      prev.qty += qty;
      continue;
    }
    map.set(key, {
      item_dcode: dcode || undefined,
      item_code: code || undefined,
      qty,
      type: importType,
    });
  }
  return Array.from(map.values());
}

function isRowImportable(row) {
  return row?.valid !== false && !row?.already_exists;
}

function defaultSelectedKeys(rows = []) {
  return new Set(rows.filter(isRowImportable).map((r) => r.key));
}

export default function ShortageBulkImport({ onSuccess, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [importType, setImportType] = useState("PPC");
  const [month, setMonth] = useState(currentMonthValue);
  const [previewRows, setPreviewRows] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sopGateReady, setSopGateReady] = useState(true);
  const fileRef = useRef(null);
  const sopAckRef = useRef(null);

  const reset = () => {
    setFile(null);
    setPreviewRows([]);
    setSelectedKeys(new Set());
    setImportType("PPC");
    setMonth(currentMonthValue());
    setParsing(false);
    setLoading(false);
    setSopGateReady(true);
  };

  const setDrawerOpen = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const close = () => {
    setDrawerOpen(false);
    reset();
  };

  const importableRows = useMemo(
    () => previewRows.filter(isRowImportable),
    [previewRows]
  );

  const insertRows = useMemo(
    () => importableRows.filter((r) => selectedKeys.has(r.key)),
    [importableRows, selectedKeys]
  );

  const skippedCount = previewRows.length - importableRows.length;
  const allImportableSelected =
    importableRows.length > 0 && importableRows.every((r) => selectedKeys.has(r.key));

  useEffect(() => {
    setSelectedKeys(defaultSelectedKeys(previewRows));
  }, [previewRows]);

  const previewFromFile = useCallback(async (selectedFile, type, monthValue) => {
    const matrix = await readSpreadsheetMatrixFromFile(selectedFile, { defval: "" });
    const parsed = parseShortageImportMatrix(matrix);
    const raw = collapseRawRows(parsed, type);
    if (!raw.length) {
      throw new Error("No valid rows. Qty must be greater than 0.");
    }

    const res = await shortageService.bulkPreview(raw, monthValue, type);
    if (!res?.success) throw new Error(res?.message || "Preview failed.");
    const rows = Array.isArray(res.data) ? res.data : [];
    setPreviewRows(rows);
    if (!rows.length) toast.warning("No valid rows found.");
  }, []);

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
      await previewFromFile(selectedFile, importType, month);
    } catch (err) {
      toast.error(err?.message || "Could not read file.");
      setFile(null);
      setPreviewRows([]);
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const handleImportTypeChange = async (nextType) => {
    if (nextType === importType || parsing || loading) return;
    setImportType(nextType);
    if (!file || !month) return;
    setParsing(true);
    try {
      await previewFromFile(file, nextType, month);
    } catch (err) {
      toast.error(err?.message || "Could not refresh preview.");
      setPreviewRows([]);
    } finally {
      setParsing(false);
    }
  };

  const toggleRow = (row) => {
    if (!isRowImportable(row)) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(row.key)) next.delete(row.key);
      else next.add(row.key);
      return next;
    });
  };

  const toggleAllImportable = () => {
    if (allImportableSelected) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(defaultSelectedKeys(previewRows));
  };

  const handleSubmit = async () => {
    if (!insertRows.length || loading) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;

    setLoading(true);
    try {
      const payload = insertRows.map((r) => ({
        itemdcode: r.itemdcode,
        itemcode: r.itemcode || r.item_code || String(r.itemdcode),
        qty: r.qty,
        type: importType,
        month: r.month || month,
      }));

      const res = await shortageService.bulkCreate(payload, month, importType);
      if (!res?.success) throw new Error(res?.message || "Import failed.");

      toast.success(res.message || `${res.count || 0} ${importType} shortage saved.`);
      onSuccess?.();
      close();
    } catch (err) {
      toast.error(err?.message || "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = insertRows.length > 0 && !loading && !parsing && sopGateReady;

  const drawerTitle = (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <span className="text-base font-semibold text-slate-900 shrink-0">Import Shortage</span>
      <span className="w-px h-3.5 bg-slate-200 shrink-0" aria-hidden />
      <button
        type="button"
        onClick={() => void downloadShortageImportTemplate()}
        className="text-[10px] font-medium text-slate-400 hover:text-indigo-600 inline-flex items-center gap-1 transition-colors shrink-0"
      >
        <Download size={11} /> Excel format
      </button>
    </div>
  );

  const footerContent = (
    <div className="flex items-center justify-between gap-3 w-full">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider tabular-nums">
        {previewRows.length > 0
          ? `${selectedKeys.size} selected · ${insertRows.length} save${
              skippedCount > 0 ? ` · ${skippedCount} skip` : ""
            }`
          : ""}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={close}
          disabled={loading}
          className="px-5 py-2.5 text-sm font-bold text-slate-500 disabled:opacity-50"
        >
          Cancel
        </button>
        {previewRows.length > 0 ? (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {loading ? "Saving…" : `Import (${insertRows.length})`}
          </button>
        ) : null}
      </div>
    </div>
  );

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
        title={drawerTitle}
        headerVariant="form"
        footer={footerContent}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            isOpen={open}
            moduleSlug="shortage"
            permissionType="add"
            onGateReadyChange={setSopGateReady}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FormLabel required htmlFor="shortage-import-month">
                Month
              </FormLabel>
              <input
                id="shortage-import-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={Boolean(file) || parsing || loading}
                className={`w-full mt-1 ${OK_INPUT}`}
              />
            </div>

            <div>
              <FormLabel required htmlFor="shortage-import-type">
                Type
              </FormLabel>
              <div className="relative mt-1">
                <select
                  id="shortage-import-type"
                  value={importType}
                  onChange={(e) => void handleImportTypeChange(e.target.value)}
                  disabled={parsing || loading}
                  className={`w-full appearance-none pr-10 ${OK_INPUT}`}
                >
                  {SHORTAGE_BULK_IMPORT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
          </div>

          <div>
            {!file ? (
              <button
                type="button"
                disabled={parsing || !month}
                onClick={() => fileRef.current?.click()}
                className="w-full min-h-[72px] px-4 border border-dashed border-slate-300 bg-slate-50 hover:bg-indigo-50/40 hover:border-indigo-300 text-[11px] font-bold uppercase text-slate-500 rounded-lg inline-flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {parsing ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Upload size={18} className="text-slate-400" />}
                {parsing ? "Reading…" : "CSV / Excel"}
              </button>
            ) : (
              <div className="min-h-10 flex items-center justify-between gap-2 px-3 py-2 border border-slate-200 bg-white rounded-lg">
                <span className="text-[11px] font-medium text-slate-700 truncate inline-flex items-center gap-2 min-w-0">
                  <FileSpreadsheet size={14} className="text-indigo-500 shrink-0" />
                  <span className="truncate">{file.name}</span>
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

          {file && previewRows.length > 0 ? (
            <div className="border border-slate-300 overflow-hidden rounded-none shadow-sm">
              <div className="max-h-[min(52vh,30rem)] overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-300 sticky top-0 z-[1]">
                    <tr className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      <th className="px-2 py-2 w-9 text-center">
                        <input
                          type="checkbox"
                          checked={allImportableSelected}
                          onChange={toggleAllImportable}
                          disabled={!importableRows.length || loading}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label="Select all importable rows"
                        />
                      </th>
                      <th className="px-2 py-2 w-10 text-center">Sr</th>
                      <th className="px-2 py-2">Item Code</th>
                      <th className="px-2 py-2">Description</th>
                      <th className="px-2 py-2 w-20 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => {
                      const importable = isRowImportable(row);
                      const selected = selectedKeys.has(row.key);
                      return (
                        <tr
                          key={row.key}
                          className={`border-b border-slate-100 text-[11px] ${
                            !importable
                              ? "bg-slate-50 text-slate-400"
                              : selected
                                ? "bg-white"
                                : "bg-amber-50/40 text-slate-500"
                          }`}
                        >
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={importable && selected}
                              disabled={!importable || loading}
                              onChange={() => toggleRow(row)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums text-slate-400 font-medium">
                            {index + 1}
                          </td>
                          <td className="px-2 py-1.5 font-bold uppercase whitespace-nowrap text-slate-800">
                            {row.item_code || row.itemcode || "—"}
                          </td>
                          <td
                            className="px-2 py-1.5 truncate max-w-[200px] text-slate-500 italic"
                            title={row.error || row.item_desc || ""}
                          >
                            {row.error || row.item_desc || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right font-black tabular-nums text-slate-700">
                            {row.qty}
                          </td>
                        </tr>
                      );
                    })}
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
