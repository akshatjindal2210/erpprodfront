"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import { inProcessRequestService } from "@/apps/rmstore/lib/services/inProcessRequest";
import Drawer from "@/ui/primitives/Drawer";
import { OK_INPUT } from "@/ui/common/Constants";
import { coilUidDisplayLabel } from "@/apps/rmstore/lib/helpers/qrScan";
import { IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_FOOTER_WRAP } from "@/apps/ims/lib/helpers/masterListUi";

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 min-w-0">
      <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-none">{label}</div>
      <div className="text-[11px] font-bold text-slate-800 mt-0.5 truncate tabular-nums" title={value != null ? String(value) : ""}>
        {value != null && String(value).trim() !== "" ? value : "—"}
      </div>
    </div>
  );
}

function mapLine(c) {
  const issued = Number(c.original_qty ?? c.qty) || 0;
  const remaining = Number(c.remaining_qty ?? c.qty) || 0;
  return {
    coil_no_uid: c.coil_no_uid,
    original_qty: issued,
    remaining_qty: remaining,
    consumed_qty: Math.max(0, issued - remaining),
    item_code: c.item_code,
    item_desc: c.item_desc,
    heat_no: c.heat_no,
    mrn_uid: c.mrn_uid,
    mrn_no: c.mrn_no,
    out_uid: c.out_uid ?? null,
  };
}

