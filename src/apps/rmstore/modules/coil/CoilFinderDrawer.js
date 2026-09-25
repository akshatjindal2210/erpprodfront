"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, ScanLine, CameraOff, Layers, Package, QrCode, Factory } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import { lookupCoilByUid } from "@/apps/rmstore/lib/services/coil";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { extractCoilUid, coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { playScanSuccessBeep, prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import ScanEnterInput from "@/ui/common/scan/ScanEnterInput";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import CoilFinderDetailsSection from "./CoilFinderDetailsSection";
import CoilFinderPlacementSection, { CoilFinderConsumedDetails, coilFinderHeaderTone } from "./CoilFinderPlacementSection";
import { fgWireSplitKindShort, formatPjobcardnoDisplay, getCoilStockZone, partitionFgWireSplits, resolveCoilJobCardLabel, resolveCoilMachineLabel } from "@/apps/rmstore/modules/coil/coilTableVisuals";

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "info", title: "", message: "", duration: SNACK_DUR.med };
const COIL_FINDER_SCANNER_ID = "rm-coil-finder-scanner-reader";

function IconLabeledRow({ icon: Icon, label, children, iconClass = "text-slate-400" }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`w-8 h-8 rounded-lg bg-white/70 border border-white/80 flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[10px] font-medium text-slate-500 mb-0.5">{label}</p>
        <div className="text-xs font-semibold text-slate-800 leading-snug">{children}</div>
      </div>
    </div>
  );
}

function FgWireSplitBody({ split, reassign, hideJobCard = false }) {
  if (!split) return <span className="font-mono uppercase">—</span>;
  return (
    <div className="leading-snug">
      <span className={`font-mono uppercase font-semibold ${reassign ? "text-indigo-700" : "text-slate-900"}`}>
        {split.fg_item_code}
      </span>
      <span className="text-[11px] font-normal text-slate-600 normal-case">
        {" "}
        · {fgWireSplitKindShort(split.kind)}{" "}
        <span className="font-bold tabular-nums text-slate-800">
          {split.wire_qty_label ||
            (split.wire_qty != null ? `${split.wire_qty}${split.wire_unit ? ` ${split.wire_unit}` : ""}` : "—")}
        </span>
      </span>
      {split.pjobcardno && !hideJobCard ? (
        <p className="text-[10px] font-mono uppercase text-slate-500 mt-0.5">{formatPjobcardnoDisplay(split.pjobcardno)}</p>
      ) : null}
      {split.fg_item_desc &&
      String(split.fg_item_desc).trim() &&
      String(split.fg_item_desc).trim().toUpperCase() !== String(split.fg_item_code || "").trim().toUpperCase() ? (
        <p className="text-[10px] font-normal text-slate-500 normal-case mt-0.5">{split.fg_item_desc}</p>
      ) : null}
    </div>
  );
}

export default function CoilFinderDrawer({ open, onClose, permissionModule = "rm_coils" }) {
  const [loading, setLoading] = useState(false);
  const [coilData, setCoilData] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

  const keyboardInputRef = useRef(null);
  const scanToastRef = useRef({});
  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const showLaserUi = laserScan || isLaserScanEnabled();

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);

  const { showScanToast } = useScanSnackbarActions(setSnackbar, scanToastRef);

  const fetchCoilInfo = async (rawValue) => {
    const coilUid = extractCoilUid(rawValue);
    if (!coilUid) {
      showScanToast("error", "invalid-coil-qr", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    setLoading(true);
    setCoilData(null);

    try {
      const coil = await lookupCoilByUid(coilUid, permissionModule, "view", { finder: true });
      if (!coil) {
        showScanToast("error", "coil-not-found", "Coil not found. Check the UID and try again.");
        return;
      }

      setCoilData(coil);
      void playScanSuccessBeep();
    } catch (err) {
      showScanToast("error", "fetch-error", err?.message || "Could not load the coil details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCoilInfoRef = useRef(fetchCoilInfo);
  fetchCoilInfoRef.current = fetchCoilInfo;

  const handleScanEnter = useCallback((code) => {
    void fetchCoilInfoRef.current(code);
  }, []);

  function handleFinderCameraDecoded(decodedText) {
    setCameraOn(false);
    void fetchCoilInfoRef.current(decodedText);
  }

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: cameraOn,
    elementId: COIL_FINDER_SCANNER_ID,
    onDecoded: handleFinderCameraDecoded,
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: () => {
      showScanToast(
        "error",
        "camera-list",
        SCAN_SNACK_MSG.CAMERA_DENIED ?? SCAN_SNACK_MSG.CAMERA,
        4000
      );
      setCameraOn(false);
    },
  });

  const stopCamera = useCallback(() => {
    setCameraOn(false);
  }, []);

  const startCamera = () => {
    void (async () => {
      const prep = await prepareQrScanSession();
      if (!prep.cameraOk) {
        showScanToast(
          "error",
          "camera-list",
          prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
          4000
        );
        return;
      }
      setCoilData(null);
      setCameraOn(true);
    })();
  };

  const handleClose = useCallback(() => {
    stopCamera();
    setCoilData(null);
    onClose();
  }, [onClose, stopCamera]);

  const headerTone = coilData ? coilFinderHeaderTone(coilData) : null;
  const fgPartition = coilData ? partitionFgWireSplits(coilData.fg_wire_splits) : { primary: null, others: [] };
  const coilZone = coilData ? getCoilStockZone(coilData) : null;
  const shopFloorCoil = coilZone === "out";
  const consumedCoil = coilZone === "consumed";

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={handleClose}
        title="Coil Finder"
        description="Scan a coil QR code to view its location and details"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pb-6">
          <div className="flex items-end gap-2">
            <div className="relative flex-1 space-y-2">
              <label className="text-xs font-medium text-slate-600 ml-1 block">Coil UID</label>
              {showLaserUi && (
                <LaserScanField
                  active={open && showLaserUi}
                  onScanned={handleScanEnter}
                  keyboardInputRef={keyboardInputRef}
                  formatPreview={coilUidDisplayLabel}
                  requireArmButton={false}
                />
              )}
              {keyboardType && (
                <div className="relative">
                  <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 z-10" />
                  <ScanEnterInput
                    ref={keyboardInputRef}
                    placeholder={getScanInputPlaceholder()}
                    onEnter={handleScanEnter}
                    className="w-full h-11 min-h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-500 placeholder:opacity-100 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              )}
              {!showLaserUi && !keyboardType && (
                <p className="text-xs text-slate-500 px-1">Enable the laser scanner or keyboard input in Settings.</p>
              )}
            </div>

            {showPhoneQr && (
              <button
                type="button"
                onClick={() => (cameraOn ? stopCamera() : startCamera())}
                className={`w-12 h-11 flex items-center justify-center rounded-xl border transition-all shadow-sm ${
                  cameraOn ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700"
                }`}
                title={cameraOn ? "Stop camera" : "Scan QR"}
              >
                {cameraOn ? <CameraOff size={20} /> : <QrCode size={20} />}
              </button>
            )}
          </div>

          <QrScannerOverlay
            open={cameraOn}
            onClose={stopCamera}
            readerId={COIL_FINDER_SCANNER_ID}
            hint="Scan the coil sticker"
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
          />

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={32} />
              <p className="text-xs font-medium text-slate-500">Please wait…</p>
            </div>
          ) : coilData ? (
            <div className="space-y-4">
              <div className={`p-3 rounded-xl border ${headerTone.shell}`}>
                <div className="flex items-start gap-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${headerTone.icon}`}>
                    <Layers size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-medium leading-none ${headerTone.kicker}`}>This coil</p>
                    <p className={`text-sm font-bold font-mono leading-tight break-all ${headerTone.title}`}>
                      {coilData.coil_no_uid}
                    </p>
                    <p className={`text-[11px] mt-1 ${headerTone.meta}`}>
                      Heat <span className="font-mono font-semibold">{coilData.heat_no ?? "—"}</span>
                      <span className="mx-1 opacity-50">·</span>
                      Qty <span className="font-semibold">{coilData.qty ?? "—"}</span>
                    </p>
                    <div className={`mt-2 pt-2 border-t ${headerTone.divider} space-y-2.5`}>
                      <IconLabeledRow icon={Package} label="RM wire item" iconClass="text-indigo-500">
                        <span className="font-mono uppercase">{coilData.item_code || "—"}</span>
                        {coilData.item_desc && (coilData.item_desc).trim() && String(coilData.item_desc).trim() !== String(coilData.item_code || "").trim() ? (
                          <p className="text-[11px] font-normal text-slate-600 normal-case mt-0.5">{coilData.item_desc}</p>
                        ) : null}
                      </IconLabeledRow>
                      <IconLabeledRow icon={Factory} label="FG item (production)" iconClass="text-violet-600">
                        {fgPartition.primary ? (
                          <FgWireSplitBody
                            split={fgPartition.primary}
                            reassign={coilData.reassign}
                            hideJobCard={shopFloorCoil}
                          />
                        ) : (
                          <span className="font-mono uppercase">{coilData.fg_item_code || "—"}</span>
                        )}
                        {!fgPartition.primary &&
                        coilData.fg_item_desc &&
                        String(coilData.fg_item_desc).trim() &&
                        String(coilData.fg_item_desc).trim() !== String(coilData.fg_item_code || "").trim() ? (
                          <p className="text-[11px] font-normal text-slate-600 normal-case mt-0.5">{coilData.fg_item_desc}</p>
                        ) : null}
                      </IconLabeledRow>
                      {shopFloorCoil ? (
                        <>
                          <IconLabeledRow icon={Layers} label="Job card" iconClass="text-indigo-500">
                            <span className={`font-mono uppercase ${coilData.reassign ? "text-indigo-700" : ""}`}>
                              {resolveCoilJobCardLabel(coilData)}
                            </span>
                          </IconLabeledRow>
                          <IconLabeledRow icon={Package} label="Machine" iconClass="text-indigo-500">
                            <span className="font-mono uppercase">{resolveCoilMachineLabel(coilData)}</span>
                          </IconLabeledRow>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {fgPartition.others.map((split, idx) => (
                <div
                  key={`${split.fg_item_code}-${split.kind}-${idx}`}
                  className={`p-3 rounded-xl border ${headerTone.shell}`}
                >
                  <IconLabeledRow icon={Factory} label="FG item (production)" iconClass="text-violet-600">
                    <FgWireSplitBody split={split} reassign={coilData.reassign} />
                  </IconLabeledRow>
                </div>
              ))}

              {consumedCoil ? (
                <CoilFinderConsumedDetails coil={coilData} />
              ) : (
                <CoilFinderPlacementSection coil={coilData} />
              )}

              <CoilFinderDetailsSection coil={coilData} />
            </div>
          ) : (
            !cameraOn && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <Layers size={24} className="text-slate-200" />
                </div>
                <p className="text-sm font-medium text-slate-500">Scan or enter a coil UID to see where it is.</p>
              </div>
            )
          )}
        </div>
      </Drawer>
      <Snackbar
        open={snackbar.open}
        variant={snackbar.variant}
        title={snackbar.title}
        message={snackbar.message}
        duration={snackbar.duration}
        onClose={closeSnackbar}
      />
    </>
  );
}
