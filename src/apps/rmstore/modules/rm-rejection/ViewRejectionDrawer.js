"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";
import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";
import { inProcessRequestService } from "@/apps/rmstore/lib/services/inProcessRequest";
import { printCoilReport } from "@/apps/rmstore/lib/utils/coilReportActions";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import Drawer from "@/ui/primitives/Drawer";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { Info, RejectionReport, SectionHeader, primaryCoilUid, buildRejectedCoilRows, collectIprAttachmentPaths, resolveIprQcChecks, formatCoilUidSummary } from "@/apps/rmstore/modules/rm-rejection/GenerateStoreOutDrawer";

const REJECTION_VIEW_PERMS = { permission_module: "rm_rejection", permission_action: "view" };

function stageLabel(row) {
  if (String(row?.bill_no || "").trim()) return "Complete";
  if (row?.store_out_approved === true || row?.store_out_approved === "t") return "Awaiting Bill";
  return "Store Out Pending";
}

function rejectionSourceLabel(row) {
  if (row?.ipr_uid != null) return `In-Process · IPR-${row.ipr_uid}`;
  if (row?.qc_check_uid != null) return `QC Fail · QC-${row.qc_check_uid}`;
  if (row?.qc_reject_uid != null) return `Register · REJECT-${row.qc_reject_uid}`;
  if (row?.rejection_origin_label) return row.rejection_origin_label;
  return "—";
}

async function fetchQcByHelper(qcCheckUid) {
  const id = Number(qcCheckUid);
  if (!Number.isFinite(id) || id <= 0) return null;
  const res = await qcCheckService.getByHelper(id, REJECTION_VIEW_PERMS);
  return res?.data || null;
}

async function fetchIprByHelper(iprUid) {
  const id = Number(iprUid);
  if (!Number.isFinite(id) || id <= 0) return null;
  const res = await inProcessRequestService.getByHelper(id, REJECTION_VIEW_PERMS);
  return res?.data || null;
}

/**
 * Read-only RM Rejection view. Anyone with rm_rejection view can see
 * QC failure specs, documents, IPR photos, and Print QC report.
 */
