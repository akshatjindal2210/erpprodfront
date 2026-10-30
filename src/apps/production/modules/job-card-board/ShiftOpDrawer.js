"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import SelectField from "@/ui/common/forms/SelectField";
import { planService } from "@/apps/production/lib/services/plan";
import { columnQueue, toDateKey, updatePlanLineSchedule, SHIFT_HOURS, jcNeedHours } from "@/apps/production/modules/job-card-board/board";
import { formatDocDate } from "@/platform/utils/core/utilHelper";
import { DrawerSection, DrawerDetailField } from "@/apps/production/modules/shortage/primeItem";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_PRIMARY } from "@/apps/ims/lib/helpers/masterListUi";

const slotKey = (date, shift) => `${date}:${Number(shift)}`;

const fmtHrs = (h) => {
  const n = Math.round((Number(h) || 0) * 10) / 10;
  return `${n}h`;
};

function isJcDone(card) {
  return String(card?.status || "").toLowerCase() === "complete";
}

export default function ShiftOpDrawer({
  slot,
  cards = [],
  shifts = [],
  dateKeys = [],
  occupiedMap = null,
  canAdd = false,
  canEdit = false,
  canDelete = false,
  onClose,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** Multi operators — [{ emp_code, emp_name }, ...] */
  const [operators, setOperators] = useState([]);
  const [jcId, setJcId] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  /** Machine-click: one shift → auto all open week/month dates for that shift. */
  const [pickShift, setPickShift] = useState("");
  const empCodes = operators.map((o) => o.emp_code).filter(Boolean);
  const empName = operators.map((o) => o.emp_name).filter(Boolean).join(", ");

  const maccode = slot?.machineId != null && slot.machineId !== "" ? Number(slot.machineId) : null;
  const machineLabel = slot?.machineLabel || "Machine";
  const machineKey = slot?.machineKey != null ? String(slot.machineKey) : maccode != null ? String(maccode) : "";
  const shiftList = useMemo(() => {
    const raw = Array.isArray(shifts) && shifts.length ? shifts : [{ id: 1, code: "S1", hours: SHIFT_HOURS }];
    return raw.map((s) => ({ ...s, hours: Number(s.hours) > 0 ? Number(s.hours) : SHIFT_HOURS }));
  }, [shifts]);
  const weekDates = Array.isArray(dateKeys) ? dateKeys : [];
  const todayKey = toDateKey(new Date());
  const focusKey =
    slot?.date && slot?.shift != null ? slotKey(toDateKey(slot.date) || slot.date, slot.shift) : null;
  const cellLocked = Boolean(slot?.shiftLocked && focusKey);
  const multiShift = !cellLocked;

  const machineCards = useMemo(() => columnQueue(cards, machineKey), [cards, machineKey]);

  const shiftHrs = (shiftNo) => {
    const meta = shiftList.find((s) => Number(s.id) === Number(shiftNo));
    return meta?.hours || SHIFT_HOURS;
  };
  const occSegs = (occ) => {
    if (!occ) return [];
    if (Array.isArray(occ.segments) && occ.segments.length) return occ.segments;
    return [occ];
  };
  const usedOnOcc = (occ, shiftNo) => {
    const full = shiftHrs(shiftNo);
    const segs = occSegs(occ);
    if (!segs.length) return 0;
    let h = 0;
    for (const s of segs) h += Number(s.hours) > 0 ? Number(s.hours) : full;
    return Math.round(h * 100) / 100;
  };
  const freeOnSlot = (sk) => {
    const sh = Number(String(sk).split(":")[1]);
    const full = shiftHrs(sh);
    const occ = occupiedMap?.get?.(`${machineKey}:${sk}`);
    return Math.max(0, Math.round((full - usedOnOcc(occ, sh)) * 100) / 100);
  };
  const focusOcc = focusKey ? occupiedMap?.get?.(`${machineKey}:${focusKey}`) : null;
  const focusSegs = occSegs(focusOcc);
  const focusFree = focusKey ? freeOnSlot(focusKey) : 0;
  /** Calendar sets intent=edit only when cell is full; partial free → add more hours. */
  const editMode = Boolean(cellLocked && focusKey && focusSegs.length > 0 && slot?.intent === "edit");
  const canWrite = editMode ? canEdit : canAdd;
  const isView = !canWrite;
  /** Hours already attributed to this JC (live FIFO on occupiedMap). */
  const bookedHrs = (jcNo, skipSlots = null) => {
    if (!jcNo || !occupiedMap?.forEach) return 0;
    const prefix = `${machineKey}:`;
    let h = 0;
    occupiedMap.forEach((v, key) => {
      if (!String(key).startsWith(prefix)) return;
      const parts = String(key).split(":");
      const sk = `${parts[1]}:${Number(parts[2])}`;
      if (skipSlots?.has?.(sk)) return;
      const full = shiftHrs(parts[2]);
      for (const seg of occSegs(v)) {
        if (String(seg?.pjobcardno || "") !== String(jcNo)) continue;
        h += Number(seg.hours) > 0 ? Number(seg.hours) : full;
      }
    });
    return Math.round(h * 100) / 100;
  };
  const remainOf = (card) => {
    const need = jcNeedHours(card);
    if (!(need > 0)) return 0;
    return Math.max(0, Math.round((need - bookedHrs(card?.job_card_no)) * 100) / 100);
  };
  const isJcFull = (card) => {
    if (!card || isJcDone(card)) return true;
    const need = jcNeedHours(card);
    return need > 0 && remainOf(card) <= 0.05;
  };
  /**
   * FIFO: only the first incomplete JC on this machine (board column order).
   * Next JC appears only after the first is fully planned / complete.
   * Board reorder / machine change → new first on that machine.
   */
  const fifoJc = useMemo(
    () => machineCards.find((c) => !isJcFull(c)) || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [machineCards, occupiedMap, machineKey, shiftList]
  );
  /** Edit cell: live-attributed JC on this slot, else current board FIFO. */
  const plannedJcNo = editMode
    ? String(focusSegs[0]?.pjobcardno || fifoJc?.job_card_no || "").trim()
    : "";
  const plannedCard = useMemo(() => {
    if (!plannedJcNo) return null;
    return cards.find((c) => String(c.job_card_no || "") === plannedJcNo) || { job_card_no: plannedJcNo, id: plannedJcNo };
  }, [cards, plannedJcNo]);
  const selectedJc = editMode ? plannedCard || fifoJc : fifoJc;

  useEffect(() => {
    const live = editMode ? plannedCard || fifoJc : fifoJc;
    if (!live) {
      if (jcId) setJcId("");
      return;
    }
    if (String(live.id) !== String(jcId)) setJcId(String(live.id));
  }, [editMode, plannedCard, fifoJc, jcId]);

  const needHours = jcNeedHours(selectedJc);
  const minDate = toDateKey(selectedJc?.jobcarddt) || null;

  /** Selected slots count only leftover need (partial last shift). */
  const hrsOf = (set, jcNo, alreadySaved) => {
    let remain = needHours > 0 ? Math.max(0, needHours - (alreadySaved ?? bookedHrs(jcNo))) : Infinity;
    let h = 0;
    for (const k of [...set].sort()) {
      if (!(remain > 0.05)) break;
      const free = freeOnSlot(k);
      if (!(free > 0.05)) continue;
      const take = Math.min(remain, free);
      h += take;
      remain -= take;
    }
    return Math.round(h * 100) / 100;
  };
  const slotTakes = (set, jcNo) => {
    const saved = bookedHrs(jcNo);
    let remain = needHours > 0 ? Math.max(0, needHours - saved) : Infinity;
    const out = [];
    for (const k of [...set].sort()) {
      if (!(remain > 0.05)) break;
      const [date, sh] = String(k).split(":");
      const free = freeOnSlot(k);
      if (!(free > 0.05)) continue;
      const take = Math.min(remain, free);
      out.push({ date, shift: Number(sh), hours_used: Math.round(take * 100) / 100 });
      remain -= take;
    }
    return out;
  };

  const savedHours = bookedHrs(selectedJc?.job_card_no);
  const selectedHours = hrsOf(selected, selectedJc?.job_card_no, savedHours);
  const totalHours = Math.round((savedHours + selectedHours) * 100) / 100;
  const overNeed = needHours > 0 && totalHours > needHours + 0.05;
  const remainHours = needHours > 0 ? Math.max(0, Math.round((needHours - totalHours) * 100) / 100) : 0;
  const dateLocked = (d) => Boolean((minDate && d < minDate) || (todayKey && d < todayKey));
  const planDates = useMemo(
    () => weekDates.filter((d) => !dateLocked(d)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekDates, minDate, todayKey]
  );

  /** Machine mode: one shift × all open dates in week/month (JC onward). */
  useEffect(() => {
    if (!multiShift || editMode) return;
    const next = new Set();
    const sh = Number(pickShift);
    if (Number.isFinite(sh) && sh >= 1) {
      for (const d of planDates) {
        const k = slotKey(d, sh);
        if (freeOnSlot(k) > 0.05) next.add(k);
      }
    }
    setSelected(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiShift, editMode, pickShift, planDates, occupiedMap, machineKey, shiftList]);

  useEffect(() => {
    let cancelled = false;
    const queue = columnQueue(cards, machineKey);
    const pickOpen = () =>
      queue.find((c) => !isJcFull(c)) || null;
    const open = pickOpen();
    setJcId(open ? String(open.id) : "");
    const focusSk =
      slot?.date && slot?.shift != null ? slotKey(toDateKey(slot.date) || slot.date, slot.shift) : null;
    const focusFreeLocal = focusSk ? freeOnSlot(focusSk) : 0;
    const wantEdit = slot?.intent === "edit";

    if (!maccode || !slot?.date) {
      setLoading(false);
      setOperators([]);
      setSelected(new Set());
      return undefined;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await planService.getShiftOp({
          maccode,
          date: slot.date,
          shift: Number(slot.shift) || 1,
        });
        if (cancelled) return;
        const row = res?.data;
        const segs = Array.isArray(row?.segments) ? row.segments : row ? [row] : [];
        const editing = wantEdit && segs.length > 0;
        if (editing) {
          const ops = [];
          const seen = new Set();
          for (const s of segs) {
            const codes = String(s?.e || s?.emp_code || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            const names = String(s?.n || s?.emp_name || "")
              .split(",")
              .map((x) => x.trim());
            codes.forEach((code, i) => {
              if (seen.has(code)) return;
              seen.add(code);
              ops.push({ emp_code: code, emp_name: names[i] || names[0] || code });
            });
          }
          setOperators(ops);
          setSelected(new Set());
          const next = pickOpen();
          if (next) setJcId(String(next.id));
        } else {
          const next = pickOpen();
          if (next) setJcId(String(next.id));
          setOperators([]);
          setPickShift("");
          /** Slot click → that shift. Machine click → pick one shift (+ operator). */
          if (slot?.shiftLocked && focusSk && focusFreeLocal > 0.05) {
            setSelected(new Set([focusSk]));
          } else {
            setSelected(new Set());
          }
        }
      } catch (err) {
        if (!cancelled) toast.error(err?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // occupiedMap / cards intentionally omitted — avoid resetting form while drawer is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maccode, slot?.date, slot?.shift, slot?.machineKey, slot?.intent, machineKey]);

  const save = async () => {
    if (saving) return;
    if (!maccode) return toast.error("Select a machine first.");
    if (!operators.length) return toast.error("Select at least one operator.");

    /** Update manpower on this cell (operators / hours) — no JC stored. */
    if (editMode) {
      if (!canEdit) return toast.error("No edit permission.");
      setSaving(true);
      try {
        const rowId = Number(focusSegs[0]?.id);
        const res = await planService.updateShiftOp({
          maccode,
          date: slot.date,
          shift: Number(slot.shift) || 1,
          id: Number.isFinite(rowId) && rowId >= 1 ? rowId : undefined,
          emp_code: empCodes.join(","),
          emp_name: empName || empCodes.join(", "),
        });
        if (res?.success === false) throw new Error(res?.message || "Update failed");
        toast.success(res?.message || "Manpower updated");
        onSaved?.();
        onClose?.();
      } catch (err) {
        toast.error(err?.message || "Failed to update");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!canAdd) return toast.error("No add permission.");
    if (isView) return;
    if (!selectedJc?.job_card_no) return toast.error("No priority job card on this machine.");
    if (isJcDone(selectedJc)) return toast.error("JC already complete — next JC will pick live.");
    if (!selected.size) return toast.error("Select at least one shift.");
    if (overNeed) {
      return toast.error(
        `${selectedJc.job_card_no} need ${fmtHrs(needHours)} — already ${fmtHrs(totalHours)}.`
      );
    }
    if ([...selected].some((k) => dateLocked(String(k).split(":")[0]))) {
      return toast.error("Cannot occupy past / before JC date.");
    }
    setSaving(true);
    try {
      const takes = slotTakes(selected, selectedJc.job_card_no);
      if (!takes.length) {
        setSaving(false);
        return toast.error("No free hours on selected shifts.");
      }
      const slots = takes.map((t) => {
        const meta = shiftList.find((s) => Number(s.id) === Number(t.shift));
        return {
          date: t.date,
          shift: t.shift,
          shift_code: meta?.code || meta?.short || `S${t.shift}`,
          hours_used: t.hours_used,
        };
      });

      const jcLive = String(selectedJc.job_card_no);
      const addH = takes.reduce((n, t) => n + t.hours_used, 0);
      const res = await planService.saveShiftOp({
        maccode,
        emp_code: empCodes.join(","),
        emp_name: empName || empCodes.join(", "),
        slots,
      });
      if (res?.success === false) throw new Error(res?.message || "Save failed");
      if (slots[0]?.date) {
        try {
          await updatePlanLineSchedule(selectedJc, slots[0].date);
        } catch {
          /* optional */
        }
      }
      const leftAfter = needHours > 0 ? Math.max(0, needHours - (savedHours + addH)) : 0;
      toast.success(
        leftAfter > 0.05
          ? `${jcLive} · +${fmtHrs(addH)} · ${fmtHrs(leftAfter)} left`
          : `${jcLive} · manpower complete (${fmtHrs(savedHours + addH)})`
      );
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async () => {
    if (!canDelete || saving || !maccode || !slot?.date) return;
    const jcLabel = plannedJcNo || focusSegs[0]?.pjobcardno || selectedJc?.job_card_no || "manpower";
    if (!window.confirm(`Remove manpower from this shift${jcLabel ? ` (${jcLabel})` : ""}?`)) return;
    setSaving(true);
    try {
      const res = await planService.deleteShiftOp({
        maccode,
        date: slot.date,
        shift: Number(slot.shift) || 1,
      });
      if (res?.success === false) throw new Error(res?.message || "Remove failed");
      toast.success(res?.message || "Manpower removed");
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Failed to remove");
    } finally {
      setSaving(false);
    }
  };

  if (!slot) return null;

  const showWriteFooter = canWrite;
  const showDeleteOnly = !canWrite && canDelete && (editMode || (!multiShift && focusSegs.length > 0));
  const footerDisabled = editMode
    ? !operators.length
    : !operators.length || !selected.size || !selectedJc || overNeed || isJcDone(selectedJc);
  const shiftOptions = shiftList.map((s) => String(s.id));
  const shiftLabelMap = Object.fromEntries(
    shiftList.map((s) => [String(s.id), `${s.code || s.short || `S${s.id}`} · ${fmtHrs(s.hours)}`])
  );

  const opSelect = (
    <SearchableSelect
      multiple
      showTags
      maxVisibleTags={4}
      label="Operator"
      value={empCodes}
      onChange={(_ids, rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setOperators(
          list
            .map((r) => ({
              emp_code: String(r?.emp_code || r?.id || "").trim(),
              emp_name: String(r?.emp_name || "").trim(),
            }))
            .filter((o) => o.emp_code)
        );
      }}
      fetchService={(params) =>
        planService.getEmployeesViews({
          ...params,
          deptname: selectedJc?.process_deptname || undefined,
        })
      }
      getByIdService={(id) => planService.getEmployeesViews({ id })}
      dataKey="emp_code"
      labelKey="emp_code"
      selectedLabelKey="emp_name"
      subLabelKey="emp_name"
      listHintKey="deptname"
      listHintLabel="Dept"
      preserveApiOrder
      disabled={saving}
      required
      placeholder="Search employees…"
    />
  );

  return (
    <Drawer
      isOpen
      onClose={() => !saving && onClose?.()}
      onSubmit={showWriteFooter ? () => void save() : () => onClose?.()}
      title={editMode ? (canEdit ? "Update manpower" : "View manpower") : multiShift ? "Plan machine" : "Plan shift"}
      description={
        multiShift
          ? `${machineLabel} · one shift for ${weekDates.length > 7 ? "month" : "week"}`
          : `${machineLabel} · ${slot.date ? formatDocDate(slot.date) || "—" : "—"} · ${slot.shiftCode || `S${slot.shift}`}`
      }
      maxWidth="max-w-lg"
      footer={
        showWriteFooter ? (
          <div className={IMS_DRAWER_FOOTER_WRAP}>
            <button type="button" onClick={() => !saving && onClose?.()} disabled={saving} className={IMS_DRAWER_BTN_CANCEL}>
              Cancel
            </button>
            {!multiShift && canDelete && (editMode || focusSegs.length > 0) ? (
              <button
                type="button"
                onClick={() => void removePlan()}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || footerDisabled}
              className={IMS_DRAWER_BTN_PRIMARY}
            >
              {saving ? (editMode ? "Updating…" : "Saving…") : editMode ? "Update" : "Save"}
            </button>
          </div>
        ) : showDeleteOnly ? (
          <div className={IMS_DRAWER_FOOTER_WRAP}>
            <button type="button" onClick={() => !saving && onClose?.()} disabled={saving} className={IMS_DRAWER_BTN_CANCEL}>
              Close
            </button>
            <button
              type="button"
              onClick={() => void removePlan()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              {saving ? "Removing…" : "Delete"}
            </button>
          </div>
        ) : (
          <RmStoreDrawerFooter onClose={() => !saving && onClose?.()} loading={false} readOnly canApprove={false} />
        )
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : multiShift && !editMode ? (
        <div className="space-y-3 pb-2">
          <DrawerSection title="Shift" bar="bg-violet-600">
            <div className="space-y-1.5 p-3">
              <SelectField
                label="Shift"
                required
                value={pickShift === "" || pickShift == null ? "" : String(pickShift)}
                onChange={(e) => setPickShift(e.target.value ? Number(e.target.value) : "")}
                options={shiftOptions}
                labelMap={shiftLabelMap}
                placeholder="Select A / B / C…"
                disabled={isView || saving}
              />
              <p className="text-[11px] text-slate-500">
                Operator fills this shift on open {weekDates.length > 7 ? "month" : "week"} dates (from JC).
                {pickShift !== "" && selected.size
                  ? ` · ${selected.size} day${selected.size === 1 ? "" : "s"} · ${fmtHrs(selectedHours)}`
                  : pickShift !== "" && !selected.size
                    ? " · no free days for this shift"
                    : ""}
              </p>
            </div>
          </DrawerSection>

          <DrawerSection title="Operator" bar="bg-emerald-600">
            <div className="p-3">{isView ? null : opSelect}</div>
          </DrawerSection>

          <DrawerSection title="JC details" bar="bg-slate-600">
            <div className="p-3">
              {!selectedJc ? (
                <p className="text-[12px] font-semibold text-slate-400">
                  {!machineCards.length ? "No job card on this machine." : "All job cards fully planned."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <DrawerDetailField label="JC" value={<span className="font-mono font-bold text-indigo-700">{selectedJc.job_card_no}</span>} />
                  <DrawerDetailField label="Item" value={selectedJc.prime_item_code || "—"} />
                  <DrawerDetailField label="JC date" value={selectedJc.jobcarddt ? formatDocDate(selectedJc.jobcarddt) || "—" : "—"} />
                  <DrawerDetailField label="Left" value={needHours > 0 ? fmtHrs(remainHours) : "—"} />
                  <DrawerDetailField label="Qty" value={Number(selectedJc.qty || 0).toLocaleString()} />
                  <DrawerDetailField label="Status" value={selectedJc.status || "—"} />
                </div>
              )}
            </div>
          </DrawerSection>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {!editMode ? (
            <div className="grid grid-cols-4 gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
              <div>
                <p className="text-[9px] font-bold uppercase text-slate-400">Need</p>
                <p className="font-black tabular-nums text-slate-800">{needHours > 0 ? fmtHrs(needHours) : "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase text-slate-400">Saved</p>
                <p className="font-black tabular-nums text-slate-700">{fmtHrs(savedHours)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase text-slate-400">Adding</p>
                <p className={`font-black tabular-nums ${overNeed ? "text-rose-600" : "text-indigo-700"}`}>
                  {fmtHrs(selectedHours)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase text-slate-400">Left</p>
                <p className="font-black tabular-nums text-slate-800">
                  {needHours > 0 ? fmtHrs(remainHours) : "—"}
                </p>
              </div>
            </div>
          ) : null}

          <DrawerSection title="Job card" bar="bg-slate-600">
            <div className="space-y-2 p-3">
              {editMode && plannedCard ? (
                <div className="border border-slate-300 bg-slate-50 px-3 py-2">
                  <p className="font-mono text-[12px] font-bold text-slate-800">{plannedCard.job_card_no}</p>
                  <p className="truncate text-[11px] font-semibold uppercase text-slate-600">
                    {plannedCard.prime_item_code || "—"}
                  </p>
                </div>
              ) : selectedJc ? (
                <div className="border border-indigo-200 bg-indigo-50 px-3 py-2">
                  <p className="font-mono text-[12px] font-bold text-indigo-700">{selectedJc.job_card_no}</p>
                  <p className="truncate text-[11px] font-semibold uppercase text-slate-600">
                    {selectedJc.prime_item_code || "—"}
                  </p>
                </div>
              ) : (
                <p className="text-[12px] font-semibold text-slate-400">No job card.</p>
              )}
              {!editMode && focusKey ? (
                <div className="grid grid-cols-2 gap-2 border border-slate-200 bg-slate-50 p-2.5">
                  <DrawerDetailField
                    label="Adding"
                    value={<span className="font-black tabular-nums text-indigo-700">{fmtHrs(selectedHours || Math.min(remainHours || freeOnSlot(focusKey), freeOnSlot(focusKey)))}</span>}
                  />
                  <DrawerDetailField
                    label="Free / Shift"
                    value={
                      <span className="font-bold tabular-nums">
                        {fmtHrs(freeOnSlot(focusKey))}
                        <span className="text-slate-400"> / {fmtHrs(shiftHrs(slot?.shift))}</span>
                      </span>
                    }
                  />
                </div>
              ) : null}
            </div>
          </DrawerSection>

          <DrawerSection title="Operator" bar="bg-emerald-600">
            <div className="p-3">
              {isView ? (
                <div className="flex flex-wrap gap-1.5">
                  {operators.length ? (
                    operators.map((o) => (
                      <span
                        key={o.emp_code}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        <span className="font-mono font-bold text-indigo-700">{o.emp_code}</span>
                        {o.emp_name ? <span className="text-slate-600">· {o.emp_name}</span> : null}
                      </span>
                    ))
                  ) : (
                    <p className="text-[12px] font-semibold text-slate-400">—</p>
                  )}
                </div>
              ) : (
                opSelect
              )}
            </div>
          </DrawerSection>
        </div>
      )}
    </Drawer>
  );
}
