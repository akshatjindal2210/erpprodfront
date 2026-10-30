"use client";

import { ArrowDown, Trash2, Plus } from "lucide-react";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { processMasterService } from "@/apps/engineering/lib/services/processMaster";
import { machineMasterService } from "@/apps/engineering/lib/services/machineMaster";
import { appConfigService } from "@/apps/settings/lib/services/appConfigService";

export const SELECT_H = "h-8";

const RM_CONFIG_KEY = "prime_item_rm_wire_selectable";

/** App config `prime_item_rm_wire_selectable`: true → RM dropdown; false / null → prime item's RM shown locked. */
export async function fetchRmSelectable() {
  try {
    const res = await appConfigService.list("engineering");
    const item = asList(res?.data ?? res).find((r) => String(r?.config_key ?? r?.key ?? "") === RM_CONFIG_KEY);
    const val = String(item?.config_value ?? item?.value ?? "").trim().toLowerCase();
    return val === "true" ? true : val === "false" ? false : null;
  } catch {
    return null;
  }
}

let uid = 0;
export const createNewStage = () => ({ key: `stage-${++uid}`, processIds: [], processes: [] });
export const asList = (val) => (Array.isArray(val) ? val : []);

export const mapOptions = (ids, rows, existing, idKey, labelKey, fallbackLabelFn) => {
  const existingMap = new Map(existing.map((item) => [String(item[idKey]), item]));
  const rowsMap = new Map(asList(rows).map((row) => [String(row?.proccode ?? row?.maccode ?? row?.id), row]));
  return asList(ids).map((id) => {
    const key = String(id);
    return (
      existingMap.get(key) ?? {
        [idKey]: id,
        [labelKey]: fallbackLabelFn(rowsMap.get(key), id),
      }
    );
  });
};

/** Normalize RM wire for process JSON + SearchableSelect (`id` / `item_code` / `itemdesc`). */
export function normalizeRmItems(rmItems) {
  return asList(rmItems)
    .map((r) => {
      const dcode = r.rm_item_dcode ?? r.id ?? r.itemdcode;
      const code = r.rm_item_code || r.item_code || (dcode != null ? `RM ${dcode}` : "");
      const desc = r.rm_item_desc ?? r.itemdesc ?? r.item_desc ?? null;
      return {
        id: dcode,
        rm_item_dcode: dcode,
        rm_item_code: code,
        rm_item_desc: desc,
        item_code: code,
        itemdesc: desc,
      };
    })
    .filter((r) => r.rm_item_dcode != null && String(r.rm_item_dcode).trim() !== "");
}

/**
 * Stamp Item RM Master wires onto each process (1 → one chip, many → many chips).
 * `force` replaces process RM; otherwise only fills empty process RM.
 */
export function stampItemRmOnStages(stages, itemRm, { force = false } = {}) {
  const rm = normalizeRmItems(itemRm);
  if (!rm.length) return stages;
  return asList(stages).map((stage) => ({
    ...stage,
    processes: asList(stage.processes).map((p) => ({
      ...p,
      rm_items: p.rm_wire === false ? [] : force || !asList(p.rm_items).length ? rm : p.rm_items,
    })),
  }));
}

/**
 * Process Master flags of a process (`{ rm_wire, tooling, … }`) exactly as the API sends them — no flag list here,
 * a new flag in Process Master shows up on its own. Spread on the process too, so `p.rm_wire` keeps working.
 */
export function processFlags(src) {
  const flags = src?.flags && typeof src.flags === "object" ? src.flags : src?.rm_wire != null ? { rm_wire: src.rm_wire === true } : {};
  return { flags, ...flags };
}

