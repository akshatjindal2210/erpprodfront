/**
 * Job Card Board + Calendar — rows from prod_plan (synced on authorized JC).
 */
import { jobCardService } from "@/apps/production/lib/services/jobCard";
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
const EDIT = () => helperPerms(MOD, "edit");

/** prod_jc.docno from a board/calendar card (never prod_plan line id). */
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

async function loadMachines() {
  const res = await machineMasterService.getViews({ ...VIEW(), page: 1, limit: 1000 });
  return (res?.data || [])
    .map((m) => ({ id: Number(m.maccode), code: m.macno || String(m.maccode), name: m.macname || m.label || `Machine ${m.maccode}` }))
    .filter((m) => m.id);
}

/** Board: machine columns + prod_plan lines. */
export async function fetchBoard() {
  const [cards, machineList] = await Promise.all([fetchPlanLines(), loadMachines()]);
  const byId = new Map(machineList.map((m) => [m.id, { ...m }]));
  for (const c of cards) {
    for (const m of stageMachines(firstStage(c.process_plan))) {
      if (!byId.has(m.id)) byId.set(m.id, { id: m.id, code: String(m.id), name: m.name });
    }
  }
  const machines = [...byId.values()]
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

export async function updateJobCardStatus(jobCardId, status) {
  const docno = typeof jobCardId === "object" ? resolveJobCardDocno(jobCardId) : Number(jobCardId);
  if (!docno) throw new Error("Invalid job card.");
  if (!["Running", "Hold", "Complete"].includes(status)) throw new Error("Invalid status.");
  await jobCardService.update(docno, { status, ...EDIT() });
}

export async function updateJobCardSchedule(jobCardId, dateKey, shift) {
  const docno = typeof jobCardId === "object" ? resolveJobCardDocno(jobCardId) : Number(jobCardId);
  const day = toDateKey(dateKey);
  const schedule_shift = Number(shift);
  if (!docno || !day || !isValidShift(schedule_shift)) throw new Error("Invalid schedule.");
  await jobCardService.update(docno, { jobcarddt: day, schedule_shift, ...EDIT() });
}

/** Drag on board → first stage: swap the source machine for the target (other multi-JC machines stay). Keeps authorization. */
export async function updateJobCardPosition(jobCardId, toMachineId, fromMachineId = null) {
  const docno = typeof jobCardId === "object" ? resolveJobCardDocno(jobCardId) : Number(jobCardId);
  if (!docno) throw new Error("Invalid job card.");
  const card = (await jobCardService.getById(docno, VIEW()))?.data;
  if (!card) throw new Error("Job card not found.");
  const plan = parsePlan(card);
  if (!plan.length) throw new Error("Save a process plan on Maintain Job Card first.");
  const first = firstStage(plan);
  const firstNo = Number(first.stage_no);
  const targetId = toMachineId == null || toMachineId === UNASSIGNED ? null : Number(toMachineId);
  const picks = plan.map((s) => {
    const rm_item_dcodes = (s.rm_items || []).map((r) => Number(r.rm_item_dcode)).filter(Boolean);
    const currentIds = (s.machines || []).map((m) => Number(m.machine_id)).filter(Boolean);
    return {
      stage_no: s.stage_no,
      process_id: s.process_id,
      machine_ids:
        Number(s.stage_no) !== firstNo
          ? currentIds
          : currentIds.includes(Number(fromMachineId))
            ? [...new Set(currentIds.map((id) => (id === Number(fromMachineId) ? targetId : id)))]
            : [targetId],
      rm_item_dcodes,
    };
  });
  await jobCardService.update(docno, { process_plan: picks, machine_move: true, ...EDIT() });
}
