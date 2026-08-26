/**
 * RM Store settings UI — App Configuration → RM Store tab
 * Backend: backend/src/apps/rmstore/lib/config/app.config.js
 */

/** true = one job card per machine until Store Out; false = multiple job cards per machine */
export const ISSUE_REQUEST_MACHINE_JOB_CARD_LOCK = true;

export const RMSTORE_APP_CONFIG = {
  appId: "rmstore",
  tab: { id: "rmstore", label: "RM Store", group: "app" },
  sections: [
    {
      id: "rmstore",
      title: "Application settings",
      description: "RM Store app-level options.",
      layout: [
        ["inward_location_validation", "location_capacity_validation", "mrn_sticker_mode"],
        ["mrn_coil_qty_editable", "mrn_coil_qty_auto_calc"],
      ],
    },
  ],
};
