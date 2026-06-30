import { api } from "@/core/api/apiClient";

const BASE_PATH = "/dashboard";

export const getTables = async () => {
  return await api(`${BASE_PATH}/tables`);
};

export const getColumns = async (table) => {
  return await api(`${BASE_PATH}/columns/${table}`);
};

export const listWidgets = async () => {
  return api(`${BASE_PATH}/widgets?t=${Date.now()}`);
};

export const createWidget = async (payload) => {
  return api(`${BASE_PATH}/widgets`, {
    method: "POST",
    body: payload,
  });
};

export const updateWidget = async (id, payload) => {
  return api(`${BASE_PATH}/widgets/${id}`, {
    method: "PUT",
    body: payload,
  });
};

export const deleteWidget = async (id) => {
  return api(`${BASE_PATH}/widgets/${id}`, {
    method: "DELETE",
  });
};

export const publishWidget = async (id) => {
  return api(`${BASE_PATH}/widgets/${id}/publish`, {
    method: "POST",
  });
};

export const previewWidget = async (query) => {
  return api(`${BASE_PATH}/widgets/preview`, {
    method: "POST",
    body: { query },
  });
};

export const getDashboardWidgets = async () => {
  return api(`${BASE_PATH}/dashboard/widgets?t=${Date.now()}`);
};
