"use client";

import { Box, Layers, User, ClipboardList, RefreshCw, CheckCircle2 } from "lucide-react";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import { fetchItemScopedLedgerById } from "@/features/apps/ims/helpers/packingEntryCustomerSelect";
import { masterService } from "@/features/apps/ims/services/master";
import { formatDocDate } from "@/core/utils/utilHelper";

export default function StockAdjustmentStickerDetailCards({
  selectedRow,
  packing,
  onCustomerChange,
  customerSelectDisabled,
  customerChanging,
  hideCustomerSection = false,
  minusCustomerLines = null,
  minusViewMode = false,
  categories = [],
  selectedCategoryId = "",
  onCategoryChange,
  categorySelectDisabled = false,
  categoryError = "",
}) {
  const row = selectedRow || {};
  const p = packing || {};
  const categoryLabel =
    categories.find((c) => String(c.id) === String(selectedCategoryId))?.name ||
    (selectedCategoryId ? `Category #${selectedCategoryId}` : null) ||
    row.category ||
    row.type_name ||
    "—";
  const showCategorySelect = !categorySelectDisabled && !minusViewMode;

  const itemCode = row.item_code ?? "—";
  const itemDesc = row.itemdesc || row.description || row.item_desc || "—";

  return (
    <div className="p-2 lg:p-3 space-y-2 lg:space-y-3">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
          <Box className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-blue-600" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Item Details</span>
        </div>
        <div className="p-3 lg:p-4 space-y-2 lg:space-y-2.5">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Item Code</p>
              <p className="text-[12px] font-black text-blue-600 leading-none truncate">{itemCode}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Description</p>
            <p className="text-[11px] font-medium text-slate-600 leading-tight line-clamp-2">{itemDesc}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-amber-200 rounded-lg shadow-sm">
        <div className="bg-amber-50/50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-amber-100 flex items-center gap-2 rounded-t-lg">
          <Layers className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-amber-600" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Packing Category</span>
        </div>
        <div className="p-3 lg:p-4 space-y-2 lg:space-y-2.5">
          {showCategorySelect ? (
            <div className="space-y-1" data-field="category">
              <label className="text-[10px] font-bold text-amber-700 uppercase tracking-tighter">
                Select category *
              </label>
              <select
                value={String(selectedCategoryId ?? "")}
                onChange={(e) => onCategoryChange?.(e.target.value)}
                className={`w-full text-[11px] h-[36px] rounded-lg border bg-white px-2 font-bold text-slate-700 ${
                  categoryError ? "border-rose-400" : "border-amber-200"
                }`}
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {categoryError ? (
                <p className="text-[10px] font-bold text-rose-600">{categoryError}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border border-slate-100">
              <span className="text-[12px] font-black text-slate-700 uppercase tracking-tight">{categoryLabel}</span>
              <CheckCircle2 className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] text-emerald-500 shrink-0" aria-hidden />
            </div>
          )}
          {!showCategorySelect ? (
            <div className="flex justify-between items-center text-[10px] text-amber-600 font-bold italic">
              <span className="text-slate-400 font-bold normal-case">Read-only</span>
            </div>
          ) : null}
        </div>
      </div>

      {!hideCustomerSection ? (
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
          <User className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-500" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Customer</span>
        </div>
        <div className="p-3 lg:p-4 space-y-3">
          {minusViewMode || (Array.isArray(minusCustomerLines) && minusCustomerLines.length > 0) ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                Customers (from selected boxes)
              </p>
              {!(Array.isArray(minusCustomerLines) && minusCustomerLines.length > 0) ? (
                <p className="text-[11px] text-slate-400 italic">—</p>
              ) : null}
              {(Array.isArray(minusCustomerLines) ? minusCustomerLines : []).map((line, idx) => (
                <div
                  key={`${line.acc_code ?? "c"}-${idx}`}
                  className="rounded border border-slate-100 bg-slate-50/80 px-2.5 py-2 space-y-0.5"
                >
                  <p
                    className="text-[11px] font-bold text-slate-700 uppercase leading-snug break-words"
                    title={line.acc_name || line.acc_code || ""}
                  >
                    {line.acc_name || line.acc_code || "—"}
                  </p>
                  <p className="text-[10px] font-black text-rose-600 tabular-nums">
                    −{Number(line.qty || 0).toLocaleString()} PCS
                    {line.box_count > 0 ? (
                      <span className="text-[9px] font-bold text-slate-400 ml-1">
                        ({line.box_count} box)
                      </span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          ) : (
          <>
          {!customerSelectDisabled ? (
            <div className={`min-w-0 ${customerChanging ? "opacity-60 pointer-events-none" : ""}`}>
              <SearchableSelect
                label="Customer"
                value={row.acc_code || ""}
                onChange={onCustomerChange}
                fetchService={(params) =>
                  masterService.getLedgersViews({
                    ...params,
                    permission_module: "stock_adjustment",
                    permission_action: "view",
                    itemdcode: row.itemdcode || undefined,
                  })
                }
                getByIdService={(id) =>
                  fetchItemScopedLedgerById(
                    id,
                    {
                      permission_module: "stock_adjustment",
                      permission_action: "view",
                      itemdcode: row.itemdcode || undefined,
                    },
                    row
                  )
                }
                dataKey="id"
                labelKey="acc_name"
                labelOnlyDisplay
                placeholder={row.itemdcode ? "Search customer…" : "Item required"}
                disabled={!row.itemdcode}
                usePortal={false}
              />
            </div>
          ) : null}

          <div className={`space-y-2 ${!customerSelectDisabled ? "pt-2 border-t border-slate-100" : ""}`}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
              {customerSelectDisabled ? "Customer" : "Selected customer"}
            </p>
            {row.acc_code ? (
              <>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Name</p>
                  <p
                    className="text-[12px] font-bold text-slate-700 leading-snug whitespace-normal break-words"
                    title={row.acc_name}
                  >
                    {row.acc_name?.trim() ? row.acc_name : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    Cust. code / narration
                  </p>
                  <p
                    className="text-[12px] font-bold text-slate-700 leading-snug break-words"
                    title={row.party_rate_cust_code}
                  >
                    {customerChanging ? (
                      <span className="text-slate-400 italic font-medium">Loading…</span>
                    ) : row.party_rate_cust_code?.trim() ? (
                      row.party_rate_cust_code
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-400 italic">Select a customer above.</p>
            )}
          </div>
          </>
          )}
        </div>
      </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="bg-slate-50 px-3 py-1.5 lg:px-4 lg:py-2 border-b border-slate-200 flex items-center gap-2 rounded-t-lg">
          <ClipboardList className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] shrink-0 text-slate-500" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Production Info</span>
        </div>
        <div className="p-3 lg:p-4 grid grid-cols-2 gap-x-3 gap-y-2 lg:gap-y-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Job Card</p>
            <p className="text-[11px] font-bold text-slate-700">{row.job_card_no || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Total Qty</p>
            <p className="text-[11px] font-bold text-slate-700">
              {Number(row.total_qty ?? 0).toLocaleString()}{" "}
              <span className="text-[9px] opacity-60">{row.unit || "PCS"}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Doc Date</p>
            <p className="text-[11px] font-bold text-slate-700">
              {formatDocDate(row.doc_dt) || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Doc No.</p>
            <p className="text-[11px] font-bold text-slate-700 truncate">{row.doc_no || "—"}</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50/30 border border-blue-200 rounded-lg shadow-sm">
        <div className="bg-blue-600 px-3 py-1.5 lg:px-4 lg:py-2 flex items-center gap-2 rounded-t-lg">
          <RefreshCw className="w-3.5 h-3.5 lg:w-[18px] lg:h-[18px] text-white shrink-0" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white">Breakdown Summary</span>
        </div>
        <div className="p-3 lg:p-4 space-y-2 lg:space-y-2.5">
          <div className="flex justify-between items-center border-b border-blue-100 pb-1.5">
            <span className="text-[11px] lg:text-[13px] font-bold text-blue-800 uppercase">Qty / Box</span>
            <span className="text-[13px] font-black text-blue-700 tabular-nums">
              {p.qty_per_box ?? 0}{" "}
              <span className="text-[10px] opacity-60 uppercase">{row.unit || "PCS"}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 lg:gap-3">
            <div className="bg-white border border-blue-100 rounded p-1.5 lg:p-3 text-center">
              <p className="text-base font-black text-blue-600 leading-none">{p.full_boxes_count ?? 0}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Full Boxes</p>
            </div>
            <div className="bg-white border border-orange-100 rounded p-1.5 lg:p-3 text-center">
              <p className="text-base font-black text-orange-600 leading-none">
                {(p.loose_box_qty ?? 0) > 0 ? 1 : 0}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Loose Box</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
