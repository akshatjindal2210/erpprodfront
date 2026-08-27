"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle, CheckCircle2, ChevronRight, Loader2, Package, QrCode, ScanLine, Shield, X } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { OK_INPUT } from "@/ui/common/Constants";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import { gateEntryService } from "@/apps/ims/lib/services/gateEntry";
import { parseBoxScanRaw, boxNoUidDisplayLabel } from "@/apps/ims/lib/helpers/qrScan";
import { packingKey } from "@/apps/ims/lib/utils/outEntryFulfillment";
import { isImsSuperAdmin } from "@/apps/ims/lib/utils/imsSpecialPermissions";
import { isForwardingLooseBox } from "@/platform/utils/core/utilHelper";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { SCAN_SNACK_MSG, markRecentScanSuccess, notifyDecodeSuppressedScan, shouldSilenceScanDuplicate, useScanSnackbarActions } from "@/platform/utils/global";
import { prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { useSelector } from "react-redux";
import { selectUser } from "@/platform/store/slices/authSlice";

const GATE_SCANNER_ID = "gate-entry-scanner-reader";
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: 4000 };

function isLoose(box) {
  return isForwardingLooseBox(box);
}

function groupByPacking(boxes = []) {
  const map = new Map();
  for (const box of boxes) {
    const pn = packingKey(box?.packing_number);
    if (!map.has(pn)) map.set(pn, { packing_number: pn, boxes: [], box: 0, loose_box: 0, total_qty: 0 });
    const g = map.get(pn);
    g.boxes.push(box);
    g.total_qty += Number(box?.qty) || 0;
    if (isLoose(box)) g.loose_box += 1;
    else g.box += 1;
  }
  return [...map.values()].sort((a, b) => {
    const na = Number(a.packing_number);
    const nb = Number(b.packing_number);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a.packing_number).localeCompare(String(b.packing_number));
  });
}

