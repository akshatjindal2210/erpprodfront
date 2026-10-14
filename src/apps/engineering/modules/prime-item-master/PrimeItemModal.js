"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";
import { primeItemMasterService, primeItemMasterHelpers } from "@/apps/engineering/lib/services/primeItemMaster";
import { appConfigService } from "@/apps/settings/lib/services/appConfigService";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_PRIMARY } from "@/apps/ims/lib/helpers/masterListUi";
import ProcessStagesBlock, { SELECT_H, asList, createNewStage, stagesFromJson, buildProcessPayload, normalizeRmItems, stampItemRmOnStages } from "@/apps/engineering/modules/process-mapping/ProcessStagesBlock";
import ProcessMappingView from "@/apps/engineering/modules/process-mapping/ProcessMappingView";
import ProcessItemHeader from "@/apps/engineering/modules/process-mapping/ProcessItemHeader";

const MODULE = ENG_MODULES.PRIME_ITEM_MASTER;
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

export default function PrimeItemModal({ open, onClose, onSuccess, editData = null, mode = "add" }) {
  const sopAckRef = useRef(null);
  const isEdit = mode === "edit";
  const isView = mode === "view";
  const sopPermissionType = isEdit ? "edit" : "add";
  const PERMS = helperPerms(MODULE, sopPermissionType);

  const [itemDcode, setItemDcode] = useState(null);
  const [productionId, setProductionId] = useState(null);
  const [defaultRm, setDefaultRm] = useState([]);
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

  useEffect(() => {
    if (!open) {
      setItemDcode(null);
      setProductionId(null);
      setStages([]);
      setDefaultRm([]);
      setHydratedId(null);
      return;
    }

    if ((isEdit || isView) && editData?.item_dcode != null) {
      const id = editData.production_id;
      if (hydratedId === id) return;
      setHydratedId(id);
      setItemDcode(editData.item_dcode);
      setProductionId(editData.production_id);
      const rm = normalizeRmItems(editData.rm_items);
      setDefaultRm(rm);
      // Every process gets Item RM Master wires (1 or multiple as in DB)
      setStages(stampItemRmOnStages(stagesFromJson(editData.prime_process, rm), rm));
      return;
    }

    setItemDcode(null);
    setProductionId(null);
    setStages([]);
    setDefaultRm([]);
    setHydratedId(null);
  }, [open, isEdit, isView, editData, hydratedId]);

  useEffect(() => {
    if (!open || isEdit || isView) return;
    setStages(itemDcode ? [createNewStage()] : []);
    setDefaultRm([]);
    setProductionId(null);
    if (!itemDcode) return;
    let alive = true;
    (async () => {
      const res = await primeItemMasterService.getAll({ page: 1, limit: 1, filters: { item_dcode: itemDcode } });
      const row = asList(res?.data?.data ?? res?.data)[0];
      if (!alive) return;
      if (row) {
        const rm = normalizeRmItems(row.rm_items);
        setProductionId(row.production_id);
        setDefaultRm(rm);
        if (asList(row.prime_process?.stages).length) {
          setStages(stagesFromJson(row.prime_process, rm));
        } else if (rm.length) {
          setStages((prev) => stampItemRmOnStages(prev, rm));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [itemDcode, open, isEdit, isView]);

  const handleSubmit = async () => {
    if (!itemDcode) return toast.info("Select a production item.");
    if (!productionId && !isEdit) {
      return toast.info("Item RM mapping not found. Create the item in Item RM Master first.");
    }
    if (!stages.length) return toast.info("Add at least one stage.");

    for (const [sIdx, stage] of stages.entries()) {
      if (!stage.processes.length) return toast.info(`Select at least one process in Stage ${sIdx + 1}.`);
      const missingMachine = stage.processes.find((p) => !p.machines.length);
      if (missingMachine) {
        return toast.info(`Select at least one machine for ${missingMachine.process_name} (Stage ${sIdx + 1}).`);
      }
    }

    if (!sopAckRef.current?.assertAcknowledged()) return;

    const body = {
      production_id: productionId || editData?.production_id,
      item_dcode: itemDcode,
      prime_process: buildProcessPayload(stages, itemDcode),
    };

    setLoading(true);
    try {
      const res = isEdit
        ? await primeItemMasterService.update(body.production_id, body)
        : await primeItemMasterService.create(body);
      toast.success(res?.message || "Prime process mapping saved.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

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

  const itemCode = editData?.item_code || null;
  const itemDesc = editData?.item_desc || null;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={isView ? onClose : handleSubmit}
      title={isView ? "View Prime Process" : isEdit ? "Edit Prime Process" : "New Prime Process Master"}
      description={isView ? "Production item mapping" : "Item → stages → processes → machines + RM"}
      footer={footer}
      maxWidth="max-w-7xl"
    >
      <div className="space-y-2 pb-3">
        {isView ? (
          <>
            <ProcessItemHeader
              label="Production Item"
              itemCode={itemCode}
              itemDesc={itemDesc}
              accent="indigo"
            />
            <ProcessMappingView
              title="Prime process"
              stages={stages}
              defaultRm={defaultRm}
              accent="indigo"
              emptyHint="No prime process mapping saved."
            />
          </>
        ) : (
          <>
            <SearchableSelect
              label="Production Item"
              required
              value={itemDcode}
              onChange={(id) => setItemDcode(id || null)}
              disabled={isEdit || loading}
              heightClass={SELECT_H}
              fetchService={(params) => primeItemMasterHelpers.getProductionItemsViews({ ...params, ...PERMS })}
              getByIdService={(id) => primeItemMasterHelpers.getProductionItemViewById(id, PERMS)}
              dataKey="id"
              labelKey="item_code"
              subLabelKey="itemdesc"
              showDuplicateSubLabel
              preserveApiOrder
              usePortal={false}
            />

            {itemDcode && (
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wide text-indigo-700">Prime process</p>
                <ProcessStagesBlock
                  stages={stages}
                  onChange={setStages}
                  defaultRm={defaultRm}
                  rmSelectable={rmSelectable}
                  perms={PERMS}
                  rmHelpers={primeItemMasterHelpers}
                  accent="indigo"
                  processSelectMode="tags"
                  processFilters={{ prime: true }}
                />
              </div>
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
