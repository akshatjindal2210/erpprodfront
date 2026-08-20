"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Printer, FileText, ImageIcon } from "lucide-react";
import { toast } from "react-toastify";
import { printCoilReport } from "@/apps/rmstore/lib/utils/coilReportActions";
import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";
import { inProcessRequestService } from "@/apps/rmstore/lib/services/inProcessRequest";
import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import Drawer from "@/ui/primitives/Drawer";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import ActionButton from "@/ui/primitives/ActionButton";
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";

function resolveDocUrl(noteOrPath) {
  const raw = String(noteOrPath || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) return raw;
  let path = raw.replace(/^\/+/, "").replace(/\\/g, "/");
  if (path.startsWith("rmstore/")) path = `uploads/${path}`;
  if (path.startsWith("uploads/")) return `${String(FILE_BASE_URL || "").replace(/\/$/, "")}/${path}`;
  return "";
}

function formatExpected(spec) {
  const t = String(spec?.spec_type || "").toLowerCase();
  if (t === "min") return `≥ ${Number(spec?.min_value) || 0}`;
  if (t === "max") return `≤ ${Number(spec?.max_value) || 0}`;
  if (t === "range") return `${Number(spec?.min_value) || 0} – ${Number(spec?.max_value) || 0}`;
  if (t === "dropdown") {
    return (
      String(spec?.correct_option || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" | ") || "—"
    );
  }
  return spec?.expected_display || "—";
}

function ResultPill({ result }) {
  const r = String(result || "").toLowerCase();
  if (r === "pass") {
    return (
      <span className="inline-flex px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
        Pass
      </span>
    );
  }
  if (r === "fail") {
    return (
      <span className="inline-flex px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-rose-50 text-rose-700 border border-rose-100">
        Fail
      </span>
    );
  }
  return <span className="text-[10px] text-slate-400">—</span>;
}

function hasFieldValue(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== "" && s !== "—";
}

