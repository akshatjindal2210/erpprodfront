"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { schedulePlanningService } from "@/apps/ims/lib/services/schedulePlanning";
import { formatSchHeaderDate, scheduleItemRowKey } from "./schedulePlanningColumns";
import { IMS_MODAL_LABEL, IMS_TABLE_CELL_NUMBER, IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_AMBER } from "../../lib/helpers/masterListUi";

const INPUT =
  "h-8 px-2 text-[11px] text-slate-800 border border-slate-300 rounded-none focus:border-indigo-500 outline-none bg-white w-full";

const TH = "px-2 py-1.5 text-[10px] font-bold uppercase text-slate-700 bg-slate-100 border-b border-r border-slate-200 align-middle";
const TH_CENTER = `${TH} text-center`;
const TH_CTRL = "px-1.5 py-1.5 text-[10px] font-bold uppercase text-slate-700 bg-slate-100 border-b border-r border-slate-200 align-top";

function hasShortage(row) {
  return Boolean(String(row?.shortage_no ?? "").trim());
}

function buildRowState(row) {
  const originalQty = Number(row?.totalqty ?? row?.total_qty ?? 0);
  const locked = hasShortage(row);
  const savedRemark = String(row?.item_remark ?? "").trim();
  return {
    key: scheduleItemRowKey(row),
    row,
    originalQty,
    locked,
    qty: locked ? "" : String(originalQty || ""),
    remark: savedRemark,
  };
}

