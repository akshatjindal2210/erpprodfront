"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Check, CheckCircle2, ChevronRight, Loader2, Plus, ScanLine, Camera, MapPin, X, QrCode, LogOut, ClipboardList } from "lucide-react";

import "@/apps/ims/lib/config/inwardUi.theme.css";

import { coilService } from "@/apps/rmstore/lib/services/coil";
import { outEntryService } from "@/apps/rmstore/lib/services/outEntry";
import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";
import { extractCoilUid, extractBatchMrnUid, normalizeScanInput, coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import RemarksTextarea from "@/ui/common/forms/RemarksTextarea";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { FormLabel, OK_INPUT, ERR_INPUT, MODAL_INPUT_CLASS } from "@/ui/common/Constants";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { prepareQrScanSession, unlockScanAudio, playScanSuccessBeep } from "@/platform/utils/global/scanFeedback";
import { parseSeedCoilUids } from "@/apps/rmstore/modules/out-entry/pendingOutRows";

const STORE_OUT_KIND = {
  MRN: "store_out",
  JOB_CARD: "job_card",
};

function jobCardSelectKey(row) {
  if (row?.issue_uid == null) return "";
  return `${row.issue_uid}::${String(row.pjobcardno || "").trim()}`;
}

function parseJobCardSelectKey(key) {
  const raw = String(key || "").trim();
  const sep = raw.indexOf("::");
  if (sep < 0) return null;
  return {
    issue_uid: Number(raw.slice(0, sep)),
    pjobcardno: raw.slice(sep + 2),
  };
}

function mapPendingJobCardOption(row) {
  const jcKey = jobCardSelectKey(row);
  const jcNo = String(row?.pjobcardno || "").trim();
  const mac = String(row?.macname || "").trim();
  return {
    ...row,
    jc_key: jcKey,
    jc_label: jcNo ? `JC ${jcNo}` : `Issue #${row?.issue_uid ?? "—"}`,
    jc_sub: [mac, row?.rm_item_code || row?.item_code || ""].filter(Boolean).join(" · "),
  };
}

const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "success", title: "", message: "", duration: SNACK_DUR.med };

function coilLocationLabel(c) {
  if (c?.location_no) return String(c.location_no);
  if (c?.location_id != null) return `Location ID ${c.location_id}`;
  return "Coil Area — not on rack";
}

function coilLocationDetail(c) {
  const base = coilLocationLabel(c);
  const bits = [];
  if (c?.rack_no != null && String(c.rack_no).trim() !== "") bits.push(`Rack ${c.rack_no}`);
  if (c?.row_no != null && String(c.row_no).trim() !== "") bits.push(`Row ${c.row_no}`);
  return bits.length ? `${base} · ${bits.join(" · ")}` : base;
}

function rejectionLocationSummary(coils = []) {
  if (!coils.length) return "—";
  const labels = [...new Set(coils.map((c) => coilLocationDetail(c)).filter(Boolean))];
  return labels.join(" · ") || "—";
}

function parseSeedCoilUidList(seed) {
  const raw = seed?.coil_uids ?? seed?.coil_no_uids ?? seed?.coil_no_uid;
  if (Array.isArray(raw)) return raw.map((u) => String(u).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
  }
  return [];
}

function locationRowLabel(loc) {
  const base =
    loc?.location_no ||
    (loc?.location_id != null ? `Location ID ${loc.location_id}` : "Coil Area — not on rack");
  const bits = [];
  if (loc?.rack_no != null && String(loc.rack_no).trim() !== "") bits.push(`Rack ${loc.rack_no}`);
  if (loc?.row_no != null && String(loc.row_no).trim() !== "") bits.push(`Row ${loc.row_no}`);
  return bits.length ? `${base} · ${bits.join(" · ")}` : base;
}

async function fetchRejectionCoilUids(rejectId, seed = {}) {
  const uids = new Set(parseSeedCoilUidList(seed));
  try {
    const regRes = await rmRejectionService.getById(rejectId);
    const reg = regRes?.data;
    for (const c of reg?.coils || []) {
      const uid = String(c?.coil_no_uid || "").trim();
      if (uid) uids.add(uid);
    }
    if (!uids.size && reg?.coil_no_uid) {
      for (const uid of parseSeedCoilUidList({ coil_no_uid: reg.coil_no_uid })) {
        uids.add(uid);
      }
    }
  } catch {
    /* register lookup optional */
  }
  for (const status of ["rejected", "active"]) {
    if (uids.size) break;
    try {
      const res = await coilService.getAll({
        filters: { qc_reject_uid: rejectId, status },
        limit: 5000,
      });
      for (const c of res?.data ?? []) {
        const uid = String(c?.coil_no_uid || "").trim();
        if (uid) uids.add(uid);
      }
    } catch {
      /* try next status */
    }
  }
  return [...uids];
}

function mrnItemCodeLabel(plan) {
  if (!plan) return "—";
  if (plan.item_code) return String(plan.item_code);
  if (plan.item_dcode != null && String(plan.item_dcode).trim() !== "") {
    return String(plan.item_dcode);
  }
  const fromCoil =
    (plan.coils || []).find((c) => c?.item_code)?.item_code ||
    (plan.coils || []).find((c) => c?.item_dcode)?.item_dcode;
  return fromCoil ? String(fromCoil) : "—";
}

function enrichMrnPlan(plan) {
  if (!plan) return null;
  const coils = plan.coils || [];
  const locations = plan.locations?.length ? plan.locations : buildLocationsFromCoils(coils);
  const heatFromCoils = [...new Set(coils.map((c) => c.heat_no).filter(Boolean))].join(", ");
  const accFromCoils = coils.find((c) => c?.acc_name)?.acc_name || null;
  const seedItem = plan.item_code || plan.item_codes || null;
  const itemCode = mrnItemCodeLabel({ ...plan, item_code: seedItem, coils });
  return {
    ...plan,
    locations,
    item_code: itemCode !== "—" ? itemCode : seedItem ? String(seedItem) : null,
    heat_nos: plan.heat_nos || plan.heat_no || heatFromCoils || null,
    acc_name: plan.acc_name || accFromCoils || null,
    mrn_no: plan.mrn_no || plan.mrn_refs || plan.mrn_uid || null,
    coil_count: plan.coil_count ?? coils.length,
    total_qty:
      plan.total_qty ??
      coils.reduce((sum, c) => sum + (Number(c.qty) || 0), 0),
  };
}

async function fetchCoilsDetailed(uids = []) {
  const fetched = [];
  for (const uid of uids) {
    try {
      const res = await coilService.getByUid(uid);
      if (res?.data) fetched.push(res.data);
    } catch {
      /* skip missing */
    }
  }
  return fetched;
}

function buildLocationsFromCoils(coils = []) {
  const locMap = new Map();
  for (const c of coils) {
    const key = c.location_id != null ? String(c.location_id) : "none";
    if (!locMap.has(key)) {
      locMap.set(key, {
        location_id: c.location_id ?? null,
        location_no: c.location_no || coilLocationLabel(c),
        rack_no: c.rack_no || null,
        row_no: c.row_no || null,
        coils: [],
      });
    }
    locMap.get(key).coils.push(c);
  }
  return [...locMap.values()];
}

