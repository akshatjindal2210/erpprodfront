"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Check, Loader2, MapPin, Package, Trash2, Send, QrCode, ScanLine, ClipboardCheck } from "lucide-react";
import { toast } from "react-toastify";

import { auditService } from "@/features/apps/ims/services/audit";
import { boxService } from "@/features/apps/ims/services/box";
import Drawer from "@/core/components/ui/Drawer";
import Snackbar from "@/core/components/ui/Snackbar";
import { useHtml5QrScanner } from "@/core/hooks/useHtml5QrScanner";
import QrScannerOverlay from "@/core/components/common/QrScannerOverlay";
import { useDeviceScanSettings } from "@/core/hooks/useDeviceScanSettings";
import ScanEnterInput from "@/core/components/common/ScanEnterInput";
import LaserScanField from "@/core/components/common/LaserScanField";
import { blurActiveElement, getDeviceScanSettings, isLaserScanEnabled } from "@/core/utils/deviceScanSettings";
import { extractLocationNo, parseStickerScan, boxNoUidDisplayLabel, locationNoDisplayLabel } from "@/features/apps/ims/helpers/qrScan";
import { unlockScanAudio } from "@/features/apps/ims/helpers/scanFeedback";
import { SCAN_SNACK_MSG, FLOW_SCAN_CAMERA_INSECURE_MSG, useScanSnackbarActions } from "@/core/utils/global";
import {
  buildScannedDataFromAudit,
  getLocationFromAudit,
  isLocationClosed,
  isLocationEditable,
} from "./auditScanHelpers";

const AUDIT_SCANNER_ELEMENT_ID = "audit-execution-scanner";
const INITIAL_SNACK = { open: false, variant: "error", title: "", message: "", duration: 4000 };