export default function GateEntryModal({ open, mode = "add", initial = null, onClose, onSaved }) {
  const isApprove = mode === "approve";
  const isEdit = mode === "edit" || isApprove;

  const [saving, setSaving] = useState(false);
  const [scanningBill, setScanningBill] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [billReady, setBillReady] = useState(false);
  const [invfnote, setInvfnote] = useState([]);
  const [dispatch, setDispatch] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [boxes, setBoxes] = useState([]);
  const [scanned, setScanned] = useState(() => new Set());
  const [activePackingIdx, setActivePackingIdx] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [billInput, setBillInput] = useState("");
  const [manualBoxId, setManualBoxId] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);
  const [laserKey, setLaserKey] = useState(0);

  const scanToastRef = useRef({});
  const recentSuccessRef = useRef(new Map());
  const billReadyRef = useRef(false);
  const cameraHandlerRef = useRef(async () => {});
  const user = useSelector(selectUser);
  const canTypeBox = isImsSuperAdmin(user);
  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);
  const { laserScan, showPhoneQr } = useDeviceScanSettings();
  const closeScanner = useCallback(() => setIsScannerOpen(false), []);

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen,
    elementId: GATE_SCANNER_ID,
    onDecoded: (raw) => void cameraHandlerRef.current(raw),
    onDecodeSuppressed: () => notifyDecodeSuppressedScan(),
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: () => {
      showScanToast("error", "camera-failed", SCAN_SNACK_MSG.CAMERA_DENIED ?? SCAN_SNACK_MSG.CAMERA, 4000);
      setIsScannerOpen(false);
    },
  });

  const readOnly = Boolean(editItem?.approved) && !isApprove;
  const linked = Boolean(editItem?.out_uid) && billReady;

  const reset = useCallback(() => {
    setBillReady(false);
    setBillInput("");
    setManualBoxId("");
    setInvfnote([]);
    setDispatch(null);
    setEditItem(null);
    setRemarks("");
    setBoxes([]);
    setScanned(new Set());
    setActivePackingIdx(0);
    setDetailsOpen(true);
    setSnackbar(INITIAL_SNACK);
    setLaserKey((k) => k + 1);
  }, []);

  const applyDetails = useCallback((details, billHint = {}) => {
    if (!details) return;
    const gate = details.gate || {};
    setEditItem({
      uid: gate.uid || null,
      out_uid: gate.out_uid,
      fuid: gate.fuid,
      bill_no: gate.bill_no || billHint.bill_no || null,
      bill_dt: gate.bill_dt || billHint.bill_dt || null,
      scan_complete: gate.scan_complete,
      approved: gate.approved,
      remarks: gate.remarks || "",
    });
    setRemarks(gate.remarks || "");
    setBoxes(Array.isArray(details.boxes) ? details.boxes : []);
    setScanned(new Set(details.scanned_boxes || []));
    setDispatch(details.dispatch || null);
    if (Array.isArray(details.invfnote)) setInvfnote(details.invfnote);
    setActivePackingIdx(0);
    setBillReady(true);
  }, []);

  const loadDetails = useCallback(
    async (seed) => {
      if (!seed?.uid && !seed?.out_uid && !seed?.bill_no) return;
      setLoadingDetails(true);
      try {
        const res = await gateEntryService.getDetails({
          uid: seed.uid || undefined,
          out_uid: seed.out_uid || undefined,
          bill_no: seed.bill_no || undefined,
        });
        applyDetails(res?.data, { bill_no: seed.bill_no, bill_dt: seed.bill_dt });
      } catch (err) {
        toast.error(err?.message || "Failed to load store-out boxes.");
      } finally {
        setLoadingDetails(false);
      }
    },
    [applyDetails]
  );

  useEffect(() => {
    if (!open) return;
    reset();
    if (isEdit && (initial?.uid || (initial?.out_uid && initial?.bill_no))) {
      setEditItem(initial);
      if (initial.bill_no) setBillReady(true);
      void loadDetails(initial);
    }
  }, [open, initial, isEdit, reset, loadDetails]);

  useEffect(() => {
    billReadyRef.current = billReady;
  }, [billReady]);

  const packingGroups = useMemo(() => groupByPacking(boxes), [boxes]);
  const activeBD = packingGroups[activePackingIdx] || null;
  const requiredIds = useMemo(
    () => boxes.map((b) => String(b.box_no_uid || "").trim()).filter(Boolean),
    [boxes]
  );
  const scannedCount = useMemo(
    () => requiredIds.filter((id) => scanned.has(id)).length,
    [requiredIds, scanned]
  );
  const allScanned = requiredIds.length > 0 && scannedCount === requiredIds.length;
  const requiredTotal = requiredIds.length;

  const packingProgress = useMemo(
    () =>
      packingGroups.map((g) => {
        const required = g.boxes.length;
        const done = g.boxes.filter((b) => scanned.has(String(b.box_no_uid || "").trim())).length;
        return { scanned_total: done, required_total: required, complete: required > 0 && done >= required };
      }),
    [packingGroups, scanned]
  );

  const scannedStats = useMemo(() => {
    if (!activeBD) return { box: 0, loose: 0 };
    let box = 0;
    let loose = 0;
    for (const b of activeBD.boxes) {
      if (!scanned.has(String(b.box_no_uid || "").trim())) continue;
      if (isLoose(b)) loose += 1;
      else box += 1;
    }
    return { box, loose };
  }, [activeBD, scanned]);

  const scannedInActive = useMemo(() => {
    if (!activeBD) return [];
    return activeBD.boxes.filter((b) => scanned.has(String(b.box_no_uid || "").trim()));
  }, [activeBD, scanned]);

  const packingLaserActive = open && linked && !readOnly && !saving && !loadingDetails && Boolean(activeBD);

  const runBillScan = useCallback(
    async (rawIn) => {
      const raw = String(rawIn || "").trim();
      if (!raw) {
        showScanToast("error", "bill-empty", "Enter or scan a bill number.", 2800);
        return;
      }
      setScanningBill(true);
      try {
        const res = await gateEntryService.scan(raw);
        const data = res?.data || null;
        const rows = Array.isArray(data?.invfnote) ? data.invfnote : [];
        setInvfnote(rows);
        setBillInput(String(data?.docNumber || raw));

        if (!data?.pendingOut?.out_uid) {
          showScanToast(
            "error",
            "bill-no-pending",
            rows.length
              ? "Bill found, but no pending store-out matched."
              : "No invfnote match for this bill.",
            4500
          );
          setBillReady(false);
          setBoxes([]);
          return;
        }

        if (data.details) {
          applyDetails(data.details, { bill_no: data.docNumber, bill_dt: data.bill_dt });
          if (Array.isArray(data.invfnote)) setInvfnote(data.invfnote);
        } else {
          setInvfnote(rows);
          await loadDetails({
            uid: data.pendingOut.uid,
            out_uid: data.pendingOut.out_uid,
            fuid: data.pendingOut.fuid,
            bill_no: data.docNumber,
            bill_dt: data.bill_dt,
          });
        }

        showScanSuccess(
          "bill-ok",
          `Bill ${data.docNumber} · ${rows.length} line(s) · OUT-${data.pendingOut.out_uid}`
        );
        setLaserKey((k) => k + 1);
      } catch (err) {
        showScanToast("error", "bill-fail", err?.message || "Bill scan failed.", 4000);
      } finally {
        setScanningBill(false);
      }
    },
    [applyDetails, loadDetails, showScanToast, showScanSuccess]
  );

  const handleBoxRaw = useCallback(
    (raw, source = "laser") => {
      if (!billReady || readOnly || saving) return;
      const code = parseBoxScanRaw(raw) || String(raw || "").trim();
      if (!code) {
        showScanToast("error", "box-empty", SCAN_SNACK_MSG.REJECTED, 1800);
        return;
      }
      if (shouldSilenceScanDuplicate(recentSuccessRef, code)) return;
      if (!requiredIds.includes(code)) {
        showScanToast("error", "box-not-out", `Box ${code} is not on this store-out.`, 3200);
        return;
      }
      setScanned((prev) => {
        if (prev.has(code)) {
          showScanToast("error", "box-dup", SCAN_SNACK_MSG.BOX_DUPLICATE(code), 1200);
          return prev;
        }
        const next = new Set(prev);
        next.add(code);
        markRecentScanSuccess(recentSuccessRef, code);
        showScanSuccess("box-ok", SCAN_SNACK_MSG.BOX_SCANNED_TOTAL(code, next.size));
        const packIdx = packingGroups.findIndex((g) =>
          g.boxes.some((b) => String(b.box_no_uid || "").trim() === code)
        );
        if (packIdx >= 0) setActivePackingIdx(packIdx);
        return next;
      });
      if (source === "camera") closeScanner();
    },
    [billReady, readOnly, saving, requiredIds, packingGroups, showScanToast, showScanSuccess, closeScanner]
  );

  useEffect(() => {
    cameraHandlerRef.current = async (raw) => {
      if (billReadyRef.current) handleBoxRaw(raw, "camera");
      else {
        closeScanner();
        await runBillScan(raw);
      }
    };
  }, [handleBoxRaw, closeScanner, runBillScan]);

  const openPhoneQr = async () => {
    const prep = await prepareQrScanSession();
    if (!prep.cameraOk) {
      showScanToast(
        "error",
        "camera-permission",
        prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
        4000
      );
      return;
    }
    setIsScannerOpen(true);
  };

  const save = async ({ complete = false, approve = false, keepPending = false } = {}) => {
    if (!editItem?.out_uid || !editItem?.bill_no) {
      toast.error("Scan or enter a bill first.");
      return;
    }
    if ((complete || approve) && !keepPending && !allScanned) {
      toast.error(`Scan all boxes first (${scannedCount}/${requiredTotal}).`);
      return;
    }
    setSaving(true);
    try {
      const body = {
        uid: editItem?.uid || undefined,
        bill_no: editItem.bill_no,
        bill_dt: editItem.bill_dt || null,
        remarks,
        packing_numbers: invfnote.map((r) => r.packing_number).filter(Boolean),
        out_uid: editItem.out_uid || undefined,
        scanned_boxes: [...scanned],
        complete: (complete || approve) && !keepPending,
      };
      const saved = await gateEntryService.save(body);
      const gateUid = saved?.data?.gate?.uid || editItem?.uid;
      if (saved?.data) applyDetails(saved.data, body);

      if (approve && !keepPending && gateUid) {
        await gateEntryService.approve(gateUid);
        toast.success("Gate entry approved. Bill saved on forwarding note items.");
        onSaved?.({ approve: true });
        onClose?.();
        return;
      }

      toast.success(
        keepPending ? "Kept as pending." : saved?.message || (complete ? "Scan complete." : "Draft saved.")
      );
      onSaved?.({ approve: false });
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const title = isApprove ? "Approve Gate Entry" : isEdit && editItem?.uid ? "Edit Gate Entry" : "New Gate Entry";
  const scanBtnFill = (showPhoneQr ? 1 : 0) + (laserScan ? 1 : 0) > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={() => {
          if (!saving && !scanningBill) onClose?.();
        }}
        title={title}
        description={
          billReady
            ? `Scan ${requiredTotal} store-out box(es), then submit`
            : "Step 1 — enter or scan the bill"
        }
        maxWidth="max-w-5xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button type="button" onClick={() => onClose?.()} className="px-5 py-2 text-sm font-bold text-slate-500">
              Cancel
            </button>
            {isApprove ? (
              <>
                <button
                  type="button"
                  onClick={() => void save({ keepPending: true })}
                  disabled={saving || loadingDetails || !linked}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-40"
                >
                  Keep Pending
                </button>
                <button
                  type="button"
                  onClick={() => void save({ approve: true })}
                  disabled={saving || loadingDetails || !allScanned}
                  className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-40"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                  Approve
                </button>
              </>
            ) : !readOnly ? (
              <button
                type="button"
                onClick={() => void save({ complete: allScanned })}
                disabled={saving || loadingDetails || !linked || (!allScanned && scannedCount === 0)}
                className="min-w-[140px] px-6 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-lg disabled:bg-slate-300 active:scale-95"
              >
                {saving
                  ? "Saving..."
                  : allScanned
                    ? "Submit"
                    : `Save draft (${scannedCount}/${requiredTotal || "?"})`}
              </button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-3 pb-2">
          <QrScannerOverlay
            open={isScannerOpen}
            onClose={closeScanner}
            readerId={GATE_SCANNER_ID}
            hint={billReady ? "Scanning box sticker" : "Scanning bill / e-invoice"}
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
          />

          {!billReady ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-600">
                <ScanLine size={16} />
                <span className="text-[11px] font-black uppercase tracking-widest">1. Bill</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={billInput}
                  disabled={scanningBill || saving}
                  onChange={(e) => setBillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void runBillScan(billInput);
                    }
                  }}
                  placeholder="Type bill no or e-invoice QR…"
                  className={`${OK_INPUT} flex-1 min-w-0 font-mono text-[11px]`}
                />
                <button
                  type="button"
                  disabled={scanningBill || saving || !String(billInput || "").trim()}
                  onClick={() => void runBillScan(billInput)}
                  className="h-9 px-4 bg-slate-800 text-white text-[10px] font-bold uppercase shrink-0 rounded-lg disabled:opacity-50"
                >
                  {scanningBill ? "…" : "Go"}
                </button>
              </div>
              {(laserScan || showPhoneQr) && (
                <div className="flex items-stretch gap-2">
                  {showPhoneQr ? (
                    <button
                      type="button"
                      onClick={() => void openPhoneQr()}
                      disabled={isScannerOpen || scanningBill}
                      className={`h-9 px-3 bg-indigo-600 text-white rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
                    >
                      <QrCode size={14} />
                      <span className="text-[10px] font-black uppercase">QR</span>
                    </button>
                  ) : null}
                  {laserScan ? (
                    <LaserScanField
                      key={`gate-bill-${laserKey}`}
                      active={open && !scanningBill && !saving}
                      onScanned={(raw) => {
                        setBillInput(String(raw || "").trim());
                        void runBillScan(raw);
                      }}
                      onScanRejected={() => showScanToast("error", "bill-reject", SCAN_SNACK_MSG.REJECTED, 1800)}
                      compact
                      heightClass="h-9"
                      fill={showPhoneQr}
                      armButtonLabel="Scan"
                    />
                  ) : null}
                </div>
              )}
              {scanningBill ? (
                <div className="flex items-center gap-2 text-indigo-600">
                  <Loader2 size={12} className="animate-spin" />
                  <p className="text-[9px] font-bold uppercase">Matching bill…</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {loadingDetails ? <FormPanelLoader label="Loading store-out boxes…" /> : null}

          {billReady && linked ? (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((o) => !o)}
                  className="w-full px-2.5 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-left hover:bg-slate-50 border-b border-slate-100 min-h-[40px]"
                >
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide min-w-0 flex-1">
                    Dispatch details
                  </span>
                  <span className="shrink-0 px-2 py-0.5 text-[8px] font-black uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">
                    {editItem?.bill_no || "—"}
                  </span>
                  <span
                    className={`shrink-0 px-2 py-0.5 text-[8px] font-black uppercase border ${
                      allScanned
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {allScanned ? "Ready to submit" : `${scannedCount}/${requiredTotal} scanned`}
                  </span>
                  <ChevronRight
                    className={`text-slate-400 shrink-0 ml-auto transition-transform ${detailsOpen ? "rotate-90" : ""}`}
                    size={16}
                  />
                </button>
                {detailsOpen ? (
                  <div className="px-2.5 pb-2 pt-2 space-y-2">
                    <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2 text-[11px] leading-snug">
                      <div className="min-w-0">
                        <dt className="text-[8px] font-bold text-slate-400 uppercase">Vehicle</dt>
                        <dd className="font-semibold text-slate-800 break-words">{dispatch?.vehicle_number || "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[8px] font-bold text-slate-400 uppercase">Transporter</dt>
                        <dd className="font-semibold text-slate-800 break-words">{dispatch?.transporter_name || "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[8px] font-bold text-slate-400 uppercase">Customer</dt>
                        <dd className="font-semibold text-slate-800 break-words" title={dispatch?.acc_name || invfnote[0]?.acc_name}>
                          {dispatch?.acc_name || invfnote[0]?.acc_name || "—"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[8px] font-bold text-slate-400 uppercase">PO / Bill</dt>
                        <dd className="font-semibold text-slate-800 break-words">
                          {dispatch?.po_number || editItem?.bill_no || invfnote[0]?.billno || "—"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[8px] font-bold text-slate-400 uppercase">Bill date</dt>
                        <dd className="font-semibold text-slate-800 break-words">
                          {editItem?.bill_dt || invfnote[0]?.billdt || "—"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[8px] font-bold text-slate-400 uppercase">OUT</dt>
                        <dd className="font-semibold text-slate-800">OUT-{editItem?.out_uid || "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[8px] font-bold text-slate-400 uppercase">FUID</dt>
                        <dd className="font-semibold text-slate-800">{editItem?.fuid || "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[8px] font-bold text-slate-400 uppercase">Boxes</dt>
                        <dd className="font-semibold text-slate-800 tabular-nums">{requiredTotal}</dd>
                      </div>
                    </dl>

                    {invfnote.length ? (
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">
                          Invoice lines (live) · {invfnote.length}
                        </p>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                          {invfnote.map((row, idx) => (
                            <div
                              key={`${row.uid || row.muid || idx}`}
                              className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-[10px]"
                            >
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="font-black text-slate-800">{row.item_code || "—"}</span>
                                {row.packing_number ? (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-black uppercase">
                                    Pack #{row.packing_number}
                                  </span>
                                ) : null}
                                {row.boxes ? (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-black uppercase">
                                    {row.boxes}
                                  </span>
                                ) : null}
                                {row.status ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-black uppercase">
                                    {row.status}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-slate-600 font-medium">{row.item_desc || "—"}</p>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500">
                                <span className="truncate">{row.acc_name || "—"}</span>
                                {row.billno ? <span className="font-mono">Bill {row.billno}</span> : null}
                                {row.billdt ? <span>{row.billdt}</span> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-medium">No live invoice lines for this bill.</p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="px-1">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Packing numbers at gate
                  {packingGroups.length > 1 ? (
                    <span className="text-slate-400 font-medium normal-case ml-1">
                      — scan each tab; click any tab to review boxes
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="flex gap-1.5 overflow-x-auto px-0.5 pt-1 pb-2.5 no-scrollbar border-b border-slate-200">
                {packingGroups.map((bd, idx) => {
                  const progress = packingProgress[idx];
                  const isComplete = Boolean(progress?.complete);
                  const isActive = activePackingIdx === idx;
                  return (
                    <button
                      key={String(bd.packing_number ?? idx)}
                      type="button"
                      onClick={() => setActivePackingIdx(idx)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-t-lg text-[10px] font-bold shrink-0 ${
                        isComplete && isActive
                          ? "border-2 bg-emerald-200 border-emerald-600 text-emerald-900"
                          : isComplete
                            ? "border bg-emerald-100 border-emerald-400 text-emerald-800"
                            : isActive
                              ? "out-entry-packing-tab-active shadow-sm"
                              : "border bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      {isComplete ? <CheckCircle size={12} strokeWidth={3} /> : null}
                      <span>#{bd.packing_number}</span>
                      <span className={`tabular-nums text-[9px] font-black ${isActive && !isComplete ? "text-indigo-100" : "text-slate-400"}`}>
                        {progress.scanned_total}/{progress.required_total}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeBD ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="px-2.5 py-1.5 flex items-center gap-2 border-b border-slate-100 min-h-[40px]">
                      <Package size={13} className="text-indigo-500" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Packing</span>
                      <span className="text-[11px] font-semibold tabular-nums">#{activeBD.packing_number}</span>
                      <span className="text-[9px] font-black text-slate-500">
                        {activeBD.boxes.length} boxes · Qty {activeBD.total_qty.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2 flex flex-wrap gap-1">
                      {activeBD.boxes.map((box) => {
                        const uid = String(box.box_no_uid || "").trim();
                        const done = scanned.has(uid);
                        const loose = isLoose(box);
                        return (
                          <div
                            key={uid}
                            title={done ? "Already scanned" : uid}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border flex items-center gap-1 ${
                              done
                                ? "bg-slate-50 text-slate-300 border-slate-100 opacity-70"
                                : loose
                                  ? "bg-amber-50 text-amber-600 border-amber-200"
                                  : "bg-white text-slate-600 border-slate-200"
                            }`}
                          >
                            {boxNoUidDisplayLabel(uid) || uid}
                            {loose ? <span className="text-[7px] bg-amber-200 px-1 rounded-sm">L</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 bg-indigo-50/30 p-2 rounded-lg border border-indigo-100 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <CheckCircle2 size={16} />
                        <span className="text-[11px] font-black uppercase tracking-widest">Your Scanned Progress</span>
                      </div>
                      <div className="flex gap-2">
                        <div
                          className={`px-3 py-1 rounded-lg text-center shadow-sm ${
                            scannedStats.box === activeBD.box
                              ? "bg-emerald-600 text-white"
                              : "bg-white border border-emerald-100 text-emerald-700"
                          }`}
                        >
                          <p className="text-[7px] font-bold uppercase opacity-80">Full Boxes</p>
                          <p className="text-xs font-black">
                            {scannedStats.box} / {activeBD.box}
                          </p>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-lg text-center shadow-sm ${
                            scannedStats.loose === activeBD.loose_box
                              ? "bg-amber-500 text-white"
                              : "bg-white border border-amber-100 text-amber-700"
                          }`}
                        >
                          <p className="text-[7px] font-bold uppercase opacity-80">Loose Boxes</p>
                          <p className="text-xs font-black">
                            {scannedStats.loose} / {activeBD.loose_box}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!readOnly ? (
                      <div className="space-y-2 p-1.5 bg-white border border-indigo-100 rounded-lg">
                        {showPhoneQr || laserScan ? (
                          <div className="flex items-stretch gap-2">
                            {showPhoneQr ? (
                              <button
                                type="button"
                                onClick={() => void openPhoneQr()}
                                disabled={isScannerOpen}
                                className={`h-9 px-3 bg-indigo-600 border border-indigo-700 text-white rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
                              >
                                <QrCode size={14} />
                                <span className="text-[10px] font-black uppercase">QR</span>
                              </button>
                            ) : null}
                            {laserScan ? (
                              <LaserScanField
                                key={`gate-box-${laserKey}-${activePackingIdx}`}
                                active={packingLaserActive}
                                onScanned={(raw) => handleBoxRaw(raw, "laser")}
                                onScanRejected={() =>
                                  showScanToast("error", "laser-reject", SCAN_SNACK_MSG.REJECTED, 1800)
                                }
                                formatPreview={boxNoUidDisplayLabel}
                                compact
                                heightClass="h-9"
                                fill={showPhoneQr}
                                armButtonLabel="Scan"
                              />
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-[9px] font-bold uppercase text-indigo-600 px-1">
                            Scan-only mode: scanned boxes appear in the list below
                          </p>
                        )}

                        {canTypeBox ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={manualBoxId}
                              onChange={(e) => setManualBoxId(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleBoxRaw(manualBoxId, "manual");
                                  setManualBoxId("");
                                }
                              }}
                              placeholder="Type box_no_uid for testing..."
                              className="w-full pl-3 pr-3 py-3 text-xs font-mono border-2 border-indigo-100 rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleBoxRaw(manualBoxId, "manual");
                                setManualBoxId("");
                              }}
                              disabled={!String(manualBoxId || "").trim()}
                              className="px-6 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="bg-white/60 rounded-lg border border-indigo-50 overflow-hidden">
                      <div className="px-3 py-1.5 bg-indigo-100/50 border-b border-indigo-100 flex justify-between">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase">Scanned Item List</span>
                        <span className="text-[9px] font-black text-indigo-600/50 uppercase">
                          Boxes: {scannedStats.box + scannedStats.loose}
                        </span>
                      </div>
                      <div className="max-h-[min(40dvh,280px)] overflow-y-auto p-2 custom-scrollbar">
                        {scannedInActive.length ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                            {scannedInActive.map((box) => {
                              const uid = String(box.box_no_uid || "").trim();
                              const loose = isLoose(box);
                              return (
                                <div
                                  key={uid}
                                  className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between shadow-sm"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                                        loose ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                                      }`}
                                    >
                                      {loose ? "L" : "B"}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-mono font-black text-slate-700 truncate">
                                        {boxNoUidDisplayLabel(uid) || uid}
                                      </p>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase">Qty: {box.qty ?? "—"}</p>
                                    </div>
                                  </div>
                                  {!readOnly && !isApprove ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setScanned((prev) => {
                                          const next = new Set(prev);
                                          next.delete(uid);
                                          return next;
                                        })
                                      }
                                      className="p-2 text-slate-300 hover:text-rose-500"
                                      title="Remove from scan list"
                                    >
                                      <X size={16} />
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300 py-12">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-slate-200">
                              <ScanLine size={32} className="opacity-20" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest">Ready for Scanning</p>
                            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                              Scan boxes for Packing #{activeBD.packing_number}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                  <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 font-medium">
                    Store-out linked, but no boxes were found. Check that the store-out is approved and boxes are linked.
                  </p>
                </div>
              )}

              <FormTextarea
                label="Security Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Driver name, vehicle details, seal no., escort…"
                rows={3}
                disabled={readOnly}
              />

              {!allScanned && requiredTotal > 0 ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-800 font-medium">
                    Scan all boxes before submit. Partial progress can be saved as a draft.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Drawer>

      <Snackbar
        open={snackbar.open}
        onClose={() => setSnackbar(INITIAL_SNACK)}
        variant={snackbar.variant}
        title={snackbar.title}
        message={snackbar.message}
        duration={snackbar.duration}
      />
    </>
  );
}
