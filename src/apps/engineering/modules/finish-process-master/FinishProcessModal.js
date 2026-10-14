"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowDown, Check, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";
import { finishProcessMasterService, finishProcessMasterHelpers } from "@/apps/engineering/lib/services/finishProcessMaster";
import { appConfigService } from "@/apps/settings/lib/services/appConfigService";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_PRIMARY } from "@/apps/ims/lib/helpers/masterListUi";
import ProcessStagesBlock, { SELECT_H, asList, createNewStage, stagesFromJson, buildProcessPayload, normalizeRmItems, stampItemRmOnStages } from "@/apps/engineering/modules/process-mapping/ProcessStagesBlock";
import ProcessMappingView from "@/apps/engineering/modules/process-mapping/ProcessMappingView";
import ProcessItemHeader from "@/apps/engineering/modules/process-mapping/ProcessItemHeader";

const MODULE = ENG_MODULES.FINISH_PROCESS_MASTER;
const RM_CONFIG_KEY = "prime_item_rm_wire_selectable";

async function fetchRmConfig() {
  try {
    const res = await appConfigService.list("engineering");
    const item = asList(res?.data ?? res).find((r) => String(r?.config_key ?? r?.key ?? "") === RM_CONFIG_KEY);
    const val = String(item?.config_value ?? item?.value ?? "").trim().toLowerCase();
    return val === "true" ? true : val === "false" ? false : null;
  } catch {
    return null;
  }
}

