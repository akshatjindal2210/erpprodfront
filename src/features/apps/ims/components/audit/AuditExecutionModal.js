"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, AlertCircle, Loader2, MapPin, Package, Trash2, Send, QrCode, Search, User, X, ScanLine, ClipboardCheck } from "lucide-react";
import { toast } from "react-toastify";

// Services & Components
import { auditService } from "@/features/apps/ims/services/audit";
import { boxService } from "@/features/apps/ims/services/box";
import Drawer from "@/core/components/ui/Drawer";
import { OK_INPUT, ERR_INPUT } from "@/core/components/common/Constants";
import { useHtml5QrScanner } from "@/core/hooks/useHtml5QrScanner";
import QrScannerOverlay from "@/core/components/common/QrScannerOverlay";
import { isMobileDevice } from "@/core/utils/pwa";
import { extractLocationNo, detectQrType, extractBoxCode } from "@/features/apps/ims/helpers/qrScan";
import { prepareQrScanSession, playScanSuccessBeep, unlockScanAudio } from "@/features/apps/ims/helpers/scanFeedback";
import { SCAN_SNACK_MSG, FLOW_SCAN_CAMERA_INSECURE_MSG } from "@/core/utils/global/messages";
import { buildScannedDataFromAudit, getLocationFromAudit, isLastPendingAuditLocation } from "./auditScanHelpers";

const AUDIT_SCANNER_ELEMENT_ID = "audit-execution-scanner";

