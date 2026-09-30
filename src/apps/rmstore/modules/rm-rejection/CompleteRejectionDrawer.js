"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";
import { fetchBillOptions, getBillByNo } from "@/apps/rmstore/lib/utils/rejectionBillOptions";
import { billDropdownOptionClasses } from "@/apps/rmstore/lib/utils/rejectionBillColors";
import { isRmstoreSuperAdmin } from "@/apps/rmstore/lib/utils/rmstoreSpecialPermissions";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { LIST_PAGE_SEARCH_LABEL_CLASS } from "@/ui/common/list/ListPageSearchField";
import { selectRole, selectUser } from "@/platform/store/slices/authSlice";

/** ISO / IMS date → `YYYY-MM-DD` for save. */
function toDateInputValue(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Display under bill in dropdown: `16-09-2026`. */
function toBillDtLabel(raw) {
  const iso = toDateInputValue(raw);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function withBillMeta(row) {
  if (!row) return row;
  const bill_dt = toDateInputValue(row.bill_dt ?? row.billdt) || row.bill_dt || null;
  const status = String(row.status ?? "").trim() || null;
  return {
    ...row,
    bill_dt,
    billdt: bill_dt,
    bill_dt_label: toBillDtLabel(bill_dt) || null,
    status,
    is_green: row.is_green === true || String(status || "").toLowerCase() === "green",
  };
}

/**
 * Pending Awaiting Bill → bill + remark → Register.
 * Super admin: all invfnote salecat=2 bills.
 * Normal user: only vendor/item match (acc_code + item_code/dcode).
 */
export default function CompleteRejectionDrawer({ open, onClose, onSuccess, row }) {
  const rejectId = row?.qc_reject_uid;
  const role = useSelector(selectRole);
  const currentUser = useSelector(selectUser);
  const isSuperAdmin = useMemo(
    () => isRmstoreSuperAdmin(currentUser, role) || String(role || "").toLowerCase() === "super_admin",
    [currentUser, role]
  );

  const [saving, setSaving] = useState(false);
  const [billNo, setBillNo] = useState(null);
  const [billDt, setBillDt] = useState("");
  const [remark, setRemark] = useState("");

  const supplierName = useMemo(
    () =>
      String(row?.vendor_acc_name || row?.acc_name || row?.matched_bill_acc_name || "").trim() || null,
    [row?.vendor_acc_name, row?.acc_name, row?.matched_bill_acc_name]
  );

  const matchFilters = useMemo(() => {
    const itemFromCodes = String(row?.item_codes ?? row?.item_code ?? "")
      .split(/[,|]+/)
      .map((s) => s.trim())
      .find(Boolean);
    return {
      acc_code: row?.vendor_acc_code ?? row?.acc_code ?? null,
      item_code: row?.match_item_code || itemFromCodes || null,
      item_dcode: row?.match_item_dcode ?? row?.item_dcode ?? null,
    };
  }, [
    row?.vendor_acc_code,
    row?.acc_code,
    row?.match_item_code,
    row?.item_codes,
    row?.item_code,
    row?.match_item_dcode,
    row?.item_dcode,
  ]);

  /** Super admin → no vendor/item filter. Normal → match filters only. */
  const billFilters = useMemo(
    () => (isSuperAdmin ? {} : matchFilters),
    [isSuperAdmin, matchFilters]
  );

  useEffect(() => {
    if (!open) return;
    const matchedNo = String(row?.matched_bill_no || "").trim() || null;
    setBillNo(matchedNo);
    setBillDt(matchedNo ? toDateInputValue(row?.matched_bill_dt) : "");
    setRemark(String(row?.remarks || "").trim());
  }, [open, rejectId, row?.matched_bill_no, row?.matched_bill_dt, row?.remarks]);

  const loadBills = useCallback(
    async (params) => {
      const res = await fetchBillOptions({ ...params, ...billFilters });
      const data = (Array.isArray(res?.data) ? res.data : []).map(withBillMeta);
      return { data, total: Number(res?.total) || data.length };
    },
    [billFilters]
  );

  const loadBillByNo = useCallback(
    async (id) => {
      const res = await getBillByNo(id, billFilters);
      let data = withBillMeta(res?.data);
      if (data && String(id || "").trim() === String(row?.matched_bill_no || "").trim()) {
        data = withBillMeta({
          ...data,
          bill_dt: data.bill_dt || row?.matched_bill_dt || null,
          status: data.status || row?.matched_bill_status || "Green",
          is_green: true,
        });
      }
      return { data };
    },
    [billFilters, row?.matched_bill_no, row?.matched_bill_dt, row?.matched_bill_status]
  );

  const handleSave = async () => {
    if (saving || !rejectId) return;
    const no = String(billNo ?? "").trim();
    if (!no) {
      toast.error("Select a bill number.");
      return;
    }
    if (!String(billDt || "").trim()) {
      toast.error("Bill date is missing on this bill. Pick another bill.");
      return;
    }

    setSaving(true);
    try {
      await rmRejectionService.completeBill({
        qc_reject_uid: rejectId,
        bill_no: no,
        bill_dt: billDt,
        remarks: String(remark || "").trim() || null,
      });
      toast.success("Bill saved. Moved to Register.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not complete rejection.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <RmStoreDrawerFooter
      onClose={onClose}
      loading={saving}
      disabled={!rejectId}
      onSave={handleSave}
      saveLabel="Save"
      loadingLabel="Saving…"
    />
  );

  const filterHint = isSuperAdmin
    ? "All bills (super admin)"
    : [matchFilters.acc_code && `Acc ${matchFilters.acc_code}`, matchFilters.item_code || matchFilters.item_dcode]
        .filter(Boolean)
        .join(" · ");

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={!saving ? () => void handleSave() : undefined}
      title={`Complete · REJECT-${rejectId ?? "—"}`}
      description={filterHint ? `Select bill · ${filterHint}` : "Select bill"}
      footer={footer}
      maxWidth="max-w-lg"
      bodyScrollable
    >
      <div className="space-y-3 pb-2" data-compact-form-bar>
        {supplierName ? (
          <div>
            <span className={`${LIST_PAGE_SEARCH_LABEL_CLASS} block mb-1`}>Supplier</span>
            <p className="text-[13px] font-semibold text-slate-800 break-words">{supplierName}</p>
          </div>
        ) : null}

        <div>
          <span className={`${LIST_PAGE_SEARCH_LABEL_CLASS} block mb-1.5`}>Bill</span>
          <SearchableSelect
            variant="toolbar"
            heightClass="h-9"
            value={billNo}
            onChange={(v, opt) => {
              if (opt && opt.is_green === false) {
                toast.error("This bill cannot be assigned. Choose a Green bill.");
                return;
              }
              setBillNo(v || null);
              setBillDt(v ? toDateInputValue(opt?.bill_dt ?? opt?.billdt) : "");
            }}
            fetchService={loadBills}
            getByIdService={loadBillByNo}
            dataKey="bill_no"
            labelKey="bill_no"
            subLabelKey="bill_dt_label"
            labelOnlyDisplay
            placeholder={isSuperAdmin ? "Select bill…" : "Select matched bill…"}
            emptyMessage={
              isSuperAdmin ? "No bills found" : "No matching bills for this supplier/item"
            }
            isOptionDisabled={(item) => item?.is_green !== true}
            getOptionClassName={billDropdownOptionClasses}
            usePortal
          />
        </div>

        <FormTextarea
          label="Remark"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={4}
          placeholder="Remark…"
        />
      </div>
    </Drawer>
  );
}
