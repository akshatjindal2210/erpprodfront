"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Check, FileText, Loader2, Package, QrCode, ScanLine, X } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import ScanEnterInput from "@/ui/common/scan/ScanEnterInput";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import { FORM_LABEL_CLASS, OK_INPUT } from "@/ui/common/Constants";
import { gateEntryService } from "@/apps/ims/lib/services/gateEntry";
import { normalizeBillScanInput } from "@/apps/ims/lib/helpers/qrScan";
import { isImsSuperAdmin } from "@/apps/ims/lib/utils/imsSpecialPermissions";
import { selectUser } from "@/platform/store/slices/authSlice";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { SCAN_SNACK_MSG } from "@/platform/utils/global";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

const GATE_BILL_SCANNER_ID = "gate-entry-bill-qr-reader";

function Field({ label, value, onChange, readOnly, placeholder }) {
  return (
    <div className="min-w-0 space-y-1">
      <label className={FORM_LABEL_CLASS}>{label}</label>
      <input
        className={`${OK_INPUT} text-sm w-full disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-slate-200`}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        disabled={readOnly}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Item wise — section heading above table; S.No/Item/Desc/Qty are table column headers. */
function MiniTable({ title, columns, rows, emptyText = "No lines", totalQty }) {
  const qtyColIdx = columns.findIndex(([, key]) => key === "qty");
  const rowCount = rows?.length || 0;
  const showFooter = rowCount > 0 && totalQty != null && totalQty !== "" && qtyColIdx >= 0;

  const fmtCell = (key, value) => {
    if (value == null || value === "" || value === "—") return "—";
    if (key === "qty") {
      const n = Number(String(value).replace(/,/g, "").trim());
      return Number.isFinite(n) ? n.toLocaleString() : value;
    }
    return value;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{title}</h4>
        {/* Top Total Qty / row count — not needed; footer has Total Qty + value
        <div className="flex items-center gap-3 shrink-0 text-[10px] font-bold text-slate-400">
          {totalQty != null && totalQty !== "" ? (
            <span>
              Total Qty{" "}
              <span className="text-slate-600 tabular-nums">
                {Number(String(totalQty).replace(/,/g, "")).toLocaleString()}
              </span>
            </span>
          ) : null}
          <span className="tabular-nums">{rowCount}</span>
        </div>
        */}
      </div>
      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
        <div className={`overflow-auto ${rowCount > 10 ? "max-h-[23.75rem]" : ""}`}>
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
              <tr>
                {columns.map(([label, key]) => (
                  <th
                    key={label}
                    className={`px-3 py-2.5 font-bold text-slate-600 uppercase whitespace-nowrap tracking-wide ${
                      key === "qty" ? "text-right" : ""
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowCount === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/80">
                    {columns.map(([, key, fmt]) => (
                      <td
                        key={key}
                        className={`px-3 py-2 text-slate-700 ${
                          key === "item_desc" ? "whitespace-normal" : "whitespace-nowrap"
                        } ${key === "qty" ? "text-right tabular-nums font-semibold" : ""}`}
                      >
                        {fmt ? fmt(row?.[key], row) : fmtCell(key, row?.[key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {showFooter ? (
              <tfoot className="bg-white border-t border-slate-200 sticky bottom-0">
                <tr>
                  {qtyColIdx > 1 ? (
                    <td colSpan={qtyColIdx - 1} className="px-3 py-2.5" />
                  ) : null}
                  {qtyColIdx > 0 ? (
                    <td className="px-3 py-2.5 text-right font-bold text-slate-600 uppercase text-[10px] tracking-wide whitespace-nowrap">
                      Total Qty
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5 font-bold text-indigo-600 tabular-nums text-right whitespace-nowrap">
                    {Number(String(totalQty).replace(/,/g, "")).toLocaleString()}
                  </td>
                  {qtyColIdx < columns.length - 1 ? (
                    <td colSpan={columns.length - qtyColIdx - 1} className="px-3 py-2.5" />
                  ) : null}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}

export default function GateEntryModal({ open, mode = "add", initial = null, onClose, onSaved }) {
  const readOnlyView = mode === "view";
  const user = useSelector(selectUser);
  const canAccess = useCanAccess();
  const canEditGate = isImsSuperAdmin(user) || Boolean(canAccess("gate_entry", "edit").allowed);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState(null);
  const [transporter, setTransporter] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [laserKey, setLaserKey] = useState(0);
  const [addEntryStamp, setAddEntryStamp] = useState(null);

  const autoDoneRef = useRef(false);
  const scanBusyRef = useRef(false);
  const scanInputRef = useRef(null);
  const openBillRef = useRef(async () => {});

  const { laserScan, keyboardType, phoneQrScan } = useDeviceScanSettings();
  const showLaserUi = laserScan || isLaserScanEnabled();
  const showKeyboardUi = keyboardType === true;
  /** Bill QR: overlay allows desktop webcam (gate PC), so honor Phone QR even off-phone. */
  const showCameraQr = phoneQrScan === true;

  const applyPayload = useCallback((data) => {
    setPayload(data || null);
    setTransporter(data?.transporter_name || data?.transport || data?.invmnote?.transport || data?.invmnote?.transporter_name || "");
    setVehicle(data?.vehicle_number || data?.vehicleno || data?.invmnote?.vehicleno || data?.invmnote?.vehicle_number || "");
    setRemarks(data?.remarks || "");
  }, []);

  const clearBill = useCallback(() => {
    applyPayload(null);
    setAddEntryStamp(null);
    setLaserKey((k) => k + 1);
    scanBusyRef.current = false;
    setLoading(false);
  }, [applyPayload]);

  const openFromScanOrBill = useCallback(
    async (raw) => {
      const text = normalizeBillScanInput(raw);
      if (!text) {
        toast.error("Bill number or QR is required.");
        return;
      }
      if (scanBusyRef.current) return;
      scanBusyRef.current = true;
      setLoading(true);
      try {
        const res = await gateEntryService.openBill(text);
        if (!res?.success) throw new Error(res?.message || "Failed to load bill.");
        const data = res.data;
        const hasIms =
          Boolean(data?.invmnote) ||
          (Array.isArray(data?.invfnote) && data.invfnote.length > 0) ||
          Boolean(data?.already_saved);
        if (!hasIms || data?.ims_missing) {
          throw new Error(res?.message || "Bill details not found. Scan a valid bill QR or type the correct bill number.");
        }
        applyPayload(data);
        if (data?.already_saved && mode === "add") {
          toast.info("This bill is already saved.");
        } else {
          toast.success(`Bill ${data?.bill_no || ""} loaded.`);
        }
      } catch (err) {
        toast.error(err?.message || "Failed to load bill.");
      } finally {
        scanBusyRef.current = false;
        setLoading(false);
        setLaserKey((k) => k + 1);
      }
    },
    [applyPayload, mode]
  );

  openBillRef.current = openFromScanOrBill;

  useEffect(() => {
    if (!open) {
      applyPayload(null);
      setIsScannerOpen(false);
      setAddEntryStamp(null);
      autoDoneRef.current = false;
      scanBusyRef.current = false;
      return;
    }
    if (initial?.uid) {
      setLoading(true);
      gateEntryService
        .getDetails({ uid: initial.uid })
        .then((res) => {
          if (!res?.success) throw new Error(res?.message || "Failed to load.");
          applyPayload(res.data);
        })
        .catch((err) => toast.error(err?.message || "Failed to load."))
        .finally(() => setLoading(false));
      return;
    }
    const bill = initial?.bill_no || initial?.billno;
    if (bill && !autoDoneRef.current) {
      autoDoneRef.current = true;
      void openBillRef.current(bill);
    }
  }, [open, initial, applyPayload]);

  useEffect(() => {
    if (!open || mode !== "add" || initial?.uid) return;
    setAddEntryStamp((prev) => prev ?? new Date());
  }, [open, mode, initial?.uid]);

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen,
    elementId: GATE_BILL_SCANNER_ID,
    onDecoded: (raw) => {
      setIsScannerOpen(false);
      void openBillRef.current(raw);
    },
    fps: 15,
    qrbox: { width: 280, height: 280 },
    onCameraFailed: (err) => {
      const isDenied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      toast.error(isDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA, { autoClose: 4000 });
      setIsScannerOpen(false);
    },
  });

  const handleScanEnter = useCallback((code) => {
    void openBillRef.current(code);
  }, []);

  const openCameraQr = useCallback(async () => {
    const prep = await prepareQrScanSession();
    if (!prep.cameraOk) {
      toast.error(prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA, {
        autoClose: 4000,
      });
      return;
    }
    setIsScannerOpen(true);
  }, []);

  const invmnote = payload?.invmnote || null;
  const invfnote = Array.isArray(payload?.invfnote) ? payload.invfnote : [];

  /** Merge packing lines → one row per item, Item code ASC. */
  const itemWiseRows = useMemo(() => {
    const map = new Map();

    const readQty = (row) => {
      const v = row?.qty;
      if (v == null || v === "") return NaN;
      const n = Number(String(v).replace(/,/g, "").trim());
      return Number.isFinite(n) ? n : NaN;
    };

    for (const row of invfnote) {
      const code = String(row?.item_code || "").trim() || "—";
      const key = code.toLowerCase();
      const qtyNum = readQty(row);

      if (!map.has(key)) {
        map.set(key, {
          item_code: code,
          item_desc: String(row?.item_desc || "").trim() || "—",
          qty_sum: Number.isFinite(qtyNum) ? qtyNum : 0,
          has_qty: Number.isFinite(qtyNum),
        });
      } else {
        const cur = map.get(key);
        if (Number.isFinite(qtyNum)) {
          cur.qty_sum += qtyNum;
          cur.has_qty = true;
        }
        if (cur.item_desc === "—" && row?.item_desc) cur.item_desc = String(row.item_desc).trim();
      }
    }

    return [...map.values()]
      .sort((a, b) => String(a.item_code).localeCompare(String(b.item_code), undefined, { sensitivity: "base" }))
      .map((r, i) => {
        let qty = r.has_qty ? r.qty_sum : "—";
        if (qty === "—" && map.size === 1) {
          const billQty = invmnote?.totalqty ?? invmnote?.total_qty;
          if (billQty != null && billQty !== "") qty = billQty;
        }
        return { sno: i + 1, item_code: r.item_code, item_desc: r.item_desc, qty };
      });
  }, [invfnote, invmnote]);

  const itemListTotalQty = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const r of itemWiseRows) {
      if (r.qty === "—") continue;
      const n = Number(String(r.qty).replace(/,/g, "").trim());
      if (Number.isFinite(n)) {
        sum += n;
        any = true;
      }
    }
    if (any) return sum;
    const bill = invmnote?.totalqty ?? invmnote?.total_qty;
    if (bill != null && bill !== "") return bill;
    return null;
  }, [itemWiseRows, invmnote]);

  const gateUid = payload?.gate?.uid ?? payload?.uid ?? initial?.uid ?? null;
  const isExistingGate = Boolean(gateUid) || Boolean(payload?.already_saved);
  /** New gate: create when bill loaded and not yet saved. */
  const canCreateNew = Boolean(payload?.bill_no) && !payload?.already_saved && !gateUid && !readOnlyView;
  /** Existing gate: edit only when opened via Edit action (row select + Edit). Scan/New stays view-only. */
  const canEditMeta = Boolean(gateUid) && canEditGate && mode === "edit";
  const canSubmit = canCreateNew || canEditMeta;
  const fieldsEditable = canCreateNew || canEditMeta;
  /** Scan only until a bill is loaded — then hide (use Clear to scan again). */
  const showScanBar = !readOnlyView && !payload?.bill_no;

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      if (canEditMeta && gateUid) {
        const res = await gateEntryService.update({
          uid: Number(gateUid),
          transporter_name: transporter,
          vehicle_number: vehicle,
          remarks,
        });
        if (!res?.success) throw new Error(res?.message || "Failed to update gate entry.");
        toast.success(res.message || "Gate entry updated successfully.");
        onSaved?.(res.data);
        onClose?.();
        return;
      }
      const res = await gateEntryService.save({
        bill_no: payload.bill_no,
        bill_dt: payload.bill_dt || invmnote?.billdt || null,
        transporter_name: transporter,
        vehicle_number: vehicle,
        remarks,
      });
      if (!res?.success) throw new Error(res?.message || "Failed to save gate entry.");
      toast.success(res.message || "Gate entry saved successfully.");
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || (canEditMeta ? "Failed to update gate entry." : "Failed to save gate entry."));
    } finally {
      setSaving(false);
    }
  };

  const billSummaryFields = useMemo(
    () => [
      { label: "Boxes", value: invmnote?.boxes ?? "" },
      { label: "Qty", value: invmnote?.totalqty ?? "" },
      { label: "Items", value: invmnote?.total_item_count ?? "" },
    ],
    [invmnote]
  );

  const itemCols = useMemo(
    () => [
      ["S.No", "sno"],
      ["Item", "item_code"],
      ["Desc", "item_desc"],
      ["Qty", "qty"],
    ],
    []
  );

  const gateOutId = gateUid != null && String(gateUid).trim() !== "" ? `${String(payload?.gate?.type || payload?.type || "out").toLowerCase() === "in" ? "IN" : "OUT"}-${String(gateUid).trim()}` : null;

  const billDateDisplay = payload?.bill_dt || invmnote?.billdt || "—";
  const showAddInfo = mode === "add" && canCreateNew;
  const addUserDisplay = user?.name || user?.username || "—";

  const title = isExistingGate
    ? canEditMeta
      ? gateOutId
        ? `Edit Gate Entry · ${gateOutId}`
        : "Edit Gate Entry"
      : gateOutId
        ? `View Gate Entry · ${gateOutId}`
        : "View Gate Entry"
    : "Gate Entry";

  const footer = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
      {showAddInfo ? (
        <p className="text-[11px] sm:text-xs text-slate-500 order-2 sm:order-1">
          <span className="font-semibold text-slate-600 tabular-nums">
            {formatDateTime(addEntryStamp ?? new Date())}
          </span>
          {" · "}
          <span className="font-semibold text-slate-600">{addUserDisplay}</span>
        </p>
      ) : (
        <span className="hidden sm:block flex-1" aria-hidden="true" />
      )}
      <div className="flex items-center justify-end gap-3 order-1 sm:order-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-bold text-slate-500"
        >
          Close
        </button>
        {canSubmit ? (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || loading || !canSubmit}
            className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {saving
              ? canEditMeta
                ? "Updating…"
                : "Saving…"
              : canEditMeta
                ? "Update"
                : "Save"}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={onClose}
        onSubmit={canSubmit ? () => void handleSubmit() : undefined}
        title={title}
        footer={footer}
        maxWidth="max-w-4xl"
        headerVariant="form"
      >
        <div className="space-y-5 pb-6">
          {/* Scan bar — same pattern as Box Finder */}
          {showScanBar ? (
            <div className="flex items-end gap-2">
              <div className="relative flex-1 space-y-2 min-w-0">
                <label className="text-xs font-medium text-slate-600 ml-1 block">Bill QR / number</label>
                {showLaserUi ? (
                  <LaserScanField
                    key={laserKey}
                    active={open && showScanBar && showLaserUi && !loading}
                    onScanned={handleScanEnter}
                    keyboardInputRef={scanInputRef}
                    requireArmButton={false}
                  />
                ) : null}
                {showKeyboardUi ? (
                  <div className="relative">
                    <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 z-10" />
                    <ScanEnterInput
                      ref={scanInputRef}
                      placeholder={getScanInputPlaceholder() || "Scan / paste QR or bill no + Enter"}
                      onEnter={handleScanEnter}
                      className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                ) : null}
                {!showLaserUi && !showKeyboardUi && !showCameraQr ? (
                  <p className="text-xs text-slate-500 px-1">Enable Laser scanner, Keyboard type, or Phone QR in Device Settings.</p>
                ) : null}
              </div>

              {showCameraQr ? (
                <button
                  type="button"
                  onClick={() => void openCameraQr()}
                  disabled={loading || isScannerOpen}
                  className="w-12 h-11 flex items-center justify-center rounded-xl border bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60"
                  title="Scan QR"
                >
                  <QrCode size={20} />
                </button>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={32} />
              <p className="text-xs font-medium text-slate-500">Loading bill details…</p>
            </div>
          ) : payload?.bill_no ? (
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/60">
                <div className="flex items-start gap-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm bg-indigo-600 text-white">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium leading-none text-indigo-500">Bill number</p>
                        <p className="text-lg sm:text-xl font-bold font-mono leading-tight text-indigo-950 mt-1 break-all">
                          {payload.bill_no}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium leading-none text-indigo-500">Bill date</p>
                        <p className="text-lg sm:text-xl font-bold font-mono leading-tight text-indigo-950 mt-1 tabular-nums">
                          {billDateDisplay}
                        </p>
                      </div>
                    </div>
                    {gateOutId ? (
                      <p className="text-[11px] mt-1.5 font-mono font-semibold uppercase tracking-tight text-indigo-700/80">
                        {gateOutId}
                      </p>
                    ) : null}
                  </div>
                  {showScanBar ? (
                    <button
                      type="button"
                      onClick={clearBill}
                      className="shrink-0 text-indigo-400 hover:text-indigo-700 p-1"
                      title="Clear & scan again"
                    >
                      <X size={16} />
                    </button>
                  ) : !readOnlyView && mode === "add" ? (
                    <button
                      type="button"
                      onClick={clearBill}
                      className="shrink-0 text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-800 px-1.5"
                      title="Clear & scan again"
                    >
                      Rescan
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Bill details</h4>
                <Field label="Customer" value={invmnote?.acc_name || "—"} readOnly />
                <div className="grid grid-cols-3 gap-3">
                  {billSummaryFields.map(({ label, value }) => (
                    <Field key={label} label={label} value={value || "—"} readOnly />
                  ))}
                </div>
              </div>

              <MiniTable
                title="Item wise"
                columns={itemCols}
                rows={itemWiseRows}
                emptyText="No items"
                totalQty={itemListTotalQty}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Transporter"
                  value={transporter}
                  onChange={setTransporter}
                  readOnly={!fieldsEditable}
                  placeholder="Enter transporter"
                />
                <Field
                  label="Vehicle No"
                  value={vehicle}
                  onChange={setVehicle}
                  readOnly={!fieldsEditable}
                  placeholder="Enter vehicle number"
                />
              </div>

              <FormTextarea
                label="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={!fieldsEditable}
                rows={2}
                placeholder="Optional remarks"
              />
            </div>
          ) : (
            !isScannerOpen && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <Package size={24} className="text-slate-200" />
                </div>
                <p className="text-sm font-medium text-slate-500">
                  Scan or paste the invoice QR to load bill details.
                </p>
              </div>
            )
          )}
        </div>
      </Drawer>

      <QrScannerOverlay
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        readerId={GATE_BILL_SCANNER_ID}
        torchSupported={torchSupported}
        torchOn={torchOn}
        onToggleTorch={toggleTorch}
        allowDesktop
        hint="Point camera at bill QR"
      />
    </>
  );
}