function Info({ label, value, mono }) {
  return (
    <div className="bg-slate-50 border border-slate-200 px-1.5 py-1 min-w-0">
      <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-none">{label}</div>
      <div className={`text-[11px] font-bold text-slate-800 truncate mt-0.5 ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function InfoGrid({ fields = [] }) {
  const visible = (fields || []).filter((f) => f && !f.empty && hasFieldValue(f.value));
  if (!visible.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
      {visible.map((field) => (
        <Info key={field.label} label={field.label} value={field.value} mono={field.mono} />
      ))}
    </div>
  );
}

function RejectionReasonBanner({ reason, subtitle, failCount = 0 }) {
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 flex items-start gap-2">
      {failCount > 0 ? (
        <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex flex-col items-center justify-center shrink-0">
          <span className="text-sm font-black leading-none tabular-nums">{failCount}</span>
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-wider text-violet-800">Rejection reason</p>
        <p className="text-[12px] font-bold text-violet-950 leading-snug break-words">{reason}</p>
        {subtitle ? (
          <p className="text-[9px] font-semibold text-violet-700 mt-0.5 uppercase tracking-wide">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function photoLayout(count) {
  const n = Number(count) || 0;
  if (n <= 1) {
    return {
      grid: "grid-cols-1",
      img: "w-full max-h-36 sm:max-h-44 object-contain bg-slate-50",
    };
  }
  return {
    grid: "grid-cols-2",
    img: "w-full h-24 sm:h-28 object-cover bg-slate-50",
  };
}

function AttachmentsPanel({ attachments = [], title = "Rejection photos / documents" }) {
  const list = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  if (!list.length) return null;
  const layout = photoLayout(list.length);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-2 py-1 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5">
        <ImageIcon size={11} className="text-slate-500" />
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{title}</p>
      </div>
      <div className={`p-1.5 bg-white grid gap-1.5 ${layout.grid}`}>
        {list.map((file, idx) => {
          const isPath = typeof file === "string";
          const name = isPath ? file.split("/").pop() : file?.name || `File ${idx + 1}`;
          const href = isPath ? resolveDocUrl(file) : null;
          const isImage = /\.(png|jpe?g|webp|gif)$/i.test(String(name || ""));
          return (
            <div key={`${name}-${idx}`} className="rounded border border-slate-200 overflow-hidden bg-white min-w-0">
              {href && isImage ? (
                <FilePreviewLink href={href} fileName={name} title={name} className="block">
                  <img src={href} alt={name} className={layout.img} />
                </FilePreviewLink>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <FileText size={12} className="text-indigo-600 shrink-0" />
                  {href ? (
                    <FilePreviewLink
                      href={href}
                      fileName={name}
                      className="text-[9px] font-bold text-indigo-700 truncate hover:underline min-w-0"
                      title={name}
                    >
                      {name}
                    </FilePreviewLink>
                  ) : (
                    <span className="text-[9px] font-bold text-slate-700 truncate">{name}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QcChecklistTable({ items = [], hideHeader = false }) {
  if (!items.length) return null;
  const table = (
    <div className="overflow-x-auto">
      <table className="w-full text-left min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-100 bg-white">
            <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Spec</th>
            <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Expected</th>
            <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Actual</th>
            <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400 w-16">Result</th>
            <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400 w-28">Document</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const docUrl = resolveDocUrl(it.document_note);
            const docName = it.document_note ? String(it.document_note).split("/").pop() : null;
            return (
              <tr key={it.spec_id ?? idx} className="border-b border-slate-50 last:border-0">
                <td className="px-2 py-1.5 text-[10px] font-semibold text-slate-800">
                  {it.spec_name || `Spec ${it.spec_id}`}
                </td>
                <td className="px-2 py-1.5 text-[10px] text-slate-600 tabular-nums">
                  {it.expected_display || formatExpected(it)}
                </td>
                <td className="px-2 py-1.5 text-[10px] font-mono text-slate-800">
                  {it.actual_value != null && String(it.actual_value).trim() !== "" ? it.actual_value : "—"}
                </td>
                <td className="px-2 py-1.5">
                  <ResultPill result={it.result} />
                </td>
                <td className="px-2 py-1.5">
                  {docUrl ? (
                    <FilePreviewLink
                      href={docUrl}
                      fileName={docName || "Document"}
                      className="text-[9px] font-bold text-indigo-700 hover:underline truncate block max-w-[7rem]"
                    >
                      {docName || "View"}
                    </FilePreviewLink>
                  ) : (
                    <span className="text-[10px] text-slate-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  if (hideHeader) return table;
  return (
    <div className="border border-slate-200 overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">QC check details</p>
      </div>
      {table}
    </div>
  );
}

function RejectedCoilsTable({ coils = [], batchLabel = "" }) {
  return (
    <div className="border border-slate-200 overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Rejected coils</p>
        {batchLabel ? (
          <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-700">{batchLabel}</span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[480px]">
          <thead>
            <tr className="border-b border-slate-100 bg-white">
              <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Coil UID</th>
              <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Heat</th>
              <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400">Item</th>
              <th className="px-2 py-1.5 text-[9px] font-bold uppercase text-slate-400 w-20">Qty</th>
            </tr>
          </thead>
          <tbody>
            {coils.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[11px] text-slate-400">
                  No coils on this request
                </td>
              </tr>
            ) : (
              coils.map((c) => (
                <tr key={c.coil_no_uid} className="border-b border-slate-50">
                  <td className="px-2 py-1.5 text-[10px] font-mono font-bold text-slate-800">{c.coil_no_uid}</td>
                  <td className="px-2 py-1.5 text-[10px] font-mono text-amber-700">{c.heat_no || "—"}</td>
                  <td className="px-2 py-1.5 text-[10px] uppercase text-slate-700">{c.item_code || "—"}</td>
                  <td className="px-2 py-1.5 text-[11px] font-black text-emerald-600 tabular-nums">
                    {c.qty != null && String(c.qty).trim() !== "" ? Number(c.qty).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function primaryCoilUid(...candidates) {
  for (const value of candidates) {
    const uid = String(value || "")
      .split(",")
      .map((s) => s.trim())
      .find(Boolean);
    if (uid) return uid;
  }
  return null;
}

function parseCoilUidList(raw) {
  return String(raw || "")
    .split(/[,|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapLinkedCoilRow(c, fallback = {}) {
  return {
    coil_no_uid: c.coil_no_uid,
    heat_no: c.heat_no || fallback.heat_no,
    item_code: c.item_code || fallback.item_code,
    qty: c.qty,
  };
}

function buildRejectedCoilRows({ isIpr, detail, row }) {
  if (isIpr) {
    const coils = Array.isArray(detail?.coils) ? detail.coils : row?.coils || [];
    return coils.filter((c) => c?.coil_no_uid).map((c) => mapLinkedCoilRow(c));
  }

  const linked = Array.isArray(detail?.coils) ? detail.coils : [];
  if (linked.length) {
    return linked
      .filter((c) => c?.coil_no_uid)
      .map((c) =>
        mapLinkedCoilRow(c, {
          heat_no: detail?.heat_no || row?.heat_no || row?.heat_nos,
          item_code: detail?.item_code || row?.item_code || row?.item_codes,
        })
      );
  }

  const uids = parseCoilUidList(detail?.coil_no_uid || row?.coil_no_uid);
  const heat = detail?.heat_no || row?.heat_no || row?.heat_nos;
  const item = detail?.item_code || row?.item_code || row?.item_codes;
  const totalQty = detail?.qty ?? row?.qty ?? row?.total_qty;
  if (!uids.length) return [];
  if (uids.length === 1) {
    return [{ coil_no_uid: uids[0], heat_no: heat, item_code: item, qty: totalQty }];
  }
  return uids.map((coil_no_uid) => ({ coil_no_uid, heat_no: heat, item_code: item, qty: null }));
}

function formatCoilUidSummary(detail, row, coilRows = []) {
  const count = coilRows.length || Number(detail?.coil_count ?? row?.coil_count) || 0;
  if (count > 1) {
    const first = coilRows[0]?.coil_no_uid || parseCoilUidList(detail?.coil_no_uid || row?.coil_no_uid)[0];
    return first ? `Batch · ${count} coils (${first}…)` : `Batch · ${count} coils`;
  }
  return detail?.coil_no_uid || row?.coil_no_uid || "—";
}

function collectIprAttachmentPaths(detail) {
  return [...new Set((Array.isArray(detail?.attachments) ? detail.attachments : []).filter(Boolean))];
}

async function loadCoilQcCheck(_coilUid, qcCheckUid) {
  const id = Number(qcCheckUid);
  if (!Number.isFinite(id) || id <= 0) return null;
  const res = await qcCheckService.getByHelper(id, {
    permission_module: "rm_rejection",
    permission_action: "view",
  });
  return res?.data || null;
}

function resolveIprQcChecks(detail, fallback) {
  const fromList = Array.isArray(detail?.qc_checks)
    ? detail.qc_checks.filter((c) => Array.isArray(c?.items) && c.items.length)
    : [];
  if (fromList.length) return fromList;
  if (Array.isArray(detail?.qc_check?.items) && detail.qc_check.items.length) {
    return [detail.qc_check];
  }
  if (Array.isArray(fallback?.items) && fallback.items.length) {
    return [fallback];
  }
  return [];
}

function PrintQcButton({ printCoilUid, printing, onPrint }) {
  if (!printCoilUid) return null;
  return (
    <ActionButton
      module="rm_rejection"
      action="view"
      variant="outline"
      label={printing ? "…" : "Print QC"}
      icon={Printer}
      onClick={onPrint}
      disabled={printing}
      className="rounded-none h-8 bg-white text-[10px] font-bold uppercase px-3 border-slate-300 shadow-none shrink-0"
    />
  );
}

/** Shared compact report body for View + Generate Store Out. */
function RejectionReport({
  isIpr,
  reason,
  subtitle,
  failCount,
  printCoilUid,
  printing,
  onPrint,
  infoFields = [],
  attachments = [],
  qcChecks = [],
  rejectedCoils = [],
  rejectedCoilsBatchLabel,
}) {
  return (
    <div className="space-y-2 pb-1">
      <RejectionReasonBanner reason={reason} subtitle={subtitle} failCount={failCount} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
          {isIpr ? "In-process rejection" : "QC rejection"}
        </p>
        <PrintQcButton printCoilUid={printCoilUid} printing={printing} onPrint={onPrint} />
      </div>

      {isIpr ? <AttachmentsPanel attachments={attachments} title="Photos" /> : null}

      {qcChecks.length === 1 ? (
        <QcChecklistTable items={qcChecks[0].items || []} />
      ) : qcChecks.length > 1 ? (
        <div className="border border-slate-200 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">QC check details</p>
          </div>
          <div className="divide-y divide-slate-200">
            {qcChecks.map((qc) => (
              <div key={qc.qc_check_uid}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 px-3 py-1.5 bg-white">
                  QC #{qc.qc_check_uid}
                  {qc.coil_no_uid ? ` · ${primaryCoilUid(qc.coil_no_uid)}` : ""}
                  {qc.status ? ` · ${String(qc.status).toUpperCase()}` : ""}
                </p>
                <QcChecklistTable items={qc.items || []} hideHeader />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <RejectedCoilsTable coils={rejectedCoils} batchLabel={rejectedCoilsBatchLabel} />

      <InfoGrid fields={infoFields} />
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="px-1 pt-1">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">{title}</p>
      {subtitle ? (
        <p className="text-[10px] font-medium text-slate-500 mt-0.5">{subtitle}</p>
      ) : null}
    </div>
  );
}

/**
 * Pending RM Rejection → review details → Submit queues Store Out Pending (scan and authorize there).
 */
export {
  Info,
  InfoGrid,
  RejectionReasonBanner,
  AttachmentsPanel,
  QcChecklistTable,
  RejectedCoilsTable,
  RejectionReport,
  SectionHeader,
  primaryCoilUid,
  buildRejectedCoilRows,
  collectIprAttachmentPaths,
  resolveIprQcChecks,
  formatCoilUidSummary,
};

export default function GenerateStoreOutDrawer({ open, onClose, onSuccess, row }) {
  const isIpr = row?.pending_source === "in_process" && row?.ipr_uid != null;
  const isQc = row?.pending_source === "qc_check" && row?.qc_check_uid != null;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [coilQcDetail, setCoilQcDetail] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setCoilQcDetail(null);
    if (isIpr) {
      const id = row?.ipr_uid;
      if (!id) return;
      setLoading(true);
      try {
        const res = await inProcessRequestService.getByHelper(id, { permission_module: "rm_rejection", permission_action: "view" });
        const data = res?.data || null;
        setDetail(data);
        setRemarks(String(data?.remarks || row?.remarks || "").trim());
        const resolved = resolveIprQcChecks(data, null);
        if (resolved.length) {
          setCoilQcDetail(resolved[0]);
        } else {
          const coilUid = primaryCoilUid(data?.coils?.[0]?.coil_no_uid, data?.seed_coil_uid, row?.coil_no_uid);
          const qcData = await loadCoilQcCheck(coilUid, row?.qc_check_uid);
          setCoilQcDetail(qcData);
        }
      } catch (err) {
        toast.error(err?.message || "Could not load the in-process rejection. Please try again.");
        onClose?.();
      } finally {
        setLoading(false);
      }
      return;
    }
    const id = row?.qc_check_uid;
    if (!id) return;
    setLoading(true);
    try {
      const res = await qcCheckService.getByHelper(id, { permission_module: "rm_rejection", permission_action: "view" });
      const data = res?.data || null;
      setDetail(data);
      setCoilQcDetail(data);
      setRemarks(String(data?.remarks || row?.remarks || "").trim());
    } catch (err) {
      toast.error(err?.message || "Could not load the QC details. Please try again.");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [isIpr, row?.ipr_uid, row?.qc_check_uid, row?.remarks, row?.coil_no_uid, onClose]);

  useEffect(() => {
    if (open && (isQc || isIpr)) {
      void load();
    } else if (!open) {
      setDetail(null);
      setCoilQcDetail(null);
      setRemarks("");
    }
  }, [open, isQc, isIpr, load]);

  const qcChecks = useMemo(() => {
    if (isQc && Array.isArray(detail?.items) && detail.items.length) {
      return [detail];
    }
    return resolveIprQcChecks(detail, coilQcDetail);
  }, [isQc, detail, coilQcDetail]);

  const qcItems = useMemo(() => qcChecks.flatMap((qc) => qc.items || []), [qcChecks]);

  const rejectedCoils = useMemo(
    () => buildRejectedCoilRows({ isIpr, detail, row }),
    [isIpr, detail, row]
  );

  const iprAttachments = useMemo(
    () => (isIpr ? collectIprAttachmentPaths(detail) : []),
    [isIpr, detail]
  );

  const failCount = qcItems.filter((it) => String(it?.result || "").toLowerCase() === "fail").length;

  const rejectionReason =
    detail?.reason ||
    detail?.failure_reason ||
    row?.reason ||
    row?.failure_reason ||
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
    rejectedCoils[0]?.coil_no_uid
  );

  const handlePrintQc = async () => {
    await printCoilReport({
      coil_no_uid: printCoilUid,
      permissionModule: "rm_rejection",
      printing,
      setPrinting,
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let res;
      if (isIpr) {
        if (!row?.ipr_uid) return;
        res = await rmRejectionService.generateStoreOutFromIpr({
          ipr_uid: row.ipr_uid,
          reason: detail?.reason || row?.reason || row?.failure_reason || undefined,
          remarks: remarks.trim() || undefined,
        });
      } else if (isQc) {
        if (!row?.qc_check_uid) return;
        res = await rmRejectionService.generateStoreOut({
          qc_check_uid: row.qc_check_uid,
          reason: detail?.failure_reason || row?.failure_reason || row?.reason || undefined,
          remarks: remarks.trim() || undefined,
        });
      }
      toast.success(res?.message || "Submitted to Store Out successfully.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not submit to Store Out. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <RmStoreDrawerFooter
      onClose={onClose}
      loading={submitting}
      disabled={loading || (!isQc && !isIpr)}
      onSave={handleSubmit}
      saveLabel="Submit"
      loadingLabel="Submitting…"
    />
  );

  const drawerTitle = isIpr
    ? `Generate Store Out — IPR #${row?.ipr_uid || ""}`
    : `Generate Store Out — QC #${row?.qc_check_uid || ""}`;

  const drawerDescription = isIpr
    ? "Review in-process rejection details and linked QC checks. Submit skips approval and queues Store Out Pending — scan and authorize there."
    : "Review QC failure details, documents, and coils. Submit skips approval and queues Store Out Pending — scan and authorize there.";

  const infoFields = isIpr
    ? [
        { label: "IPR #", value: detail?.ipr_uid ?? row?.ipr_uid },
        { label: "MRN UID", value: detail?.mrn_uid ?? row?.mrn_uid, mono: true },
        { label: "Heat No.", value: detail?.heat_no || row?.heat_nos, mono: true },
        { label: "Item", value: detail?.item_code || row?.item_codes },
        {
          label: "Total Qty",
          value:
            detail?.total_qty != null || row?.total_qty != null
              ? Number(detail?.total_qty ?? row?.total_qty).toLocaleString()
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
    : [
        { label: "QC Check #", value: detail?.qc_check_uid ?? row?.qc_check_uid },
        { label: "Coils", value: rejectedCoils.length || detail?.coil_count || row?.coil_count },
        { label: "Coil UID", value: formatCoilUidSummary(detail, row, rejectedCoils), mono: true },
        { label: "MRN UID", value: detail?.mrn_uid ?? row?.mrn_uid, mono: true },
        { label: "Heat No.", value: detail?.heat_no || row?.heat_no, mono: true },
        {
          label: "Total Qty",
          value:
            detail?.qty != null || row?.qty != null || row?.total_qty != null
              ? Number(detail?.qty ?? row?.qty ?? row?.total_qty).toLocaleString()
              : rejectedCoils.reduce((sum, c) => sum + (Number(c.qty) || 0), 0) || null,
        },
        { label: "Item", value: detail?.item_code || row?.item_code },
        { label: "Inspected By", value: detail?.approved_by_name || detail?.created_by_name },
        {
          label: "Inspected At",
          value:
            detail?.approved_at || detail?.created_at
              ? formatDateTime(detail?.approved_at || detail?.created_at)
              : null,
        },
      ];

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={!loading && !submitting ? () => void handleSubmit() : undefined}
      title={drawerTitle}
      description={drawerDescription}
      footer={footer}
      maxWidth="max-w-3xl"
      bodyScrollable
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <RejectionReport
            isIpr={isIpr}
            reason={rejectionReason}
            subtitle={reasonSubtitle}
            failCount={failCount}
            printCoilUid={printCoilUid}
            printing={printing}
            onPrint={handlePrintQc}
            infoFields={infoFields}
            attachments={iprAttachments}
            qcChecks={qcChecks}
            rejectedCoils={rejectedCoils}
            rejectedCoilsBatchLabel={rejectedCoilsBatchLabel}
          />
          <div className="pt-2">
            <FormTextarea
              label="Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              disabled={submitting}
              placeholder="Optional remarks for Store Out"
            />
          </div>
        </>
      )}
    </Drawer>
  );
}
