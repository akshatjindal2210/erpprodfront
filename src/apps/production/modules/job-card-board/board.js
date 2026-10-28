/**
 * Job Card Board + Calendar — rows from prod_plan (synced on authorized JC).
 */
import { planService } from "@/apps/production/lib/services/plan";
import { fetchPlanLines } from "@/apps/production/modules/plan/planTable";
import { machineMasterService } from "@/apps/engineering/lib/services/machineMaster";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";
import { processStatusRows } from "@/apps/production/lib/constants/processStatus";
import { SHIFTS, SHIFT_HOURS, SHIFTS_PER_DAY, isValidShift } from "@/apps/production/modules/jc/jobCard.config";

export const UNASSIGNED = "unassigned";
/** Board / Calendar permission module (not Maintain Job Card). */
export const PLANNING_MODULE = "production_planning";
export { SHIFTS, SHIFT_HOURS, SHIFTS_PER_DAY, isValidShift };
export const RANGE_MODES = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "2months", label: "2 Months" },
];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const STATUS_OPTS = ["Pending", "Planning", "Running", "Hold", "Complete"];
/** Stable filter options for Board / Plan toolbar (avoid new array each render). */
export const STATUS_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  ...STATUS_OPTS.map((s) => ({ label: s, value: s })),
];

const MOD = PLANNING_MODULE;
const VIEW = () => helperPerms(MOD, "view");

