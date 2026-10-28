import { planService } from "@/apps/production/lib/services/plan";
import { machineMasterService } from "@/apps/engineering/lib/services/machineMaster";
import { PROCESS_STATUS_LABELS, parseProcessPlan } from "@/apps/production/lib/constants/processStatus";
import { isValidShift } from "@/apps/production/modules/jc/jobCard.config";
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
  const jcPlan = parseProcessPlan(r.process_plan);
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
    est_shifts: Number(r.est_shifts) > 0 ? Number(r.est_shifts) : null,
    estimate_date: r.plan_end ? String(r.plan_end).slice(0, 10) : null,
    position: 0,
    approved: true,
    stages: 1,
    /** Full JC plan — allowed machines per process for board DnD */
    process_plan: jcPlan.length ? jcPlan : miniPlan,
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
  const end = r.plan_end ? String(r.plan_end).slice(0, 10) : "";
  return {
    /** prod_plan.docno — Edit / Delete target */
    id: String(r.docno),
    plan_docno: Number(r.docno),
    /** prod_jc.docno — view / history only */
    docno: Number(r.job_card_docno),
    job_card_no: r.pjobcardno || "—",
    prime_item_code: r.prime_item_code || null,
    stage: r.stage_no,
    processId: Number(r.proccode),
    process: r.process_name || String(r.proccode),
    machineId: r.maccode != null ? Number(r.maccode) : null,
    machine: r.machine_name || "—",
    qty: Number(r.qty) || 0,
    plan_start: day || "",
    plan_end: end || "",
    planStart: day || "—",
    planEnd: end || "—",
    actStart: dt(r.actual_start),
    actEnd: dt(r.actual_end),
    status: PROCESS_STATUS_LABELS[statusKey] || statusKey,
    statusKey,
  };
}

/** @param {{ from_date?: string, to_date?: string }} [dateFilters] — IMS plan_start range (Table View). */
export async function fetchPlanTable(dateFilters = {}) {
  const from_date = String(dateFilters.from_date || dateFilters.fromDate || "").slice(0, 10);
  const to_date = String(dateFilters.to_date || dateFilters.toDate || "").slice(0, 10);
  const body = {
    ...(from_date ? { from_date } : {}),
    ...(to_date ? { to_date } : {}),
  };
  const [res, macRes] = await Promise.all([
    planService.getTable(body),
    machineMasterService.getViews({ ...perms("view"), page: 1, limit: 1000 }),
  ]);
  return {
    rows: (res?.data || []).map(mapRow),
    machines: (macRes?.data || []).map((m) => ({ id: Number(m.maccode), name: m.macname || m.label })).filter((m) => m.id),
  };
}

/** @deprecated Board uses updatePlanLineStatus — prod_plan only. */
export async function setPlanLineStatus(planLineDocno, _processId, _machineId, status) {
  await planService.update(planLineDocno, { status: String(status || "").toLowerCase() });
}
