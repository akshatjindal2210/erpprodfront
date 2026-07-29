import { api } from "@/platform/api/apiClient";
import { CORE_ENDPOINTS as ENDPOINTS } from "@/platform/api/endpoints";

export const activityLogService = {
  getLogs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.app_type) query.append("app_type", params.app_type);
    if (params.module) query.append("module", params.module);
    if (params.action_type) query.append("action_type", params.action_type);
    if (params.page) query.append("page", params.page);
    if (params.limit) query.append("limit", params.limit);
    if (params.all_users) query.append("all_users", params.all_users);
    if (params.search) query.append("search", params.search);
    if (params.date_from) query.append("date_from", params.date_from);
    if (params.date_to) query.append("date_to", params.date_to);
    if (params.entity) query.append("entity", params.entity);
    if (params.entity_id) query.append("entity_id", params.entity_id);
    if (params.skipCount) query.append("skipCount", params.skipCount);
    if (params.isExport) query.append("isExport", params.isExport);

    return api(`${ENDPOINTS.ACTIVITY_LOGS.LIST}?${query.toString()}`, { method: "GET" });
  },
};
