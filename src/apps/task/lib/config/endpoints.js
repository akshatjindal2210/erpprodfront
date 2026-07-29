import { CORE_ENDPOINTS } from "@/platform/api/endpoints";

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
    BASE: `${TASK_API}/recurring-tasks`,
    LIST: `${TASK_API}/recurring-tasks/list`,
    STATS: `${TASK_API}/recurring-tasks/stats`,
    item: (recurringId) => `${TASK_API}/recurring-tasks/${recurringId}`,
    attachments: (recurringId) =>
      `${TASK_API}/recurring-tasks/${recurringId}/attachments`,
  },

  CATEGORIES: {
    LIST: `${TASK_API}/categories/list`,
    HELPER: `${TASK_API}/categories/helper`,
    GET: `${TASK_API}/categories/get`,
    CREATE: `${TASK_API}/categories/create`,
    UPDATE: `${TASK_API}/categories/update`,
    DELETE: `${TASK_API}/categories/delete`,
  },

  HOLIDAYS: {
    LIST: `${TASK_API}/holidays/list`,
    GET: `${TASK_API}/holidays/get`,
    CREATE: `${TASK_API}/holidays/create`,
    UPDATE: `${TASK_API}/holidays/update`,
    DELETE: `${TASK_API}/holidays/delete`,
    BULK_UPLOAD: `${TASK_API}/holidays/bulk-upload`,
  },

  REMINDERS: {
    LIST: `${TASK_API}/reminders`,
  },

  CL_TASKS: {
    LIST: `${TASK_API}/cl-tasks/list`,
    MY: `${TASK_API}/cl-tasks/my`,
    VERIFICATION: `${TASK_API}/cl-tasks/verification`,
    CREATE: `${TASK_API}/cl-tasks/create`,
    UPDATE: `${TASK_API}/cl-tasks/update`,
    DELETE: `${TASK_API}/cl-tasks/delete`,
    APPROVE: `${TASK_API}/cl-tasks/approve`,
    SUBMIT: `${TASK_API}/cl-tasks/submit`,
    SUBMISSION_UPDATE: `${TASK_API}/cl-tasks/submission-update`,
    VERIFY: `${TASK_API}/cl-tasks/verify`,
    VERIFICATION_UPDATE: `${TASK_API}/cl-tasks/verification-update`,
    INSTANCE_DELETE: `${TASK_API}/cl-tasks/instance-delete`,
    INSTANCE: `${TASK_API}/cl-tasks/instance`,
  },

  RED_TICKETS: {
    LIST: `${TASK_API}/red-tickets/list`,
    GET: `${TASK_API}/red-tickets/get`,
    CREATE: `${TASK_API}/red-tickets/create`,
    UPDATE: `${TASK_API}/red-tickets/update`,
    DELETE: `${TASK_API}/red-tickets/delete`,
  },

  REPORTS: {
    DAILY: `${TASK_API}/reports/daily`,
    INSTANCE: `${TASK_API}/reports/instance`,
    REVIEW: `${TASK_API}/reports/review`,
  },
};
