import { UserPlus, Globe, Video, SlidersHorizontal, Briefcase, Award } from "lucide-react";
import { ROUTES } from "@/features/admin/configuration/utils/routes";

/** Global settings sidebar — super admin (users, modules, training, app config). */
export const SETTINGS_NAV_REGISTRY = [
  {
    id: "users",
    name: "User Management",
    icon: <UserPlus size={16} />,
    href: ROUTES.SETTINGS_USERS,
    module: "users",
  },
  {
    id: "departments",
    name: "Departments",
    icon: <Briefcase size={16} />,
    href: ROUTES.SETTINGS_DEPARTMENTS,
    module: "departments",
  },
  {
    id: "designations",
    name: "Designations",
    icon: <Award size={16} />,
    href: ROUTES.SETTINGS_DESIGNATIONS,
    module: "designations",
  },
  {
    id: "modules",
    name: "System Module",
    icon: <Globe size={16} />,
    href: ROUTES.SETTINGS_MODULES,
    module: "modules",
  },
  {
    id: "training",
    name: "Training & SOPs",
    icon: <Video size={16} />,
    href: ROUTES.SETTINGS_TRAINING,
    module: "training_videos",
  },
  {
    id: "app-configuration",
    name: "Application Configuration",
    icon: <SlidersHorizontal size={16} />,
    href: ROUTES.SETTINGS_APP_CONFIG,
    module: null,
    roles: ["super_admin"],
  },
];

