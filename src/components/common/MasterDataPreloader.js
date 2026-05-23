"use client";

import { useEffect, useMemo } from "react";
import { masterService } from "@/services/master";
import { useCanAccess } from "@/hooks/useCanAccess";

function isAllowed(access) {
  return typeof access === "object" ? !!access?.allowed : !!access;
}

/**
 * Warms masterService cache only for modules the user can access.
 * Avoids calling e.g. ledgers/list with default customer_master when the user only has packing_standard (403).
 */
export default function MasterDataPreloader() {
  const canAccess = useCanAccess();

  const gates = useMemo(() => {
    const product = isAllowed(canAccess("product_master", "view"));
    const customer = isAllowed(canAccess("customer_master", "view"));
    const packing = isAllowed(canAccess("packing_standard", "view"));
    const overrideCust =
      isAllowed(canAccess("change_override_customer", "view")) ||
      isAllowed(canAccess("change_override_customer", "edit")) ||
      isAllowed(canAccess("change_override_customer", "add"));
    return {
      items: product
        ? "product_master"
        : packing
          ? "packing_standard"
          : null,
      ledgers: customer
        ? "customer_master"
        : overrideCust
          ? "change_override_customer"
          : packing
            ? "packing_standard"
            : null,
    };
  }, [canAccess]);

  useEffect(() => {
    const preload = async () => {
      const tasks = [];
      if (gates.items === "product_master") {
        tasks.push(masterService.getItems().catch(() => {}));
      } else if (gates.items === "packing_standard") {
        tasks.push(
          masterService
            .getItemsViews({
              permission_module: "packing_standard",
              permission_action: "view",
            })
            .catch(() => {})
        );
      }
      if (gates.ledgers === "customer_master") {
        tasks.push(masterService.getLedgers().catch(() => {}));
      } else if (gates.ledgers === "change_override_customer") {
        tasks.push(
          masterService
            .getLedgersViews({
              permission_module: "change_override_customer",
              permission_action: "view",
            })
            .catch(() => {})
        );
      } else if (gates.ledgers === "packing_standard") {
        tasks.push(
          masterService
            .getLedgersViews({
              permission_module: "packing_standard",
              permission_action: "view",
            })
            .catch(() => {})
        );
      }
      await Promise.all(tasks);
    };

    const timer = setTimeout(preload, 2000);
    return () => clearTimeout(timer);
  }, [gates.items, gates.ledgers]);

  return null;
}