/** prod_plan.docno from a board/calendar card. */
export function resolvePlanLineDocno(card) {
  const n = Number(card?.planLineDocno ?? card?.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** prod_jc.docno (history / rare JC links only — Planning writes use plan line). */
export function resolveJobCardDocno(card) {
  const n = Number(card?.docno ?? card?.job_card_docno);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function toDateKey(v) {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

export function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date, n) {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function dayMeta(d, inMonth = true) {
  return {
    key: toDateKey(d),
    date: d,
    label: d.toLocaleDateString(undefined, { weekday: "short" }),
    dayNum: d.getDate(),
    month: d.toLocaleDateString(undefined, { month: "short" }),
    year: d.getFullYear(),
    inMonth: Boolean(inMonth),
  };
}

export function weekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => dayMeta(addDays(weekStart, i), true));
}

export function monthTitle(m) {
  return startOfMonth(m).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function monthGrid(monthStart) {
  const first = startOfMonth(monthStart);
  const mo = first.getMonth();
  const yr = first.getFullYear();
  let cursor = startOfWeek(first);
  const weeks = [];
  for (let w = 0; w < 6; w += 1) {
    const row = [];
    for (let i = 0; i < 7; i += 1) {
      row.push(dayMeta(new Date(cursor), cursor.getMonth() === mo && cursor.getFullYear() === yr));
      cursor = addDays(cursor, 1);
    }
    weeks.push(row);
    if (cursor.getMonth() !== mo || cursor.getFullYear() !== yr) {
      if (!row.some((d) => d.inMonth) && w > 0) weeks.pop();
      break;
    }
  }
  return { title: monthTitle(first), monthKey: `${yr}-${String(mo + 1).padStart(2, "0")}`, weeks };
}

export function rangeDateKeys(anchor, range) {
  if (range === "week") return weekDays(startOfWeek(anchor)).map((d) => d.key);
  const months = range === "2months" ? [startOfMonth(anchor), addMonths(anchor, 1)] : [startOfMonth(anchor)];
  return [...new Set(months.flatMap((m) => monthGrid(m).weeks.flatMap((w) => w.filter((d) => d.inMonth).map((d) => d.key))))];
}

export function rangeLabel(anchor, range) {
  if (range === "week") {
    const days = weekDays(startOfWeek(anchor));
    return `${days[0].dayNum} ${days[0].month} – ${days[6].dayNum} ${days[6].month} ${days[6].year}`;
  }
  if (range === "2months") return `${monthTitle(anchor)} · ${monthTitle(addMonths(anchor, 1))}`;
  return monthTitle(anchor);
}

export function stepAnchor(anchor, range, dir) {
  if (range === "week") return addDays(startOfWeek(anchor), dir * 7);
  return addMonths(startOfMonth(anchor), dir * (range === "2months" ? 2 : 1));
}

function parsePlan(row) {
  let p = row?.process_plan;
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch {
      return [];
    }
  }
  return Array.isArray(p) ? p : [];
}

function firstStage(plan) {
  const stages = [...parsePlan({ process_plan: plan })].sort((a, b) => Number(a.stage_no) - Number(b.stage_no));
  return stages[0] || null;
}

function stageMachines(stage) {
  return (stage?.machines || [])
    .map((m) => ({ id: Number(m.machine_id), name: m.machine_name || m.macname || m.name || `Machine ${m.machine_id}` }))
    .filter((m) => m.id);
}

/** Unique process options from board cards (for ProductionFilters). */
export function collectProcessOptions(cards = []) {
  const map = new Map();
  for (const c of cards) {
    if (c.processId != null && c.process) {
      map.set(c.processId, { label: c.process, value: String(c.processId) });
    }
    for (const p of processStatusRows(c.process_plan)) {
      if (!map.has(p.processId)) map.set(p.processId, { label: p.processName, value: String(p.processId) });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Card matches process multi-filter (empty = all). */
export function cardMatchesProcessFilter(card, processIds = []) {
  if (!processIds.length) return true;
  if (processIds.length === 1 && processIds[0] === "__none__") return false;
  const ids = new Set(processIds.map(String));
  const list = processStatusRows(card?.process_plan);
  if (list.length) return list.some((p) => ids.has(String(p.processId)));
  return false;
}

/**
 * Card matches machine multi-filter (empty = all; `__none__` = none).
 * @param {{ fromPlan?: boolean }} opts — board: also match process_plan machines so TP filter still finds the card.
 */
export function cardMatchesMachineFilter(card, machineIds = [], opts = {}) {
  if (!machineIds.length) return true;
  if (machineIds.length === 1 && machineIds[0] === "__none__") return false;
  const ids = new Set(machineIds.map(String));
  if (card?.machine_id == null) {
    if (ids.has(UNASSIGNED)) return true;
  } else if (ids.has(String(card.machine_id))) {
    return true;
  }
  if (!opts.fromPlan) return false;
  const plan = Array.isArray(card?.process_plan) ? card.process_plan : [];
  for (const stage of plan) {
    for (const m of stage?.machines || []) {
      if (m?.machine_id != null && ids.has(String(m.machine_id))) return true;
    }
  }
  return false;
}

/** Machines linked to selected processes (from cards' process_plan). */
export function machineIdsForProcesses(cards = [], processIds = []) {
  if (!processIds.length || (processIds.length === 1 && processIds[0] === "__none__")) return null;
  const want = new Set(processIds.map(String));
  const out = new Set();
  for (const card of cards) {
    const plan = Array.isArray(card?.process_plan) ? card.process_plan : [];
    for (const stage of plan) {
      if (!want.has(String(stage?.process_id))) continue;
      for (const m of stage?.machines || []) {
        if (m?.machine_id != null) out.add(String(m.machine_id));
      }
    }
  }
  return out;
}

/**
 * Which board column a card belongs in.
 * Prefer scheduled machine_id; if that column is filtered out, use first visible plan machine.
 * @param {Set<string>|null} visibleColIds — null = no machine/process column filter
 */
export function resolveBoardColumnId(card, visibleColIds = null) {
  const primary = card?.machine_id == null || card?.machine_id === "" ? UNASSIGNED : String(card.machine_id);
  if (!visibleColIds) return primary;
  if (visibleColIds.has(primary)) return primary;
  const plan = Array.isArray(card?.process_plan) ? card.process_plan : [];
  for (const stage of plan) {
    for (const m of stage?.machines || []) {
      const id = m?.machine_id != null ? String(m.machine_id) : null;
      if (id && visibleColIds.has(id)) return id;
    }
  }
  return null;
}

export function machineBusyStatus(machineId, cards) {
  const on = cards.filter((c) => Number(c.machine_id) === Number(machineId));
  if (on.some((c) => c.status === "Running")) return "running";
  if (on.some((c) => c.status === "Hold")) return "down";
  return "idle";
}

/** Board column order: Running always top, then Hold, queue, Complete last. */
const BOARD_STATUS_RANK = { Running: 0, Hold: 1, Pending: 2, Planning: 2, Complete: 9 };

export function sortBoardColumn(cards = []) {
  return [...cards].sort((a, b) => {
    const ra = BOARD_STATUS_RANK[a.status] ?? 5;
    const rb = BOARD_STATUS_RANK[b.status] ?? 5;
    if (ra !== rb) return ra - rb;
    const pa = Number(a.position);
    const pb = Number(b.position);
    if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) return pa - pb;
    return String(a.date || "").localeCompare(String(b.date || ""));
  });
}

/** Cards in one machine column, top → bottom (Running pinned to top). */
export function columnQueue(cards = [], machineId) {
  const key = machineId == null || machineId === "" || machineId === UNASSIGNED ? UNASSIGNED : String(machineId);
  return sortBoardColumn(
    cards.filter((c) => {
      const id = c.machine_id == null || c.machine_id === "" ? UNASSIGNED : String(c.machine_id);
      return id === key;
    })
  );
}

/** First shift slot after a job that used `shiftCount` shifts from (startDate, startShift). */
export function nextSlotAfter(startDate, startShift, shiftCount) {
  const n = Math.max(0, Math.floor(Number(shiftCount) || 0));
  const perDay = Math.max(1, SHIFTS_PER_DAY);
  if (!startDate) return null;
  const s0 = isValidShift(startShift) ? Number(startShift) : 1;
  const nextIndex = s0 - 1 + Math.max(n, 1);
  const dayOffset = Math.floor(nextIndex / perDay);
  const shift = (nextIndex % perDay) + 1;
  const d = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, shift };
}

function estimateEndDate(startDate, startShift, shiftCount) {
  const n = Math.max(0, Math.floor(Number(shiftCount) || 0));
  const perDay = Math.max(1, SHIFTS_PER_DAY);
  if (!startDate || !n) return startDate || null;
  const s0 = isValidShift(startShift) ? Number(startShift) : 1;
  const endIndex = s0 - 1 + n - 1;
  const dayOffset = Math.floor(endIndex / perDay);
  const d = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * FIFO board rules (per machine column):
 * - At most one Running
 * - Start only if nothing Running, and every card above is Complete or Hold
 * - Hold only while Running
 * - Complete while Running or Hold
 */
export function canFifoAction(card, columnCards, key) {
  if (!card || card.status === "Complete") return false;
  const ordered = sortBoardColumn(columnCards || []);
  const running = ordered.find((c) => c.status === "Running");

  if (key === "hold") return card.status === "Running";
  if (key === "complete") return card.status === "Running" || card.status === "Hold";

  if (key === "start") {
    if (card.status === "Running") return false;
    if (running) return false;
    for (const c of ordered) {
      if (String(c.id) === String(card.id)) return true;
      if (c.status === "Complete" || c.status === "Hold") continue;
      return false; // Pending / Planning still above — FIFO
    }
    return false;
  }
  return false;
}

export function columnHasRunning(columnCards = []) {
  return columnCards.some((c) => c.status === "Running");
}

/**
 * After drag reorder (nothing Running): anchor = previous column head start slot;
 * each card gets that window in order, then the next starts after est_shifts.
 */
export function cascadeColumnSchedules(orderedCards = [], anchor = {}) {
  if (!orderedCards.length) return [];
  let date = anchor.date || orderedCards[0].date || toDateKey(new Date());
  let shift = isValidShift(anchor.shift) ? Number(anchor.shift) : isValidShift(orderedCards[0].shift) ? Number(orderedCards[0].shift) : 1;
  const out = [];
  for (const card of orderedCards) {
    const est = Math.max(1, Math.floor(Number(card.est_shifts) || 1));
    const estimate_date = estimateEndDate(date, shift, est);
    out.push({
      ...card,
      date,
      shift,
      estimate_date,
      est_shifts: Number(card.est_shifts) > 0 ? Number(card.est_shifts) : est,
    });
    const next = nextSlotAfter(date, shift, est);
    if (!next) break;
    date = next.date;
    shift = next.shift;
  }
  return out;
}

async function loadMachines() {
  const res = await machineMasterService.getViews({ ...VIEW(), page: 1, limit: 1000 });
  return (res?.data || [])
    .map((m) => ({
      id: Number(m.maccode),
      code: m.macno || String(m.maccode),
      name: m.macname || m.label || `Machine ${m.maccode}`,
      /** Process this machine belongs to (macproccode) — board DnD only within same process. */
      processId: m.macproccode != null ? Number(m.macproccode) : null,
    }))
    .filter((m) => m.id);
}

/** Machine ids allowed for this plan line's process (JC plan ∪ master macproccode). */
export function allowedMachineIdsForCard(card, machines = []) {
  const processId = Number(card?.processId);
  if (!Number.isFinite(processId) || processId <= 0) return new Set();
  const ids = new Set();
  const plan = Array.isArray(card?.process_plan) ? card.process_plan : [];
  for (const stage of plan) {
    if (Number(stage?.process_id) !== processId) continue;
    for (const m of stage?.machines || []) {
      if (m?.machine_id != null) ids.add(String(m.machine_id));
    }
  }
  for (const m of machines) {
    if (Number(m.processId) === processId) ids.add(String(m.id));
  }
  return ids;
}

/** Packing → Packing M/C only; Rolling → Rolling M/C only (incl. PACK→PACK-C1). */
export function canMoveCardToMachine(card, toMachineId, machines = []) {
  if (toMachineId == null || toMachineId === "" || toMachineId === UNASSIGNED) return false;
  return allowedMachineIdsForCard(card, machines).has(String(toMachineId));
}

/** JC-selected machine for this process, else first master machine of that process. */
export function preferredMachineIdForCard(card, machines = []) {
  const processId = Number(card?.processId);
  const plan = Array.isArray(card?.process_plan) ? card.process_plan : [];
  const stage = plan.find((s) => Number(s?.process_id) === processId);
  const fromJc = (stage?.machines || []).map((m) => Number(m.machine_id)).filter((id) => id > 0);
  if (fromJc.length) return fromJc[0];
  const m = machines.find((x) => Number(x.processId) === processId);
  return m?.id ?? null;
}

/**
 * Only heal when card is clearly on another process's machine
 * (e.g. Rolling sitting on PACK). Same-process alts like PACK-C1 stay.
 */
export function healCardMachineMismatch(card, machines = []) {
  const processId = Number(card?.processId);
  const curId = card?.machine_id;
  if (!Number.isFinite(processId) || processId <= 0) return { card, changed: false };
  if (curId == null || curId === "" || curId === UNASSIGNED) return { card, changed: false };

  const curMac = machines.find((x) => Number(x.id) === Number(curId));
  const curProc = curMac != null ? Number(curMac.processId) : NaN;
  if (Number.isFinite(curProc) && curProc === processId) return { card, changed: false };
  if (canMoveCardToMachine(card, curId, machines)) return { card, changed: false };

  const mid = preferredMachineIdForCard(card, machines);
  if (mid == null || Number(mid) === Number(curId)) return { card, changed: false };
  const mac = machines.find((x) => Number(x.id) === Number(mid));
  return {
    card: {
      ...card,
      machine_id: Number(mid),
      machine: mac?.name || card.machine,
      machines: mac?.name ? [mac.name] : card.machines,
    },
    changed: true,
  };
}

/** Board: machine columns + prod_plan lines. */
export async function fetchBoard() {
  const [rawCards, machineList] = await Promise.all([fetchPlanLines(), loadMachines()]);
  const byId = new Map(machineList.map((m) => [m.id, { ...m }]));
  for (const c of rawCards) {
    for (const m of stageMachines(firstStage(c.process_plan))) {
      if (!byId.has(m.id)) byId.set(m.id, { id: m.id, code: String(m.id), name: m.name, processId: null });
    }
  }
  const machineListFull = [...byId.values()];

  const healedWrites = [];
  const cards = rawCards.map((raw) => {
    const { card, changed } = healCardMachineMismatch(raw, machineListFull);
    if (changed) healedWrites.push(card);
    return card;
  });

  if (healedWrites.length) {
    await Promise.all(
      healedWrites.map((c) => updatePlanLineMachine(c, c.machine_id).catch(() => null))
    );
  }

  const machines = machineListFull
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
    .map((m) => ({ ...m, status: machineBusyStatus(m.id, cards) }));

  const grouped = new Map();
  for (const c of cards) {
    const key = c.machine_id == null ? UNASSIGNED : String(c.machine_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(c);
  }
  const positioned = [];
  for (const list of grouped.values()) list.forEach((c, i) => positioned.push({ ...c, position: i }));
  return { machines, cards: positioned };
}

/** Calendar: prod_plan lines (+ machines for shared filters). */
export async function fetchCalendar() {
  const [cards, machineList] = await Promise.all([fetchPlanLines(), loadMachines()]);
  return { cards, machines: machineList };
}

/** Start / Hold / Complete → prod_plan.status (+ actual_start / actual_end on backend). */
export async function updatePlanLineStatus(cardOrId, status) {
  const docno = typeof cardOrId === "object" ? resolvePlanLineDocno(cardOrId) : Number(cardOrId);
  const st = String(status || "").toLowerCase();
  if (!docno) throw new Error("Invalid plan line.");
  if (!["running", "hold", "complete", "pending", "planning"].includes(st)) throw new Error("Invalid status.");
  await planService.update(docno, { status: st });
}

/** Calendar / reorder → prod_plan.plan_start (and plan_end when provided). */
export async function updatePlanLineSchedule(cardOrId, dateKey, planEnd = undefined) {
  const docno = typeof cardOrId === "object" ? resolvePlanLineDocno(cardOrId) : Number(cardOrId);
  const day = toDateKey(dateKey);
  if (!docno || !day) throw new Error("Invalid schedule.");
  const body = { plan_start: day };
  if (planEnd != null) body.plan_end = toDateKey(planEnd) || planEnd;
  await planService.update(docno, body);
}

/** Board column drag → prod_plan.maccode only. */
export async function updatePlanLineMachine(cardOrId, toMachineId) {
  const docno = typeof cardOrId === "object" ? resolvePlanLineDocno(cardOrId) : Number(cardOrId);
  if (!docno) throw new Error("Invalid plan line.");
  const maccode = toMachineId == null || toMachineId === UNASSIGNED ? null : Number(toMachineId);
  await planService.update(docno, { maccode });
}

/** @deprecated — use updatePlanLineStatus */
export async function updateJobCardStatus(cardOrId, status) {
  const map = { Running: "running", Hold: "hold", Complete: "complete" };
  await updatePlanLineStatus(cardOrId, map[status] || status);
}

/** @deprecated — use updatePlanLineSchedule */
export async function updateJobCardSchedule(cardOrId, dateKey) {
  await updatePlanLineSchedule(cardOrId, dateKey);
}

/** @deprecated — use updatePlanLineMachine */
export async function updateJobCardPosition(cardOrId, toMachineId) {
  await updatePlanLineMachine(cardOrId, toMachineId);
}
