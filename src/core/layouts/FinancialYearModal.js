"use client";

import { useState, useEffect } from "react";
import { Calendar, Check, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import GlobalDetailModal from "@/core/components/common/GlobalDetailModal";
import { CONFIG_LABEL, CONFIG_SELECT } from "@/features/admin/configuration/components/AppConfigFormFields";
import { masterService } from "@/features/apps/ims/services/master";
import { getSelectedFinancialYear, setSelectedFinancialYear } from "@/features/apps/ims/helpers/financialYear";

export default function FinancialYearModal({ open, onClose, onSaveSuccess }) {
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedFy, setSelectedFy] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFinancialYears();
    }
  }, [open]);

  const fetchFinancialYears = async () => {
    setLoading(true);
    try {
      const response = await masterService.getFinancialYears();

      if (!response?.success) {
        throw new Error(response?.message || "Failed to fetch financial years");
      }

      const years = Array.isArray(response.data) ? response.data : [];
      setFinancialYears(years);

      // Default Selection Logic
      const { id: storedFyId } = getSelectedFinancialYear();
      if (storedFyId && years.some(y => String(y.fyid) === String(storedFyId))) {
        setSelectedFy(storedFyId);
      } else if (years.length > 0) {
        // Auto-select the LAST fyid from the API response (highest fyid)
        const lastFy = years[years.length - 1];
        setSelectedFy(String(lastFy.fyid));
      }
    } catch (error) {
      console.error("Error fetching financial years:", error);
      toast.error("Failed to load financial years");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (e) => {
    if (e) e.preventDefault();
    if (!selectedFy) {
      toast.error("Please select a financial year");
      return;
    }

    setSaving(true);
    try {
      const fy = financialYears.find(y => String(y.fyid) === String(selectedFy));
      if (fy) {
        setSelectedFinancialYear(fy.fyid, fy.fyname);
        
        toast.success(`Financial Year changed to ${fy.fyname}`);
        if (onSaveSuccess) onSaveSuccess(fy.fyname);
        onClose();
      }
    } catch (error) {
      console.error("Error saving financial year:", error);
      toast.error("Failed to save financial year");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlobalDetailModal
      open={open}
      onClose={onClose}
      title="Select Financial Year"
      icon={Calendar}
      footer={null}
      size="narrow"
    >
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-2">
          <label className={CONFIG_LABEL}>
            Active Financial Year <span className="text-rose-500">*</span>
          </label>
          
          {loading ? (
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest py-4 bg-slate-50 rounded-xl justify-center border border-dashed border-slate-200">
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              Syncing Years...
            </div>
          ) : (
            <select
              value={selectedFy}
              onChange={(e) => setSelectedFy(e.target.value)}
              className={CONFIG_SELECT}
              disabled={financialYears.length === 0 || saving}
            >
              <option value="" disabled>-- Choose Year --</option>
              {financialYears.map((fy) => (
                <option key={fy.fyid} value={String(fy.fyid)}>
                  {fy.fyname}
                </option>
              ))}
            </select>
          )}
          
          <p className="text-[10px] text-slate-400 italic ml-1">
            Changing this will update your current session's active year.
          </p>
        </div>

        <div className="pt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3.5 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading || financialYears.length === 0}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={3} />
                Confirm Selection
              </>
            )}
          </button>
        </div>
      </form>
    </GlobalDetailModal>
  );
}
