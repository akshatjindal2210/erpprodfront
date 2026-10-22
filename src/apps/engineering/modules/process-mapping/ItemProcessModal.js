"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowDown } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";
import { primeItemMasterService, primeItemMasterHelpers } from "@/apps/engineering/lib/services/primeItemMaster";
import { finishProcessMasterService, finishProcessMasterHelpers } from "@/apps/engineering/lib/services/finishProcessMaster";
import ProcessStagesBlock, {
  SELECT_H,
  asList,
  createNewStage,
  stagesFromJson,
  normalizeRmItems,
  stampItemRmOnStages,
  fetchRmSelectable,
} from "@/apps/engineering/modules/process-mapping/ProcessStagesBlock";
import ProcessMappingView from "@/apps/engineering/modules/process-mapping/ProcessMappingView";
import ProcessItemHeader from "@/apps/engineering/modules/process-mapping/ProcessItemHeader";
import {
  ItemProcessApprovalPanel,
  ItemProcessDrawerFooter,
  ItemProcessEditBanner,
  ItemProcessViewMeta,
  itemProcessDrawerTitle,
  persistItemProcessPlan,
  useItemProcessDrawerMode,
} from "@/apps/engineering/modules/process-mapping/itemProcessDrawerHelpers";

const CFG = {
  prime: {
    module: ENG_MODULES.PRIME_ITEM_MASTER,
    service: primeItemMasterService,
    helpers: primeItemMasterHelpers,
    itemLabel: "Prime Item",
    accent: "indigo",
    processFilters: { prime: true },
    planKey: "prime_process",
    saveMsg: "Prime process saved.",
    pickMsg: "Select a prime item.",
    existsToast: "This item already has a prime process — saving will update it.",
    viewDesc: "Prime item process",
    formDesc: "Prime item → stages → processes → machines + RM",
  },
  fg: {
    module: ENG_MODULES.FINISH_PROCESS_MASTER,
    service: finishProcessMasterService,
    helpers: finishProcessMasterHelpers,
    itemLabel: "Finish Item",
    accent: "emerald",
    processFilters: { fg: true },
    planKey: "fg_process",
    primeKey: "prime_process",
    saveMsg: "Finish process saved.",
    pickMsg: "Select a finish item.",
    existsToast: "This item already has a finish process — saving will update it.",
    primeMissingMsg: "No prime process for this item's prime item. Save and approve it in Prime Process Master first.",
    viewDesc: "Finish item process",
    formDesc: "Finish item → prime (locked) → finish stages",
  },
};

