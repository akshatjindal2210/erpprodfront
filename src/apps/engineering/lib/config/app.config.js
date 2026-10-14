/**
 * Engineering settings UI — App Configuration → Engineering tab
 * Backend: backend/src/apps/engineering/lib/config/app.config.js
 */

export const ENGINEERING_APP_CONFIG = {
  appId: "engineering",
  tab: { id: "engineering", label: "Engineering", group: "app" },
  sections: [
    {
      id: "engineering",
      title: "Application settings",
      description: "Engineering app-level options.",
      layout: [["prime_item_rm_wire_selectable"]],
    },
  ],
};
