import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/rmstore/lib/config/endpoints";
import { withSortedViewsData } from "@/apps/rmstore/lib/helpers/sortDropdownResponse";

export const storeLocationService = {
  getAll: (params) => api(ENDPOINTS.STORE_LOCATION.LIST, { method: "POST", body: params }),
  getById: (id) => api(ENDPOINTS.STORE_LOCATION.GET, { method: "POST", body: { id } }),
  create: (data) => api(ENDPOINTS.STORE_LOCATION.CREATE, { method: "POST", body: data }),
  update: (id, data) => api(ENDPOINTS.STORE_LOCATION.UPDATE, { method: "POST", body: { id, ...data } }),
  delete: (id) => api(ENDPOINTS.STORE_LOCATION.DELETE, { method: "POST", body: { id } }),
  getViews: (params) =>
    api(ENDPOINTS.STORE_LOCATION.VIEWS, { method: "POST", body: params }).then((res) =>
      withSortedViewsData(res, "location_no")
    ),
};
