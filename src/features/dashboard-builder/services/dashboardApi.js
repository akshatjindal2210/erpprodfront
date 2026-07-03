import { api } from "@/core/api/apiClient";

const BASE_PATH = "/dashboard";

export const getTables = async ({ appKey = "ims", dbSource = "ims_postgresql" } = {}) => {
  return await api(`${BASE_PATH}/tables?app=${encodeURIComponent(appKey)}&db_source=${encodeURIComponent(dbSource)}`);
};

export const getColumns = async (table) => {
  return await api(`${BASE_PATH}/columns/${table}`);
};

export const listWidgets = async (appKey = "ims", pageKey = "default", dashboardKey = "default") => {
  return api(`${BASE_PATH}/widgets/list`, {
    method: "POST",
    body: { app_key: appKey, page_key: pageKey, dashboard_key: dashboardKey },
  });
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

export const deleteWidget = async (id, { appKey = "ims", pageKey = "default", dashboardKey = "default" } = {}) => {
  return api(`${BASE_PATH}/widgets/${id}?app=${encodeURIComponent(appKey)}&page_key=${encodeURIComponent(pageKey)}&dashboard_key=${encodeURIComponent(dashboardKey)}`, {
    method: "DELETE",
  },
  );
};

export const publishWidget = async (id) => {
  return api(`${BASE_PATH}/widgets/${id}/publish`, {
    method: "POST",
  });
};

export const unpublishWidget = async (id) => {
  return api(`${BASE_PATH}/widgets/${id}/unpublish`, {
    method: "POST",
  });
};

export const previewWidget = async (query, { dbSource = "ims_postgresql", filters = {}, erpFilter = {} } = {}) => {
  return api(`${BASE_PATH}/widgets/preview`, {
    method: "POST",
    body: { query, db_source: dbSource, filters, erp_filter: erpFilter },
  });
};

export const getDashboardWidgets = async (appKey = "ims", pageKey = "default", filters = {}, dashboardKey = "default") => {
  return api(`${BASE_PATH}/dashboard/widgets`, {
    method: "POST",
    body: { app_key: appKey, page_key: pageKey, dashboard_key: dashboardKey, filters },
  });
};

export const getDashboardStatus = async (appKey = "ims", dashboardKey = "default") => {
  return api(`${BASE_PATH}/dashboard/status`, {
    method: "POST",
    body: { app_key: appKey, dashboard_key: dashboardKey },
  });
};

export const saveDashboardDraft = async ({ appKey = "ims", pageKey = "default", dashboardKey = "default", dashboardName = "Default", scope = "global", targetUserIds = [], dashboardJson = {} } = {}) => {
  return api(`${BASE_PATH}/configs/save-draft`, {
    method: "POST",
    body: {
      app_key: appKey,
      page_key: pageKey,
      dashboard_key: dashboardKey,
      dashboard_name: dashboardName,
      scope,
      target_user_ids: targetUserIds,
      dashboard_json: dashboardJson,
    },
  });
};

export const publishDashboardConfig = async ({ appKey = "ims", pageKey = "default", dashboardKey = "default", dashboardName = "Default", scope = "global", targetUserIds = [], dashboardJson = {}, pageModule = null } = {}) => {
  return api(`${BASE_PATH}/configs/publish`, {
    method: "POST",
    body: {
      app_key: appKey,
      page_key: pageKey,
      dashboard_key: dashboardKey,
      dashboard_name: dashboardName,
      scope,
      target_user_ids: targetUserIds,
      page_module: pageModule,
      dashboard_json: dashboardJson,
    },
  });
};

export const unpublishDashboardConfig = async ({ appKey = "ims", pageKey = "default", dashboardKey = "default" } = {}) => {
  return api(`${BASE_PATH}/configs/unpublish`, {
    method: "POST",
    body: {
      app_key: appKey,
      page_key: pageKey,
      dashboard_key: dashboardKey,
    },
  });
};

export const deleteDashboardConfig = async ({ appKey = "ims", pageKey = "default", dashboardKey = "default" } = {}) => {
  return api(`${BASE_PATH}/configs/delete`, {
    method: "POST",
    body: {
      app_key: appKey,
      page_key: pageKey,
      dashboard_key: dashboardKey,
    },
  });
};

export const cloneDashboardToUsers = async ({ appKey = "ims", pageKey = "default", sourceDashboardKey = "default", dashboardKey = "clone", dashboardName = "Clone", userIds = [], cloneForAll = false, dashboardJson = null } = {}) => {
  return api(`${BASE_PATH}/configs/clone-users`, {
    method: "POST",
    body: {
      app_key: appKey,
      page_key: pageKey,
      source_dashboard_key: sourceDashboardKey,
      dashboard_key: dashboardKey,
      dashboard_name: dashboardName,
      user_ids: userIds,
      clone_for_all: cloneForAll,
      ...(dashboardJson ? { dashboard_json: dashboardJson } : {}),
    },
  });
};

export const listDashboardConfigs = async ({ appKey = "ims", pageKey = "default" } = {}) => {
  return api(`${BASE_PATH}/configs/list`, {
    method: "POST",
    body: { app_key: appKey, page_key: pageKey },
  });
};
