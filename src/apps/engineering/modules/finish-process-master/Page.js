"use client";

import ItemProcessPage from "@/apps/engineering/modules/process-mapping/ItemProcessPage";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import { finishProcessMasterService } from "@/apps/engineering/lib/services/finishProcessMaster";
import FinishProcessModal from "./FinishProcessModal";

export default function FinishProcessMasterPage() {
  return (
    <ItemProcessPage
      type="fg"
      module={ENG_MODULES.FINISH_PROCESS_MASTER}
      service={finishProcessMasterService}
      title="Finish Process Master"
      Modal={FinishProcessModal}
    />
  );
}
