/**
 * Global settings UI — Admin Console + Shortcut tabs
 * Backend: backend/src/apps/core/configuration/app.config.js
 */
export const ADMIN_CONSOLE_APP_CONFIG = {
  appId: "admin-console",
  tab: { id: "admin-console", label: "Admin Console", group: "global" },
  sections: [
    {
      id: "company",
      title: "Company details",
      description: "Shown on stickers and shared across apps.",
      layout: [
        ["company_name", "company_phone", "company_email"],
        ["company_pincode", "company_state", "company_gstin"],
        ["company_address"],
      ],
    },
  ],
};

export const SHORTCUT_APP_CONFIG = {
  appId: "shortcut",
  tab: { id: "shortcut", label: "Shortcut", group: "global" },
  customPanel: true,
};