export default function ScheduleShortageModal({
  open,
  onClose,
  item = null,
  items = null,
  onSaved,
  stackLevel = 1,
}) {
  const bulkItems = useMemo(() => {
    if (Array.isArray(items) && items.length) return items;
    if (item) return [item];
    return [];
  }, [item, items]);

  const isBulk = bulkItems.length > 1;
  const [rows, setRows] = useState([]);
  const [globalRemark, setGlobalRemark] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGlobalRemark("");
    setRows(bulkItems.map(buildRowState));
  }, [open, bulkItems]);

  if (!open || !bulkItems.length) return null;

  const setRowField = (key, field, value) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async () => {
    const toSubmit = rows.filter((r) => !r.locked);
    if (!toSubmit.length) {
      toast.error("Shortage already recorded for all items.");
      return;
    }

    const payloads = [];
    for (const r of toSubmit) {
      const shortageQty = Number(r.qty);
      if (!Number.isFinite(shortageQty) || shortageQty < 0) {
        toast.error(`Enter a valid shortage qty for ${r.row.item_code || r.row.itemdcode}.`);
        return;
      }
      const remark = String(r.remark || globalRemark || "").trim();
      payloads.push({
        key: r.key,
        body: {
          schno: r.row.schno,
          itemdcode: r.row.itemdcode,
          item_code: r.row.item_code,
          itemdesc: r.row.itemdesc,
          schmonth: r.row.schmonth,
          schdt: r.row.schdt,
          acc_code: r.row.acc_code,
          acc_name: r.row.acc_name,
          original_qty: r.originalQty,
          shortage_qty: shortageQty,
          item_remark: remark || null,
        },
      });
    }

    setSaving(true);
    let ok = 0;
    let fail = 0;
    const savedByKey = {};
    try {
      for (const { key, body } of payloads) {
        try {
          const res = await schedulePlanningService.shortage(body);
          if (res?.success === false) {
            fail += 1;
            toast.error(res?.message || `Shortage failed for ${body.item_code || body.itemdcode}.`);
            continue;
          }
          ok += 1;
          const shortageNo = res?.data?.shortage_no ?? res?.data?.id ?? null;
          const savedRemark = String(res?.data?.item_remark ?? body.item_remark ?? "").trim();
          savedByKey[key] = {
            shortage_no: shortageNo,
            item_remark: savedRemark || null,
          };
        } catch (err) {
          fail += 1;
          toast.error(err?.message || `Shortage failed for ${body.item_code || body.itemdcode}.`);
        }
      }

      if (ok > 0) {
        toast.success(
          fail > 0
            ? `Shortage saved for ${ok} item(s); ${fail} failed.`
            : isBulk
              ? `Shortage saved for ${ok} item(s).`
              : "Shortage submitted successfully."
        );
        onSaved?.(savedByKey);
        if (fail === 0) onClose?.();
        else {
          setRows((prev) =>
            prev.map((r) => {
              const saved = savedByKey[r.key];
              if (!saved?.shortage_no) return r;
              const remark = String(saved.item_remark ?? r.remark ?? "").trim();
              return {
                ...r,
                locked: true,
                qty: "",
                remark,
                row: {
                  ...r.row,
                  shortage_no: String(saved.shortage_no),
                  item_remark: remark || r.row.item_remark || null,
                },
              };
            })
          );
        }
      } else if (fail > 0) {
        toast.error("Could not submit shortage.");
      }
    } finally {
      setSaving(false);
    }
  };

  const headerItem = bulkItems[0];
  const editableCount = rows.filter((r) => !r.locked).length;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={isBulk ? "Create Shortage (All Items)" : "Create Shortage"}
      maxWidth={isBulk ? "max-w-3xl" : "max-w-md"}
      stackLevel={stackLevel}
      footer={(
        <div className={IMS_DRAWER_FOOTER_WRAP}>
          <button type="button" onClick={onClose} disabled={saving} className={IMS_DRAWER_BTN_CANCEL}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || editableCount === 0}
            className={IMS_DRAWER_BTN_AMBER}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Save size={18} />
                {isBulk ? `Submit (${editableCount})` : "Submit"}
              </>
            )}
          </button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 border border-slate-200 bg-slate-50 p-3">
          <div>
            <span className={`${IMS_MODAL_LABEL} block`}>Sch No</span>
            <span className={IMS_TABLE_CELL_TEXT}>{headerItem.schno ?? "—"}</span>
          </div>
          <div>
            <span className={`${IMS_MODAL_LABEL} block`}>Party</span>
            <span className={`${IMS_TABLE_CELL_TEXT} break-words`}>{headerItem.acc_name || "—"}</span>
          </div>
          <div>
            <span className={`${IMS_MODAL_LABEL} block`}>Schedule Date</span>
            <span className={IMS_TABLE_CELL_TEXT}>{formatSchHeaderDate(headerItem.schdt)}</span>
          </div>
          {!isBulk ? (
            <div>
              <span className={`${IMS_MODAL_LABEL} block`}>Schedule Qty</span>
              <span className={IMS_TABLE_CELL_NUMBER}>
                {Number(headerItem.totalqty ?? headerItem.total_qty ?? 0).toLocaleString()}
              </span>
            </div>
          ) : (
            <div>
              <span className={`${IMS_MODAL_LABEL} block`}>Items</span>
              <span className={IMS_TABLE_CELL_NUMBER}>{bulkItems.length}</span>
            </div>
          )}
        </div>

        {isBulk ? (
          <div className="border border-slate-200 overflow-x-auto max-h-[min(50vh,420px)] overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr>
                  <th className={TH}>Item</th>
                  <th className={`${TH_CENTER} w-[80px]`}>Qty</th>
                  <th className={`${TH} w-[110px]`}>Shortage Qty</th>
                  <th className={`${TH_CTRL} min-w-[140px]`}>
                    <span className="block px-0.5 pb-1">Remark</span>
                    <input
                      type="text"
                      value={globalRemark}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGlobalRemark(v);
                        setRows((prev) =>
                          prev.map((r) => (r.locked ? r : { ...r, remark: v }))
                        );
                      }}
                      placeholder="Apply remark to all..."
                      className={INPUT}
                      disabled={saving || editableCount === 0}
                    />
                  </th>
                  <th className={`${TH} w-[120px] border-r-0`}>Shortage No</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const shownRemark = String(r.remark || r.row.item_remark || "").trim();
                  return (
                    <tr key={r.key} className={r.locked ? "bg-slate-50/80" : "bg-white"}>
                      <td className="px-2 py-1.5 border-b border-r border-slate-100 align-top">
                        <div className="font-bold text-[10px] uppercase text-slate-900">{r.row.item_code || "—"}</div>
                        {r.row.itemdesc ? (
                          <div className={`${IMS_TABLE_CELL_TEXT} text-slate-600 break-words`}>{r.row.itemdesc}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 border-b border-r border-slate-100 text-center align-top">
                        <span className={IMS_TABLE_CELL_NUMBER}>{r.originalQty.toLocaleString()}</span>
                      </td>
                      <td className="px-1.5 py-1 border-b border-r border-slate-100 align-top">
                        {r.locked ? (
                          <span className="text-[10px] font-bold uppercase text-slate-400">Done</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={r.qty}
                            onChange={(e) => setRowField(r.key, "qty", e.target.value)}
                            className={INPUT}
                            disabled={saving}
                          />
                        )}
                      </td>
                      <td className="px-1.5 py-1 border-b border-r border-slate-100 align-top">
                        {r.locked ? (
                          <span className={`${IMS_TABLE_CELL_TEXT} text-slate-700 break-words`}>
                            {shownRemark || "—"}
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={r.remark}
                            onChange={(e) => setRowField(r.key, "remark", e.target.value)}
                            placeholder="Optional..."
                            className={INPUT}
                            disabled={saving}
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5 border-b border-slate-100 align-top">
                        <span className="text-[10px] font-bold text-amber-800 tabular-nums">
                          {r.row.shortage_no || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {headerItem.itemdesc ? (
              <p className={`${IMS_TABLE_CELL_TEXT} text-slate-800 border-l-2 border-slate-300 pl-2 break-words`}>
                {headerItem.itemdesc}
              </p>
            ) : null}

            {hasShortage(headerItem) ? (
              <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 space-y-1">
                <div>
                  Shortage already recorded — No: <strong>{headerItem.shortage_no}</strong>
                </div>
                {String(headerItem.item_remark || rows[0]?.remark || "").trim() ? (
                  <div>
                    Remark: <strong>{String(headerItem.item_remark || rows[0]?.remark).trim()}</strong>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div>
                  <label className={`${IMS_MODAL_LABEL} block mb-1`}>Shortage Qty</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={rows[0]?.qty ?? ""}
                    onChange={(e) => setRowField(rows[0].key, "qty", e.target.value)}
                    className={INPUT}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className={`${IMS_MODAL_LABEL} block mb-1`}>Remark</label>
                  <input
                    type="text"
                    value={rows[0]?.remark ?? ""}
                    onChange={(e) => setRowField(rows[0].key, "remark", e.target.value)}
                    placeholder="Optional remark..."
                    className={INPUT}
                    disabled={saving}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
