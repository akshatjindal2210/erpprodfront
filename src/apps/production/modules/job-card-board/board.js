/**
 * Job Card Board + Calendar — authorized cards only (Maintain Job Card → Approve).
 * approved = gate · status = Pending|Planning|Running|Hold|Complete
 */
import { jobCardService } from "@/apps/production/lib/services/jobCard";
import { machineMasterService } from "@/apps/engineering/lib/services/machineMaster";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";

export const UNASSIGNED = "unassigned";
export const SHIFTS = [
  { id: 1, label: "Shift 1", short: "S1" },
  { id: 2, label: "Shift 2", short: "S2" },
  { id: 3, label: "Shift 3", short: "S3" },
];
export const RANGE_MODES = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "2months", label: "2 Months" },
];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const STATUS_OPTS = ["Pending", "Planning", "Running", "Hold", "Complete"];

const MOD = "production_job_card";

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

function isAuthorized(row) {
  const ok = row?.approved === true || row?.approved === 1 || row?.approved === "true";
  return ok && parsePlan(row).length > 0;
}

function toCard(row) {
  const plan = parsePlan(row);
  const stage = firstStage(plan);
  const macs = stageMachines(stage);
  // Same as ViewDrawer: first stage process + that stage's machine_name only (not all stages)
  const machine = (stage?.machines || [])
    .map((m) => m.machine_name || m.macname || m.name)
    .filter(Boolean)
    .join(", ") || null;
  return {
    id: String(row.docno),
    docno: Number(row.docno),
    job_card_no: row.job_card_no || row.pjobcardno || `JC-${row.docno}`,
    prime_item_code: row.prime_item_code || null,
    title: row.prime_item_desc || row.remarks || null,
    process: stage?.process_name || null,
    machine,
    machines: macs.map((m) => m.name),
    machine_id: macs[0]?.id ?? null,
    qty: Number(row.qty) || 0,
    status: row.status || "Pending",
    date: toDateKey(row.pldt || row.job_date || row.doc_dt),
    shift: [1, 2, 3].includes(Number(row.schedule_shift)) ? Number(row.schedule_shift) : 1,
    position: 0,
    approved: Boolean(row.approved),
    stages: plan.length,
  };
}

export function machineBusyStatus(machineId, cards) {
  const on = cards.filter((c) => Number(c.machine_id) === Number(machineId));
  if (on.some((c) => c.status === "Running")) return "running";
  if (on.some((c) => c.status === "Hold")) return "down";
  return "idle";
}

async function loadAuthorizedCards() {
  const res = await jobCardService.getRegister({ approved: true });
  return (Array.isArray(res?.data) ? res.data : []).filter(isAuthorized).map(toCard);
}

async function loadMachines() {
  const res = await machineMasterService.getViews({ ...helperPerms(MOD, "view"), page: 1, limit: 1000 });
  return (res?.data || [])
    .map((m) => ({ id: Number(m.id), code: m.number || String(m.id), name: m.name || m.macname || m.label || `Machine ${m.id}` }))
    .filter((m) => m.id);
}

/** Board: machine columns + authorized cards. */
export async function fetchBoard() {
  const [rows, machineList] = await Promise.all([
    jobCardService.getRegister({ approved: true }),
    loadMachines(),
  ]);
  const raw = (Array.isArray(rows?.data) ? rows.data : []).filter(isAuthorized);
  const cards = raw.map(toCard);
  const byId = new Map(machineList.map((m) => [m.id, { ...m }]));
  for (const row of raw) {
    for (const m of stageMachines(firstStage(parsePlan(row)))) {
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

/** Calendar: same authorized cards. */
export async function fetchCalendar() {
  return { cards: await loadAuthorizedCards() };
}

export async function updateJobCardStatus(jobCardId, status) {
  const docno = Number(jobCardId);
  if (!docno) throw new Error("Invalid job card.");
  if (!["Running", "Hold", "Complete"].includes(status)) throw new Error("Invalid status.");
  await jobCardService.update(docno, { status });
}

export async function updateJobCardSchedule(jobCardId, dateKey, shift) {
  const docno = Number(jobCardId);
  const day = toDateKey(dateKey);
  const schedule_shift = Number(shift);
  if (!docno || !day || ![1, 2, 3].includes(schedule_shift)) throw new Error("Invalid schedule.");
  await jobCardService.update(docno, { pldt: day, schedule_shift });
}

/** Drag on board → first stage: swap the source machine for the target (other multi-JC machines stay). Keeps authorization. */
export async function updateJobCardPosition(jobCardId, toMachineId, fromMachineId = null) {
  const docno = Number(jobCardId);
  if (!docno) throw new Error("Invalid job card.");
  const card = (await jobCardService.getById(docno))?.data;
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
  await jobCardService.update(docno, { process_plan: picks, machine_move: true });
}
