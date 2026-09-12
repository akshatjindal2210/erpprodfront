import { api } from "@/platform/api/apiClient";
import { ENDPOINTS } from "@/apps/purchase/lib/config/endpoints";

function normalizeItemRow(row = {}) {
  return {
    itemdcode: row.itemdcode ?? row.ItemDcode ?? row.Itemdcode ?? null,
    item_code: row.item_code ?? row.Item_Code ?? null,
    itemdesc: row.itemdesc ?? row.ItemDesc ?? row.Itemdesc ?? null,
    grpname: row.grpname ?? row.Grpname ?? null,
    minqty: row.minqty ?? row.Minqty ?? 0,
    maxqty: row.maxqty ?? row.Maxqty ?? 0,
    reorderqty: row.reorderqty ?? row.Reorderqty ?? 0,
    primitem_code: row.primitem_code ?? row.Primitem_code ?? row.PrimItem_Code ?? null,
    primitemdesc: row.primitemdesc ?? row.primItemDesc ?? row.Primitemdesc ?? null,
    weight: row.weight ?? row.Weight ?? null,
    apvitem: row.apvitem ?? row.Apvitem ?? row.ITAPV ?? null,
  };
}

export const masterService = {
  getItems: async (params = {}) => {
    const res = await api(ENDPOINTS.MASTER.ITEMS.LIST, {
      method: "POST",
      body: {
        permission_module: "purchase_master",
        permission_action: "view",
        ...params,
      },
    });
    if (res?.success && Array.isArray(res.data)) {
      res.data = res.data.map((item) => {
        const norm = normalizeItemRow(item);
        return { ...norm, id: norm.itemdcode };
      });
    }
    return res;
  },

  getItemsViews: async (params = {}) => {
    const { permission_module = "purchase_shortage", permission_action = "view", ...rest } = params;
    const res = await api(ENDPOINTS.MASTER.ITEMS.VIEWS, {
      method: "POST",
      body: { permission_module, permission_action, ...rest },
    });
    if (res?.success && Array.isArray(res.data)) {
      res.data = res.data.map((item) => ({ ...item, id: item.itemdcode }));
    }
    return res;
  },

  getItemViewById: (id, perms = {}) =>
    api(ENDPOINTS.MASTER.ITEMS.VIEWS, {
      method: "POST",
      body: {
        id,
        permission_module: perms.permission_module ?? "purchase_shortage",
        permission_action: perms.permission_action ?? "view",
      },
    }),
};
