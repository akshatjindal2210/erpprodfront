"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { Check, Loader2, QrCode, MapPin, Package, Plus, X, Trash2, MessageSquare, CheckCircle2, XCircle, Search, ScanLine, Camera, Locate, Layers } from "lucide-react";
import { inventoryInwardService } from "@/features/apps/ims/services/inventoryInward";
import { locationService }        from "@/features/apps/ims/services/location";
import { extractLocationNo, detectQrType, extractBoxCode } from "@/features/apps/ims/helpers/qrScan";
import { useHtml5QrScanner }      from "@/core/hooks/useHtml5QrScanner";
import QrScannerOverlay           from "@/core/components/common/QrScannerOverlay";
import Drawer                     from "@/core/components/ui/Drawer";
import FormPanelLoader            from "@/core/components/common/FormPanelLoader";
import ModuleSopAcknowledgment    from "@/core/components/common/ModuleSopAcknowledgment";
import Snackbar                   from "@/core/components/ui/Snackbar";
import SearchableSelect           from "@/core/components/common/SearchableSelect";
import RemarksTextarea            from "@/core/components/common/RemarksTextarea";
import { useCanAccess }           from "@/core/hooks/useCanAccess";
import { isMobileDevice }         from "@/core/utils/pwa";
import { SCAN_SNACK_MSG, FLOW_SCAN_CAMERA_INSECURE_MSG, useScanSnackbarActions } from "@/core/utils/global";
import { prepareQrScanSession, unlockScanAudio }   from "@/features/apps/ims/helpers/scanFeedback";
import { createScanBatchQueue }   from "@/features/apps/ims/helpers/scanBatchQueue";
import { withSortedViewsData } from "@/features/apps/ims/helpers/sortDropdownResponse";
/** Picker row: show location no only (never numeric DB id in the UI). */
function normalizeInwardLocationRow(row) {
  if (!row || typeof row !== "object") return row;
  const location_id = row.location_id ?? row.id ?? null;
  const locationNo =
    String(row.location_no ?? "").trim() ||
    `${row.rack_no ?? ""}${String(row.shelf_no ?? "").toUpperCase()}`.trim();
  return {
    ...row,
    id: location_id,
    location_id,
    location_no: locationNo,
  };
}

const MSG = {
  LOCATION_ALREADY_ADDED:          "This location has already been added.",
  LOCATION_NOT_FOUND:              "No location found. Please check location no or scan again.",
  LOCATION_FETCH_FAILED:           "Failed to fetch location details. Please try again.",
  LOCATION_SEARCHING:              "Searching location...",
  LOCATION_AT_LEAST_ONE_BOX:       "Please add at least one box to this location.",
  LOCATION_EMPTY_STATE_TITLE:      "No locations added yet.",
  LOCATION_EMPTY_STATE_SUBTITLE:   "Search or scan a location to start adding boxes.",
  BOX_DUPLICATE_OTHER:             (locName) => `This box is already assigned to "${locName}".`,
  BOX_PLACEHOLDER:                 "Scan Box UID or type Box UID, then press Enter...",
  INWARD_CREATED:                  "Inward entry recorded successfully.",
  INWARD_UPDATED:                  "Inward entry updated successfully.",
  INWARD_FAILED:                   "Operation failed. Please try again.",
  REMARKS_PLACEHOLDER:             "Add any notes or remarks for this inward entry...",
  LOCATION_SEARCH_PLACEHOLDER:     "Search by location no...",
  BOX_REMOVED_OK:                  (boxNoUid) => `Box removed: ${boxNoUid}`,
};

/** @returns {{ boxNoUid: string, qty: number, packing_number: string | null } | null} */
function normalizeInwardBoxEntry(b) {
  if (b == null) return null;
  if (typeof b === "string" || typeof b === "number") {
    const s = String(b).trim();
    return s ? { boxNoUid: s, qty: 0, packing_number: null } : null;
  }
  if (typeof b === "object") {
    const id = b.boxNoUid ?? b.box_no_uid ?? "";
    const s = String(id).trim();
    if (!s) return null;
    const q = b.qty != null ? Number(b.qty) : 0;
    const pnRaw = b.packing_number ?? b.packingNumber;
    const packing_number = pnRaw != null && String(pnRaw).trim() !== "" ? String(pnRaw).trim() : null;
    return {
      boxNoUid: s,
      qty: Number.isFinite(q) ? q : 0,
      packing_number,
      _pending: !!b._pending,
      _pendingId: b._pendingId ?? null,
      _candidate: b._candidate ?? null,
    };
  }
  return null;
}

function boxEntryMatchesCode(entry, code) {
  if (!entry || !code) return false;
  const normalized = String(code).trim().toLowerCase();
  return (
    String(entry.boxNoUid ?? "").trim().toLowerCase() === normalized ||
    String(entry._candidate ?? "").trim().toLowerCase() === normalized
  );
}

function flatBoxesByLocation(locs) {
  return locs.flatMap((loc, li) =>
    loc.boxes
      .map((box) => normalizeInwardBoxEntry(box))
      .filter(Boolean)
      .map((entry) => ({ locIndex: li, locName: loc.name, box: entry.boxNoUid }))
  );
}

/** @returns {{ boxCount: number, totalQty: number }} */
function inwardLocationTotals(boxes) {
  const list = (boxes || []).map(normalizeInwardBoxEntry).filter(Boolean);
  return {
    boxCount: list.length,
    totalQty: list.reduce((sum, x) => sum + x.qty, 0),
  };
}

