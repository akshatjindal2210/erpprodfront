"use client";

/**
 * Job Card Calendar — same table size / color / font as CL Task Report
 * (ReportBookingCalendar). Y: Process → Machine · X: Date → S1/S2/S3
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDroppable } from "@dnd-kit/core";
import { UNASSIGNED, toDateKey, SHIFT_HOURS, resolveCardShiftStats } from "@/apps/production/modules/job-card-board/board";
import { formatDocDate } from "@/platform/utils/core/utilHelper";
import { processStatusRows } from "@/apps/production/lib/constants/processStatus";
import { STICKY_SIZE, calendarShiftWidthPx } from "@/apps/production/lib/config/stickySize.config";
import { C, CALENDAR_LEGEND, CARD, slotCardColors } from "@/apps/production/lib/config/calendarColors.config";

const TIP_W = 240;
const TIP_H_EST = 168;

function tipCoords(rect) {
  if (!rect) return null;
  let top = rect.bottom + 6;
  let left = rect.left + rect.width / 2;
  if (typeof window !== "undefined") {
    if (top + TIP_H_EST > window.innerHeight - 8) top = Math.max(8, rect.top - TIP_H_EST - 6);
    left = Math.min(window.innerWidth - TIP_W / 2 - 8, Math.max(TIP_W / 2 + 8, left));
  }
  return { top, left };
}

const SNO_W = STICKY_SIZE.snoWidthPx;
const LABEL_W_DEFAULT = STICKY_SIZE.labelWidthPx.default;
const LABEL_W_MIN = STICKY_SIZE.labelWidthPx.min;
const LABEL_W_MAX = STICKY_SIZE.labelWidthPx.max;
const ROW_H = STICKY_SIZE.rowHeightPx;
const ROW_STACK_BAND = STICKY_SIZE.rowStackBandPx || 44;
const GROUP_H = STICKY_SIZE.groupHeightPx;
const HEADER_H = STICKY_SIZE.headerHeightPx;
const CAL_Z = STICKY_SIZE.zIndex;

/** Row grows with max JC count on that machine (visible dates). */
function rowHeightForJcCount(n) {
  const count = Math.max(1, Number(n) || 1);
  return ROW_H + (count - 1) * ROW_STACK_BAND;
}

function uniqueJcCount(occ) {
  const segs = occSegs(occ);
  if (!segs.length) return 0;
  const set = new Set();
  for (const seg of segs) {
    const j = String(seg?.pjobcardno || "").trim();
    set.add(j || `#${seg?.id || set.size + 1}`);
  }
  return set.size;
}

function maxJcOnMachine(occupiedMap, machineKey, dateKeys, shiftList) {
  let max = 1;
  if (!occupiedMap?.get || !dateKeys?.length || !shiftList?.length) return max;
  for (const d of dateKeys) {
    for (const s of shiftList) {
      const n = uniqueJcCount(occupiedMap.get(occKey(machineKey, d, s.id)));
      if (n > max) max = n;
    }
  }
  return max;
}

/**
 * Machine load from JC estimates on that machine (not manpower assign):
 * JC count · sum(need shifts) · (need hours)
 */
function machinePlanStats(machineKey, cards = [], hoursPerShift = SHIFT_HOURS) {
  const mid = String(machineKey);
  const machineCards = (cards || []).filter((c) => {
    const id = c.machine_id == null || c.machine_id === "" ? UNASSIGNED : String(c.machine_id);
    return id === mid;
  });
  let shifts = 0;
  let hours = 0;
  for (const c of machineCards) {
    const s = resolveCardShiftStats(c, hoursPerShift);
    shifts += s.shifts;
    hours += s.hours;
  }
  return { jc: machineCards.length, shifts, hours: Math.round(hours * 10) / 10 };
}

function useShiftWidth() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return calendarShiftWidthPx(w);
}

/** Today column — header light / body dark (from calendarColors.config.js) */
export const TODAY_COLUMN = {
  headerBg: C.today,
  headerText: C.todayFg,
  bodyBg: C.todayBody,
  text: C.fg,
};


