"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Check, Loader2, Layers, ScanLine, AlertCircle, Package, QrCode, X, ArrowDownToLine, ShieldAlert, PackageMinus } from "lucide-react";
import { useSelector } from "react-redux";

import "@/apps/ims/lib/config/inwardUi.theme.css";

import { coilService } from "@/apps/rmstore/lib/services/coil";
import { mrnService } from "@/apps/rmstore/lib/services/mrn";
import { inProcessRequestService, IPR_REQUEST_TYPE, IPR_DOWNSTREAM, IPR_REQUEST_TYPE_LABEL, IPR_REJECTION_SCOPE_LABEL } from "@/apps/rmstore/lib/services/inProcessRequest";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";
import { extractCoilUid, normalizeScanInput, coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import RemarksTextarea from "@/ui/common/forms/RemarksTextarea";
import TypeableSuggestField from "@/ui/common/forms/TypeableSuggestField";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { OK_INPUT } from "@/ui/common/Constants";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";
import { SCAN_SNACK_MSG, useScanSnackbarActions } from "@/platform/utils/global";
import { prepareQrScanSession, unlockScanAudio, playScanSuccessBeep } from "@/platform/utils/global/scanFeedback";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { fetchAllListPages } from "@/ui/common/list/clientListSearch";
import StoreInRequestForm from "@/apps/rmstore/modules/in-process-request/StoreInRequestForm";
import ConsumeRequestForm from "@/apps/rmstore/modules/in-process-request/ConsumeRequestForm";
import ApprovalStatusToggle from "@/apps/rmstore/modules/shared/ApprovalStatusToggle";

const MODULE = "rm_issue_request";
const SCANNER_ID = "rm-in-process-request-scanner";
const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "success", title: "", message: "", duration: SNACK_DUR.med };

/** Same accent tokens as IMS QC Hold type picker. */
const TYPE_PICKER_ACCENT = {
  amber: {
    card: "border-amber-300 bg-amber-50/60 hover:border-amber-400 hover:bg-amber-50",
    title: "text-amber-900",
    banner: "border-amber-200 bg-amber-50 text-amber-900",
  },
  yellow: {
    card: "border-yellow-300 bg-yellow-50/60 hover:border-yellow-400 hover:bg-yellow-50",
    title: "text-yellow-900",
    banner: "border-yellow-300 bg-yellow-50 text-yellow-900",
  },
  teal: {
    card: "border-teal-300 bg-teal-50/60 hover:border-teal-400 hover:bg-teal-50",
    title: "text-teal-900",
    banner: "border-teal-200 bg-teal-50 text-teal-900",
  },
  rose: {
    card: "border-rose-300 bg-rose-50/60 hover:border-rose-400 hover:bg-rose-50",
    title: "text-rose-900",
    banner: "border-rose-200 bg-rose-50 text-rose-900",
  },
};

const REQUEST_TYPE_OPTIONS = [
  {
    id: IPR_REQUEST_TYPE.REJECTION,
    title: IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.REJECTION],
    description: "Reject from the machine",
    accent: "rose",
    Icon: ShieldAlert,
  },
  {
    id: IPR_REQUEST_TYPE.STORE_IN,
    title: IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.STORE_IN],
    description: "Return leftover coils",
    accent: "teal",
    Icon: ArrowDownToLine,
  },
  {
    id: IPR_REQUEST_TYPE.CONSUME,
    title: IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.CONSUME],
    description: "Scan shop-floor coils — full use by default",
    accent: "amber",
    Icon: PackageMinus,
  },
];

const REJECTION_TYPE_OPTIONS = [
  {
    id: "coil",
    title: IPR_REJECTION_SCOPE_LABEL.coil,
    description: "Only the scanned coil",
    accent: "amber",
    Icon: Package,
  },
  {
    id: "lot",
    title: IPR_REJECTION_SCOPE_LABEL.lot,
    description: "Every active coil in the lot",
    accent: "yellow",
    Icon: Layers,
  },
];

function fetchIprReasonSuggestions(search = "", requestType = IPR_REQUEST_TYPE.REJECTION) {
  return inProcessRequestService
    .getReasons({ search, request_type: requestType })
    .then((res) => (Array.isArray(res?.data) ? res.data : []));
}

function mapCoilRow(c, extras = {}) {
  const qty = Number(c.qty) || 0;
  const original = c.original_qty != null ? Number(c.original_qty) : qty;

  if (extras.forConsume) {
    const consumed =
      extras.consumed_qty != null
        ? Number(extras.consumed_qty)
        : c.consumed_qty != null
          ? Number(c.consumed_qty)
          : original;
    const used = Number.isFinite(consumed) ? Math.max(0, Math.min(original, consumed)) : original;
    const remaining = Math.max(0, original - used);
    const partialDefault =
      extras.partial_qty != null
        ? Boolean(extras.partial_qty)
        : c.partial_qty != null
          ? Boolean(c.partial_qty)
          : used < original;
    return {
      coil_no_uid: c.coil_no_uid,
      qty: original,
      original_qty: original,
      consumed_qty: used,
      remaining_qty: remaining,
      partial_qty: partialDefault,
      item_code: c.item_code,
      item_desc: c.item_desc,
      heat_no: c.heat_no,
      mrn_uid: c.mrn_uid,
      mrn_no: c.mrn_no,
      location_id: c.location_id ?? null,
      location_no: c.location_no || null,
      out_uid: c.out_uid ?? null,
      status: c.status,
      source: extras.source || c.source || null,
      is_seed_scan: Boolean(extras.is_seed_scan ?? c.is_seed_scan),
    };
  }

  const remaining =
    extras.remaining_qty != null
      ? Number(extras.remaining_qty)
      : c.remaining_qty != null
        ? Number(c.remaining_qty)
        : original;
  return {
    coil_no_uid: c.coil_no_uid,
    qty,
    original_qty: original,
    remaining_qty: remaining,
    consumed_qty: Math.max(0, original - remaining),
    item_code: c.item_code,
    item_desc: c.item_desc,
    heat_no: c.heat_no,
    mrn_uid: c.mrn_uid,
    mrn_no: c.mrn_no,
    location_id: c.location_id ?? null,
    location_no: c.location_no || null,
    out_uid: c.out_uid ?? null,
    status: c.status,
    source: extras.source || c.source || null,
    is_seed_scan: Boolean(extras.is_seed_scan ?? c.is_seed_scan),
  };
}

function proposedFromCoil(c, remaining) {
  const qty = Number(remaining);
  return {
    temp_id: `ret-${String(c.coil_no_uid).toLowerCase()}`,
    coil_no_uid: c.coil_no_uid,
    from_coil_uid: c.coil_no_uid,
    qty: Number.isFinite(qty) ? qty : 0,
    item_code: c.item_code || null,
    item_desc: c.item_desc || null,
    heat_no: c.heat_no || null,
    mrn_uid: c.mrn_uid || null,
    mrn_no: c.mrn_no ?? null,
  };
}

