// Pehle install karein: npm install xlsx
import { useRef, useState } from "react";
import { Upload, X, FileText, CheckCircle2, AlertCircle, Trash2, Send } from "lucide-react";
import * as XLSX from "xlsx"; 
import { holidayService } from "@/features/apps/task/services/holidayApi";
import { toast } from "react-toastify";

export default function HolidayBulkUpload({ onSuccess }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]); // For Excel data display
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const reset = () => {
    setFile(null);
    setPreviewData([]);
  };

  // 1. File select hote hi frontend par parse karna
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary", cellDates: true }); // cellDates true karein
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      // raw: false and dateNF will show date correctly in preview table
      const data = XLSX.utils.sheet_to_json(ws, { 
        raw: false,
        dateNF: "yyyy-mm-dd" 
      }); 
      setPreviewData(data);
    };

    reader.readAsBinaryString(selectedFile);
    e.target.value = ""; 
  };

  // 2. Final API Call (Confirm hone par)
  const handleFinalUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      await holidayService.bulkUpload(file);
      toast.success(`${previewData.length} Holidays uploaded successfully!`);
      if (onSuccess) onSuccess();
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-xl transition-all">
        <Upload size={15} /> Bulk Upload
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Bulk Upload Holidays</h3>
                <p className="text-xs text-slate-500">Review your data before saving to database</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {!file ? (
                /* Step 1: Upload Box */
                <div 
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-all">
                  <input ref={fileRef} type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileChange} />
                  <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500">
                    <Upload size={30} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Click to upload CSV or Excel</p>
                  <p className="text-xs text-slate-400 mt-1">Make sure it has 'name' and 'date' columns</p>
                </div>
              ) : (
                /* Step 2: Table Preview */
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-orange-50 p-3 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-3">
                      <FileText className="text-orange-600" size={18} />
                      <span className="text-sm font-medium text-slate-700">{file.name}</span>
                    </div>
                    <button onClick={reset} className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider">
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Holiday Name</th>
                          <th className="px-4 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {previewData.length > 0 ? (
                          previewData.map((row, index) => (
                            <tr key={index} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                              <td className="px-4 py-3 font-medium text-slate-700">{row.name || row.Name || "—"}</td>
                              <td className="px-4 py-3 text-slate-600">{row.date || row.Date || "—"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="px-4 py-10 text-center text-slate-400 italic">No data found in file</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {file ? `Total Rows: ${previewData.length}` : "No file selected"}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setOpen(false)} className="px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                  Cancel
                </button>
                {file && (
                  <button 
                    onClick={handleFinalUpload}
                    disabled={loading || previewData.length === 0}
                    className="px-6 py-2 bg-orange-600 text-white text-sm font-bold rounded-xl hover:bg-orange-700 transition-all flex items-center gap-2 shadow-lg shadow-orange-200 disabled:opacity-50">
                    {loading ? "Saving..." : <><Send size={16} /> Confirm & Submit</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
