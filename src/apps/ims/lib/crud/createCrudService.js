/**
 * Standard IMS CRUD API service — mirrors backend createCrud routes.
 *
 * Usage:
 *   import { ENDPOINTS } from "@/apps/ims/lib/config/endpoints";
 *   export const shortageService = createCrudService(ENDPOINTS.SHORTAGE);
 */
import { api } from "@/platform/api/apiClient";

export function createCrudService(endpoints, { idKey = "id" } = {}) {
  const idBody = (id) => ({ [idKey]: id, id });

  const service = {
    getAll: (params) => api(endpoints.LIST, { method: "POST", body: params }),
    getById: (id) => api(endpoints.GET, { method: "POST", body: idBody(id) }),
    create: (data) => api(endpoints.CREATE, { method: "POST", body: data }),
    update: (id, data) => api(endpoints.UPDATE, { method: "POST", body: { ...idBody(id), ...data } }),
    delete: (id) => api(endpoints.DELETE, { method: "POST", body: idBody(id) }),
  };

  if (endpoints.BULK) {
    service.bulkCreate = (records) =>
      api(endpoints.BULK, { method: "POST", body: { records } });
  }

  return service;
}
