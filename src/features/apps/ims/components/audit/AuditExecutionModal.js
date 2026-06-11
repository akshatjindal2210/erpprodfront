"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Check, Loader2, MapPin, Package, Trash2, Send, QrCode, ScanLine, ClipboardCheck } from "lucide-react";
import { toast } from "react-toastify";

import { auditService } from "@/features/apps/ims/services/audit";
import { boxService } from "@/features/apps/ims/services/box";
import Drawer from "@/core/components/ui/Drawer";
import { useHtml5QrScanner } from "@/core/hooks/useHtml5QrScanner";
import QrScannerOverlay from "@/core/components/common/QrScannerOverlay";
import { isMobileDevice } from "@/core/utils/pwa";
import { extractLocationNo, extractBoxCode } from "@/features/apps/ims/helpers/qrScan";
import { playScanSuccessBeep, unlockScanAudio } from "@/features/apps/ims/helpers/scanFeedback";
import { SCAN_SNACK_MSG, FLOW_SCAN_CAMERA_INSECURE_MSG } from "@/core/utils/global/messages";
import {
  buildScannedDataFromAudit,
  getLocationFromAudit,
  getExpectedBoxCount,
  countExpectedBoxes,
  isLocationClosed,
  isLocationEditable,
  isLocationDraft,
  getLocationStatusLabel,
} from "./auditScanHelpers";

const AUDIT_SCANNER_ELEMENT_ID = "audit-execution-scanner";

