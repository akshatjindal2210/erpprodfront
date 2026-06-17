import { DASHBOARD_STAT_KEYS, STAT_CARDS } from "@/features/apps/task/components/tasks_common_component/TaskConstant";

export const TASK_NOTIFY_VARIABLE_KEYS = [
  "task_id",
  "task_title",
  "task_description",
  "user_name",
  "status",
  "priority",
  "category",
  "assigned_by",
  "assigned_to_name",
  "created_by_name",
  "current_holder_name",
  "due_date",
  "reminder_date",
  "target_date",
  "reminder_at",
  "created_at",
  "completed_at",
  "task_type",
  ...DASHBOARD_STAT_KEYS,
];

export const TASK_NOTIFY_VARIABLE_GROUPS = [
  {
    label: "Task",
    keys: ["task_id", "task_title", "task_description", "priority", "category", "task_type"],
  },
  {
    label: "People",
    keys: ["user_name", "assigned_by", "assigned_to_name", "created_by_name", "current_holder_name"],
  },
  {
    label: "Status",
    keys: ["status"],
  },
  {
    label: "Dates",
    keys: ["due_date", "reminder_date", "target_date", "reminder_at", "created_at", "completed_at"],
  },
  {
    label: "Dashboard counts",
    keys: DASHBOARD_STAT_KEYS,
    labels: Object.fromEntries(STAT_CARDS.map((c) => [c.key, c.label])),
  },
];
