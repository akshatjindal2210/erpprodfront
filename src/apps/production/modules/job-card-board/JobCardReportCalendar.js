"use client";

/**
 * Job Card Calendar — same table size / color / font as CL Task Report
 * (ReportBookingCalendar). Y: Process → Machine · X: Date → S1/S2/S3
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SHIFTS, UNASSIGNED, toDateKey } from "@/apps/production/modules/job-card-board/board";
import { processStatusRows } from "@/apps/production/lib/constants/processStatus";
import { STICKY_SIZE, calendarShiftWidthPx } from "@/apps/production/lib/config/stickySize.config";

const SNO_W = STICKY_SIZE.snoWidthPx;
const LABEL_W_DEFAULT = STICKY_SIZE.labelWidthPx.default;
const LABEL_W_MIN = STICKY_SIZE.labelWidthPx.min;
const LABEL_W_MAX = STICKY_SIZE.labelWidthPx.max;
const ROW_H = STICKY_SIZE.rowHeightPx;
const GROUP_H = STICKY_SIZE.groupHeightPx;
const HEADER_H = STICKY_SIZE.headerHeightPx;
const CAL_Z = STICKY_SIZE.zIndex;

function useShiftWidth() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return calendarShiftWidthPx(w);
}

/** Same “today” column look as CL Task Report. */
export const TODAY_COLUMN = {
  headerBg: "bg-emerald-100",
  bodyBg: "bg-emerald-50",
  weekdayText: "text-emerald-900 font-black",
  dateText: "text-emerald-950 font-black",
};

/** Status tones — same shape as SCORE_CELL_TONES (bg-*-100 + border). */
const STATUS_CELL = {
  Pending: "bg-amber-100 text-amber-900 border-amber-300",
  Planning: "bg-sky-100 text-sky-950 border-sky-300",
  Running: "bg-violet-100 text-violet-950 border-violet-300",
  Hold: "bg-rose-100 text-rose-900 border-rose-300",
  Complete: "bg-emerald-100 text-emerald-900 border-emerald-400",
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

function formatDmy(ymd) {
  if (!ymd || ymd.length < 10) return ymd || "—";
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
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

/** One chip per card: date + shift + machine + home process only. */
function cellCards(cards, { processId, machineKey, date, shift }) {
  return cards.filter((c) => {
    if (c.date !== date) return false;
    if (Number(c.shift) !== Number(shift)) return false;
    const mid = c.machine_id == null ? UNASSIGNED : String(c.machine_id);
    if (mid !== String(machineKey)) return false;
    return String(resolveCardProcessId(c)) === String(processId || 0);
  });
}

/** Same button as CL score cell: h-5, text-[9px], rounded-sm, border. */
function MatrixCard({ card, canEdit, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(card.id),
    disabled: !canEdit,
    data: { card },
  });
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.25 : 1,
      }}
      className={`h-5 w-[calc(100%-2px)] truncate rounded-sm border px-0.5 text-[9px] font-semibold tabular-nums ${
        STATUS_CELL[card.status] || STATUS_CELL.Pending
      } ${canEdit ? "cursor-grab touch-none active:cursor-grabbing hover:bg-white/60" : "cursor-pointer hover:bg-white/60"} ${
        isDragging ? "pointer-events-none" : ""
      }`}
      title={`${card.job_card_no} · ${card.prime_item_code || "—"} · ${card.status}${card.qty ? ` · Qty ${Number(card.qty).toLocaleString()}` : ""}`}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onOpen?.(card);
      }}
      {...attributes}
      {...(canEdit ? listeners : {})}
    >
      {card.job_card_no}
    </button>
  );
}