/** Distinct packing groups among all scanned boxes (missing packing counts as one bucket). */
function distinctPackingGroupCount(locations) {
  const set = new Set();
  (locations || []).forEach((loc) => {
    (loc.boxes || []).forEach((b) => {
      const e = normalizeInwardBoxEntry(b);
      if (!e) return;
      set.add(e.packing_number ?? "__none__");
    });
  });
  return set.size;
}

/** For summary under remarks: per location → packing label → box count (+ loc totals) */
function buildLocationPackingBreakdown(locations) {
  return (locations || [])
    .map((loc) => {
      const byPack = new Map();
      let totalQty = 0;
      (loc.boxes || []).forEach((b) => {
        const e = normalizeInwardBoxEntry(b);
        if (!e) return;
        totalQty += e.qty;
        const label = e.packing_number && e.packing_number.trim() !== "" ? e.packing_number.trim() : "—";
        byPack.set(label, (byPack.get(label) || 0) + 1);
      });
      const rows = Array.from(byPack.entries()).map(([packingLabel, boxCount]) => ({ packingLabel, boxCount }));
      return {
        locName: loc.name ?? "—",
        totalBoxes: rows.reduce((s, r) => s + r.boxCount, 0),
        totalQty,
        rows,
      };
    })
    .filter((x) => x.rows.length > 0);
}

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "success", title: "", message: "", duration: SNACK_DUR.med };
const INWARD_SCANNER_ELEMENT_ID = "inward-modal-scanner-reader";

const INITIAL_FORM = {
  remarks:  "",
};

