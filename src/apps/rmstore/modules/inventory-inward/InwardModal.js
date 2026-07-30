"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Check, Loader2, QrCode, MapPin, Package, Layers, Plus, X, Trash2, MessageSquare, CheckCircle2, XCircle, ScanLine, Camera, Locate } from "lucide-react";

import "@/apps/ims/lib/config/inwardUi.theme.css";

import { inventoryInwardService } from "@/apps/rmstore/lib/services/inventoryInward";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { storeLocationService } from "@/apps/rmstore/lib/services/storeLocation";
import { coilService } from "@/apps/rmstore/lib/services/coil";
import { extractLocationNo, extractCoilUid, normalizeScanInput, coilUidDisplayLabel, locationNoDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { getLocationDisplayNo } from "@/apps/rmstore/lib/helpers/locationQrLabel";
import { withSortedViewsData } from "@/apps/rmstore/lib/helpers/sortDropdownResponse";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import Drawer from "@/ui/primitives/Drawer";
import FormPanelLoader from "@/ui/common/system/FormPanelLoader";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import Snackbar from "@/ui/primitives/Snackbar";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import RemarksTextarea from "@/ui/common/forms/RemarksTextarea";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { getDeviceScanSettings, getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { prepareQrScanSession, unlockScanAudio, playScanSuccessBeep } from "@/platform/utils/global/scanFeedback";

const MODULE = "rm_inventory_inwards";
const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "success", title: "", message: "", duration: SNACK_DUR.med };
const INWARD_SCANNER_ELEMENT_ID = "rm-inward-modal-scanner-reader";

const MSG = {
  LOCATION_ALREADY_ADDED: "This location has already been added.",
  LOCATION_ALREADY_SCANNING: (locName) => `This location was already added. Continue scanning coils at ${locName}.`,
  LOCATION_NOT_FOUND: "No location found. Check the location number or scan again.",
  LOCATION_SEARCHING: "Searching location...",
  LOCATION_SEARCH_PLACEHOLDER: "Search by location number",
  LOCATION_AT_LEAST_ONE_COIL: "Please add at least one coil to this location.",
  LOCATION_EMPTY_TITLE: "No locations added yet.",
  LOCATION_EMPTY_SUBTITLE: "Search or scan a location to start adding coils.",
  COIL_ALREADY_STORED: "This coil is already stored in a location.",
  COIL_DUPLICATE: (uid) => `Coil ${uid} has already been added.`,
  COIL_DUPLICATE_OTHER: (locName) => `This coil is already assigned to "${locName}".`,
  COIL_NOT_FOUND: "Coil not found. Check the UID and try again.",
  REMARKS_PLACEHOLDER: "Add any notes or remarks for this store-in entry (optional)",
  INWARD_CREATED: "Store-in entry recorded successfully.",
  INWARD_UPDATED: "Store-in entry updated successfully.",
  INWARD_FAILED: "Could not save the store-in entry. Please try again.",
};

function normalizeLoc(row) {
  if (!row || typeof row !== "object") return row;
  const location_id = row.location_id ?? row.id ?? null;
  const location_no =
    String(row.location_no ?? "").trim() ||
    getLocationDisplayNo(row);
  return {
    ...row,
    id: location_id,
    location_id,
    location_no: location_no === "—" ? "" : location_no,
  };
}

function flatCoilsByLocation(locs) {
  return (locs || []).flatMap((loc, li) =>
    (loc.coils || []).map((c) => ({
      locIndex: li,
      locName: loc.name || loc.location_no,
      coilUid: String(c.coil_no_uid || "").trim(),
    }))
  );
}

function locationCoilTotals(coils) {
  const list = coils || [];
  return {
    coilCount: list.length,
    totalQty: list.reduce((sum, c) => sum + (Number(c.qty) || 0), 0),
  };
}

/** MRN breakdown for the Inward Summary section (per location). */
function buildLocationMrnBreakdown(locations) {
  return (locations || [])
    .map((loc) => {
      const byMrn = new Map();
      let totalQty = 0;
      (loc.coils || []).forEach((c) => {
        const qty = Number(c.qty) || 0;
        totalQty += qty;
        const label =
          c.mrn_no != null && String(c.mrn_no).trim() !== ""
            ? String(c.mrn_no).trim()
            : String(c.mrn_uid || "—").trim() || "—";
        const cur = byMrn.get(label) || {
          mrnLabel: label,
          itemCode: null,
          itemDesc: null,
          heatNo: null,
          coilCount: 0,
          qty: 0,
        };
        if (!cur.itemCode && c.item_code) cur.itemCode = c.item_code;
        if (!cur.itemDesc && c.item_desc) cur.itemDesc = c.item_desc;
        if (!cur.heatNo && c.heat_no) cur.heatNo = c.heat_no;
        cur.coilCount += 1;
        cur.qty += qty;
        byMrn.set(label, cur);
      });
      return {
        locLabel: loc.name || loc.location_no || "—",
        coilCount: (loc.coils || []).length,
        totalQty,
        rows: Array.from(byMrn.values()),
      };
    })
    .filter((x) => x.rows.length > 0);
}

export default function InwardModal({ open, onClose, onSuccess, mode = "add", editData = null }) {
  const [formReady, setFormReady] = useState(false);
  const isEdit = mode === "edit";
  const sopPermissionType = isEdit ? "edit" : "add";
  const editId = editData?.in_uid ?? null;

  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [locations, setLocations] = useState([]);
  const locationsRef = useRef([]);
  locationsRef.current = locations;
  const [locHasError, setLocHasError] = useState([]);

  const [scanStatus, setScanStatus] = useState(null);
  const [matchedLoc, setMatchedLoc] = useState(null);
  const [selectedLocId, setSelectedLocId] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeLocIdxForScan, setActiveLocIdxForScan] = useState(null);
  const [lastActiveLocIdx, setLastActiveLocIdx] = useState(null);
  const [validatingCoil, setValidatingCoil] = useState(false);
  const [laserCaptureMode, setLaserCaptureMode] = useState(null);
  const [laserCoilLocIdx, setLaserCoilLocIdx] = useState(null);

  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);
  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const scanBtnCount = (showPhoneQr ? 1 : 0) + (laserScan ? 1 : 0);
  const scanBtnFill = scanBtnCount > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  const coilInputRefs = useRef([]);
  const scanToastRef = useRef({});
  const laserCaptureModeRef = useRef(null);
  const laserCoilLocIdxRef = useRef(null);
  const lastActiveLocIdxRef = useRef(null);
  const scanLocIdxRef = useRef(null);
  const tryAddCoilRef = useRef(async () => {});
  const processLocationScanRef = useRef(async () => {});
  const addLocationToListRef = useRef(() => false);
  const sopAckRef = useRef(null);

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);

  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);

  const clearLocSearch = () => {
    setScanStatus(null);
    setMatchedLoc(null);
    setSelectedLocId(null);
  };

  const startLaserCoilScan = useCallback((li) => {
    setLaserCoilLocIdx(li);
    laserCoilLocIdxRef.current = li;
    setLastActiveLocIdx(li);
    lastActiveLocIdxRef.current = li;
    laserCaptureModeRef.current = "coil";
    setLaserCaptureMode("coil");
  }, []);

  const resetForm = useCallback(() => {
    setRemarks("");
    setLocations([]);
    setLocHasError([]);
    clearLocSearch();
    setIsScannerOpen(false);
    setActiveLocIdxForScan(null);
    setLastActiveLocIdx(null);
    lastActiveLocIdxRef.current = null;
    setSaving(false);
    setValidatingCoil(false);
    setLaserCoilLocIdx(null);
    laserCoilLocIdxRef.current = null;
    if (laserScan || isLaserScanEnabled()) {
      laserCaptureModeRef.current = "location";
      setLaserCaptureMode("location");
    } else {
      laserCaptureModeRef.current = null;
      setLaserCaptureMode(null);
    }
  }, [laserScan]);

  useEffect(() => {
    let cancelled = false;
    if (!open) {
      setFormReady(false);
      resetForm();
      return undefined;
    }

    const bootstrap = async () => {
      setFormReady(false);
      resetForm();
      if (!editId || !isEdit) {
        if (!cancelled) setFormReady(true);
        return;
      }
      try {
        const res = await inventoryInwardService.getById(editId);
        if (cancelled) return;
        const d = res?.data;
        if (!d) {
          showScanToast("error", "load-fail", "Could not load the store-in entry. Please try again.");
          return;
        }
        setRemarks(d.remarks || "");

        let locGroups = Array.isArray(d.locations) ? d.locations : [];
        if (!locGroups.length && Array.isArray(d.coils) && d.coils.length) {
          const map = {};
          d.coils.forEach((c) => {
            const lid = c.location_id;
            if (lid == null) return;
            if (!map[lid]) {
              const name =
                String(c.location_no || "").trim() ||
                getLocationDisplayNo(c) ||
                String(lid);
              map[lid] = { location_id: lid, name, location_no: name, coils: [] };
            }
            map[lid].coils.push(c);
          });
          locGroups = Object.values(map);
        }

        const normalized = locGroups.map((loc) => ({
          location_id: loc.location_id,
          name: loc.name || loc.location_no || String(loc.location_id),
          location_no: loc.location_no || loc.name || String(loc.location_id),
          coils: Array.isArray(loc.coils) ? loc.coils : [],
        }));
        setLocations(normalized);
        setLocHasError(normalized.map(() => false));
        if (normalized.length) {
          setLastActiveLocIdx(0);
          lastActiveLocIdxRef.current = 0;
        }
        if (!normalized.length) {
          showScanToast("warning", "no-coils", "No coils are linked to this store-in entry.", 3500);
        }
      } catch (err) {
        if (!cancelled)
          showScanToast(
            "error",
            "load-err",
            err?.message || "Could not load the store-in entry. Please try again."
          );
      } finally {
        if (!cancelled) setFormReady(true);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // Intentionally omit resetForm — device scan settings must not re-clear loaded edit data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId, isEdit]);

  const fetchLocations = useCallback(async (params) => {
    const res = await storeLocationService.getViews({
      ...params,
      permission_module: MODULE,
      permission_action: "view",
      sortBy: "location_no",
      order: "ASC",
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    const data = list.map(normalizeLoc).filter((r) => String(r.location_no || "").trim());
    return withSortedViewsData({ ...res, data }, "location_no");
  }, []);

  const getLocationById = useCallback(async (id) => {
    const res = await storeLocationService.getViews({
      id,
      permission_module: MODULE,
      permission_action: "view",
    });
    const row = res?.data;
    if (!row) return res;
    const normalized = normalizeLoc(row);
    if (!String(normalized.location_no || "").trim()) {
      return { ...res, data: null };
    }
    return { ...res, data: normalized };
  }, []);

  const lookupLocation = async (locationNoOrId) => {
    setScanStatus("checking");
    try {
      let matched = null;
      const key = String(locationNoOrId || "").trim();

      if (/^\d+$/.test(key)) {
        const byId = await getLocationById(Number(key));
        if (byId?.data) matched = byId.data;
      }

      if (!matched) {
        const listRes = await storeLocationService.getViews({
          search: key,
          permission_module: MODULE,
          permission_action: "view",
          page: 1,
          limit: 50,
          sortBy: "location_no",
          order: "ASC",
        });
        const list = (Array.isArray(listRes?.data) ? listRes.data : []).map(normalizeLoc);
        const upper = key.toUpperCase();
        matched =
          list.find((r) => String(r.location_no || "").toUpperCase() === upper) ||
          (list.length === 1 ? list[0] : null);
      }

      if (!matched) {
        setMatchedLoc(null);
        setScanStatus("not_found");
        return null;
      }

      setMatchedLoc(matched);
      setSelectedLocId(String(matched.location_id));
      setScanStatus("matched");
      return matched;
    } catch {
      setMatchedLoc(null);
      setScanStatus("not_found");
      return null;
    }
  };

  const addLocationToList = useCallback(
    (locToAdd, opts = {}) => {
      if (!locToAdd?.location_id) return false;
      const fromLaserScan = !!opts.fromLaserScan;
      const locName = locToAdd.location_no || getLocationDisplayNo(locToAdd);
      const existingIdx = locationsRef.current.findIndex(
        (l) => Number(l.location_id) === Number(locToAdd.location_id)
      );

      if (existingIdx >= 0) {
        clearLocSearch();
        setLastActiveLocIdx(existingIdx);
        lastActiveLocIdxRef.current = existingIdx;
        if (fromLaserScan && getDeviceScanSettings().laserScan) {
          window.setTimeout(() => startLaserCoilScan(existingIdx), 80);
          showScanToast(
            "info",
            `loc-resume-${existingIdx}`,
            MSG.LOCATION_ALREADY_SCANNING(locName),
            2000
          );
        } else if (opts.fromCamera && showPhoneQr) {
          showScanToast(
            "info",
            `loc-resume-cam-${existingIdx}`,
            MSG.LOCATION_ALREADY_SCANNING(locName),
            2000
          );
          window.setTimeout(() => {
            scanLocIdxRef.current = existingIdx;
            setActiveLocIdxForScan(existingIdx);
            setIsScannerOpen(true);
          }, 100);
        } else {
          showScanToast("warning", "loc-dup", MSG.LOCATION_ALREADY_ADDED, SNACK_DUR.med);
        }
        return false;
      }

      const newIdx = locationsRef.current.length;
      setLocations((prev) => [
        ...prev,
        {
          location_id: locToAdd.location_id,
          name: locName,
          location_no: locName,
          coils: [],
        },
      ]);
      setLocHasError((prev) => [...prev, false]);
      clearLocSearch();
      setLastActiveLocIdx(newIdx);
      lastActiveLocIdxRef.current = newIdx;

      const { laserScan: laserOn, keyboardType: keyboardOn } = getDeviceScanSettings();
      if (laserOn && (fromLaserScan || laserCaptureModeRef.current === "location")) {
        window.setTimeout(() => startLaserCoilScan(newIdx), 80);
      } else if (!laserOn && keyboardOn) {
        setTimeout(() => coilInputRefs.current[newIdx]?.focus(), 200);
      }
      return true;
    },
    [showScanToast, startLaserCoilScan, showPhoneQr]
  );

  useEffect(() => {
    addLocationToListRef.current = addLocationToList;
  }, [addLocationToList]);

  useEffect(() => {
    lastActiveLocIdxRef.current = lastActiveLocIdx;
  }, [lastActiveLocIdx]);

  const handleSelectChange = (id, pickedRow) => {
    if (id == null || id === "") {
      clearLocSearch();
      return Promise.resolve(null);
    }

    if (pickedRow && (pickedRow.location_id != null || pickedRow.id != null)) {
      const matched = normalizeLoc(pickedRow);
      if (!String(matched.location_no || "").trim()) {
        clearLocSearch();
        return Promise.resolve(null);
      }
      setMatchedLoc(matched);
      setSelectedLocId(String(matched.location_id));
      setScanStatus("matched");
      return Promise.resolve(matched);
    }

    const normalizedLocationNo = extractLocationNo(id);
    if (!normalizedLocationNo) {
      clearLocSearch();
      if (id) {
        showScanToast("error", "loc-reject", SCAN_SNACK_MSG.REJECTED);
      }
      return Promise.resolve(null);
    }
    return lookupLocation(normalizedLocationNo);
  };

  const handleSelectChangeRef = useRef(handleSelectChange);
  handleSelectChangeRef.current = handleSelectChange;

  const processLocationScan = useCallback(
    async (rawValue, opts = {}) => {
      const trimmed = normalizeScanInput(rawValue);
      if (!trimmed) return false;

      if (extractCoilUid(trimmed) && /^RM_/i.test(trimmed)) {
        showScanToast("error", "generic-scan-step1", SCAN_SNACK_MSG.REJECTED);
        return false;
      }

      const locNo = extractLocationNo(trimmed);
      if (!locNo) {
        showScanToast("error", "invalid-loc", SCAN_SNACK_MSG.REJECTED);
        return false;
      }

      const matched = await handleSelectChangeRef.current(locNo);
      if (!matched) return false;

      if (opts.autoAdd !== false) {
        const added = addLocationToListRef.current(matched, {
          fromLaserScan: !!opts.fromLaserScan,
          fromCamera: !!opts.fromCamera,
        });
        if (added) void playScanSuccessBeep();
      }
      return true;
    },
    [showScanToast]
  );

  useEffect(() => {
    processLocationScanRef.current = processLocationScan;
  }, [processLocationScan]);

  const handleAddLocation = () => {
    if (matchedLoc) addLocationToList(matchedLoc);
  };

  const handleRemoveLoc = (li) => {
    setLocations((prev) => prev.filter((_, i) => i !== li));
    setLocHasError((prev) => prev.filter((_, i) => i !== li));
    if (lastActiveLocIdxRef.current === li) {
      setLastActiveLocIdx(null);
      lastActiveLocIdxRef.current = null;
    } else if (lastActiveLocIdxRef.current != null && lastActiveLocIdxRef.current > li) {
      const next = lastActiveLocIdxRef.current - 1;
      setLastActiveLocIdx(next);
      lastActiveLocIdxRef.current = next;
    }
    if (laserCoilLocIdxRef.current === li) {
      setLaserCoilLocIdx(null);
      laserCoilLocIdxRef.current = null;
      laserCaptureModeRef.current = "location";
      setLaserCaptureMode("location");
    } else if (laserCoilLocIdxRef.current != null && laserCoilLocIdxRef.current > li) {
      const next = laserCoilLocIdxRef.current - 1;
      setLaserCoilLocIdx(next);
      laserCoilLocIdxRef.current = next;
    }
  };

  const tryAddCoil = async (li, val) => {
    const locRow = locationsRef.current[li];
    if (!locRow?.location_id) {
      showScanToast("error", "need-location", "Add a location first (Step 1).");
      return;
    }

    const uid = extractCoilUid(val);
    if (!uid) {
      showScanToast("error", "invalid-coil", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    const allFlat = flatCoilsByLocation(locationsRef.current);
    const dup = allFlat.find((x) => x.coilUid.toLowerCase() === uid.toLowerCase());
    if (dup) {
      if (dup.locIndex === li) {
        showScanToast("error", `dup-${uid}`, MSG.COIL_DUPLICATE(uid), 1800);
      } else {
        showScanToast("error", `dup-other-${uid}`, MSG.COIL_DUPLICATE_OTHER(dup.locName), 2200);
      }
      return;
    }

    setValidatingCoil(true);
    setLastActiveLocIdx(li);
    lastActiveLocIdxRef.current = li;
    try {
      const res = await coilService.getByUid(uid);
      const coil = res?.data;
      if (!coil) {
        showScanToast("error", "coil-missing", MSG.COIL_NOT_FOUND);
        return;
      }
      const status = String(coil.status || "active").toLowerCase();
      if (status !== "active") {
        showScanToast("error", "coil-status", `Coil ${uid} is not available. Its current status is ${status}.`);
        return;
      }
      if (coil.location_id) {
        const sameInward =
          editId != null &&
          coil.in_uid != null &&
          Number(coil.in_uid) === Number(editId);
        if (!sameInward) {
          showScanToast("error", "coil-stored", MSG.COIL_ALREADY_STORED);
          return;
        }
      }

      setLocations((prev) =>
        prev.map((loc, i) => (i === li ? { ...loc, coils: [...loc.coils, coil] } : loc))
      );
      setLocHasError((prev) => prev.map((e, i) => (i === li ? false : e)));
      showScanSuccess("coil-ok", `Added ${coil.coil_no_uid}`, 1600);
    } catch (err) {
      showScanToast("error", "coil-err", err?.message || MSG.COIL_NOT_FOUND);
    } finally {
      setValidatingCoil(false);
    }
  };

  tryAddCoilRef.current = tryAddCoil;

  const handleRemoveCoil = useCallback((li, bi) => {
    setLocations((prev) =>
      prev.map((loc, i) =>
        i !== li ? loc : { ...loc, coils: loc.coils.filter((_, j) => j !== bi) }
      )
    );
  }, []);

  const locationMrnSummary = useMemo(() => buildLocationMrnBreakdown(locations), [locations]);

  const rollup = useMemo(
    () =>
      locations.reduce(
        (acc, loc) => {
          const t = locationCoilTotals(loc.coils);
          return {
            locs: acc.locs + 1,
            coils: acc.coils + t.coilCount,
            qty: acc.qty + t.totalQty,
          };
        },
        { locs: 0, coils: 0, qty: 0 }
      ),
    [locations]
  );

  const startLaserLocationScan = useCallback(() => {
    setLaserCaptureMode("location");
    laserCaptureModeRef.current = "location";
    setLaserCoilLocIdx(null);
    laserCoilLocIdxRef.current = null;
  }, []);

  const onLocationStepLaserScan = useCallback((code) => {
    void processLocationScanRef.current(code, { fromLaserScan: true });
  }, []);

  const onCoilLaserScan = useCallback(
    (li) => (code) => {
      void tryAddCoilRef.current(li, code);
    },
    []
  );

  const handleLaserScanRejected = useCallback(
    ({ reason }) => {
      if (reason === "empty") {
        showScanToast("error", "laser-empty-scan", SCAN_SNACK_MSG.REJECTED, 1800);
      }
    },
    [showScanToast]
  );

  const laserScanActive =
    open && formReady && Boolean(laserCaptureMode) && (laserScan || isLaserScanEnabled());

  const startCameraScanner = (target) => {
    void unlockScanAudio().catch(() => {});
    if (target === "location") {
      scanLocIdxRef.current = null;
      setActiveLocIdxForScan(null);
    } else {
      scanLocIdxRef.current = target;
      setActiveLocIdxForScan(target);
      setLastActiveLocIdx(target);
      lastActiveLocIdxRef.current = target;
    }
    setIsScannerOpen(true);
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setActiveLocIdxForScan(null);
    scanLocIdxRef.current = null;
  };

  const handleCameraDecoded = (decodedText) => {
    const locIdx = scanLocIdxRef.current;
    closeScanner();
    if (locIdx != null) {
      void tryAddCoilRef.current(locIdx, decodedText);
    } else {
      void processLocationScanRef.current(decodedText, { fromCamera: true });
    }
  };

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen,
    elementId: INWARD_SCANNER_ELEMENT_ID,
    onDecoded: handleCameraDecoded,
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: (err) => {
      const isDenied = /NotAllowed|Permission|denied/i.test(String(err?.message || err || ""));
      showScanToast(
        "error",
        "camera-permission",
        isDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
        10000
      );
      closeScanner();
    },
  });

  useEffect(() => {
    if (!isScannerOpen) return;
    void (async () => {
      const prep = await prepareQrScanSession();
      if (!prep.cameraOk) {
        showScanToast(
          "error",
          "camera-list",
          prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
          4000
        );
        closeScanner();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScannerOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "d") return;
      e.preventDefault();
      const li = lastActiveLocIdx ?? (locations.length > 0 ? locations.length - 1 : null);
      if (li !== null && locations[li]?.coils?.length > 0) {
        handleRemoveCoil(li, locations[li].coils.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lastActiveLocIdx, locations, handleRemoveCoil]);

  const validate = () => {
    if (locations.length === 0) {
      showScanToast("error", "save-loc", "Add at least one location.");
      return false;
    }
    const errs = locations.map((loc) => !loc.coils?.length);
    setLocHasError(errs);
    if (errs.some(Boolean)) {
      showScanToast("error", "save-coils", MSG.LOCATION_AT_LEAST_ONE_COIL, SNACK_DUR.med);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;

    setSaving(true);
    try {
      const payload = {
        remarks: remarks || null,
        locations: locations.map((loc) => ({
          location_id: loc.location_id,
          coils: (loc.coils || []).map((c) => ({ coil_no_uid: c.coil_no_uid })),
        })),
      };
      let res;
      if (isEdit && editId) {
        res = await inventoryInwardService.update(editId, payload);
        showScanToast("success", "save-ok", res?.message || MSG.INWARD_UPDATED, 2800);
      } else {
        res = await inventoryInwardService.create(payload);
        showScanToast("success", "save-ok", res?.message || MSG.INWARD_CREATED, 2800);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      showScanToast("error", "save-fail", err?.message || MSG.INWARD_FAILED, 4000);
    } finally {
      setSaving(false);
    }
  };

  const drawerTitle = isEdit ? "Edit Store In Entry" : "New Store In Entry";
  const drawerDesc = isEdit
    ? "Update the locations and coils for this store-in entry"
    : "Record a new store-in stock entry";

  const activeCoilRow = laserCoilLocIdx ?? lastActiveLocIdx;
  const scanTargetIsCoil = activeLocIdxForScan != null;

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={onClose}
        onSubmit={handleSave}
        title={drawerTitle}
        description={drawerDesc}
        footer={
          <RmStoreDrawerFooter
            onClose={onClose}
            loading={saving}
            disabled={!formReady}
            onSave={handleSave}
            saveLabel={isEdit ? "Update" : "Save"}
          />
        }
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4 pb-4">
          {!formReady ? (
            <FormPanelLoader
              label="Loading store-in entry..."
              hint="Preparing locations and scanned coils."
            />
          ) : (
          <>
          <QrScannerOverlay
            open={isScannerOpen}
            onClose={closeScanner}
            readerId={INWARD_SCANNER_ELEMENT_ID}
            hint={scanTargetIsCoil ? "Scanning Coils" : "Scanning Location"}
            frameClassName={
              scanTargetIsCoil
                ? "border-4 border-inward-box-scanner-frame"
                : "border-4 border-inward-loc-scanner-frame"
            }
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
          />

          {/* ── Step 1: Location ── */}
          <div className="bg-inward-loc-panel-bg p-3 rounded-xl border border-inward-loc-panel-border space-y-3">
            <label className="text-[10px] font-bold text-inward-loc-label uppercase tracking-widest flex items-center gap-2">
              <MapPin size={14} /> Step 1: Scan Location
            </label>
            <div className="space-y-2 w-full min-w-0">
              {(showPhoneQr || laserScan) ? (
                <div className="flex items-stretch gap-2 w-full min-w-0">
                  {showPhoneQr && (
                    <button
                      type="button"
                      onClick={() => startCameraScanner("location")}
                      className={`h-10 px-3 bg-inward-loc-btn border border-inward-loc-btn-border text-white hover:bg-inward-loc-btn-hover rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-2 ${scanBtnFill}`}
                      title="Scan location QR"
                    >
                      <QrCode size={16} />
                      <span className="text-[10px] font-black uppercase">QR</span>
                    </button>
                  )}
                  {laserScan && (
                    laserCaptureMode === "location" ? (
                      <LaserScanField
                        active={laserScanActive && laserCaptureMode === "location"}
                        onBeforeArm={startLaserLocationScan}
                        onScanned={onLocationStepLaserScan}
                        onScanRejected={handleLaserScanRejected}
                        formatPreview={locationNoDisplayLabel}
                        compact
                        heightClass="h-10"
                        fill={scanBtnCount > 0}
                        armButtonLabel="Scan Loc"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={startLaserLocationScan}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold uppercase tracking-wide transition-all bg-white border-slate-200 text-slate-600 hover:bg-slate-50 px-2.5 text-[10px] h-10 min-w-[4.25rem] ${scanBtnFill}`}
                        title="Scan location"
                      >
                        <ScanLine size={14} className="shrink-0" aria-hidden />
                        Scan Loc
                      </button>
                    )
                  )}
                </div>
              ) : null}
              {keyboardType && (
                <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
                  <div className="flex-1 min-w-[10rem] text-[11px]">
                    <SearchableSelect
                      placeholder={MSG.LOCATION_SEARCH_PLACEHOLDER}
                      value={selectedLocId}
                      onChange={handleSelectChange}
                      fetchService={fetchLocations}
                      getByIdService={getLocationById}
                      dataKey="id"
                      labelKey="location_no"
                      labelOnlyDisplay
                      usePortal={false}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLocation}
                    disabled={scanStatus !== "matched"}
                    className="h-10 shrink-0 px-4 bg-inward-loc-btn hover:bg-inward-loc-btn-hover border border-inward-loc-btn-border text-white font-bold text-[10px] uppercase rounded-lg transition-all shadow-md inline-flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              )}
              {!laserScan && !keyboardType && !showPhoneQr && (
                <p className="h-[40px] flex items-center px-3 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg w-full">
                  Enable the laser scanner, keyboard input, or phone QR scanner in Settings.
                </p>
              )}
            </div>

            {scanStatus === "checking" && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-inward-loc-muted-bg rounded-lg border border-inward-loc-muted-border animate-pulse">
                <Loader2 size={12} className="text-inward-loc-spinner animate-spin" />
                <p className="text-[9px] font-bold text-inward-loc-spinner-text uppercase">{MSG.LOCATION_SEARCHING}</p>
              </div>
            )}
            {scanStatus === "matched" && matchedLoc && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg animate-in zoom-in-95">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <div className="flex-1">
                  <p className="text-[10px] font-black text-emerald-800 uppercase leading-none">
                    Location Found: {matchedLoc.location_no}
                  </p>
                  <p className="text-[8px] font-bold text-emerald-600/70 uppercase mt-0.5">Ready to add</p>
                </div>
              </div>
            )}
            {scanStatus === "not_found" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg">
                <XCircle size={16} className="text-rose-500" />
                <p className="text-[10px] font-bold text-rose-600 uppercase leading-none">{MSG.LOCATION_NOT_FOUND}</p>
              </div>
            )}
          </div>

          {/* ── Step 2: Coils into Locations ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold text-inward-box-label uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="text-inward-box-btn" /> Step 2: Scan Coils into Locations
              </label>
              {locations.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <span className="text-[9px] font-black text-inward-loc-badge-text bg-inward-loc-badge-bg px-2 py-0.5 rounded-md border border-inward-loc-badge-border whitespace-nowrap">
                    {rollup.locs} LOCATION{rollup.locs === 1 ? "" : "S"}
                  </span>
                  <span className="text-[9px] font-black text-inward-box-chip-text bg-inward-box-chip-bg px-2 py-0.5 rounded-md border border-inward-box-chip-border whitespace-nowrap">
                    {rollup.coils} COILS
                  </span>
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 whitespace-nowrap">
                    QTY {rollup.qty}
                  </span>
                </div>
              )}
            </div>

            {locations.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {locations.map((loc, li) => {
                  const { coilCount, totalQty } = locationCoilTotals(loc.coils);
                  return (
                    <div
                      key={`${loc.location_id}-${li}`}
                      className={`bg-white rounded-xl border transition-all overflow-hidden shadow-sm ${
                        locHasError[li] ? "border-rose-200 shadow-rose-50" : "border-slate-200"
                      }`}
                    >
                      <div className="px-3 py-2 bg-inward-loc-header-bg border-b border-inward-loc-header-border flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-7 h-7 bg-inward-loc-header-icon-bg rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
                            <MapPin size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Location</p>
                            <p className="text-xs font-black text-slate-800 uppercase leading-none truncate">{loc.name || loc.location_no}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-baseline gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 shadow-sm tabular-nums">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Coils</span>
                            <span className="text-sm font-black text-inward-box-stat-text leading-none">{coilCount}</span>
                          </div>
                          <div className="flex items-baseline gap-1 px-2 py-1 rounded-md bg-white border border-emerald-100 shadow-sm tabular-nums">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Qty</span>
                            <span className="text-sm font-black text-emerald-700 leading-none">{totalQty}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLoc(li)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                            aria-label="Remove location"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 space-y-3 bg-inward-box-panel-bg border-t border-inward-box-panel-border/60">
                        <div className="space-y-2 w-full min-w-0">
                          {(showPhoneQr || laserScan) ? (
                            <div className="flex items-stretch gap-2 w-full min-w-0">
                              {showPhoneQr && (
                                <button
                                  type="button"
                                  onClick={() => startCameraScanner(li)}
                                  className={`h-10 px-3 bg-inward-box-btn border border-inward-box-btn-border text-white hover:bg-inward-box-btn-hover rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-2 ${scanBtnFill}`}
                                  title="Scan Coil QR"
                                >
                                  <Camera size={16} />
                                  <span className="text-[10px] font-black uppercase">QR</span>
                                </button>
                              )}
                              {laserScan && (
                                activeCoilRow === li && laserCaptureMode === "coil" ? (
                                  <LaserScanField
                                    active={laserScanActive && laserCaptureMode === "coil"}
                                    onBeforeArm={() => startLaserCoilScan(li)}
                                    onScanned={onCoilLaserScan(li)}
                                    onScanRejected={handleLaserScanRejected}
                                    formatPreview={coilUidDisplayLabel}
                                    compact
                                    heightClass="h-10 sm:h-[38px]"
                                    fill={scanBtnCount > 0}
                                    armButtonLabel="Scan Coil"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startLaserCoilScan(li)}
                                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold uppercase tracking-wide transition-all bg-white border-slate-200 text-slate-600 hover:bg-slate-50 px-2.5 text-[10px] h-10 sm:h-[38px] min-w-[4.25rem] ${scanBtnFill}`}
                                  >
                                    <ScanLine size={14} className="shrink-0" aria-hidden />
                                    Scan Coil
                                  </button>
                                )
                              )}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
                            {loc.coils.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCoil(li, loc.coils.length - 1)}
                                className="h-10 shrink-0 px-3 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-2"
                                title="Delete Last Coil (Ctrl+D)"
                              >
                                <Trash2 size={16} />
                                <span className="text-[10px] font-black uppercase">Delete Last</span>
                              </button>
                            )}
                            {keyboardType && (
                              <div className="relative flex-1 min-w-[10rem]">
                                <ScanLine size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-inward-box-input-icon z-[1]" />
                                <input
                                  ref={(el) => {
                                    coilInputRefs.current[li] = el;
                                  }}
                                  data-allow-scan-keyboard="true"
                                  placeholder={getScanInputPlaceholder()}
                                  disabled={validatingCoil}
                                  className="w-full bg-white border rounded-lg pl-8 pr-3 font-mono text-[10px] h-10 sm:h-[38px] text-slate-800 outline-none transition-all appearance-none border-inward-box-input-border focus:border-inward-box-btn focus:ring-2 focus:ring-inward-box-focus-ring"
                                  onFocus={() => {
                                    setLastActiveLocIdx(li);
                                    lastActiveLocIdxRef.current = li;
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const inputValue = e.target.value;
                                      void tryAddCoil(li, inputValue);
                                      e.target.value = "";
                                    }
                                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
                                      e.preventDefault();
                                      if (loc.coils.length > 0) {
                                        handleRemoveCoil(li, loc.coils.length - 1);
                                      }
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {validatingCoil && lastActiveLocIdx === li && (
                          <div className="flex items-center gap-2 px-2 py-1 bg-inward-box-muted-bg border border-inward-box-muted-border rounded-lg">
                            <Loader2 size={12} className="animate-spin text-inward-box-spinner" />
                            <p className="text-[9px] font-bold text-inward-box-spinner-text uppercase">Validating coil...</p>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          {loc.coils.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 p-2 bg-inward-box-dash-bg rounded-lg border border-dashed border-inward-box-dash-border">
                              {loc.coils.map((c, bi) => (
                                <div
                                  key={`${c.coil_no_uid}-${bi}`}
                                  title={`${c.item_code || "—"} · ${c.item_desc || "—"} · Heat ${c.heat_no || "—"} · Qty ${c.qty ?? "—"}`}
                                  className="flex items-start gap-1 pl-2 pr-1 py-1 bg-inward-box-chip-bg border border-inward-box-chip-border rounded-md shadow-sm animate-in zoom-in-95 max-w-[240px]"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-[10px] font-mono font-black text-inward-box-chip-text">{c.coil_no_uid}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCoil(li, bi)}
                                    className="p-0.5 text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                                    aria-label={`Remove ${c.coil_no_uid}`}
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-4 flex flex-col items-center justify-center bg-inward-box-empty-bg rounded-lg border border-dashed border-inward-box-empty-border">
                              <Package size={16} className="text-inward-box-empty-icon mb-1" />
                              <p className="text-[9px] font-bold text-inward-box-empty-text uppercase italic">No coils scanned yet</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 bg-white border border-dashed border-slate-200 rounded-2xl text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <Locate size={24} className="text-slate-200" />
                </div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{MSG.LOCATION_EMPTY_TITLE}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{MSG.LOCATION_EMPTY_SUBTITLE}</p>
              </div>
            )}
          </div>

          {/* ── Remarks ── */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm min-w-0">
            <RemarksTextarea
              label="Remarks / Note"
              labelIcon={<MessageSquare size={14} className="text-inward-loc-label" />}
              value={remarks}
              onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
              placeholder={MSG.REMARKS_PLACEHOLDER}
              rows={4}
            />
          </div>

          {/* ── Inward Summary ── */}
          {locationMrnSummary.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-4 px-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Store In Summary</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locationMrnSummary.map((block) => (
                  <div key={block.locLabel} className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-inward-loc-label font-bold text-xs uppercase">
                        <MapPin size={12} />
                        {block.locLabel}
                      </div>
                      <p className="text-[10px] font-bold text-slate-600 tabular-nums pl-4">
                        <span className="text-slate-400 font-black uppercase text-[9px] mr-1">Total</span>
                        {block.coilCount} coil{block.coilCount === 1 ? "" : "s"}
                        <span className="text-slate-300 mx-1.5">·</span>
                        <span className="text-emerald-700">{block.totalQty}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase ml-0.5">qty</span>
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-100 overflow-hidden shadow-sm">
                      <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-100 px-3 py-1.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">MRN</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase text-right">Coils</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase text-right">Qty</span>
                      </div>
                      <div className="bg-white divide-y divide-slate-50">
                        {block.rows.map((row) => (
                          <div key={`${block.locLabel}-${row.mrnLabel}`} className="grid grid-cols-3 px-3 py-2 text-[11px]">
                            <span className="font-medium text-slate-700">{row.mrnLabel}</span>
                            <span className="font-bold text-slate-900 text-right tabular-nums">{row.coilCount}</span>
                            <span className="font-bold text-emerald-700 text-right tabular-nums">{row.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEdit && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <p className="text-[10px] text-emerald-700 italic">This entry remains approved by default.</p>
            </div>
          )}
          </>
          )}

          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={`${open}-${sopPermissionType}`}
            moduleSlug={MODULE}
            permissionType={sopPermissionType}
            isOpen={open}
          />
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
