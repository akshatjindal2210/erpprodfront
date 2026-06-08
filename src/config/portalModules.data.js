/** Keep in sync with backend/src/config/portalModules.js */

export const APP_GATES = {
  core: "app_core",
  ims: "app_ims",
  task: "app_task",
};

export const APP_META = {
  core: { label: "Admin Console", permissions: true },
  ims: { label: "IMS", permissions: true },
  task: { label: "Task", permissions: false },
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
    { name: "activity_logs", label: "Activity Logs" },
    { name: "box_transaction_logs", label: "Box Transaction Logs" },
    { name: "sticker_download_logs", label: "Sticker Download Logs" },
    { name: "audit", label: "Inventory Audit" },
  ],
  task: [
    { name: "tasks", label: "Tasks" },
    { name: "recurring_tasks", label: "Recurring Tasks" },
    { name: "categories", label: "Categories" },
    { name: "holidays", label: "Holidays" },
    { name: "activity_logs", label: "Activity Logs" },
  ],
};

export const PORTAL_APP_KEYS = ["core", "ims", "task"];

export const SETTINGS_MODULES = ["users", "modules", "training_videos", "departments", "designations"];