const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function isWeekendYmd(ymd) {
  if (!ymd || ymd.length < 10) return false;
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

function weekdayLong(ymd) {
  if (!ymd || ymd.length < 10) return "";
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return WEEKDAY[d.getDay()] || "";
}

function slotCellId(date, shift, machineId) {
  return `slot:${date}:${shift}:${machineId == null || machineId === "" ? UNASSIGNED : machineId}`;
}

export function parseCalSlot(id) {
  if (!String(id).startsWith("slot:")) return null;
  const parts = String(id).split(":");
  if (parts.length < 3) return null;
  return {
    date: parts[1],
    shift: Number(parts[2]),
    machineId: parts[3] === UNASSIGNED || parts[3] == null ? null : parts[3],
  };
}

function isFilterNone(ids = []) {
  return ids.length === 1 && ids[0] === "__none__";
}

function allowProcessId(processId, processIds = []) {
  if (!processIds.length) return true;
  if (isFilterNone(processIds)) return false;
  return processIds.map(String).includes(String(processId || 0));
}

function allowMachineKey(machineKey, machineIds = []) {
  if (!machineIds.length) return true;
  if (isFilterNone(machineIds)) return false;
  return machineIds.map(String).includes(String(machineKey));
}

/** Process stage that owns this card's scheduled machine (one home row per card). */
export function resolveCardProcessId(card) {
  const plan = Array.isArray(card?.process_plan) ? card.process_plan : [];
  const mid = card?.machine_id;
  if (mid != null && mid !== "") {
    for (const stage of plan) {
      const hit = (stage?.machines || []).some((m) => Number(m.machine_id) === Number(mid));
      if (hit) return Number(stage.process_id) || 0;
    }
  }
  const rows = processStatusRows(plan);
  if (rows.length) return Number(rows[0].processId) || 0;
  if (card?.process_ids?.length) return Number(card.process_ids[0]) || 0;
  return 0;
}

function ensureGroup(byProcess, processId, processName) {
  const pid = String(processId || 0);
  if (!byProcess.has(pid)) {
    byProcess.set(pid, {
      processId: processId || 0,
      processName: processName || "Process",
      machines: new Map(),
      cardCount: 0,
    });
  }
  return byProcess.get(pid);
}

function addMachineToGroup(group, { id, name, code }, macName, macCode) {
  const mid = id == null || id === "" ? UNASSIGNED : String(id);
  if (group.machines.has(mid)) return;
  group.machines.set(mid, {
    machineId: mid === UNASSIGNED ? null : Number(id) || id,
    machineKey: mid,
    name: name || macName.get(mid) || (mid === UNASSIGNED ? "Unassigned" : `Machine ${mid}`),
    code: mid === UNASSIGNED ? "" : code || macCode.get(mid) || String(mid),
  });
}

/**
 * Build Process → Machine rows.
 * Each job card sits on exactly one process (stage that owns its machine).
 * Stage machines stay under their own process only (NF-1 ≠ Tapping).
 */
export function buildProcessMachineRows(
  cards = [],
  machines = [],
  { processIds = [], machineIds = [], processOptions = [] } = {}
) {
  const macName = new Map(machines.map((m) => [String(m.id), m.name || m.code || `Machine ${m.id}`]));
  const macCode = new Map(machines.map((m) => [String(m.id), m.code || String(m.id)]));
  const processNameById = new Map(
    (processOptions || []).map((o) => [String(o.value), o.label || String(o.value)])
  );
  const byProcess = new Map();

  const seedMachines = () => {
    if (!machineIds.length || isFilterNone(machineIds)) return [];
    return machineIds.map((raw) => {
      const mid = String(raw);
      if (mid === UNASSIGNED) return { id: null, name: "Unassigned", code: "" };
      const m = machines.find((x) => String(x.id) === mid);
      return {
        id: m?.id ?? (Number(mid) || mid),
        name: m?.name || macName.get(mid) || mid,
        code: m?.code || macCode.get(mid) || mid,
      };
    });
  };

  // Seed empty planning rows only when Process filter is set (never a fake "Machines" group).
  if (processIds.length && !isFilterNone(processIds)) {
    const seededMacs = seedMachines();
    for (const pid of processIds) {
      const group = ensureGroup(byProcess, pid, processNameById.get(String(pid)) || `Process ${pid}`);
      for (const m of seededMacs) addMachineToGroup(group, m, macName, macCode);
    }
  }

  // Board parity: every master machine as a row (idle M/C too), under its process.
  for (const m of machines) {
    if (m?.id == null || m.id === "") continue;
    const mid = String(m.id);
    if (!allowMachineKey(mid, machineIds)) continue;
    const pid = m.processId;
    if (pid == null || pid === "" || !Number.isFinite(Number(pid)) || Number(pid) <= 0) continue;
    if (!allowProcessId(pid, processIds)) continue;
    const group = ensureGroup(
      byProcess,
      pid,
      processNameById.get(String(pid)) || `Process ${pid}`
    );
    addMachineToGroup(group, { id: m.id, name: m.name, code: m.code }, macName, macCode);
  }

  for (const card of cards) {
    const plan = Array.isArray(card.process_plan) ? card.process_plan : [];
    const rows = processStatusRows(plan);
    const processes = rows.length
      ? rows
      : card.process
        ? [{ processId: card.process_ids?.[0] || 0, processName: card.process, status: "pending" }]
        : [{ processId: 0, processName: "Unassigned process", status: "pending" }];

    const homePid = resolveCardProcessId(card);

    for (const p of processes) {
      if (!allowProcessId(p.processId, processIds)) continue;
      if (p.processName) processNameById.set(String(p.processId || 0), p.processName);

      const group = ensureGroup(
        byProcess,
        p.processId,
        p.processName || processNameById.get(String(p.processId || 0))
      );
      group.processName = p.processName || group.processName;

      // Stage machines only under their own process (NF-1 stays under Nut Forging).
      const stage = plan.find((s) => Number(s.process_id) === Number(p.processId));
      for (const m of stage?.machines || []) {
        const id = Number(m.machine_id);
        if (!id) continue;
        if (!allowMachineKey(String(id), machineIds)) continue;
        addMachineToGroup(
          group,
          { id, name: m.machine_name || m.name, code: macCode.get(String(id)) },
          macName,
          macCode
        );
      }

      // Chip + count only on the home process (scheduled machine's stage).
      if (String(p.processId || 0) !== String(homePid)) continue;
      group.cardCount += 1;
      const mid = card.machine_id == null ? UNASSIGNED : String(card.machine_id);
      if (!allowMachineKey(mid, machineIds)) continue;
      addMachineToGroup(
        group,
        card.machine_id == null
          ? { id: null, name: "Unassigned", code: "" }
          : {
              id: card.machine_id,
              name: card.machine || macName.get(mid),
              code: macCode.get(mid),
            },
        macName,
        macCode
      );
    }
  }

  for (const g of byProcess.values()) {
    const named = processNameById.get(String(g.processId));
    if (named) g.processName = named;
  }

  return [...byProcess.values()]
    .filter((g) => g.machines.size > 0)
    .sort((a, b) => String(a.processName).localeCompare(String(b.processName)))
    .map((g, i) => ({
      sno: i + 1,
      processId: g.processId,
      processName: g.processName,
      cardCount: g.cardCount,
      machines: [...g.machines.values()].sort((a, b) =>
        String(a.code || a.name).localeCompare(String(b.code || b.name), undefined, { numeric: true })
      ),
    }));
}

function occKey(machineKey, date, shift) {
  return `${machineKey}:${date}:${Number(shift)}`;
}

function occSegs(occ) {
  if (!occ) return [];
  if (Array.isArray(occ.segments) && occ.segments.length) return occ.segments;
  return [occ];
}

function shiftFullHrs(shiftList, shiftNo) {
  const s = (shiftList || []).find((x) => Number(x.id) === Number(shiftNo));
  return Number(s?.hours) > 0 ? Number(s.hours) : SHIFT_HOURS;
}

/** Map `${cellKey}#${rowId}` → setup hours inside that segment (rest = run). */
function buildSetupSegHours(occupiedMap, cards, shiftList) {
  const out = new Map();
  if (!occupiedMap?.forEach) return out;
  const setupNeed = new Map();
  for (const c of cards || []) {
    const no = String(c.job_card_no || "").trim();
    const h = Math.max(0, Number(c.est_setup_seconds) || 0) / 3600;
    if (no && h > 0) setupNeed.set(no, h);
  }
  if (!setupNeed.size) return out;
  const groups = new Map();
  occupiedMap.forEach((v, key) => {
    const [mac, date, sh] = String(key).split(":");
    if (!mac || !date) return;
    const full = shiftFullHrs(shiftList, sh);
    occSegs(v).forEach((seg, i) => {
      const jc = String(seg?.pjobcardno || "").trim();
      if (!jc || !setupNeed.has(jc)) return;
      const gk = `${mac}:${jc}`;
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk).push({
        id: `${key}#${seg.id != null ? seg.id : i + 1}`,
        date,
        shift: Number(sh),
        hrs: Number(seg.hours) > 0 ? Number(seg.hours) : full,
      });
    });
  });
  for (const [gk, slots] of groups) {
    const jc = gk.slice(gk.indexOf(":") + 1);
    let left = setupNeed.get(jc) || 0;
    slots.sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        a.shift - b.shift ||
        String(a.id).localeCompare(String(b.id))
    );
    for (const s of slots) {
      if (!(left > 0.05)) break;
      const take = Math.min(s.hrs, left);
      if (take > 0.05) out.set(s.id, Math.round(take * 100) / 100);
      left -= take;
    }
  }
  return out;
}

