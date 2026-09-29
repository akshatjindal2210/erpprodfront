"use client";

import ProductMasterPage from "@/apps/ims/modules/master/ProductMaster";
import { rmProductService } from "@/apps/rmstore/lib/services/rmProduct";

export default function RmProductMasterPage() {
  return <ProductMasterPage fetchItems={rmProductService.getItems} title="RM Product Master" eyebrow="RM product master" showGroupFilter={false} />;
}