/** Prime / Finish process drawer — IMS approval + save (eng_item_process). */
export default function ItemProcessModal({ kind, open, onClose, onSuccess, editData = null, mode = "add" }) {
  const c = CFG[kind] || CFG.prime;
  const isFg = kind === "fg";
  const canAccess = useCanAccess();
  const canApprove = canAccess(c.module, "authorize").allowed;
  const { isEdit, isView, isApprove, isForm, sopPermissionType, itemLocked } = useItemProcessDrawerMode(mode);
  const PERMS = helperPerms(c.module, sopPermissionType);

  const sopAckRef = useRef(null);
  const [itemDcode, setItemDcode] = useState(null);
  const [primeItemCode, setPrimeItemCode] = useState(null);
  const [primeStages, setPrimeStages] = useState([]);
  const [defaultRm, setDefaultRm] = useState([]);
  const [stages, setStages] = useState([]);
  const [rmSelectable, setRmSelectable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSubmit, setActiveSubmit] = useState(null);
  const [draftApproved, setDraftApproved] = useState(false);

  const applyRow = (row) => {
    const rm = normalizeRmItems(row?.rm_items);
    setDefaultRm(rm);
    if (isFg) {
      setPrimeItemCode(row?.prime_item_code || null);
      setPrimeStages(asList(row?.[c.primeKey]?.stages).length ? stagesFromJson(row[c.primeKey], rm) : []);
      setStages(asList(row?.[c.planKey]?.stages).length ? stagesFromJson(row[c.planKey], rm) : [createNewStage()]);
    } else {
      setStages(asList(row?.[c.planKey]?.stages).length ? stagesFromJson(row[c.planKey], rm) : []);
    }
  };

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchRmSelectable().then((v) => alive && setRmSelectable(v));
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setItemDcode(null);
      setDefaultRm([]);
      setPrimeItemCode(null);
      setPrimeStages([]);
      setStages([]);
      setDraftApproved(false);
      return;
    }
    if ((isEdit || isView || isApprove) && editData?.item_dcode != null) {
      setItemDcode(editData.item_dcode);
      applyRow(editData);
    }
  }, [open, isEdit, isView, isApprove, editData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !isForm || isEdit || isApprove) return;
    setDefaultRm([]);
    setPrimeItemCode(null);
    setPrimeStages([]);
    setStages(itemDcode ? [createNewStage()] : []);
    if (!itemDcode) return;
    let alive = true;
    (async () => {
      try {
        const res = await c.service.getByItem(itemDcode);
        const row = res?.data;
        if (!alive || !row) return;
        const rm = normalizeRmItems(row.rm_items);
        setDefaultRm(rm);
        if (isFg) applyRow(row);
        else if (asList(row[c.planKey]?.stages).length) {
          setStages(stagesFromJson(row[c.planKey], rm));
          toast.info(c.existsToast);
        } else {
          setStages((prev) => stampItemRmOnStages(prev, rm));
        }
        if (isFg && row.id) toast.info(c.existsToast);
      } catch (err) {
        if (alive && isFg) toast.error(err?.message || "Could not load the prime process of this item.");
      }
    })();
    return () => { alive = false; };
  }, [itemDcode, open, isForm, isEdit, isApprove, c, isFg]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (statusOverride = null, actionKey = "save") => {
    if (!itemDcode) return toast.info(c.pickMsg);
    if (isFg && !primeStages.length) return toast.info(c.primeMissingMsg);
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setActiveSubmit(actionKey);
    setLoading(true);
    try {
      const res = await persistItemProcessPlan({
        service: c.service,
        editData,
        isEdit,
        isApprove,
        itemDcode,
        stages,
        statusOverride,
        draftApproved,
        wasAuthorized: editData?.is_approved === true,
        canApprove,
      });
      toast.success(res?.message || c.saveMsg);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      if (err?.isValidation) toast.info(err.message);
      else toast.error(err?.message || "Save failed");
    } finally {
      setLoading(false);
      setActiveSubmit(null);
    }
  };

  const primeTitle = useMemo(
    () => (isFg ? `Prime process${primeItemCode ? ` · ${primeItemCode}` : ""}` : "Prime process"),
    [isFg, primeItemCode]
  );

  const footer = (
    <ItemProcessDrawerFooter
      isView={isView}
      isApprove={isApprove}
      isEdit={isEdit}
      canApprove={canApprove}
      loading={loading}
      activeSubmit={activeSubmit}
      onClose={onClose}
      onSave={handleSave}
    />
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => handleSave(isApprove ? true : null, isApprove ? "approve" : "save")}
      title={itemProcessDrawerTitle(kind, mode)}
      description={isView ? c.viewDesc : c.formDesc}
      footer={footer}
      maxWidth="max-w-7xl"
    >
      <div className={`pb-3 ${isFg ? "space-y-3" : "space-y-2"}`}>
        {isView ? (
          <>
            <ItemProcessViewMeta row={editData} />
            <ProcessItemHeader label={c.itemLabel} itemCode={editData?.item_code} itemDesc={editData?.item_desc} accent={c.accent} />
            {isFg ? (
              <>
                <ProcessMappingView title={primeTitle} stages={primeStages} defaultRm={defaultRm} accent="indigo" emptyHint="No prime process mapped yet." />
                <div className="flex justify-center py-1 text-slate-400"><ArrowDown size={16} strokeWidth={2.25} /></div>
                <ProcessMappingView title="Finish process" stages={stages} defaultRm={defaultRm} accent="emerald" emptyHint="No finish process saved." />
              </>
            ) : (
              <ProcessMappingView title="Prime process" stages={stages} defaultRm={defaultRm} accent="indigo" emptyHint="No prime process saved." />
            )}
          </>
        ) : (
          <>
            <ItemProcessEditBanner show={isEdit && editData?.is_approved === true} />
            <SearchableSelect
              label={c.itemLabel}
              required
              value={itemDcode}
              onChange={(id) => setItemDcode(id || null)}
              disabled={itemLocked || loading}
              heightClass={SELECT_H}
              fetchService={(params) => c.helpers.getProductionItemsViews({ ...params, ...PERMS })}
              getByIdService={(id) => c.helpers.getProductionItemViewById(id, PERMS)}
              dataKey="id"
              labelKey="item_code"
              subLabelKey="itemdesc"
              showDuplicateSubLabel
              preserveApiOrder
              usePortal={false}
            />
            {itemDcode && (
              <>
                {isFg ? (
                  <ProcessMappingView title={`${primeTitle} (locked)`} stages={primeStages} defaultRm={defaultRm} accent="indigo" emptyHint="No prime process mapped yet." />
                ) : null}
                <div className="space-y-1">
                  <p className={`text-[10px] font-black uppercase tracking-wide ${isFg ? "text-emerald-700" : "text-indigo-700"}`}>
                    {isFg ? "Finish process" : "Prime process"}
                  </p>
                  <ProcessStagesBlock
                    stages={stages}
                    onChange={setStages}
                    defaultRm={defaultRm}
                    rmSelectable={rmSelectable}
                    perms={PERMS}
                    rmHelpers={c.helpers}
                    accent={c.accent}
                    processSelectMode="tags"
                    processFilters={c.processFilters}
                  />
                </div>
              </>
            )}
            <ItemProcessApprovalPanel
              showApproval={canApprove && mode === "add"}
              isApprove={isApprove}
              isEdit={isEdit}
              canApprove={canApprove}
              approved={draftApproved}
              onApprovedChange={setDraftApproved}
            />
            <ModuleSopAcknowledgment ref={sopAckRef} key={`${open}-${sopPermissionType}`} moduleSlug={c.module} permissionType={sopPermissionType} isOpen={open} />
          </>
        )}
      </div>
    </Drawer>
  );
}
