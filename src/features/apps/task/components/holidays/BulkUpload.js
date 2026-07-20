"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Trash2, Send, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { holidayService } from "@/features/apps/task/services/holidayApi";

export default function HolidayBulkUpload({ onSuccess, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const reset = () => {
    setFile(null);
    setPreviewData([]);
  };

  const setDrawerOpen = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const close = () => {
    setDrawerOpen(false);
    reset();
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, {
        raw: false,
        dateNF: "yyyy-mm-dd",
      });
      setPreviewData(data);
    };

    reader.readAsBinaryString(selectedFile);
    e.target.value = "";
  };

  const handleFinalUpload = async () => {
    if (!file || previewData.length === 0) return;
    setLoading(true);
    try {
      await holidayService.bulkUpload(file);
      toast.success(`${previewData.length} Holidays uploaded successfully!`);
      onSuccess?.();
      close();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setDrawerOpen(true);
        }}
        className="h-9 shrink-0 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider"
      >
        <Upload size={14} /> Bulk Upload
      </button>

      <Drawer
        isOpen={open}
        onClose={close}
        onSubmit={file && previewData.length > 0 ? handleFinalUpload : undefined}
        closeOnOutside={false}
        title="Bulk Upload Holidays"
        description="Review your data before saving to database"
        headerVariant="form"
        maxWidth="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            {file && (
              <button
                type="button"
                onClick={handleFinalUpload}
                disabled={loading || previewData.length === 0}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 inline-flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Send size={14} /> Confirm & Submit
                  </>
                )}
              </button>
            )}
          </>
        }
      >
        {!file ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 p-10 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4 text-indigo-600">
              <Upload size={26} />
            </div>
            <p className="text-sm font-semibold text-slate-700">Click to upload CSV or Excel</p>
            <p className="text-xs text-slate-400 mt-1">Make sure it has &apos;name&apos; and &apos;date&apos; columns</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 border border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="text-indigo-600 shrink-0" size={18} />
                <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
              </div>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider shrink-0"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>

            <div className="border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-[10px] uppercase tracking-wider">#</th>
                    <th className="px-3 py-2 text-[10px] uppercase tracking-wider">Holiday Name</th>
                    <th className="px-3 py-2 text-[10px] uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.length > 0 ? (
                    previewData.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-700">{row.name || row.Name || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{row.date || row.Date || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-3 py-8 text-center text-slate-400 italic">
                        No data found in file
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-400">
              {previewData.length} row(s) · Ctrl+S to submit · Esc to close
            </p>
          </div>
        )}
      </Drawer>
    </>
  );
}
