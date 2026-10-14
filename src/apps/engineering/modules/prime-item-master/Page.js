"use client";

import ProductionMasterPage from "@/apps/rmstore/modules/master/production/Page";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import { primeItemMasterService, primeItemMasterHelpers } from "@/apps/engineering/lib/services/primeItemMaster";
import PrimeItemModal from "./PrimeItemModal";

export default function PrimeItemMasterPage() {
  return (
    <ProductionMasterPage
      module={ENG_MODULES.PRIME_ITEM_MASTER}
      service={primeItemMasterService}
      helpers={primeItemMasterHelpers}
      title="Prime Process Master"
      AddModal={PrimeItemModal}
      hideApprove
      showView
      deleteEntityLabel="Prime process mapping"
      listFilters={{ has_prime_process: true }}
    />
  );
}
