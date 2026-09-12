export const SCHEDULE_REPORT_FILTER = {
  DEFAULT: "default",
  CUSTOM: "custom",
};

export const SCHEDULE_REPORT_FILTER_OPTIONS = [
  { value: SCHEDULE_REPORT_FILTER.DEFAULT, label: "Default" },
  { value: SCHEDULE_REPORT_FILTER.CUSTOM, label: "Custom" },
];

const MONTH_FULL_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_FILTER_OPTIONS = [
  { value: "all", label: "All Months" },
  ...MONTH_FULL_NAMES.map((label, i) => ({ value: String(i + 1), label })),
];
