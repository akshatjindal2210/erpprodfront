import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
import { imsApiViews } from "@/apps/ims/lib/helpers/sortDropdownResponse";

export const locationService = {
  getAll:   (params)    =>   api(ENDPOINTS.LOCATIONS.LIST, { method: "POST", body: params }),
  getById:  (id)        =>   api(ENDPOINTS.LOCATIONS.GET, { method: "POST", body: { id } }),
  create:   (data)      =>   api(ENDPOINTS.LOCATIONS.CREATE, { method: "POST", body: data }),
  update:   (id, data)  =>   api(ENDPOINTS.LOCATIONS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete:   (id)        =>   api(ENDPOINTS.LOCATIONS.DELETE, { method: "POST", body: { id } }),
  getViews: (params) => imsApiViews(ENDPOINTS.LOCATIONS.VIEWS, params, "location_no"),
};

