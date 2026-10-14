"use client";

import ProductionMasterPage from "@/apps/rmstore/modules/master/production/Page";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import { finishProcessMasterService, finishProcessMasterHelpers } from "@/apps/engineering/lib/services/finishProcessMaster";
import FinishProcessModal from "./FinishProcessModal";

export default function FinishProcessMasterPage() {
  return (
    <ProductionMasterPage
      module={ENG_MODULES.FINISH_PROCESS_MASTER}
      service={finishProcessMasterService}
      helpers={finishProcessMasterHelpers}
      title="Finish Process Master"
      AddModal={FinishProcessModal}
      hideApprove
      showView
      deleteEntityLabel="Finish process mapping"
      listFilters={{ has_finish_process: true }}
    />
  );
}
