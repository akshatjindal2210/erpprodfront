/** One place for special-permission labels + short descriptions (UI). */
export const IMS_SPECIAL_PERMS = [
  {
    key: "inventory_out",
    label: "Inventory Out",
    desc: "Create inventory-out store outs (not only forwarding-note outs). Super admin always has this.",
  },
  {
    key: "inventory_approve",
    label: "Inventory Approve",
    desc: "Approve / authorize inventory-out entries. Separate from create permission.",
  },
  {
    key: "direct_forwarding_note",
    label: "Direct Forwarding Note",
    desc: "Create a forwarding note without Today's Dispatch Plan / schedule. Schedule-based New still works without this.",
  },
  {
    key: "manage_forwarding_bill",
    label: "Manage Forwarding Bill",
    desc: "Attach a bill on Forwarding Note Item-wise. Updating an already saved bill also needs Edit on Forwarding Note.",
  },
  {
    key: "packing_deviation",
    label: "Packing Deviation",
    desc: "Show Deviation button on Packing Entry sticker create. When monthly qty exceeds limit, enter excess qty + remarks (auto-approved). Super admin always has this.",
  },
];

export const RMSTORE_SPECIAL_PERMS = [
  {
    key: "type_spec_values",
    label: "Type Spec Values",
    desc: "Condition, grade & size/color can be typed freely (with suggestions). Without this, only dropdown values.",
  },
  {
    key: "issue_rm_mapped",
    label: "Issue RM — Mapped Select (SP1)",
    desc: "On Issue Request, choose any RM mapped to the job-card item. Without this, first mapped RM is auto-selected.",
  },
  {
    key: "in_process_rejection",
    label: "In-process Rejection",
    desc: "Submit in-process rejection requests. Approving still needs module authorize permission.",
  },
];
