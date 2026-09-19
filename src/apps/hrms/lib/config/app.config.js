/**
 * HRMS settings UI — App Configuration → HRMS tab
 * Backend: backend/src/apps/hrms/lib/config/app.config.js
 */

export const HRMS_APP_CONFIG = {
  appId: "hrms",
  tab: { id: "hrms", label: "HRMS", group: "app" },
  sections: [
    {
      id: "hrms",
      title: "Application settings",
      description: "HRMS attendance and overtime options.",
      layout: [["hrms_overtime_buffer_minutes"]],
    },
  ],
};
