export const SOCKET = {
  NEW_ALERT: "inbox_alert",
  INBOX_SYNC: "inbox_sync",
};

export const ROUTES = {
  TASK_LIST: "/task/dashboard/tasks",
  taskDetail: (taskId) => (taskId ? `/task/dashboard/tasks/${taskId}` : "/task/dashboard/tasks"),
};

export const APP_TYPE_LABELS = {
  task: "Task",
  ims: "IMS",
};

export function getAppTypeLabel(appType) {
  return APP_TYPE_LABELS[appType] ?? "App";
}

export const TRIGGER_LABELS = {
  task_assigned: "New task",
  target_date_set: "Target date",
  daily_reminder: "Daily summary",
  personal_reminder: "Reminder",
  status_changed: "Status update",
};

export function getTriggerLabel(key) {
  return TRIGGER_LABELS[key] ?? "Task update";
}
