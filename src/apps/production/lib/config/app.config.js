/**
 * Production settings UI — App Configuration → Production tab
 * Backend: backend/src/apps/production/lib/config/app.config.js
 */

export const PRODUCTION_APP_CONFIG = {
  appId: "production",
  tab: { id: "production", label: "Production", group: "app" },
  sections: [
    {
      id: "production",
      title: "Application settings",
      description: "Production app-level options.",
      layout: [["production_maintain_jobcard_tooling_required"]],
    },
  ],
};

export const PRODUCTION_MAINTAIN_JOBCARD_TOOLING_KEY = "production_maintain_jobcard_tooling_required";