/** Earliest prod_jc.jobcarddt on this machine — dates before it are not selectable. */
function machineMinJobcarddt(cards, machineKey) {
  let min = null;
  for (const c of cards || []) {
    const mid = c.machine_id == null || c.machine_id === "" ? UNASSIGNED : String(c.machine_id);
    if (mid !== String(machineKey)) continue;
    const d = toDateKey(c.jobcarddt);
    if (!d) continue;
    if (!min || d < min) min = d;
  }
  return min;
}

function fmtJc(no) {
  const s = String(no || "").trim();
  if (!s) return "—";
  return /^JC/i.test(s) ? s : `JC-${s}`;
}

function fmtOp(name, code) {
  const n = String(name || "").trim();
  if (n) return n;
  return String(code || "").trim() || "—";
}

function fmtH(h) {
  const n = Math.round((Number(h) || 0) * 10) / 10;
  return `${n}h`;
}

/** Slot target qty only (machine cavity × cycle × hours). */
function fmtSlotQty(row) {
  if (!(Number(row?.slotQty) > 0)) return "";
  return `Qty ${Number(row.slotQty).toLocaleString()}`;
}

/** One machine label — avoid "N.F.1 · NF-1" / code·name doubles. */
function fmtMachineLabel(code, name) {
  const c = String(code || "").trim();
  const n = String(name || "").trim();
  if (!c) return n || "—";
  if (!n) return c;
  const norm = (s) => s.replace(/[\s.\-_]/g, "").toLowerCase();
  const cn = norm(c);
  const nn = norm(n);
  if (cn === nn || nn.includes(cn) || cn.includes(nn)) return c;
  return `${c} · ${n}`;
}

