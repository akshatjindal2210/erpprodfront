/**
 * RM Store settings UI — App Configuration → RM Store tab
 * Backend: backend/src/apps/rmstore/lib/config/app.config.js
 */
export const RMSTORE_APP_CONFIG = {
  appId: "rmstore",
  tab: { id: "rmstore", label: "RM Store", group: "app" },
  sections: [
    {
      id: "rmstore",
      title: "MRN / coil settings",
      description: "Controls QC sticker mode and how coil quantities work when generating MRN stickers.",
      layout: [
        ["mrn_sticker_mode", "mrn_coil_qty_editable", "mrn_coil_qty_auto_calc"],
        ["mrn_sticker_require_spec"],
      ],
    },
  ],
};
