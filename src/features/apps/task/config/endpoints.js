import { CORE_ENDPOINTS } from "@/core/api/endpoints";

const TASK_API = "/task";

export const ENDPOINTS = {
  USERS: {
    ...CORE_ENDPOINTS.USERS,
    STATS:    CORE_ENDPOINTS.AUTH.STATS,
    PROFILE:  CORE_ENDPOINTS.AUTH.ME,
    PASSWORD: CORE_ENDPOINTS.AUTH.CHANGE_PASSWORD,
    LOGIN:    CORE_ENDPOINTS.AUTH.LOGIN,
    LOGOUT:   CORE_ENDPOINTS.AUTH.LOGOUT,
  },
  DEPARTMENTS: CORE_ENDPOINTS.DEPARTMENTS,
  DESIGNATIONS: CORE_ENDPOINTS.DESIGNATIONS,
  
  TASKS: {
    LIST: `${TASK_API}/tasks`,
    SELF: `${TASK_API}/tasks/self`,
    item: (taskId) => `${TASK_API}/tasks/${taskId}`,
    toggleStatus: (taskId) => `${TASK_API}/tasks/${taskId}/toggle-status`,
    subUsers: (taskId) => `${TASK_API}/tasks/${taskId}/sub-users`,
    forward: (taskId) => `${TASK_API}/tasks/${taskId}/forward`,
    reassign: (taskId) => `${TASK_API}/tasks/${taskId}/reassign`,
    requestCompletion: (taskId) => `${TASK_API}/tasks/${taskId}/request-completion`,
    approveSub: (taskId, assignmentId) => `${TASK_API}/tasks/${taskId}/approve-sub/${assignmentId}`,
    rejectSub: (taskId, assignmentId) => `${TASK_API}/tasks/${taskId}/reject-sub/${assignmentId}`,
    creatorDecision: (taskId) => `${TASK_API}/tasks/${taskId}/creator-decision`,
    activity: (taskId) => `${TASK_API}/tasks/${taskId}/activity`,
    chat: (taskId) => `${TASK_API}/tasks/${taskId}/chat`,
    chatMessage: (taskId, chatId) => `${TASK_API}/tasks/${taskId}/chat/${chatId}`,
    selfNote: (taskId) => `${TASK_API}/tasks/${taskId}/self-note`,
    targetDates: (taskId) => `${TASK_API}/tasks/${taskId}/target-dates`,
    targetDate: (taskId) => `${TASK_API}/tasks/${taskId}/target-date`,
  },

  NOTIFICATIONS: {
    CHANNELS: `${TASK_API}/notifications/channels`,
    TEMPLATES: `${TASK_API}/notifications/templates`,
    template: (key) => `${TASK_API}/notifications/templates/${key}`,
    LOGS: `${TASK_API}/notifications/logs`,
    SEND: `${TASK_API}/notifications/send`,
  },

  RECURRING_TASKS: {
    LIST: `${TASK_API}/recurring-tasks/`,
    STATS: `${TASK_API}/recurring-tasks/stats`,
    item: (recurringId) => `${TASK_API}/recurring-tasks/${recurringId}`,
    attachments: (recurringId) =>
      `${TASK_API}/recurring-tasks/${recurringId}/attachments`,
  },

  CATEGORIES: {
    LIST: `${TASK_API}/categories/`,
    STATS: `${TASK_API}/categories/stats`,
    item: (categoryId) => `${TASK_API}/categories/${categoryId}`,
  },

  HOLIDAYS: {
    LIST: `${TASK_API}/holidays`,
    BULK_UPLOAD: `${TASK_API}/holidays/bulk-upload`,
    item: (holidayId) => `${TASK_API}/holidays/${holidayId}`,
  },

  REMINDERS: {
    LIST: `${TASK_API}/reminders`,
  },

  CL_TASKS: {
    LIST: `${TASK_API}/cl-tasks`,
    MY: `${TASK_API}/cl-tasks/my`,
    VERIFICATION: `${TASK_API}/cl-tasks/verification`,
    item: (id) => `${TASK_API}/cl-tasks/${id}`,
    submit: (id) => `${TASK_API}/cl-tasks/${id}/submit`,
    verify: (id) => `${TASK_API}/cl-tasks/${id}/verify`,
  },

  RED_TICKETS: {
    LIST: `${TASK_API}/red-tickets`,
    item: (id) => `${TASK_API}/red-tickets/${id}`,
  },

  REPORTS: {
    DAILY: `${TASK_API}/reports/daily`,
    REVIEW: `${TASK_API}/reports/review`,
  },
};
