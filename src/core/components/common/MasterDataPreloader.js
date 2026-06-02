"use client";

import { useEffect, useMemo } from "react";
import { masterService } from "@/features/apps/ims/services/master";
import { useCanAccess } from "@/core/hooks/useCanAccess";

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
    const packingEntry = isAllowed(canAccess("packing_entry", "view"));
    const overrideCust =
      isAllowed(canAccess("change_override_customer", "view")) ||
      isAllowed(canAccess("change_override_customer", "edit")) ||
      isAllowed(canAccess("change_override_customer", "add"));
    return {
      packingEntry,
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
            : packingEntry
              ? "packing_entry"
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
      } else if (gates.ledgers === "packing_entry") {
        tasks.push(
          masterService
            .getLedgersViews({
              permission_module: "packing_entry",
              permission_action: "view",
            })
            .catch(() => {})
        );
      }
      if (gates.packingEntry) {
        tasks.push(
          masterService
            .getDailyProdViews({
              permission_module: "packing_entry",
              permission_action: "view",
              page: 1,
              limit: 100,
            })
            .catch(() => {})
        );
      }
      await Promise.all(tasks);
    };

    const timer = setTimeout(preload, 2000);
    return () => clearTimeout(timer);
  }, [gates.items, gates.ledgers, gates.packingEntry]);

  return null;
}

