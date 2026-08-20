"use client";

import { Box, User, ClipboardList, FileText } from "lucide-react";
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { formatDocDate } from "@/platform/utils/core/utilHelper";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";
import { OK_INPUT, MODAL_INPUT_CLASS } from "@/ui/common/Constants";

const FIELD_LABEL = "block text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1 leading-none";

function sanitizeStockAdjustmentHeatNo(raw) {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function resolveUploadUrl(noteOrPath, fileBaseUrl = "") {
  const raw = String(noteOrPath || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) return raw;
  const p = raw.replace(/^\/+/, "");
  if (p.startsWith("uploads/")) return `${String(fileBaseUrl || "").replace(/\/$/, "")}/${p}`;
  return "";
}

/** Map saved adjustment row → detail card props (View / Print read-only). */
export function buildRmSaDetailCardProps(detail, coils = []) {
  const row = detail || {};
  const coilList = Array.isArray(coils) ? coils : [];
  const totalQty = coilList.reduce((s, c) => s + (Number(c.qty) || 0), 0) || Number(row.qty) || 0;
  const coilCount = coilList.length || Number(row.coil_count_impact) || 0;
  const unit = row.unit || "KG";

  const documents = [];
  if (row.tc_file_path || row.tc_file_name) {
    documents.push({
      label: "TC Document",
      url: resolveUploadUrl(row.tc_file_path, FILE_BASE_URL),
      name: row.tc_file_name,
    });
  }
  if (row.rmtc_file_path || row.rmtc_file_name) {
    documents.push({
      label: "RMTC Document",
      url: resolveUploadUrl(row.rmtc_file_path, FILE_BASE_URL),
      name: row.rmtc_file_name,
    });
  }

  return {
    itemCode: row.item_code,
    itemDesc: row.item_desc,
    showSupplier: true,
    supplierName: row.acc_name?.trim() || "—",
    heatNo: row.it_lot_no || row.heat_no,
    mrnUid: row.mrn_uid,
    mrnDt: row.mrn_dt,
    billNo: row.bill_no,
    billDt: row.bill_dt,
    coilInfoTitle: "Coil Info",
    coilCountDisplay: coilCount || "—",
    totalQtyLabel: "Total Qty",
    totalQty: totalQty,
    unit,
    showDocuments: true,
    documents: documents.length ? documents : null,
    readOnly: true,
  };
}

/** Sticker print API meta from adjustment row. */
export function buildRmSaStickerMeta(detail, coil = null) {
  const row = detail || {};
  return {
    packing_number: row.mrn_no != null ? String(row.mrn_no) : `SA-${row.adjustment_id}`,
    mrn_no: row.mrn_no ?? null,
    mrn_uid: row.mrn_uid ?? null,
    item_dcode: row.item_dcode ?? null,
    item_code: row.item_code ?? null,
    item_desc: row.item_desc ?? null,
    acc_name: row.acc_name ?? null,
    heat_no: row.it_lot_no || row.heat_no || null,
    lot_no: row.it_lot_no || row.heat_no || null,
    financial_year: row.financial_year ?? null,
    it_lot_no: row.it_lot_no ?? null,
    unit: row.unit || "KG",
    mrn_dt: row.mrn_dt ?? null,
    bill_no: row.bill_no ?? null,
    bill_dt: row.bill_dt ?? null,
    doc_dt: row.mrn_dt || row.bill_dt || row.doc_dt || row.approved_at || row.created_at || null,
    remarks: row.remarks ?? null,
    entry_type: row.entry_type ?? null,
    ...(coil?.coil_no_uid ? { coil_no_uid: coil.coil_no_uid } : {}),
    ...(coil?.qty != null ? { qty: coil.qty } : {}),
  };
}

/**
 * Sidebar cards — single source for View, Approve, Edit, and Print stickers.
 * Matches Stock Adjustment drawer layout exactly.
 */
export default function RmStockAdjustmentDetailCards({
  itemCode,
  itemDesc,
  showSupplier = false,
  supplierName,
  supplierSelect = null,
  heatNo,
  onHeatNoChange,
  heatInputClassName,
  mrnUid,
  mrnDt,
  billNo,
  billDt,
  coilInfoTitle = "Coil Info",
  unit = "KG",
  coilCountDisplay,
  totalQtyLabel = "Total Qty",
  totalQty,
  totalQtyNode = null,
  showDocuments = false,
  documents = null,
  documentsSlot = null,
  footerSlot = null,
  readOnly = true,
}) {
  const heatControlClass =
    heatInputClassName ||
    `${OK_INPUT} ${MODAL_INPUT_CLASS} font-mono font-bold uppercase !text-slate-900`;

  const coilCountText =
    coilCountDisplay != null && coilCountDisplay !== "" ? coilCountDisplay : "—";

  const totalQtyContent =
    totalQtyNode != null ? (
      totalQtyNode
    ) : totalQty != null ? (
      `${Number(totalQty).toLocaleString()} ${unit}`
    ) : (
      "—"
    );

  return (
    <div className="p-2 lg:p-3 space-y-2 lg:space-y-3">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
          <Box className="w-3.5 h-3.5 shrink-0 text-blue-600" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Item Details</span>
        </div>
        <div className="p-3 lg:p-4 space-y-2 lg:space-y-2.5">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Item Code</p>
            <p className="text-[12px] font-black text-blue-600 leading-none truncate">{itemCode || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Description</p>
            <p className="text-[11px] font-medium text-slate-600 leading-tight line-clamp-2">{itemDesc || "—"}</p>
          </div>
        </div>
      </div>

      {supplierSelect ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
            <User className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Supplier</span>
          </div>
          <div className="p-3 lg:p-4">{supplierSelect}</div>
        </div>
      ) : showSupplier ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
            <User className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Supplier</span>
          </div>
          <div className="p-3 lg:p-4 space-y-2">
            <p className="text-[12px] font-bold text-slate-700 uppercase break-words">{supplierName || "—"}</p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Bill No.</p>
                <p className="text-[11px] font-mono font-bold text-slate-700 break-all">{billNo || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Bill Date</p>
                <p className="text-[11px] font-mono font-bold text-slate-700">{formatDocDate(billDt) || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
          <ClipboardList className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{coilInfoTitle}</span>
        </div>
        <div className="p-3 lg:p-4 grid grid-cols-2 gap-3 text-[11px]">
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Heat No.</p>
            {!readOnly && typeof onHeatNoChange === "function" ? (
              <input
                type="text"
                className={`mt-0.5 ${heatControlClass}`}
                value={heatNo}
                onChange={(e) => onHeatNoChange(sanitizeStockAdjustmentHeatNo(e.target.value))}
                placeholder="Enter heat number"
                autoCapitalize="characters"
                spellCheck={false}
              />
            ) : (
              <p className="font-bold text-slate-800 font-mono break-all">{heatNo || "—"}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">MRN UID</p>
            <p className="font-bold text-slate-800 font-mono break-all">{mrnUid || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">MRN Date</p>
            <p className="font-bold text-slate-800 font-mono">{formatDocDate(mrnDt) || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Unit</p>
            <p className="font-bold text-slate-800">{unit}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Coils</p>
            <p className="font-black tabular-nums text-slate-800">{coilCountText}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase">{totalQtyLabel}</p>
            <p className="font-black tabular-nums text-slate-800">{totalQtyContent}</p>
          </div>
        </div>
      </div>

      {footerSlot}

      {showDocuments && documentsSlot ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
            <FileText className="w-3.5 h-3.5 shrink-0 text-indigo-600" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Documents</span>
          </div>
          <div className="p-3 lg:p-4 grid grid-cols-1 gap-2">{documentsSlot}</div>
        </div>
      ) : showDocuments && documents?.length ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
            <FileText className="w-3.5 h-3.5 shrink-0 text-indigo-600" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Documents</span>
          </div>
          <div className="p-3 lg:p-4 space-y-2">
            {documents.map((doc) => (
              <div key={doc.label} className="text-[11px]">
                <span className={FIELD_LABEL}>{doc.label}</span>
                {doc.url ? (
                  <FilePreviewLink
                    href={doc.url}
                    fileName={doc.name || doc.label}
                    className="text-indigo-700 font-medium hover:underline truncate block"
                  >
                    {doc.name || doc.label}
                  </FilePreviewLink>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