/** Confirm store-in qty on receive — final qty to Unassigned; balance posts to Consume. */
export default function ReceivePendingStoreInModal({ open, iprUid, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ipr, setIpr] = useState(null);
  const [lines, setLines] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!iprUid) return;
    setLoading(true);
    setError("");
    try {
      const res = await inProcessRequestService.getById(iprUid);
      const row = res?.data;
      if (!row?.ipr_uid) {
        setError("Could not load the pending store-in request.");
        setIpr(null);
        setLines([]);
        return;
      }
      const source = row.previous_coils?.length ? row.previous_coils : row.coils;
      setIpr(row);
      setLines((source || []).map(mapLine));
    } catch (err) {
      setError(err?.message || "Could not load the pending store-in request.");
      setIpr(null);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [iprUid]);

  useEffect(() => {
    if (!open) {
      setIpr(null);
      setLines([]);
      setError("");
      return;
    }
    void load();
  }, [open, load]);

  const totals = useMemo(() => {
    let storeIn = 0;
    let consume = 0;
    for (const c of lines) {
      const issued = Number(c.original_qty) || 0;
      const remaining = Number(c.remaining_qty) || 0;
      storeIn += remaining;
      consume += Math.max(0, issued - remaining);
    }
    return { storeIn, consume };
  }, [lines]);

  const onQtyChange = (uid, value) => {
    const raw = value === "" ? NaN : Number(value);
    setLines((prev) =>
      prev.map((c) => {
        if (c.coil_no_uid !== uid) return c;
        const issued = Number(c.original_qty) || 0;
        const remaining = Number.isFinite(raw) ? Math.max(0, Math.min(issued, raw)) : 0;
        return {
          ...c,
          remaining_qty: remaining,
          consumed_qty: Math.max(0, issued - remaining),
        };
      })
    );
    setError("");
  };

  const handleReceive = async () => {
    if (!ipr?.ipr_uid || saving) return;
    for (const c of lines) {
      const issued = Number(c.original_qty) || 0;
      const remaining = Number(c.remaining_qty) || 0;
      if (remaining <= 0 && issued > 0) {
        setError("Store-in qty must be greater than 0.");
        return;
      }
      if (remaining > issued) {
        setError("Store-in qty cannot exceed shop-floor qty.");
        return;
      }
    }

    setSaving(true);
    try {
      const coilPayload = lines.map((c) => ({
        coil_no_uid: c.coil_no_uid,
        qty: c.remaining_qty,
        original_qty: c.original_qty,
        remaining_qty: c.remaining_qty,
        consumed_qty: c.consumed_qty,
        item_code: c.item_code,
        item_desc: c.item_desc,
        heat_no: c.heat_no,
        mrn_uid: c.mrn_uid,
        mrn_no: c.mrn_no,
        out_uid: c.out_uid,
      }));
      const res = await inProcessRequestService.completeStoreIn(ipr.ipr_uid, {
        coils: coilPayload,
        previous_coils: lines.map((c) => ({
          ...c,
          qty: c.original_qty,
        })),
        proposed_coils: coilPayload
          .filter((c) => Number(c.remaining_qty) > 0)
          .map((c) => ({
            coil_no_uid: c.coil_no_uid,
            from_coil_uid: c.coil_no_uid,
            qty: c.remaining_qty,
            item_code: c.item_code,
            item_desc: c.item_desc,
            heat_no: c.heat_no,
            mrn_uid: c.mrn_uid,
            mrn_no: c.mrn_no,
          })),
      });
      toast.success(res?.message || "Received to Unassigned.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not receive the store-in request.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={onClose} disabled={saving} className={IMS_DRAWER_BTN_CLOSE}>
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleReceive()}
        disabled={saving || loading || !lines.length}
        className={IMS_DRAWER_BTN_PRIMARY}
      >
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        Receive
      </button>
    </div>
  );

  const mrn = ipr?.mrn_uid || lines[0]?.mrn_uid || "—";
  const item = ipr?.item_code || lines[0]?.item_code || "—";

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={
        saving || loading || !lines.length ? undefined : () => void handleReceive()
      }
      title={`Receive · IPR #${iprUid || "—"}`}
      description="Enter store-in quantity per coil. Remaining quantity is recorded as consume."
      footer={footer}
      maxWidth="max-w-md"
    >
      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[11px] font-bold uppercase">Loading…</span>
        </div>
      ) : error && !lines.length ? (
        <p className="text-[11px] font-bold text-rose-600">{error}</p>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            <Info label="Source" value="Production Return" />
            <Info label="MRN UID" value={mrn} />
            <Info label="Item" value={item} />
            <Info
              label="Store in / Consume"
              value={`${totals.storeIn.toLocaleString()} / ${totals.consume.toLocaleString()}`}
            />
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Coils</p>
              <p className="text-[9px] font-bold text-slate-400 tabular-nums">{lines.length}</p>
            </div>
            <div className="divide-y divide-slate-100">
              {lines.map((c) => {
                const issued = Number(c.original_qty) || 0;
                const remaining = Number(c.remaining_qty) || 0;
                const consumed = Math.max(0, issued - remaining);
                return (
                  <div key={c.coil_no_uid} className="px-2.5 py-2 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono font-bold text-slate-800 truncate">
                        {coilUidDisplayLabel(c.coil_no_uid)}
                      </p>
                      <p className="text-[8px] font-bold uppercase text-slate-400 mt-0.5">
                        Shop {issued.toLocaleString()}
                        {c.out_uid ? ` · OUT-${c.out_uid}` : ""}
                      </p>
                    </div>
                    <label className="shrink-0 w-[88px]">
                      <span className="text-[7px] font-bold uppercase text-teal-700 block">Store in</span>
                      <input
                        type="number"
                        min={0}
                        max={issued || undefined}
                        step="any"
                        value={Number.isFinite(remaining) ? remaining : ""}
                        onChange={(e) => onQtyChange(c.coil_no_uid, e.target.value)}
                        className={`${OK_INPUT} mt-0.5 h-8 w-full text-[11px] font-bold tabular-nums text-center`}
                      />
                    </label>
                    <div className="shrink-0 w-[56px] text-right">
                      <span className="text-[7px] font-bold uppercase text-amber-700 block">Consume</span>
                      <span className="text-[12px] font-black tabular-nums text-amber-800 leading-8">
                        {consumed.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-[10px] font-bold text-rose-600">{error}</p> : null}
        </div>
      )}
    </Drawer>
  );
}