export default function AuditExecutionModal({ open, onClose, onSuccess, auditData, fixedLocationId }) {
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [scannedData, setScannedData] = useState({});
  const [scanInput, setScannedInput] = useState("");
  const [isLocationScanned, setIsLocationScanned] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);
  const processingRef = useRef(new Set());

  const inputRef = useRef(null);
  const lastScanRef = useRef({ key: "", at: 0 });
  const prevOpenRef = useRef(false);
  const locationVerifiedRef = useRef(false);
  const scanToastRef = useRef({});

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);

  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);
  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const scanBtnCount = (showPhoneQr ? 1 : 0) + (laserScan ? 1 : 0);
  const scanBtnFill =
    scanBtnCount > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  const assignedLocation = useMemo(() => {
    if (!auditData?.locations || fixedLocationId == null) return null;
    return getLocationFromAudit(auditData, fixedLocationId);
  }, [auditData, fixedLocationId]);

  const locId = assignedLocation ? Number(assignedLocation.location_id) : null;
  const activeLocation = currentLocation
    ? getLocationFromAudit(auditData, currentLocation.location_id) || currentLocation
    : assignedLocation;
  const isCurrentClosed = activeLocation ? isLocationClosed(activeLocation) : false;
  const isAuditLocked = auditData?.status === "submitted" || auditData?.status === "verified";
  const currentScannedBoxes = locId != null ? (scannedData[locId] || []) : [];
  const scanCount = currentScannedBoxes.length;

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCurrentLocation(null);
      setScannedInput("");
      setIsLocationScanned(false);
      locationVerifiedRef.current = false;
      setIsScannerOpen(false);
      processingRef.current.clear();
      lastScanRef.current = { key: "", at: 0 };
      setSnackbar(INITIAL_SNACK);
      if (getDeviceScanSettings().laserScan) {
        blurActiveElement();
      }
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !auditData) return;
    setScannedData(buildScannedDataFromAudit(auditData));

    if (locationVerifiedRef.current && assignedLocation && isLocationEditable(assignedLocation)) {
      setIsLocationScanned(true);
      setCurrentLocation(getLocationFromAudit(auditData, fixedLocationId) || assignedLocation);
    }
  }, [open, auditData, assignedLocation, fixedLocationId]);

  useEffect(() => {
    if (!open || !assignedLocation) return;
    if (isLocationClosed(assignedLocation)) {
      toast.error("This location has already been submitted.");
      onClose();
    }
  }, [open, assignedLocation, onClose]);

  useEffect(() => {
    if (!currentLocation?.location_id || !auditData?.locations) return;
    const fresh = getLocationFromAudit(auditData, currentLocation.location_id);
    if (!fresh) return;

    if (isLocationClosed(fresh)) {
      locationVerifiedRef.current = false;
      setIsLocationScanned(false);
      setCurrentLocation(null);
      onSuccess(false);
      return;
    }

    if (fresh.status !== currentLocation.status) {
      setCurrentLocation(fresh);
    }
  }, [auditData?.locations, currentLocation?.location_id, currentLocation?.status, onSuccess]);

  const verifyFixedLocation = (scannedLocNo) => {
    if (!assignedLocation) return false;
    return scannedLocNo.toLowerCase() === String(assignedLocation.location_no || "").trim().toLowerCase();
  };

  const handleScanValue = async (val) => {
    if (!val || !assignedLocation) return;

    const now = Date.now();
    if (val === lastScanRef.current.key && now - lastScanRef.current.at < 1500) {
      showScanToast("error", `audit-dup-${val.toLowerCase()}`, SCAN_SNACK_MSG.BOX_DUPLICATE(val), 1400);
      return;
    }
    lastScanRef.current = { key: val, at: now };

    const normalizedLoc = extractLocationNo(val);
    const scannedLocNo = normalizedLoc || val;

    const looksLikeLocation = normalizedLoc && verifyFixedLocation(scannedLocNo);

    if (!isLocationScanned) {
      if (!looksLikeLocation) {
        const wrongLocation = normalizedLoc && !verifyFixedLocation(scannedLocNo);
        showScanToast(
          "error",
          wrongLocation ? `audit-wrong-loc-${scannedLocNo.toLowerCase()}` : "audit-scan-location-first",
          wrongLocation ? "Please scan assigned location." : "Scan the location QR code first.",
          2200,
        );
        setScannedInput("");
        return;
      }

      if (!isLocationEditable(assignedLocation)) {
        showScanToast("error", "audit-loc-not-editable", "This location can no longer be edited.", 2200);
        setScannedInput("");
        return;
      }

      locationVerifiedRef.current = true;
      setCurrentLocation(getLocationFromAudit(auditData, fixedLocationId) || assignedLocation);
      setIsLocationScanned(true);
      setScannedInput("");
      showScanSuccess(
        "audit-location-verified",
        SCAN_SNACK_MSG.AUDIT_LOCATION_VERIFIED(assignedLocation.location_no),
        4500,
      );
      blurActiveElement();
      return;
    }

    if (looksLikeLocation) {
      showScanToast("error", "audit-location-already", "Location already verified. Scan boxes now.", 2000);
      setScannedInput("");
      return;
    }

    if (auditData?.status === "submitted" || auditData?.status === "verified") {
      toast.error("Audit already submitted or verified.");
      setScannedInput("");
      return;
    }

    const freshLoc = getLocationFromAudit(auditData, assignedLocation.location_id);
    if (freshLoc && isLocationClosed(freshLoc)) {
      toast.error("This location has been submitted and cannot be edited.");
      setScannedInput("");
      return;
    }

    const { box_no_uid: boxCode } = parseStickerScan(val);
    if (!boxCode) {
      showScanToast("error", "audit-invalid-box", "Scan the box sticker QR code.", 2200);
      setScannedInput("");
      return;
    }

    const currentBoxes = scannedData[locId] || [];

    if (currentBoxes.includes(boxCode)) {
      showScanToast("error", `audit-dup-${boxCode.toLowerCase()}`, SCAN_SNACK_MSG.BOX_DUPLICATE(boxCode), 1400);
      setScannedInput("");
      return;
    }

    if (processingRef.current.has(boxCode)) return;

    processingRef.current.add(boxCode);
    setLoading(true);
    try {
      const box = await boxService.getByUidOrNoUid(boxCode, { permission_module: "audit", permission_action: "add" });
      if (box.data) {
        const res = await auditService.submitScan({
          audit_id: auditData.audit_id,
          location_id: locId,
          box_no_uids: [boxCode],
          complete_location: false,
        });

        setScannedData((prev) => {
          const boxes = prev[locId] || [];
          if (boxes.includes(boxCode)) return prev;
          return { ...prev, [locId]: [boxCode, ...boxes] };
        });

        if (res?.data?.auto_completed) {
          locationVerifiedRef.current = false;
          showScanSuccess("audit-auto-complete", `All boxes matched — ${assignedLocation.location_no} completed`, 4000);
          onSuccess(false);
        } else {
          showScanSuccess(`audit-box-${boxCode.toLowerCase()}`, SCAN_SNACK_MSG.BOX_ADDED(boxCode), 1200);
        }
      } else {
        showScanToast("error", `audit-box-missing-${boxCode.toLowerCase()}`, `Box ${boxCode} was not found in the system.`, 2200);
      }
    } catch {
      showScanToast("error", "audit-box-save-failed", "Failed to save the box scan.", 2200);
    } finally {
      processingRef.current.delete(boxCode);
      setLoading(false);
      setScannedInput("");
      if (getDeviceScanSettings().laserScan) blurActiveElement();
    }
  };

  const handleScanValueRef = useRef(handleScanValue);
  handleScanValueRef.current = handleScanValue;

  const handleLaserScan = useCallback((code) => {
    void handleScanValueRef.current(code);
  }, []);

  const handleLaserScanRejected = useCallback(
    ({ reason, code }) => {
      if (reason === "duplicate") {
        showScanToast(
          "error",
          `laser-dup-${String(code ?? "").toLowerCase()}`,
          SCAN_SNACK_MSG.BOX_DUPLICATE(code),
          1200
        );
      } else if (reason === "empty") {
        showScanToast("error", "laser-empty-scan", SCAN_SNACK_MSG.REJECTED, 1800);
      }
    },
    [showScanToast]
  );

  const laserPreviewLabel = useCallback(
    (raw) => (isLocationScanned ? boxNoUidDisplayLabel(raw) : locationNoDisplayLabel(raw)),
    [isLocationScanned]
  );

  const handleKeyboardEnter = useCallback((code) => {
    setScannedInput("");
    void handleScanValueRef.current(code);
  }, []);

  const laserScanActive = open && (laserScan || isLaserScanEnabled());

  const handleScanSubmit = (e) => {
    e.preventDefault();
    const code = String(inputRef.current?.value ?? "").trim();
    if (inputRef.current) inputRef.current.value = "";
    handleScanValue(code);
  };

  const startScanner = () => {
    void unlockScanAudio().catch(() => {});
    setIsScannerOpen(true);
  };

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen,
    elementId: AUDIT_SCANNER_ELEMENT_ID,
    onDecoded: (text) => handleScanValue(text),
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: (err) => {
      if (err?.name === "InsecureContext") {
        toast.error(FLOW_SCAN_CAMERA_INSECURE_MSG, { autoClose: 10000 });
      } else {
        const isDenied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
        toast.error(isDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA, { autoClose: 10000 });
      }
      setIsScannerOpen(false);
    },
  });

  const removeBox = async (uid) => {
    if (auditData?.status === "submitted" || auditData?.status === "verified") {
      toast.error("Cannot remove scans from a submitted audit");
      return;
    }

    const freshLoc = getLocationFromAudit(auditData, assignedLocation?.location_id);
    if (freshLoc && isLocationClosed(freshLoc)) {
      toast.error("This location has already been submitted.");
      return;
    }

    try {
      await auditService.removeScan({
        audit_id: auditData.audit_id,
        location_id: locId,
        box_no_uid: uid,
      });

      setScannedData((prev) => ({
        ...prev,
        [locId]: (prev[locId] || []).filter((b) => b !== uid),
      }));
      toast.success(`Box ${uid} removed`);
    } catch {
      toast.error("Failed to remove box scan");
    }
  };

  const handleCompleteLocation = async () => {
    if (!assignedLocation || !isLocationScanned) {
      toast.error("Scan and verify the location QR first.");
      return;
    }

    setLoading(true);
    try {
      const res = await auditService.submitScan({
        audit_id: auditData.audit_id,
        location_id: locId,
        box_no_uids: scannedData[locId] || [],
        complete_location: true,
      });

      const msg = res?.message || `Location ${assignedLocation.location_no} submitted`;
      if (res?.data?.location_status === "mismatch") {
        toast.warning(msg);
      } else {
        toast.success(msg);
      }

      if (res?.data?.audit_status === "verified") {
        toast.success("All locations matched — audit completed", { autoClose: 5000 });
      } else if (res?.data?.audit_status === "submitted") {
        toast.info("Mismatch detected — admin review required", { autoClose: 5000 });
      }

      onSuccess(false);
    } catch (err) {
      toast.error(err?.message || "Failed to submit location");
    } finally {
      setLoading(false);
      locationVerifiedRef.current = false;
    }
  };

  if (!assignedLocation) {
    return null;
  }

  const drawerFooter = (
    <div className="flex items-center justify-between w-full">
      <button
        onClick={onClose}
        disabled={loading}
        className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all disabled:opacity-50"
      >
        Close
      </button>

      <div className="flex items-center gap-3">
        {isLocationScanned && !isCurrentClosed && (
          <button
            onClick={handleCompleteLocation}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ClipboardCheck size={18} />}
            Submit Location
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Start Audit"
      description={`Audit #${auditData?.audit_id} · ${assignedLocation.location_no}`}
      footer={drawerFooter}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-2.5 pb-3">
        {isAuditLocked && (
          <p className="text-[10px] font-bold uppercase text-indigo-700 px-1">Audit submitted — read only</p>
        )}

        <QrScannerOverlay
          open={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          readerId={AUDIT_SCANNER_ELEMENT_ID}
          frameClassName={
            isLocationScanned ? "border-4 border-emerald-400" : "border-4 border-amber-400"
          }
          hint={
            !isLocationScanned
              ? "Scan location"
              : `Boxes · ${currentScannedBoxes.length} scanned`
          }
          torchSupported={torchSupported}
          torchOn={torchOn}
          onToggleTorch={toggleTorch}
        />

        {/* Step 1 → Step 2 (compact) */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase shrink-0 ${
                isLocationScanned ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {isLocationScanned ? <Check size={11} strokeWidth={3} /> : <MapPin size={11} />}
              1. Location
            </span>
            <span className={`h-px flex-1 ${isLocationScanned ? "bg-emerald-300" : "bg-slate-200"}`} aria-hidden />
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase shrink-0 ${
                isLocationScanned ? "text-indigo-600" : "text-slate-400"
              }`}
            >
              <Package size={11} />
              2. Boxes {scanCount > 0 ? scanCount : ""}
            </span>
          </div>
          <p
            className={`text-[11px] font-semibold leading-snug ${
              isLocationScanned ? "text-indigo-700" : "text-amber-800"
            }`}
            role="status"
          >
            {isLocationScanned ? "Scan each box" : "First scan location, then boxes"}
          </p>
        </div>

        <div className="space-y-2">
          {(showPhoneQr || laserScan) ? (
            <div className="flex items-stretch gap-2 w-full min-w-0">
              {showPhoneQr && (
                <button
                  onClick={startScanner}
                  className={`h-10 sm:h-9 px-3 rounded-lg text-white inline-flex items-center justify-center gap-1.5 ${scanBtnFill} ${
                    isLocationScanned ? "bg-indigo-600" : "bg-amber-500"
                  }`}
                  title={isLocationScanned ? "Scan box QR" : "Scan location QR"}
                >
                  <QrCode size={16} />
                  <span className="text-[10px] font-black uppercase">QR</span>
                </button>
              )}
              {laserScan && (
                <LaserScanField
                  active={laserScanActive}
                  onScanned={handleLaserScan}
                  onScanRejected={handleLaserScanRejected}
                  keyboardInputRef={inputRef}
                  formatPreview={laserPreviewLabel}
                  compact
                  heightClass="h-10 sm:h-9"
                  armButtonLabel={isLocationScanned ? "Scan Box" : "Scan Loc"}
                  fill={scanBtnCount > 0}
                />
              )}
            </div>
          ) : null}
          {keyboardType && (
          <form onSubmit={handleScanSubmit} className="relative w-full min-w-0">
            <ScanLine size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <ScanEnterInput
              ref={inputRef}
              onEnter={handleKeyboardEnter}
              placeholder={
                isLocationScanned
                  ? "Type box code, then press Enter"
                  : "Type location code, then press Enter"
              }
              className={`w-full h-10 sm:h-9 bg-white border rounded-lg pl-7 pr-8 text-[11px] font-mono outline-none focus:ring-2 ${
                isLocationScanned
                  ? "border-indigo-200 focus:border-indigo-500 focus:ring-indigo-50"
                  : "border-amber-200 focus:border-amber-500 focus:ring-amber-50"
              }`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {loading ? (
                <Loader2 size={13} className="animate-spin text-indigo-500" />
              ) : (
                <Send size={13} className={isLocationScanned ? "text-indigo-500" : "text-amber-500"} />
              )}
            </div>
          </form>
          )}
          {!showPhoneQr && !laserScan && !keyboardType && (
            <p className="text-[10px] text-slate-500">Enable Laser scanner or Keyboard type in Settings.</p>
          )}
        </div>

        {isLocationScanned && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <p className="text-[9px] font-bold text-slate-500 uppercase">
                Scanned ({currentScannedBoxes.length})
              </p>
              {currentScannedBoxes.length > 0 && !isAuditLocked && (
                <button
                  onClick={async () => {
                    if (!window.confirm("Clear all scans for this location?")) return;
                    try {
                      setLoading(true);
                      for (const uid of currentScannedBoxes) {
                        await auditService.removeScan({
                          audit_id: auditData.audit_id,
                          location_id: locId,
                          box_no_uid: uid,
                        });
                      }
                      setScannedData((prev) => ({ ...prev, [locId]: [] }));
                      toast.success("Location cleared");
                    } catch {
                      toast.error("Failed to clear location");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="text-[9px] font-bold text-rose-500 uppercase"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="max-h-[200px] overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
              {currentScannedBoxes.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-slate-400 italic">No boxes yet</p>
              ) : (
                currentScannedBoxes.map((uid, idx) => (
                  <div
                    key={uid}
                    className="flex items-center justify-between py-1.5 px-2 bg-slate-50 border border-slate-100 rounded-md"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] font-bold text-slate-400">{currentScannedBoxes.length - idx}.</span>
                      <span className="font-mono text-[10px] font-bold text-slate-700 truncate">{uid}</span>
                    </div>
                    {!isAuditLocked && (
                      <button
                        onClick={() => removeBox(uid)}
                        className="text-slate-300 hover:text-rose-500 p-0.5"
                        aria-label="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <Snackbar
        open={snackbar.open}
        variant={snackbar.variant}
        title={snackbar.title}
        message={snackbar.message}
        duration={snackbar.duration}
        onClose={closeSnackbar}
      />
    </Drawer>
  );
}