export default function AuditExecutionModal({ open, onClose, onSuccess, auditData }) {
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null); // { location_id, location_no }
  const [targetLocation, setTargetLocation] = useState(null); // Location user clicked but hasn't scanned yet
  const [scannedData, setScannedData] = useState({}); // { [location_id]: [box_no_uids] }
  const [scanInput, setScannedInput] = useState("");
  const [isLocationScanned, setIsLocationScanned] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const processingRef = useRef(new Set()); // Track boxes currently being processed to prevent duplicates
  
  const inputRef = useRef(null);
  const lastScanRef = useRef({ key: "", at: 0 });

  const prevOpenRef = useRef(false);

  // Reset selection only when modal opens; sync scans whenever audit data refreshes
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCurrentLocation(null);
      setTargetLocation(null);
      setScannedInput("");
      setIsLocationScanned(false);
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
  }, [open, auditData]);

  // Keep selected location in sync after refresh (status: pending/completed)
  useEffect(() => {
    if (!currentLocation?.location_id || !auditData?.locations) return;
    const fresh = getLocationFromAudit(auditData, currentLocation.location_id);
    if (fresh && fresh.status !== currentLocation.status) {
      setCurrentLocation(fresh);
    }
  }, [auditData?.locations, currentLocation?.location_id, currentLocation?.status]);

  const handleScanValue = async (val) => {
    if (!val) return;

    // Cooldown to prevent double scans on mobile
    const now = Date.now();
    if (val === lastScanRef.current.key && now - lastScanRef.current.at < 1500) {
      return;
    }
    lastScanRef.current = { key: val, at: now };

    const type = detectQrType(val);
    const normalizedLoc = extractLocationNo(val);
    const scannedLocNo = normalizedLoc || val;

    // 1. Check if it's a Location Scan (either detected or manually typed)
    const matchedLocation = auditData.locations.find(l => 
      (l.location_no.toLowerCase() === scannedLocNo.toLowerCase()) && 
      l.status !== 'completed'
    );

    if (matchedLocation) {
      // If we were already scanning this location, just confirm
      if (currentLocation?.location_id === matchedLocation.location_id) {
        setIsLocationScanned(true);
        setScannedInput("");
        playScanSuccessBeep();
        toast.success(`Location ${matchedLocation.location_no} Verified.`);
        return;
      }

      // Switching or starting new location
      setCurrentLocation(matchedLocation);
      setTargetLocation(null);
      setIsLocationScanned(true);
      setScannedInput("");
      playScanSuccessBeep();
      toast.success(`Location ${matchedLocation.location_no} Verified.`);
      return;
    }

    // 2. If not a location, it must be a Box Scan
    if (!isLocationScanned) {
      toast.error("Please scan or select a Location QR first!");
      setScannedInput("");
      return;
    }

    if (auditData?.status === 'submitted' || auditData?.status === 'verified') {
      toast.error("Audit is already submitted or verified. Scans are locked.");
      setScannedInput("");
      return;
    }

    const boxCode = extractBoxCode(val) || val;
    const locId = Number(currentLocation.location_id);
    const currentBoxes = scannedData[locId] || [];
    
    // 1. Check if already in local list
    if (currentBoxes.includes(boxCode)) {
      toast.info(`Box ${boxCode} already in list`);
      setScannedInput("");
      return;
    }

    // 2. Check if currently being processed (prevent race condition)
    if (processingRef.current.has(boxCode)) {
      return;
    }

    processingRef.current.add(boxCode);
    setLoading(true);
    try {
      // User said: "box exists krna chiye" - so we check existence
      const box = await boxService.getByUidOrNoUid(boxCode, { permission_module: "audit", permission_action: "add" });
      if (box.data) {
        // Save to DB immediately to prevent data loss on refresh
        await auditService.submitScan({
          audit_id: auditData.audit_id,
          location_id: locId,
          box_no_uids: [boxCode],
          complete_location: false
        });

        setScannedData(prev => {
          const boxes = prev[locId] || [];
          if (boxes.includes(boxCode)) return prev;
          return {
            ...prev,
            [locId]: [boxCode, ...boxes]
          };
        });
        playScanSuccessBeep();
        toast.success(`Box ${boxCode} added`, { autoClose: 1000 });
      } else {
        toast.error(`Box ${boxCode} not found in system`);
      }
    } catch (err) {
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
    // Unlock audio immediately (must be direct user gesture)
    void unlockScanAudio().catch(() => {});
    // Open scanner immediately to avoid "async gap" that causes browser blocking
    setIsScannerOpen(true);
  };

  useHtml5QrScanner({
    active: isScannerOpen,
    elementId: AUDIT_SCANNER_ELEMENT_ID,
    onDecoded: (text) => {
      handleScanValue(text);
    },
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
    }
  });

  const removeBox = async (uid) => {
    if (auditData?.status === 'submitted' || auditData?.status === 'verified') {
      toast.error("Cannot remove scans from a submitted or verified audit");
      return;
    }

    try {
      const locKey = Number(currentLocation.location_id);
      await auditService.removeScan({
        audit_id: auditData.audit_id,
        location_id: locKey,
        box_no_uid: uid
      });
      
      setScannedData(prev => ({
        ...prev,
        [locKey]: (prev[locKey] || []).filter(b => b !== uid)
      }));
      toast.success(`Box ${uid} removed`);
    } catch (err) {
      toast.error("Failed to remove box scan");
    }
  };

  const handleReopenLocation = async () => {
    if (!currentLocation) return;
    
    setLoading(true);
    try {
      // Use submitScan with complete_location: false to re-open
      // This endpoint is accessible to users with 'add' permission (u2)
      await auditService.submitScan({
        audit_id: auditData.audit_id,
        location_id: currentLocation.location_id,
        box_no_uids: [], // No new boxes
        complete_location: false // Mark as pending/in_progress
      });

      toast.success(`Location ${currentLocation.location_no} re-opened for editing`);
      onSuccess(true); // Refresh data
    } catch (err) {
      toast.error("Failed to re-open location");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteLocation = async () => {
    if (!currentLocation) return;
    const locKey = Number(currentLocation.location_id);

    const isLastLocation = isLastPendingAuditLocation(auditData, locKey);

    if (isLastLocation) {
      const ok = window.confirm(
        `This is the last location (${currentLocation.location_no}). Finishing will submit the entire audit for Super Admin final approval.\n\nDo you want to continue?`
      );
      if (!ok) {
        toast.info("Submit cancelled. You can keep working on this location — click 'Finish & Submit Audit' again when ready.");
        return;
      }
    }

    setLoading(true);
    try {
      await auditService.submitScan({
        audit_id: auditData.audit_id,
        location_id: locKey,
        box_no_uids: scannedData[locKey] || [],
        complete_location: true
      });
      
      toast.success(`Location ${currentLocation.location_no} marked as completed`);

      if (isLastLocation) {
        toast.info("All locations done. Audit submitted for Super Admin final approval.", { autoClose: 5000 });
      }
      
      // Reset current location state
      setIsLocationScanned(false);
      setCurrentLocation(null);
      setTargetLocation(null);
      
      // Refresh parent data to update location statuses
      onSuccess(true); 
    } catch (err) {
      toast.error(err?.message || "Failed to complete location");
    } finally {
      setLoading(false);
    }
  };

  const activeLocation = currentLocation
    ? getLocationFromAudit(auditData, currentLocation.location_id) || currentLocation
    : null;
  const isCurrentCompleted = activeLocation?.status === 'completed';
  const isAuditLocked = auditData?.status === 'submitted' || auditData?.status === 'verified';
  const completedCount = auditData?.locations?.filter(l => l.status === 'completed').length || 0;
  const totalLocations = auditData?.locations?.length || 0;

  const locId = activeLocation ? Number(activeLocation.location_id) : null;
  const currentScannedBoxes = locId != null ? (scannedData[locId] || []) : [];
  const isLastLocationFinish = locId != null && isLastPendingAuditLocation(auditData, locId);

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
        {activeLocation && isCurrentCompleted && !isAuditLocked && (
          <button
            onClick={handleReopenLocation}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />} Re-open to Edit
          </button>
        )}

        {isLocationScanned && activeLocation && !isCurrentCompleted && (
          <button
            onClick={handleCompleteLocation}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ClipboardCheck size={18} />}
            {isLastLocationFinish ? "Finish & Submit Audit" : "Finish Location"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Execute Audit"
      description={`Audit ID: #${auditData?.audit_id} | ${auditData?.remarks || 'No remarks'}`}
      footer={drawerFooter}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pb-4">
        {isAuditLocked && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-[10px] font-bold text-indigo-700 uppercase">
            Audit submitted — waiting for Super Admin final approval. Scans are read-only.
          </div>
        )}
        <QrScannerOverlay
          open={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          readerId={AUDIT_SCANNER_ELEMENT_ID}
          hint={
            !isLocationScanned 
              ? `Scan QR to verify ${targetLocation?.location_no || 'Location'}` 
              : `Scanning Boxes for ${currentLocation?.location_no} (${currentScannedBoxes.length} added)`
          }
        />
        {/* Progress & Location Selection */}
        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <MapPin size={12} className="text-indigo-500" />
              Locations to Audit
            </p>
            <span className="text-[10px] font-bold text-indigo-600">
              {completedCount} / {totalLocations} Completed
            </span>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {auditData?.locations.map(loc => {
              const locKey = Number(loc.location_id);
              const hasDraftScans = (scannedData[locKey]?.length || 0) > 0;
              const isCompleted = loc.status === 'completed';
              const isSelected = Number(currentLocation?.location_id) === locKey;
              
              return (
                <button 
                  key={loc.location_id}
                  disabled={loading}
                  onClick={() => {
                    setTargetLocation(loc);
                    setCurrentLocation(loc);
                    setIsLocationScanned(isCompleted || hasDraftScans);
                    setScannedInput("");
                    
                    if (isCompleted) {
                      toast.info(`Viewing ${loc.location_no} — ${scannedData[locKey]?.length || 0} box(es) scanned`);
                    } else if (hasDraftScans) {
                      toast.info(`Continuing ${loc.location_no} — scan QR to verify or add more boxes`);
                    } else {
                      toast.info(`Location ${loc.location_no} selected. Scan QR to verify.`);
                    }
                    
                    if (window.innerWidth >= 1024) {
                      setTimeout(() => inputRef.current?.focus(), 10);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 ${
                    isCompleted 
                      ? isSelected
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                        : "bg-emerald-50 text-emerald-600 border-emerald-100" 
                      : isSelected
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : hasDraftScans
                          ? "bg-amber-50 text-amber-600 border-amber-200 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  <span className="uppercase">{loc.location_no}</span>
                  {isCompleted ? (
                    <Check size={10} />
                  ) : hasDraftScans ? (
                    <Package size={10} />
                  ) : isSelected ? (
                    <QrCode size={10} className="animate-pulse" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

          {/* Scan Section */}
        <div className={`space-y-3 p-4 rounded-xl border transition-all ${(isLocationScanned || targetLocation) ? "bg-white border-indigo-200 shadow-sm" : "bg-slate-50 border-dashed border-slate-200"}`}>
          {isLocationScanned && activeLocation && (
            <div className={`border rounded-lg p-2.5 flex items-center gap-3 mb-1 ${
              isCurrentCompleted
                ? "bg-emerald-50 border-emerald-100"
                : "bg-indigo-50 border-indigo-100"
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm ${
                isCurrentCompleted ? "bg-emerald-500 shadow-emerald-100" : "bg-indigo-500 shadow-indigo-100"
              }`}>
                <Check size={18} strokeWidth={3} />
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase leading-none ${
                  isCurrentCompleted ? "text-emerald-800" : "text-indigo-800"
                }`}>
                  {isCurrentCompleted ? "Location Completed" : "Location Verified"}
                </p>
                <p className={`text-[12px] font-black uppercase ${
                  isCurrentCompleted ? "text-emerald-950" : "text-indigo-950"
                }`}>{activeLocation.location_no}</p>
              </div>
              <div className={`ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md ${
                isCurrentCompleted ? "bg-emerald-100/50" : "bg-indigo-100/50"
              }`}>
                <Package size={12} className={isCurrentCompleted ? "text-emerald-600" : "text-indigo-600"} />
                <span className={`text-[10px] font-bold uppercase ${
                  isCurrentCompleted ? "text-emerald-700" : "text-indigo-700"
                }`}>
                  {currentScannedBoxes.length} Box{currentScannedBoxes.length !== 1 ? "es" : ""}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-2">
              {isLocationScanned ? <Package size={14} className="text-indigo-500" /> : <MapPin size={14} className="text-slate-400" />}
              {isLocationScanned 
                ? "Step 2: Scan Boxes" 
                : targetLocation 
                  ? `Step 1: Verify Location ${targetLocation.location_no}` 
                  : "Step 1: Scan Location QR"}
            </h3>
            
            {(isLocationScanned || targetLocation) && (
              <button 
                onClick={() => {
                  if (isLocationScanned && !isCurrentCompleted) {
                    setIsLocationScanned(false);
                  } else {
                    setIsLocationScanned(false);
                    setCurrentLocation(null);
                    setTargetLocation(null);
                  }
                  setTimeout(() => inputRef.current?.focus(), 10);
                }}
                className="text-rose-500 text-[10px] font-bold uppercase hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          {!isLocationScanned && !targetLocation && (
            <div className="py-4 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase italic">Scan a Location QR or select one above</p>
            </div>
          )}

          {(isLocationScanned || targetLocation) && (
            <div className="space-y-3">
              {isCurrentCompleted ? (
                <div className="py-3 px-3 text-center bg-emerald-50 rounded-lg border border-emerald-100 space-y-1">
                  <p className="text-[10px] text-emerald-700 font-bold uppercase">
                    This location is finished. View boxes below or re-open to edit.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {isMobileDevice() && (
                    <button 
                      onClick={startScanner}
                      className="h-[40px] shrink-0 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                      title={isLocationScanned ? "Scan Box QR" : "Scan Location QR"}
                    >
                      <QrCode size={16} />
                      <span className="text-[10px] font-black uppercase">
                        Scan
                      </span>
                    </button>
                  )}
                  <form onSubmit={handleScanSubmit} className="relative flex-1 min-w-0">
                    <ScanLine size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={inputRef}
                      value={scanInput}
                      onChange={(e) => setScannedInput(e.target.value)}
                      placeholder={isLocationScanned ? "Scan Box UID or type..." : "Scan Location QR or type..."}
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
              )}
            </div>
          )}
        </div>

        {/* Scanned Items List — always show when a location is selected */}
        {activeLocation && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {isCurrentCompleted ? "Completed Boxes" : "Scanned Boxes"} ({currentScannedBoxes.length})
              </p>
              {currentScannedBoxes.length > 0 && !isCurrentCompleted && !isAuditLocked && (
                <button 
                  onClick={async () => {
                    if (!window.confirm("Are you sure you want to clear all scans for this location?")) return;
                    try {
                      setLoading(true);
                      // We need a bulk remove or loop
                      for (const uid of currentScannedBoxes) {
                        await auditService.removeScan({
                          audit_id: auditData.audit_id,
                          location_id: locId,
                          box_no_uid: uid
                        });
                      }
                      setScannedData(prev => ({ ...prev, [locId]: [] }));
                      toast.success("Location cleared");
                    } catch (err) {
                      toast.error("Failed to clear location");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="text-[10px] font-bold text-rose-500 uppercase"
                >
                  Clear Location
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
              {currentScannedBoxes.length === 0 ? (
                <div className="col-span-full py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-[10px] font-medium italic">
                  No boxes scanned for {activeLocation.location_no}
                </div>
              ) : (
                currentScannedBoxes.map((uid, idx) => (
                  <div key={uid} className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-lg hover:border-slate-300 transition-all group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] font-bold text-slate-400 w-4">{currentScannedBoxes.length - idx}.</span>
                      <span className="font-mono text-[11px] font-bold text-slate-700 truncate">{uid}</span>
                    </div>
                    {(!isCurrentCompleted && !isAuditLocked) && (
                      <button 
                        onClick={() => removeBox(uid)}
                        className="text-slate-300 hover:text-rose-500 transition-colors"
                      >
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
