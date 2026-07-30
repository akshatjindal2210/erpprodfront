/** Keep in sync with backend/src/config/portal/portalModules.js */

export const APP_GATES = {
  core: "app_core",
  ims: "app_ims",
  rmstore: "app_rmstore",
  task: "app_task",
};

export const APP_META = {
  core: { label: "Admin Console", permissions: true },
  ims: { label: "IMS", permissions: true },
  rmstore: { label: "RM Store", permissions: true },
  task: { label: "Task", permissions: true },
};

export const MODULES = {
  core: [
    { name: "users", label: "User Management" },
    { name: "modules", label: "System Module" },
    { name: "training_videos", label: "Training Videos" },
    { name: "departments", label: "Departments" },
    { name: "designations", label: "Designations" },
  ],
  ims: [
    { name: "product_master", label: "Product Master" },
    { name: "customer_master", label: "Customer Master" },
    { name: "customer_item_code", label: "Customer Item Code" },
    { name: "packing_standard", label: "Packing Standard" },
    { name: "location_master", label: "Store Location Master" },
    { name: "packing_entry", label: "Packing Entry" },
    { name: "boxes", label: "Boxes" },
    { name: "inventory_inwards", label: "Store In" },
    { name: "forwarding_note_master", label: "Forwarding Note" },
    { name: "out_entry", label: "Store Out" },
    { name: "change_override_customer", label: "Change / Override Customer" },
    { name: "stock_adjustment", label: "Stock Adjustment" },
    { name: "inventory_report", label: "Inventory Report" },
    { name: "erp_stock_report", label: "ERP Stock Report" },
    { name: "activity_logs", label: "Activity Logs" },
    { name: "box_transaction_logs", label: "Box Transaction Logs" },
    { name: "sticker_download_logs", label: "Sticker Download Logs" },
    { name: "audit", label: "Inventory Audit" },
    { name: "qc_hold_material", label: "QC Hold Material" },
    { name: "schedule_planning", label: "Schedule Planning" },
  ],
  rmstore: [
    /*
    { name: "rm_production_master", label: "Production Master" },
    { name: "rm_spec_master", label: "RM Spec Master" },
    { name: "rm_store_location_master", label: "RM Store Location Master" },
    { name: "rm_mrn_portal", label: "MRN Portal" },
    { name: "rm_coils", label: "Coils" },
    { name: "rm_inventory_inwards", label: "Store In" },
    { name: "rm_qc_check", label: "QC Check" },
    { name: "rm_rejection", label: "RM Rejection" },
    { name: "rm_issue_request", label: "Issue Request" },
    { name: "rm_out_entry", label: "Store Out" },
    { name: "rm_stock_adjustment", label: "Stock Adjustment" },
    { name: "rm_inventory_report", label: "RM Inventory" },
    { name: "rm_activity_logs", label: "Activity Logs" },
    { name: "rm_coil_transaction_logs", label: "Coil Transaction Logs" },
    { name: "rm_coil_download_logs", label: "Coil Download Logs" },
    */
  ],
  task: [
    { name: "cl_task_master", label: "CL Task Master" },
    { name: "cl_task", label: "CL Task" },
    { name: "cl_task_verification", label: "CL Task Verification" },
    { name: "task_report", label: "CL Task Report" },
    { name: "red_ticket", label: "Red Ticket" },
    { name: "category", label: "Category" },
    { name: "holiday", label: "Holiday" },
  ],
};

export const PORTAL_APP_KEYS = ["core", "ims", "task"]; // rmstore — not live yet

export const SETTINGS_MODULES = ["users", "modules", "training_videos", "departments", "designations"];
