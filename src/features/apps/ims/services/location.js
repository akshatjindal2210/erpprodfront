import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";
import { imsApiViews } from "@/features/apps/ims/helpers/sortDropdownResponse";

export const locationService = {
  getAll:   (params)    =>   api(ENDPOINTS.LOCATIONS.LIST, { method: "POST", body: params }),
  getById:  (id)        =>   api(ENDPOINTS.LOCATIONS.GET, { method: "POST", body: { id } }),
  create:   (data)      =>   api(ENDPOINTS.LOCATIONS.CREATE, { method: "POST", body: data }),
  update:   (id, data)  =>   api(ENDPOINTS.LOCATIONS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete:   (id)        =>   api(ENDPOINTS.LOCATIONS.DELETE, { method: "POST", body: { id } }),
  getViews: (params) => imsApiViews(ENDPOINTS.LOCATIONS.VIEWS, params, "location_no"),
};