export default function InProcessRequestModal({
  open,
  onClose,
  onSuccess,
  editData = null,
  mode = "add",
}) {
  const canAccess = useCanAccess();
  const canApprove = canAccess(MODULE, "authorize").allowed;
  const currentUser = useSelector((s) => s.auth?.user);
  const actorName =
    currentUser?.name || currentUser?.full_name || currentUser?.username || "You";

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const isView = mode === "view";
  const readOnly = isView;
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";

  const [saving, setSaving] = useState(false);
  const [requestType, setRequestType] = useState(IPR_REQUEST_TYPE.REJECTION);
  const [requestTypePicked, setRequestTypePicked] = useState(false);
  const [rejectionType, setRejectionType] = useState("coil");
  const [typePicked, setTypePicked] = useState(false);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [approved, setApproved] = useState(false);
  const [coils, setCoils] = useState([]);
  const [proposedCoils, setProposedCoils] = useState([]);
  const [manualLotNo, setManualLotNo] = useState("");
  const [manualCoilId, setManualCoilId] = useState("");
  const [loadingLot, setLoadingLot] = useState(false);
  const [seedCoilUid, setSeedCoilUid] = useState(null);
  /** Scanned coil held between the scan step and the Coil/Lot choice. */
  const [pendingCoil, setPendingCoil] = useState(null);
  const coilsRef = useRef([]);
  coilsRef.current = coils;
  const requestTypeRef = useRef(requestType);
  requestTypeRef.current = requestType;

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [validatingCoil, setValidatingCoil] = useState(false);
  const [snackbar, setSnackbar] = useState(INITIAL_SNACK);
  const [errors, setErrors] = useState({});

  const { laserScan, keyboardType, showPhoneQr } = useDeviceScanSettings();
  const showLaserUi = laserScan || isLaserScanEnabled();
  const scanBtnCount = (showPhoneQr ? 1 : 0) + (showLaserUi ? 1 : 0);
  const scanBtnFill = scanBtnCount > 1 ? "flex-1 basis-0 min-w-0 w-full" : "w-full";

  const scanToastRef = useRef({});
  const tryAddCoilRef = useRef(async () => {});
  const gateScanRef = useRef(async () => {});
  /** Camera decodes route to the scan step while it is open, else to the form. */
  const scanGateOpenRef = useRef(false);
  const sopAckRef = useRef(null);
  const rejectionTypeRef = useRef(rejectionType);
  rejectionTypeRef.current = rejectionType;
  /** Bumped on every reset so a slow scan cannot apply to a newer session. */
  const scanSessionRef = useRef(0);

  const isStoreIn = requestType === IPR_REQUEST_TYPE.STORE_IN;
  /** Consume is whole-coil only, so it never asks the Coil/Lot question. */
  const isConsume = requestType === IPR_REQUEST_TYPE.CONSUME;
  const isRejection = !isStoreIn && !isConsume;
  /** Step 1 — pick the request type. */
  const showRequestTypePicker = mode === "add" && !requestTypePicked;
  /** Step 2 — scan seed coil (rejection only). Store In / Consume go straight to the form. */
  const showScanGate =
    mode === "add" &&
    requestTypePicked &&
    !typePicked &&
    !pendingCoil &&
    isRejection;
  /** Step 3 — Coil or Lot, answered once the scanned coil is known (rejection only). */
  const showRejectionTypePicker =
    mode === "add" && requestTypePicked && !typePicked && !!pendingCoil && isRejection;
  const showTypePicker =
    showRequestTypePicker || showScanGate || showRejectionTypePicker;
  const isLotMode = isRejection && rejectionType === "lot";
  const isCoilMode = !isLotMode;
  /** Lot empty state = IMS Full Hold packing entry panel. */
  const showLotEntryUi =
    isRejection && isLotMode && !readOnly && coils.length === 0 && mode !== "view";
  /** Rejection coil scan only — Store In / Consume use dedicated forms. */
  const showCoilScanUi = !isStoreIn && !isConsume && isCoilMode && !readOnly;
  const showApproval =
    canApprove && !readOnly && !showTypePicker && (mode === "add" || mode === "approve");

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);
  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);

  const requestLabel =
    IPR_REQUEST_TYPE_LABEL[requestType] || IPR_REQUEST_TYPE_LABEL[IPR_REQUEST_TYPE.REJECTION];
  const title = isView
    ? `View ${requestLabel}`
    : isApprove
      ? `Approve ${requestLabel}`
      : isEdit
        ? `Edit ${requestLabel}`
        : showRequestTypePicker
          ? "New In-process Request"
          : `New ${requestLabel}`;

  /** Back to step 1 — the request-type picker. */
  const resetTypeSelection = useCallback(() => {
    scanSessionRef.current += 1;
    setRequestType(IPR_REQUEST_TYPE.REJECTION);
    setRequestTypePicked(false);
    setRejectionType("coil");
    setTypePicked(false);
    setPendingCoil(null);
  }, []);

  const resetForm = useCallback(() => {
    resetTypeSelection();
    setReason("");
    setRemarks("");
    setApproved(false);
    setCoils([]);
    setProposedCoils([]);
    setManualLotNo("");
    setManualCoilId("");
    setLoadingLot(false);
    setSeedCoilUid(null);
    setPendingCoil(null);
    setErrors({});
    setIsScannerOpen(false);
    setSaving(false);
    setValidatingCoil(false);
  }, [resetTypeSelection]);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    if (editData?.ipr_uid && mode !== "add") {
      setRequestType(
        Object.values(IPR_REQUEST_TYPE).includes(editData.request_type)
          ? editData.request_type
          : IPR_REQUEST_TYPE.REJECTION
      );
      setRequestTypePicked(true);
      setRejectionType(editData.rejection_type === "lot" ? "lot" : "coil");
      setTypePicked(true);
      setReason(editData.reason || "");
      setRemarks(editData.remarks || "");
      setApproved(isApprove ? true : Boolean(editData.approved));
      setCoils(
        Array.isArray(editData.coils)
          ? editData.coils.map((c) =>
              mapCoilRow(c, {
                forConsume: editData.request_type === IPR_REQUEST_TYPE.CONSUME,
              })
            )
          : []
      );
      setProposedCoils(
        Array.isArray(editData.proposed_coils)
          ? editData.proposed_coils.map((p, i) => ({
              temp_id: p.temp_id || `proposed-${i + 1}`,
              coil_no_uid: p.coil_no_uid || null,
              from_coil_uid: p.from_coil_uid || p.coil_no_uid || null,
              qty: Number(p.qty) || 0,
              item_code: p.item_code || null,
              item_desc: p.item_desc || null,
              heat_no: p.heat_no || null,
              mrn_uid: p.mrn_uid || null,
              mrn_no: p.mrn_no ?? null,
            }))
          : []
      );
      setManualLotNo(
        editData.lot_no != null
          ? String(editData.lot_no)
          : editData.mrn_no != null
            ? String(editData.mrn_no)
            : ""
      );
      setSeedCoilUid(editData.seed_coil_uid || null);
      setManualCoilId("");
      setPendingCoil(null);
      setErrors({});
      setIsScannerOpen(false);
      setSaving(false);
      return;
    }

    resetForm();
    if (mode === "approve") setApproved(true);
  }, [open, editData, mode, isApprove, resetForm]);

  const fetchReasonsForType = useCallback(
    (search = "") => fetchIprReasonSuggestions(search, requestType),
    [requestType]
  );

  const applyLotCoils = (lotCoils, { seedUid = null, lotLabel = null } = {}) => {
    const mapped = lotCoils.map((c) =>
      mapCoilRow(c, {
        source: "lot",
        is_seed_scan: seedUid
          ? String(c.coil_no_uid).toLowerCase() === String(seedUid).toLowerCase()
          : false,
      })
    );
    setCoils(mapped);
    setSeedCoilUid(seedUid);
    if (lotLabel != null) setManualLotNo(String(lotLabel));
    setErrors((e) => ({ ...e, coils: undefined, scan: undefined }));
  };

  const loadLotCoilsByMrnUid = async (mrnUid) => {
    const uid = String(mrnUid || "").trim();
    if (!uid) return [];
    const { data } = await fetchAllListPages(async (page, limit) => {
      const body = await coilService.getAll({
        page,
        limit,
        filters: { mrn_uid: uid, status: "active" },
      });
      return { data: body.data ?? [], total: body.total ?? 0 };
    }, 500);
    return (data || []).filter(
      (c) => String(c.status || "active").toLowerCase() === "active" && c.coil_no_uid
    );
  };

  /**
   * Lot by MRN number = every MRN portal row with that mrn_no
   * (e.g. 3701 → 3701_1 + 3701_2 + 3701_3) and all of their coils.
   */
  const loadLotCoilsByMrnNo = async (mrnNo) => {
    const no = String(mrnNo ?? "").trim();
    if (!no) return { coils: [], mrnUids: [] };

    const byUid = new Map();
    let mrnUids = [];

    // 1) Coil filter by mrn_no
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await coilService.getAll({
          page,
          limit,
          filters: { mrn_no: no, status: "active" },
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, 500);
      for (const c of data || []) {
        if (!c?.coil_no_uid) continue;
        if (String(c.status || "active").toLowerCase() !== "active") continue;
        if (String(c.mrn_no ?? "").trim() !== no) continue;
        byUid.set(String(c.coil_no_uid).toLowerCase(), c);
      }
    } catch {
      /* continue */
    }

    // 2) Same as MRN Portal: find all UIDs for this mrn_no, then load each
    try {
      const { data: mrnRows } = await fetchAllListPages(async (page, limit) => {
        const body = await mrnService.getAll({
          page,
          limit,
          search: no,
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, 200);
      mrnUids = (mrnRows || [])
        .filter((r) => String(r.mrn_no ?? r.mrnno ?? "").trim() === no && (r.uid || r.mrn_uid))
        .map((r) => String(r.uid || r.mrn_uid).trim());
    } catch {
      mrnUids = [];
    }

    for (const uid of mrnUids) {
      const coils = await loadLotCoilsByMrnUid(uid);
      for (const c of coils) {
        byUid.set(String(c.coil_no_uid).toLowerCase(), c);
      }
    }

    // 3) Search fallback — never collapse to a single mrn_uid
    if (!byUid.size) {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await coilService.getAll({
          page,
          limit,
          search: no,
          filters: { status: "active" },
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, 500);
      for (const c of data || []) {
        if (!c?.coil_no_uid) continue;
        if (String(c.mrn_no ?? "").trim() !== no) continue;
        byUid.set(String(c.coil_no_uid).toLowerCase(), c);
      }
    }

    const coils = [...byUid.values()];
    if (!mrnUids.length) {
      mrnUids = [
        ...new Set(coils.map((c) => String(c.mrn_uid || "").trim()).filter(Boolean)),
      ];
    }
    return { coils, mrnUids };
  };

  const loadLotByNumber = async (rawLotNo) => {
    if (readOnly) return;
    const lot = String(rawLotNo ?? manualLotNo ?? "").trim();
    if (!lot) {
      setErrors((e) => ({ ...e, scan: "Lot / MRN number is required." }));
      return;
    }

    setLoadingLot(true);
    try {
      let full = [];
      let mrnUids = [];
      const byNo = await loadLotCoilsByMrnNo(lot);
      full = byNo.coils || [];
      mrnUids = byNo.mrnUids || [];

      if (!full.length) {
        full = await loadLotCoilsByMrnUid(lot);
        if (full.length) mrnUids = [lot];
      }

      if (!full.length) {
        setErrors((e) => ({ ...e, scan: `No active coils were found for lot or MRN ${lot}.` }));
        showScanToast("error", "lot-empty", `No active coils were found for lot or MRN ${lot}.`);
        return;
      }

      const label = full[0]?.mrn_no ?? lot;
      applyLotCoils(full, { seedUid: null, lotLabel: label });
      const uidHint = mrnUids.length > 1 ? ` across ${mrnUids.length} MRN lines` : "";
      showScanSuccess("lot-ok", `Loaded ${full.length} coil(s) for MRN ${label}${uidHint}`, 2400);
      void playScanSuccessBeep();
    } catch (err) {
      showScanToast("error", "lot-err", err?.message || "Could not load the lot. Please try again.");
    } finally {
      setLoadingLot(false);
    }
  };

  /** Load every active coil of the scanned coil's lot. */
  const loadLotFromCoil = async (coil) => {
    const mrnNo =
      coil.mrn_no != null && String(coil.mrn_no).trim() !== ""
        ? String(coil.mrn_no).trim()
        : null;
    const mrnUid = String(coil.mrn_uid || "").trim();
    if (!mrnNo && !mrnUid) {
      showScanToast("error", "lot-mrn", "This coil is not linked to an MRN or lot.");
      return false;
    }
    setLoadingLot(true);
    try {
      let lotCoils = [];
      let mrnUids = [];
      if (mrnNo) {
        const byNo = await loadLotCoilsByMrnNo(mrnNo);
        lotCoils = byNo.coils || [];
        mrnUids = byNo.mrnUids || [];
      }
      if (!lotCoils.length && mrnUid) {
        lotCoils = await loadLotCoilsByMrnUid(mrnUid);
        mrnUids = [mrnUid];
      }
      if (!lotCoils.length) {
        showScanToast("error", "lot-empty", "No active coils were found for this lot.");
        return false;
      }
      applyLotCoils(lotCoils, {
        seedUid: coil.coil_no_uid,
        lotLabel: mrnNo || mrnUid,
      });
      const uidHint = mrnUids.length > 1 ? ` across ${mrnUids.length} MRN lines` : "";
      showScanSuccess(
        "lot-ok",
        `Loaded ${lotCoils.length} coil(s) from MRN ${mrnNo || mrnUid}${uidHint}`,
        2400
      );
      void playScanSuccessBeep();
      return true;
    } finally {
      setLoadingLot(false);
    }
  };

  /** Fetch scanned coil — Store In / Consume require coils out at the machine. */
  const resolveScannedCoil = async (val) => {
    const uid = extractCoilUid(normalizeScanInput(val));
    if (!uid) {
      showScanToast("error", "invalid-coil", SCAN_SNACK_MSG.REJECTED);
      return null;
    }
    const res = await coilService.getByUid(uid);
    const coil = res?.data;
    if (!coil) {
      showScanToast("error", "coil-missing", "Coil not found. Check the UID and try again.");
      return null;
    }
    const status = String(coil.status || "active").toLowerCase();
    const reqType = requestTypeRef.current;
    const needsOut =
      reqType === IPR_REQUEST_TYPE.STORE_IN || reqType === IPR_REQUEST_TYPE.CONSUME;

    if (needsOut) {
      if (status !== "out") {
        showScanToast(
          "error",
          "coil-status",
          `Coil ${uid} is not on the shop floor (status: ${status}). Only issued-out coils can be scanned.`
        );
        return null;
      }
      return coil;
    }

    if (status !== "active") {
      showScanToast("error", "coil-status", `Coil ${uid} is not available. Its current status is ${status}.`);
      return null;
    }
    return coil;
  };

  /**
   * Step 2 — the scan that seeds the request.
   * Store In records the coil and opens the form; rejection asks Coil or Lot first.
   */
  const handleGateScan = async (val) => {
    if (readOnly) return;
    const session = scanSessionRef.current;
    setValidatingCoil(true);
    try {
      const coil = await resolveScannedCoil(val);
      if (!coil || session !== scanSessionRef.current) return;
      const mapped = mapCoilRow(coil, { source: "scan", is_seed_scan: true });

      if (requestTypeRef.current === IPR_REQUEST_TYPE.STORE_IN) {
        setCoils([mapped]);
        setProposedCoils([proposedFromCoil(mapped, mapped.remaining_qty)]);
        setErrors({});
        setTypePicked(true);
        showScanSuccess("coil-ok", `Added ${mapped.coil_no_uid}`, 1600);
        void playScanSuccessBeep();
        return;
      }

      // Consume is whole-coil, so the scan goes straight to the form.
      if (requestTypeRef.current === IPR_REQUEST_TYPE.CONSUME) {
        setCoils([mapped]);
        setSeedCoilUid(mapped.coil_no_uid);
        setErrors({});
        setTypePicked(true);
        showScanSuccess("coil-ok", `Added ${mapped.coil_no_uid}`, 1600);
        void playScanSuccessBeep();
        return;
      }

      setPendingCoil(mapped);
      setErrors({});
      void playScanSuccessBeep();
    } catch (err) {
      showScanToast("error", "coil-err", err?.message || "Could not load the coil details. Please try again.");
    } finally {
      setValidatingCoil(false);
    }
  };

  /** Step 3 — apply the Coil or Lot choice to the scanned coil. */
  const selectRejectionScope = async (scope) => {
    if (readOnly || !pendingCoil || loadingLot) return;
    const coil = pendingCoil;

    // Load the lot first — on failure the user stays here and can retry or rescan.
    if (scope === "lot") {
      const session = scanSessionRef.current;
      let loaded = false;
      try {
        loaded = await loadLotFromCoil(coil);
      } catch (err) {
        showScanToast("error", "lot-err", err?.message || "Could not load the lot. Please try again.");
      }
      if (session !== scanSessionRef.current || !loaded) return;
      setRejectionType("lot");
      setTypePicked(true);
      setPendingCoil(null);
      return;
    }

    setRejectionType("coil");
    setTypePicked(true);
    setPendingCoil(null);
    setCoils([coil]);
    setSeedCoilUid(coil.coil_no_uid);
    showScanSuccess("coil-ok", `Added ${coil.coil_no_uid}`, 1600);
  };

  /** Back from the Coil/Lot question to the scan step. */
  const backToScanStep = () => {
    if (readOnly) return;
    scanSessionRef.current += 1;
    setPendingCoil(null);
    setErrors({});
  };

  const tryAddCoil = async (val) => {
    if (readOnly) return;
    const uid = extractCoilUid(normalizeScanInput(val));
    if (!uid) {
      showScanToast("error", "invalid-coil", SCAN_SNACK_MSG.REJECTED);
      return;
    }

    const session = scanSessionRef.current;
    setValidatingCoil(true);
    try {
      const res = await coilService.getByUid(uid);
      const coil = res?.data;
      if (!coil) {
        showScanToast("error", "coil-missing", "Coil not found. Check the UID and try again.");
        return;
      }
      if (session !== scanSessionRef.current) return;

      const status = String(coil.status || "active").toLowerCase();
      const reqType = requestTypeRef.current;
      const needsOut =
        reqType === IPR_REQUEST_TYPE.STORE_IN || reqType === IPR_REQUEST_TYPE.CONSUME;

      if (needsOut) {
        if (status !== "out") {
          showScanToast(
            "error",
            "coil-status",
            `Coil ${uid} is not on the shop floor (status: ${status}).`
          );
          return;
        }
      } else if (status !== "active") {
        showScanToast("error", "coil-status", `Coil ${uid} is not available. Its current status is ${status}.`);
        return;
      }

      if (rejectionTypeRef.current === "lot" && requestTypeRef.current === IPR_REQUEST_TYPE.REJECTION) {
        await loadLotFromCoil(coil);
        return;
      }

      if (coilsRef.current.some((c) => String(c.coil_no_uid).toLowerCase() === uid.toLowerCase())) {
        showScanToast("error", `dup-${uid}`, `Coil ${uid} has already been added.`, 1800);
        return;
      }

      const mapped = mapCoilRow(coil, { source: "scan", is_seed_scan: true, forConsume: true });
      setCoils((prev) => [...prev, mapped]);
      setErrors((e) => ({ ...e, coils: undefined, scan: undefined }));
      showScanSuccess("coil-ok", `Added ${coil.coil_no_uid}`, 1600);
      void playScanSuccessBeep();
    } catch (err) {
      showScanToast("error", "coil-err", err?.message || "Could not load the coil details. Please try again.");
    } finally {
      setValidatingCoil(false);
    }
  };

  tryAddCoilRef.current = tryAddCoil;
  gateScanRef.current = handleGateScan;
  scanGateOpenRef.current = showScanGate;

  const removeCoil = (uid) => {
    if (readOnly) return;
    if (isLotMode) return;
    setCoils((prev) => prev.filter((c) => c.coil_no_uid !== uid));
  };

  const handleRemainingChange = (coilUid, value) => {
    if (readOnly || !isStoreIn) return;
    const raw = value === "" ? NaN : Number(value);
    setCoils((prev) =>
      prev.map((c) => {
        if (c.coil_no_uid !== coilUid) return c;
        const original = Number(c.original_qty ?? c.qty) || 0;
        const remaining = Number.isFinite(raw)
          ? Math.max(0, Math.min(original, raw))
          : 0;
        return {
          ...c,
          remaining_qty: remaining,
          consumed_qty: Math.max(0, original - remaining),
          qty: remaining,
        };
      })
    );
  };

  const handleUsedQtyChange = (coilUid, value) => {
    if (readOnly || !isConsume) return;
    const raw = value === "" ? NaN : Number(value);
    setCoils((prev) =>
      prev.map((c) => {
        if (c.coil_no_uid !== coilUid) return c;
        const original = Number(c.original_qty ?? c.qty) || 0;
        const used = Number.isFinite(raw) ? Math.max(0, Math.min(original, raw)) : original;
        return {
          ...c,
          partial_qty: true,
          consumed_qty: used,
          remaining_qty: Math.max(0, original - used),
        };
      })
    );
  };

  const handlePartialToggle = (coilUid, enabled) => {
    if (readOnly || !isConsume) return;
    setCoils((prev) =>
      prev.map((c) => {
        if (c.coil_no_uid !== coilUid) return c;
        const original = Number(c.original_qty ?? c.qty) || 0;
        if (!enabled) {
          return {
            ...c,
            partial_qty: false,
            consumed_qty: original,
            remaining_qty: 0,
          };
        }
        return { ...c, partial_qty: true };
      })
    );
  };

  const selectRequestType = (type) => {
    if (readOnly) return;
    const next = REQUEST_TYPE_OPTIONS.some((o) => o.id === type)
      ? type
      : IPR_REQUEST_TYPE.REJECTION;
    scanSessionRef.current += 1;
    setRequestType(next);
    setRequestTypePicked(true);
    setRejectionType("coil");
    setTypePicked(next === IPR_REQUEST_TYPE.STORE_IN || next === IPR_REQUEST_TYPE.CONSUME);
    if (next === IPR_REQUEST_TYPE.CONSUME && canApprove) {
      setApproved(true);
    } else if (next === IPR_REQUEST_TYPE.CONSUME) {
      setApproved(false);
    }
    setPendingCoil(null);
    setCoils([]);
    setProposedCoils([]);
    setManualLotNo("");
    setManualCoilId("");
    setSeedCoilUid(null);
    // Reasons are per request type, so never carry one across a type change.
    setReason("");
    setRemarks("");
    setErrors({});
  };

  const handleChangeType = () => {
    if (readOnly) return;
    resetTypeSelection();
    setCoils([]);
    setProposedCoils([]);
    setManualLotNo("");
    setManualCoilId("");
    setSeedCoilUid(null);
    setReason("");
    setRemarks("");
    setErrors({});
    setIsScannerOpen(false);
  };

  const clearLoadedLot = () => {
    if (readOnly) return;
    setCoils([]);
    setProposedCoils([]);
    setSeedCoilUid(null);
    setManualLotNo("");
    setErrors((e) => ({ ...e, coils: undefined, scan: undefined }));
  };

  const totalQty = useMemo(
    () => coils.reduce((s, c) => s + (Number(c.qty) || 0), 0),
    [coils]
  );

  const onCoilLaserScan = useCallback((code) => {
    void tryAddCoilRef.current(code);
  }, []);

  const onGateLaserScan = useCallback((code) => {
    void gateScanRef.current(code);
  }, []);

  const handleLaserScanRejected = useCallback(
    ({ reason: r }) => {
      if (r === "empty") {
        showScanToast("error", "laser-empty-scan", SCAN_SNACK_MSG.REJECTED, 1800);
      }
    },
    [showScanToast]
  );

  const startCameraScanner = () => {
    if (readOnly || loadingLot) return;
    void unlockScanAudio().catch(() => {});
    setIsScannerOpen(true);
  };

  const closeScanner = () => setIsScannerOpen(false);

  const handleCameraDecoded = (decodedText) => {
    closeScanner();
    if (scanGateOpenRef.current) {
      void gateScanRef.current(decodedText);
      return;
    }
    void tryAddCoilRef.current(decodedText);
  };

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: isScannerOpen,
    elementId: SCANNER_ID,
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

  const validate = () => {
    const next = {};
    if (!String(reason || "").trim()) next.reason = "This field is required.";
    if (!coils.length) {
      next.scan = isStoreIn
        ? "Scan at least one coil at the machine."
        : isConsume
          ? "Scan at least one coil."
          : isLotMode
            ? "Enter a lot or MRN number, or scan one coil."
            : "Scan at least one coil.";
    }
    if (isStoreIn) {
      for (const c of coils) {
        const orig = Number(c.original_qty ?? c.qty) || 0;
        const rem = Number(c.remaining_qty ?? c.qty) || 0;
        if (rem > orig) {
          next.proposed = "Return qty cannot exceed issued qty on any coil.";
          break;
        }
      }
    }
    if (isConsume) {
      for (const c of coils) {
        const orig = Number(c.original_qty ?? c.qty) || 0;
        const used = Number(c.consumed_qty ?? orig) || 0;
        if (used <= 0) {
          next.qty = "Enter used qty for partial coils.";
          break;
        }
        if (used > orig) {
          next.qty = "Used qty cannot exceed issued qty on any coil.";
          break;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async (approvedFlag) => {
    if (readOnly || showTypePicker) return;
    if (!sopAckRef.current?.assertAcknowledged()) return;
    if (!validate()) {
      showScanToast("error", "validate", "Please fix the highlighted fields.");
      return;
    }

    const resolveApproved =
      approvedFlag !== undefined
        ? Boolean(approvedFlag)
        : showApproval
          ? Boolean(approved)
          : mode === "add"
            ? false
            : undefined;

    const first = coils[0] || {};
    const scanned_coil_uids = coils.map((c) => c.coil_no_uid);
    const coilPayload = coils.map((c) => {
      const original = Number(c.original_qty ?? c.qty) || 0;
      const remaining = Number(c.remaining_qty ?? 0) || 0;
      const consumed = isStoreIn
        ? Math.max(0, original - remaining)
        : isConsume
          ? Number(c.consumed_qty ?? original) || 0
          : Number(c.qty) || 0;
      return {
        coil_no_uid: c.coil_no_uid,
        qty: isStoreIn ? remaining : isConsume ? consumed : Number(c.qty) || 0,
        original_qty: original,
        remaining_qty: isConsume ? Math.max(0, original - consumed) : remaining,
        consumed_qty: consumed,
        item_code: c.item_code,
        item_desc: c.item_desc,
        heat_no: c.heat_no,
        mrn_uid: c.mrn_uid,
        mrn_no: c.mrn_no,
        location_id: c.location_id ?? null,
        location_no: c.location_no || null,
        out_uid: c.out_uid ?? null,
        source: c.source || (isLotMode ? "lot" : "scan"),
        is_seed_scan: Boolean(c.is_seed_scan),
      };
    });

    const snapshotLine = (c) => {
      const original = Number(c.original_qty ?? c.qty) || 0;
      const remaining = Number(c.remaining_qty ?? 0) || 0;
      const consumed = isConsume
        ? Number(c.consumed_qty ?? original) || 0
        : isStoreIn
          ? Math.max(0, original - remaining)
          : Number(c.qty) || 0;
      return {
        coil_no_uid: c.coil_no_uid,
        qty: original,
        original_qty: original,
        remaining_qty: isConsume ? Math.max(0, original - consumed) : remaining,
        consumed_qty: consumed,
        item_code: c.item_code,
        item_desc: c.item_desc,
        heat_no: c.heat_no,
        mrn_uid: c.mrn_uid,
        mrn_no: c.mrn_no,
        location_id: c.location_id ?? null,
        location_no: c.location_no || null,
        out_uid: c.out_uid ?? null,
        source: c.source || "scan",
        is_seed_scan: Boolean(c.is_seed_scan),
      };
    };

    const issuedSnapshot = isStoreIn || isConsume ? coils.map(snapshotLine) : undefined;

    const payload = {
      request_type: requestType,
      rejection_type: isRejection ? rejectionType : null,
      reason: String(reason).trim(),
      remarks: remarks || null,
      lot_no: manualLotNo || first.mrn_no || null,
      mrn_uid: first.mrn_uid || null,
      mrn_no: first.mrn_no ?? null,
      heat_no: first.heat_no || null,
      item_code: first.item_code || null,
      item_desc: first.item_desc || null,
      seed_coil_uid: seedCoilUid || null,
      scanned_coil_uids,
      coils: coilPayload,
      previous_coils: issuedSnapshot,
      proposed_coils: isStoreIn
        ? coils
            .filter((c) => (Number(c.remaining_qty ?? c.qty) || 0) > 0)
            .map((c) => proposedFromCoil(c, c.remaining_qty))
        : [],
      created_by_name: actorName,
      updated_by_name: actorName,
      approved_by_name: actorName,
      ...(resolveApproved !== undefined ? { approved: Boolean(resolveApproved) } : {}),
    };

    setSaving(true);
    try {
      let res;
      if (isApprove && editData?.ipr_uid) {
        if (approvedFlag === false) {
          res = await inProcessRequestService.update(editData.ipr_uid, {
            ...payload,
            approved: false,
          });
        } else {
          res = await inProcessRequestService.approve(editData.ipr_uid, {
            ...payload,
            approved: resolveApproved !== undefined ? Boolean(resolveApproved) : true,
          });
        }
      } else if (isEdit && editData?.ipr_uid) {
        res = await inProcessRequestService.update(editData.ipr_uid, payload);
      } else {
        res = await inProcessRequestService.create({
          ...payload,
          approved: Boolean(resolveApproved),
        });
      }
      showScanToast("success", "save-ok", res?.message || "Saved successfully.", 2800);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      showScanToast(
        "error",
        "save-fail",
        err?.message || "Could not save the in-process request. Please try again.",
        4000
      );
    } finally {
      setSaving(false);
    }
  };

  const canReceiveStoreIn =
    Boolean(editData?.ipr_uid) &&
    editData?.request_type === IPR_REQUEST_TYPE.STORE_IN &&
    editData?.approved === true &&
    editData?.downstream === IPR_DOWNSTREAM.PENDING_STORE_IN;

  const handleReceiveStoreIn = async () => {
    if (!editData?.ipr_uid || saving) return;
    setSaving(true);
    try {
      const res = await inProcessRequestService.completeStoreIn(editData.ipr_uid);
      showScanToast("success", "receive-ok", res?.message || "Store-in received.", 3200);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      showScanToast(
        "error",
        "receive-fail",
        err?.message || "Could not receive the store-in request.",
        4000
      );
    } finally {
      setSaving(false);
    }
  };

  const drawerDescription = showRequestTypePicker ? (
    "Select a request type"
  ) : showScanGate ? (
    "Scan a coil sticker"
  ) : showRejectionTypePicker ? (
    "Reject this coil only, or the whole lot?"
  ) : (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 normal-case tracking-normal font-semibold">
      <span className="uppercase tracking-tight font-bold">
        {isStoreIn
          ? "Scan issued (out) coils, set return qty, then submit — used qty is consumed, remainder is store in"
          : isConsume
            ? "Enter reason, scan coils, then save with remark"
            : isLotMode
              ? "Enter the lot or MRN number, or scan one coil to load all lot coils"
              : "Scan the coil stickers, enter a reason, then submit"}
      </span>
      {mode === "add" && !readOnly ? (
        <>
          <span className="text-slate-300 font-normal" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={handleChangeType}
            className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 font-bold"
          >
            Change type
          </button>
        </>
      ) : null}
    </span>
  );

  /** Banner on an already-approved request, keyed by where it went next. */
  const downstreamNotice =
    {
      [IPR_DOWNSTREAM.PENDING_STORE_IN]: {
        box: "bg-teal-50 border-teal-200",
        icon: "text-teal-600",
        text: "text-teal-800",
        message:
          "Authorized and queued in Store In Pending. Receive when ready — same coil updates with return qty in Unassigned Area (no new coil record).",
      },
      [IPR_DOWNSTREAM.STORE_IN_DONE]: {
        box: "bg-teal-50 border-teal-200",
        icon: "text-teal-600",
        text: "text-teal-800",
        message:
          "Received — same coil is back in Unassigned Area with return qty. Consume (if any) was recorded separately.",
      },
      [IPR_DOWNSTREAM.PENDING_STORE_OUT]: {
        box: "bg-rose-50 border-rose-200",
        icon: "text-rose-500",
        text: "text-rose-800",
        message:
          "Approved and queued in RM Rejection Pending. Generate Store Out from the Rejection module.",
      },
      [IPR_DOWNSTREAM.CONSUMED]: {
        box: "bg-amber-50 border-amber-200",
        icon: "text-amber-600",
        text: "text-amber-800",
        message:
          "Authorized — used qty consumed. Any balance remains on shop floor for a separate Store In request.",
      },
    }[editData?.downstream] || null;

  const footerContent = showTypePicker ? (
    <RmStoreDrawerFooter onClose={onClose} cancelOnly />
  ) : canReceiveStoreIn && readOnly ? (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={onClose} disabled={saving} className={IMS_DRAWER_BTN_CLOSE}>
        Close
      </button>
      <button
        type="button"
        onClick={() => void handleReceiveStoreIn()}
        disabled={saving}
        className={IMS_DRAWER_BTN_APPROVE}
      >
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        Receive to Unassigned Area
      </button>
    </div>
  ) : (
    <RmStoreDrawerFooter
      onClose={onClose}
      loading={saving}
      readOnly={readOnly}
      isApprove={isApprove}
      onSave={handleSave}
      approveLabel="Authorize"
    />
  );

  const scanControls = (tone = "amber", { gate = false } = {}) => {
    const btnBg =
      tone === "yellow"
        ? "bg-yellow-600 border-yellow-700 hover:bg-yellow-700"
        : tone === "indigo"
          ? "bg-indigo-600 border-indigo-700 hover:bg-indigo-700"
          : "bg-amber-600 border-amber-700 hover:bg-amber-700";
    const borderTone =
      tone === "yellow"
        ? "border-yellow-100"
        : tone === "indigo"
          ? "border-indigo-100"
          : "border-amber-100";
    return (
      <>
        {(showPhoneQr || showLaserUi) && (
          <div
            className={`flex items-stretch gap-2 w-full min-w-0 p-1.5 bg-white border ${borderTone} rounded-lg`}
          >
            {showPhoneQr && (
              <button
                type="button"
                onClick={startCameraScanner}
                disabled={isScannerOpen || loadingLot || validatingCoil}
                className={`h-9 px-3 ${btnBg} border text-white rounded-lg transition-all shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${scanBtnFill}`}
              >
                <QrCode size={14} />
                <span className="text-[10px] font-black uppercase">
                  {gate || isLotMode ? "Scan coil" : "QR"}
                </span>
              </button>
            )}
            {showLaserUi && (
              <LaserScanField
                active={open && !readOnly && (gate ? showScanGate : !showTypePicker)}
                onScanned={gate ? onGateLaserScan : onCoilLaserScan}
                onScanRejected={handleLaserScanRejected}
                formatPreview={coilUidDisplayLabel}
                compact
                heightClass="h-9"
                fill={scanBtnCount > 0}
                armButtonLabel="Scan"
                placeholder={getScanInputPlaceholder("coil")}
              />
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={onClose}
        onSubmit={() => {
          if (showTypePicker || readOnly) return;
          handleSave(isApprove ? true : undefined);
        }}
        title={title}
        description={drawerDescription}
        footer={footerContent}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-2 pb-1">
          <QrScannerOverlay
            open={isScannerOpen}
            onClose={closeScanner}
            readerId={SCANNER_ID}
            hint={
              isLotMode
                ? "Scan any coil to identify the lot. All active coils will load."
                : "Scanning the coil sticker QR code"
            }
            frameClassName="border-4 border-inward-box-scanner-frame"
            torchSupported={torchSupported}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
          />

          {showRequestTypePicker ? (
            <div className="space-y-3 py-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Select a request type
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {REQUEST_TYPE_OPTIONS.map((option) => {
                  const cardAccent = TYPE_PICKER_ACCENT[option.accent] || TYPE_PICKER_ACCENT.rose;
                  const Icon = option.Icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectRequestType(option.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] min-w-0 h-full flex flex-col ${cardAccent.card}`}
                    >
                      <div className={`flex items-start gap-2 min-w-0 ${cardAccent.title}`}>
                        <span className="inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-white/70 border border-current/10">
                          <Icon size={16} />
                        </span>
                        <span className="text-xs font-black uppercase tracking-tight leading-snug break-words min-w-0 pt-1.5">
                          {option.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-2 leading-snug flex-1">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : showScanGate ? (
            <div className="space-y-3 py-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Scan a coil sticker
              </p>
              <div className="space-y-2 bg-indigo-50/40 p-2 rounded-lg border border-indigo-100 shadow-sm">
                {scanControls("indigo", { gate: true })}
                {keyboardType ? (
                  <div className="flex w-full min-w-0 gap-1.5">
                    <input
                      type="text"
                      value={manualCoilId}
                      onChange={(e) => setManualCoilId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (manualCoilId.trim()) {
                            void handleGateScan(manualCoilId);
                            setManualCoilId("");
                          }
                        }
                      }}
                      placeholder="Enter or paste a coil UID"
                      className={`${OK_INPUT} flex-1 min-w-0 font-mono`}
                    />
                    <button
                      type="button"
                      disabled={validatingCoil}
                      onClick={() => {
                        if (manualCoilId.trim()) {
                          void handleGateScan(manualCoilId);
                          setManualCoilId("");
                        }
                      }}
                      className="h-9 px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase shrink-0 disabled:opacity-50"
                    >
                      {validatingCoil ? <Loader2 size={14} className="animate-spin" /> : "Load"}
                    </button>
                  </div>
                ) : !showPhoneQr && !showLaserUi ? (
                  <p className="text-[10px] text-slate-500 px-1">Enable scan mode in Settings.</p>
                ) : null}
                {validatingCoil ? (
                  <div className="flex items-center gap-2 px-1">
                    <Loader2 size={12} className="animate-spin text-indigo-600" />
                    <p className="text-[9px] font-bold text-indigo-800 uppercase">Reading sticker…</p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleChangeType}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
              >
                ← Back to request type
              </button>
            </div>
          ) : showRejectionTypePicker ? (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-200 min-w-0">
                <Package size={14} className="text-indigo-600 shrink-0" />
                <p className="text-[10px] font-bold text-indigo-900 uppercase truncate">
                  {coilUidDisplayLabel(pendingCoil.coil_no_uid)} · MRN{" "}
                  {pendingCoil.mrn_no ?? "—"}
                </p>
              </div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Reject this coil or the whole lot?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REJECTION_TYPE_OPTIONS.map((option) => {
                  const cardAccent = TYPE_PICKER_ACCENT[option.accent] || TYPE_PICKER_ACCENT.amber;
                  const Icon = option.Icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={loadingLot}
                      onClick={() => void selectRejectionScope(option.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] min-w-0 h-full flex flex-col disabled:opacity-60 ${cardAccent.card}`}
                    >
                      <div className={`flex items-start gap-2 min-w-0 ${cardAccent.title}`}>
                        <span className="inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-white/70 border border-current/10">
                          <Icon size={16} />
                        </span>
                        <span className="text-xs font-black uppercase tracking-tight leading-snug break-words min-w-0 pt-1.5">
                          {option.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-2 leading-snug flex-1">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={backToScanStep}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
              >
                ← Scan a different coil
              </button>
            </div>
          ) : (
            <div className="space-y-2 animate-in fade-in duration-300">
              {isEdit && editData?.approved && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-700 font-medium leading-normal">
                    Editing this authorized{" "}
                    {isStoreIn ? "store-in request" : isConsume ? "consume request" : "rejection"}{" "}
                    will reset its status to{" "}
                    <span className="font-bold text-amber-900 uppercase">Pending</span>
                    {isConsume ? " and coils return to shop floor (out)" : ""}.
                  </p>
                </div>
              )}

              {editData?.approved && downstreamNotice ? (
                <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${downstreamNotice.box}`}>
                  <AlertCircle size={16} className={`mt-0.5 shrink-0 ${downstreamNotice.icon}`} />
                  <p className={`text-[11px] font-medium leading-normal ${downstreamNotice.text}`}>
                    {downstreamNotice.message}
                  </p>
                </div>
              ) : null}

              {/* IMS order: Reason first */}
              <TypeableSuggestField
                label="Reason"
                required
                value={reason}
                onChange={(v) => setReason(v)}
                error={errors.reason || ""}
                readOnly={readOnly}
                disabled={readOnly}
                placeholder="Enter a reason or select a previous one"
                dataField="reason"
                fetchSuggestions={fetchReasonsForType}
                optionLabelKey="reason"
                optionIdKey="reason"
                active={open && !showTypePicker}
                onClearError={() => {
                  if (errors.reason) setErrors((er) => ({ ...er, reason: undefined }));
                }}
              />

              {isStoreIn ? (
                <StoreInRequestForm
                  readOnly={readOnly}
                  coils={coils}
                  errors={errors}
                  manualCoilId={manualCoilId}
                  setManualCoilId={setManualCoilId}
                  validatingCoil={validatingCoil}
                  showPhoneQr={showPhoneQr}
                  showLaserUi={showLaserUi}
                  keyboardType={keyboardType}
                  isScannerOpen={isScannerOpen}
                  onStartCamera={startCameraScanner}
                  onLaserScan={onCoilLaserScan}
                  onLaserRejected={handleLaserScanRejected}
                  onAddManual={() => {
                    if (manualCoilId.trim()) {
                      void tryAddCoil(manualCoilId);
                      setManualCoilId("");
                    }
                  }}
                  onRemoveCoil={removeCoil}
                  onRemainingChange={handleRemainingChange}
                  scanBtnFill={scanBtnFill}
                  laserActive={open && !readOnly && !showTypePicker}
                />
              ) : isConsume ? (
                <ConsumeRequestForm
                  readOnly={readOnly}
                  coils={coils}
                  errors={errors}
                  manualCoilId={manualCoilId}
                  setManualCoilId={setManualCoilId}
                  validatingCoil={validatingCoil}
                  showPhoneQr={showPhoneQr}
                  showLaserUi={showLaserUi}
                  keyboardType={keyboardType}
                  isScannerOpen={isScannerOpen}
                  onStartCamera={startCameraScanner}
                  onLaserScan={onCoilLaserScan}
                  onLaserRejected={handleLaserScanRejected}
                  onAddManual={() => {
                    if (manualCoilId.trim()) {
                      void tryAddCoil(manualCoilId);
                      setManualCoilId("");
                    }
                  }}
                  onRemoveCoil={removeCoil}
                  onPartialToggle={handlePartialToggle}
                  onUsedQtyChange={handleUsedQtyChange}
                  scanBtnFill={scanBtnFill}
                  laserActive={open && !readOnly && !showTypePicker}
                />
              ) : (
                <>
              {/* Lot = Full Hold packing entry (only while empty) */}
              {showLotEntryUi ? (
                <div className="space-y-2 bg-yellow-50/40 p-2 rounded-lg border border-yellow-200 shadow-sm">
                  <p className="text-[10px] font-bold text-yellow-900 uppercase px-0.5">
                    Lot rejection — MRN
                  </p>
                  {scanControls("yellow")}
                  <div className="flex w-full min-w-0 gap-1.5 p-1.5 bg-white border border-yellow-100 rounded-lg">
                    <input
                      type="text"
                      value={manualLotNo}
                      onChange={(e) => {
                        setManualLotNo(e.target.value);
                        if (errors.scan) setErrors((prev) => ({ ...prev, scan: undefined }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (manualLotNo.trim()) void loadLotByNumber(manualLotNo);
                        }
                      }}
                      placeholder="Enter the lot or MRN number"
                      disabled={loadingLot}
                      className={`${OK_INPUT} flex-1 min-w-0 font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => void loadLotByNumber(manualLotNo)}
                      disabled={loadingLot || !manualLotNo.trim()}
                      className="h-9 px-3 bg-yellow-600 text-white rounded-lg text-[10px] font-bold uppercase shrink-0 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {loadingLot ? <Loader2 size={14} className="animate-spin" /> : null}
                      Load
                    </button>
                  </div>
                  {errors.scan ? (
                    <p className="text-[10px] font-bold text-rose-600 px-0.5">{errors.scan}</p>
                  ) : null}
                </div>
              ) : null}

              {isLotMode && coils.length > 0 ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[8px] font-bold uppercase px-1.5 py-1 rounded border leading-tight border-yellow-300 bg-yellow-50 text-yellow-900">
                    Lot · MRN #{manualLotNo || coils[0]?.mrn_no || "—"} · {coils.length} coils
                    {seedCoilUid ? ` · scanned ${coilUidDisplayLabel(seedCoilUid)}` : ""}
                  </p>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={clearLoadedLot}
                      className="text-[10px] font-bold uppercase text-slate-500 hover:text-rose-600 shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              ) : null}

              {/* Coil = Partial Hold scan panel */}
              {showCoilScanUi ? (
                <div className="space-y-2 bg-amber-50/30 p-2 rounded-lg border border-amber-100 shadow-sm">
                  <div className="space-y-2 p-1.5 bg-white border border-amber-100 rounded-lg w-full min-w-0">
                    {coils.length === 0 ? (
                      <p className="text-[9px] font-semibold text-amber-800/80 px-0.5 leading-snug">
                        Scan coil stickers one by one. Each scanned coil is recorded at coil level.
                      </p>
                    ) : null}
                    {scanControls("amber")}
                    {keyboardType ? (
                      <div className="flex w-full min-w-0 gap-1.5">
                        <input
                          type="text"
                          value={manualCoilId}
                          onChange={(e) => setManualCoilId(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (manualCoilId.trim()) {
                                void tryAddCoil(manualCoilId);
                                setManualCoilId("");
                              }
                            }
                          }}
                          placeholder="Enter or paste a coil UID"
                          className={`${OK_INPUT} flex-1 min-w-0 font-mono`}
                        />
                        <button
                          type="button"
                          disabled={validatingCoil}
                          onClick={() => {
                            if (manualCoilId.trim()) {
                              void tryAddCoil(manualCoilId);
                              setManualCoilId("");
                            }
                          }}
                          className="h-9 px-3 bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase shrink-0 disabled:opacity-50"
                        >
                          {validatingCoil ? <Loader2 size={14} className="animate-spin" /> : "Add"}
                        </button>
                      </div>
                    ) : !showPhoneQr && !showLaserUi && !keyboardType ? (
                      <p className="text-[10px] text-slate-500 px-1">Enable scan mode in Settings.</p>
                    ) : null}
                  </div>
                  {errors.scan && isCoilMode ? (
                    <p className="text-[10px] font-bold text-rose-600 px-0.5">{errors.scan}</p>
                  ) : null}
                </div>
              ) : null}

              {loadingLot && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white border border-yellow-100 rounded-lg">
                  <Loader2 size={12} className="animate-spin text-yellow-600" />
                  <p className="text-[9px] font-bold text-yellow-800 uppercase">Loading lot coils…</p>
                </div>
              )}

              {/* Coil list — same card grid as IMS scanned boxes */}
              <div className="space-y-2">
                <div
                  className={`bg-white/60 rounded-lg border overflow-hidden ${
                    isLotMode ? "border-yellow-100" : "border-amber-50"
                  }`}
                >
                  <div
                    className={`px-3 py-1.5 border-b flex justify-between items-center ${
                      isLotMode
                        ? "bg-yellow-100/50 border-yellow-100"
                        : "bg-amber-100/50 border-amber-100"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        isLotMode ? "text-yellow-800" : "text-amber-800"
                      }`}
                    >
                      {isLotMode ? "Lot coils (recorded)" : "Scanned coils"}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase ${
                        isLotMode ? "text-yellow-800/50" : "text-amber-800/50"
                      }`}
                    >
                      {coils.length} total · qty {totalQty.toLocaleString()}
                    </span>
                  </div>
                  <div className="max-h-[min(40dvh,280px)] overflow-y-auto overscroll-y-contain p-2 custom-scrollbar">
                    {coils.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {coils.map((c) => (
                          <div
                            key={c.coil_no_uid}
                            className={`bg-white p-2 rounded-lg border flex items-center justify-between shadow-sm ${
                              c.is_seed_scan ? "border-indigo-200" : "border-emerald-100"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0">
                                C
                              </div>
                              <div className="flex flex-col leading-tight min-w-0">
                                <span className="text-[11px] font-mono font-black text-slate-700 truncate">
                                  {coilUidDisplayLabel(c.coil_no_uid)}
                                  {c.is_seed_scan ? (
                                    <span className="ml-1 text-[8px] font-black uppercase text-indigo-600">
                                      scanned
                                    </span>
                                  ) : null}
                                </span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase truncate">
                                  MRN {c.mrn_no ?? "—"} · Qty: {Number(c.qty ?? 0).toLocaleString()}
                                  {c.item_code ? ` · ${c.item_code}` : ""}
                                </span>
                              </div>
                            </div>
                            {!readOnly && isCoilMode ? (
                              <button
                                type="button"
                                onClick={() => removeCoil(c.coil_no_uid)}
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
                              >
                                <X size={16} />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                        <ScanLine size={32} className="opacity-20 mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest">
                          {isLotMode ? "Enter a lot or MRN number above" : "Scan coils"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
                </>
              )}

              <RemarksTextarea
                label="Remark"
                value={remarks}
                onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
                disabled={readOnly}
                placeholder="Enter notes (optional)"
                rows={3}
              />

              {!readOnly && !showTypePicker ? (
                <ApprovalStatusToggle
                  show={showApproval}
                  checked={approved}
                  onChange={setApproved}
                  pendingHint={
                    isConsume
                      ? "Stay pending until authorized — then scanned coils are consumed."
                      : "This request will stay Pending until authorized."
                  }
                />
              ) : null}

              {!readOnly && (
                <ModuleSopAcknowledgment
                  ref={sopAckRef}
                  key={`${open}-${sopPermissionType}-ipr`}
                  moduleSlug={MODULE}
                  permissionType={sopPermissionType}
                  isOpen={open}
                />
              )}
            </div>
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
