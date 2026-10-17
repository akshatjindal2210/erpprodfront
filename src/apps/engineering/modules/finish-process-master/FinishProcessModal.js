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
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_PRIMARY } from "@/apps/ims/lib/helpers/masterListUi";
import ProcessStagesBlock, { SELECT_H, asList, createNewStage, stagesFromJson, buildProcessPayload, validateStages, normalizeRmItems, fetchRmSelectable } from "@/apps/engineering/modules/process-mapping/ProcessStagesBlock";
import ProcessMappingView from "@/apps/engineering/modules/process-mapping/ProcessMappingView";
import ProcessItemHeader from "@/apps/engineering/modules/process-mapping/ProcessItemHeader";

const MODULE = ENG_MODULES.FINISH_PROCESS_MASTER;

/**
 * Finish process of a finish item — saved in eng_item_process as type "fg", on its prime item's prime (IMS PrimItemdcode).
 * Prime is shown locked. RM wire processes come with the prime item's Item RM (production) RM pre-selected, in DB order.
 */
export default function FinishProcessModal({ open, onClose, onSuccess, editData = null, mode = "add" }) {
  const sopAckRef = useRef(null);
  const isEdit = mode === "edit";
  const isView = mode === "view";
  const sopPermissionType = isEdit ? "edit" : "add";
  const PERMS = helperPerms(MODULE, sopPermissionType);

  const [itemDcode, setItemDcode] = useState(null);
  const [primeItemCode, setPrimeItemCode] = useState(null);
  const [primeStages, setPrimeStages] = useState([]);
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

  /** Row (or draft) from the API → form. `rm_items` = the prime item's RM. */
  const applyRow = (row) => {
    const rm = normalizeRmItems(row?.rm_items);
    setDefaultRm(rm);
    setPrimeItemCode(row?.prime_item_code || null);
    setPrimeStages(asList(row?.prime_process?.stages).length ? stagesFromJson(row.prime_process, rm) : []);
    setStages(asList(row?.fg_process?.stages).length ? stagesFromJson(row.fg_process, rm) : [createNewStage()]);
  };

  // Edit / view → the row
  useEffect(() => {
    if (!open) {
      setItemDcode(null);
      setDefaultRm([]);
      setPrimeItemCode(null);
      setPrimeStages([]);
      setStages([]);
      return;
    }
    if ((isEdit || isView) && editData?.item_dcode != null) {
      setItemDcode(editData.item_dcode);
      applyRow(editData);
    }
  }, [open, isEdit, isView, editData]);

  // New → picked finish item: its prime item's prime (+ its own Finish process when already saved)
  useEffect(() => {
    if (!open || isEdit || isView) return;
    setDefaultRm([]);
    setPrimeItemCode(null);
    setPrimeStages([]);
    setStages(itemDcode ? [createNewStage()] : []);
    if (!itemDcode) return;
    let alive = true;
    (async () => {
      try {
        const res = await finishProcessMasterService.getByItem(itemDcode);
        if (!alive || !res?.data) return;
        applyRow(res.data);
        if (res.data.id) toast.info("This item already has a finish process — saving will update it.");
      } catch (err) {
        if (alive) toast.error(err?.message || "Could not load the prime process of this item.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [itemDcode, open, isEdit, isView]);

  const handleSubmit = async () => {
    if (!itemDcode) return toast.info("Select a finish item.");
    if (!primeStages.length) {
      return toast.info("No prime process for this item's prime item. Save it in Prime Process Master first.");
    }
    const invalid = validateStages(stages);
    if (invalid) return toast.info(invalid);
    if (!sopAckRef.current?.assertAcknowledged()) return;

    const body = { item_dcode: itemDcode, process: buildProcessPayload(stages, itemDcode) };
    setLoading(true);
    try {
      const res = isEdit
        ? await finishProcessMasterService.update(editData.id, body)
        : await finishProcessMasterService.create(body);
      toast.success(res?.message || "Finish process saved.");
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
          {loading ? (<><Loader2 size={18} className="animate-spin" /> Saving...</>) : (<><Check size={18} /> Save</>)}
        </button>
      )}
    </div>
  );

  const primeTitle = `Prime process${primeItemCode ? ` · ${primeItemCode}` : ""}`;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={isView ? onClose : handleSubmit}
      title={isView ? "View Finish Process" : isEdit ? "Edit Finish Process" : "New Finish Process Master"}
      description={isView ? "finish item process" : "finish item → prime (locked) → finish stages"}
      footer={footer}
      maxWidth="max-w-7xl"
    >
      <div className="space-y-3 pb-3">
        {isView ? (
          <>
            <ProcessItemHeader label="Finish Item" itemCode={editData?.item_code} itemDesc={editData?.item_desc} accent="emerald" />
            <ProcessMappingView title={primeTitle} stages={primeStages} defaultRm={defaultRm} accent="indigo" emptyHint="No prime process mapped yet." />
            <div className="flex justify-center py-1 text-slate-400">
              <ArrowDown size={16} strokeWidth={2.25} />
            </div>
            <ProcessMappingView title="Finish process" stages={stages} defaultRm={defaultRm} accent="emerald" emptyHint="No Finish process saved." />
          </>
        ) : (
          <>
            <SearchableSelect
              label="Finish Item"
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
                <ProcessMappingView title={`${primeTitle} (locked)`} stages={primeStages} defaultRm={defaultRm} accent="indigo" emptyHint="No prime process mapped yet." />

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
