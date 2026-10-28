import { planService } from "@/apps/production/lib/services/plan";
import { jobCardService } from "@/apps/production/lib/services/jobCard";
import { machineMasterService } from "@/apps/engineering/lib/services/machineMaster";
import { PROCESS_STATUS_LABELS } from "@/apps/production/lib/constants/processStatus";
import { SHIFTS, isValidShift } from "@/apps/production/modules/jc/jobCard.config";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";

const PLANNING_MODULE = "production_planning";
const perms = (action) => helperPerms(PLANNING_MODULE, action);

function dt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Board / Calendar card from one prod_plan row. */
export function mapPlanRowToBoardCard(r) {
  const statusKey = String(r.status || "pending").toLowerCase();
  const proccode = Number(r.proccode);
  const maccode = r.maccode != null ? Number(r.maccode) : null;
  const planStart = r.plan_start ? String(r.plan_start).slice(0, 10) : null;
  const shift = isValidShift(r.plan_shift) ? Number(r.plan_shift) : 1;
  const processName = r.process_name || String(proccode);
  const machineName = r.machine_name || "—";
  const miniPlan = [
    {
      stage_no: r.stage_no,
      process_id: proccode,
      process_name: processName,
      machines: maccode != null ? [{ machine_id: maccode, machine_name: machineName, status: statusKey }] : [],
    },
  ];
  const jcDocno = Number(r.job_card_docno);
  return {
    /** prod_plan.docno — DnD / React key only; never use for JC API */
    id: String(r.docno),
    planLineDocno: Number(r.docno),
    /** prod_jc.docno — all get/update JC calls */
    docno: jcDocno,
    job_card_docno: jcDocno,
    job_card_no: r.pjobcardno || (jcDocno ? `JC-${jcDocno}` : "—"),
    prime_item_code: r.prime_item_code || null,
    prime_item_dcode: r.prime_item_dcode ?? r.itemdcode ?? null,
    title: processName,
    process: processName,
    machine: machineName,
    machines: maccode != null ? [machineName] : [],
    machine_id: maccode,
    qty: Number(r.qty) || 0,
    status: PROCESS_STATUS_LABELS[statusKey] || "Pending",
    date: planStart,
    shift,
    est_shifts: null,
    estimate_date: r.plan_end ? String(r.plan_end).slice(0, 10) : null,
    position: 0,
    approved: true,
    stages: 1,
    process_plan: miniPlan,
    process_ids: [proccode],
    processId: proccode,
  };
}

/** All prod_plan lines (production_planning views). */
export async function fetchPlanLines() {
  const res = await planService.getTable();
  return (res?.data || []).map(mapPlanRowToBoardCard);
}

function mapRow(r) {
  const statusKey = String(r.status || "pending").toLowerCase();
  const day = r.plan_start ? String(r.plan_start).slice(0, 10) : "";
  const sh = isValidShift(r.plan_shift) ? SHIFTS.find((x) => x.id === Number(r.plan_shift))?.short : "";
  return {
    id: String(r.docno),
    docno: Number(r.job_card_docno),
    job_card_no: r.pjobcardno || "—",
    prime_item_code: r.prime_item_code || null,
    stage: r.stage_no,
    processId: Number(r.proccode),
    process: r.process_name || String(r.proccode),
    machineId: r.maccode != null ? Number(r.maccode) : null,
    machine: r.machine_name || "—",
    qty: Number(r.qty) || 0,
    planStart: day ? (sh ? `${day} ${sh}` : day) : "—",
    planEnd: r.plan_end ? String(r.plan_end).slice(0, 10) : "—",
    actStart: dt(r.actual_start),
    actEnd: dt(r.actual_end),
    status: PROCESS_STATUS_LABELS[statusKey] || statusKey,
    statusKey,
  };
}

export async function fetchPlanTable() {
  const [res, macRes] = await Promise.all([
    planService.getTable(),
    machineMasterService.getViews({ ...perms("view"), page: 1, limit: 1000 }),
  ]);
  return {
    rows: (res?.data || []).map(mapRow),
    machines: (macRes?.data || []).map((m) => ({ id: Number(m.maccode), name: m.macname || m.label })).filter((m) => m.id),
  };
}

export async function setPlanLineStatus(docno, processId, machineId, status) {
  const card = (await jobCardService.getById(docno, perms("view")))?.data;
  if (!card?.process_plan) return;
  const st = String(status).toLowerCase();
  const cardSt = { running: "Running", hold: "Hold", complete: "Complete" }[st];
  let plan = card.process_plan;
  if (typeof plan === "string") {
    try {
      plan = JSON.parse(plan);
    } catch {
      plan = [];
    }
  }
  const picks = (Array.isArray(plan) ? plan : []).map((s) => {
    const base = {
      stage_no: s.stage_no,
      process_id: s.process_id,
      machine_ids: (s.machines || []).map((m) => m.machine_id),
      rm_item_dcodes: (s.rm_items || []).map((r) => r.rm_item_dcode),
    };
    if (Number(s.process_id) !== Number(processId)) return base;
    const mids = (s.machines || []).map((m) => Number(m.machine_id)).filter(Boolean);
    if (machineId != null && Number.isFinite(Number(machineId))) {
      return { ...base, machine_status: { [String(machineId)]: st } };
    }
    if (mids.length) {
      return { ...base, machine_status: Object.fromEntries(mids.map((id) => [String(id), st])) };
    }
    return { ...base, machine_status: { 0: st } };
  });
  await jobCardService.update(docno, { process_plan: picks, ...(cardSt ? { status: cardSt } : {}), ...perms("edit") });
}