export function stagesFromJson(processJson, itemRm = null) {
  const stages = asList(processJson?.stages);
  if (!stages.length) return [createNewStage()];
  const mapped = stages.map((st) => {
    const processes = asList(st.processes).map((p) => ({
      process_id: p.process_id,
      process_name: p.process_name || `Process ${p.process_id}`,
      ...processFlags(p), // Process Master flags, live (rm_wire false → no RM items)
      machines: asList(p.machines).map((m) => ({
        machine_id: m.machine_id,
        machine_label: m.machine_label || `Machine ${m.machine_id}`,
      })),
      rm_items: normalizeRmItems(p.rm_items),
    }));
    return {
      key: `stage-${++uid}`,
      processIds: processes.map((p) => p.process_id),
      processes,
    };
  });
  // Fill empty process RM from Item RM Master wires (1 or multiple as stored)
  return itemRm ? stampItemRmOnStages(mapped, itemRm) : mapped;
}

/** Process Master "Machine" (inhouse) ON → machines required; OFF → skip (FG / Prime only). */
function needsMachines(p) {
  return p?.inhouse !== false;
}

/** First problem in the stages (toast text), else null. */
export function validateStages(stages) {
  if (!asList(stages).length) return "Add at least one stage.";
  for (const [sIdx, stage] of stages.entries()) {
    if (!stage.processes.length) return `Select at least one process in Stage ${sIdx + 1}.`;
    const missing = stage.processes.find((p) => needsMachines(p) && !asList(p.machines).length);
    if (missing) return `Select at least one machine for ${missing.process_name} (Stage ${sIdx + 1}).`;
  }
  return null;
}

export function buildProcessPayload(stages, itemDcode) {
  return {
    item_dcode: itemDcode,
    stages: stages.map((stage, sIdx) => ({
      stage_no: sIdx + 1,
      processes: stage.processes.map((p, pIdx) => ({
        process_id: p.process_id,
        process_name: p.process_name,
        process_order: pIdx + 1,
        // Machine OFF in Process Master → empty (same as RM wire OFF → no RM)
        machines: needsMachines(p) ? asList(p.machines) : [],
        // Respect user unselect — do not re-inject Item RM Master defaults on save
        rm_items: p.rm_wire === false ? [] : asList(p.rm_items),
      })),
    })),
  };
}

/**
 * Compact stage → process → machine / RM editor.
 * `readOnly` = Prime preview (disabled).
 * A process picked in one stage is disabled in the other stages of the same block
 * (Finish may reuse Prime's processes — they are separate blocks).
 */
