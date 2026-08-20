"use client";

import { Layers, Printer } from "lucide-react";

/** Prevent mouse wheel from changing number inputs while scrolling (MRN sticker breakdown pattern). */
const preventNumberInputWheel = (e) => {
  e.preventDefault();
};

/** RM Store Add (+) coil breakdown — same table feel as MRN Portal `MrnStickerModal` breakdown. */
export default function RmAddCoilBreakdownTable({
  rows = [],
  mrnNo = "",
  mrnUid = "",
  totalQty = 0,
  editMode = false,
  viewMode = false,
  savedView = false,
  allowRemove = true,
  removeUids = new Set(),
  onToggleRemove,
  coilQtys = [],
  onCoilQtyChange,
  canPrintStickers = false,
  emptyHint = "",
  unit = "KG",
}) {
  const list = Array.isArray(rows) ? rows : [];
  const n = list.length;
  const removeSet = removeUids instanceof Set ? removeUids : new Set();
  const showRemoveColumn = editMode && allowRemove;
  const markedRemove = showRemoveColumn
    ? list.filter((r) => r.is_saved && removeSet.has(String(r.coil_no_uid))).length
    : 0;
  const isPreview = !savedView && !viewMode && !editMode;

  return (
    <div className="w-full min-w-0 flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      {editMode && showRemoveColumn ? (
        <div className="shrink-0 px-3 py-1.5 lg:px-4 bg-amber-50/80 border-b border-amber-100 text-[8px] font-semibold text-amber-900 leading-snug">
          Use <span className="font-bold">Add more</span> above to add coils. Select{" "}
          <span className="font-bold">Remove</span> on saved rows to delete them from the database.
          {markedRemove > 0 ? (
            <span className="ml-1 text-rose-700 font-bold">({markedRemove} marked)</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden p-0 lg:p-1 overscroll-contain [-webkit-overflow-scrolling:touch]">
        {!n ? (
          <div className="bg-white border border-slate-200 px-3 py-8 text-center text-slate-400">
            <Layers size={20} className="opacity-20 mx-auto mb-1" aria-hidden />
            <span className="text-[10px] lg:text-xs font-bold uppercase tracking-wide px-1">
              {emptyHint ||
                (editMode
                  ? "Saved coils appear here — select Remove or use Add more above"
                  : "Enter number of coils and quantities — the breakdown will appear here")}
            </span>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 overflow-hidden w-full">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-[30] bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-600 border-r border-slate-200 whitespace-nowrap"
                    >
                      #
                    </th>
                    {showRemoveColumn ? (
                      <th
                        scope="col"
                        className="sticky left-[2.25rem] top-0 z-[30] bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-rose-600 border-r border-slate-200 whitespace-nowrap"
                      >
                        Remove
                      </th>
                    ) : null}
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Coil
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      MRN UID
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 whitespace-nowrap"
                    >
                      Status
                    </th>
                    {canPrintStickers ? (
                      <th
                        scope="col"
                        className="sticky right-0 top-0 z-[30] bg-slate-50 px-2 py-1.5 lg:px-3 lg:py-2.5 text-[9px] lg:text-[11px] font-black uppercase text-slate-500 text-right border-l border-slate-200 whitespace-nowrap"
                      >
                        Action
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, idx) => {
                    const isMarkedRemove =
                      showRemoveColumn && r.is_saved && removeSet.has(String(r.coil_no_uid));
                    const coilUid = String(r.coil_no_uid || "");
                    const rowMrnUid = String(r.mrn_uid ?? mrnUid ?? "—");
                    const inStock = r.generated || r.is_saved || savedView;
                    return (
                      <tr
                        key={`${coilUid}-${r.idx ?? idx}`}
                        className={`group border-b border-slate-100 hover:bg-slate-50/70 ${
                          isMarkedRemove ? "bg-rose-50/60" : r.is_new ? "bg-emerald-50/20" : ""
                        }`}
                      >
                        <td className="sticky left-0 z-10 px-2 py-1.5 lg:px-3 text-[10px] lg:text-[13px] font-bold text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-100 tabular-nums align-middle">
                          {r.idx ?? idx + 1}
                        </td>
                        {showRemoveColumn ? (
                          <td className="sticky left-[2.25rem] z-10 px-2 py-1.5 lg:px-3 bg-white group-hover:bg-slate-50 border-r border-slate-100 align-middle">
                            {r.is_saved ? (
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isMarkedRemove}
                                  onChange={() => onToggleRemove?.(r.coil_no_uid)}
                                  className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-200"
                                  aria-label={`Remove coil ${coilUid}`}
                                />
                                <span className="text-[8px] font-bold uppercase text-rose-700">Remove</span>
                              </label>
                            ) : (
                              <span className="text-[8px] text-slate-400">—</span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-2 py-1.5 lg:px-3 text-[10px] lg:text-xs font-bold min-w-0 max-w-[200px] lg:max-w-[240px] align-middle">
                          <div className="flex flex-col leading-snug min-w-0">
                            <span
                              className={`break-all font-bold ${
                                inStock || r.generated ? "text-blue-700" : "text-slate-900"
                              }`}
                              title={coilUid}
                            >
                              {coilUid}
                            </span>
                            {r.total_coils ? (
                              <span className="text-[8px] text-slate-400 uppercase font-bold truncate">
                                Coil {r.coil_index ?? r.idx} / {r.total_coils}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 text-[10px] lg:text-[13px] font-bold text-indigo-700 font-mono tabular-nums whitespace-nowrap align-middle">
                          <span title={rowMrnUid}>{rowMrnUid}</span>
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 align-middle">
                          {r.editable ? (
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={coilQtys[r.idx - 1] ?? ""}
                              onChange={(e) => onCoilQtyChange?.(r.idx - 1, e.target.value)}
                              onWheel={preventNumberInputWheel}
                              className="w-24 h-8 border border-slate-300 px-2 text-[11px] font-bold tabular-nums rounded bg-white !text-slate-900 placeholder:text-slate-400"
                            />
                          ) : (
                            <span className="text-[10px] lg:text-[13px] font-bold text-slate-900 tabular-nums whitespace-nowrap">
                              {Number(r.qty).toLocaleString()} {unit}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 lg:px-3 align-middle">
                          <span
                            className={`text-[9px] lg:text-[12px] font-bold uppercase whitespace-nowrap ${
                              isMarkedRemove
                                ? "text-rose-600"
                                : inStock
                                  ? "text-emerald-600"
                                  : r.preview || isPreview
                                    ? "text-slate-400 italic normal-case"
                                    : r.is_new
                                      ? "text-blue-600"
                                      : "text-slate-500"
                            }`}
                          >
                            {isMarkedRemove
                              ? "Will remove"
                              : inStock
                                ? "In stock"
                                : r.preview || isPreview
                                  ? "Ready"
                                  : r.is_new
                                    ? "New"
                                    : "—"}
                          </span>
                        </td>
                        {canPrintStickers ? (
                          <td className="sticky right-0 z-10 py-1 px-2 text-right bg-white group-hover:bg-slate-50 border-l border-slate-100 align-middle">
                            {r.generated ? (
                              <span
                                className="inline-flex items-center justify-center text-slate-400"
                                title="Print stickers from the list page (Ctrl+P)"
                              >
                                <Printer className="w-4 h-4 shrink-0" strokeWidth={2.25} aria-hidden />
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-300 font-bold">—</span>
                            )}
                          </td>
                        ) : null}
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
}
