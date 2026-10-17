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
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_PRIMARY } from "@/apps/ims/lib/helpers/masterListUi";
import ProcessStagesBlock, { SELECT_H, asList, createNewStage, stagesFromJson, buildProcessPayload, validateStages, normalizeRmItems, stampItemRmOnStages, fetchRmSelectable } from "@/apps/engineering/modules/process-mapping/ProcessStagesBlock";
import ProcessMappingView from "@/apps/engineering/modules/process-mapping/ProcessMappingView";
import ProcessItemHeader from "@/apps/engineering/modules/process-mapping/ProcessItemHeader";

const MODULE = ENG_MODULES.PRIME_ITEM_MASTER;

/**
 * Prime process of a prime item — saved in eng_item_process as type "prime".
 * RM wire processes come with the item's Item RM (production) RM pre-selected, in DB order.
 */
export default function PrimeItemModal({ open, onClose, onSuccess, editData = null, mode = "add" }) {
  const sopAckRef = useRef(null);
  const isEdit = mode === "edit";
  const isView = mode === "view";
  const sopPermissionType = isEdit ? "edit" : "add";
  const PERMS = helperPerms(MODULE, sopPermissionType);

  const [itemDcode, setItemDcode] = useState(null);
  const [defaultRm, setDefaultRm] = useState([]);
  const [stages, setStages] = useState([]);
  const [rmSelectable, setRmSelectable] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchRmSelectable().then((v) => alive && setRmSelectable(v));
    return () => {
      alive = false;
    };
  }, [open]);

  // Edit / view → the row's own prime
  useEffect(() => {
    if (!open) {
      setItemDcode(null);
      setDefaultRm([]);
      setStages([]);
      return;
    }
    if ((isEdit || isView) && editData?.item_dcode != null) {
      const rm = normalizeRmItems(editData.rm_items);
      setItemDcode(editData.item_dcode);
      setDefaultRm(rm);
      setStages(stagesFromJson(editData.prime_process, rm));
    }
  }, [open, isEdit, isView, editData]);

  // New → picked item: its RM (+ its saved prime, which save then updates)
  useEffect(() => {
    if (!open || isEdit || isView) return;
    setDefaultRm([]);
    setStages(itemDcode ? [createNewStage()] : []);
    if (!itemDcode) return;
    let alive = true;
    (async () => {
      try {
        const res = await primeItemMasterService.getByItem(itemDcode);
        const row = res?.data;
        if (!alive || !row) return;
        const rm = normalizeRmItems(row.rm_items);
        setDefaultRm(rm);
        if (asList(row.prime_process?.stages).length) {
          setStages(stagesFromJson(row.prime_process, rm));
          toast.info("This item already has a prime process — saving will update it.");
        } else {
          setStages((prev) => stampItemRmOnStages(prev, rm));
        }
      } catch {
        /* new prime */
      }
    })();
    return () => {
      alive = false;
    };
  }, [itemDcode, open, isEdit, isView]);

  const handleSubmit = async () => {
    if (!itemDcode) return toast.info("Select a prime item.");
    const invalid = validateStages(stages);
    if (invalid) return toast.info(invalid);
    if (!sopAckRef.current?.assertAcknowledged()) return;

    const body = { item_dcode: itemDcode, process: buildProcessPayload(stages, itemDcode) };
    setLoading(true);
    try {
      const res = isEdit
        ? await primeItemMasterService.update(editData.id, body)
        : await primeItemMasterService.create(body);
      toast.success(res?.message || "Prime process saved.");
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
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Check size={18} /> Save
            </>
          )}
        </button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={isView ? onClose : handleSubmit}
      title={isView ? "View Prime Process" : isEdit ? "Edit Prime Process" : "New Prime Process Master"}
      description={isView ? "Prime item process" : "Prime item → stages → processes → machines + RM"}
      footer={footer}
      maxWidth="max-w-7xl"
    >
      <div className="space-y-2 pb-3">
        {isView ? (
          <>
            <ProcessItemHeader label="Prime Item" itemCode={editData?.item_code} itemDesc={editData?.item_desc} accent="indigo" />
            <ProcessMappingView title="Prime process" stages={stages} defaultRm={defaultRm} accent="indigo" emptyHint="No prime process saved." />
          </>
        ) : (
          <>
            <SearchableSelect
              label="Prime Item"
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
