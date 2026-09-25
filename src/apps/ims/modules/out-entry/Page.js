"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "@/platform/store/slices/authSlice";
import { Plus, RefreshCw, Edit3, Trash2, X, LogOut, FileSearch, FileEdit, Warehouse, ClipboardList, Truck, CheckCircle, QrCode, CameraOff, ScanLine } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";

import { outEntryService } from "@/apps/ims/lib/services/outEntry";
import { forwardingNoteService } from "@/apps/ims/lib/services/forwardingNote";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { normalizeScanInput } from "@/apps/ims/lib/helpers/qrScan";
import { useHtml5QrScanner } from "@/platform/hooks/scan/useHtml5QrScanner";
import { useDeviceScanSettings } from "@/platform/hooks/scan/useDeviceScanSettings";
import { prepareQrScanSession } from "@/platform/utils/global/scanFeedback";
import { SCAN_SNACK_MSG } from "@/platform/utils/global";
import { getScanInputPlaceholder, isLaserScanEnabled } from "@/platform/utils/device/deviceScanSettings";

// Components
import OutEntryModal from "@/apps/ims/modules/out-entry/OutEntryModal";
import { OUT_ENTRY_STATUS_FILTER_OPTIONS, OUT_ENTRY_TYPE_FILTER_OPTIONS, buildOutEntryListFilters, isOutEntryScanDraft, matchesOutEntryStatusFilter, outEntryScanProgressLabel, outEntryStatusLabel } from "@/apps/ims/lib/utils/outEntryScanStatus";
import { isOutEntryAutoAuthorized, isOutEntryInventoryOut, isOutEntryPackingArea, isOutEntryQcArea, getOutEntryTypeTableLabel, getOutEntryTypeBadgeClass, OUT_ENTRY_TYPE } from "@/apps/ims/lib/utils/outEntryTypes";
import { canApproveInventoryOut } from "@/apps/ims/lib/utils/imsSpecialPermissions";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ActionButton from "@/ui/primitives/ActionButton";
import Drawer from "@/ui/primitives/Drawer";
import LaserScanField from "@/ui/common/scan/LaserScanField";
import ScanEnterInput from "@/ui/common/scan/ScanEnterInput";
import QrScannerOverlay from "@/ui/common/scan/QrScannerOverlay";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import AppListFooter from "@/ui/common/list/listPageFooter";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { pipeMetaRenderers } from "@/apps/ims/lib/helpers/pipeMetaDisplay";

const PAGE_TABS = {
  STORE_OUT: "store_out",
  PENDING_FORWARDING: "pending_forwarding",
};

const FN_NEW_SCANNER_ID = "out-entry-fn-new-qr-reader";