function ShiftCell({ date, shift, machineKey, processId, cards, canEdit, isToday, onOpen, shiftW }) {
  const id = slotCellId(date, shift, machineKey);
  const { setNodeRef, isOver } = useDroppable({ id });
  const list = cellCards(cards, { processId, machineKey, date, shift });
  const primary = list[0];
  const extra = list.length > 1 ? list.length - 1 : 0;
  return (
    <div
      ref={setNodeRef}
      className={`relative flex shrink-0 items-center justify-center border-r border-slate-100 ${
        isToday ? TODAY_COLUMN.bodyBg : ""
      } ${isOver ? "z-[1] bg-indigo-100 ring-2 ring-inset ring-indigo-500" : ""}`}
      style={{ width: shiftW, height: ROW_H }}
    >
      {primary ? (
        <div className="relative flex w-full items-center justify-center px-px">
          <MatrixCard card={primary} canEdit={canEdit} onOpen={onOpen} />
          {extra > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 z-[2] flex h-3 min-w-[0.75rem] items-center justify-center rounded-sm bg-slate-700 px-0.5 text-[7px] font-black text-white">
              +{extra}
            </span>
          ) : null}
        </div>
      ) : isOver ? (
        <span className="flex h-5 w-[calc(100%-4px)] items-center justify-center rounded-sm border border-dashed border-indigo-400 bg-white text-[8px] font-bold uppercase text-indigo-700">
          Drop
        </span>
      ) : null}
    </div>
  );
}