export default function FinishProcessModal({ open, onClose, onSuccess, editData = null, mode = "add" }) {
  const sopAckRef = useRef(null);
  const isEdit = mode === "edit";
  const isView = mode === "view";
  const sopPermissionType = isEdit ? "edit" : "add";
  const PERMS = helperPerms(MODULE, sopPermissionType);

  const [itemDcode, setItemDcode] = useState(null);
  const [productionId, setProductionId] = useState(null);
  const [defaultRm, setDefaultRm] = useState([]);
  const [primeStages, setPrimeStages] = useState([]);
  const [stages, setStages] = useState([]);
  const [rmSelectable, setRmSelectable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hydratedId, setHydratedId] = useState(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchRmConfig().then((v) => alive && setRmSelectable(v));
    return () => {
      alive = false;
    };
  }, [open]);

  const applyRow = (row, { backfillEmptyRm = false } = {}) => {
    setItemDcode(row.item_dcode);
    setProductionId(row.production_id);
    const rm = normalizeRmItems(row.rm_items);
    setDefaultRm(rm);
    const hasPrime = asList(row.prime_process?.stages).length > 0;
    setPrimeStages(hasPrime ? stagesFromJson(row.prime_process, rm) : []);
    if (asList(row.finish_process?.stages).length) {
      setStages(stagesFromJson(row.finish_process, rm));
    } else if (backfillEmptyRm && rm.length) {
      setStages((prev) => stampItemRmOnStages(prev, rm));
    } else {
      setStages([createNewStage()]);
    }
  };

  useEffect(() => {
    if (!open) {
      setItemDcode(null);
      setProductionId(null);
      setPrimeStages([]);
      setStages([]);
      setDefaultRm([]);
      setHydratedId(null);
      return;
    }

    if ((isEdit || isView) && editData?.item_dcode != null) {
      const id = editData.production_id;
      if (hydratedId === id) return;
      setHydratedId(id);
      applyRow(editData);
      return;
    }

    setItemDcode(null);
    setProductionId(null);
    setPrimeStages([]);
    setStages([]);
    setDefaultRm([]);
    setHydratedId(null);
  }, [open, isEdit, isView, editData, hydratedId]);

  useEffect(() => {
    if (!open || isEdit || isView) return;
    setPrimeStages([]);
    setStages(itemDcode ? [createNewStage()] : []);
    setDefaultRm([]);
    setProductionId(null);
    if (!itemDcode) return;

    let alive = true;
    (async () => {
      const res = await finishProcessMasterService.getAll({ page: 1, limit: 1, filters: { item_dcode: itemDcode } });
      const row = asList(res?.data?.data ?? res?.data)[0];
      if (!alive) return;
      if (row) applyRow(row, { backfillEmptyRm: true });
      else {
        setProductionId(null);
        setDefaultRm([]);
        setPrimeStages([]);
        setStages([createNewStage()]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [itemDcode, open, isEdit, isView]);

  const handleSubmit = async () => {
    if (!itemDcode) return toast.info("Select an FG item.");
    if (!productionId && !isEdit) {
      return toast.info("Item RM mapping not found. Create the item in Item RM Master first.");
    }
    if (!stages.length) return toast.info("Add at least one finish stage.");

    for (const [sIdx, stage] of stages.entries()) {
      if (!stage.processes.length) return toast.info(`Select at least one process in Stage ${sIdx + 1}.`);
      const missingMachine = stage.processes.find((p) => !p.machines.length);
      if (missingMachine) {
        return toast.info(`Select at least one machine for ${missingMachine.process_name} (Stage ${sIdx + 1}).`);
      }
    }

    if (!sopAckRef.current?.assertAcknowledged()) return;

    const finish_process = buildProcessPayload(stages, itemDcode);
    const body = {
      production_id: productionId || editData?.production_id,
      item_dcode: itemDcode,
      finish_process,
    };

    setLoading(true);
    try {
      const res = isEdit
        ? await finishProcessMasterService.update(body.production_id, body)
        : await finishProcessMasterService.create(body);
      toast.success(res?.message || "Finish process mapping saved.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const itemCode = editData?.item_code || null;
  const itemDesc = editData?.item_desc || null;

  const footer = (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={onClose} disabled={loading} className={IMS_DRAWER_BTN_CANCEL}>
        {isView ? "Close" : "Cancel"}
      </button>
      {!isView && (
        <button type="button" onClick={handleSubmit} disabled={loading} className={IMS_DRAWER_BTN_PRIMARY}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          Save mapping
        </button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={isView ? onClose : handleSubmit}
      title={isView ? "View Finish Process" : isEdit ? "Edit Finish Process" : "New Finish Process Master"}
      description={isView ? "FG item mapping" : "FG item → prime (locked) → finish stages"}
      footer={footer}
      maxWidth="max-w-7xl"
    >
      <div className="space-y-3 pb-3">
        {isView ? (
          <>
            <ProcessItemHeader
              label="FG Item"
              itemCode={itemCode}
              itemDesc={itemDesc}
              accent="emerald"
            />
            <ProcessMappingView
              title="Prime process"
              stages={primeStages}
              defaultRm={defaultRm}
              accent="indigo"
              emptyHint="No prime process mapped yet."
            />
            <div className="flex justify-center py-1 text-slate-400">
              <ArrowDown size={16} strokeWidth={2.25} />
            </div>
            <ProcessMappingView
              title="Finish process"
              stages={stages}
              defaultRm={defaultRm}
              accent="emerald"
              emptyHint="No finish process mapping saved."
            />
          </>
        ) : (
          <>
            <SearchableSelect
              label="FG Item"
              required
              value={itemDcode}
              onChange={(id) => setItemDcode(id || null)}
              disabled={isEdit || loading}
              heightClass={SELECT_H}
              fetchService={(params) => finishProcessMasterHelpers.getProductionItemsViews({ ...params, ...PERMS })}
              getByIdService={(id) => finishProcessMasterHelpers.getProductionItemViewById(id, PERMS)}
              dataKey="id"
              labelKey="item_code"
              subLabelKey="itemdesc"
              showDuplicateSubLabel
              preserveApiOrder
              usePortal={false}
            />

            {itemDcode && (
              <>
                <ProcessMappingView
                  title="Prime process (locked)"
                  stages={primeStages}
                  defaultRm={defaultRm}
                  accent="indigo"
                  emptyHint="No prime process mapped yet."
                />

                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Finish process</p>
                  <ProcessStagesBlock
                    stages={stages}
                    onChange={setStages}
                    defaultRm={defaultRm}
                    rmSelectable={rmSelectable}
                    perms={PERMS}
                    rmHelpers={finishProcessMasterHelpers}
                    accent="emerald"
                    processSelectMode="tags"
                    processFilters={{ fg: true }}
                  />
                </div>
              </>
            )}

            <ModuleSopAcknowledgment
              ref={sopAckRef}
              key={`${open}-${sopPermissionType}`}
              moduleSlug={MODULE}
              permissionType={sopPermissionType}
              isOpen={open}
            />
          </>
        )}
      </div>
    </Drawer>
  );
}
