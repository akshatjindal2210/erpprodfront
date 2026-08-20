"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Check, Loader2, Layers, ScanLine, AlertCircle, Package, QrCode, X, ShieldAlert, Upload, FileText, Trash2 as TrashIcon } from "lucide-react";
import { useSelector } from "react-redux";

import "@/apps/ims/lib/config/inwardUi.theme.css";

import { FILE_BASE_URL } from "@/platform/utils/core/lib";
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { coilHelperContext, lookupCoilByUid, lookupCoils } from "@/apps/rmstore/lib/helpers/coilLookup";
import { mrnService } from "@/apps/rmstore/lib/services/mrn";
import { inProcessRequestService, IPR_REQUEST_TYPE, IPR_DOWNSTREAM, IPR_REQUEST_TYPE_LABEL, IPR_REJECTION_SCOPE_LABEL } from "@/apps/rmstore/lib/services/inProcessRequest";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";
import { extractCoilUid, normalizeScanInput, coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";
import Drawer from "@/ui/primitives/Drawer";
import Snackbar from "@/ui/primitives/Snackbar";
import FormTextarea from "@/ui/common/forms/FormTextarea";
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
import UpdateCoilStatusForm from "@/apps/rmstore/modules/in-process-request/UpdateCoilStatusForm";
import ApprovalStatusToggle from "@/apps/rmstore/modules/shared/ApprovalStatusToggle";
import { isCoilEligibleForIprRejection, iprRejectionIneligibleMessage, iprRejectionPendingStoreInMessage, findRejectionCoilsBlockedByPendingStoreIn, filterCoilsForRejectionLot } from "@/apps/rmstore/lib/utils/iprRejectionEligibility";
import { isIssuedToShopFloor, isSaMinusWriteOff } from "@/apps/rmstore/lib/utils/saMinusInventory";
import { canSubmitInProcessRejection } from "@/apps/rmstore/lib/utils/rmstoreSpecialPermissions";

const MODULE = "rm_in_process_request";
const SCANNER_ID = "rm-in-process-request-scanner";
const SNACK_DUR = { short: 3200, med: 4000, long: 5200 };
const INITIAL_SNACK = { open: false, variant: "success", title: "", message: "", duration: SNACK_DUR.med };

function iprShopFloorScanError(coil, uid) {
  if (isSaMinusWriteOff(coil)) {
    return `Coil ${uid} was removed by stock adjustment and is not on the shop floor.`;
  }
  const status = String(coil?.status || "active").toLowerCase();
  return `Coil ${uid} is not on the shop floor (status: ${status}). Only issued-out coils can be scanned.`;
}

function resolveDocUrl(noteOrPath) {
  const raw = String(noteOrPath || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) return raw;
  let path = raw.replace(/^\/+/, "").replace(/\\/g, "/");
  if (path.startsWith("rmstore/")) path = `uploads/${path}`;
  if (path.startsWith("uploads/")) return `${String(FILE_BASE_URL || "").replace(/\/$/, "")}/${path}`;
  return "";
}

/** Same accent tokens as IMS QC Pending  type picker. */
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
  indigo: {
    card: "border-indigo-300 bg-indigo-50/60 hover:border-indigo-400 hover:bg-indigo-50",
    title: "text-indigo-900",
    banner: "border-indigo-200 bg-indigo-50 text-indigo-900",
  },
};

const IPR_FLOW = {
  REJECTION: "rejection",
  UPDATE_STATUS: "update_status",
};

