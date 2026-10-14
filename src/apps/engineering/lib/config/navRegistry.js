"use client";

import { Zap, Package, GitBranch, Cpu, Factory } from "lucide-react";
import { ROUTES } from "@/apps/engineering/lib/utils/routes";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";

export const ENGINEERING_NAV_REGISTRY = [
  { id: "dashboard", name: "Dashboard", icon: <Zap size={16} />, href: ROUTES.ENGINEERING_DASHBOARD, module: null },
  {
    id: "masters-group",
    name: "Masters",
    icon: <Package size={16} />,
    module: null,
    subItems: [
      {
        id: "process-master",
        name: "Process Master",
        icon: <GitBranch size={14} />,
        href: ROUTES.ENGINEERING_PROCESS_MASTER,
        module: ENG_MODULES.PROCESS_MASTER,
      },
      {
        id: "machine-master",
        name: "Machine Master",
        icon: <Cpu size={14} />,
        href: ROUTES.ENGINEERING_MACHINE_MASTER,
        module: ENG_MODULES.MACHINE_MASTER,
      },
      {
        id: "prime-item-master",
        name: "Prime Process Master",
        icon: <Factory size={14} />,
        href: ROUTES.ENGINEERING_PRIME_ITEM_MASTER,
        module: ENG_MODULES.PRIME_ITEM_MASTER,
      },
      {
        id: "finish-process-master",
        name: "Finish Process Master",
        icon: <Factory size={14} />,
        href: ROUTES.ENGINEERING_FINISH_PROCESS_MASTER,
        module: ENG_MODULES.FINISH_PROCESS_MASTER,
      },
    ],
  },
];
