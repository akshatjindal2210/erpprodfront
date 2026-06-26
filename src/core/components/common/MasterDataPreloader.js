"use client";

import { useEffect, useMemo } from "react";
import { masterService } from "@/features/apps/ims/services/master";
import { helperPerms } from "@/features/apps/ims/helpers/helperPerms";
import { useCanAccess } from "@/core/hooks/useCanAccess";

function isAllowed(access) {
  return typeof access === "object" ? !!access?.allowed : !!access;
}

function firstPageModule(canAccess, pairs) {
  for (const [slug, actions] of pairs) {
    const list = Array.isArray(actions) ? actions : [actions];
    if (list.some((action) => isAllowed(canAccess(slug, action)))) return slug;
  }
  return null;
}

/**
 * Warms masterService cache using the user's actual page permission — not customer_master by default.
 */
export default function MasterDataPreloader() {
  const canAccess = useCanAccess();

  const gates = useMemo(() => {
    const packingEntry = isAllowed(canAccess("packing_entry", "view"));

    const items = firstPageModule(canAccess, [
      ["product_master", "view"],
      ["forwarding_note_master", "view"],
      ["stock_adjustment", "view"],
      ["location_master", "view"],
      ["packing_standard", "view"],
    ]);

    const ledgers = firstPageModule(canAccess, [
      ["customer_master", "view"],
      ["forwarding_note_master", "view"],
      ["stock_adjustment", "view"],
      ["out_entry", "view"],
      ["location_master", "view"],
      ["boxes", "view"],
      ["change_override_customer", ["view", "add", "edit"]],
      ["packing_standard", "view"],
      ["packing_entry", "view"],
    ]);

    return { packingEntry, items, ledgers };
  }, [canAccess]);

  useEffect(() => {
    const preload = async () => {
      const tasks = [];

      if (gates.items === "product_master") {
        tasks.push(masterService.getItems().catch(() => {}));
      } else if (gates.items) {
        tasks.push(
          masterService.getItemsViews(helperPerms(gates.items)).catch(() => {})
        );
      }

      if (gates.ledgers === "customer_master") {
        tasks.push(masterService.getLedgers().catch(() => {}));
      } else if (gates.ledgers) {
        tasks.push(
          masterService.getLedgersViews(helperPerms(gates.ledgers)).catch(() => {})
        );
      }

      if (gates.packingEntry) {
        tasks.push(
          masterService
            .getDailyProdViews({
              ...helperPerms("packing_entry"),
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
