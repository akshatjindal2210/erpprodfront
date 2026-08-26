/**
 * IMS settings UI — App Configuration → IMS tab
 * Backend: backend/src/apps/ims/lib/config/app.config.js
 */
export const IMS_APP_CONFIG = {
  appId: "ims",
  tab: { id: "ims", label: "IMS", group: "app" },
  sections: [
    {
      id: "application",
      title: "Application settings",
      description: "IMS app-level options.",
      layout: [
        ["inward_location_validation", "location_capacity_validation", "default_list_view_span_days"],
        ["box_qr_public_base_url"],
      ],
    },
  ],
};