export default function InwardModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const [formReady, setFormReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm]       = useState(INITIAL_FORM);
  const [errors, setErrors]   = useState({});
  
  const isEdit = mode === "edit";
  const sopPermissionType = isEdit ? "edit" : "add";

  const [locations, setLocations]         = useState([]);
  const locationsRef                     = useRef([]);
  locationsRef.current                   = locations;
  const [locHasError, setLocHasError]     = useState([]);

  const [scanStatus, setScanStatus]       = useState(null);
  const [scanning, setScanning]           = useState(false);
  const [matchedLoc, setMatchedLoc]       = useState(null);
  const [selectedLocId, setSelectedLocId] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeLocIdxForScan, setActiveLocIdxForScan] = useState(null);
  const [lastActiveLocIdx, setLastActiveLocIdx] = useState(null);
  const [validatingBox, setValidatingBox] = useState(false);
  const [pendingScanCount, setPendingScanCount] = useState(0);

  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

  const fetchLocations = useCallback(async (params) => {
    const res = await locationService.getViews({
      ...params,
      permission_module: "inventory_inwards",
      permission_action: "view",
      sortBy: "location_no",
      order: "ASC",
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    const data = list.map(normalizeInwardLocationRow).filter((r) => String(r.location_no || "").trim());
    return withSortedViewsData({ ...res, data }, "location_no");
  }, []);

  const getLocationById = useCallback(async (id) => {
    const res = await locationService.getViews({
      id,
      permission_module: "inventory_inwards",
      permission_action: "view",
    });
    const row = res?.data;
    if (!row) return res;
    const normalized = normalizeInwardLocationRow(row);
    if (!String(normalized.location_no || "").trim()) {
      return { ...res, data: null };
    }
    return { ...res, data: normalized };
  }, []);

  const scanLocIdxRef = useRef(null);
  const tryAddBoxRef = useRef(async () => {});
  const lastScanRef = useRef({ key: "", at: 0, mode: "" });
  const inFlightScanRef = useRef(new Set());
  const scanToastRef = useRef({});
  const duplicateSnackCooldownRef = useRef({});
  const sopAckRef = useRef(null);
  const scanBatchRef = useRef(null);
  const scanSeqRef = useRef(0);
  const pendingCountRef = useRef(0);
  const cancelledPendingIdsRef = useRef(new Set());

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);

  const openSnackbar = useCallback((payload) => {
    setSnackbar({
      open: true,
      variant: payload.variant ?? "success",
      title: payload.title ?? "",
      message: payload.message ?? "",
      duration: payload.duration ?? SNACK_DUR.med,
    });
  }, []);

  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);

  // Permissions
  const canAccess = useCanAccess();
  const canEdit = canAccess("inventory_inwards", "edit").allowed;

  const isEditMode = isEdit && canEdit;

  const allBoxesFlat = flatBoxesByLocation(locations);

  const locationPackingSummary = useMemo(() => buildLocationPackingBreakdown(locations), [locations]);

  useEffect(() => {
    if (open) setSnackbar((s) => ({ ...s, open: false }));
  }, [open]);

  // ── Bootstrap form (no fields until data is ready) ─────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (!open) {
      setFormReady(false);
      return undefined;
    }

    const bootstrap = async () => {
      setFormReady(false);
      setIsScannerOpen(false);
      setActiveLocIdxForScan(null);
      setErrors({});
      clearLocSearch();

      if (editData?.in_uid) {
        try {
          const res = await inventoryInwardService.getById(editData.in_uid);
          if (cancelled) return;
          if (res?.success && res.data) {
            const d = res.data;
            setForm({ remarks: d.remarks || "" });
            setLocations(
              (d.locations || []).map((loc) => ({
                ...loc,
                boxes: (loc.boxes || [])
                  .map((b) => normalizeInwardBoxEntry(b))
                  .filter(Boolean)
                  .map((row) => ({
                    boxNoUid: row.boxNoUid,
                    qty: row.qty,
                    packing_number: row.packing_number,
                  })),
              }))
            );
            setLocHasError((d.locations || []).map(() => false));
          }
        } catch (err) {
          if (!cancelled) {
            openSnackbar({
              variant: "danger",
              title: "Error",
              message: err?.message || "Failed to fetch inward details",
              duration: SNACK_DUR.long,
            });
          }
        }
      } else {
        setForm(INITIAL_FORM);
        setLocations([]);
        setLocHasError([]);
      }

      if (!cancelled) setFormReady(true);
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [open, editData?.in_uid]);

  const clearLocSearch = () => {
    setScanStatus(null);
    setMatchedLoc(null);
    setSelectedLocId(null);
  };

  const handleInputChange = (k, value) => {
    setForm((prev) => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const removePendingBoxById = useCallback((li, pendingId) => {
    setLocations((prev) =>
      prev.map((loc, i) =>
        i !== li
          ? loc
          : {
              ...loc,
              boxes: loc.boxes.filter((b) => normalizeInwardBoxEntry(b)?._pendingId !== pendingId),
            }
      )
    );
  }, []);

  const applyBatchScanResults = useCallback(
    (li, batchItems, results) => {
      const resultMap = new Map((results || []).map((row) => [String(row.id), row]));

      for (const item of batchItems) {
        if (cancelledPendingIdsRef.current.has(item.id)) continue;

        const result = resultMap.get(String(item.id));
        if (!result?.found || !result?.allowed) {
          removePendingBoxById(li, item.id);
          showScanToast(
            "error",
            `batch-fail-${item.id}`,
            result?.message || SCAN_SNACK_MSG.REJECTED,
            2200
          );
          continue;
        }

        const canonical = String(result.box_no_uid).trim();
        const qty = Number(result.qty);
        const packing_number =
          result.packing_number != null && String(result.packing_number).trim() !== ""
            ? String(result.packing_number).trim()
            : null;

        setLocations((prev) => {
          const locRow = prev[li];
          if (!locRow) return prev;

          const withoutThisPending = locRow.boxes.filter(
            (b) => normalizeInwardBoxEntry(b)?._pendingId !== item.id
          );

          const existsInOther = prev.some((loc, idx) =>
            idx !== li &&
            loc.boxes.some((b) => {
              const e = normalizeInwardBoxEntry(b);
              return e && !e._pending && String(e.boxNoUid).toLowerCase() === canonical.toLowerCase();
            })
          );
          if (existsInOther) {
            return prev.map((loc, i) =>
              i === li ? { ...loc, boxes: withoutThisPending } : loc
            );
          }

          const existsSame = withoutThisPending.some((b) => {
            const e = normalizeInwardBoxEntry(b);
            return e && !e._pending && String(e.boxNoUid).toLowerCase() === canonical.toLowerCase();
          });
          if (existsSame) {
            return prev.map((loc, i) =>
              i === li ? { ...loc, boxes: withoutThisPending } : loc
            );
          }

          return prev.map((loc, i) =>
            i === li
              ? {
                  ...loc,
                  boxes: [
                    ...withoutThisPending,
                    { boxNoUid: canonical, qty: Number.isFinite(qty) ? qty : 0, packing_number },
                  ],
                }
              : loc
          );
        });
      }
    },
    [removePendingBoxById, showScanToast]
  );

  const processScanBatch = useCallback(
    async (batch) => {
      const byLocation = new Map();
      for (const item of batch) {
        const locRow = locationsRef.current[item.li];
        const location_id = locRow?.location_id;
        if (!location_id) {
          removePendingBoxById(item.li, item.id);
          continue;
        }
        const key = String(location_id);
        if (!byLocation.has(key)) {
          byLocation.set(key, { li: item.li, location_id, items: [] });
        }
        byLocation.get(key).items.push(item);
      }

      try {
        for (const group of byLocation.values()) {
          const res = await inventoryInwardService.batchScanBoxes(
            group.location_id,
            group.items.map((row) => ({ id: row.id, code: row.code }))
          );
          applyBatchScanResults(group.li, group.items, res?.results);
        }
      } catch (err) {
        for (const item of batch) {
          removePendingBoxById(item.li, item.id);
        }
        showScanToast(
          "error",
          "batch-scan-failed",
          err?.message || "Could not verify scanned boxes. Please try again.",
          2800
        );
      } finally {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - batch.length);
        setPendingScanCount(pendingCountRef.current);
      }
    },
    [applyBatchScanResults, removePendingBoxById, showScanToast]
  );

  useEffect(() => {
    if (!open) {
      scanBatchRef.current = null;
      pendingCountRef.current = 0;
      cancelledPendingIdsRef.current = new Set();
      setPendingScanCount(0);
      return undefined;
    }

    scanBatchRef.current = createScanBatchQueue({
      flushMs: 80,
      maxBatch: 20,
      onFlush: processScanBatch,
    });

    return () => {
      scanBatchRef.current = null;
    };
  }, [open, processScanBatch]);

  const lookupLocation = async (rawLocationValue) => {
    const locationNo = extractLocationNo(rawLocationValue);
    if (!locationNo) return null;
    setScanStatus("checking");
    try {
      let matched = null;

      // 1. Try by location_no filter (strict)
      const byNo = await locationService.getViews({
        page: 1,
        limit: 1,
        filters: { location_no: locationNo },
        permission_module: "inventory_inwards",
        permission_action: "view",
      });
      const byNoList = Array.isArray(byNo?.data?.data) ? byNo.data.data : Array.isArray(byNo?.data) ? byNo.data : [];
      matched = byNoList[0] || null;

      // 2. Fallback: Try by ID if numeric
      if (!matched && /^\d+$/.test(locationNo)) {
        const byId = await locationService.getViews({
          id: locationNo,
          permission_module: "inventory_inwards",
          permission_action: "view",
        });
        matched = byId?.data?.location_id ? byId.data : null;
      }

      // 3. Fallback: Try by search (more flexible)
      if (!matched) {
        const bySearch = await locationService.getViews({
          page: 1,
          limit: 1,
          search: locationNo,
          permission_module: "inventory_inwards",
          permission_action: "view",
        });
        const bySearchList = Array.isArray(bySearch?.data?.data) ? bySearch.data.data : Array.isArray(bySearch?.data) ? bySearch.data : [];
        // Verify it's an exact match for location_no or id
        matched = bySearchList.find(l => 
          String(l.location_no || "").toUpperCase() === locationNo.toUpperCase() ||
          String(l.location_id || "").toUpperCase() === locationNo.toUpperCase()
        ) || null;
      }

      const normalized = normalizeInwardLocationRow(matched);
      const normalizedLocId = normalized?.location_id ?? null;
      if (normalizedLocId && String(normalized.location_no || "").trim()) {
        setMatchedLoc(normalized);
        setSelectedLocId(String(normalizedLocId));
        setScanStatus("matched");
        return normalized;
      } else {
        setMatchedLoc(null);
        setScanStatus("not_found");
        return null;
      }
    } catch (err) {
      setMatchedLoc(null);
      setScanStatus("not_found");
      return null;
    }
  };

  const handleSelectChange = (id, pickedRow) => {
    if (id == null || id === "") {
      clearLocSearch();
      return Promise.resolve(null);
    }

    if (pickedRow && (pickedRow.location_id != null || pickedRow.id != null)) {
      const matched = normalizeInwardLocationRow(pickedRow);
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
        openSnackbar({
          variant: "danger",
          title: "Error",
          message: SCAN_SNACK_MSG.REJECTED,
          duration: SNACK_DUR.med,
        });
      }
      return Promise.resolve(null);
    }
    return lookupLocation(normalizedLocationNo);
  };

  const handleSelectChangeRef = useRef(handleSelectChange);
  handleSelectChangeRef.current = handleSelectChange;

  const handleAddLocation = () => {
    if (!matchedLoc) return;
    if (locations.some((l) => l.location_id === matchedLoc.location_id)) {
      openSnackbar({
        variant: "warning",
        title: "Warning",
        message: MSG.LOCATION_ALREADY_ADDED,
        duration: SNACK_DUR.med,
      });
      return;
    }
    const locName = matchedLoc.location_no || `${matchedLoc.rack_no}${matchedLoc.shelf_no || ""}`;
    setLocations((prev) => [
      ...prev,
      { location_id: matchedLoc.location_id, name: locName, boxes: [] },
    ]);
    setLocHasError((prev) => [...prev, false]);
    clearLocSearch();
  };

  const handleRemoveLoc = (li) => {
    setLocations((prev) => prev.filter((_, i) => i !== li));
    setLocHasError((prev) => prev.filter((_, i) => i !== li));
  };

  const tryAddBox = async (li, val, source = "manual") => {
    const detectedType = detectQrType(val);
    if (detectedType === "location") {
      showScanToast("error", "generic-scan-step2", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    const candidate = extractBoxCode(val);
    if (!candidate) {
      showScanToast("error", "generic-invalid-sticker", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    const scanLockKey = `${li}:${candidate.toLowerCase()}`;
    if (source === "scanner" && inFlightScanRef.current.has(scanLockKey)) {
      return;
    }
    if (source === "scanner") {
      inFlightScanRef.current.add(scanLockKey);
    }

    try {
      setLastActiveLocIdx(li);
      const latestLocs = locationsRef.current;
      if (!latestLocs[li]) return;

      const duplicateInSame = latestLocs[li].boxes.some((b) =>
        boxEntryMatchesCode(normalizeInwardBoxEntry(b), candidate)
      );
      if (duplicateInSame) {
        const dk = `${li}:${candidate.toLowerCase()}`;
        const now = Date.now();
        if (now - (duplicateSnackCooldownRef.current[dk] || 0) < 2300) {
          return;
        }
        duplicateSnackCooldownRef.current[dk] = now;
        showScanToast("info", dk, SCAN_SNACK_MSG.BOX_DUPLICATE(candidate), 2300);
        return;
      }

      const otherLoc = latestLocs.find(
        (loc, idx) =>
          idx !== li &&
          loc.boxes.some((b) => boxEntryMatchesCode(normalizeInwardBoxEntry(b), candidate))
      );
      if (otherLoc) {
        showScanToast(
          "error",
          `duplicate-other-${otherLoc.name}`,
          MSG.BOX_DUPLICATE_OTHER(otherLoc.name),
          1500
        );
        return;
      }

      const locRow = latestLocs[li];
      if (!locRow?.location_id) {
        showScanToast("error", "no-location", "Please add a location before scanning boxes.", 2000);
        return;
      }

      const pendingId = `scan-${++scanSeqRef.current}`;

      let didAdd = false;
      flushSync(() => {
        setLocations((prev) => {
          if (!prev[li]) return prev;
          if (prev[li].boxes.some((b) => boxEntryMatchesCode(normalizeInwardBoxEntry(b), candidate))) {
            return prev;
          }
          didAdd = true;
          return prev.map((loc, i) =>
            i === li
              ? {
                  ...loc,
                  boxes: [
                    ...loc.boxes,
                    {
                      boxNoUid: candidate,
                      qty: 0,
                      packing_number: null,
                      _pending: true,
                      _pendingId: pendingId,
                      _candidate: candidate,
                    },
                  ],
                }
              : loc
          );
        });
      });

      if (!didAdd) return;

      flushSync(() => {
        setLocHasError((prev) => prev.map((e, i) => (i === li ? false : e)));
      });

      if (source === "scanner") {
        showScanSuccess(`scan-added-${candidate.toLowerCase()}`, SCAN_SNACK_MSG.BOX_ADDED(candidate));
      }

      pendingCountRef.current += 1;
      setPendingScanCount(pendingCountRef.current);

      scanBatchRef.current?.enqueue({
        id: pendingId,
        li,
        code: candidate,
        source,
      });

      if (source === "manual") {
        setValidatingBox(true);
        try {
          await scanBatchRef.current?.flushPending();
          const entry = locationsRef.current[li]?.boxes
            ?.map((b) => normalizeInwardBoxEntry(b))
            .find((e) => e?._pendingId === pendingId);
          if (!entry?._pending) {
            const confirmed = locationsRef.current[li]?.boxes
              ?.map((b) => normalizeInwardBoxEntry(b))
              .find((e) => !e?._pending && boxEntryMatchesCode(e, candidate));
            if (confirmed) {
              showScanSuccess(
                `manual-added-${confirmed.boxNoUid.toLowerCase()}`,
                SCAN_SNACK_MSG.BOX_ADDED(confirmed.boxNoUid),
                1200
              );
            }
          }
        } finally {
          setValidatingBox(false);
        }
      }
    } finally {
      if (source === "scanner") {
        inFlightScanRef.current.delete(scanLockKey);
      }
    }
  };

  const handleRemoveBox = (li, bi) => {
    const removedEntry = normalizeInwardBoxEntry(locations[li]?.boxes?.[bi]);
    if (removedEntry?._pendingId) {
      cancelledPendingIdsRef.current.add(removedEntry._pendingId);
      pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
      setPendingScanCount(pendingCountRef.current);
    }
    setLocations((prev) =>
      prev.map((loc, i) =>
        i === li ? { ...loc, boxes: loc.boxes.filter((_, j) => j !== bi) } : loc
      )
    );
    if (removedEntry?.boxNoUid) {
      openSnackbar({
        variant: "success",
        title: "Success",
        message: MSG.BOX_REMOVED_OK(removedEntry.boxNoUid),
        duration: SNACK_DUR.med,
      });
    }
  };

  const validate = () => {
    const hasPending = locations.some((loc) =>
      loc.boxes.some((b) => normalizeInwardBoxEntry(b)?._pending)
    );
    if (hasPending) {
      openSnackbar({
        variant: "warning",
        title: "Please wait",
        message: "Boxes are still being confirmed. Wait a moment, then save again.",
        duration: SNACK_DUR.med,
      });
      return false;
    }
    if (locations.length === 0) {
      openSnackbar({
        variant: "danger",
        title: "Error",
        message: "Please add at least one location",
        duration: SNACK_DUR.med,
      });
      return false;
    }
    const errs = locations.map((loc) => loc.boxes.length === 0);
    setLocHasError(errs);
    const hasBoxErrors = errs.some((v) => v);
    if (hasBoxErrors) {
      openSnackbar({
        variant: "danger",
        title: "Error",
        message: "Each location must have at least one box",
        duration: SNACK_DUR.med,
      });
    }
    return !hasBoxErrors;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;

    await scanBatchRef.current?.flushPending();

    const stillPending = locationsRef.current.some((loc) =>
      loc.boxes.some((b) => normalizeInwardBoxEntry(b)?._pending)
    );
    if (stillPending) {
      openSnackbar({
        variant: "warning",
        title: "Please wait",
        message: "Some boxes are still being confirmed. Try again in a moment.",
        duration: SNACK_DUR.med,
      });
      return;
    }

    const payload = {
      ...form,
      locations: locations.map((loc) => ({
        location_id: loc.location_id,
        boxes: loc.boxes
          .map((b) => normalizeInwardBoxEntry(b)?.boxNoUid)
          .filter(Boolean),
      })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await inventoryInwardService.update(editData.in_uid, payload);
        openSnackbar({
          variant: "success",
          title: "Success",
          message: MSG.INWARD_UPDATED,
          duration: SNACK_DUR.med,
        });
      } else {
        await inventoryInwardService.create(payload);
        openSnackbar({
          variant: "success",
          title: "Success",
          message: MSG.INWARD_CREATED,
          duration: SNACK_DUR.med,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      openSnackbar({
        variant: "danger",
        title: "Error",
        message: err?.message || MSG.INWARD_FAILED,
        duration: SNACK_DUR.long,
      });
    } finally {
      setSaving(false);
    }
  };

  tryAddBoxRef.current = tryAddBox;

  function handleInwardCameraDecoded(decodedText) {
    const locIdx = scanLocIdxRef.current;
    const locs = locationsRef.current;

    if (locIdx === null) {
      const qrType = detectQrType(decodedText);
      if (qrType === "box") {
        showScanToast("error", "generic-scan-step1", SCAN_SNACK_MSG.REJECTED);
        return;
      }
      const locationId = extractLocationNo(decodedText);
      const now = Date.now();
      const scanKey = `loc:${locationId || ""}`;
      if (
        scanKey === lastScanRef.current.key &&
        lastScanRef.current.mode === "location" &&
        now - lastScanRef.current.at < 2000
      ) {
        return;
      }
      lastScanRef.current = { key: scanKey, at: now, mode: "location" };

      if (!locationId) {
        showScanToast("error", "generic-scan-step1", SCAN_SNACK_MSG.REJECTED);
        return;
      }
      if (
        locs.some((l) =>
          String(l.location_id) === String(locationId) ||
          String(l.name || "").toLowerCase() === String(locationId).toLowerCase()
        )
      ) {
        return;
      }
      handleSelectChangeRef.current(locationId).then((matched) => {
        if (matched) {
          showScanSuccess("location-scanned", SCAN_SNACK_MSG.LOCATION_OK);
          setIsScannerOpen(false);
          setActiveLocIdxForScan(null);
        }
      });
      return;
    }

    const rawBoxCode = extractBoxCode(decodedText);
    const now = Date.now();
    const scanKey = `box:${rawBoxCode || ""}`;
    if (
      scanKey === lastScanRef.current.key &&
      lastScanRef.current.mode === "box" &&
      now - lastScanRef.current.at < 2000
    ) {
      return;
    }
    lastScanRef.current = { key: scanKey, at: now, mode: "box" };

    if (!rawBoxCode) return;
    const flat = flatBoxesByLocation(locationsRef.current);
    if (flat.some(({ box }) => String(box).toLowerCase() === String(rawBoxCode).toLowerCase())) {
      return;
    }
    const alreadyInCurrentLocation = locs[locIdx]?.boxes?.some((box) => {
      const e = normalizeInwardBoxEntry(box);
      return e && e.boxNoUid.toLowerCase() === String(rawBoxCode).toLowerCase();
    });
    if (alreadyInCurrentLocation) {
      return;
    }

    tryAddBoxRef.current(locIdx, decodedText, "scanner");
  }

  useHtml5QrScanner({
    active: isScannerOpen,
    elementId: INWARD_SCANNER_ELEMENT_ID,
    onDecoded: handleInwardCameraDecoded,
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: (err) => {
      if (err?.name === "InsecureContext") {
        showScanToast("error", "camera-insecure", FLOW_SCAN_CAMERA_INSECURE_MSG, 10000);
      } else {
        const isDenied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
        showScanToast(
          "error",
          "camera-permission",
          isDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA,
          10000
        );
      }
      setIsScannerOpen(false);
      setActiveLocIdxForScan(null);
    },
  });

  const startCameraScanner = (locIdx = null) => {
    // Unlock audio immediately
    void unlockScanAudio().catch(() => {});
    // Open scanner immediately
    scanLocIdxRef.current = locIdx;
    setActiveLocIdxForScan(locIdx);
    setIsScannerOpen(true);
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setActiveLocIdxForScan(null);
  };

  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        e.stopPropagation();
        const li = lastActiveLocIdx ?? (locations.length > 0 ? locations.length - 1 : null);
        if (li !== null && locations[li]?.boxes?.length > 0) {
          handleRemoveBox(li, locations[li].boxes.length - 1);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [open, lastActiveLocIdx, locations, handleRemoveBox]);

  return (
    <>
    <Drawer
      isOpen={open} onClose={onClose}
      onSubmit={handleSave}
      title={isEdit ? "Edit Inward" : "New Inward"}
      description="Record inward stock entry"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button onClick={onClose} disabled={!formReady || saving} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-all">Cancel</button>
          <button onClick={handleSave} disabled={!formReady || saving} className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-indigo-400">
            {saving ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : <><Check size={18} /> Save</>}
          </button>
        </div>
      }
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 pb-4">
        {!formReady ? (
          <FormPanelLoader
            label="Loading inward entry..."
            hint="Preparing locations and scanned boxes."
          />
        ) : (
        <>
        <QrScannerOverlay
          open={isScannerOpen}
          onClose={closeScanner}
          readerId={INWARD_SCANNER_ELEMENT_ID}
          hint={activeLocIdxForScan === null ? "Scanning Location" : "Scanning Boxes"}
          frameClassName={
            activeLocIdxForScan === null
              ? "border-4 border-inward-loc-scanner-frame"
              : "border-4 border-inward-box-scanner-frame"
          }
        />

        {/* ── Location Selection ── */}
        <div className="bg-inward-loc-panel-bg p-3 rounded-xl border border-inward-loc-panel-border space-y-3">
          <label className="text-[10px] font-bold text-inward-loc-label uppercase tracking-widest flex items-center gap-2">
            <MapPin size={14} /> Step 1: Select Location
          </label>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            {isMobileDevice() && (
              <button
                onClick={() => startCameraScanner(null)}
                className="h-[40px] w-full sm:w-auto sm:shrink-0 px-3 bg-inward-loc-btn border border-inward-loc-btn-border text-white hover:bg-inward-loc-btn-hover rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                title="Scan Location QR"
              >
                <QrCode size={16} />
                <span className="text-[10px] font-black uppercase">Scan</span>
              </button>
            )}
            <div className="w-full sm:flex-1 text-[11px] min-w-0">
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
              onClick={handleAddLocation}
              disabled={scanStatus !== "matched"}
              className="h-[40px] w-full sm:w-auto sm:shrink-0 px-4 bg-inward-loc-btn hover:bg-inward-loc-btn-hover border border-inward-loc-btn-border text-white font-bold text-[10px] uppercase rounded-lg transition-all shadow-md flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> Add
            </button>
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
                <p className="text-[10px] font-black text-emerald-800 uppercase leading-none">Location Found: {matchedLoc.location_no || `${matchedLoc.rack_no}${matchedLoc.shelf_no || ""}`}</p>
                <p className="text-[8px] font-bold text-emerald-600/70 uppercase mt-0.5">Ready to add to list</p>
              </div>
            </div>
          )}
          {scanStatus === "not_found" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg animate-in shake-1">
              <XCircle size={16} className="text-rose-500" />
              <p className="text-[10px] font-bold text-rose-600 uppercase leading-none">{MSG.LOCATION_NOT_FOUND}</p>
            </div>
          )}
        </div>

        {/* ── Active Locations & Box Scanning ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold text-inward-box-label uppercase tracking-widest flex items-center gap-2">
              <Package size={14} className="text-inward-box-btn" /> Step 2: Scan Boxes into Locations
            </label>
            {locations.length > 0 && (() => {
              const rollup = locations.reduce(
                (acc, loc) => {
                  const t = inwardLocationTotals(loc.boxes);
                  return {
                    locs: acc.locs + 1,
                    boxes: acc.boxes + t.boxCount,
                    qty: acc.qty + t.totalQty,
                  };
                },
                { locs: 0, boxes: 0, qty: 0 }
              );
              const packings = distinctPackingGroupCount(locations);
              return (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <span className="text-[9px] font-black text-inward-loc-badge-text bg-inward-loc-badge-bg px-2 py-0.5 rounded-md border border-inward-loc-badge-border whitespace-nowrap">
                    {rollup.locs} LOCATIONS
                  </span>
                  <span className="text-[9px] font-black text-inward-box-chip-text bg-inward-box-chip-bg px-2 py-0.5 rounded-md border border-inward-box-chip-border whitespace-nowrap" title="Total scanned boxes (all locations)">
                    {rollup.boxes} BOXES
                  </span>
                  <span className="text-[9px] font-black text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100 whitespace-nowrap" title="Distinct packing numbers among scanned boxes">
                    {packings} PACKINGS
                  </span>
                </div>
              );
            })()}
          </div>

          {locations.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {locations.map((loc, li) => {
                const { boxCount, totalQty } = inwardLocationTotals(loc.boxes);
                return (
                <div key={li} className={`bg-white rounded-xl border transition-all overflow-hidden shadow-sm ${locHasError[li] ? "border-rose-200 shadow-rose-50" : "border-slate-200"}`}>
                  {/* Location Header */}
                  <div className="px-3 py-2 bg-inward-loc-header-bg border-b border-inward-loc-header-border flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 bg-inward-loc-header-icon-bg rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
                        <MapPin size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Location</p>
                        <p className="text-xs font-black text-slate-800 uppercase leading-none truncate">{loc.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="hidden xs:flex items-center gap-1.5" aria-live="polite">
                        <div className="flex items-baseline gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 shadow-sm tabular-nums">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Boxes</span>
                          <span className="text-sm font-black text-inward-box-stat-text leading-none">{boxCount}</span>
                        </div>
                        <div className="flex items-baseline gap-1 px-2 py-1 rounded-md bg-white border border-emerald-100 shadow-sm tabular-nums">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">Qty</span>
                          <span className="text-sm font-black text-emerald-700 leading-none">{totalQty}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => handleRemoveLoc(li)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0" aria-label="Remove location">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Mobile-visible summary (match desktop: boxes + qty per location) */}
                  <div className="xs:hidden px-3 py-2 bg-white border-b border-slate-100 flex items-center gap-4">
                    <p className="text-[11px] font-black text-slate-800 tabular-nums">
                      <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Total Boxes</span> {boxCount}
                    </p>
                    <p className="text-[11px] font-black text-emerald-700 tabular-nums">
                      <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Total Qty</span> {totalQty}
                    </p>
                  </div>

                  <div className="p-3 space-y-3 bg-inward-box-panel-bg border-t border-inward-box-panel-border/60">
                    {/* Box Input Area */}
                    <div className="flex items-center gap-2">
                      {isMobileDevice() && (
                        <button
                          onClick={() => startCameraScanner(li)}
                          className="h-[38px] shrink-0 px-3 bg-inward-box-btn border border-inward-box-btn-border text-white hover:bg-inward-box-btn-hover rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                          title="Scan Box QR"
                        >
                          <Camera size={16} />
                          <span className="text-[10px] font-black uppercase">Scan</span>
                        </button>
                      )}
                      {loc.boxes.length > 0 && (
                        <button
                          onClick={() => handleRemoveBox(li, loc.boxes.length - 1)}
                          className="h-[38px] shrink-0 px-3 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                          title="Delete Last Box (Ctrl+D)"
                        >
                          <Trash2 size={16} />
                          <span className="text-[10px] font-black uppercase">Del Last</span>
                        </button>
                      )}
                      <div className="relative flex-1 min-w-0">
                        <ScanLine size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-inward-box-input-icon" />
                        <input
                          placeholder={MSG.BOX_PLACEHOLDER}
                          className="w-full bg-white border rounded-lg pl-8 pr-3 font-mono text-[10px] h-[38px] text-slate-800 outline-none transition-all appearance-none border-inward-box-input-border focus:border-inward-box-btn focus:ring-2 focus:ring-inward-box-focus-ring"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const inputValue = e.target.value;
                              setValidatingBox(true);
                              tryAddBox(li, inputValue)
                                .finally(() => setValidatingBox(false));
                              e.target.value = "";
                            }
                            // Ctrl+D to delete last box of this location
                            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
                              e.preventDefault();
                              if (loc.boxes.length > 0) {
                                handleRemoveBox(li, loc.boxes.length - 1);
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    {(validatingBox || pendingScanCount > 0) && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-inward-box-muted-bg border border-inward-box-muted-border rounded-lg">
                        <Loader2 size={12} className="animate-spin text-inward-box-spinner" />
                        <p className="text-[9px] font-bold text-inward-box-spinner-text uppercase">
                          {pendingScanCount > 0
                            ? `Confirming ${pendingScanCount} box${pendingScanCount === 1 ? "" : "es"}…`
                            : "Validating box..."}
                        </p>
                      </div>
                    )}

                    {/* Scanned Boxes List */}
                    <div className="space-y-1.5">
                     
                      {loc.boxes.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-inward-box-dash-bg rounded-lg border border-dashed border-inward-box-dash-border">
                          {loc.boxes.map((box, bi) => {
                            const entry = normalizeInwardBoxEntry(box);
                            const label = entry?.boxNoUid ?? "—";
                            const isPending = !!entry?._pending;
                            return (
                              <div key={`${label}-${bi}`} className={`flex items-start gap-1 pl-2 pr-1 py-1 bg-inward-box-chip-bg border border-inward-box-chip-border rounded-md shadow-sm animate-in zoom-in-95 max-w-[200px] ${isPending ? "opacity-70" : ""}`}>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {isPending && <Loader2 size={8} className="animate-spin text-inward-box-spinner shrink-0" />}
                                    <span className="text-[10px] font-mono font-black text-inward-box-chip-text">{label}</span>
                                    {/* {entry && entry.qty > 0 && (
                                      <span className="text-[8px] font-bold text-emerald-600 tabular-nums px-1 py-px rounded bg-emerald-50 border border-emerald-100">{entry.qty}</span>
                                    )} */}
                                  </div>
                                </div>
                                <button type="button" onClick={() => handleRemoveBox(li, bi)} className="p-0.5 text-slate-300 hover:text-rose-500 transition-colors shrink-0" aria-label={`Remove ${label}`}>
                                  <X size={10} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-4 flex flex-col items-center justify-center bg-inward-box-empty-bg rounded-lg border border-dashed border-inward-box-empty-border">
                          <Package size={16} className="text-inward-box-empty-icon mb-1" />
                          <p className="text-[9px] font-bold text-inward-box-empty-text uppercase italic">No boxes scanned yet</p>
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
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{MSG.LOCATION_EMPTY_STATE_TITLE}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{MSG.LOCATION_EMPTY_STATE_SUBTITLE}</p>
            </div>
          )}
        </div>

        {/* ── Remarks ── */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm min-w-0">
          <RemarksTextarea
            label="Remarks / Note"
            labelIcon={<MessageSquare size={14} className="text-inward-loc-label" />}
            value={form.remarks}
            onChange={(e) => handleInputChange("remarks", e.target.value)}
            placeholder={MSG.REMARKS_PLACEHOLDER}
            rows={4}
          />
        </div>

        {/* {locations.length > 0 && locationPackingSummary.length > 0 && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-indigo-600 shrink-0" />
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Inward summary</p>
            </div>
            <ul className="space-y-2.5">
              {locationPackingSummary.map((block) => (
                <li key={block.locName} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                  <p className="text-[10px] font-black text-indigo-700 uppercase mb-1.5 flex items-center gap-1.5">
                    <MapPin size={12} className="shrink-0" />
                    {block.locName}
                  </p>
                  <ul className="space-y-1 pl-0.5">
                    {block.rows.map((row) => (
                      <li
                        key={`${block.locName}-${row.packingLabel}`}
                        className="text-[11px] text-slate-700 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
                      >
                        <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">Packing</span>
                        <span className="font-mono font-bold text-slate-900">{row.packingLabel}</span>
                        <span className="text-slate-300">—</span>
                        <span className="font-black text-emerald-700 tabular-nums">{row.boxCount}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">box{row.boxCount === 1 ? "" : "es"}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )} */}

        {locations.length > 0 && locationPackingSummary.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-4 px-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Inward Summary</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locationPackingSummary.map((block) => (
                <div key={block.locName} className="space-y-2">
                  {/* Location Name + per-location totals */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-inward-loc-label font-bold text-xs uppercase">
                      <MapPin size={12} />
                      {block.locName}
                    </div>
                    <p className="text-[10px] font-bold text-slate-600 tabular-nums pl-4">
                      <span className="text-slate-400 font-black uppercase text-[9px] mr-1">Total</span>
                      {block.totalBoxes} box{block.totalBoxes === 1 ? "" : "es"}
                      <span className="text-slate-300 mx-1.5">·</span>
                      <span className="text-emerald-700">{block.totalQty}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase ml-0.5">qty</span>
                    </p>
                  </div>

                  {/* Table Style Summary */}
                  <div className="rounded-lg border border-slate-100 overflow-hidden shadow-sm">
                    {/* Header Titles */}
                    <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-100 px-3 py-1.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Packing</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase text-right">Boxes</span>
                    </div>

                    {/* Values */}
                    <div className="bg-white divide-y divide-slate-50">
                      {block.rows.map((row) => (
                        <div key={row.packingLabel} className="grid grid-cols-2 px-3 py-2 text-[11px]">
                          <span className="font-medium text-slate-700">{row.packingLabel}</span>
                          <span className="font-bold text-slate-900 text-right tabular-nums">{row.boxCount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isEditMode && (
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <p className="text-[10px] text-emerald-700 italic">Entry stays approved by default in simple CRUD flow.</p>
          </div>
        )}
        </>
        )}

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${sopPermissionType}`}
          moduleSlug="inventory_inwards"
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

