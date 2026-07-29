"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Drawer from "@/ui/primitives/Drawer";
import { formatDateTime, formatDocDate } from "@/platform/utils/core/utilHelper";
import { schedulePlanningService } from "@/apps/ims/lib/services/schedulePlanning";
import { formatTxnTargetDates, formatSchHeaderDate } from "./schedulePlanningColumns";
import { IMS_MODAL_LABEL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CLOSE } from "../../lib/helpers/masterListUi";

function actionBadgeClass(actionType) {
  const t = String(actionType || "").toLowerCase();
  if (t === "plan") return "bg-cyan-50 text-cyan-700 border-cyan-200";
  if (t === "hold") return "bg-orange-50 text-orange-700 border-orange-200";
  if (t === "reject") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function MetaField({ label, value }) {
  return (
    <span>
      <span className={`${IMS_MODAL_LABEL} mr-1`}>{label}</span>
      <span className={IMS_TABLE_CELL_TEXT}>{value ?? "—"}</span>
    </span>
  );
}

export default function SchedulePlanHistoryModal({ open, onClose, item, stackLevel = 0 }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open || !item?.schno || item?.itemdcode == null) {
      setRows([]);
      return;
    }
    setLoading(true);
    void schedulePlanningService
      .transactions({ schno: item.schno, itemdcode: item.itemdcode })
      .then((res) => setRows(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open, item?.schno, item?.itemdcode]);

  if (!open || !item) return null;

  const title = `History — Sch ${item.schno} · ${item.item_code || item.itemdcode}`;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-4xl"
      stackLevel={stackLevel}
      footer={(
        <div className={IMS_DRAWER_FOOTER_WRAP}>
          <button type="button" onClick={onClose} className={IMS_DRAWER_BTN_CLOSE}>
            Close
          </button>
        </div>
      )}
    >
      <div className="space-y-3 pb-2">
        <div className="flex flex-wrap gap-x-4 gap-y-2 border border-slate-200 bg-slate-50 p-2.5">
          <MetaField label="Sch" value={item.schno} />
          <MetaField label="Item" value={item.item_code} />
          <span className="min-w-0 flex-1">
            <MetaField label="Party" value={item.acc_name} />
          </span>
          <MetaField label="Date" value={formatSchHeaderDate(item.schdt)} />
        </div>
        {item.itemdesc ? (
          <p className={`${IMS_TABLE_CELL_TEXT} text-slate-800 pl-1 break-words`}>{item.itemdesc}</p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-600 gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[11px] font-bold uppercase">Loading history...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className={`text-center py-10 ${IMS_TABLE_CELL_TEXT} text-slate-600`}>No transaction history yet</div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.txn_id} className="border border-slate-200 bg-white p-2.5">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase border ${actionBadgeClass(row.action_type)}`}>
                    {row.action_label || row.action_type}
                  </span>
                  <span className={IMS_TABLE_CELL_DATE}>{formatDateTime(row.created_at)}</span>
                  <span className={IMS_TABLE_CELL_TEXT}>
                    {row.from_status_label || "—"} → {row.to_status_label || "—"}
                  </span>
                  <span className={`${IMS_TABLE_CELL_TEXT} text-slate-800 uppercase ml-auto`}>{row.created_by_name || "—"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {(row.action_date || row.action_reason) ? (
                    <div>
                      <span className={`${IMS_MODAL_LABEL} block mb-0.5`}>Date / Reason</span>
                      <p className={`${IMS_TABLE_CELL_TEXT} text-slate-800 break-words`}>
                        {row.action_date ? formatDocDate(row.action_date) : "—"}
                        {row.action_reason ? ` · ${row.action_reason}` : ""}
                      </p>
                    </div>
                  ) : null}
                  {row.remark ? (
                    <div>
                      <span className={`${IMS_MODAL_LABEL} block mb-0.5`}>Remark</span>
                      <p className={`${IMS_TABLE_CELL_TEXT} text-slate-800 break-words`}>{row.remark}</p>
                    </div>
                  ) : null}
                  <div className={row.remark && !(row.action_date || row.action_reason) ? "" : "sm:col-span-2"}>
                    <span className={`${IMS_MODAL_LABEL} block mb-0.5`}>Details</span>
                    <p className={`${IMS_TABLE_CELL_TEXT} text-slate-800 break-words`}>
                      {formatTxnTargetDates(null, row.action_type, row)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