function SummaryStrip({ cards = [], groups = [] }) {
  const stats = useMemo(() => {
    const machineSet = new Set();
    for (const g of groups) for (const m of g.machines) machineSet.add(m.machineKey);
    return {
      processes: groups.length,
      machines: machineSet.size,
      cards: cards.length,
      running: cards.filter((c) => c.status === "Running").length,
      complete: cards.filter((c) => c.status === "Complete").length,
      hold: cards.filter((c) => c.status === "Hold").length,
    };
  }, [cards, groups]);

  const items = [
    { key: "processes", label: "Processes", value: stats.processes, bar: "#4f46e5" },
    { key: "machines", label: "Machines", value: stats.machines, bar: "#696969" },
    { key: "cards", label: "Job Cards", value: stats.cards, bar: "#0284c7" },
    { key: "running", label: "Running", value: stats.running, bar: "#059669" },
    { key: "complete", label: "Complete", value: stats.complete, bar: "#047857" },
    { key: "hold", label: "Hold", value: stats.hold, bar: "#e11d48" },
  ];

  return (
    <div className="relative z-0 shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2">
      <div className="flex gap-2 overflow-x-auto pb-0.5 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-6 md:pb-0">
        {items.map(({ key, label, value, bar }) => (
          <div
            key={key}
            className="relative flex w-[9.5rem] shrink-0 flex-col justify-center border border-slate-200 bg-white px-2.5 py-1.5 md:w-auto md:min-w-0"
          >
            <span className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: bar }} />
            <p className="pl-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="pl-1.5 text-[14px] font-black tabular-nums leading-tight text-slate-800">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {{ dateKeys: string[], cards: any[], machines?: any[], processIds?: string[], machineIds?: string[], canEdit?: boolean, onOpen?: Function }} props
 */
export default function JobCardReportCalendar({
  dateKeys = [],
  cards = [],
  machines = [],
  processIds = [],
  machineIds = [],
  processOptions = [],
  canEdit = false,
  onOpen,
}) {
  const today = toDateKey(new Date());
  const scrollRef = useRef(null);
  const shiftW = useShiftWidth();
  const dateW = shiftW * SHIFTS.length;

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
  const gridWidth = leftSticky + dateKeys.length * dateW;
  const todayIdx = dateKeys.indexOf(today);

  const dayCardCount = useMemo(() => {
    const map = new Map();
    for (const ymd of dateKeys) map.set(ymd, 0);
    for (const c of cards) {
      if (c.date && map.has(c.date)) map.set(c.date, (map.get(c.date) || 0) + 1);
    }
    return map;
  }, [cards, dateKeys]);

  useEffect(() => {
    if (!scrollRef.current || todayIdx < 0) return;
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayIdx * dateW - 80);
    });
  }, [todayIdx, dateKeys, dateW]);

  if (!dateKeys.length) {
    return <p className="flex-1 bg-white py-10 text-center text-sm text-slate-400">No dates</p>;
  }

  if (!groups.length) {
    const filtered = processIds.length > 0 || machineIds.length > 0;
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-white">
        <SummaryStrip cards={cards} groups={[]} />
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-500">
            {filtered ? "No rows for this filter" : "No job cards in this window"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {filtered
              ? "Clear Process / Machine filters, or pick machines that exist on authorized cards."
              : "Authorize cards in Maintain Job Card, then they appear here."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-white">
      <SummaryStrip cards={cards} groups={groups} />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="min-h-full" style={{ minWidth: gridWidth }}>
          {/* Sticky header — same bands as CL Task Report */}
          <div
            className="sticky top-0 border-b border-slate-300 bg-white"
            style={{ minWidth: gridWidth, height: HEADER_H, zIndex: CAL_Z.stickyHeader }}
          >
            <div className="flex h-full">
              <div
                className="sticky left-0 flex shrink-0 border-r border-slate-300 bg-slate-50"
                style={{ width: leftSticky, zIndex: CAL_Z.stickyCorner }}
              >
                <div className="flex items-end justify-center border-r border-slate-200 pb-1" style={{ width: SNO_W }}>
                  <span className="text-[8px] font-bold uppercase text-slate-500">#</span>
                </div>
                <div className="relative flex shrink-0 items-end px-1.5 pb-1" style={{ width: labelW }}>
                  <span className="truncate pr-1 text-[8px] font-bold uppercase text-slate-500">Process / Machine</span>
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

              <div className="flex flex-1 flex-col">
                <div className="flex h-[16px] border-b border-slate-100">
                  {dateKeys.map((ymd) => {
                    const weekend = isWeekendYmd(ymd);
                    const isToday = ymd === today;
                    return (
                      <div
                        key={`wd-${ymd}`}
                        className={`flex shrink-0 items-center justify-center border-r border-slate-100 ${
                          isToday ? TODAY_COLUMN.headerBg : weekend ? "bg-rose-50/40" : ""
                        }`}
                        style={{ width: dateW }}
                      >
                        <span
                          className={`text-[8px] leading-none ${
                            weekend
                              ? "font-bold text-rose-600"
                              : isToday
                                ? TODAY_COLUMN.weekdayText
                                : "font-bold text-slate-500"
                          }`}
                        >
                          {weekdayLong(ymd)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex h-[18px] border-b border-slate-100">
                  {dateKeys.map((ymd) => {
                    const weekend = isWeekendYmd(ymd);
                    const isToday = ymd === today;
                    const dmy = formatDmy(ymd);
                    return (
                      <div
                        key={`dn-${ymd}`}
                        title={`${weekdayLong(ymd)} · ${dmy}`}
                        className={`flex shrink-0 items-center justify-center border-r border-slate-100 px-0.5 ${
                          isToday ? TODAY_COLUMN.headerBg : weekend ? "bg-rose-50/30" : ""
                        }`}
                        style={{ width: dateW }}
                      >
                        <span
                          className={`text-center text-[9px] tabular-nums leading-tight ${
                            isToday
                              ? TODAY_COLUMN.dateText
                              : weekend
                                ? "font-bold text-rose-600"
                                : "font-bold text-slate-800"
                          }`}
                        >
                          {dmy}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-1">
                  {dateKeys.map((ymd) => {
                    const weekend = isWeekendYmd(ymd);
                    const isToday = ymd === today;
                    const count = dayCardCount.get(ymd) || 0;
                    return (
                      <div key={`sh-${ymd}`} className="flex shrink-0 border-r border-slate-100" style={{ width: dateW }}>
                        {SHIFTS.map((s) => (
                          <div
                            key={s.id}
                            title={`${weekdayLong(ymd)} · ${s.label} · ${count} cards`}
                            className={`flex shrink-0 items-center justify-center border-r border-slate-100 last:border-r-0 px-0.5 ${
                              isToday ? TODAY_COLUMN.headerBg : weekend ? "bg-rose-50/20" : "bg-slate-50/80"
                            }`}
                            style={{ width: shiftW }}
                          >
                            <span
                              className={`text-[8px] font-black tabular-nums ${
                                count > 0 ? "text-amber-700" : "text-slate-500"
                              }`}
                            >
                              {s.short}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.processId || group.processName} className="border-b border-slate-200">
              {/* Process = CL user group row */}
              <div className="flex border-b border-slate-200 bg-slate-100" style={{ minWidth: gridWidth, height: GROUP_H }}>
                <div
                  className="sticky left-0 flex shrink-0 border-r border-slate-300 bg-slate-100"
                  style={{ width: leftSticky, zIndex: CAL_Z.stickyBodyLeft }}
                >
                  <div
                    className="flex items-center justify-center border-r border-slate-200 text-[10px] font-bold tabular-nums text-slate-700"
                    style={{ width: SNO_W }}
                  >
                    {group.sno}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5">
                    <p className="min-w-0 truncate text-[10px] font-bold text-slate-900" title={group.processName}>
                      {group.processName}
                      <span className="font-medium text-slate-500">
                        {" "}
                        · {group.machines.length} M/C
                      </span>
                    </p>
                    {/* <span className="shrink-0 border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-black tabular-nums text-amber-700">
                      {group.cardCount}
                    </span> */}
                  </div>
                </div>
                {dateKeys.map((ymd) => (
                  <div
                    key={`pg-${group.processId}-${ymd}`}
                    className={`shrink-0 border-r border-slate-100 ${ymd === today ? TODAY_COLUMN.bodyBg : ""}`}
                    style={{ width: dateW }}
                  />
                ))}
              </div>

              {/* Machines = CL task rows */}
              {group.machines.map((mac, mIdx) => {
                const zebra = mIdx % 2 === 1;
                return (
                  <div
                    key={`${group.processId}-${mac.machineKey}`}
                    className={`flex border-b border-slate-100 ${zebra ? "bg-slate-50/40" : "bg-white"}`}
                    style={{ minWidth: gridWidth, height: ROW_H }}
                  >
                    <div
                      className={`sticky left-0 flex shrink-0 border-r border-slate-300 ${
                        zebra ? "bg-slate-50" : "bg-white"
                      }`}
                      style={{ width: leftSticky, zIndex: CAL_Z.stickyBodyLeft }}
                    >
                      <div className="border-r border-slate-100" style={{ width: SNO_W }} />
                      <div className="flex min-w-0 flex-1 items-center px-1.5 pl-2">
                        <p className="truncate text-[9px] font-semibold text-slate-700" title={`${mac.code} — ${mac.name}`}>
                          {mac.code ? `${mac.code} · ` : ""}
                          {mac.name}
                        </p>
                      </div>
                    </div>

                    {dateKeys.map((ymd) => (
                      <div key={`cells-${mac.machineKey}-${ymd}`} className="flex shrink-0" style={{ width: dateW }}>
                        {SHIFTS.map((s) => (
                          <ShiftCell
                            key={s.id}
                            date={ymd}
                            shift={s.id}
                            machineKey={mac.machineKey}
                            processId={group.processId}
                            cards={cards}
                            canEdit={canEdit}
                            isToday={ymd === today}
                            onOpen={onOpen}
                            shiftW={shiftW}
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

      <div className="z-10 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-300 bg-slate-50 px-2 py-1.5 sm:px-3">
        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
          {groups.length} processes · {groups.reduce((n, g) => n + g.machines.length, 0)} machines · {cards.length} cards
        </span>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] font-bold uppercase tracking-wide text-slate-600 sm:mx-auto">
          {[
            ["Pending", STATUS_CELL.Pending],
            ["Planning", STATUS_CELL.Planning],
            ["Running", STATUS_CELL.Running],
            ["Hold", STATUS_CELL.Hold],
            ["Complete", STATUS_CELL.Complete],
          ].map(([label, cls]) => (
            <span key={label} className="inline-flex items-center gap-1">
              <span className={`h-3 w-3 shrink-0 rounded-sm border ${cls}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
