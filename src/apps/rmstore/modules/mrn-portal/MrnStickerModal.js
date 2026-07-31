"use client";

/**
 * RM Sticker Control — same Drawer + layout pattern as IMS StickerCreationModel.
 * Left detail cards + right breakdown; after generate → Saved cards + PRINT ALL / Re-Print.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, Layers, Box, User, ClipboardList, Printer, Eye, X, RefreshCw, CheckCircle2, Upload, FileText, Save } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import { FormLabel, OK_INPUT, MODAL_INPUT_CLASS } from "@/ui/common/Constants";
import { mrnService } from "@/apps/rmstore/lib/services/mrn";
import { formatCoilNoUid, splitQtyAcrossCoils, equalSplitQtyAcrossCoils, roundQty3, QTY_EPS } from "@/apps/rmstore/lib/helpers/coilUid";
import { printFromBackendHtml } from "@/apps/ims/lib/utils/printHtmlDocument";
import { getBoxNoUidPrefix } from "@/platform/utils/global";
import { formatDocDate } from "@/platform/utils/core/utilHelper";
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";

const TABS = { DETAILS: "details", BREAKDOWN: "breakdown" };
const BATCH_QC_DL_KEY = "__batch_qc__";
const STICKER_PREVIEW_W_PX = (100 / 25.4) * 96;
const STICKER_PREVIEW_H_PX = (150 / 25.4) * 96;

function resolveUploadUrl(noteOrPath) {
  const raw = String(noteOrPath || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) return raw;
  const p = raw.replace(/^\/+/, "");
  if (p.startsWith("uploads/")) return `${String(FILE_BASE_URL || "").replace(/\/$/, "")}/${p}`;
  return "";
}

function docFileLabel(nameOrPath) {
  if (!nameOrPath) return "";
  const parts = String(nameOrPath).split(/[/\\]/);
  return parts[parts.length - 1] || String(nameOrPath);
}

function formatQty(v) {
  const n = roundQty3(v);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

/** IMS-style read-only meta: label above value, no FormLabel overflow in narrow cards. */
function DetailField({ label, children, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-0.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function hydrateFromSourceRow(row) {
  if (!row) return null;
  const isGenerated = row.sticker_generated === true || row.status === "generated";
  const mode = String(row.sticker_mode || "").trim().toLowerCase() === "batch" ? "batch" : "coil";
  return {
    ...row,
    uid: row.uid,
    status: isGenerated ? "generated" : "pending",
    sticker_generated: !!isGenerated,
    coils: [],
    qty_editable: row.qty_editable !== false,
    qty_auto_calc: row.qty_auto_calc !== false,
    sticker_mode: mode,
  };
}

/** Upload picker — click document name to preview (local file or saved path). */
function SimpleFileInput({ label, required, file, onChange, disabled, savedPath, savedName }) {
  const localUrl = useMemo(() => (file instanceof File ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => {
    if (!localUrl) return undefined;
    return () => URL.revokeObjectURL(localUrl);
  }, [localUrl]);

  const savedUrl = resolveUploadUrl(savedPath);
  const previewUrl = localUrl || savedUrl;
  const displayName = file?.name || savedName || docFileLabel(savedPath) || "";

  const nameNode = previewUrl ? (
    <FilePreviewLink
      href={previewUrl}
      fileName={displayName || label}
      className="text-[11px] sm:text-xs font-medium text-indigo-700 truncate min-w-0 flex-1 hover:underline cursor-pointer"
      title={`Open ${displayName || label}`}
    >
      {displayName || label}
    </FilePreviewLink>
  ) : (
    <span className="text-[11px] sm:text-xs font-medium text-slate-800 truncate min-w-0 flex-1">
      {displayName || (disabled ? "—" : "Choose file…")}
    </span>
  );

  return (
    <div className="space-y-1 min-w-0">
      <FormLabel
        required={required}
        className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter ml-0"
      >
        {label}
      </FormLabel>
      <div className={`flex items-center gap-1.5 h-9 px-2.5 border border-slate-200 rounded-lg bg-white min-w-0 ${disabled && !previewUrl ? "opacity-50" : ""}`}>
        <FileText size={14} className={`shrink-0 ${previewUrl ? "text-emerald-600" : "text-slate-500"}`} />
        {disabled ? (
          nameNode
        ) : previewUrl ? (
          <>
            {nameNode}
            <label className="shrink-0 text-[9px] font-bold text-indigo-600 cursor-pointer hover:underline">
              Change
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  onChange?.(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        ) : (
          <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-90">
            <Upload size={14} className="text-slate-500 shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium text-slate-800 truncate min-w-0">
              Choose file…
            </span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                onChange?.(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

export default function MrnStickerModal({ open, onClose, onSuccess, mrnId, sourceRow = null }) {
  const [tab, setTab] = useState(TABS.DETAILS);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [heatNo, setHeatNo] = useState("");
  const [coilCount, setCoilCount] = useState(1);
  const [coilQtys, setCoilQtys] = useState([0]);
  const [remarks, setRemarks] = useState("");
  const [tcFile, setTcFile] = useState(null);
  const [rmtcFile, setRmtcFile] = useState(null);
  const [dlTracking, setDlTracking] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLayout, setPreviewLayout] = useState({
    scale: 1,
    w: STICKER_PREVIEW_W_PX,
    h: STICKER_PREVIEW_H_PX,
  });
  const previewAreaRef = useRef(null);

  const resolvedUid = useMemo(() => {
    const fromProp = mrnId != null ? String(mrnId).trim() : "";
    if (fromProp) return fromProp;
    const fromDetail = detail?.uid != null ? String(detail.uid).trim() : "";
    if (fromDetail) return fromDetail;
    const fromSource = sourceRow?.uid != null ? String(sourceRow.uid).trim() : "";
    return fromSource || null;
  }, [mrnId, detail?.uid, sourceRow?.uid]);

  const qtyEditable = detail?.qty_editable !== false;
  const qtyAutoCalc = detail?.qty_auto_calc !== false;
  /** Per-coil qty edit — only when App Config "Allow editing coil quantity" is on. */
  const canEditQty = qtyEditable;
  /**
   * Fill qtys automatically when auto-split is on, or when editing is locked
   * (locked + auto-off → equal split; auto-on → uneven split).
   */
  const fillQtysAuto = qtyAutoCalc || !qtyEditable;
  const stickerMode = String(detail?.sticker_mode || "").trim().toLowerCase() === "batch" ? "batch" : "coil";
  const isBatchMode = stickerMode === "batch";

  const mrnQty = Number(detail?.it_recp_qty);
  /** Total Qty = MRN received qty only — never user-editable. */
  const targetQty = Number.isFinite(mrnQty) ? roundQty3(mrnQty) : 0;

  const buildCoilQtys = useCallback((count, total, { autoCalc }) => {
    const n = Math.max(1, Number(count) || 1);
    return autoCalc ? splitQtyAcrossCoils(total, n) : equalSplitQtyAcrossCoils(total, n);
  }, []);

  const applyFreshInputs = useCallback((data) => {
    const qty = Number(data?.it_recp_qty);
    const startTotal = Number.isFinite(qty) ? roundQty3(qty) : 0;
    const editable = data?.qty_editable !== false;
    const autoCalc = data?.qty_auto_calc !== false;
    setCoilCount(1);
    if (autoCalc || !editable) {
      setCoilQtys(buildCoilQtys(1, startTotal, { autoCalc }));
    } else {
      setCoilQtys([""]);
    }
    setHeatNo("");
    setRemarks("");
    setTcFile(null);
    setRmtcFile(null);
    setDlTracking({});
  }, [buildCoilQtys]);

  const hasSavedDoc = useCallback((path) => Boolean(String(path || "").trim()), []);

  const applyDraftInputs = useCallback((data) => {
    const draft = data?.sticker_draft;
    const hasDraft = draft && typeof draft === "object" && Object.keys(draft).length > 0;
    if (!hasDraft) {
      applyFreshInputs(data);
      return;
    }
    const editable = data?.qty_editable !== false;
    const autoCalc = data?.qty_auto_calc !== false;
    const count = Math.max(1, Number(draft.coil_count) || 1);
    setCoilCount(count);
    const qtys = Array.isArray(draft.coil_qtys) ? draft.coil_qtys : [];
    if (qtys.length === count) {
      setCoilQtys(qtys.map((q) => roundQty3(Number(q) || 0)));
    } else if (autoCalc || !editable) {
      const total = Number.isFinite(Number(draft.total_qty))
        ? roundQty3(Number(draft.total_qty))
        : roundQty3(Number(data?.it_recp_qty) || 0);
      setCoilQtys(buildCoilQtys(count, total, { autoCalc }));
    } else {
      setCoilQtys(Array.from({ length: count }, () => ""));
    }
    setHeatNo(draft.heat_no || "");
    setRemarks(draft.remarks || "");
    setTcFile(null);
    setRmtcFile(null);
    setDlTracking({});
  }, [applyFreshInputs, buildCoilQtys]);

  const hasTcDocument = useMemo(
    () => tcFile instanceof File || hasSavedDoc(detail?.tc_file_path),
    [tcFile, detail?.tc_file_path, hasSavedDoc]
  );
  const hasRmtcDocument = useMemo(
    () => rmtcFile instanceof File || hasSavedDoc(detail?.rmtc_file_path),
    [rmtcFile, detail?.rmtc_file_path, hasSavedDoc]
  );

  const loadDetail = useCallback(async () => {
    const uid = mrnId || sourceRow?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      const res = await mrnService.getDetail(uid);
      const data = res?.data ?? null;
      setDetail(data);
      if ((data?.coils || []).length > 0) {
        setCoilCount(data.coils.length);
        setCoilQtys(data.coils.map((c) => roundQty3(c.qty)));
        setHeatNo(data.coils[0]?.heat_no || "");
        setRemarks(data.coils[0]?.remarks || "");
      } else if (data?.has_sticker_draft || data?.sticker_draft) {
        applyDraftInputs(data);
      } else {
        applyFreshInputs(data);
      }
    } catch (err) {
      if (sourceRow && (err?.status === 404 || /not found/i.test(String(err?.message || "")))) {
        const hydrated = hydrateFromSourceRow(sourceRow);
        setDetail(hydrated);
        applyFreshInputs(hydrated);
      } else {
        toast.error(err?.message || "Could not load the MRN. Please try again.");
        setDetail(null);
      }
    } finally {
      setLoading(false);
    }
  }, [mrnId, sourceRow, applyFreshInputs, applyDraftInputs]);

  useEffect(() => {
    if (!open) {
      setTab(TABS.DETAILS);
      setDetail(null);
      setPreviewOpen(false);
      setPreviewHtml("");
      setDlTracking({});
      setSavingDraft(false);
      return;
    }
    const uid = mrnId || sourceRow?.uid;
    if (uid) {
      loadDetail();
      return;
    }
    if (sourceRow) {
      const hydrated = hydrateFromSourceRow(sourceRow);
      setDetail(hydrated);
      applyFreshInputs(hydrated);
      setLoading(false);
    }
  }, [open, mrnId, sourceRow, loadDetail, applyFreshInputs]);

  const generatedCoils = detail?.coils || [];
  const alreadyGenerated = detail?.sticker_generated === true || generatedCoils.length > 0;

  const previewRows = useMemo(() => {
    if (alreadyGenerated) {
      return generatedCoils.map((c) => ({
        coil_no_uid: c.coil_no_uid,
        qty: roundQty3(c.qty),
        index: c.coil_index,
        heat_no: c.heat_no,
        location_id: c.location_id,
        in_uid: c.in_uid,
        preview: false,
      }));
    }
    if (!detail) return [];
    const n = Math.max(1, Number(coilCount) || 1);
    return Array.from({ length: n }, (_, i) => ({
      coil_no_uid: formatCoilNoUid({
        prefix: getBoxNoUidPrefix(),
        mrn_no: detail.mrn_no,
        serial_no: detail.serial_no,
        total: n,
        index: i + 1,
      }),
      qty: roundQty3(coilQtys[i] ?? 0),
      index: i + 1,
      heat_no: heatNo,
      preview: true,
    }));
  }, [alreadyGenerated, generatedCoils, detail, coilCount, coilQtys, heatNo]);

  useLayoutEffect(() => {
    if (!previewOpen || !previewHtml || previewLoading) return undefined;
    const area = previewAreaRef.current;
    if (!area) return undefined;
    const run = () => {
      const availW = area.clientWidth;
      const availH = area.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      const s = Math.min(1, availW / STICKER_PREVIEW_W_PX, availH / STICKER_PREVIEW_H_PX);
      const scale = Number.isFinite(s) && s > 0 ? s : 1;
      setPreviewLayout({
        scale,
        w: Math.round(STICKER_PREVIEW_W_PX * scale),
        h: Math.round(STICKER_PREVIEW_H_PX * scale),
      });
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(area);
    return () => ro.disconnect();
  }, [previewOpen, previewHtml, previewLoading]);

  const qtySum = useMemo(
    () => roundQty3(coilQtys.reduce((s, q) => s + (Number(q) || 0), 0)),
    [coilQtys]
  );
  const qtyMatches = Math.abs(qtySum - targetQty) <= QTY_EPS;
  const qtyDiff = roundQty3(qtySum - targetQty);
  const unit = detail?.it_unit || "KGS";

  const handleCoilCountChange = (raw) => {
    const n = Math.max(1, Number(raw) || 1);
    setCoilCount(n);
    if (fillQtysAuto) {
      setCoilQtys(buildCoilQtys(n, targetQty, { autoCalc: qtyAutoCalc }));
    } else {
      setCoilQtys((prev) => {
        const next = Array.from({ length: n }, (_, i) => (prev[i] !== undefined && prev[i] !== "" ? prev[i] : ""));
        return next;
      });
    }
  };

  const handleQtyEdit = (idx, raw) => {
    if (!canEditQty) return;
    setCoilQtys((prev) => {
      const next = [...prev];
      if (raw === "") next[idx] = "";
      else {
        const n = Number(raw);
        next[idx] = Number.isFinite(n) ? Math.max(0, Math.round(n)) : "";
      }
      return next;
    });
  };

  const validateQtyInputs = () => {
    if (!Number.isFinite(targetQty) || targetQty <= 0) {
      toast.error("The MRN quantity is missing or invalid.");
      setTab(TABS.DETAILS);
      return false;
    }
    if (!fillQtysAuto && coilQtys.some((q) => q === "" || q == null || !Number.isFinite(Number(q)))) {
      toast.error("Enter the quantity for each coil.");
      setTab(TABS.BREAKDOWN);
      return false;
    }
    if (!qtyMatches) {
      toast.error(
        qtyDiff > 0
          ? `The coil quantities exceed the total by ${qtyDiff}.`
          : `The coil quantities are short of the total by ${Math.abs(qtyDiff)}.`
      );
      setTab(TABS.BREAKDOWN);
      return false;
    }
    if (coilQtys.some((q) => !Number.isFinite(Number(q)) || Number(q) < 0)) {
      toast.error("Each coil quantity must be 0 or more.");
      setTab(TABS.BREAKDOWN);
      return false;
    }
    return true;
  };

  const validateBeforePreview = () => {
    if (alreadyGenerated) {
      toast.info("Stickers have already been generated for this MRN.");
      return false;
    }
    if (!String(heatNo || "").trim()) {
      toast.error("Heat number is required.");
      setTab(TABS.DETAILS);
      return false;
    }
    return validateQtyInputs();
  };

  const validateBeforeGenerate = () => {
    if (!validateBeforePreview()) return false;
    if (!hasTcDocument || !hasRmtcDocument) {
      toast.error("Both the TC and RMTC documents are required.");
      setTab(TABS.DETAILS);
      return false;
    }
    return true;
  };

  const handlePreview = async () => {
    if (!validateBeforePreview()) return;
    setTab(TABS.BREAKDOWN);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewHtml("");
    try {
      const res = await mrnService.previewSticker({
        mrn_no: detail.mrn_no,
        serial_no: detail.serial_no,
        mrn_dt: detail.mrn_dt,
        acc_name: detail.acc_name,
        item_code: detail.item_code,
        item_desc: detail.item_desc,
        it_unit: detail.it_unit,
        it_lot_no: detail.it_lot_no,
        heat_no: heatNo || null,
        coil_count: Math.max(1, Number(coilCount) || 1),
        total_qty: targetQty,
        coil_qtys: coilQtys.map((q) => roundQty3(Number(q) || 0)),
      });
      setPreviewHtml(res?.html || "");
    } catch (err) {
      toast.error(err?.message || "Could not generate the preview. Please try again.");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadOne = async (coil_no_uid) => {
    if (!coil_no_uid) return;
    setDownloading(true);
    try {
      const res = await mrnService.renderSingleSticker({ coil_no_uid });
      const ok = printFromBackendHtml(res.html, { title: res.print_title ?? coil_no_uid });
      if (!ok) throw new Error("The sticker is empty, so it could not be printed.");
      setDlTracking((prev) => ({ ...prev, [coil_no_uid]: true }));
    } catch (err) {
      toast.error(err?.message || "Could not print the sticker. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  /** QC sticker — same coil design; batch = one for MRN, coil-wise = one per coil. */
  const handleDownloadQc = async (coil_no_uid = null) => {
    const uid = resolvedUid || detail?.uid;
    if (!generatedCoils.length) return;
    if (isBatchMode) {
      if (!uid) return;
    } else if (!coil_no_uid) {
      return;
    }
    setDownloading(true);
    try {
      if (isBatchMode) {
        const res = await mrnService.renderBatchQcSticker({ uid });
        const ok = printFromBackendHtml(res.html, {
          title: res.print_title ?? (detail?.mrn_no ? `MRN No. ${detail.mrn_no} — Batch QC` : "Batch QC Sticker"),
        });
        if (!ok) throw new Error("The QC sticker is empty, so it could not be printed.");
        setDlTracking((prev) => ({ ...prev, [BATCH_QC_DL_KEY]: true }));
      } else {
        const res = await mrnService.renderSingleSticker({ coil_no_uid, is_qc: true });
        const ok = printFromBackendHtml(res.html, {
          title: res.print_title ?? `QC · ${coil_no_uid}`,
        });
        if (!ok) throw new Error("The QC sticker is empty, so it could not be printed.");
        setDlTracking((prev) => ({ ...prev, [`qc_${coil_no_uid}`]: true }));
      }
    } catch (err) {
      toast.error(err?.message || "Could not print the QC sticker. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintAll = async () => {
    const uid = resolvedUid || detail?.uid;
    if (!uid || !generatedCoils.length) return;
    setDownloading(true);
    try {
      const uids = generatedCoils.map((c) => c.coil_no_uid);
      const res = await mrnService.renderBulkStickers({ uid, coil_no_uids: uids });
      const ok = printFromBackendHtml(res.html, {
        title: res.print_title ?? (detail?.mrn_no ? `MRN No. ${detail.mrn_no}` : "Coil Stickers"),
      });
      if (!ok) throw new Error("The stickers are empty, so they could not be printed.");
      setDlTracking((prev) => {
        const next = { ...prev };
        uids.forEach((u) => { next[u] = true; });
        return next;
      });
    } catch (err) {
      toast.error(err?.message || "Could not print the stickers. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  /** Coil-wise: print all QC stickers together (same as PRINT ALL, for QC). */
  const handlePrintAllQc = async () => {
    const uid = resolvedUid || detail?.uid;
    if (!uid || !generatedCoils.length || isBatchMode) return;
    setDownloading(true);
    try {
      const uids = generatedCoils.map((c) => c.coil_no_uid);
      const res = await mrnService.renderBulkStickers({ uid, coil_no_uids: uids, is_qc: true });
      const ok = printFromBackendHtml(res.html, {
        title: res.print_title ?? (detail?.mrn_no ? `MRN No. ${detail.mrn_no} — QC` : "QC Stickers"),
      });
      if (!ok) throw new Error("The QC stickers are empty, so they could not be printed.");
      setDlTracking((prev) => {
        const next = { ...prev };
        uids.forEach((u) => { next[`qc_${u}`] = true; });
        return next;
      });
    } catch (err) {
      toast.error(err?.message || "Could not print the QC stickers. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveDraft = async () => {
    const uid = resolvedUid || sourceRow?.uid || detail?.uid;
    if (!uid) {
      toast.error("MRN UID is required to save a draft.");
      return;
    }
    if (alreadyGenerated) {
      toast.info("Stickers have already been generated for this MRN.");
      return;
    }
    if (!validateQtyInputs()) return;
    setSavingDraft(true);
    try {
      const source = sourceRow || detail;
      const res = await mrnService.saveStickerDraft({
        uid,
        sourceRow: source,
        heat_no: heatNo.trim(),
        coil_count: Math.max(1, Number(coilCount) || 1),
        total_qty: targetQty,
        coil_qtys: coilQtys.map((q) => roundQty3(Number(q) || 0)),
        remarks: remarks || "",
        tcFile,
        rmtcFile,
      });
      toast.success(res?.message || "Draft saved successfully.");
      setDetail((prev) => ({
        ...(prev || {}),
        ...source,
        uid,
        has_sticker_draft: true,
        sticker_draft: res?.data?.sticker_draft ?? prev?.sticker_draft,
        tc_file_path: res?.data?.tc_file_path ?? prev?.tc_file_path ?? null,
        tc_file_name: res?.data?.tc_file_name ?? prev?.tc_file_name ?? null,
        rmtc_file_path: res?.data?.rmtc_file_path ?? prev?.rmtc_file_path ?? null,
        rmtc_file_name: res?.data?.rmtc_file_name ?? prev?.rmtc_file_name ?? null,
        status: "draft",
      }));
      setTcFile(null);
      setRmtcFile(null);
      onSuccess?.();
    } catch (err) {
      toast.error(err?.message || "Could not save the draft. Please try again.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleGenerate = async () => {
    if (!validateBeforeGenerate()) return;
    setGenerating(true);
    try {
      const source = sourceRow || detail;
      const uid = resolvedUid || source?.uid;
      const res = await mrnService.generateStickers({
        uid,
        sourceRow: source,
        heat_no: heatNo.trim(),
        coil_count: Math.max(1, Number(coilCount) || 1),
        total_qty: targetQty,
        coil_qtys: coilQtys.map((q) => roundQty3(Number(q) || 0)),
        remarks: remarks || null,
      });
      const newUid = res?.data?.uid ?? uid;
      if (!newUid) throw new Error("The stickers were generated but the MRN ID is missing.");
      let uploadedDocs = null;
      const needsDocUpload = tcFile instanceof File || rmtcFile instanceof File;
      if (needsDocUpload) {
        try {
          const upRes = await mrnService.uploadDocs({
            uid: newUid,
            tcFile,
            rmtcFile,
            requireBoth: false,
          });
          uploadedDocs = upRes?.data || null;
        } catch (upErr) {
          try {
            await mrnService.delete(newUid);
          } catch {
            /* ignore rollback errors */
          }
          throw new Error(
            upErr?.message || "Could not upload the documents, so the stickers were rolled back."
          );
        }
      } else if (!hasSavedDoc(detail?.tc_file_path) || !hasSavedDoc(detail?.rmtc_file_path)) {
        try {
          await mrnService.delete(newUid);
        } catch {
          /* ignore rollback errors */
        }
        throw new Error("Both the TC and RMTC documents are required.");
      }
      toast.success(res?.message || "Stickers generated successfully.");
      setPreviewOpen(false);
      setTab(TABS.BREAKDOWN);
      const generatedMode = res?.data?.sticker_mode || stickerMode;
      let nextDetail = null;
      try {
        const detailRes = await mrnService.getDetail(newUid);
        nextDetail = detailRes?.data ?? null;
      } catch {
        /* generate already succeeded — fall back to generate response */
      }
      setDetail({
        ...(detail || {}),
        ...(nextDetail || {}),
        uid: newUid,
        sticker_generated: true,
        coils: nextDetail?.coils?.length
          ? nextDetail.coils
          : (res?.data?.coils || []),
        // master-level mode from generate (or detail), so PRINT ALL QC / row QC appear
        sticker_mode: nextDetail?.sticker_mode || generatedMode,
        qty_editable: nextDetail?.qty_editable ?? detail?.qty_editable,
        qty_auto_calc: nextDetail?.qty_auto_calc ?? detail?.qty_auto_calc,
        tc_file_path: nextDetail?.tc_file_path || uploadedDocs?.tc_file_path || null,
        tc_file_name: nextDetail?.tc_file_name || uploadedDocs?.tc_file_name || tcFile?.name || null,
        rmtc_file_path: nextDetail?.rmtc_file_path || uploadedDocs?.rmtc_file_path || null,
        rmtc_file_name: nextDetail?.rmtc_file_name || uploadedDocs?.rmtc_file_name || rmtcFile?.name || null,
      });
      onSuccess?.();
    } catch (err) {
      toast.error(err?.message || "Could not generate the stickers. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  /* ─── Left cards (IMS StickerDetailCards pattern) ─── */
  const detailCards = detail ? (
    <div className="p-2 lg:p-3 space-y-2 lg:space-y-3">
      {/* Item Details — same pattern as IMS */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2">
          <Box className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-blue-600" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-slate-700">
            Item Details
          </span>
        </div>
        <div className="p-2.5 sm:p-3 lg:p-4 space-y-2 lg:space-y-2.5">
          <DetailField label="Item Code">
            <p className="text-[11px] sm:text-[12px] lg:text-base font-black text-blue-600 leading-none break-all">
              {detail.item_code || "—"}
            </p>
          </DetailField>
          <DetailField label="Description">
            <p className="text-[11px] lg:text-sm font-medium text-slate-600 leading-tight line-clamp-2 break-words">
              {detail.item_desc || "—"}
            </p>
          </DetailField>
        </div>
      </div>

      {/* Account */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2">
          <User className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-500" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-slate-700">
            {alreadyGenerated ? "Account (Saved)" : "Account"}
          </span>
        </div>
        <div className="p-2.5 sm:p-3 lg:p-4 space-y-2 lg:space-y-2.5">
          <DetailField label="Name">
            <p
              className="text-[11px] lg:text-sm font-bold text-slate-800 uppercase leading-tight line-clamp-2 break-words"
              title={detail.acc_name || ""}
            >
              {detail.acc_name || "—"}
            </p>
          </DetailField>
          <DetailField label="Lot No.">
            <p className="text-[11px] lg:text-sm font-mono font-bold text-slate-700 leading-none break-all">
              {detail.it_lot_no || "—"}
            </p>
          </DetailField>
        </div>
      </div>


      {/* Heat No + Coil Inputs — single card */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-indigo-600" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-slate-700">
            {alreadyGenerated ? "Inputs (Saved)" : "Coil Inputs"}
          </span>
        </div>
        <div className="p-2.5 sm:p-3 lg:p-4 space-y-2 min-w-0">
          <div className="min-w-0">
            <FormLabel required className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter ml-0">
              Heat No.
            </FormLabel>
            {alreadyGenerated ? (
              <div className="mt-0.5 flex items-center justify-between gap-2 bg-slate-50 px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-slate-100 min-w-0">
                <span className="text-[11px] sm:text-sm font-black text-slate-700 uppercase tracking-tight font-mono truncate min-w-0">
                  {heatNo || "—"}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden />
              </div>
            ) : (
              <input
                className={`mt-0.5 ${OK_INPUT} ${MODAL_INPUT_CLASS} font-mono font-bold`}
                value={heatNo}
                onChange={(e) => setHeatNo(e.target.value)}
                placeholder="Enter the heat number"
              />
            )}
          </div>

          {!alreadyGenerated ? (
            <>
              <div className="min-w-0">
                <FormLabel required className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter ml-0">
                  No. of Coils
                </FormLabel>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={`mt-0.5 ${OK_INPUT} ${MODAL_INPUT_CLASS} font-bold tabular-nums`}
                  value={coilCount}
                  onChange={(e) => handleCoilCountChange(e.target.value)}
                />
              </div>
              <SimpleFileInput
                label="TC Document"
                required
                file={tcFile}
                onChange={setTcFile}
                savedPath={detail?.tc_file_path}
                savedName={detail?.tc_file_name}
              />
              <SimpleFileInput
                label="RMTC Document"
                required
                file={rmtcFile}
                onChange={setRmtcFile}
                savedPath={detail?.rmtc_file_path}
                savedName={detail?.rmtc_file_name}
              />
              <div className="space-y-1 min-w-0">
                <FormLabel className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter ml-0">
                  Remarks
                </FormLabel>
                <textarea
                  className={`${OK_INPUT} ${MODAL_INPUT_CLASS} h-auto min-h-[48px] py-2 resize-none`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <SimpleFileInput
                label="TC Document"
                disabled
                savedPath={detail?.tc_file_path}
                savedName={detail?.tc_file_name}
              />
              <SimpleFileInput
                label="RMTC Document"
                disabled
                savedPath={detail?.rmtc_file_path}
                savedName={detail?.rmtc_file_name}
              />
              <div className="min-w-0">
                <FormLabel className="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-tighter ml-0">
                  Remarks
                </FormLabel>
                <div className="mt-0.5 bg-slate-50 px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-slate-100 min-w-0">
                  <p className="text-[11px] sm:text-sm font-medium text-slate-700 whitespace-pre-wrap break-words">
                    {remarks?.trim() ? remarks : "—"}
                  </p>
                </div>
              </div>
              <p className="text-[10px] lg:text-[11px] text-slate-500 font-bold italic">* Locked after generation. Select a document name to preview it.</p>
            </div>
          )}
        </div>
      </div>

      {/* MRN Info */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-500" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-slate-700">
            {alreadyGenerated ? "MRN Info (Saved)" : "MRN Info"}
          </span>
        </div>
        <div className="p-2.5 sm:p-3 lg:p-4 grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-y-2.5">
          <DetailField label="Serial">
            <p className="text-[11px] lg:text-sm font-bold text-slate-700 leading-none tabular-nums">
              {detail.serial_no ?? "—"}
            </p>
          </DetailField>
          <DetailField label="Total Qty">
            <p className="text-[11px] lg:text-sm font-bold text-slate-700 leading-none tabular-nums">
              {formatQty(alreadyGenerated ? detail.it_recp_qty : targetQty)}{" "}
              <span className="text-[9px] opacity-60 uppercase font-bold">{unit}</span>
            </p>
          </DetailField>
          <DetailField label="MRN Date">
            <p className="text-[11px] lg:text-sm font-bold text-slate-700 leading-none">
              {formatDocDate(detail.mrn_dt) || "—"}
            </p>
          </DetailField>
          <DetailField label="MRN No.">
            <p className="text-[11px] lg:text-sm font-bold text-slate-700 leading-none truncate">
              #{detail.mrn_no ?? "—"}
            </p>
          </DetailField>
        </div>
      </div>

      {/* Breakdown Summary — blue hero like IMS */}
      <div className="bg-blue-50/30 border border-blue-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-blue-600 px-3 py-1.5 lg:px-4 lg:py-2 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] text-white shrink-0" aria-hidden />
          <span className="text-[11px] lg:text-xs font-bold uppercase tracking-wider text-white">
            {alreadyGenerated ? "Breakdown (Saved)" : "Breakdown Summary"}
          </span>
        </div>
        <div className="p-2 sm:p-3 lg:p-4 space-y-2">
          <div className="flex justify-between items-center border-b border-blue-100 pb-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-800 uppercase">Total Coils</span>
            <span className="text-[13px] lg:text-xl font-black text-blue-700 tabular-nums">
              {alreadyGenerated ? generatedCoils.length : Math.max(1, Number(coilCount) || 1)}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-blue-100 pb-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-800 uppercase">Total Qty</span>
            <span className="text-[13px] lg:text-xl font-black text-blue-700 tabular-nums">
              {formatQty(alreadyGenerated
                ? generatedCoils.reduce((s, c) => s + (Number(c.qty) || 0), 0)
                : targetQty)}{" "}
              <span className="text-[9px] opacity-60 uppercase">{unit}</span>
            </span>
          </div>
          {alreadyGenerated ? (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-100">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Total Stickers</p>
                <p className="text-sm font-black text-indigo-700 tabular-nums">{generatedCoils.length}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Qty Sum</p>
                <p className="text-sm font-black text-emerald-700 tabular-nums">
                  {formatQty(generatedCoils.reduce((s, c) => s + (Number(c.qty) || 0), 0))}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-500 uppercase">Sum</span>
                <span className={qtyMatches ? "text-emerald-700" : "text-rose-600"}>
                  {formatQty(qtySum)} / {formatQty(targetQty)}
                </span>
              </div>
              {!qtyMatches && (
                <p className="text-[10px] font-bold text-rose-600 uppercase">
                  {qtyDiff > 0 ? `Higher by ${qtyDiff}` : `Lower by ${Math.abs(qtyDiff)}`}
                </p>
              )}
              {canEditQty && !qtyAutoCalc && (
                <p className="text-[10px] font-bold text-slate-500 uppercase">Manual quantity entry</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  /* ─── Breakdown table (IMS columns) ─── */
  const breakdownPanel = (
    <div className="w-full min-w-0 flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      <div className="px-2 py-1.5 lg:px-4 lg:py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-1.5 min-w-0 shrink-0">
        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0 flex-1">
          <Box className="w-4 h-4 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-600" aria-hidden />
          <span className="text-[10px] sm:text-[11px] lg:text-sm font-black uppercase tracking-tight text-slate-800 truncate">Breakdown</span>
        </div>
      </div>
      <div className="flex-1 h-full min-h-0 overflow-y-auto p-0 lg:p-1">
        {!previewRows.length ? (
          <div className="bg-white border border-slate-200 px-3 py-8 text-center text-slate-400">
            <Layers size={20} className="opacity-20 mx-auto mb-1" />
            <span className="text-[10px] lg:text-xs font-bold uppercase">Set the number of coils in the Details tab.</span>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 overflow-hidden w-full">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="sticky left-0 top-0 z-[30] bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-600 border-r border-slate-200">#</th>
                    <th className="bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500">Coil</th>
                    <th className="bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500">MRN</th>
                    <th className="bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500">Qty</th>
                    <th className="bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500">QC</th>
                    <th className="bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500">Status</th>
                    <th className="sticky right-0 top-0 z-[30] bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 text-right border-l border-slate-200">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => {
                    const printed = !!dlTracking[row.coil_no_uid];
                    const qcPrinted = isBatchMode
                      ? !!dlTracking[BATCH_QC_DL_KEY]
                      : !!dlTracking[`qc_${row.coil_no_uid}`];
                    const showRowQc = alreadyGenerated && !isBatchMode;
                    return (
                      <tr key={`${row.coil_no_uid}-${row.index}`} className="group border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 text-[10px] lg:text-[13px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums">
                          {row.index}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 text-[10px] lg:text-xs font-bold min-w-0 max-w-[200px]">
                          <span className={`break-all ${alreadyGenerated ? "text-blue-700" : "text-slate-800"}`}>{row.coil_no_uid}</span>
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 text-[10px] lg:text-[13px] font-bold text-slate-700 tabular-nums whitespace-nowrap">
                          {detail?.mrn_no ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3">
                          {row.preview && !alreadyGenerated && canEditQty ? (
                            <input
                              type="number"
                              step={1}
                              className="w-24 h-8 border border-slate-300 px-2 text-[11px] font-bold tabular-nums rounded"
                              value={coilQtys[idx] ?? ""}
                              onChange={(e) => handleQtyEdit(idx, e.target.value)}
                            />
                          ) : (
                            <span className="text-[10px] lg:text-[13px] font-bold text-slate-800 tabular-nums whitespace-nowrap">
                              {formatQty(row.qty)} {unit}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3">
                          {showRowQc ? (
                            <button
                              type="button"
                              disabled={downloading}
                              onClick={() => void handleDownloadQc(row.coil_no_uid)}
                              className={`touch-manipulation inline-flex items-center justify-center gap-1 border lg:px-2.5 lg:py-1.5 p-1 min-h-[28px] ${
                                qcPrinted
                                  ? "border-amber-400 bg-amber-50 text-amber-800"
                                  : "border-amber-300 bg-white text-amber-700"
                              }`}
                              title="Download QC sticker"
                            >
                              <Printer className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
                              <span className="hidden lg:inline text-[10px] font-black uppercase whitespace-nowrap">
                                {qcPrinted ? "Re-Print" : "Print"}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[9px] text-slate-300 font-bold">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3">
                          {alreadyGenerated ? (
                            <span className={`text-[9px] lg:text-[12px] font-bold uppercase whitespace-nowrap ${printed ? "text-emerald-600" : "text-blue-600"}`}>
                              {printed ? "Downloaded" : "Generated"}
                            </span>
                          ) : (
                            <span className="text-[9px] lg:text-[12px] font-bold text-slate-300 italic uppercase">Ready</span>
                          )}
                        </td>
                        <td className="sticky right-0 z-10 py-1 px-2 text-right bg-white group-hover:bg-slate-50 border-l border-slate-100">
                          {alreadyGenerated ? (
                            <button
                              type="button"
                              disabled={downloading}
                              onClick={() => void handleDownloadOne(row.coil_no_uid)}
                              className={`touch-manipulation inline-flex items-center justify-center gap-1 border lg:px-2.5 lg:py-1.5 p-1 min-h-[28px] min-w-[28px] ${
                                printed
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                  : "border-blue-400 bg-blue-50 text-blue-700"
                              }`}
                            >
                              <Printer className="w-4 h-4 shrink-0" strokeWidth={2.25} />
                              <span className="hidden lg:inline text-[11px] font-black uppercase whitespace-nowrap">
                                {printed ? "Re-Print" : "Print"}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[9px] text-slate-300 font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const previewPortal = typeof document !== "undefined" && previewOpen && createPortal(
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/55 p-1.5 sm:p-4"
      style={{ zIndex: 1200 }}
      role="dialog"
      aria-modal="true"
      onClick={() => !previewLoading && setPreviewOpen(false)}
    >
      <div
        className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        style={{ width: "min(calc(100mm + 2.5rem), calc(100vw - 1rem))", maxHeight: "92dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-2.5 sm:px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[10px] sm:text-sm font-black text-slate-800 uppercase tracking-tight">
              Sticker preview
            </h2>
            <p className="text-[9px] sm:text-[11px] text-slate-500 font-medium mt-0.5">
              {`Coil 1 of ${coilCount} · print layout (100 mm x 150 mm)`}
            </p>
          </div>
          <button type="button" onClick={() => setPreviewOpen(false)} disabled={previewLoading} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div ref={previewAreaRef} className="flex flex-1 min-h-[calc(150mm+2rem)] max-h-[calc(92dvh-3.25rem)] justify-center items-center p-4 sm:p-5 bg-slate-200/80 overflow-hidden">
          {previewLoading ? (
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Loader2 className="animate-spin w-8 h-8" />
              <span className="text-[10px] font-bold uppercase">Loading…</span>
            </div>
          ) : previewHtml ? (
            <div className="relative shrink-0 overflow-hidden bg-white shadow-lg" style={{ width: previewLayout.w, height: previewLayout.h }}>
              <iframe
                title="Coil sticker preview"
                srcDoc={previewHtml}
                scrolling="no"
                className="block border-0 pointer-events-none bg-white"
                style={{
                  width: STICKER_PREVIEW_W_PX,
                  height: STICKER_PREVIEW_H_PX,
                  transform: `scale(${previewLayout.scale})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">No preview data.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <Drawer
      isOpen={open}
      onClose={() => {
        if (previewOpen) {
          setPreviewOpen(false);
          return;
        }
        onClose?.();
      }}
      onSubmit={!alreadyGenerated && qtyMatches && !generating ? handleGenerate : undefined}
      title="Sticker Control"
      maxWidth="max-w-full xl:max-w-7xl"
      noPadding
      bodyScrollable={false}
    >
      <div className="w-full max-w-full flex-1 h-full min-h-0 flex flex-col bg-slate-50 antialiased">
        {loading && !detail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" />
          </div>
        ) : !detail ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">No MRN record was found.</div>
        ) : (
          <>
            {/* Header — IMS pattern */}
            <div className="shrink-0 z-20 bg-white border-b px-2 md:px-4 py-1.5 sm:py-2 md:py-3 flex flex-col md:flex-row items-stretch md:items-center gap-1.5 sm:gap-2 md:gap-3 shadow-sm w-full max-w-full min-w-0">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:flex-1 min-w-0 pb-1 -mb-1">
                <div className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-[11px] md:text-xs font-bold border shrink-0 text-left min-w-[96px] bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100">
                  <p className="text-[8px] uppercase font-bold opacity-70 mb-0.5">MRN No.</p>
                  <span className="block text-[10px] md:text-[11px] font-black tracking-wide">#{detail.mrn_no ?? "—"}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto shrink-0 justify-end border-t md:border-t-0 pt-2 md:pt-0 min-w-0">
                  {/* <span
                    className={`inline-flex items-center px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-tight border shrink-0 ${
                      isBatchMode
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-indigo-50 text-indigo-800 border-indigo-200"
                    }`}
                  >
                    {stickerModeLabel}
                  </span> */}
                  {alreadyGenerated ? (
                    <>
                      {isBatchMode ? (
                        <button
                          type="button"
                          onClick={() => void handleDownloadQc()}
                          disabled={downloading || !generatedCoils.length}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-md disabled:bg-amber-300 touch-manipulation flex-1 sm:flex-initial min-h-[34px]"
                        >
                          {downloading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Printer size={14} className="shrink-0" />}
                          <span className="lg:hidden">QC</span>
                          <span className="hidden lg:inline">{dlTracking[BATCH_QC_DL_KEY] ? "RE-PRINT QC" : "PRINT QC"}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handlePrintAllQc()}
                          disabled={downloading || !generatedCoils.length}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-md disabled:bg-amber-300 touch-manipulation flex-1 sm:flex-initial min-h-[34px]"
                        >
                          {downloading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Printer size={14} className="shrink-0" />}
                          <span className="lg:hidden">QC ALL</span>
                          <span className="hidden lg:inline">PRINT ALL QC</span>
                          {!downloading && (
                            <span className="text-[9px] sm:text-[10px] opacity-90 tabular-nums">
                              ({generatedCoils.filter((c) => dlTracking[`qc_${c.coil_no_uid}`]).length}/{generatedCoils.length})
                            </span>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handlePrintAll()}
                        disabled={downloading || !generatedCoils.length}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-md disabled:bg-emerald-300 touch-manipulation flex-1 sm:flex-initial min-h-[34px]"
                      >
                        {downloading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Printer size={14} className="shrink-0" />}
                        <span className="lg:hidden">ALL</span>
                        <span className="hidden lg:inline">PRINT ALL</span>
                        {!downloading && (
                          <span className="text-[9px] sm:text-[10px] opacity-90 tabular-nums">
                            ({generatedCoils.filter((c) => dlTracking[c.coil_no_uid]).length}/{generatedCoils.length})
                          </span>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleSaveDraft()}
                        disabled={generating || savingDraft || previewLoading}
                        className="bg-white border border-sky-300 hover:bg-sky-50 disabled:opacity-50 text-sky-800 px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-sm touch-manipulation flex-1 sm:flex-initial min-h-[34px]"
                      >
                        {savingDraft ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Save size={14} className="shrink-0" />}
                        <span className="lg:hidden">Draft</span>
                        <span className="hidden lg:inline">SAVE DRAFT</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePreview}
                        disabled={generating || savingDraft || previewLoading}
                        className="bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-800 px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-sm touch-manipulation flex-1 sm:flex-initial min-h-[34px]"
                      >
                        {previewLoading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Eye size={14} className="shrink-0" />}
                        <span className="lg:hidden">Preview</span>
                        <span className="hidden lg:inline">PREVIEW (1)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating || savingDraft || !qtyMatches}
                        className="bg-slate-900 hover:bg-black disabled:bg-slate-400 text-white px-2 sm:px-6 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-2 shadow-md touch-manipulation flex-1 sm:flex-initial min-h-[34px]"
                      >
                        {generating ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Printer size={14} className="shrink-0" />}
                        <span className="lg:hidden">Generate ({coilCount})</span>
                        <span className="hidden lg:inline">GENERATE ({coilCount})</span>
                      </button>
                    </>
                  )}
                </div>
            </div>

            {/* Mobile tabs */}
            <div role="tablist" className="lg:hidden grid grid-cols-2 gap-1 shrink-0 px-2 pt-1.5 pb-1 bg-slate-100/90 border-b border-slate-200">
              {[
                { id: TABS.DETAILS, label: "Details" },
                { id: TABS.BREAKDOWN, label: previewRows.length ? `Coils · ${previewRows.length}` : "Coils" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-md py-1.5 px-2 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-tight transition-all ${
                    tab === t.id
                      ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                      : "bg-slate-200/70 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body — IMS two-column */}
            <div className="flex-1 min-h-0 w-full overflow-hidden custom-scrollbar">
              <div className="hidden lg:flex flex-row w-full h-full min-h-0 bg-slate-50 border-t border-slate-200">
                <aside className="w-72 xl:w-80 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto self-stretch">
                  {detailCards}
                </aside>
                <section className="flex-1 flex flex-col min-w-0 bg-white self-stretch min-h-0 overflow-hidden">
                  {breakdownPanel}
                </section>
              </div>
              <div className="lg:hidden flex flex-col bg-slate-100/90 border-t border-slate-200 overflow-y-auto max-h-full">
                <div className="mx-1.5 sm:mx-2 mb-1.5 sm:mb-2 bg-white border border-slate-200 flex flex-col">
                  {tab === TABS.BREAKDOWN ? breakdownPanel : <div className="bg-slate-50/50">{detailCards}</div>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {previewPortal}
    </Drawer>
  );
}