function locationKeysFromPlan(plan) {
  return new Set(
    (plan?.locations || []).map((loc, idx) =>
      loc.location_id != null ? String(loc.location_id) : `loc-${idx}`
    )
  );
}

/**
 * Shared coil-scan drawer for QC Rejection / Store Out.
 * Store Out mirrors IMS Out Entry: MRN select, location rows, scanned progress, draft save.
 */
export default function CoilScanEntryModal({
  open,
  onClose,
  onSuccess,
  mode = "qc",
  onSubmit,
  editItem = null,
  /** Pending-row seed: auto-load this MRN when opening a new Store Out */
  seedFromCoil = null,
  title,
  description,
  requireReason = false,
  scannerElementId = "rm-coil-scan-modal-reader",
}) {
  const isOutMode = mode === "out";
  const isEdit = isOutMode && editItem?.out_uid != null;
  const isRejectionEdit =
    isEdit && String(editItem?.entry_type || "").toLowerCase() === "rm_rejection";

  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [storeOutKind, setStoreOutKind] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [reason, setReason] = useState("");
  const [coils, setCoils] = useState([]);
  const coilsRef = useRef([]);
  coilsRef.current = coils;

  const [selectedMrnUid, setSelectedMrnUid] = useState("");
  const [selectedJobCardKey, setSelectedJobCardKey] = useState("");
  const [selectedJobCardMeta, setSelectedJobCardMeta] = useState(null);
  const [mrnPlan, setMrnPlan] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  /** Batch-wise MRN: coil scans blocked until batch QC sticker is scanned. */
  const [batchUnlocked, setBatchUnlocked] = useState(false);
  const [fetchingMrn, setFetchingMrn] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState(() => new Set());
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [validatingCoil, setValidatingCoil] = useState(false);
  const [laserCaptureMode, setLaserCaptureMode] = useState(null);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);

  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();

  const showTypePicker =
    isOutMode && !isEdit && !seedFromCoil && storeOutKind == null;

  const isRejectionOut =
    isRejectionEdit ||
    String(seedFromCoil?.entry_type || "").toLowerCase() === "rm_rejection" ||
    String(mrnPlan?.mrn_no || "").toLowerCase().startsWith("rejection");

  const isJobCardOut = storeOutKind === STORE_OUT_KIND.JOB_CARD || Boolean(selectedJobCardKey || selectedJobCardMeta);

  const mrnItemCode = mrnItemCodeLabel(mrnPlan);
  const scanBtnCount = (showPhoneQr ? 1 : 0) + (laserScan ? 1 : 0);
  const scanBtnFill = scanBtnCount > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  const coilInputRef = useRef(null);
  const scanToastRef = useRef({});
  const laserCaptureModeRef = useRef(null);
  const tryAddScanRef = useRef(async () => {});
  const mrnPlanRef = useRef(null);
  mrnPlanRef.current = mrnPlan;
  const isConfirmedRef = useRef(false);
  isConfirmedRef.current = isConfirmed;
  const batchUnlockedRef = useRef(false);
  batchUnlockedRef.current = batchUnlocked;

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);
  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);

  const resetForm = useCallback(() => {
    setRemarks("");
    setReason("");
    setCoils([]);
    setSelectedMrnUid("");
    setSelectedJobCardKey("");
    setSelectedJobCardMeta(null);
    setMrnPlan(null);
    setIsConfirmed(false);
    setBatchUnlocked(false);
    setFetchingMrn(false);
    setExpandedLocations(new Set());
    setIsScannerOpen(false);
    setSaving(false);
    setValidatingCoil(false);
    setLoadingEdit(false);
    setStoreOutKind(null);
    if (laserScan || isLaserScanEnabled()) {
      laserCaptureModeRef.current = "coil";
      setLaserCaptureMode("coil");
    } else {
      laserCaptureModeRef.current = null;
      setLaserCaptureMode(null);
    }
  }, [laserScan]);

  const loadMrnPlan = useCallback(
    async (mrnUid, { keepScanned = false, fromBatchSticker = false } = {}) => {
      const uid = String(mrnUid || "").trim();
      if (!uid) return null;
      setFetchingMrn(true);
      try {
        const res = await outEntryService.getStoredMrnDetail({ mrn_uid: uid });
        const plan = res?.data;
        if (!plan?.coils?.length) {
          showScanToast("error", "mrn-empty", "No stored coils were found for this MRN.");
          return null;
        }
        setSelectedMrnUid(uid);
        const enriched = enrichMrnPlan(plan);
        setMrnPlan(enriched);
        setIsConfirmed(true);
        const isBatch = String(plan.sticker_mode || "").toLowerCase() === "batch";
        // Coil-wise: unlock immediately. Batch-wise: only after batch QC sticker (or edit load).
        setBatchUnlocked(!isBatch || fromBatchSticker === true);
        setExpandedLocations(locationKeysFromPlan(enriched));
        if (!keepScanned) setCoils([]);
        return plan;
      } catch (err) {
        showScanToast("error", "mrn-load", err?.message || "Could not load the MRN coils. Please try again.");
        return null;
      } finally {
        setFetchingMrn(false);
      }
    },
    [showScanToast]
  );

  const loadJobCardFromRow = useCallback(
    async (row) => {
      const uids = parseSeedCoilUids(row);
      if (!uids.length) {
        showScanToast("error", "jc-empty", "No coils pending for this job card.");
        return false;
      }
      const fetched = await fetchCoilsDetailed(uids);
      if (!fetched.length) {
        showScanToast("error", "seed-empty", "Could not load coils for this job card.");
        return false;
      }

      setStoreOutKind(STORE_OUT_KIND.JOB_CARD);
      setSelectedJobCardKey(jobCardSelectKey(row));
      setSelectedJobCardMeta(mapPendingJobCardOption(row));
      setCoils([]);

      const mrnUids = [...new Set(fetched.map((c) => String(c.mrn_uid || "").trim()).filter(Boolean))];
      const first = fetched[0] || {};
      const enriched = enrichMrnPlan({
        mrn_uid: mrnUids.length === 1 ? mrnUids[0] : null,
        mrn_no: mrnUids.length === 1 ? first.mrn_no || mrnUids[0] : "Multi MRN",
        sticker_mode: "coil",
        coil_count: fetched.length,
        total_qty: fetched.reduce((s, c) => s + (Number(c.qty) || 0), 0),
        coils: fetched,
      });

      setIsConfirmed(true);
      setBatchUnlocked(true);
      setMrnPlan(enriched);
      setExpandedLocations(locationKeysFromPlan(enriched));
      showScanSuccess(
        mrnUids.length === 1 ? "seed-jc" : "seed-jc-multi",
        `Job card ${row?.pjobcardno || ""}: ${fetched.length} coil(s) at listed locations — scan each one.`,
        mrnUids.length === 1 ? 2800 : 3200
      );
      return true;
    },
    [showScanToast, showScanSuccess]
  );

  const loadRejectionPlan = useCallback(
    async (qcRejectUid, seed = {}, { keepScanned = false } = {}) => {
      const rejectId = Number(qcRejectUid);
      if (!rejectId) return null;

      let registerMeta = null;
      try {
        const regRes = await rmRejectionService.getById(rejectId);
        registerMeta = regRes?.data ?? null;
      } catch {
        /* optional */
      }

      const uids = await fetchRejectionCoilUids(rejectId, {
        ...seed,
        coil_no_uid: seed?.coil_no_uid ?? registerMeta?.coil_no_uid,
        coil_uids: seed?.coil_uids ?? registerMeta?.coils?.map((c) => c.coil_no_uid),
      });

      const fetched = uids.length ? await fetchCoilsDetailed(uids) : [];
      if (!fetched.length && !Number(seed.coil_count)) {
        showScanToast("error", "rej-empty", "No coils were found for this rejection register.");
        return null;
      }

      const enriched = enrichMrnPlan({
        mrn_uid: null,
        mrn_no: seed.mrn_refs
          ? String(seed.mrn_refs)
          : registerMeta?.mrn_refs
            ? String(registerMeta.mrn_refs)
            : `Rejection #${rejectId}`,
        qc_reject_uid: rejectId,
        reason: seed.reason ?? registerMeta?.reason ?? null,
        rejection_remarks:
          seed.rejection_remarks ?? seed.remarks ?? registerMeta?.remarks ?? null,
        sticker_mode: "coil",
        coil_count: Number(seed.coil_count) || registerMeta?.coil_count || fetched.length,
        total_qty:
          Number(seed.total_qty ?? seed.qty) ||
          Number(registerMeta?.total_qty) ||
          fetched.reduce((s, c) => s + (Number(c.qty) || 0), 0),
        item_codes:
          seed.item_codes ?? seed.item_code ?? registerMeta?.item_codes ?? null,
        heat_nos: seed.heat_nos ?? seed.heat_no ?? registerMeta?.heat_nos ?? null,
        mrn_refs: seed.mrn_refs ?? registerMeta?.mrn_refs ?? null,
        coils: fetched,
      });

      setIsConfirmed(true);
      setBatchUnlocked(true);
      setMrnPlan(enriched);
      setExpandedLocations(locationKeysFromPlan(enriched));
      if (!keepScanned) setCoils([]);
      return enriched;
    },
    [showScanToast]
  );

  const fetchPendingJobCardRow = useCallback(async (jcKey) => {
    const parsed = parseJobCardSelectKey(jcKey);
    if (!parsed) return null;
    const body = await outEntryService.getPendingList({
      page: 1,
      limit: 100,
      filters: { pending_type: "job_card" },
      search: String(parsed.issue_uid),
    });
    return (body.data ?? []).find(
      (r) =>
        Number(r.issue_uid) === parsed.issue_uid &&
        String(r.pjobcardno || "").trim() === parsed.pjobcardno
    );
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    let cancelled = false;
    const boot = async () => {
      resetForm();
      if (isEdit) {
        setLoadingEdit(true);
        try {
          const res = await outEntryService.getById(editItem.out_uid);
          if (cancelled) return;
          const data = res?.data;
          setRemarks(data?.remarks || "");
          const loaded = Array.isArray(data?.coils) ? data.coils : [];
          setCoils(loaded);

          if (String(data?.entry_type || editItem?.entry_type || "").toLowerCase() === "rm_rejection") {
            const totalQty = loaded.reduce((s, c) => s + (Number(c.qty) || 0), 0);
            const enriched = await loadRejectionPlan(
              data?.qc_reject_uid ?? editItem?.qc_reject_uid,
              {
                coil_count: data?.coil_count ?? loaded.length,
                total_qty: data?.total_qty ?? totalQty,
                item_codes: data?.item_codes,
                heat_nos: data?.heat_nos,
                mrn_refs: data?.mrn_refs,
              },
              { keepScanned: true }
            );
            if (cancelled) return;
            if (enriched) setCoils(loaded);
            return;
          }

          const mrnUid = String(loaded[0]?.mrn_uid || "").trim();
          if (mrnUid) {
            const planRes = await outEntryService.getStoredMrnDetail({ mrn_uid: mrnUid });
            if (cancelled) return;
            const plan = planRes?.data;
            if (plan?.coils?.length) {
              const enriched = enrichMrnPlan(plan);
              setSelectedMrnUid(mrnUid);
              setMrnPlan(enriched);
              setIsConfirmed(true);
              setBatchUnlocked(true);
              setExpandedLocations(locationKeysFromPlan(enriched));
            }
          }
        } catch (err) {
          if (!cancelled) {
            showScanToast("error", "load-edit", err?.message || "Could not load the store-out entry. Please try again.");
          }
        } finally {
          if (!cancelled) setLoadingEdit(false);
        }
        return;
      }

      // New Store Out seeded from Pending row
      if (isOutMode) {
        const seedUids = parseSeedCoilUids(seedFromCoil);
        if (seedUids.length) {
          setLoadingEdit(true);
          try {
            if (cancelled) return;
            await loadJobCardFromRow({
              issue_uid: seedFromCoil?.issue_uid,
              pjobcardno: seedFromCoil?.pjobcardno,
              macname: seedFromCoil?.macname,
              coil_uids: seedUids,
              coil_no_uids: seedFromCoil?.coil_no_uids ?? seedUids.join(", "),
            });
          } finally {
            if (!cancelled) setLoadingEdit(false);
          }
          return;
        }

        const seedMrn = String(seedFromCoil?.mrn_uid || "").trim();
        if (seedMrn) {
          setLoadingEdit(true);
          try {
            const plan = await loadMrnPlan(seedMrn);
            if (cancelled || !plan) return;
            const batch = String(plan.sticker_mode || "").toLowerCase() === "batch";
            showScanSuccess(
              "seed-mrn",
              batch
                ? `Batch MRN ${plan.mrn_no ?? seedMrn} loaded. Scan the batch QC sticker, then all ${plan.coil_count} coils.`
                : `MRN ${plan.mrn_no ?? seedMrn} loaded. Scan ${plan.coil_count} coil(s).`,
              2800
            );
          } finally {
            if (!cancelled) setLoadingEdit(false);
          }
          return;
        }

        if (
          String(seedFromCoil?.entry_type || "").toLowerCase() === "rm_rejection" &&
          seedFromCoil?.qc_reject_uid != null
        ) {
          setLoadingEdit(true);
          try {
            await loadRejectionPlan(seedFromCoil.qc_reject_uid, seedFromCoil);
          } finally {
            if (!cancelled) setLoadingEdit(false);
          }
          return;
        }
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, editItem?.out_uid, seedFromCoil?.mrn_uid, seedFromCoil?.coil_uids, seedFromCoil?.coil_no_uids, seedFromCoil?.qc_reject_uid, seedFromCoil?.entry_type]);

  const scannedUidSet = useMemo(
    () => new Set(coils.map((c) => String(c.coil_no_uid).toLowerCase())),
    [coils]
  );

  const requiredCount = mrnPlan?.coil_count || 0;
  const scannedCount = coils.length;
  const scannedQty = useMemo(
    () => coils.reduce((s, c) => s + (Number(c.qty) || 0), 0),
    [coils]
  );
  const requiredQty = Number(mrnPlan?.total_qty) || 0;
  const isFulfillmentComplete = requiredCount > 0 && scannedCount >= requiredCount;
  const isBatchMode = String(mrnPlan?.sticker_mode || "").toLowerCase() === "batch";
  const planLocations = useMemo(
    () => mrnPlan?.locations?.length ? mrnPlan.locations : buildLocationsFromCoils(mrnPlan?.coils || []),
    [mrnPlan]
  );
  const rejectionPickCoils = useMemo(
    () => (isRejectionOut ? mrnPlan?.coils || [] : []),
    [isRejectionOut, mrnPlan]
  );

  const tryAddCoilUid = async (uid) => {
    if (coilsRef.current.some((c) => String(c.coil_no_uid).toLowerCase() === uid.toLowerCase())) {
      showScanToast("error", `dup-${uid}`, `Coil ${uid} has already been added.`, 1800);
      return;
    }

    if (
      isOutMode &&
      String(mrnPlanRef.current?.sticker_mode || "").toLowerCase() === "batch" &&
      !batchUnlockedRef.current
    ) {
      showScanToast(
        "error",
        "need-batch",
        "Scan the batch QC sticker first, then scan each coil.",
        2800
      );
      return;
    }

    setValidatingCoil(true);
    try {
      const livePlan = mrnPlanRef.current;
      const livePlanMap = new Map(
        (livePlan?.coils || []).map((c) => [String(c.coil_no_uid).toLowerCase(), c])
      );
      let coil = livePlanMap.get(uid.toLowerCase()) || null;

      if (!coil) {
        const res = await coilService.getByUid(uid);
        coil = res?.data;
      }
      if (!coil) {
        showScanToast("error", "coil-missing", "Coil not found. Check the UID and try again.");
        return;
      }

      const status = String(coil.status || "active").toLowerCase();
      const rejectUid = editItem?.qc_reject_uid ?? mrnPlanRef.current?.qc_reject_uid;
      const isRejectionScan =
        isRejectionEdit ||
        String(mrnPlanRef.current?.mrn_no || "").toLowerCase().startsWith("rejection");

      if (isRejectionScan) {
        if (status !== "active" && status !== "rejected") {
          showScanToast("error", "coil-status", `Coil ${uid} is not available. Its current status is ${status}.`);
          return;
        }
        if (
          status === "rejected" &&
          rejectUid != null &&
          String(coil.qc_reject_uid) !== String(rejectUid)
        ) {
          showScanToast("error", "coil-reject", `Coil ${uid} belongs to a different rejection register entry.`);
          return;
        }
      } else if (status !== "active") {
        showScanToast("error", "coil-status", `Coil ${uid} is not available. Its current status is ${status}.`);
        return;
      }

      if (mode === "out" && !coil.location_id && !isRejectionScan) {
        const inConfirmedPlan = livePlanMap.has(uid.toLowerCase());
        if (!inConfirmedPlan) {
          showScanToast("error", "coil-not-stored", "This coil is not in store. Store Out requires stored coils.");
          return;
        }
      }

      if (isRejectionScan) {
        setCoils((prev) => [...prev, coil]);
        showScanSuccess("coil-ok", `Added ${coil.coil_no_uid} · @ ${coilLocationDetail(coil)}`, 1800);
        void playScanSuccessBeep();
        return;
      }

      if (isOutMode) {
        const coilMrn = String(coil.mrn_uid || "").trim();
        if (!isConfirmedRef.current) {
          showScanToast(
            "error",
            "need-confirm",
            "Select and confirm MRN or job card before scanning coils.",
            3200
          );
          return;
        }

        const plan = mrnPlanRef.current;
        const planMap = new Map(
          (plan?.coils || []).map((c) => [String(c.coil_no_uid).toLowerCase(), c])
        );
        if (plan && plan.mrn_uid != null && coilMrn && coilMrn !== String(plan.mrn_uid)) {
          showScanToast(
            "error",
            "wrong-mrn",
            `This coil belongs to MRN ${coil.mrn_no ?? coilMrn}, not MRN ${plan.mrn_no ?? plan.mrn_uid}.`
          );
          return;
        }
        if (plan && !planMap.has(uid.toLowerCase())) {
          showScanToast("error", "not-in-mrn", "This coil is not part of the selected MRN store plan.");
          return;
        }
        coil = planMap.get(uid.toLowerCase()) || coil;
      }

      setCoils((prev) => [...prev, coil]);
      showScanSuccess("coil-ok", `Added ${coil.coil_no_uid} · @ ${coilLocationDetail(coil)}`, 1800);
      void playScanSuccessBeep();
    } catch (err) {
      showScanToast("error", "coil-err", err?.message || "Coil not found. Check the UID and try again.");
    } finally {
      setValidatingCoil(false);
    }
  };

  const tryAddScan = async (val) => {
    const raw = normalizeScanInput(val);
    if (!raw) {
      showScanToast("error", "invalid-scan", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    if (isOutMode) {
      const batchMrn = extractBatchMrnUid(raw);
      if (batchMrn) {
        if (!isConfirmedRef.current) {
          showScanToast(
            "error",
            "need-confirm",
            "Confirm MRN or job card before scanning batch or coils.",
            3200
          );
          return;
        }
        if (String(mrnPlanRef.current?.mrn_uid) !== batchMrn) {
          showScanToast("error", "batch-other", "This batch sticker belongs to a different MRN.");
          return;
        }
        setBatchUnlocked(true);
        showScanSuccess(
          "batch-ok",
          batchUnlockedRef.current
            ? "This batch is already unlocked. Scan each coil now."
            : "Batch unlocked. Scan each coil now.",
          2200
        );
        void playScanSuccessBeep();
        return;
      }
    }

    const uid = extractCoilUid(raw);
    if (!uid) {
      showScanToast("error", "invalid-coil", SCAN_SNACK_MSG.REJECTED);
      return;
    }
    await tryAddCoilUid(uid);
  };

  tryAddScanRef.current = tryAddScan;

  const handleConfirmMrn = async () => {
    if (!selectedMrnUid) {
      showScanToast("error", "need-mrn", "Select an MRN first.");
      return;
    }
    await loadMrnPlan(selectedMrnUid);
  };

  const handleConfirmJobCard = async () => {
    if (!selectedJobCardKey) {
      showScanToast("error", "need-jc", "Select a job card first.");
      return;
    }
    setLoadingEdit(true);
    try {
      const row = await fetchPendingJobCardRow(selectedJobCardKey);
      if (!row) {
        showScanToast("error", "jc-missing", "Job card not found or no longer pending.");
        return;
      }
      const ok = await loadJobCardFromRow(row);
      if (!ok) return;
    } finally {
      setLoadingEdit(false);
    }
  };

  const removeCoil = (uid) => {
    setCoils((prev) => prev.filter((c) => c.coil_no_uid !== uid));
  };

  const toggleLocation = (key) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startLaserCoilScan = useCallback(() => {
    setLaserCaptureMode("coil");
    laserCaptureModeRef.current = "coil";
  }, []);

  const onCoilLaserScan = useCallback((code) => {
    void tryAddScanRef.current(code);
  }, []);

  const handleLaserScanRejected = useCallback(
    ({ reason: r }) => {
      if (r === "empty") {
        showScanToast("error", "laser-empty-scan", SCAN_SNACK_MSG.REJECTED, 1800);
      }
    },
    [showScanToast]
  );

  const laserScanActive =
    open &&
    Boolean(laserCaptureMode) &&
    (laserScan || isLaserScanEnabled()) &&
    (!isOutMode || isConfirmed);

  const startCameraScanner = () => {
    void unlockScanAudio().catch(() => {});
    setIsScannerOpen(true);
  };

  const closeScanner = () => setIsScannerOpen(false);

  const handleCameraDecoded = (decodedText) => {
    closeScanner();
    void tryAddScanRef.current(decodedText);
  };

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen,
    elementId: scannerElementId,
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

  const buildPayload = (scan_complete) => {
    const rejectUid =
      editItem?.qc_reject_uid ?? seedFromCoil?.qc_reject_uid ?? mrnPlanRef.current?.qc_reject_uid ?? null;
    const isRejectionOut =
      isRejectionEdit ||
      String(seedFromCoil?.entry_type || "").toLowerCase() === "rm_rejection" ||
      rejectUid != null;
    const isJobCardOutPayload =
      storeOutKind === STORE_OUT_KIND.JOB_CARD ||
      Boolean(selectedJobCardKey || selectedJobCardMeta);

    return {
      coils: coils.map((c) => ({ coil_no_uid: c.coil_no_uid })),
      remarks: remarks || null,
      ...(requireReason ? { reason: String(reason).trim() } : {}),
      ...(isOutMode ? { scan_complete } : {}),
      ...(isOutMode && isRejectionOut
        ? { entry_type: "rm_rejection", qc_reject_uid: rejectUid }
        : {}),
      ...(isOutMode && !isRejectionOut && isJobCardOutPayload ? { entry_type: "job_card" } : {}),
    };
  };

  const persist = async (scan_complete) => {
    if (requireReason && !String(reason || "").trim()) {
      showScanToast("error", "need-reason", "A rejection reason is required.");
      return;
    }
    if (!coils.length) {
      showScanToast("error", "save-coils", "Add at least one coil.");
      return;
    }
    if (isOutMode && scan_complete && requiredCount > 0 && scannedCount < requiredCount) {
      showScanToast(
        "error",
        "incomplete",
        `Scan all coils for this MRN (${scannedCount}/${requiredCount}) before submitting.`
      );
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(scan_complete);
      let res;
      if (isOutMode) {
        if (isEdit) {
          res = await outEntryService.update(editItem.out_uid, payload);
        } else {
          res = await outEntryService.create(payload);
        }
      } else {
        res = await onSubmit(payload);
      }
      const msg =
        isOutMode && !scan_complete
          ? res?.message || `Saved as a draft (${scannedCount}/${requiredCount || scannedCount} coils).`
          : res?.message || "Saved successfully.";
      showScanToast("success", "save-ok", msg, 2800);
      onSuccess?.(res?.data);
      onClose?.();
    } catch (err) {
      showScanToast(
        "error",
        "save-fail",
        err?.message || "Could not save the entry. Please try again.",
        4000
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!isOutMode) {
      await persist(true);
      return;
    }
    await persist(isFulfillmentComplete);
  };

  const drawerTitle =
    title ||
    (isOutMode
      ? showTypePicker
        ? "New Store Out Entry"
        : isEdit
          ? "Edit Store Out"
          : "New Store Out Entry"
      : "Scan Coils");

  const drawerDescription =
    description ||
    (isOutMode
      ? showTypePicker
        ? "Select out type"
        : isEdit
          ? `OUT-${editItem.out_uid} · select an MRN, scan the coils, then submit`
          : "Select an MRN, scan the coils, then submit"
      : undefined);

  const scanControls = (
    <>
      {(showPhoneQr || laserScan) && (
        <div className="flex items-stretch gap-2 w-full min-w-0">
          {showPhoneQr && (
            <button
              type="button"
              onClick={startCameraScanner}
              disabled={isScannerOpen}
              className={`h-9 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
            >
              {isOutMode ? <QrCode size={14} /> : <Camera size={16} />}
              <span className="text-[10px] font-black uppercase">{isOutMode ? "QR" : "Camera"}</span>
            </button>
          )}
          {laserScan && (
            isOutMode ? (
              <LaserScanField
                active={laserScanActive}
                onScanned={onCoilLaserScan}
                onScanRejected={handleLaserScanRejected}
                formatPreview={coilUidDisplayLabel}
                compact
                heightClass="h-9"
                fill={scanBtnCount > 0}
                armButtonLabel="Scan"
              />
            ) : (
              <button
                type="button"
                onClick={startLaserCoilScan}
                className={`h-10 px-3 bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700 rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-2 ${scanBtnFill}`}
              >
                <ScanLine size={16} /> Laser
              </button>
            )
          )}
        </div>
      )}

      {!isOutMode && laserScanActive && (
        <LaserScanField
          active
          onScanned={onCoilLaserScan}
          onScanRejected={handleLaserScanRejected}
          placeholder={getScanInputPlaceholder("coil")}
        />
      )}

      {keyboardType && (
        <div className="flex gap-2">
          <input
            ref={coilInputRef}
            type="text"
            className="flex-1 h-9 px-3 border border-slate-300 rounded-lg text-xs font-mono"
            placeholder={
              isOutMode && isBatchMode
                ? "Scan a batch sticker or enter a coil UID"
                : "Enter or paste a coil UID"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void tryAddScan(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
          />
          <button
            type="button"
            disabled={validatingCoil || fetchingMrn}
            onClick={() => {
              const el = coilInputRef.current;
              if (!el) return;
              void tryAddScan(el.value);
              el.value = "";
            }}
            className="h-9 px-4 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-bold uppercase inline-flex items-center gap-1"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}

      {isOutMode && !showPhoneQr && !laserScan && !keyboardType && (
        <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-600 px-1">
          Scan-only mode: scanned coils appear in the list below.
        </p>
      )}
    </>
  );

  const saveButtonLabel =
    requiredCount > 0
      ? `Save draft (${scannedCount}/${requiredCount})`
      : scannedCount > 0
        ? `Save draft (${scannedCount})`
        : "Save draft";

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={onClose}
        onSubmit={() => void handleSave()}
        title={drawerTitle}
        description={drawerDescription}
        footer={
          showTypePicker ? (
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-bold text-slate-500"
              >
                Cancel
              </button>
            </div>
          ) : (
          <div className="flex items-center justify-end gap-3 w-full flex-wrap">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2 text-sm font-bold text-slate-500"
            >
              Cancel
            </button>
            {isOutMode ? (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={
                  saving ||
                  loadingEdit ||
                  !coils.length ||
                  (!isConfirmed && !isEdit)
                }
                className="min-w-[140px] px-6 py-2 text-sm font-bold text-white bg-red-600 shadow-red-100 hover:bg-red-700 rounded-xl shadow-lg disabled:bg-slate-300 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Processing…
                  </>
                ) : isFulfillmentComplete ? (
                  "Submit"
                ) : (
                  saveButtonLabel
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Processing
                  </>
                ) : (
                  <>
                    <Check size={18} /> Save
                  </>
                )}
              </button>
            )}
          </div>
          )
        }
        maxWidth={isOutMode ? "max-w-5xl" : "max-w-3xl"}
      >
        <div className={`space-y-3 pb-2 ${isOutMode ? "" : "space-y-4 pb-4"}`}>
          <QrScannerOverlay
            open={isScannerOpen}
            onClose={closeScanner}
            readerId={scannerElementId}
            hint="Scanning Coils"
            frameClassName="border-4 border-inward-box-scanner-frame"
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
          />

          {showTypePicker ? (
            <div className="space-y-2 py-1">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide px-0.5">
                Select out type
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStoreOutKind(STORE_OUT_KIND.MRN)}
                  className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/60 hover:border-indigo-400 text-left transition-colors min-w-0"
                >
                  <div className="flex items-center gap-2 text-indigo-800">
                    <LogOut size={14} className="shrink-0" />
                    <span className="text-[11px] font-black uppercase tracking-tight">Store Out (MRN)</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setStoreOutKind(STORE_OUT_KIND.JOB_CARD)}
                  className="p-2.5 rounded-lg border border-teal-200 bg-teal-50/60 hover:border-teal-400 text-left transition-colors min-w-0"
                >
                  <div className="flex items-center gap-2 text-teal-800">
                    <ClipboardList size={14} className="shrink-0" />
                    <span className="text-[11px] font-black uppercase tracking-tight">Job Card</span>
                  </div>
                </button>
              </div>
            </div>
          ) : null}

          {loadingEdit && !showTypePicker && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
              <Loader2 size={18} className="animate-spin" />{" "}
              {isEdit ? "Loading draft…" : "Loading MRN coils…"}
            </div>
          )}

          {!loadingEdit && isOutMode && !showTypePicker && (
            <div className="space-y-2 animate-in fade-in duration-300">
              {!isRejectionOut && storeOutKind === STORE_OUT_KIND.JOB_CARD ? (
              <div className="space-y-2 min-w-0 w-full">
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 min-w-0 w-full">
                  <div className="flex-1 min-w-0 w-full">
                    <SearchableSelect
                      className="min-w-0 w-full"
                      label="Job Card"
                      value={selectedJobCardKey}
                      onChange={(v) => {
                        setSelectedJobCardKey(v != null ? String(v) : "");
                        setSelectedJobCardMeta(null);
                        if (isConfirmed) {
                          setIsConfirmed(false);
                          setMrnPlan(null);
                          setCoils([]);
                          setExpandedLocations(new Set());
                        }
                      }}
                      fetchService={async (params) => {
                        const body = await outEntryService.getPendingList({
                          ...params,
                          filters: { pending_type: "job_card" },
                        });
                        return {
                          ...body,
                          data: (body.data ?? []).map(mapPendingJobCardOption),
                        };
                      }}
                      getByIdService={async (id) => {
                        const row = await fetchPendingJobCardRow(id);
                        return row ? { data: mapPendingJobCardOption(row) } : { data: null };
                      }}
                      dataKey="jc_key"
                      labelKey="jc_label"
                      subLabelKey="jc_sub"
                      listHintKey="pending_coil_count"
                      listHintLabel="Coils"
                      required
                      disabled={isConfirmed && !isEdit}
                      placeholder="Search by job card, issue UID, or item"
                    />
                  </div>
                  {!isConfirmed && (
                    <button
                      type="button"
                      onClick={() => void handleConfirmJobCard()}
                      disabled={loadingEdit || !selectedJobCardKey}
                      className="h-9 w-full sm:w-auto sm:min-w-[5.5rem] shrink-0 px-4 bg-indigo-600 text-white font-bold text-[11px] rounded-lg disabled:opacity-60 whitespace-nowrap sm:self-end"
                    >
                      {loadingEdit ? "…" : "Confirm"}
                    </button>
                  )}
                </div>
              </div>
              ) : !isRejectionOut ? (
              <div className="space-y-2 min-w-0 w-full">
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 min-w-0 w-full">
                  <div className="flex-1 min-w-0 w-full">
                    <SearchableSelect
                      className="min-w-0 w-full"
                      label="MRN (batch)"
                      value={selectedMrnUid}
                      onChange={(v) => {
                        setSelectedMrnUid(v != null ? String(v) : "");
                        if (isConfirmed) {
                          setIsConfirmed(false);
                          setMrnPlan(null);
                          setCoils([]);
                          setExpandedLocations(new Set());
                        }
                      }}
                      fetchService={(params) => outEntryService.getStoredMrns(params)}
                      getByIdService={(id) =>
                        outEntryService.getStoredMrnDetail({ mrn_uid: id }).then((res) => ({
                          data: res?.data
                            ? {
                                mrn_uid: res.data.mrn_uid,
                                mrn_no: res.data.mrn_no,
                                item_code: mrnItemCodeLabel(res.data),
                                coil_count: res.data.coil_count,
                                sticker_mode: res.data.sticker_mode,
                              }
                            : null,
                        }))
                      }
                      dataKey="mrn_uid"
                      labelKey="mrn_no"
                      subLabelKey="item_code"
                      listHintKey="coil_count"
                      listHintLabel="Coils"
                      required
                      disabled={isConfirmed && !isEdit}
                      placeholder="Search by MRN or item"
                    />
                  </div>
                  {!isConfirmed && (
                    <button
                      type="button"
                      onClick={() => void handleConfirmMrn()}
                      disabled={fetchingMrn || !selectedMrnUid}
                      className="h-9 w-full sm:w-auto sm:min-w-[5.5rem] shrink-0 px-4 bg-indigo-600 text-white font-bold text-[11px] rounded-lg disabled:opacity-60 whitespace-nowrap sm:self-end"
                    >
                      {fetchingMrn ? "…" : "Confirm"}
                    </button>
                  )}
                </div>
              </div>
              ) : null}

              {mrnPlan && isConfirmed && (
                <>
                  {/* MRN details — always expanded after confirm */}
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="w-full px-2.5 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 min-h-[40px]">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide min-w-0 flex-1">
                        {isRejectionOut
                          ? "Rejection Details"
                          : isJobCardOut
                            ? "Job Card Details"
                            : "MRN Details"}
                      </span>
                      <span
                        className={`shrink-0 px-2 py-0.5 text-[8px] font-black uppercase border ${
                          isRejectionOut
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : isBatchMode
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {isRejectionOut
                          ? "RM Rejection"
                          : isBatchMode
                            ? "Batch-wise stickers"
                            : "Coil-wise stickers"}
                      </span>
                    </div>
                    <div className="px-2.5 pb-2">
                      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2 pt-2 text-[11px] leading-snug">
                        {isRejectionOut ? (
                          <>
                            <div className="min-w-0">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Rejection</dt>
                              <dd className="font-semibold text-slate-800">
                                #{mrnPlan.qc_reject_uid ?? "—"}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Item</dt>
                              <dd className="font-semibold text-slate-800 break-words">{mrnItemCodeLabel(mrnPlan)}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Heat</dt>
                              <dd className="font-semibold text-slate-800 break-words">{mrnPlan.heat_nos || "—"}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Reject Reason</dt>
                              <dd className="font-semibold text-rose-700 break-words">{mrnPlan.reason || "—"}</dd>
                            </div>
                            <div className="min-w-0 sm:col-span-2">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Store At</dt>
                              <dd className="font-semibold text-slate-800 break-words whitespace-pre-wrap">
                                {mrnPlan.rejection_remarks || "—"}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Coils</dt>
                              <dd className="font-semibold text-slate-800 tabular-nums">{requiredCount}</dd>
                            </div>
                            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Pick from</dt>
                              <dd
                                className="font-semibold text-indigo-700 break-words"
                                title={rejectionLocationSummary(rejectionPickCoils)}
                              >
                                {rejectionLocationSummary(rejectionPickCoils)}
                              </dd>
                            </div>
                          </>
                        ) : (
                          <>
                        {isJobCardOut ? (
                          <>
                            <div className="min-w-0">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Job Card</dt>
                              <dd className="font-semibold text-slate-800 break-words">
                                {selectedJobCardMeta?.jc_label ?? "—"}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Issue #</dt>
                              <dd className="font-semibold text-slate-800">{selectedJobCardMeta?.issue_uid ?? "—"}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">Machine</dt>
                              <dd className="font-semibold text-slate-800 break-words uppercase">
                                {selectedJobCardMeta?.macname || seedFromCoil?.macname || "—"}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[8px] font-bold text-slate-400 uppercase">RM Item</dt>
                              <dd className="font-semibold text-slate-800 break-words">
                                {selectedJobCardMeta?.rm_item_code || selectedJobCardMeta?.jc_sub || "—"}
                              </dd>
                            </div>
                          </>
                        ) : null}
                        <div className="min-w-0">
                          <dt className="text-[8px] font-bold text-slate-400 uppercase">MRN</dt>
                          <dd className="font-semibold text-slate-800">{mrnPlan.mrn_no ?? mrnPlan.mrn_uid ?? "—"}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[8px] font-bold text-slate-400 uppercase">Item</dt>
                          <dd className="font-semibold text-slate-800 break-words">{mrnItemCodeLabel(mrnPlan)}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[8px] font-bold text-slate-400 uppercase">Heat</dt>
                          <dd className="font-semibold text-slate-800 break-words">{mrnPlan.heat_nos || "—"}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[8px] font-bold text-slate-400 uppercase">Supplier</dt>
                          <dd className="font-semibold text-slate-800 break-words">{mrnPlan.acc_name || "—"}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[8px] font-bold text-slate-400 uppercase">Locations</dt>
                          <dd
                            className="font-semibold text-slate-800 break-words"
                            title={planLocations.map((loc) => locationRowLabel(loc)).join(", ")}
                          >
                            {planLocations.map((loc) => locationRowLabel(loc)).join(", ") || "—"}
                          </dd>
                        </div>
                          </>
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Item / qty / scanned — IMS strip + location rows */}
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={expandedLocations.size > 0}
                      aria-label={expandedLocations.size > 0 ? "Collapse location list" : "Expand location list"}
                      onClick={() => {
                        const locs = planLocations;
                        setExpandedLocations((prev) =>
                          prev.size === 0
                            ? new Set(
                                locs.map((loc, idx) =>
                                  loc.location_id != null ? String(loc.location_id) : `loc-${idx}`
                                )
                              )
                            : new Set()
                        );
                      }}
                      className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 min-h-[40px]"
                    >
                      <div className="flex flex-1 min-w-0 items-center gap-2 sm:gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
                            Item code
                          </span>
                          <span className="text-[11px] font-semibold text-slate-800 truncate" title={mrnItemCode}>
                            {mrnItemCode}
                          </span>
                        </div>
                        <span className="text-slate-300 shrink-0 select-none hidden sm:inline">·</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
                            Total qty to dispatch
                          </span>
                          <span className="text-[11px] font-semibold text-slate-800 tabular-nums">
                            {requiredQty.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-slate-300 shrink-0 select-none hidden sm:inline">·</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
                            Scanned
                          </span>
                          <span className="text-[11px] font-semibold text-indigo-700 tabular-nums">
                            {scannedCount} / {requiredCount} coils
                          </span>
                        </div>
                        <span className="text-slate-300 shrink-0 select-none hidden md:inline">·</span>
                        <div className="hidden md:flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
                            Scanned qty
                          </span>
                          <span className="text-[11px] font-semibold text-indigo-700 tabular-nums">
                            {scannedQty.toLocaleString()} / {requiredQty.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`text-slate-400 shrink-0 transition-transform ${expandedLocations.size > 0 ? "rotate-90" : ""}`}
                      />
                    </button>

                    <div className="px-2 pb-2 pt-1.5 space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 px-0.5">
                        Coil locations — where each coil is stored
                      </p>
                      {(planLocations || []).length ? (
                        (planLocations || []).map((loc, lidx) => {
                        const locKey =
                          loc.location_id != null ? String(loc.location_id) : `loc-${lidx}`;
                        const isLocOpen = expandedLocations.has(locKey);
                        const locCoils = loc.coils || [];
                        const locScanned = locCoils.filter((c) =>
                          scannedUidSet.has(String(c.coil_no_uid).toLowerCase())
                        ).length;
                        return (
                          <div
                            key={locKey}
                            className="rounded-lg border border-slate-200 bg-slate-50/30 overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => toggleLocation(locKey)}
                              className="w-full px-2 py-1.5 flex justify-between items-center gap-2 hover:bg-slate-100/80 transition-colors text-left"
                            >
                              <span className="text-[10px] font-bold flex items-center gap-1.5 min-w-0 text-indigo-600">
                                <MapPin size={11} className="shrink-0" />
                                <span className="truncate">{locationRowLabel(loc)}</span>
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="px-1.5 py-0.5 rounded text-[7px] font-bold text-emerald-700 uppercase bg-white border border-emerald-200">
                                  Coils {locScanned}/{locCoils.length}
                                </span>
                                <ChevronRight
                                  size={14}
                                  className={`text-slate-400 transition-transform ${isLocOpen ? "rotate-90" : ""}`}
                                />
                              </div>
                            </button>
                            {isLocOpen && (
                              <div className="px-1.5 pb-1.5 pt-0 flex flex-wrap gap-1">
                                {locCoils.map((c) => {
                                  const isScanned = scannedUidSet.has(
                                    String(c.coil_no_uid).toLowerCase()
                                  );
                                  return (
                                    <div
                                      key={c.coil_no_uid}
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border transition-all flex items-center gap-1 flex-wrap ${
                                        isScanned
                                          ? "bg-slate-50 text-slate-300 border-slate-100 opacity-70"
                                          : "bg-white text-slate-600 border-slate-200"
                                      }`}
                                      title={
                                        isScanned
                                          ? "Already scanned"
                                          : `${coilLocationDetail(c)} · Qty ${c.qty ?? 0}`
                                      }
                                    >
                                      {coilUidDisplayLabel(c.coil_no_uid) || c.coil_no_uid}
                                      <span className="text-[7px] text-slate-400 font-sans">
                                        qty {c.qty ?? 0}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                      ) : (
                        <p className="text-[10px] text-slate-400 italic px-1 py-2">
                          No stored locations found for this selection.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Scanned progress — IMS style */}
                  <div className="space-y-2 bg-indigo-50/30 p-2 rounded-lg border border-indigo-100">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-indigo-600 min-w-0">
                        <CheckCircle2 size={16} className="shrink-0" />
                        <span className="text-[11px] font-black uppercase tracking-widest">
                          Your Scanned Progress
                        </span>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto shrink-0">
                        <div
                          className={`px-3 py-1 rounded-lg text-center shadow-sm transition-all ${
                            isFulfillmentComplete
                              ? "bg-emerald-600 text-white"
                              : "bg-white border border-emerald-100 text-emerald-700"
                          }`}
                        >
                          <p className="text-[7px] font-bold uppercase opacity-80">Coils</p>
                          <p className="text-xs font-black">
                            {scannedCount} / {requiredCount}
                          </p>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-lg text-center shadow-sm transition-all ${
                            scannedQty > 0 && scannedQty >= requiredQty
                              ? "bg-amber-500 text-white"
                              : "bg-white border border-amber-100 text-amber-700"
                          }`}
                        >
                          <p className="text-[7px] font-bold uppercase opacity-80">Qty</p>
                          <p className="text-xs font-black tabular-nums">
                            {scannedQty.toLocaleString()} / {requiredQty.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {isBatchMode && (
                      <p className="text-[9px] font-bold uppercase tracking-wide text-amber-700 px-1">
                        {batchUnlocked
                          ? "Batch unlocked — scan every coil under this MRN."
                          : "Batch mode: scan the batch QC sticker first, then each coil."}
                      </p>
                    )}

                    <div className="space-y-2 p-1.5 bg-white border border-indigo-100 rounded-lg w-full min-w-0">
                      {scanControls}
                      {(validatingCoil || fetchingMrn) && (
                        <div className="flex items-center gap-2 px-2 py-1 bg-white border border-indigo-100 rounded-lg">
                          <Loader2 size={12} className="animate-spin text-indigo-600" />
                          <p className="text-[9px] font-bold text-indigo-600 uppercase">
                            {fetchingMrn ? "Loading MRN…" : "Confirming the coil…"}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="bg-white/60 rounded-lg border border-indigo-50 overflow-hidden">
                      <div className="px-3 py-1.5 bg-indigo-100/50 border-b border-indigo-100 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase">
                          Scanned Item List
                        </span>
                        <span className="text-[9px] font-black text-indigo-600/50 uppercase tracking-tighter">
                          Coils: {coils.length} · Qty: {scannedQty.toLocaleString()}
                        </span>
                      </div>
                      <div className="max-h-[min(40dvh,280px)] overflow-y-auto overscroll-y-contain p-2 custom-scrollbar">
                        {coils.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                            {coils.map((c) => (
                              <div
                                key={c.coil_no_uid}
                                className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between shadow-sm hover:border-emerald-300 transition-all group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black bg-emerald-100 text-emerald-600 shrink-0">
                                    C
                                  </div>
                                  <div className="flex flex-col leading-tight min-w-0">
                                    <span className="text-[11px] font-mono font-black text-slate-700 truncate">
                                      {coilUidDisplayLabel(c.coil_no_uid) || c.coil_no_uid}
                                    </span>
                                    <span className="text-[8px] font-bold text-emerald-700 uppercase truncate">
                                      @ {coilLocationDetail(c)}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase truncate">
                                      Qty {c.qty ?? 0}
                                      {c.item_code ? ` · ${c.item_code}` : ""}
                                      {c.heat_no ? ` · ${c.heat_no}` : ""}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeCoil(c.coil_no_uid)}
                                  title="Remove from scan list"
                                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-slate-300">
                            <ScanLine size={24} className="mx-auto opacity-20 mb-2" />
                            <p className="text-[9px] font-bold uppercase tracking-wide">Ready for scanning</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="min-w-0">
                <RemarksTextarea
                  label="Security Remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
                  placeholder="Driver, vehicle, seal"
                  rows={2}
                />
              </div>

              {!isConfirmed ? (
                <p className="text-[10px] text-slate-500 px-0.5">
                  Confirm selection to view coil locations and enable scanning.
                </p>
              ) : null}
            </div>
          )}

          {!loadingEdit && !isOutMode && (
            <>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                  Scan Coils
                </label>
                {scanControls}
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {!coils.length && (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      No coils added yet. Scan or enter a coil UID.
                    </p>
                  )}
                  {coils.map((c) => (
                    <div
                      key={c.coil_no_uid}
                      className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-bold text-indigo-700 truncate">
                          {coilUidDisplayLabel(c.coil_no_uid)}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          MRN {c.mrn_no ?? "—"} · {c.heat_no || "—"} · {c.item_code || "—"} · Qty{" "}
                          {c.qty ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-400">{coilLocationDetail(c)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCoil(c.coil_no_uid)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 pt-1 border-t border-slate-200">
                  <span>{coils.length} coil(s)</span>
                  <span className="text-emerald-700 tabular-nums">
                    Total Qty {coils.reduce((s, c) => s + (Number(c.qty) || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {requireReason && (
                <div className="space-y-1">
                  <FormLabel required>Rejection Reason</FormLabel>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`${!String(reason || "").trim() ? ERR_INPUT : OK_INPUT} ${MODAL_INPUT_CLASS}`}
                    placeholder="Enter the QC rejection reason"
                  />
                </div>
              )}

              <RemarksTextarea
                value={remarks}
                onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
                placeholder="Enter remarks (optional)"
              />
            </>
          )}
        </div>
      </Drawer>

      <Snackbar
        open={snackbar.open}
        onClose={closeSnackbar}
        variant={snackbar.variant}
        title={snackbar.title}
        message={snackbar.message}
        duration={snackbar.duration}
      />
    </>
  );
}