export default function ProcessStagesBlock({
  stages,
  onChange,
  defaultRm = [],
  rmSelectable = null,
  perms,
  rmHelpers,
  readOnly = false,
  accent = "indigo",
  emptyHint = null,
  /** `compact` = "N selected"; `tags` = show each selected process name (default). */
  processSelectMode = "tags",
  /** Extra helper filters — e.g. `{ prime: true }` or `{ fg: true }`. */
  processFilters = null,
  connectingId = null,
  onConnectingChange = null,
}) {
  const setStages = (next) => onChange(typeof next === "function" ? next(stages) : next);

  const accentBorder = accent === "emerald" ? "border-emerald-200" : "border-indigo-200";
  const accentHead = accent === "emerald" ? "bg-emerald-50/60 border-emerald-100" : "bg-indigo-50/60 border-indigo-100";
  const accentText = accent === "emerald" ? "text-emerald-700" : "text-indigo-700";
  const accentBadge = accent === "emerald" ? "bg-emerald-600" : "bg-indigo-600";
  const accentDash = accent === "emerald" ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50" : "border-indigo-300 text-indigo-600 hover:bg-indigo-50";

  if (!stages?.length && emptyHint) {
    return <p className="rounded border border-dashed border-slate-200 px-2 py-2 text-[10px] text-slate-500">{emptyHint}</p>;
  }

  const handleAddStage = () => setStages((prev) => [...prev, createNewStage()]);

  const handleRemoveStage = (sIdx) => {
    setStages((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== sIdx) : prev));
  };

  const syncProcessesInStage = (sIdx, selectedIds, rows) => {
    setStages((prev) =>
      prev.map((stage, idx) => {
        if (idx !== sIdx) return stage;
        const currentMap = new Map(stage.processes.map((p) => [String(p.process_id), p]));
        const newRowsMap = new Map(asList(rows).map((r) => [String(r?.proccode ?? r?.id), r]));
        const validIds = asList(selectedIds);
        const updatedProcesses = validIds.map((id) => {
          const idStr = String(id);
          const existing = currentMap.get(idStr);
          const row = newRowsMap.get(idStr);
          const name = row?.procname || row?.name || existing?.process_name || `Process ${id}`;
          if (existing) {
            return { ...existing, process_name: name };
          }
          // Flags come from Process Master (helper row). RM wire OFF → this process gets no RM items.
          const flags = row ? processFlags(row) : {};
          return {
            process_id: id,
            process_name: name,
            ...flags,
            machines: [],
            rm_items: flags.rm_wire === false ? [] : normalizeRmItems(defaultRm),
          };
        });
        return { ...stage, processIds: validIds, processes: updatedProcesses };
      })
    );
  };

  const handleRemoveProcess = (sIdx, pIdx) => {
    setStages((prev) =>
      prev.map((stage, idx) => {
        if (idx !== sIdx) return stage;
        const targetId = String(stage.processes[pIdx]?.process_id);
        return {
          ...stage,
          processIds: stage.processIds.filter((id) => String(id) !== targetId),
          processes: stage.processes.filter((_, i) => i !== pIdx),
        };
      })
    );
  };

  const updateProcessData = (sIdx, pIdx, key, newValues) => {
    setStages((prev) =>
      prev.map((stage, i) => {
        if (i !== sIdx) return stage;
        return {
          ...stage,
          processes: stage.processes.map((proc, j) => (j === pIdx ? { ...proc, [key]: newValues } : proc)),
        };
      })
    );
  };

  /** Disable processes used in another stage of this block; keep current stage selections enabled. */
  const isProcessBlocked = (sIdx, item) => {
    const id = String(item?.proccode ?? item?.id);
    if (stages[sIdx]?.processIds?.some((x) => String(x) === id)) return false;
    for (let i = 0; i < stages.length; i++) {
      if (i === sIdx) continue;
      if (stages[i].processIds?.some((x) => String(x) === id)) return true;
    }
    return false;
  };

  return (
    <div className={`space-y-2 ${readOnly ? "pointer-events-none opacity-80" : ""}`}>
      {stages.map((stage, sIdx) => (
        <div key={stage.key}>
          {sIdx > 0 && (
            <div className="flex justify-center py-0.5 text-slate-300">
              <ArrowDown size={14} />
            </div>
          )}

          <div className={`overflow-visible rounded-md border bg-white ${accentBorder}`}>
            <div className={`flex items-center gap-2 border-b px-2.5 py-1.5 ${accentHead}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${accentBadge}`}>
                {sIdx + 1}
              </span>
              <span className={`min-w-0 flex-1 text-[10px] font-black uppercase tracking-wide ${accentText}`}>
                Stage {sIdx + 1}
              </span>
              {!readOnly && stages.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveStage(sIdx)}
                  className="pointer-events-auto shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-600"
                  title={`Remove Stage ${sIdx + 1}`}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            <div className="space-y-1 border-b border-slate-100 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                Processes {asList(stage.processIds).length ? `· ${asList(stage.processIds).length} selected` : ""}
              </p>
              <SearchableSelect
                multiple
                {...(processSelectMode === "compact"
                  ? { compactMulti: true, heightClass: SELECT_H }
                  : { showTags: true, maxVisibleTags: 8, heightClass: "h-auto min-h-8" })}
                disabled={readOnly}
                preserveApiOrder
                usePortal
                value={stage.processIds}
                placeholder="Pick the processes for this stage…"
                onChange={(ids, rows) => syncProcessesInStage(sIdx, ids, rows)}
                fetchService={(params) =>
                  processMasterService.getViews({
                    ...params,
                    ...perms,
                    filters: { approved: true, ...(processFilters || {}) },
                  })
                }
                getByIdService={async (id) => {
                  const res = await processMasterService.getViewById(id, perms);
                  return res?.data ?? null;
                }}
                dataKey="proccode"
                labelKey="procname"
                subLabelKey="path_label"
                showDuplicateSubLabel
                labelOnlyDisplay
                isOptionDisabled={(item) => isProcessBlocked(sIdx, item)}
                getOptionDisabledLabel={() => "In other stage"}
              />
            </div>

            {stage.processes.length > 0 && (
              <div className="space-y-1 px-1.5 py-1">
                <div className="hidden gap-1.5 px-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 md:grid md:grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)]">
                  <span>Process</span>
                  <span>Machines</span>
                  <span>RM Items</span>
                </div>
                {stage.processes.map((proc, pIdx) => (
                  <ProcessRow
                    key={proc.process_id}
                    proc={proc}
                    pIdx={pIdx}
                    rmSelectable={rmSelectable}
                    defaultRm={defaultRm}
                    perms={perms}
                    rmHelpers={rmHelpers}
                    readOnly={readOnly}
                    accentBadge={accentBadge}
                    onRemove={() => handleRemoveProcess(sIdx, pIdx)}
                    onUpdateMachines={(ids, rows) => {
                      updateProcessData(
                        sIdx,
                        pIdx,
                        "machines",
                        mapOptions(ids, rows, proc.machines, "machine_id", "machine_label", (r, id) =>
                          r?.label || r?.name || `Machine ${id}`
                        )
                      );
                    }}
                    onUpdateRm={(ids, rows) => {
                      const rowsMap = new Map(asList(rows).map((r) => [String(r?.id), r]));
                      const existingMap = new Map(
                        asList(proc.rm_items).map((r) => [String(r.rm_item_dcode ?? r.id), r])
                      );
                      updateProcessData(
                        sIdx,
                        pIdx,
                        "rm_items",
                        normalizeRmItems(
                          asList(ids).map((id) => {
                            const row = rowsMap.get(String(id));
                            const prev = existingMap.get(String(id));
                            return {
                              rm_item_dcode: id,
                              rm_item_code: row?.item_code || prev?.rm_item_code || prev?.item_code,
                              rm_item_desc:
                                row?.itemdesc ??
                                row?.item_desc ??
                                prev?.rm_item_desc ??
                                prev?.itemdesc ??
                                null,
                              item_code: row?.item_code || prev?.item_code || prev?.rm_item_code,
                              itemdesc:
                                row?.itemdesc ??
                                row?.item_desc ??
                                prev?.itemdesc ??
                                prev?.rm_item_desc ??
                                null,
                            };
                          })
                        )
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={handleAddStage}
          className={`flex w-full items-center justify-center gap-1 rounded border border-dashed py-1 text-[10px] font-bold ${accentDash}`}
        >
          <Plus size={12} /> Add Stage
        </button>
      )}

      {typeof onConnectingChange === "function" && stages.some((s) => asList(s.processes).length > 0) ? (
        <div className={`overflow-visible rounded-md border bg-white ${accentBorder}`}>
          <div className="space-y-1 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
              Connecting Stage<span className="text-rose-500"> *</span>
            </p>
            <SearchableSelect
              heightClass={SELECT_H}
              disabled={readOnly}
              preserveApiOrder
              usePortal
              value={connectingId}
              placeholder="Pick a process…"
              onChange={(id) => onConnectingChange(id || null)}
              fetchService={(params) =>
                processMasterService.getViews({
                  ...params,
                  ...perms,
                  filters: { approved: true, connectivity: true },
                })
              }
              getByIdService={async (id) => {
                const res = await processMasterService.getViewById(id, perms);
                return res?.data ?? null;
              }}
              dataKey="proccode"
              labelKey="procname"
              subLabelKey="path_label"
              showDuplicateSubLabel
              labelOnlyDisplay
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProcessRow({
  proc,
  pIdx,
  rmSelectable,
  defaultRm,
  perms,
  rmHelpers,
  readOnly,
  accentBadge,
  onRemove,
  onUpdateMachines,
  onUpdateRm,
}) {
  // Controlled from process state only — never fall back to defaultRm in the select,
  // or unselect/clear would snap selection back to Item RM Master defaults.
  const rmValue = asList(proc.rm_items).map((r) => r.rm_item_dcode);
  // App config `prime_item_rm_wire_selectable`: true → RM dropdown; false/null → read-only defaults.
  const rmOff = proc.rm_wire === false; // Process Master "RM wire" is OFF
  const machineOff = proc.inhouse === false; // Process Master "Machine" is OFF → FG / Prime only
  const canSelectRm = rmSelectable === true && !readOnly && !rmOff;
  const rmDisplay = rmOff ? [] : asList(proc.rm_items).length ? normalizeRmItems(proc.rm_items) : normalizeRmItems(defaultRm);

  return (
    <div className="grid grid-cols-1 items-start gap-1.5 rounded border border-slate-100 bg-slate-50/50 px-1 py-1.5 md:grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-8 min-w-0 items-center gap-1">
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${accentBadge}`}>
          {pIdx + 1}
        </span>
        <span className="truncate text-[10px] font-bold text-slate-800" title={proc.process_name}>
          {proc.process_name}
        </span>
        {!readOnly && (
          <button type="button" onClick={onRemove} className="ml-auto shrink-0 rounded p-0.5 text-slate-300 hover:text-rose-600">
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Machine OFF in Process Master → empty cell (no box), same as RM wire OFF. */}
      <div className="relative z-10 min-w-0 w-full">
        {machineOff ? null : (
          <SearchableSelect
            multiple
            showTags
            maxVisibleTags={6}
            heightClass="h-auto min-h-8"
            disabled={readOnly}
            preserveApiOrder
            usePortal
            value={proc.machines.map((m) => m.machine_id)}
            placeholder="Machines…"
            onChange={onUpdateMachines}
            fetchService={(params) =>
              machineMasterService.getViews({ ...params, ...perms, filters: { macproccode: proc.process_id } })
            }
            getByIdService={async (id) => {
              const res = await machineMasterService.getViewById(id, perms);
              const row = res?.data ?? res ?? null;
              if (row) return row;
              const local = asList(proc.machines).find((m) => String(m.machine_id) === String(id));
              return local
                ? { maccode: id, label: local.machine_label || `Machine ${id}`, name: local.machine_label }
                : null;
            }}
            dataKey="maccode"
            labelKey="label"
            labelOnlyDisplay
          />
        )}
      </div>

      {/* RM wire OFF in Process Master → empty cell (no box). */}
      <div className="relative z-10 min-w-0 w-full">
        {rmOff ? null : canSelectRm ? (
          <SearchableSelect
            multiple
            showTags
            maxVisibleTags={6}
            heightClass="h-auto min-h-8"
            preserveApiOrder
            usePortal
            value={rmValue}
            placeholder="RM…"
            onChange={onUpdateRm}
            fetchService={(params) => rmHelpers.getRmItemsViews({ ...params, ...perms })}
            getByIdService={async (id) => {
              const res = await rmHelpers.getRmItemViewById(id, perms);
              const row = res?.data ?? res ?? null;
              if (row) return row;
              const local = rmDisplay.find((r) => String(r.rm_item_dcode) === String(id));
              return local
                ? {
                    id,
                    item_code: local.rm_item_code,
                    itemdesc: local.rm_item_desc,
                  }
                : null;
            }}
            dataKey="id"
            labelKey="item_code"
            subLabelKey="itemdesc"
            showDuplicateSubLabel
            labelOnlyDisplay
          />
        ) : (
          <div
            className="flex min-h-8 flex-wrap items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1"
            title="RM locked — enable Engineering app config to change"
          >
            {rmDisplay.length ? (
              rmDisplay.map((r) => (
                <span
                  key={r.rm_item_dcode}
                  className="max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                  title={r.rm_item_desc || r.rm_item_code}
                >
                  {r.rm_item_code}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-slate-400">No RM</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