function extractForwardingFuidFromScan(rawValue) {
  const text = normalizeScanInput(rawValue);
  if (!text) return null;

  try {
    if (/^https?:\/\//i.test(text) || text.includes("fuid=")) {
      const u = new URL(/^https?:\/\//i.test(text) ? text : `https://local/?${text.replace(/^\?/, "")}`);
      const fuidParam = u.searchParams.get("fuid");
      if (fuidParam != null && /^\d+$/.test(String(fuidParam).trim())) return String(fuidParam).trim();
    }
  } catch {
    /* ignore */
  }

  if (/^\d+$/.test(text)) return text;
  const embedded = text.match(/(?:^|[^\d])(\d{1,12})(?:[^\d]|$)/);
  return embedded ? embedded[1] : null;
}

function isOutEntryApproved(row) {
  return row?.approved === true || row?.approved === "true" || row?.approved === 1;
}

function isOutEntryApprovable(row) {
  if (!row) return false;
  if (isOutEntryAutoAuthorized(row.entry_type)) return false;
  if (isOutEntryScanDraft(row)) return false;
  if (isOutEntryApproved(row)) return false;
  return true;
}

function pendingForwardingToOutEntryRow(row) {
  if (!row?.out_entry_uid) return null;
  return {
    out_uid: row.out_entry_uid,
    fuid: row.fuid,
    scan_complete: row.out_entry_scan_complete,
    approved: row.out_entry_approved ?? false,
    boxes_scanned: row.out_entry_boxes_scanned,
    boxes_required: row.out_entry_boxes_required,
  };
}

function pendingForwardingStoreOutStatus(row) {
  const outEntryRow = pendingForwardingToOutEntryRow(row) ?? {
    approved: row?.out_entry_approved,
    scan_complete: row?.out_entry_scan_complete,
    boxes_scanned: row?.out_entry_boxes_scanned,
    boxes_required: row?.out_entry_boxes_required,
  };

  if (!row?.out_entry_uid) {
    return { text: "READY", className: "bg-indigo-50 text-indigo-600 border-indigo-100", progress: null };
  }
  if (isOutEntryScanDraft(outEntryRow)) {
    return {
      text: "DRAFT",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      progress: outEntryScanProgressLabel(outEntryRow),
    };
  }
  return {
    text: "PENDING",
    className: "bg-slate-50 text-slate-600 border-slate-200",
    progress: outEntryScanProgressLabel(outEntryRow),
  };
}

export default function OutEntryPage() {
  const user = useSelector(selectUser);
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("out_entry", "view"), [canAccess]);
  const canApproveStoreOut = useMemo(() => canAccess("out_entry", "authorize").allowed, [canAccess]);
  const canApproveInvOut = useMemo(() => canApproveInventoryOut(user), [user]);

  const [pageTab, setPageTab] = useState(PAGE_TABS.PENDING_FORWARDING);
  const isStoreOut = pageTab === PAGE_TABS.STORE_OUT;
  const showApproveButton = canApproveStoreOut || (isStoreOut && canApproveInvOut);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  // Calculate default dates based on permission days
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  // Unified Params State for better sync
  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    entryType: "all",
    fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "out_uid", sortDir: "desc"
  });

  const [forwardingParams, setForwardingParams] = useState({
    pageSize: 1000,
    sortKey: "fuid",
    sortDir: "desc",
  });

  // Update params if dateFilterDefaults change (Store Out tab only) — skip no-op updates
  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    setParams((prev) => {
      if (prev.fromDate === dateFilterDefaults.from && prev.toDate === dateFilterDefaults.to) {
        return prev;
      }
      return {
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      };
    });
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [forwardingRows, setForwardingRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null); 
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [fnScanDrawerOpen, setFnScanDrawerOpen] = useState(false);
  const [fnScanCameraOn, setFnScanCameraOn] = useState(false);
  const fnScanKeyboardRef = useRef(null);
  const { laserScan, keyboardType } = useDeviceScanSettings();
  const showFnScanLaser = isLaserScanEnabled() && laserScan;

  const openDraftForm = useCallback((row) => {
    if (!row || !isOutEntryScanDraft(row)) return;
    setEditItem(row);
    setModalMode("edit");
    setModalOpen(true);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await outEntryService.getAll({
          page,
          limit,
          filters: {
            ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
            ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
            ...buildOutEntryListFilters(params.status),
          },
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
    } catch (err) {
      toast.error(err?.message || "Failed to load records");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status]);

  const fetchForwardingNotes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await forwardingNoteService.getAll({
          page,
          limit,
          ...(appliedSearch && { search: appliedSearch }),
          filters: {
            approved: true,
            out_entry_approved: false,
          },
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, forwardingParams.pageSize);
      setForwardingRows(data);
    } catch (err) {
      toast.error(err?.message || "Failed to load forwarding notes");
      setForwardingRows([]);
    } finally {
      setLoading(false);
    }
  }, [forwardingParams.pageSize, appliedSearch]);

  useEffect(() => {
    if (isStoreOut) fetchData();
    else fetchForwardingNotes();
  }, [isStoreOut, fetchData, fetchForwardingNotes]);

  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch, params.fromDate, params.toDate, params.status, params.entryType, appliedSearch, pageTab]);

  const activeSourceRows = isStoreOut ? allRows : forwardingRows;
  const activeSortKey = isStoreOut ? params.sortKey : forwardingParams.sortKey;
  const activeSortDir = isStoreOut ? params.sortDir : forwardingParams.sortDir;

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    let rows = activeSourceRows;
    if (isStoreOut) {
      if (params.status !== "all") {
        rows = rows.filter((r) => matchesOutEntryStatusFilter(r, params.status));
      }
      if (params.entryType !== "all") {
        rows = rows.filter((r) => {
          if (params.entryType === OUT_ENTRY_TYPE.PACKING_AREA) {
            return isOutEntryPackingArea(r.entry_type);
          }
          if (params.entryType === OUT_ENTRY_TYPE.QC_AREA) {
            return isOutEntryQcArea(r.entry_type);
          }
          if (params.entryType === OUT_ENTRY_TYPE.INVENTORY_OUT) {
            return isOutEntryInventoryOut(r.entry_type);
          }
          return r.entry_type === params.entryType;
        });
      }
    }
    if (q) {
      rows = applyClientSearch(rows, tempSearch, { skipSort: !!activeSortKey });
    }
    return sortRowsByKey(rows, activeSortKey, activeSortDir);
  }, [activeSourceRows, tempSearch, activeSortKey, activeSortDir, params.status, params.entryType, isStoreOut]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    if (!isStoreOut) {
      applySearchFromInput();
      return;
    }
    const nextStatus = data.approvedStatus || params.status;
    const nextType = data.entryType || params.entryType;
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: nextStatus === "approved" ? "authorized" : nextStatus,
      entryType: nextType,
    }));
  };

  const handleReset = () => {
    resetSearch();
    if (isStoreOut) {
      setParams({
        pageSize: 1000,
        status: "all",
        entryType: "all",
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
        sortKey: "out_uid",
        sortDir: "desc",
      });
    } else {
      setForwardingParams({
        pageSize: 1000,
        sortKey: "fuid",
        sortDir: "desc",
      });
    }
  };

  const extraFilters = useMemo(
    () => isStoreOut ? [
      {
        label: "Status",
        key: "approvedStatus",
        value: params.status === "approved" ? "authorized" : params.status,
        options: OUT_ENTRY_STATUS_FILTER_OPTIONS,
      },
      {
        label: "Entry Type",
        key: "entryType",
        value: params.entryType,
        options: OUT_ENTRY_TYPE_FILTER_OPTIONS,
      },
    ] : [],
    [params.status, params.entryType, isStoreOut]
  );

  const getRowId = useCallback((item) => isStoreOut ? item.out_uid : item.fuid, [isStoreOut]);

  const selectedRecord = useMemo(() => filteredRows.find((i) => getRowId(i) === selected), [filteredRows, selected, getRowId]);

  const selectedOutEntryRecord = useMemo(() => {
    if (!selectedRecord) return null;
    if (isStoreOut) return selectedRecord;
    return pendingForwardingToOutEntryRow(selectedRecord);
  }, [isStoreOut, selectedRecord]);

  const canApproveSelectedRow = useCallback(
    (row) => {
      if (!row || !isOutEntryApprovable(row)) return false;
      if (isOutEntryInventoryOut(row.entry_type)) return canApproveInvOut;
      return canApproveStoreOut;
    },
    [canApproveInvOut, canApproveStoreOut]
  );

  const selectedIsInventoryOut = Boolean(
    selectedOutEntryRecord && isOutEntryInventoryOut(selectedOutEntryRecord.entry_type)
  );
  const selectedApprovable = isOutEntryApprovable(selectedOutEntryRecord);
  const approveEnabled =
    Boolean(selectedOutEntryRecord) &&
    selectedApprovable &&
    canApproveSelectedRow(selectedOutEntryRecord);

  const getSelectedRow = useCallback(
    () => filteredRows.find((i) => getRowId(i) === selected),
    [filteredRows, selected, getRowId]
  );

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    // Always out_entry — both tabs run store-out actions (pending FN opens OutEntryModal, not FN edit).
    module: "out_entry",
    modalOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      if (isStoreOut) {
        setEditItem(row);
        setModalMode("edit");
        setModalOpen(true);
      } else {
        // For pending forwarding, we open OutEntryModal in add mode but with FUID pre-selected
        // However, if out_entry_uid exists, it means it's a draft, so we should edit that.
        if (row.out_entry_uid) {
          setEditItem({ out_uid: row.out_entry_uid, fuid: row.fuid, scan_complete: row.out_entry_scan_complete });
          setModalMode("edit");
        } else {
          setEditItem({ fuid: row.fuid });
          setModalMode("add");
        }
        setModalOpen(true);
      }
    }, [isStoreOut]),
    openApprove: useCallback((row) => {
      const approveRow = isStoreOut ? row : pendingForwardingToOutEntryRow(row);
      if (!approveRow) return;
      if (isOutEntryScanDraft(approveRow)) {
        toast.error("Complete all box scans and submit before approving.");
        return;
      }
      setEditItem(approveRow);
      setModalMode("approve");
      setModalOpen(true);
    }, [isStoreOut]),
    canApproveSelection: useCallback(
      () => {
        const row = getSelectedRow();
        if (!row) return false;
        const approveRow = isStoreOut ? row : pendingForwardingToOutEntryRow(row);
        return Boolean(approveRow && canApproveSelectedRow(approveRow));
      },
      [getSelectedRow, isStoreOut, canApproveSelectedRow]
    ),
    getAuthorizeAccess: useCallback(() => {
      const row = selectedRecord;
      if (row && isOutEntryInventoryOut(row.entry_type)) {
        return { allowed: canApproveInvOut };
      }
      return canAccess("out_entry", "authorize");
    }, [selectedRecord, canApproveInvOut, canAccess]),
    onApproveBlocked: useCallback(() => {
      const row = getSelectedRow();
      const approveRow = row ? (isStoreOut ? row : pendingForwardingToOutEntryRow(row)) : null;
      if (approveRow && isOutEntryApproved(approveRow)) {
        toast.info("Already approved. Edit first, then approve again.");
        return;
      }
      if (approveRow && isOutEntryAutoAuthorized(approveRow.entry_type)) {
        toast.info("Auto-authorized — cannot re-approve.");
        return;
      }
      if (approveRow && isOutEntryScanDraft(approveRow)) {
        toast.error("Complete all box scans and submit before approving.");
        return;
      }
      if (!isStoreOut && row && !row.out_entry_uid) {
        toast.info("Start and complete store out scans before approving.");
        return;
      }
      if (approveRow && isOutEntryApprovable(approveRow)) {
        if (isOutEntryInventoryOut(approveRow.entry_type) && !canApproveInvOut) {
          toast.info("You do not have inventory approve permission.");
        } else if (!isOutEntryInventoryOut(approveRow.entry_type) && !canApproveStoreOut) {
          toast.info("You do not have store out authorize permission.");
        } else {
          toast.info("Select a pending row you can approve (Ctrl+A).");
        }
        return;
      }
      toast.info("Select a pending row to approve (Ctrl+A).");
    }, [getSelectedRow, isStoreOut, canApproveInvOut, canApproveStoreOut]),
    canEditSelection: useCallback(() => {
      const row = getSelectedRow();
      if (isStoreOut) return Boolean(row && !isOutEntryScanDraft(row) && !isOutEntryAutoAuthorized(row.entry_type));
      return Boolean(row);
    }, [getSelectedRow, isStoreOut]),
    onEditBlocked: useCallback(() => {
      const row = getSelectedRow();
      if (row && isOutEntryAutoAuthorized(row.entry_type)) {
        toast.info("Auto-authorized entries cannot be edited.");
        return;
      }
      if (row && isStoreOut && isOutEntryScanDraft(row)) {
        toast.info("Select a draft row, then click Draft.");
        return;
      }
      toast.info("Select a row to edit (Ctrl+E).");
    }, [getSelectedRow, isStoreOut]),
  });

  const selectedIsDraft = useMemo(() => {
    if (isStoreOut) return Boolean(selectedRecord && isOutEntryScanDraft(selectedRecord));
    return Boolean(selectedRecord?.out_entry_uid && !selectedRecord.out_entry_scan_complete);
  }, [isStoreOut, selectedRecord]);

  const handleDraftClick = useCallback(() => {
    const rec = selectedOutEntryRecord;
    if (!rec || !isOutEntryScanDraft(rec)) {
      toast.info("Select a draft row, then click Draft.");
      return;
    }
    openDraftForm(rec);
  }, [selectedOutEntryRecord, openDraftForm]);

  const handleTableRowClick = useCallback((_row, id) => {
    setSelected(id);
  }, []);

  const openApproveForm = useCallback((rec) => {
    if (!rec) return;
    if (isOutEntryApproved(rec)) {
      toast.info("Already approved. Edit first, then approve again.");
      return;
    }
    if (isOutEntryScanDraft(rec)) {
      toast.error("Complete all box scans and submit before approving.");
      return;
    }
    setEditItem(rec);
    setModalMode("approve");
    setModalOpen(true);
  }, []);

  const handleApproveClick = useCallback(() => {
    const rec = selectedOutEntryRecord;
    if (!rec) {
      toast.info(
        isStoreOut
          ? "Select a pending row to approve."
          : "Select a row with completed store out scans to approve."
      );
      return;
    }
    if (!canApproveSelectedRow(rec)) {
      if (isOutEntryInventoryOut(rec.entry_type)) {
        toast.error("You do not have permission to approve inventory out.");
      } else {
        toast.error("You do not have permission to approve store out.");
      }
      return;
    }
    if (!isOutEntryApprovable(rec)) {
      if (isOutEntryApproved(rec)) {
        toast.info("Already approved. Edit first, then approve again.");
      } else {
        toast.error("Complete all box scans and submit before approving.");
      }
      return;
    }
    openApproveForm(rec);
  }, [selectedOutEntryRecord, canApproveSelectedRow, openApproveForm, isStoreOut]);

  const approveButtonTitle = useMemo(() => {
    if (!selectedOutEntryRecord) {
      return isStoreOut
        ? "Select a pending row to approve"
        : "Select a row with completed store out scans to approve";
    }
    if (!selectedApprovable) return "Row is draft, auto-authorized, or already approved";
    if (selectedIsInventoryOut) {
      return canApproveInvOut
        ? "Approve inventory out"
        : "Requires inventory approve permission";
    }
    return canApproveStoreOut
      ? "Approve forwarding note store out"
      : "Requires store out authorize permission";
  }, [
    selectedOutEntryRecord,
    selectedApprovable,
    selectedIsInventoryOut,
    canApproveInvOut,
    canApproveStoreOut,
    isStoreOut,
  ]);

  const handleDeleteClick = useCallback(() => {
    if (!selectedOutEntryRecord) return;
    setDeleteItem(selectedOutEntryRecord);
  }, [selectedOutEntryRecord]);

  const handleStartOutEntry = useCallback((row) => {
    if (!row?.fuid) {
      toast.info("Select a pending forwarding note first.");
      return;
    }
    if (row.out_entry_uid) {
      setEditItem({ out_uid: row.out_entry_uid, fuid: row.fuid, scan_complete: row.out_entry_scan_complete });
      setModalMode("edit");
    } else {
      setEditItem({ fuid: row.fuid });
      setModalMode("add");
    }
    setModalOpen(true);
  }, []);

  const closeFnScanDrawer = useCallback(() => {
    setFnScanCameraOn(false);
    setFnScanDrawerOpen(false);
  }, []);

  const applyScannedFuidForNew = useCallback(
    (raw) => {
      const fuid = extractForwardingFuidFromScan(raw);
      if (!fuid) {
        toast.error("Could not read forwarding note from QR. Scan the FN print QR.");
        return;
      }
      const matched =
        forwardingRows.find((r) => String(r.fuid) === String(fuid)) ||
        filteredRows.find((r) => String(r.fuid) === String(fuid));
      closeFnScanDrawer();
      handleStartOutEntry(matched || { fuid });
    },
    [forwardingRows, filteredRows, closeFnScanDrawer, handleStartOutEntry]
  );

  const applyScannedFuidForNewRef = useRef(applyScannedFuidForNew);
  applyScannedFuidForNewRef.current = applyScannedFuidForNew;

  const { torchSupported, torchOn, toggleTorch } = useHtml5QrScanner({
    active: fnScanCameraOn,
    elementId: FN_NEW_SCANNER_ID,
    onDecoded: (decodedText) => {
      setFnScanCameraOn(false);
      applyScannedFuidForNewRef.current(decodedText);
    },
    fps: 15,
    qrbox: { width: 250, height: 250 },
    onCameraFailed: (err) => {
      const isDenied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      toast.error(isDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA, { autoClose: 4000 });
      setFnScanCameraOn(false);
    },
  });

  const startFnScanCamera = useCallback(async () => {
    const prep = await prepareQrScanSession();
    if (!prep.cameraOk) {
      toast.error(prep.cameraDenied ? SCAN_SNACK_MSG.CAMERA_DENIED : SCAN_SNACK_MSG.CAMERA, {
        autoClose: 4000,
      });
      return;
    }
    setFnScanCameraOn(true);
  }, []);

  const handlePendingNewClick = useCallback(() => {
    if (selectedRecord) {
      handleStartOutEntry(selectedRecord);
      return;
    }
    setFnScanDrawerOpen(true);
  }, [selectedRecord, handleStartOutEntry]);

  useEffect(() => {
    if (!fnScanDrawerOpen) return;
    void startFnScanCamera();
  }, [fnScanDrawerOpen, startFnScanCamera]);

  const outPackingMeta = pipeMetaRenderers("font-bold text-slate-800 text-[10px] leading-tight");
  const outItemMeta = pipeMetaRenderers("text-slate-600 text-[10px] font-medium leading-tight");
  const outQtyMeta = pipeMetaRenderers("text-emerald-700 text-[10px] font-bold tabular-nums leading-tight");

  const STORE_OUT_HEADERS = [
    ["OUT UID", "out_uid", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "80px" }],

    ["Type", "entry_type", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-bold border w-fit ${getOutEntryTypeBadgeClass(v)}`}>
        {getOutEntryTypeTableLabel(v)}
      </span>
    ), { width: "100px" }],

    ["FUID / Reason", "fuid", (v, row) => {
      const fuid = row?.fuid ?? v;
      const reason = row?.reason;
      const display = fuid
        ? String(fuid)
        : reason
          ? String(reason)
          : null;

      return (
        <div className="flex flex-col leading-tight min-w-[120px]">
          {display ? (
            <div className="flex items-center gap-1 min-w-0">
              {fuid ? <FileSearch size={10} className="text-slate-400 shrink-0" /> : null}
              <span
                className={`font-bold text-[11px] truncate ${
                  fuid ? "text-slate-800 uppercase tracking-tighter" : "text-slate-700 normal-case"
                }`}
                title={display}
              >
                {display}
              </span>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 italic">—</span>
          )}
        </div>
      );
    }, { width: "140px" }],

    [
      "Packing No",
      "packing_numbers",
      outPackingMeta.table,
      { width: "140px", cardRender: outPackingMeta.card, copyValue: outPackingMeta.copyValue },
    ],
    [
      "Item Code",
      "item_codes",
      outItemMeta.table,
      { width: "160px", cardRender: outItemMeta.card, copyValue: outItemMeta.copyValue },
    ],
    [
      "Qty",
      "qtys",
      outQtyMeta.table,
      { width: "100px", cardRender: outQtyMeta.card, copyValue: outQtyMeta.copyValue },
    ],
    [
      "Total Qty",
      "total_qty",
      (v) => (
        <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
          {v != null ? Number(v).toLocaleString() : "0"}
        </span>
      ),
      { width: "100px" },
    ],

    ["Remarks", "remarks", (v) => (
      <span className="text-[10px] text-slate-500 italic truncate block max-w-[200px]">
        {v || "No remarks"}
      </span>
    ), { width: "220px" }],

    [
      "Status",
      "approved",
      (v, row) => {
        const st = outEntryStatusLabel(row);
        const progress =
          isOutEntryScanDraft(row) || (!row?.approved && row?.scan_complete)
            ? outEntryScanProgressLabel(row)
            : null;
        return (
          <div className="flex flex-col gap-0.5 min-w-[100px]">
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${st.className}`}>
              {st.text}
            </span>
            {progress ? (
              <span className="text-[8px] font-bold text-slate-500 tabular-nums">{progress}</span>
            ) : null}
          </div>
        );
      },
      { width: "120px" },
    ],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const PENDING_HEADERS = [
    ["FUID", "fuid", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "80px" }],
    // ["Bill Number", "billno", (v, row) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || row?.bill_no || "—"}</span>, { width: "200px" }],
    ["Customer", "acc_name", (v) => <span className="text-[10px] font-medium text-slate-500 uppercase italic whitespace-normal break-words leading-snug block" title={v}>{v || "—"}</span>, { width: "250px", wrap: true }],
    ["Total Qty", "total_items", (v) => <span className="font-black text-slate-700 text-[11px]">{v}</span>, { width: "120px" }],
    ["Timestamp", "timestamp", (v) => <span className="text-[10px] text-slate-500">{formatDateTime(v)}</span>, { width : "150px" }],
    ["Status", "out_entry_uid", (_v, row) => {
      const st = pendingForwardingStoreOutStatus(row);
      return (
        <div className="flex flex-col gap-0.5 min-w-[100px]">
          <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${st.className}`}>
            {st.text}
          </span>
          {st.progress ? (
            <span className="text-[8px] font-bold text-slate-500 tabular-nums">{st.progress}</span>
          ) : null}
        </div>
      );
    }, { width: "120px" }],
    /*
    [
      "Out Entry Status",
      "out_entry_uid",
      (v, row) => (
        <div className="flex flex-col gap-1">
          <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${v ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-slate-50 text-slate-400 border-slate-100"}`}>
            {v ? "IN PROGRESS" : "NOT STARTED"}
          </span>
          {v && (
            <span className="text-[8px] font-bold text-slate-500 tabular-nums">
              UID: {v}
            </span>
          )}
        </div>
      ),
      { width: "130px" },
    ],
    [
      "Action",
      "fuid",
      (v, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStartOutEntry(row);
          }}
          className={`flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase transition-all border ${
            row.out_entry_uid 
              ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" 
              : "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700"
          }`}
        >
          {row.out_entry_uid ? <PlayCircle size={12} /> : <Plus size={12} />}
          {row.out_entry_uid ? "Resume Out Entry" : "Start Out Entry"}
        </button>
      ),
      { width: "150px" },
    ],
    */
    ["Logistics", "transporter_name", (v, row) => (
      <div className="flex flex-col leading-tight min-w-[160px]">
        <div className="flex items-center gap-1 text-slate-700">
          <Truck size={10} />
          <span className="font-bold text-[11px]">{v || "Direct Party"}</span>
        </div>
        <span className="text-indigo-500 font-black text-[9px] ml-3 uppercase tracking-wider">{row.vehicle_number || "NO VEHICLE"}</span>
      </div>
    ), { width: "280px" }],
    ["PO Number", "po_number", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { width: "120px" }],
    ["Cartage", "cartage", (v) => <span className="text-slate-700 font-bold text-[10px]">{v?.toLocaleString() || 0}</span>, { width: "150px" }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isStoreOut ? "Out Entry" : "Forwarding Notes",
    rows: filteredRows,
    headers: isStoreOut ? STORE_OUT_HEADERS : PENDING_HEADERS,
  });

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setSelected(null);
    setTempSearch("");
    setDisplayLimit(100);
  };

  const handleRefresh = () => {
    if (isStoreOut) fetchData();
    else fetchForwardingNotes();
  };

  const outEntrySelectionLabel = useCallback(
    (r) => {
      if (isStoreOut) {
        return `Selected: OUT-#${r?.id ?? "—"} (FUID: ${r?.fuid ?? "—"}) · ${getOutEntryTypeTableLabel(r?.entry_type)}`;
      }
      return `Selected: FUID ${r?.fuid ?? "—"}`;
    },
    [isStoreOut]
  );

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                active={pageTab}
                onChange={handleTabChange}
                tabs={[
                  { id: PAGE_TABS.STORE_OUT, label: "Store Out", icon: Warehouse },
                  {
                    id: PAGE_TABS.PENDING_FORWARDING,
                    label: "Pending Forwarding Note",
                    shortLabel: "Pending FN",
                    icon: ClipboardList,
                  },
                ]}
              />
            }
            actions={
              <>
              <ActionButton 
                module="out_entry" 
                action="add" 
                label="New" 
                icon={Plus} 
                onClick={isStoreOut ? openNewModal : handlePendingNewClick} 
                className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`}
              />
              <ActionButton
                module="out_entry"
                action="edit"
                variant="outline"
                label="Draft"
                icon={FileEdit}
                disabled={!selectedIsDraft || modalOpen || isOutEntryAutoAuthorized(selectedRecord?.entry_type)}
                record={selectedOutEntryRecord}
                onClick={handleDraftClick}
                className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-amber-300 text-amber-800`}
              />
              <ActionButton 
                module="out_entry" 
                action="edit" 
                variant="outline" 
                label="Edit" 
                icon={Edit3} 
                disabled={!selectedOutEntryRecord || isOutEntryScanDraft(selectedOutEntryRecord) || isOutEntryAutoAuthorized(selectedRecord?.entry_type)} 
                record={selectedOutEntryRecord} 
                onClick={openEditModal} 
                className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-slate-300`}
              />
              {showApproveButton ? (
                <button
                  type="button"
                  onClick={handleApproveClick}
                  disabled={!approveEnabled}
                  title={approveButtonTitle}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
                >
                  <CheckCircle size={16} strokeWidth={2} />
                  <span>Approve</span>
                </button>
              ) : null}
              <ActionButton 
                module="out_entry" 
                action="delete" 
                variant="danger" 
                label="Delete" 
                icon={Trash2} 
                disabled={!selected || (!isStoreOut && !selectedRecord?.out_entry_uid)} 
                onClick={handleDeleteClick} 
                className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`}
              />
              
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-0.5 shrink-0" />
              
              <button type="button" onClick={handleRefresh} className={`${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`} aria-label="Refresh">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || exportDisabled}
                onExport={handleExport}
              />
            }
          />

        </ListPageToolbar>

        {/* SEARCH & FILTERS */}
        <ListPageFilterStrip>
          <DateRangeFilter 
            key={`${pageTab}-${isStoreOut ? `${params.fromDate}-${params.toDate}` : "all"}`}
            fromDate={isStoreOut ? params.fromDate : ""} 
            toDate={isStoreOut ? params.toDate : ""} 
            extraFilters={extraFilters} 
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={() => {
              if (isStoreOut) return;
              applySearchFromInput();
            }}
            searchPlaceholder={isStoreOut ? "Search item, packing, FUID, UID..." : "Search FUID, Customer, PO..."}
            searchLabel="Quick Search"
            minDate={isStoreOut ? dateFilterDefaults.minDate : undefined}
            maxDate={isStoreOut ? dateFilterDefaults.maxDate : undefined}
            showDate={isStoreOut}
          />
        </ListPageFilterStrip>

        {/* DATA TABLE */}
        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
          <DataTable
            key={`${pageTab}-${viewMode}`}
            headers={isStoreOut ? STORE_OUT_HEADERS : PENDING_HEADERS}
            data={items}
            allowCopy={true}
            loading={loading}
            viewMode={viewMode}
            {...tableHotkeyProps}
            hotkeysDisabled={modalOpen || tableHotkeyProps.hotkeysDisabled}
              onSort={(key) => {
                setDisplayLimit(100);
                if (isStoreOut) {
                  setParams((p) => ({
                    ...p,
                    sortKey: key,
                    sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                  }));
                } else {
                  setForwardingParams((p) => ({
                    ...p,
                    sortKey: key,
                    sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                  }));
                }
              }}
            sortKey={isStoreOut ? params.sortKey : forwardingParams.sortKey}
            sortDir={isStoreOut ? params.sortDir : forwardingParams.sortDir}
            selectedId={selected}
            onSelect={setSelected}
            onRowClick={handleTableRowClick}
            getRowId={getRowId}
            emptyIcon={LogOut}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={isStoreOut ? { 
              titleKey: "fuid", 
              badgeIndices: [8], 
              detailIndices: [3, 4, 5, 6], 
              footerKey: "created_at",
              className: "rounded-none border border-slate-200 shadow-none" 
            } : {
              titleKey: "fuid",
              badgeIndices: [6],
              detailKeys: ["acc_name", "billno", "po_number", "transporter_name", "total_items"],
              footerKey: "timestamp",
              className: "rounded-none border border-slate-200 shadow-none"
            }}
          />
        </div>

        <AppListFooter
          shown={items.length}
          total={totalItems}
          noun={isStoreOut ? "Out Entries" : "Pending Forwarding Notes"}
          selected={selected}
          selectedRecord={selectedRecord}
          selectionLabel={outEntrySelectionLabel}
          onClearSelection={() => setSelected(null)}
        />
      </div>

      <OutEntryModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
        }}
        onSuccess={() => {
          handleRefresh();
          setSelected(null);
        }}
        editData={editItem}
        mode={modalMode}
      />
      <Drawer
        isOpen={fnScanDrawerOpen && !fnScanCameraOn}
        onClose={closeFnScanDrawer}
        bodyScrollable={false}
        title="Scan Forwarding Note"
        description="Scan the QR on the forwarding note print to start Store Out"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pb-6">
          <div className="flex items-end gap-2">
            <div className="relative flex-1 space-y-2">
              <label className="text-xs font-medium text-slate-600 ml-1 block">Forwarding note QR</label>
              {showFnScanLaser && (
                <LaserScanField
                  active={fnScanDrawerOpen && showFnScanLaser && !fnScanCameraOn}
                  onScanned={(v) => applyScannedFuidForNew(v)}
                  keyboardInputRef={fnScanKeyboardRef}
                  requireArmButton={false}
                />
              )}
              {keyboardType && (
                <div className="relative">
                  <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 z-10" />
                  <ScanEnterInput
                    ref={fnScanKeyboardRef}
                    placeholder={getScanInputPlaceholder()}
                    onEnter={(v) => applyScannedFuidForNew(v)}
                    className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              )}
              {!showFnScanLaser && !keyboardType && (
                <p className="text-xs text-slate-500 px-1">
                  Use the camera button to scan the forwarding note QR.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => (fnScanCameraOn ? setFnScanCameraOn(false) : void startFnScanCamera())}
              className={`w-12 h-11 flex items-center justify-center rounded-xl border transition-all shadow-sm ${
                fnScanCameraOn
                  ? "bg-rose-50 border-rose-200 text-rose-600"
                  : "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700"
              }`}
              title={fnScanCameraOn ? "Stop camera" : "Scan QR"}
            >
              {fnScanCameraOn ? <CameraOff size={20} /> : <QrCode size={20} />}
            </button>
          </div>
        </div>
      </Drawer>
      <QrScannerOverlay
        open={fnScanCameraOn}
        onClose={() => setFnScanCameraOn(false)}
        readerId={FN_NEW_SCANNER_ID}
        torchSupported={torchSupported}
        torchOn={torchOn}
        onToggleTorch={toggleTorch}
        allowDesktop
        hint="Point camera at forwarding note QR"
      />
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { handleRefresh(); setSelected(null); }} service={outEntryService} entityLabel="Out Entry" idKey="out_uid" moduleSlug="out_entry" />
    </div>
  );
}