/** Slot click → one shift. Machine click (row) → multi-shift drawer. */
function ShiftCell({
  date,
  shift,
  shiftMeta,
  machineKey,
  machineLabel,
  occupiedMap,
  setupHrsMap = null,
  cardByJc = null,
  minJobcarddt,
  canAdd = false,
  isToday,
  todayKey,
  onPlanSlot,
  onRemoveSeg,
  shiftW,
  rowH = ROW_H,
  rowBg = C.bg,
}) {
  const id = slotCellId(date, shift, machineKey);
  const beforeJc = Boolean(minJobcarddt && date < minJobcarddt);
  const isPast = Boolean(todayKey && date < todayKey);
  const locked = beforeJc || isPast;
  const { setNodeRef, isOver } = useDroppable({ id, disabled: locked });
  const cellKey = occKey(machineKey, date, shift);
  const segs = occSegs(occupiedMap?.get?.(cellKey));
  const occupied = segs.length > 0;
  const shiftHrs = Number(shiftMeta?.hours) > 0 ? Number(shiftMeta.hours) : SHIFT_HOURS;
  const shiftCode = shiftMeta?.code || shiftMeta?.short || `S${shift}`;
  let usedHrs = 0;
  for (const s of segs) usedHrs += Number(s.hours) > 0 ? Number(s.hours) : shiftHrs;
  usedHrs = Math.round(usedHrs * 100) / 100;
  const freeHrs = Math.max(0, Math.round((shiftHrs - usedHrs) * 100) / 100);
  const usedPct = Math.max(22, Math.min(100, Math.round((usedHrs / shiftHrs) * 1000) / 10));

  const jcRows = [];
  for (let i = 0; i < segs.length; i += 1) {
    const seg = segs[i];
    const jcKey = String(seg.pjobcardno || "").trim();
    const h = Number(seg.hours) > 0 ? Number(seg.hours) : shiftHrs;
    const setupH = Math.min(h, Number(setupHrsMap?.get?.(`${cellKey}#${seg.id != null ? seg.id : i + 1}`)) || 0);
    const card = cardByJc?.get?.(jcKey) || null;
    let row = jcRows.find((r) => r.jcKey === jcKey);
    if (!row) {
      row = {
        jcKey,
        jc: fmtJc(jcKey),
        item: card?.prime_item_code || card?.item_code || "",
        process: card?.process || "",
        qty: Number(card?.qty || 0),
        slotQty: 0,
        hrs: 0,
        setupH: 0,
        ops: [],
        rowId: seg.id != null ? seg.id : null,
      };
      jcRows.push(row);
    }
    row.hrs = Math.round((row.hrs + h) * 100) / 100;
    row.setupH = Math.round((row.setupH + setupH) * 100) / 100;
    const sq = Number(seg.qty);
    if (Number.isFinite(sq) && sq > 0) row.slotQty = Math.round((row.slotQty + sq) * 1000) / 1000;
    const codes = String(seg.emp_code || "").split(",").map((x) => x.trim()).filter(Boolean);
    const names = String(seg.emp_name || "").split(",").map((x) => x.trim()).filter(Boolean);
    const ops = codes.length ? codes.map((code, idx) => ({ code, name: names[idx] || names[0] || code })) : names.map((name) => ({ code: "", name }));
    for (const o of ops) {
      if (!row.ops.some((x) => (x.code || x.name) === (o.code || o.name))) row.ops.push(o);
    }
  }
  const multi = jcRows.length > 1;
  const hasSetup = jcRows.some((r) => r.setupH > 0.05);
  const tone = slotCardColors({ hasSetup, multi });
  const clickable = (!locked && (canAdd || occupied)) || occupied;
  const cellFull = occupied && freeHrs <= 0.05;
  const idleBg = locked ? C.bg2 : isToday ? TODAY_COLUMN.bodyBg : rowBg;
  const [tipPos, setTipPos] = useState(null);

  const openPlan = (e, intent = "add") => {
    e?.stopPropagation?.();
    if (locked && !occupied) return;
    onPlanSlot?.({
      date,
      shift,
      shiftCode,
      machineKey,
      machineId: machineKey === UNASSIGNED ? null : machineKey,
      machineLabel,
      viewOnly: locked,
      shiftLocked: true,
      intent: occupied && intent !== "add" ? "edit" : intent,
    });
  };

  const primary = jcRows[0] || null;

  return (
    <div
      ref={setNodeRef}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={(e) => openPlan(e, cellFull ? "edit" : "add")}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) openPlan(e, cellFull ? "edit" : "add");
      }}
      className={`group/cell relative flex shrink-0 items-center justify-center ${
        clickable ? "cursor-pointer" : "cursor-default"
      }`}
      style={{
        width: shiftW,
        height: rowH,
        borderRight: `1px solid ${C.rowLine}`,
        backgroundColor: isOver ? C.bg3 : idleBg,
        boxShadow: !locked && isOver ? `inset 0 0 0 2px ${C.ring}` : undefined,
      }}
      onMouseEnter={(e) => {
        if (!locked && !isOver && !occupied) e.currentTarget.style.backgroundColor = C.bg3;
        if (occupied && primary) setTipPos(tipCoords(e.currentTarget.getBoundingClientRect()));
      }}
      onMouseLeave={(e) => {
        if (!locked && !isOver && !occupied) e.currentTarget.style.backgroundColor = idleBg;
        setTipPos(null);
      }}
    >
      {locked && !occupied ? null : occupied && primary ? (
        <>
          <div className="flex h-[calc(100%-6px)] w-[calc(100%-6px)] items-stretch gap-0.5 overflow-hidden">
            <div
              className={`relative flex min-w-0 flex-col overflow-hidden rounded-md border shadow-sm ${
                multi ? "py-0.5" : "justify-center gap-0.5 px-2 py-1"
              }`}
              style={{
                width: `${usedPct}%`,
                backgroundColor: tone.bg,
                borderColor: tone.bg,
                color: tone.text,
              }}
            >
              {jcRows.map((row, ri) => (
                <div
                  key={row.jcKey || ri}
                  className={
                    multi
                      ? `relative flex min-h-0 flex-1 flex-col justify-center border-t border-white/30 px-1.5 first:border-t-0 ${
                          onRemoveSeg ? "pr-5" : ""
                        }`
                      : `min-w-0 leading-snug ${onRemoveSeg ? "pr-4" : ""}`
                  }
                >
                  {multi ? (
                    <>
                      <div className="flex min-w-0 items-baseline gap-1">
                        <p className="shrink-0 font-mono text-[10px] font-black tracking-tight">{row.jc}</p>
                        {row.item ? (
                          <p className="min-w-0 truncate text-[9px] font-bold uppercase">{row.item}</p>
                        ) : null}
                      </div>
                      {fmtSlotQty(row) ? (
                        <p className="truncate text-[9px] font-bold tabular-nums">{fmtSlotQty(row)}</p>
                      ) : (
                        <p className="truncate text-[9px] font-semibold">{fmtH(row.hrs)}</p>
                      )}
                      {row.ops[0]?.name ? (
                        <p className="truncate text-[8px] font-medium capitalize">{row.ops[0].name}</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="truncate font-mono text-[10px] font-black tracking-tight">{row.jc}</p>
                      {row.item ? (
                        <p className="truncate text-[9px] font-bold uppercase tracking-wide">{row.item}</p>
                      ) : null}
                      {row.ops[0]?.name ? (
                        <p className="truncate text-[9px] font-medium capitalize">
                          {row.ops.length > 1 ? row.ops.map((o) => o.name).join(", ") : row.ops[0].name}
                        </p>
                      ) : null}
                      {fmtSlotQty(row) ? (
                        <p className="truncate text-[8px] font-bold tabular-nums">{fmtSlotQty(row)}</p>
                      ) : null}
                    </>
                  )}

                  {onRemoveSeg ? (
                    <button
                      type="button"
                      title={`Delete ${row.jc}`}
                      className={`absolute z-[2] hidden items-center justify-center rounded bg-white font-bold leading-none text-rose-600 shadow-sm group-hover/cell:flex hover:bg-rose-50 ${
                        multi
                          ? "right-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[9px]"
                          : "right-1 top-1 h-4 w-4 text-[10px]"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSeg({
                          machineKey,
                          date,
                          shift,
                          id: row.rowId,
                          jc: row.jcKey || row.jc,
                        });
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {freeHrs > 0.05 ? (
              <span
                className={`min-w-[1.25rem] flex-1 rounded-md ${
                  canAdd && !locked ? "flex items-center justify-center text-[13px]" : ""
                }`}
                style={{
                  backgroundColor: C.bg3,
                  color: C.muted,
                }}
              >
                {canAdd && !locked ? "+" : ""}
              </span>
            ) : null}
          </div>
          {tipPos && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="pointer-events-none fixed w-60 rounded-md border border-slate-200 bg-white p-2.5 text-left shadow-lg"
                  style={{
                    top: tipPos.top,
                    left: tipPos.left,
                    transform: "translateX(-50%)",
                    zIndex: 9990,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {weekdayLong(date)} · {formatDocDate(date) || "—"} · {shiftCode}
                    {multi ? ` · ${jcRows.length} JC` : ""}
                  </p>
                  <p className="mb-1.5 truncate text-[11px] font-semibold text-slate-700">{machineLabel}</p>
                  <p className="mb-2 text-[10px] tabular-nums text-slate-500">
                    {fmtH(usedHrs)} / {fmtH(shiftHrs)}
                    {freeHrs > 0.05 ? ` · free ${fmtH(freeHrs)}` : " · full"}
                  </p>
                  {jcRows.map((row, ri) => (
                    <div key={row.jcKey} className={ri ? "mt-1.5 border-t border-slate-100 pt-1.5" : ""}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[12px] font-black text-indigo-700">{row.jc}</span>
                        <span className="text-[11px] font-bold tabular-nums text-slate-600">{fmtH(row.hrs)}</span>
                      </div>
                      {row.item ? (
                        <p className="truncate text-[10px] font-bold uppercase text-slate-600">{row.item}</p>
                      ) : null}
                      {row.ops.length ? (
                        <p className="truncate text-[10px] capitalize text-slate-600">
                          {row.ops.map((o) => o.name).join(", ")}
                        </p>
                      ) : null}
                      {fmtSlotQty(row) ? (
                        <p className="text-[10px] font-bold tabular-nums text-slate-700">{fmtSlotQty(row)}</p>
                      ) : null}
                      <p
                        className="text-[10px] font-semibold"
                        style={{ color: row.setupH > 0.05 ? CARD.setup.bg : CARD.run.text }}
                      >
                        {row.setupH > 0.05
                          ? `Setup ${fmtH(row.setupH)}${row.hrs - row.setupH > 0.05 ? ` · Run ${fmtH(Math.round((row.hrs - row.setupH) * 100) / 100)}` : ""}`
                          : `Run ${fmtH(row.hrs)}`}
                      </p>
                    </div>
                  ))}
                </div>,
                document.body
              )
            : null}
        </>
      ) : (
        <span
          className="flex h-6 w-6 items-center justify-center rounded text-[14px] font-medium"
          style={{ color: C.muted }}
        >
          +
        </span>
      )}
    </div>
  );
}

/** Compact KPIs — render at page top (not inside calendar grid). */
export function SummaryStrip({ cards = [], groups = [], occupiedMap = null }) {
  const stats = useMemo(() => {
    const machineSet = new Set();
    for (const g of groups) for (const m of g.machines) machineSet.add(m.machineKey);
    const occupiedJc = new Set();
    if (occupiedMap?.forEach) {
      occupiedMap.forEach((v, key) => {
        const mac = String(key).split(":")[0];
        if (machineSet.size && !machineSet.has(mac)) return;
        for (const seg of occSegs(v)) {
          const n = (seg?.pjobcardno || "").trim();
          if (n) occupiedJc.add(n);
        }
      });
    }
    return {
      processes: groups.length,
      machines: machineSet.size,
      cards: cards.length,
      occupied: occupiedJc.size,
      running: cards.filter((c) => c.status === "Running").length,
      hold: cards.filter((c) => c.status === "Hold").length,
    };
  }, [cards, groups, occupiedMap]);

  const items = [
    { key: "processes", label: "Processes", value: stats.processes, bar: "#4f46e5" },
    { key: "machines", label: "Machines", value: stats.machines, bar: "#696969" },
    { key: "cards", label: "In plan", value: stats.cards, bar: "#0284c7", hint: "Authorized JCs in this window" },
    { key: "occupied", label: "Occupied", value: stats.occupied, bar: "#0f766e", hint: "Live FIFO JC on manpower slots" },
    { key: "running", label: "Running", value: stats.running, bar: "#059669" },
    { key: "hold", label: "Hold", value: stats.hold, bar: "#e11d48" },
  ];

  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {items.map(({ key, label, value, bar, hint }) => (
          <div key={key} title={hint || undefined} className="flex items-baseline gap-1.5">
            <span className="h-2 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: bar }} />
            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
            <span className="text-[12px] font-black tabular-nums text-slate-800">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Calendar occupy grid: cells show + / Occ (no JC badges). Machine or cell click → plan drawer.
 */
export default function JobCardReportCalendar({
  dateKeys = [],
  cards = [],
  machines = [],
  processIds = [],
  machineIds = [],
  processOptions = [],
  canAdd = false,
  canEdit = false,
  onPlanSlot,
  onRemoveSeg,
  /** Map `${machineKey}:${date}:${shift}` → manpower + live FIFO JC. */
  occupiedMap = null,
  /** Settings → Shifts codes only (empty = add shifts in Settings). */
  shifts = [],
  /** If true, pin scroll at range start; else open on today (past dates still scrollable left). */
  keepStartVisible = false,
}) {
  const today = toDateKey(new Date());
  const scrollRef = useRef(null);
  const labelScrollRef = useRef(null);
  const headerScrollRef = useRef(null);
  const syncingScroll = useRef(false);
  const shiftW = useShiftWidth();
  /** Hours / overnight already from plan getShifts API. */
  const shiftList = useMemo(
    () =>
      (Array.isArray(shifts) ? shifts : []).map((s) => ({
        ...s,
        hours: Number(s.hours) > 0 ? Number(s.hours) : SHIFT_HOURS,
        overnight: !!s.overnight,
      })),
    [shifts]
  );
  const dateW = Math.max(shiftW, shiftW * Math.max(1, shiftList.length));

  const setupHrsMap = useMemo(
    () => buildSetupSegHours(occupiedMap, cards, shiftList),
    [occupiedMap, cards, shiftList]
  );
  const cardByJc = useMemo(() => {
    const m = new Map();
    for (const c of cards || []) {
      const no = String(c.job_card_no || "").trim();
      if (no && !m.has(no)) m.set(no, c);
    }
    return m;
  }, [cards]);

  const [labelW, setLabelW] = useState(LABEL_W_DEFAULT);
  const resizingRef = useRef(false);

  const startLabelResize = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = labelW;
      const startX = e.clientX;
      const onMove = (ev) => {
        if (!resizingRef.current) return;
        setLabelW(Math.min(LABEL_W_MAX, Math.max(LABEL_W_MIN, startWidth + (ev.clientX - startX))));
      };
      const onUp = () => {
        resizingRef.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      resizingRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [labelW]
  );

  const groups = useMemo(
    () => buildProcessMachineRows(cards, machines, { processIds, machineIds, processOptions }),
    [cards, machines, processIds, machineIds, processOptions]
  );
  const leftSticky = SNO_W + labelW;
  /** Dates-only width — left labels are frozen outside horizontal scroll (fixes month gap). */
  const datesWidth = dateKeys.length * dateW;

  const hoursPerShift = useMemo(() => {
    if (!shiftList.length) return SHIFT_HOURS;
    const sum = shiftList.reduce((a, s) => a + (Number(s.hours) > 0 ? Number(s.hours) : SHIFT_HOURS), 0);
    return Math.round((sum / shiftList.length) * 10) / 10;
  }, [shiftList]);

  const machineStatsMap = useMemo(() => {
    const m = new Map();
    for (const g of groups) {
      for (const mac of g.machines) {
        m.set(mac.machineKey, machinePlanStats(mac.machineKey, cards, hoursPerShift));
      }
    }
    return m;
  }, [groups, cards, hoursPerShift]);
  const todayIdx = dateKeys.indexOf(today);

  const dayCardCount = useMemo(() => {
    const map = new Map();
    for (const ymd of dateKeys) map.set(ymd, 0);
    for (const c of cards) {
      if (c.date && map.has(c.date)) map.set(c.date, (map.get(c.date) || 0) + 1);
    }
    return map;
  }, [cards, dateKeys]);

  const syncFromBody = useCallback((el) => {
    if (syncingScroll.current || !el) return;
    syncingScroll.current = true;
    if (labelScrollRef.current) labelScrollRef.current.scrollTop = el.scrollTop;
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = el.scrollLeft;
    syncingScroll.current = false;
  }, []);

  const syncFromLabels = useCallback((top) => {
    if (syncingScroll.current) return;
    syncingScroll.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = top;
    syncingScroll.current = false;
  }, []);

  const filterKey = `${(machineIds || []).join(",")}|${(processIds || []).join(",")}|${groups.length}`;

  /** Prefer first manpower date on visible M/Cs (filter), else today, else start. */
  const anchorIdx = useMemo(() => {
    const macs = new Set();
    for (const g of groups) for (const m of g.machines) macs.add(String(m.machineKey));
    let firstOcc = -1;
    if (occupiedMap?.size && macs.size && shiftList.length) {
      for (let i = 0; i < dateKeys.length; i += 1) {
        const d = dateKeys[i];
        let hit = false;
        for (const mac of macs) {
          for (const s of shiftList) {
            const v = occupiedMap.get(occKey(mac, d, s.id));
            if (v && occSegs(v).length) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
        if (hit) {
          firstOcc = i;
          break;
        }
      }
    }
    const filtered = (machineIds || []).length > 0 && !isFilterNone(machineIds);
    if (filtered && firstOcc >= 0) return firstOcc;
    if (todayIdx >= 0) return todayIdx;
    if (firstOcc >= 0) return firstOcc;
    return 0;
  }, [groups, occupiedMap, dateKeys, shiftList, todayIdx, machineIds]);

  /** Filter / fewer rows: pin V-scroll to top so left labels & grid stay aligned. */
  useEffect(() => {
    if (labelScrollRef.current) labelScrollRef.current.scrollTop = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filterKey]);

  useEffect(() => {
    /** Open on anchor day (occupied / today); past dates still via scroll left. */
    if (keepStartVisible) return undefined;
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      const el = scrollRef.current;
      if (!el) return;
      const x = Math.max(0, anchorIdx) * dateW;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      const target = Math.max(0, Math.min(x, max));
      el.scrollLeft = target;
      if (headerScrollRef.current) headerScrollRef.current.scrollLeft = target;
    };
    go();
    const raf = requestAnimationFrame(() => requestAnimationFrame(go));
    const times = [60, 180, 400, 800].map((ms) => setTimeout(go, ms));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      times.forEach(clearTimeout);
    };
  }, [anchorIdx, dateW, keepStartVisible, shiftList.length, datesWidth, filterKey, occupiedMap]);

  if (!dateKeys.length) {
    return (
      <p className="flex-1 py-10 text-center text-sm" style={{ backgroundColor: C.bg, color: C.muted }}>
        No dates
      </p>
    );
  }

  if (!shiftList.length) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center"
        style={{ backgroundColor: C.bg }}
      >
        <p className="text-sm font-medium" style={{ color: C.fg }}>
          No shifts configured
        </p>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>
          Add shift codes in Settings → Shifts, then refresh.
        </p>
      </div>
    );
  }

  if (!groups.length) {
    const filtered = processIds.length > 0 || machineIds.length > 0;
    return (
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-center"
        style={{ backgroundColor: C.bg }}
      >
        <p className="text-sm font-medium" style={{ color: C.fg }}>
          {filtered ? "No rows for this filter" : "No job cards in this window"}
        </p>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>
          {filtered
            ? "Clear Process / Machine filters, or pick machines that exist on authorized cards."
            : "Authorize cards in Maintain Job Card, then they appear here."}
        </p>
      </div>
    );
  }

  const labelCorner = (
    <div
      className="flex shrink-0 border-b"
      style={{
        width: leftSticky,
        height: HEADER_H,
        backgroundColor: C.soft2,
        borderColor: C.softLine,
      }}
    >
      <div
        className="flex items-end justify-center border-r pb-1"
        style={{ width: SNO_W, borderColor: C.softLine }}
      >
        <span className="text-[8px] font-bold uppercase" style={{ color: C.softMuted }}>
          #
        </span>
      </div>
      <div className="relative flex min-w-0 flex-1 items-end justify-between gap-1 px-1.5 pb-1">
        <span className="truncate text-[8px] font-bold uppercase" style={{ color: C.softMuted }}>
          Process / Machine
        </span>
        <span className="shrink-0 text-[7px] font-bold uppercase tabular-nums" style={{ color: C.softMuted }}>
          JC · Load
        </span>
        <button
          type="button"
          aria-label="Resize label column"
          title="Drag to resize"
          onMouseDown={startLabelResize}
          className={`absolute right-0 top-0 h-full ${STICKY_SIZE.labelResizeHandleWidthClass} cursor-col-resize border-0 bg-transparent p-0 hover:bg-indigo-400/50 active:bg-indigo-500/60`}
          style={{ zIndex: CAL_Z.labelResizeHandle }}
        />
      </div>
    </div>
  );

  const dateHeader = (
    <div
      className="border-b"
      style={{
        width: datesWidth,
        height: HEADER_H,
        backgroundColor: C.soft,
        borderColor: C.softLine,
      }}
    >
      <div className="flex h-[16px] border-b" style={{ borderColor: C.softLine }}>
        {dateKeys.map((ymd) => {
          const weekend = isWeekendYmd(ymd);
          const isToday = ymd === today;
          return (
            <div
              key={`wd-${ymd}`}
              data-cal-day={ymd}
              className="flex shrink-0 items-center justify-center border-r"
              style={{
                width: dateW,
                borderColor: C.softLine,
                backgroundColor: isToday ? C.today : weekend ? C.week : C.soft,
              }}
            >
              <span
                className={`text-[8px] leading-none ${isToday || weekend ? "font-black" : "font-bold"}`}
                style={{
                  color: weekend ? C.weekFg : isToday ? C.todayFg : C.softMuted,
                }}
              >
                {weekdayLong(ymd)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex h-[18px] border-b" style={{ borderColor: C.softLine }}>
        {dateKeys.map((ymd) => {
          const weekend = isWeekendYmd(ymd);
          const isToday = ymd === today;
          const dmy = formatDocDate(ymd) || "—";
          return (
            <div
              key={`dn-${ymd}`}
              title={`${weekdayLong(ymd)} · ${dmy}`}
              className="flex shrink-0 items-center justify-center border-r px-0.5"
              style={{
                width: dateW,
                borderColor: C.softLine,
                backgroundColor: isToday ? C.today : weekend ? C.week : C.soft,
              }}
            >
              <span
                className="text-center text-[9px] font-bold tabular-nums leading-tight"
                style={{
                  color: weekend ? C.weekFg : isToday ? C.todayFg : C.softFg,
                }}
              >
                {dmy}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex" style={{ height: HEADER_H - 34 }}>
        {dateKeys.map((ymd) => {
          const weekend = isWeekendYmd(ymd);
          const isToday = ymd === today;
          const count = dayCardCount.get(ymd) || 0;
          return (
            <div
              key={`sh-${ymd}`}
              className="flex shrink-0 border-r"
              style={{ width: dateW, borderColor: C.softLine }}
            >
              {shiftList.map((s) => (
                <div
                  key={s.id}
                  title={`${weekdayLong(ymd)} · ${s.code || s.label} · ${s.hours}h · ${count} cards`}
                  className="flex shrink-0 flex-col items-center justify-center border-r last:border-r-0 px-0.5"
                  style={{
                    width: shiftW,
                    borderColor: C.softLine,
                    backgroundColor: isToday
                      ? C.today
                      : weekend
                        ? C.week
                        : C.soft2,
                  }}
                >
                  <span
                    className="text-[8px] font-black tabular-nums leading-none"
                    style={{ color: count > 0 ? C.softFg : C.softMuted }}
                  >
                    {s.short || s.code || `S${s.id}`}
                  </span>
                  <span
                    className="text-[7px] font-semibold tabular-nums leading-none"
                    style={{ color: C.softMuted }}
                  >
                    {s.hours}h
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col" style={{ backgroundColor: C.bg }}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Frozen left — V-scroll synced from body; scrollbar hidden (was the left gap). */}
        <div
          className="flex shrink-0 flex-col border-r"
          style={{ width: leftSticky, backgroundColor: C.bg, borderColor: C.line }}
        >
          {labelCorner}
          <div
            ref={labelScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(e) => syncFromLabels(e.currentTarget.scrollTop)}
            style={{ backgroundColor: C.bg }}
          >
            {groups.map((group) => (
              <div key={`L-${group.processId || group.processName}`}>
                <div
                  className="flex border-b"
                  style={{
                    width: leftSticky,
                    height: GROUP_H,
                    backgroundColor: C.bg2,
                    borderColor: C.line,
                  }}
                >
                  <div
                    className="flex items-center justify-center border-r text-[10px] font-bold tabular-nums"
                    style={{ width: SNO_W, borderColor: C.line, color: C.fg }}
                  >
                    {group.sno}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center px-1.5">
                    <p className="min-w-0 truncate text-[10px] font-bold" style={{ color: C.fg }} title={group.processName}>
                      {group.processName}
                      <span className="font-medium" style={{ color: C.muted }}>
                        {" "}
                        · {group.machines.length} M/C
                      </span>
                    </p>
                  </div>
                </div>
                {group.machines.map((mac, mIdx) => {
                  const rowBg = mIdx % 2 === 1 ? C.bg3 : C.bg;
                  const minJcDt = machineMinJobcarddt(cards, mac.machineKey);
                  const stats = machineStatsMap.get(mac.machineKey) || { jc: 0, shifts: 0, hours: 0 };
                  const rowH = rowHeightForJcCount(
                    maxJcOnMachine(occupiedMap, mac.machineKey, dateKeys, shiftList)
                  );
                  const focusDate =
                    dateKeys.find((d) => (!minJcDt || d >= minJcDt) && d >= today) ||
                    (minJcDt && dateKeys.includes(minJcDt) ? minJcDt : null) ||
                    dateKeys.find((d) => !minJcDt || d >= minJcDt) ||
                    dateKeys[0];
                  const focusLocked = Boolean(
                    focusDate && ((minJcDt && focusDate < minJcDt) || focusDate < today)
                  );
                  const macLabel = fmtMachineLabel(mac.code, mac.name);
                  return (
                    <div
                      key={`L-${group.processId}-${mac.machineKey}`}
                      className="flex"
                      style={{
                        width: leftSticky,
                        height: rowH,
                        backgroundColor: rowBg,
                        boxShadow: `inset 0 -2px 0 ${C.rowLine}`,
                      }}
                    >
                      <div className="border-r" style={{ width: SNO_W, borderColor: C.line }} />
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 pl-2 text-left"
                        style={{ color: C.fg }}
                        title={`${macLabel} · load ${stats.jc} JC · ${stats.shifts} shifts (${stats.hours}h)`}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = C.bg2;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                        onClick={() => {
                          if (!focusDate || focusLocked) return;
                          const s0 = shiftList[0];
                          onPlanSlot?.({
                            date: focusDate,
                            shift: s0?.id || 1,
                            shiftCode: s0?.code || s0?.short || "S1",
                            machineKey: mac.machineKey,
                            machineId: mac.machineKey === UNASSIGNED ? null : mac.machineKey,
                            machineLabel: macLabel,
                            viewOnly: false,
                            shiftLocked: false,
                            intent: "add",
                          });
                        }}
                      >
                        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold" style={{ color: C.fg }}>
                          {macLabel}
                        </p>
                        <span
                          className="shrink-0 text-[9px] font-bold tabular-nums"
                          style={{ color: stats.jc || stats.shifts ? C.fg : C.muted }}
                        >
                          {stats.jc}
                          <span style={{ color: C.muted }}> · </span>
                          {stats.shifts}
                          <span style={{ color: C.muted }}> ({stats.hours}h)</span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Dates — header H-scroll synced; body scrolls both ways */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div
            ref={headerScrollRef}
            className="shrink-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(e) => {
              if (syncingScroll.current) return;
              syncingScroll.current = true;
              if (scrollRef.current) scrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
              syncingScroll.current = false;
            }}
          >
            {dateHeader}
          </div>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#0A0A0A] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#404040]"
            onScroll={(e) => syncFromBody(e.currentTarget)}
            style={{ scrollbarColor: `${C.line} ${C.bg}` }}
          >
            <div style={{ width: datesWidth, minWidth: datesWidth, backgroundColor: C.bg }}>
              {groups.map((group) => (
                <div
                  key={`R-${group.processId || group.processName}`}
                  className="border-b"
                  style={{ borderColor: C.line }}
                >
                  <div
                    className="flex border-b"
                    style={{
                      width: datesWidth,
                      height: GROUP_H,
                      backgroundColor: C.bg2,
                      borderColor: C.line,
                    }}
                  >
                    {dateKeys.map((ymd) => (
                      <div
                        key={`pg-${group.processId}-${ymd}`}
                        data-cal-col={ymd === today ? today : undefined}
                        className="shrink-0 border-r"
                        style={{
                          width: dateW,
                          borderColor: C.line,
                          backgroundColor: ymd === today ? TODAY_COLUMN.bodyBg : C.bg2,
                        }}
                      />
                    ))}
                  </div>
                  {group.machines.map((mac, mIdx) => {
                    const rowBg = mIdx % 2 === 1 ? C.bg3 : C.bg;
                    const minJcDt = machineMinJobcarddt(cards, mac.machineKey);
                    const rowH = rowHeightForJcCount(
                      maxJcOnMachine(occupiedMap, mac.machineKey, dateKeys, shiftList)
                    );
                    return (
                      <div
                        key={`R-${group.processId}-${mac.machineKey}`}
                        className="flex"
                        style={{
                          width: datesWidth,
                          height: rowH,
                          backgroundColor: rowBg,
                          boxShadow: `inset 0 -2px 0 ${C.rowLine}`,
                        }}
                      >
                        {dateKeys.map((ymd) => (
                          <div
                            key={`cells-${mac.machineKey}-${ymd}`}
                            data-cal-col={ymd === today ? today : undefined}
                            className="flex shrink-0"
                            style={{ width: dateW }}
                          >
                            {shiftList.map((s) => (
                              <ShiftCell
                                key={s.id}
                                date={ymd}
                                shift={s.id}
                                shiftMeta={s}
                                machineKey={mac.machineKey}
                                machineLabel={fmtMachineLabel(mac.code, mac.name)}
                                occupiedMap={occupiedMap}
                                setupHrsMap={setupHrsMap}
                                cardByJc={cardByJc}
                                minJobcarddt={minJcDt}
                                canAdd={canAdd}
                                isToday={ymd === today}
                                todayKey={today}
                                onPlanSlot={onPlanSlot}
                                onRemoveSeg={onRemoveSeg}
                                shiftW={shiftW}
                                rowH={rowH}
                                rowBg={rowBg}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* <div className="z-10 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 bg-white px-3 py-1.5">
        <span className="text-[10px] font-semibold text-slate-500">
          {groups.length} processes · {groups.reduce((n, g) => n + g.machines.length, 0)} machines
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500 sm:ml-auto">
          <span className="inline-flex items-center gap-1.5"><span className="text-slate-300">+</span> Empty</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-emerald-600" /> Single</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-amber-500" /> Setup / multi</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm border border-dashed border-slate-300" /> Free</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> Past</span>
        </div>
      </div> */}

      <div className="z-10 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-1.5" style={{ backgroundColor: C.bg, borderColor: C.line, color: C.muted }} >
        <span className="text-[10px] font-semibold">
          {groups.length} processes · {groups.reduce((n, g) => n + g.machines.length, 0)} machines
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold sm:ml-auto">
          {CALENDAR_LEGEND.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              {item.kind === "plus" ? (
                <span style={{ color: item.swatch }}>+</span>
              ) : (
                <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: item.swatch }} />
              )}
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
