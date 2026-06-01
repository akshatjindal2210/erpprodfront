import api from "@/features/apps/task/helpers/apiHelper";
import { ENDPOINTS } from "@/features/apps/task/config/endpoints";

const T = ENDPOINTS.TASKS;
const multipart = { headers: { "Content-Type": "multipart/form-data" } };

export const taskService = {
  getAll: (params) => api.get(T.LIST, { params }),
  getById: (id) => api.get(T.item(id)),

  create: (data) => api.post(T.LIST, data, multipart),
  createSelf: (data) => api.post(T.SELF, data, multipart),
  update: (id, data) => api.put(T.item(id), data, multipart),
  delete: (id) => api.delete(T.item(id)),
  toggleStatus: (id) => api.post(T.toggleStatus(id)),

  assignSubUsers: (id, data) => api.post(T.subUsers(id), data),
  forwardTask: (id, data) => api.post(T.forward(id), data),
  reassignTask: (id, data) => api.post(T.reassign(id), data),
  requestCompletion: (id, data) => api.post(T.requestCompletion(id), data),
  approveSubUser: (id, assignmentId, data) =>
    api.post(T.approveSub(id, assignmentId), data),
  rejectSubUser: (id, assignmentId, data) =>
    api.post(T.rejectSub(id, assignmentId), data),
  creatorDecision: (id, data) => api.post(T.creatorDecision(id), data),
  getActivity: (id, params = {}) => api.get(T.activity(id), { params }),

  getChat: (taskId, params) => api.get(T.chat(taskId), { params }),
  sendChatMessage: (taskId, formData) =>
    api.post(T.chat(taskId), formData, multipart),
  deleteChatMessage: (taskId, chatId) =>
    api.delete(T.chatMessage(taskId, chatId)),

  getSelfNote: (taskId) => api.get(T.selfNote(taskId)),
  upsertSelfNote: (taskId, formData) =>
    api.put(T.selfNote(taskId), formData, multipart),
  deleteSelfNote: (taskId) => api.delete(T.selfNote(taskId)),
};