export default function AuditExecutionModal({ open, onClose, onSuccess, auditData, fixedLocationId }) {
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [scannedData, setScannedData] = useState({});
  const [scanInput, setScannedInput] = useState("");
  const [isLocationScanned, setIsLocationScanned] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const processingRef = useRef(new Set());

  const inputRef = useRef(null);
  const lastScanRef = useRef({ key: "", at: 0 });
  const prevOpenRef = useRef(false);
  const locationVerifiedRef = useRef(false);

  const assignedLocation = useMemo(() => {
    if (!auditData?.locations || fixedLocationId == null) return null;
    return getLocationFromAudit(auditData, fixedLocationId);
  }, [auditData, fixedLocationId]);

  const locId = assignedLocation ? Number(assignedLocation.location_id) : null;
  const activeLocation = currentLocation
    ? getLocationFromAudit(auditData, currentLocation.location_id) || currentLocation
    : assignedLocation;
  const isCurrentClosed = activeLocation ? isLocationClosed(activeLocation) : false;
  const isCurrentDraft = activeLocation ? isLocationDraft(activeLocation) : false;
  const isAuditLocked = auditData?.status === "submitted" || auditData?.status === "verified";
  const currentScannedBoxes = locId != null ? (scannedData[locId] || []) : [];
  const expectedBoxCount = locId != null ? getExpectedBoxCount(auditData, locId) : 0;
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
      setTimeout(() => inputRef.current?.focus(), 300);
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
      return;
    }
    lastScanRef.current = { key: val, at: now };

    const normalizedLoc = extractLocationNo(val);
    const scannedLocNo = normalizedLoc || val;

    const looksLikeLocation = normalizedLoc && verifyFixedLocation(scannedLocNo);

    if (!isLocationScanned) {
      if (!looksLikeLocation) {
        toast.error(`Scan the Location QR for ${assignedLocation.location_no} first`);
        setScannedInput("");
        return;
      }

      if (!isLocationEditable(assignedLocation)) {
        toast.error("This location can no longer be edited.");
        setScannedInput("");
        return;
      }

      locationVerifiedRef.current = true;
      setCurrentLocation(getLocationFromAudit(auditData, fixedLocationId) || assignedLocation);
      setIsLocationScanned(true);
      setScannedInput("");
      playScanSuccessBeep();
      toast.success(`Location ${assignedLocation.location_no} verified — scan boxes now`);
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    if (looksLikeLocation) {
      toast.info("Location already verified — scan boxes now");
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

    const boxCode = extractBoxCode(val) || val;
    const currentBoxes = scannedData[locId] || [];

    if (currentBoxes.includes(boxCode)) {
      toast.info(`Box ${boxCode} already in list`);
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
        playScanSuccessBeep();

        if (res?.data?.auto_completed) {
          locationVerifiedRef.current = false;
          toast.success(`All boxes matched — ${assignedLocation.location_no} completed`);
          onSuccess(false);
        } else {
          toast.success(`Box ${boxCode} added`, { autoClose: 1000 });
        }
      } else {
        toast.error(`Box ${boxCode} not found in system`);
      }
    } catch {
      toast.error("Error saving box scan");
    } finally {
      processingRef.current.delete(boxCode);
      setLoading(false);
      setScannedInput("");
      inputRef.current?.focus();
    }
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    handleScanValue(scanInput.trim());
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
      description={`Audit #${auditData?.audit_id} | Location: ${assignedLocation.location_no}`}
      footer={drawerFooter}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pb-4">
        {isAuditLocked && (
          <div className="border rounded-lg px-3 py-2 text-[10px] font-bold uppercase bg-indigo-50 border-indigo-100 text-indigo-700">
            Audit submitted — scans are read-only.
          </div>
        )}

        <QrScannerOverlay
          open={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          readerId={AUDIT_SCANNER_ELEMENT_ID}
          hint={
            !isLocationScanned
              ? `Scan Location QR for ${assignedLocation.location_no}`
              : `Scan boxes — ${assignedLocation.location_no} (${currentScannedBoxes.length} added)`
          }
          torchSupported={torchSupported}
          torchOn={torchOn}
          onToggleTorch={toggleTorch}
        />

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-2">
            <MapPin size={12} />
            Selected Location (from row)
          </p>
          <p className="text-xl font-black text-indigo-950 uppercase">{assignedLocation.location_no}</p>
          <div className="flex flex-wrap gap-3 text-[10px] font-bold text-slate-600 uppercase">
            <span>Boxes: {scanCount}/{countExpectedBoxes(activeLocation)}</span>
            <span>Status: {getLocationStatusLabel(activeLocation?.status)}</span>
          </div>
        </div>

        <div className="space-y-3 p-4 rounded-xl border bg-white border-indigo-200 shadow-sm">
          {isLocationScanned && (
            <div className={`border rounded-lg p-2.5 flex items-center gap-3 mb-1 ${
              isCurrentDraft ? "bg-sky-50 border-sky-100" : "bg-indigo-50 border-indigo-100"
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm ${
                isCurrentDraft ? "bg-sky-500" : "bg-indigo-500"
              }`}>
                <Check size={18} strokeWidth={3} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-indigo-800">
                  {isCurrentDraft ? "Pending — In Progress" : "Location Verified"}
                </p>
                <p className="text-[12px] font-black uppercase text-indigo-950">{assignedLocation.location_no}</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-100/50">
                <Package size={12} className="text-indigo-600" />
                <span className="text-[10px] font-bold uppercase text-indigo-700">
                  {currentScannedBoxes.length}{expectedBoxCount ? ` / ${expectedBoxCount}` : ""} scanned
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-2">
              {isLocationScanned ? <Package size={14} className="text-indigo-500" /> : <MapPin size={14} className="text-slate-400" />}
              {isLocationScanned ? "Step 2: Scan Boxes" : `Step 1: Scan ${assignedLocation.location_no} QR`}
            </h3>
          </div>

          {!isLocationScanned && (
            <div className="py-2 px-3 text-center bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-[10px] text-amber-700 font-bold uppercase">
                Scan the Location QR for {assignedLocation.location_no} — box scanning starts after verification
              </p>
            </div>
          )}

          {isLocationScanned && isCurrentDraft && (
            <div className="py-2 px-3 text-center bg-sky-50 rounded-lg border border-sky-100">
              <p className="text-[10px] text-sky-700 font-bold uppercase">
                Location verified — keep scanning boxes, then Submit Location
              </p>
            </div>
          )}

          {isLocationScanned && !isCurrentDraft && (
            <div className="py-2 px-3 text-center bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-[10px] text-emerald-700 font-bold uppercase">
                Location verified — scan boxes for this location
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            {isMobileDevice() && (
              <button
                onClick={startScanner}
                className="h-[40px] shrink-0 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                title={isLocationScanned ? "Scan Box QR" : "Scan Location QR"}
              >
                <QrCode size={16} />
                <span className="text-[10px] font-black uppercase">Scan</span>
              </button>
            )}
            <form onSubmit={handleScanSubmit} className="relative flex-1 min-w-0">
              <ScanLine size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={scanInput}
                onChange={(e) => setScannedInput(e.target.value)}
                placeholder={isLocationScanned ? "Scan Box UID..." : `Scan ${assignedLocation.location_no} QR...`}
                className="w-full h-[40px] bg-white border border-slate-200 rounded-lg pl-8 pr-10 text-[10px] font-mono transition-all outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {loading ? (
                  <Loader2 size={14} className="animate-spin text-indigo-500" />
                ) : (
                  <>
                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Auto-Saving...</span>
                    <Send size={14} className="text-indigo-500" />
                  </>
                )}
              </div>
            </form>
          </div>
        </div>

        {isLocationScanned && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Your scans ({currentScannedBoxes.length})
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
                  className="text-[10px] font-bold text-rose-500 uppercase"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
              {currentScannedBoxes.length === 0 ? (
                <div className="col-span-full py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-[10px] font-medium italic">
                  No boxes scanned yet
                </div>
              ) : (
                currentScannedBoxes.map((uid, idx) => (
                  <div key={uid} className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-lg hover:border-slate-300 transition-all group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] font-bold text-slate-400 w-4">{currentScannedBoxes.length - idx}.</span>
                      <span className="font-mono text-[11px] font-bold text-slate-700 truncate">{uid}</span>
                    </div>
                    {!isAuditLocked && (
                      <button onClick={() => removeBox(uid)} className="text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