const FLOW_OPTIONS = [
  {
    id: IPR_FLOW.REJECTION,
    title: "In-process Rejection",
    description: "Reject from the machine",
    accent: "rose",
    Icon: ShieldAlert,
  },
  {
    id: IPR_FLOW.UPDATE_STATUS,
    title: "Update Coil Status",
    description: "Full consume or leftover — updates immediately",
    accent: "indigo",
    Icon: Layers,
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
    description: "Every rejectable coil in the lot (store or shop floor)",
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

  if (extras.forStoreIn) {
    const shopQty = Number(c.qty) || 0;
    const remaining = c.remaining_qty != null ? Number(c.remaining_qty) : shopQty;
    return {
      coil_no_uid: c.coil_no_uid,
      qty: remaining,
      original_qty: shopQty,
      remaining_qty: remaining,
      consumed_qty: Math.max(0, shopQty - remaining),
      item_code: c.item_code,
      item_desc: c.item_desc,
      heat_no: c.heat_no,
      mrn_uid: c.mrn_uid,
      mrn_no: c.mrn_no,
      location_id: c.location_id ?? null,
      location_no: c.location_no || null,
      out_uid: c.out_uid ?? null,
      status: c.status,
      source: extras.source || c.source || "scan",
      is_seed_scan: Boolean(extras.is_seed_scan ?? c.is_seed_scan),
    };
  }

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
  const coilCtx = useMemo(
    () => coilHelperContext(MODULE, isApprove ? "authorize" : isEdit ? "edit" : readOnly ? "view" : "add"),
    [isApprove, isEdit, readOnly]
  );

  const [saving, setSaving] = useState(false);
  const [requestFlow, setRequestFlow] = useState(IPR_FLOW.REJECTION);
  const [requestFlowPicked, setRequestFlowPicked] = useState(false);
  const [requestType, setRequestType] = useState(IPR_REQUEST_TYPE.REJECTION);
  const [requestTypePicked, setRequestTypePicked] = useState(false);
  const [rejectionType, setRejectionType] = useState("coil");
  const [typePicked, setTypePicked] = useState(false);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [approved, setApproved] = useState(false);
  const [coils, setCoils] = useState([]);
  const [proposedCoils, setProposedCoils] = useState([]);
  const [manualLotNo, setManualLotNo] = useState("");
  const [manualCoilId, setManualCoilId] = useState("");
  const [loadingLot, setLoadingLot] = useState(false);
  const [seedCoilUid, setSeedCoilUid] = useState(null);
  /** Scanned coil held between the scan step and the Coil/Lot choice. */
  const [pendingCoil, setPendingCoil] = useState(null);
  /** Update Coil Status — full consume (default) or leftover with consumed qty. */
  const [consumeMode, setConsumeMode] = useState("full");
  const [leftoverConsumedQty, setLeftoverConsumedQty] = useState("");
  const coilsRef = useRef([]);
  coilsRef.current = coils;
  const requestTypeRef = useRef(requestType);
  requestTypeRef.current = requestType;
  const requestFlowRef = useRef(requestFlow);
  requestFlowRef.current = requestFlow;

  const isRejectionScanContext = () =>
    requestFlowRef.current === IPR_FLOW.REJECTION ||
    requestTypeRef.current === IPR_REQUEST_TYPE.REJECTION;

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
  const isTransfer = requestType === IPR_REQUEST_TYPE.TRANSFER;
  const isRejection = requestType === IPR_REQUEST_TYPE.REJECTION;

  const isRejectionFlow = requestFlow === IPR_FLOW.REJECTION;
  const isUpdateStatusFlow = requestFlow === IPR_FLOW.UPDATE_STATUS;

  /** Step 0 — Flow picker (Rejection vs Update Status). */
  const showRequestFlowPicker = mode === "add" && !requestFlowPicked;

  /** Step 1 — scan seed coil. Both flows start with scan. */
  const showScanGate =
    mode === "add" &&
    requestFlowPicked &&
    !pendingCoil &&
    !typePicked;

  /** Step 2 — Coil or Lot (rejection flow only, AFTER scan). */
  const showRejectionTypePicker =
    mode === "add" &&
    requestFlowPicked &&
    isRejectionFlow &&
    !!pendingCoil &&
    !typePicked;

  const showTypePicker =
    showRequestFlowPicker ||
    showScanGate ||
    showRejectionTypePicker;

  const visibleFlowOptions = useMemo(
    () =>
      FLOW_OPTIONS.filter(
        (opt) =>
          opt.id !== IPR_FLOW.REJECTION || canSubmitInProcessRejection(currentUser)
      ),
    [currentUser]
  );

  const isLotMode = isRejectionFlow && rejectionType === "lot";
  const isCoilMode = !isLotMode;
  /** Lot empty state = IMS Full Hold packing entry panel. */
  const showLotEntryUi =
    isRejectionFlow && isLotMode && !readOnly && coils.length === 0 && mode !== "view";
  /** Rejection coil scan only — Store In / Consume use dedicated forms. */
  const showCoilScanUi = isRejectionFlow && isCoilMode && !readOnly && (coils.length === 0 || isEdit);
  const showApproval =
    canApprove &&
    !readOnly &&
    !showTypePicker &&
    isRejectionFlow &&
    (mode === "add" || mode === "approve");

  const closeSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, open: false }));
  }, []);
  const { showScanToast, showScanSuccess } = useScanSnackbarActions(setSnackbar, scanToastRef);

  const requestLabel =
    requestType === IPR_REQUEST_TYPE.REJECTION
      ? "In-process Rejection"
      : IPR_REQUEST_TYPE_LABEL[requestType] || "In-process Request";

  const title = isView
    ? `View ${requestLabel}`
    : isApprove
      ? `Approve ${requestLabel}`
      : isEdit
        ? `Edit ${requestLabel}`
        : showRequestFlowPicker
          ? "New In-process Request"
          : showScanGate
            ? `New ${isRejectionFlow ? "Rejection" : "Coil Status Update"}`
            : `New ${requestLabel}`;

  /** Back to step 0 — the flow picker. */
  const resetFlowSelection = useCallback(() => {
    scanSessionRef.current += 1;
    setRequestFlow(IPR_FLOW.REJECTION);
    setRequestFlowPicked(false);
    setRequestType(IPR_REQUEST_TYPE.REJECTION);
    setRequestTypePicked(false);
    setRejectionType("coil");
    setTypePicked(false);
    setPendingCoil(null);
    setConsumeMode("full");
    setLeftoverConsumedQty("");
  }, []);

  const resetForm = useCallback(() => {
    resetFlowSelection();
    setReason("");
    setRemarks("");
    setAttachments([]);
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
  }, [resetFlowSelection]);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    if (editData?.ipr_uid && mode !== "add") {
      const flow = editData.request_type === IPR_REQUEST_TYPE.REJECTION ? IPR_FLOW.REJECTION : IPR_FLOW.UPDATE_STATUS;
      setRequestFlow(flow);
      setRequestFlowPicked(true);
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
      setAttachments(Array.isArray(editData.attachments) ? editData.attachments : []);
      setApproved(isApprove ? true : Boolean(editData.approved));
      setCoils(
        Array.isArray(editData.coils)
          ? editData.coils.map((c) =>
              mapCoilRow(c, {
                forConsume: editData.request_type === IPR_REQUEST_TYPE.CONSUME,
                forStoreIn: editData.request_type === IPR_REQUEST_TYPE.STORE_IN,
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
      if (editData.request_type === IPR_REQUEST_TYPE.CONSUME && Array.isArray(editData.coils) && editData.coils.length) {
        const first = editData.coils[0];
        const original = Number(first.original_qty ?? first.qty) || 0;
        const used = Number(first.consumed_qty ?? original) || 0;
        const partial = Boolean(first.partial_qty) || (used > 0 && used < original);
        setConsumeMode(partial ? "leftover" : "full");
        setLeftoverConsumedQty(partial ? String(used) : "");
      } else {
        setConsumeMode("full");
        setLeftoverConsumedQty("");
      }
      setErrors({});
      setIsScannerOpen(false);
      setSaving(false);
      return;
    }

    resetForm();
    if (mode === "approve") setApproved(true);
    if (mode === "add" && !canSubmitInProcessRejection(currentUser)) {
      setRequestFlow(IPR_FLOW.UPDATE_STATUS);
      setRequestFlowPicked(true);
    }
  }, [open, editData, mode, isApprove, resetForm, currentUser]);

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

  const finalizeLotCoilsForRejection = async (coils) => {
    const { kept, blocked } = await filterCoilsForRejectionLot(coils, lookupCoilByUid, coilCtx);
    if (blocked.length) {
      showScanToast(
        "info",
        "lot-store-in-skip",
        `${blocked.length} coil(s) skipped — ${blocked[0].message}`,
        6000
      );
    }
    return kept;
  };

  const loadLotCoilsByMrnUid = async (mrnUid) => {
    const uid = String(mrnUid || "").trim();
    if (!uid) return [];
    const editIprUid = editData?.ipr_uid ?? null;
    const { data } = await fetchAllListPages(async (page, limit) => {
      const body = await lookupCoils(
        {
          page,
          limit,
          filters: { mrn_uid: uid },
        },
        coilCtx
      );
      return { data: body.data ?? [], total: body.total ?? 0 };
    }, 500);
    const eligible = (data || []).filter(
      (c) => c.coil_no_uid && isCoilEligibleForIprRejection(c, { editIprUid })
    );
    return finalizeLotCoilsForRejection(eligible);
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
        const body = await lookupCoils(
          {
            page,
            limit,
            filters: { mrn_no: no },
          },
          coilCtx
        );
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, 500);
      const editIprUid = editData?.ipr_uid ?? null;
      for (const c of data || []) {
        if (!c?.coil_no_uid) continue;
        if (String(c.mrn_no ?? "").trim() !== no) continue;
        if (!isCoilEligibleForIprRejection(c, { editIprUid })) continue;
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
      const editIprUid = editData?.ipr_uid ?? null;
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await lookupCoils(
          {
            page,
            limit,
            search: no,
          },
          coilCtx
        );
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, 500);
      for (const c of data || []) {
        if (!c?.coil_no_uid) continue;
        if (String(c.mrn_no ?? "").trim() !== no) continue;
        if (!isCoilEligibleForIprRejection(c, { editIprUid })) continue;
        byUid.set(String(c.coil_no_uid).toLowerCase(), c);
      }
    }

    const rawCoils = [...byUid.values()];
    const coils = await finalizeLotCoilsForRejection(rawCoils);
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
      setErrors((e) => ({ ...e, scan: "Lot / MRN UID is required." }));
      return;
    }

    setLoadingLot(true);
    try {
      let full = [];
      let mrnUids = [];

      // Prioritize mrn_uid for the specific lot
      full = await loadLotCoilsByMrnUid(lot);
      if (full.length) {
        mrnUids = [lot];
      } else {
        // Fallback to mrn_no
        const byNo = await loadLotCoilsByMrnNo(lot);
        full = byNo.coils || [];
        mrnUids = byNo.mrnUids || [];
      }

      if (!full.length) {
        setErrors((e) => ({ ...e, scan: `No active coils were found for lot or MRN UID ${lot}.` }));
        showScanToast("error", "lot-empty", `No active coils were found for lot or MRN UID ${lot}.`);
        return;
      }

      const label = full[0]?.mrn_uid ?? full[0]?.mrn_no ?? lot;
      applyLotCoils(full, { seedUid: null, lotLabel: label });
      const uidHint = mrnUids.length > 1 ? ` across ${mrnUids.length} MRN lines` : "";
      showScanSuccess("lot-ok", `Loaded ${full.length} coil(s) for MRN UID ${label}${uidHint}`, 2400);
      void playScanSuccessBeep();
    } catch (err) {
      showScanToast("error", "lot-err", err?.message || "Could not load the lot. Please try again.");
    } finally {
      setLoadingLot(false);
    }
  };

  /** Load every active coil of the scanned coil's lot. */
  const loadLotFromCoil = async (coil) => {
    const mrnUid = String(coil.mrn_uid || "").trim();
    const mrnNo =
      coil.mrn_no != null && String(coil.mrn_no).trim() !== ""
        ? String(coil.mrn_no).trim()
        : null;

    if (!mrnUid && !mrnNo) {
      showScanToast("error", "lot-mrn", "This coil is not linked to an MRN UID or lot.");
      return false;
    }

    setLoadingLot(true);
    try {
      let lotCoils = [];
      let mrnUids = [];

      // Prioritize mrn_uid for the specific lot
      if (mrnUid) {
        lotCoils = await loadLotCoilsByMrnUid(mrnUid);
        mrnUids = [mrnUid];
      }

      // Fallback to mrn_no if no coils found for uid or no uid present
      if (!lotCoils.length && mrnNo) {
        const byNo = await loadLotCoilsByMrnNo(mrnNo);
        lotCoils = byNo.coils || [];
        mrnUids = byNo.mrnUids || [];
      }

      if (!lotCoils.length) {
        showScanToast("error", "lot-empty", "No rejectable coils were found for this lot.");
        return false;
      }

      applyLotCoils(lotCoils, {
        seedUid: coil.coil_no_uid,
        lotLabel: mrnUid || mrnNo,
      });
      const uidHint = mrnUids.length > 1 ? ` across ${mrnUids.length} MRN lines` : "";
      showScanSuccess(
        "lot-ok",
        `Loaded ${lotCoils.length} coil(s) from MRN UID ${mrnUid || mrnNo}${uidHint}`,
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
    const coil = await lookupCoilByUid(uid, coilCtx);
    if (!coil) {
      showScanToast("error", "coil-missing", "Coil not found. Check the UID and try again.");
      return null;
    }
    const status = String(coil.status || "active").toLowerCase();
    const reqType = requestTypeRef.current;

    if (isRejectionScanContext()) {
      if (!isCoilEligibleForIprRejection(coil, { editIprUid: editData?.ipr_uid ?? null })) {
        showScanToast("error", "coil-status", iprRejectionIneligibleMessage(coil));
        return null;
      }
      return coil;
    }

    const needsOut =
      reqType === IPR_REQUEST_TYPE.STORE_IN ||
      reqType === IPR_REQUEST_TYPE.CONSUME ||
      reqType === IPR_REQUEST_TYPE.TRANSFER ||
      requestFlowRef.current === IPR_FLOW.UPDATE_STATUS;

    if (needsOut) {
      if (!isIssuedToShopFloor(coil)) {
        showScanToast("error", "coil-status", iprShopFloorScanError(coil, uid));
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
      const reqType = requestTypeRef.current;

      const mapped = mapCoilRow(coil, {
        source: "scan",
        is_seed_scan: true,
        ...(isUpdateStatusFlow || reqType === IPR_REQUEST_TYPE.CONSUME
          ? { forConsume: true }
          : reqType === IPR_REQUEST_TYPE.STORE_IN
            ? { forStoreIn: true }
            : {}),
      });

      if (isUpdateStatusFlow) {
        setRequestType(IPR_REQUEST_TYPE.CONSUME);
        setRequestTypePicked(true);
        setTypePicked(true);
        setApproved(true);
        setConsumeMode("full");
        setLeftoverConsumedQty("");
        setCoils([mapped]);
        setSeedCoilUid(mapped.coil_no_uid);
        setPendingCoil(null);
        setReason("Coil status update");
        setErrors({});
        showScanSuccess("coil-ok", `Loaded ${mapped.coil_no_uid}`, 1600);
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

  /** Back from the sub-type choice to the scan step. */
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
      const coil = await lookupCoilByUid(uid, coilCtx);
      if (!coil) {
        showScanToast("error", "coil-missing", "Coil not found. Check the UID and try again.");
        return;
      }
      if (session !== scanSessionRef.current) return;

      const status = String(coil.status || "active").toLowerCase();
      const reqType = requestTypeRef.current;

      if (isRejectionScanContext()) {
        if (coil.pending_store_in_ipr_uid) {
          showScanToast(
            "error",
            "store-in-pending",
            iprRejectionPendingStoreInMessage(coil)
          );
          return;
        }
        if (!isCoilEligibleForIprRejection(coil, { editIprUid: editData?.ipr_uid ?? null })) {
          showScanToast("error", "coil-status", iprRejectionIneligibleMessage(coil));
          return;
        }
      } else {
        const needsOut =
          reqType === IPR_REQUEST_TYPE.STORE_IN || reqType === IPR_REQUEST_TYPE.CONSUME;

        if (needsOut) {
          if (!isIssuedToShopFloor(coil)) {
            showScanToast("error", "coil-status", iprShopFloorScanError(coil, uid));
            return;
          }
          if (reqType === IPR_REQUEST_TYPE.STORE_IN) {
            if (coil.pending_store_in_ipr_uid) {
              showScanToast(
                "error",
                "store-in-pending",
                `Coil ${uid} is already in Store In Pending (IPR #${coil.pending_store_in_ipr_uid}). Partial consume balance is queued automatically.`
              );
              return;
            }
            const shopQty = Number(coil.qty) || 0;
            if (shopQty <= 0) {
              showScanToast(
                "error",
                "coil-qty",
                `Coil ${uid} has no qty on the shop floor. Use Consume to record usage first.`
              );
              return;
            }
          }
        } else if (status !== "active") {
          showScanToast("error", "coil-status", `Coil ${uid} is not available. Its current status is ${status}.`);
          return;
        }
      }

      if (rejectionTypeRef.current === "lot" && requestTypeRef.current === IPR_REQUEST_TYPE.REJECTION) {
        await loadLotFromCoil(coil);
        return;
      }

      if (coilsRef.current.some((c) => String(c.coil_no_uid).toLowerCase() === uid.toLowerCase())) {
        showScanToast("error", `dup-${uid}`, `Coil ${uid} has already been added.`, 1800);
        return;
      }

      const mapped = mapCoilRow(coil, {
        source: "scan",
        is_seed_scan: true,
        ...(reqType === IPR_REQUEST_TYPE.CONSUME
          ? { forConsume: true }
          : reqType === IPR_REQUEST_TYPE.STORE_IN
            ? { forStoreIn: true }
            : {}),
      });
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

  const handleConsumeModeChange = (mode) => {
    if (readOnly || !isUpdateStatusFlow) return;
    setConsumeMode(mode);
    setCoils((prev) =>
      prev.map((c) => {
        const original = Number(c.original_qty ?? c.qty) || 0;
        if (mode === "full") {
          return {
            ...c,
            partial_qty: false,
            consumed_qty: original,
            remaining_qty: 0,
          };
        }
        const raw = leftoverConsumedQty === "" ? NaN : Number(leftoverConsumedQty);
        const used = Number.isFinite(raw) ? Math.max(0, Math.min(original, raw)) : 0;
        return {
          ...c,
          partial_qty: true,
          consumed_qty: used,
          remaining_qty: Math.max(0, original - used),
        };
      })
    );
    if (errors.qty) setErrors((e) => ({ ...e, qty: undefined }));
  };

  const handleLeftoverConsumedQtyChange = (value) => {
    if (readOnly || !isUpdateStatusFlow) return;
    const coil = coils[0];
    const original = Number(coil?.original_qty ?? coil?.qty) || 0;
    const raw = value === "" ? NaN : Number(value);
    const clamped = value === "" ? "" : String(Number.isFinite(raw) ? Math.max(0, Math.min(original, raw)) : 0);
    setLeftoverConsumedQty(clamped);
    setCoils((prev) =>
      prev.map((c) => {
        const orig = Number(c.original_qty ?? c.qty) || 0;
        const used = clamped === "" ? 0 : Number(clamped) || 0;
        return {
          ...c,
          partial_qty: true,
          consumed_qty: used,
          remaining_qty: Math.max(0, orig - used),
        };
      })
    );
    if (errors.qty) setErrors((e) => ({ ...e, qty: undefined }));
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

  const selectRequestFlow = (flow) => {
    if (readOnly) return;
    setRequestFlow(flow);
    setRequestFlowPicked(true);

    if (flow === IPR_FLOW.REJECTION) {
      setRequestType(IPR_REQUEST_TYPE.REJECTION);
      setRequestTypePicked(true);
    } else {
      setRequestType(IPR_REQUEST_TYPE.CONSUME);
      setRequestTypePicked(false);
    }
  };

  const backToFlowStep = () => {
    if (readOnly) return;
    resetFlowSelection();
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

  const handleChangeType = backToFlowStep;

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

  const handleFilePick = (e) => {
    if (readOnly) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (isRejectionFlow) {
      const invalid = files.filter((f) => !f.type.startsWith("image/"));
      if (invalid.length) {
        showScanToast("error", "photo-only", "Rejection requires photos only (JPEG, PNG, WebP). PDFs are not allowed.", 4000);
        e.target.value = "";
        return;
      }
    }

    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeFile = (idx) => {
    if (readOnly) return;
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

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
    if (!isUpdateStatusFlow && !String(reason || "").trim()) next.reason = "This field is required.";
    if (!coils.length) {
      next.scan = isStoreIn
        ? "Scan at least one coil at the machine."
        : isConsume
          ? "Scan a coil to update its status."
          : isLotMode
            ? "Enter a lot or MRN UID, or scan one coil."
            : "Scan at least one coil.";
    }
    if (isStoreIn) {
      for (const c of coils) {
        const orig = Number(c.original_qty ?? c.qty) || 0;
        const rem = Number(c.remaining_qty ?? c.qty) || 0;
        if (rem <= 0) {
          next.proposed = "Store-in qty must be greater than 0 for each coil.";
          break;
        }
        if (rem > orig) {
          next.proposed = "Store-in qty cannot exceed shop-floor qty on any coil.";
          break;
        }
      }
    }
    if (isConsume) {
      for (const c of coils) {
        /*
        const orig = Number(c.original_qty ?? c.qty) || 0;
        const used = Number(c.consumed_qty ?? orig) || 0;
        if (used <= 0) {
          next.qty = isUpdateStatusFlow
            ? "Enter consumed qty (must be greater than 0)."
            : "Enter used qty for partial coils.";
          break;
        }
        if (used > orig) {
          next.qty = isUpdateStatusFlow
            ? "Consumed qty cannot exceed total coil qty."
            : "Used qty cannot exceed issued qty on any coil.";
          break;
        }
        if (isUpdateStatusFlow && consumeMode === "leftover" && leftoverConsumedQty === "") {
          next.qty = "Enter consumed qty for leftover.";
          break;
        }
        */
        const orig = Number(c.original_qty ?? c.qty) || 0;
        const used = Number(c.consumed_qty ?? orig) || 0;
        const isLeftoverUpdateStatus = isUpdateStatusFlow && consumeMode === "leftover";

        if (isLeftoverUpdateStatus) {
          // 0 is valid here — it means nothing was consumed (full store-in).
          if (leftoverConsumedQty === "") {
            next.qty = "Enter consumed qty for leftover.";
            break;
          }
          if (used < 0 || used > orig) {
            next.qty = "Consumed qty cannot exceed total coil qty.";
            break;
          }
        } else {
          if (used <= 0) {
            next.qty = isUpdateStatusFlow
              ? "Enter consumed qty (must be greater than 0)."
              : "Enter used qty for partial coils.";
            break;
          }
          if (used > orig) {
            next.qty = isUpdateStatusFlow
              ? "Consumed qty cannot exceed total coil qty."
              : "Used qty cannot exceed issued qty on any coil.";
            break;
          }
        }
      }
    }
    if (isRejectionFlow && !readOnly) {
      const hasImage = attachments.some(
        (a) =>
          (typeof a === "string" && /\.(jpe?g|png|webp|gif)$/i.test(a)) ||
          (a instanceof File && a.type.startsWith("image/"))
      );
      if (!hasImage) {
        next.attachments = "At least one photo is required for rejection (JPEG, PNG, or WebP).";
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
        : mode === "add" && isUpdateStatusFlow
          ? true
          : mode === "add" && isRejectionFlow
            ? false
            : showApproval
              ? Boolean(approved)
              : mode === "add"
                ? false
                : undefined;

    if (isRejectionFlow && resolveApproved === true && coils.length) {
      const blocked = await findRejectionCoilsBlockedByPendingStoreIn(coils, lookupCoilByUid, coilCtx);
      if (blocked.length) {
        showScanToast("error", "store-in-pending", blocked[0].message);
        return;
      }
    }

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
      reason: String(reason || (isUpdateStatusFlow ? "Coil status update" : "")).trim(),
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
      existing_attachments: attachments.filter((a) => typeof a === "string"),
      created_by_name: actorName,
      updated_by_name: actorName,
      approved_by_name: actorName,
      ...(resolveApproved !== undefined ? { approved: Boolean(resolveApproved) } : {}),
    };

    setSaving(true);
    try {
      let res;
      const formData = new FormData();
      Object.keys(payload).forEach((key) => {
        if (payload[key] !== undefined) {
          if (typeof payload[key] === "object" && payload[key] !== null) {
            formData.append(key, JSON.stringify(payload[key]));
          } else {
            formData.append(key, payload[key]);
          }
        }
      });

      if (attachments.length) {
        attachments.forEach((file) => {
          if (file instanceof File) {
            formData.append("attachments", file);
          }
        });
      }

      if (isApprove && editData?.ipr_uid) {
        if (approvedFlag === false) {
          res = await inProcessRequestService.update(editData.ipr_uid, formData);
        } else {
          formData.set("approved", resolveApproved !== undefined ? String(Boolean(resolveApproved)) : "true");
          res = await inProcessRequestService.approve(editData.ipr_uid, formData);
        }
      } else if (isEdit && editData?.ipr_uid) {
        res = await inProcessRequestService.update(editData.ipr_uid, formData);
      } else {
        res = await inProcessRequestService.create(formData);
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
    editData?.approved === true &&
    editData?.downstream === IPR_DOWNSTREAM.PENDING_STORE_IN &&
    (editData?.request_type === IPR_REQUEST_TYPE.STORE_IN || editData?.request_type === IPR_REQUEST_TYPE.CONSUME);

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

  const drawerDescription = showRequestFlowPicker ? (
    "Select a request flow"
  ) : showScanGate ? (
    `Scan a coil sticker to ${isRejectionFlow ? "reject" : "update status"}`
  ) : showRejectionTypePicker ? (
    "Reject this coil only, or the whole lot?"
  ) : (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 normal-case tracking-normal font-semibold">
      <span className="uppercase tracking-tight font-bold">
        {isStoreIn
          ? "Scan shop-floor coils"
          : isConsume && isUpdateStatusFlow
            ? isApprove
              ? "Review Full Consume or Left Over, then Keep Pending or Authorize"
              : "Choose Full Consume or Left Over, add remarks, then save. Authorize from the list when ready."
            : isConsume
              ? "Scan shop-floor coils"
              : isTransfer
              ? "Update coil status to Transfer"
              : isLotMode
                ? "Enter the lot or MRN UID, or scan one coil to load all lot coils"
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
            Change flow
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
          "Submitted and queued in Unassigned → Pending. Receive there to put coils back in Unassigned Area.",
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
        message: "Authorized — entire coil qty consumed.",
      },
      [IPR_DOWNSTREAM.TRANSFER_PENDING]: {
        box: "bg-indigo-50 border-indigo-200",
        icon: "text-indigo-600",
        text: "text-indigo-800",
        message: "Authorized — transfer request recorded (pending implementation).",
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
      saveLabel="Save"
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

          {showRequestFlowPicker ? (
            <div className="space-y-3 py-2 animate-in fade-in duration-300">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Select a request flow
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visibleFlowOptions.map((option) => {
                  const cardAccent = TYPE_PICKER_ACCENT[option.accent] || TYPE_PICKER_ACCENT.indigo;
                  const Icon = option.Icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectRequestFlow(option.id)}
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
                Scan a coil sticker to {isRejectionFlow ? "reject" : "update status"}
              </p>
              {isRejectionFlow ? (
                <p className="text-[10px] text-slate-500 px-0.5 leading-snug">
                  Only coils in store or on shop floor can be rejected. Consumed or already returned coils cannot be scanned.
                </p>
              ) : (
                <p className="text-[10px] text-slate-500 px-0.5 leading-snug">
                  Only coils currently on the shop floor (issued via Job Card Store Out) can be scanned here.
                </p>
              )}
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
                onClick={backToFlowStep}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
              >
                ← Back to request flow
              </button>
            </div>
          ) : showRejectionTypePicker ? (
            <div className="space-y-3 py-2">
              {pendingCoil && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-200 min-w-0">
                  <Package size={14} className="text-indigo-600 shrink-0" />
                  <p className="text-[10px] font-bold text-indigo-900 uppercase truncate">
                    {coilUidDisplayLabel(pendingCoil.coil_no_uid)} · MRN UID{" "}
                    {pendingCoil.mrn_uid || "—"}
                  </p>
                </div>
              )}
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

              {isRejectionFlow && readOnly && attachments.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Rejection Photos</p>
                  <div className={`grid gap-1.5 ${attachments.length <= 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {attachments.map((file, idx) => {
                      const name = typeof file === "string" ? file.split("/").pop() : file?.name || `File ${idx + 1}`;
                      const href = typeof file === "string" ? resolveDocUrl(file) : "";
                      const isImage = /\.(png|jpe?g|webp|gif)$/i.test(String(name || ""));
                      const imgClass =
                        attachments.length <= 1
                          ? "w-full max-h-36 sm:max-h-44 object-contain bg-slate-50"
                          : "w-full h-24 sm:h-28 object-cover bg-slate-50";
                      return (
                        <div key={idx} className="rounded border border-slate-200 overflow-hidden bg-white min-w-0">
                          {href && isImage ? (
                            <FilePreviewLink href={href} fileName={name} className="block" title={name}>
                              <img src={href} alt={name} className={imgClass} />
                            </FilePreviewLink>
                          ) : (
                            <p className="px-1.5 py-1 text-[9px] font-medium text-slate-600 truncate">{name}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Reason — rejection and legacy request types only */}
              {!isUpdateStatusFlow ? (
              <TypeableSuggestField
                label="Reason"
                required
                value={reason}
                onChange={(v) => setReason(v)}
                error={errors.reason || ""}
                readOnly={readOnly}
                disabled={readOnly}
                placeholder="Reason"
                dataField="reason"
                fetchSuggestions={fetchReasonsForType}
                optionLabelKey="reason"
                optionIdKey="reason"
                active={open && !showTypePicker}
                comboboxShell
                portalMenu
                heightClass="h-9"
                menuZIndex={10050}
                onClearError={() => {
                  if (errors.reason) setErrors((er) => ({ ...er, reason: undefined }));
                }}
              />
              ) : null}

              {isStoreIn ? (
                <StoreInRequestForm
                  readOnly={readOnly}
                  isEdit={isEdit}
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
                  scanBtnFill={scanBtnFill}
                  laserActive={open && !readOnly && !showTypePicker}
                />
              ) : isConsume && isUpdateStatusFlow ? (
                <UpdateCoilStatusForm
                  coil={coils[0] || null}
                  consumeMode={consumeMode}
                  onConsumeModeChange={handleConsumeModeChange}
                  consumedQty={leftoverConsumedQty}
                  onConsumedQtyChange={handleLeftoverConsumedQtyChange}
                  errors={errors}
                  readOnly={readOnly}
                />
              ) : isConsume ? (
                <ConsumeRequestForm
                  readOnly={readOnly}
                  isEdit={isEdit}
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
              ) : isTransfer ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                    <QrCode size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-indigo-700 font-medium leading-normal">
                      Coil transfer is coming soon. For now, you can record the transfer request.
                    </p>
                  </div>
                  {/* Reuse coil list display below */}
                </div>
              ) : (
                <>
              {/* Lot = Full Hold packing entry (only while empty) */}
              {showLotEntryUi ? (
                <div className="space-y-2 bg-yellow-50/40 p-2 rounded-lg border border-yellow-200 shadow-sm">
                  <p className="text-[10px] font-bold text-yellow-900 uppercase px-0.5">
                    Lot rejection — MRN UID
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
                      placeholder="Enter the lot or MRN UID"
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
                    Lot · MRN UID {manualLotNo || coils[0]?.mrn_uid || "—"} · {coils.length} coils
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
                                  MRN UID {c.mrn_uid || "—"} · Qty: {Number(c.qty ?? 0).toLocaleString()}
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
                          {isLotMode ? "Enter a lot or MRN UID above" : "Scan coils"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
                </>
              )}

              <FormTextarea
                label="Remark"
                value={remarks}
                onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
                disabled={readOnly}
                placeholder="Notes (optional)"
                rows={3}
              />

              {isRejectionFlow && !readOnly && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {isRejectionFlow ? "Rejection Photos" : "Documents"}
                    {isRejectionFlow && !readOnly ? <span className="text-rose-500"> *</span> : null}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-1 gap-2">
                    
                    {!readOnly && (
                      <label className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-all gap-1">
                        <Upload size={16} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          {isRejectionFlow ? "Upload Photos" : "Upload Documents"}
                        </span>
                        <input
                          type="file"
                          multiple
                          accept={isRejectionFlow ? "image/jpeg,image/png,image/webp,image/gif" : ".pdf,.png,.jpg,.jpeg,.webp"}
                          onChange={handleFilePick}
                          className="hidden"
                        />
                      </label>
                    )}

                    {attachments.map((file, idx) => {
                      const isExisting = typeof file === "string";
                      const name = isExisting ? file.split("/").pop() : file.name;
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-indigo-100 bg-indigo-50/30 group">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={14} className="text-indigo-600 shrink-0" />
                            {isExisting ? (
                              <FilePreviewLink
                                href={resolveDocUrl(file)}
                                fileName={name}
                                className="text-[10px] font-bold text-indigo-700 truncate hover:underline"
                                title={name}
                              >
                                {name}
                              </FilePreviewLink>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-700 truncate" title={name}>
                                {name}
                              </span>
                            )}
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all opacity-0 group-hover:opacity-100"
                            >
                              <TrashIcon size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {errors.attachments ? (
                    <p className="text-[10px] font-bold text-rose-600">{errors.attachments}</p>
                  ) : null}
                </div>
              )}

              {!readOnly && !showTypePicker && isRejectionFlow ? (
                <ApprovalStatusToggle
                  show={showApproval}
                  checked={approved}
                  onChange={setApproved}
                  pendingHint="This rejection will stay Pending until authorized."
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