export default function ViewRejectionDrawer({ open, onClose, row }) {
  const rejectId = row?.qc_reject_uid;
  const isPendingIpr = row?.pending_source === "in_process" && row?.ipr_uid != null && rejectId == null;
  const isPendingQc = row?.pending_source === "qc_check" && row?.qc_check_uid != null && rejectId == null;

  const [loading, setLoading] = useState(false);
  const [registerDetail, setRegisterDetail] = useState(null);
  const [detail, setDetail] = useState(null);
  const [coilQcDetail, setCoilQcDetail] = useState(null);
  const [printingQc, setPrintingQc] = useState(false);

  const load = useCallback(async () => {
    setCoilQcDetail(null);
    setRegisterDetail(null);
    setDetail(null);

    try {
      if (rejectId) {
        setLoading(true);
        const res = await rmRejectionService.getById(rejectId);
        const register = res?.data || null;
        setRegisterDetail(register);

        const iprId = register?.ipr_uid ?? row?.ipr_uid;
        const qcId = register?.qc_check_uid ?? row?.qc_check_uid;

        if (iprId) {
          const ipr = await fetchIprByHelper(iprId);
          setDetail(ipr);
          const resolved = resolveIprQcChecks(ipr, null);
          if (resolved.length) {
            setCoilQcDetail(resolved[0]);
          } else {
            setCoilQcDetail(await fetchQcByHelper(qcId));
          }
        } else if (qcId) {
          const qc = await fetchQcByHelper(qcId);
          setDetail(qc);
          setCoilQcDetail(qc);
        } else {
          setDetail(register);
        }
        return;
      }

      if (isPendingIpr) {
        const id = row?.ipr_uid;
        if (!id) return;
        setLoading(true);
        const ipr = await fetchIprByHelper(id);
        setDetail(ipr);
        const resolved = resolveIprQcChecks(ipr, null);
        if (resolved.length) {
          setCoilQcDetail(resolved[0]);
        } else {
          setCoilQcDetail(await fetchQcByHelper(row?.qc_check_uid));
        }
        return;
      }

      if (isPendingQc) {
        const id = row?.qc_check_uid;
        if (!id) return;
        setLoading(true);
        const qc = await fetchQcByHelper(id);
        setDetail(qc);
        setCoilQcDetail(qc);
      }
    } catch (err) {
      toast.error(err?.message || "Could not load the rejection details. Please try again.");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [rejectId, isPendingIpr, isPendingQc, row?.ipr_uid, row?.qc_check_uid, onClose]);

  useEffect(() => {
    if (open && (rejectId || isPendingIpr || isPendingQc)) {
      void load();
    } else if (!open) {
      setRegisterDetail(null);
      setDetail(null);
      setCoilQcDetail(null);
    }
  }, [open, rejectId, isPendingIpr, isPendingQc, load]);

  const isIpr = Boolean(
    isPendingIpr || registerDetail?.ipr_uid || detail?.ipr_uid || row?.ipr_uid
  );
  const isQc = Boolean(
    isPendingQc || (!isIpr && (registerDetail?.qc_check_uid || detail?.qc_check_uid || row?.qc_check_uid))
  );

  const qcChecks = useMemo(() => {
    if (isQc && Array.isArray(detail?.items) && detail.items.length) {
      return [detail];
    }
    return resolveIprQcChecks(detail, coilQcDetail);
  }, [isQc, detail, coilQcDetail]);

  const qcItems = useMemo(() => qcChecks.flatMap((qc) => qc.items || []), [qcChecks]);

  const rejectedCoils = useMemo(
    () =>
      buildRejectedCoilRows({
        isIpr,
        detail: isIpr ? detail : detail || registerDetail,
        row: registerDetail || row,
      }),
    [isIpr, detail, registerDetail, row]
  );

  const iprAttachments = useMemo(
    () => (isIpr ? collectIprAttachmentPaths(detail) : []),
    [isIpr, detail]
  );

  const failCount = qcItems.filter((it) => String(it?.result || "").toLowerCase() === "fail").length;

  const registerOrRow = registerDetail || row;
  const rejectionReason =
    detail?.reason ||
    detail?.failure_reason ||
    registerOrRow?.reason ||
    registerOrRow?.failure_reason ||
    "—";

  const reasonSubtitle = isIpr
    ? `${detail?.rejection_type === "lot" ? "Whole lot rejection" : "Coil-wise rejection"} · ${rejectedCoils.length} coil${rejectedCoils.length === 1 ? "" : "s"}`
    : failCount > 0
      ? `${rejectedCoils.length > 1 ? "Batch QC failure" : "QC failure"} · ${failCount} spec${failCount === 1 ? "" : "s"} failed · ${rejectedCoils.length} coil${rejectedCoils.length === 1 ? "" : "s"}`
      : `${rejectedCoils.length > 1 ? "Batch QC failure" : "QC failure"} · ${rejectedCoils.length} coil${rejectedCoils.length === 1 ? "" : "s"}`;

  const rejectedCoilsBatchLabel =
    !isIpr && rejectedCoils.length > 1 ? `Batch · ${rejectedCoils.length} coils` : "";

  const printCoilUid = primaryCoilUid(
    row?.coil_no_uid,
    detail?.coil_no_uid,
    registerDetail?.coil_no_uid,
    rejectedCoils[0]?.coil_no_uid
  );

  const handlePrintQc = async () => {
    await printCoilReport({
      coil_no_uid: printCoilUid,
      permissionModule: "rm_rejection",
      printing: printingQc,
      setPrinting: setPrintingQc,
    });
  };

  const footer = <RmStoreDrawerFooter onClose={onClose} readOnly />;

  const titlePrefix = rejectId != null
    ? `REJECT-${rejectId}`
    : isPendingIpr
      ? `IPR #${row?.ipr_uid || ""}`
      : isPendingQc
        ? `QC #${row?.qc_check_uid || ""}`
        : "Pending Rejection";

  const infoFields = isIpr
    ? [
        { label: "IPR #", value: detail?.ipr_uid ?? row?.ipr_uid },
        { label: "MRN UID", value: detail?.mrn_uid ?? row?.mrn_uid ?? registerOrRow?.mrn_uids, mono: true },
        { label: "Heat No.", value: detail?.heat_no || row?.heat_nos || registerOrRow?.heat_nos, mono: true },
        { label: "Item", value: detail?.item_code || row?.item_codes || registerOrRow?.item_codes },
        { label: "Item Description", value: detail?.item_desc || row?.item_descs || registerOrRow?.item_descs },
        {
          label: "Total Qty",
          value:
            detail?.total_qty != null || row?.total_qty != null || registerOrRow?.total_qty != null
              ? Number(detail?.total_qty ?? row?.total_qty ?? registerOrRow?.total_qty).toLocaleString()
              : null,
        },
        { label: "Approved By", value: detail?.approved_by_name || row?.inspected_by_name },
        {
          label: "Approved At",
          value:
            detail?.approved_at || row?.inspected_at
              ? formatDateTime(detail?.approved_at || row?.inspected_at)
              : null,
        },
      ]
    : isQc
      ? [
          { label: "QC Check #", value: detail?.qc_check_uid ?? row?.qc_check_uid },
          { label: "Coils", value: rejectedCoils.length || detail?.coil_count || row?.coil_count },
          { label: "Coil UID", value: formatCoilUidSummary(detail, row, rejectedCoils), mono: true },
          { label: "MRN UID", value: detail?.mrn_uid ?? row?.mrn_uid, mono: true },
          { label: "Heat No.", value: detail?.heat_no || row?.heat_no || row?.heat_nos, mono: true },
          {
            label: "Total Qty",
            value:
              detail?.qty != null || row?.qty != null || row?.total_qty != null
                ? Number(detail?.qty ?? row?.qty ?? row?.total_qty).toLocaleString()
                : rejectedCoils.reduce((sum, c) => sum + (Number(c.qty) || 0), 0) || null,
          },
          { label: "Item", value: detail?.item_code || row?.item_code || row?.item_codes },
          { label: "Item Description", value: detail?.item_desc || row?.item_descs || row?.item_desc },
          { label: "Inspected By", value: detail?.approved_by_name || detail?.created_by_name || row?.inspected_by_name },
          {
            label: "Inspected At",
            value:
              detail?.approved_at || detail?.created_at || row?.inspected_at
                ? formatDateTime(detail?.approved_at || detail?.created_at || row?.inspected_at)
                : null,
          },
        ]
      : [
          { label: "Reject #", value: rejectId != null ? `REJECT-${rejectId}` : null },
          { label: "Source", value: rejectionSourceLabel(registerOrRow) },
          { label: "Stage", value: stageLabel(registerOrRow) },
          { label: "MRN UID", value: registerOrRow?.mrn_uids },
          { label: "Heat Nos.", value: registerOrRow?.heat_nos, mono: true },
          { label: "Item Codes", value: registerOrRow?.item_codes },
          { label: "Item Description", value: registerOrRow?.item_descs || registerOrRow?.item_desc },
          {
            label: "Total Qty",
            value: registerOrRow?.total_qty != null ? Number(registerOrRow.total_qty).toLocaleString() : null,
          },
          { label: "Coils", value: registerOrRow?.coil_count ?? rejectedCoils.length },
        ];

  const registerMetaFields =
    rejectId && (isIpr || isQc)
      ? [
          { label: "Stage", value: stageLabel(registerOrRow) },
          { label: "Store Out", value: registerOrRow?.out_uid != null ? `OUT-${registerOrRow.out_uid}` : null },
          { label: "Bill Number", value: registerOrRow?.bill_no || null },
          { label: "Registered By", value: registerOrRow?.created_by_name },
          {
            label: "Registered At",
            value: registerOrRow?.created_at ? formatDateTime(registerOrRow.created_at) : null,
          },
          { label: "Authorized By", value: registerOrRow?.approved_by_name || null },
          {
            label: "Authorized At",
            value: registerOrRow?.approved_at ? formatDateTime(registerOrRow.approved_at) : null,
          },
        ]
      : [];

  const allInfoFields = [...infoFields, ...registerMetaFields];

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={`View Rejection — ${titlePrefix}`}
      description="QC failure details, documents, and coils (read-only)."
      footer={footer}
      maxWidth="max-w-3xl"
      bodyScrollable
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      ) : isIpr || isQc ? (
        <div className="space-y-2 pb-2">
          <RejectionReport
            isIpr={isIpr}
            reason={rejectionReason}
            subtitle={reasonSubtitle}
            failCount={failCount}
            printCoilUid={printCoilUid}
            printing={printingQc}
            onPrint={handlePrintQc}
            infoFields={allInfoFields}
            attachments={iprAttachments}
            qcChecks={qcChecks}
            rejectedCoils={rejectedCoils}
            rejectedCoilsBatchLabel={rejectedCoilsBatchLabel}
          />
          {(registerOrRow?.remarks || detail?.remarks) ? (
            <div className="border border-slate-200 px-2 py-1.5 bg-white">
              <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Remarks</p>
              <p className="text-[11px] text-slate-700 mt-0.5 whitespace-pre-wrap break-words">
                {registerOrRow?.remarks || detail?.remarks}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <SectionHeader title="Rejection details" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {infoFields.filter((f) => f.value != null && String(f.value).trim() !== "" && String(f.value).trim() !== "—").map((field) => (
              <Info key={field.label} label={field.label} value={field.value} mono={field.mono} />
            ))}
          </div>
          {registerMetaFields.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {registerMetaFields
                .filter((f) => f.value != null && String(f.value).trim() !== "" && String(f.value).trim() !== "—")
                .map((field) => (
                <Info key={field.label} label={field.label} value={field.value} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
