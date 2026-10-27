/**
 * Maintain Job Card UI — drawer, prime grid, process plan table (not sticky; see stickySize.config.js).
 */

export const JOB_CARD_DRAWER_MAX_WIDTH = "max-w-[1600px]";

export const JOB_CARD_PRIME_DETAIL_GRID =
  "grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-start [&>*]:min-w-0";

export const JOB_CARD_PLAN_RM_EMPTY_EDIT = "—";
export const JOB_CARD_PLAN_RM_EMPTY_VIEW = "--";

export const JOB_CARD_PLAN_TABLE_MIN_W = 960;
export const JOB_CARD_PLAN_TABLE_MIN_W_WITH_STATUS = 1100;

export const JOB_CARD_PLAN_COL_WIDTH = {
  stage: "3.5rem",
  process: "14%",
  machine: "16%",
  rm: "16%",
  rmRequired: "7rem",
  rmAvailable: "7rem",
  tooling: "4.5rem",
  machineStatus: "9rem",
  timeRequired: "6.5rem",
  shiftRequired: "5.5rem",
};

export const JOB_CARD_PLAN_TH =
  "px-2 py-1.5 text-[10px] font-bold uppercase text-slate-700 bg-slate-100 border-b border-r border-slate-200 align-middle text-left whitespace-nowrap";

export const JOB_CARD_PLAN_TD = "px-2 py-1.5 border-b border-r border-slate-100 align-middle";

export function jobCardPlanTableMinWidthClass(showMachineStatus = false) {
  const px = showMachineStatus ? JOB_CARD_PLAN_TABLE_MIN_W_WITH_STATUS : JOB_CARD_PLAN_TABLE_MIN_W;
  return `min-w-[${px}px]`;
}

export function jobCardPlanColgroupWidths(showMachineStatus = false) {
  const c = JOB_CARD_PLAN_COL_WIDTH;
  const cols = [c.stage, c.process, c.machine, c.rm, c.rmRequired, c.rmAvailable, c.tooling];
  if (showMachineStatus) cols.push(c.machineStatus);
  cols.push(c.timeRequired, c.shiftRequired);
  return cols;
}
