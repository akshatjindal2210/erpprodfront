/** RM Store Out — type picker cards (IMS Out Entry modal style). */

export const RM_OUT_ENTRY_PICKER_ACCENT = {
  red: {
    card: "border-red-200 bg-red-50/60 hover:border-red-400 hover:bg-red-50",
    title: "text-red-800",
  },
  indigo: {
    card: "border-indigo-200 bg-indigo-50/60 hover:border-indigo-400 hover:bg-indigo-50",
    title: "text-indigo-900",
  },
};

export const RM_OUT_ENTRY_MODE_PICKER_OPTIONS = [
  // {
  //   id: "store_out",
  //   kind: "mrn",
  //   title: "Store Out",
  //   description: "Stock leaves inventory — sale, return, or other reason.",
  //   accent: "red",
  //   icon: "log-out",
  // },
  {
    id: "job_card",
    kind: "job_card",
    title: "Job Card",
    description: "Issue coils to production job card.",
    accent: "indigo",
    icon: "clipboard",
  },
];
