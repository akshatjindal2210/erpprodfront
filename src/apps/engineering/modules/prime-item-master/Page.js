"use client";

import ItemProcessPage from "@/apps/engineering/modules/process-mapping/ItemProcessPage";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import { primeItemMasterService } from "@/apps/engineering/lib/services/primeItemMaster";
import PrimeItemModal from "./PrimeItemModal";

export default function PrimeItemMasterPage() {
  return (
    <ItemProcessPage
      type="prime"
      module={ENG_MODULES.PRIME_ITEM_MASTER}
      service={primeItemMasterService}
      title="Prime Process Master"
      Modal={PrimeItemModal}
    />
  );
}
