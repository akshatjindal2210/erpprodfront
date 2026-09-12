export const ENDPOINTS = {
  MASTER: {
    ITEMS: {
      LIST: "/production/master/items/list",
      GET: "/production/master/items/get",
      VIEWS: "/production/master/items/helper",
    },
  },
  SHORTAGE: {
    LIST: "/production/shortage/list",
    MASTER_LIST: "/production/shortage/master-list",
    GET: "/production/shortage/get",
    CREATE: "/production/shortage/create",
    UPDATE: "/production/shortage/update",
    DELETE: "/production/shortage/delete",
    BULK: "/production/shortage/bulk",
    BULK_PREVIEW: "/production/shortage/bulk-preview",
  },
};
