"use client";

/**
 * process_plan[].machines[].status — keep in sync with backend processPlanStatus.js.
 */
export const PROCESS_STATUS = {
  PENDING: "pending",
  PLANNING: "planning",
  RUNNING: "running",
  HOLD: "hold",
  COMPLETE: "complete",
};

export const PROCESS_STATUS_VALUES = Object.values(PROCESS_STATUS);

export const PROCESS_STATUS_LABELS = {
  [PROCESS_STATUS.PENDING]: "Pending",
  [PROCESS_STATUS.PLANNING]: "Planning",
  [PROCESS_STATUS.RUNNING]: "Running",
  [PROCESS_STATUS.HOLD]: "Hold",
  [PROCESS_STATUS.COMPLETE]: "Complete",
};

export const PROCESS_STATUS_BADGE = {
  [PROCESS_STATUS.PENDING]: "bg-amber-50 text-amber-700 border-amber-100",
  [PROCESS_STATUS.PLANNING]: "bg-sky-50 text-sky-700 border-sky-100",
  [PROCESS_STATUS.RUNNING]: "bg-indigo-50 text-indigo-700 border-indigo-100",
  [PROCESS_STATUS.HOLD]: "bg-rose-50 text-rose-700 border-rose-100",
  [PROCESS_STATUS.COMPLETE]: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

export const PROCESS_STATUS_DOT = {
  [PROCESS_STATUS.PENDING]: "bg-amber-400",
  [PROCESS_STATUS.PLANNING]: "bg-sky-500",
  [PROCESS_STATUS.RUNNING]: "bg-indigo-500",
  [PROCESS_STATUS.HOLD]: "bg-rose-500",
  [PROCESS_STATUS.COMPLETE]: "bg-emerald-500",
};

function normalizeStatus(raw) {
  const status = String(raw || PROCESS_STATUS.PENDING).toLowerCase();
  return PROCESS_STATUS_VALUES.includes(status) ? status : PROCESS_STATUS.PENDING;
}

export function machineStatusKey(processId, machineId) {
  return `${Number(processId)}:${Number(machineId) || 0}`;
}

function normalizeMachines(rawMachines, stageStatus) {
  const list = Array.isArray(rawMachines) ? rawMachines : [];
  const fallback = normalizeStatus(stageStatus);
  return list
    .map((m) => {
      if (!m || typeof m !== "object") return null;
      const machine_id = Number(m.machine_id ?? m.machineId);
      if (!Number.isFinite(machine_id) || machine_id <= 0) return null;
      return {
        ...m,
        machine_id,
        machine_name: String(m.machine_name ?? m.macname ?? m.name ?? "").trim() || `Machine ${machine_id}`,
        status: normalizeStatus(m.status ?? fallback),
      };
    })
    .filter(Boolean);
}

/** Safe parse of process_plan — null / bad JSON → []. Ensures status on each machine. */
export function parseProcessPlan(raw) {
  if (raw == null || raw === "") return [];
  let list = raw;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const process_id = Number(row.process_id ?? row.processId);
      if (!Number.isFinite(process_id) || process_id <= 0) return null;
      const machines = normalizeMachines(row.machines, row.status);
      const status = machines.length
        ? normalizeStatus(machines[0].status)
        : normalizeStatus(row.status);
      return {
        ...row,
        process_id,
        process_name: String(row.process_name ?? row.processName ?? "").trim() || `Process ${process_id}`,
        machines,
        status,
      };
    })
    .filter(Boolean);
}

/** Unique processes for chips / filters (by process_id) — status = first machine. */
export function processStatusRows(plan) {
  const seen = new Set();
  const out = [];
  for (const stage of parseProcessPlan(plan)) {
    if (seen.has(stage.process_id)) continue;
    seen.add(stage.process_id);
    out.push({
      processId: stage.process_id,
      processName: stage.process_name,
      status: stage.status,
    });
  }
  return out;
}

/** One row per machine (process + machine) for status UI / history selection. */
export function machineStatusRows(plan) {
  const out = [];
  for (const stage of parseProcessPlan(plan)) {
    const machines = stage.machines || [];
    if (!machines.length) {
      out.push({
        key: machineStatusKey(stage.process_id, 0),
        stageNo: stage.stage_no,
        processId: stage.process_id,
        processName: stage.process_name,
        machineId: null,
        machineName: null,
        status: normalizeStatus(stage.status),
      });
      continue;
    }
    for (const m of machines) {
      out.push({
        key: machineStatusKey(stage.process_id, m.machine_id),
        stageNo: stage.stage_no,
        processId: stage.process_id,
        processName: stage.process_name,
        machineId: m.machine_id,
        machineName: m.machine_name,
        status: normalizeStatus(m.status),
      });
    }
  }
  return out;
}

/** List / board chips — machine-level: "TP-1 · Pending" (status color). */
export function ProcessStatusChips({ list, dense = false }) {
  const rows = machineStatusRows(list);
  if (!rows.length) return null;
  const pad = dense ? "px-1 py-0.5 text-[7px]" : "px-1.5 py-0.5 text-[9px]";
  return (
    <span className="flex flex-wrap gap-1">
      {rows.map((p) => {
        const statusLabel = PROCESS_STATUS_LABELS[p.status] || p.status;
        const mac = p.machineName || null;
        const label = mac ? `${mac} · ${statusLabel}` : `${p.processName} · ${statusLabel}`;
        return (
          <span
            key={p.key}
            className={`border font-black uppercase ${pad} ${PROCESS_STATUS_BADGE[p.status] || PROCESS_STATUS_BADGE.pending}`}
            title={`${p.processName}${mac ? ` · ${mac}` : ""}: ${statusLabel}`}
          >
            {label}
          </span>
        );
      })}
    </span>
  );
}
