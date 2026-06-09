import { api } from "@/core/api/apiClient";
import { ENDPOINTS } from "@/features/apps/ims/config/endpoints";
import { applyClientSearch, fetchAllListPages } from "@/features/apps/ims/helpers/clientListSearch";
import { compareAscStrings, resolveRowSortLabel, sortSelectRowsAsc } from "@/core/utils/sortSelectOptions";
import { withSortedViewsData } from "@/features/apps/ims/helpers/sortDropdownResponse";

/**
 * Master IMS data: use `getItems` / `getLedgers` / … → `MASTER.*.LIST` (full list for pages).
 * Use `getItemsViews` / `getLedgersViews` / … → `MASTER.*.VIEWS` (`/helper`, compact for dropdowns).
 */
// Internal cache to avoid redundant API calls and enable instant frontend search for dropdowns
const cache = {
  items: null,
  /** Items with `in_hand_inventory` filter (forwarding note, etc.) — one API warm per session. */
  itemsInHand: null,
  ledgers: null,
  partyRates: null,
  dailyProd: null
};

function wantsInHandInventoryFilter(params = {}) {
  const f = params?.filters ?? params;
  return (
    f?.in_hand_inventory === true ||
    String(f?.in_hand_inventory || "").toLowerCase() === "true"
  );
}

let itemsInHandInflight = null;

/** Full in-warehouse stock list (all pages) — used by forwarding note breakdown. */
async function warmItemsInHandCache(permission_module, permission_action) {
  if (cache.itemsInHand) return cache.itemsInHand;
  if (itemsInHandInflight) return itemsInHandInflight;

  itemsInHandInflight = (async () => {
    const { data } = await fetchAllListPages(
      async (page, limit) => {
        const res = await api(ENDPOINTS.MASTER.ITEMS.VIEWS, {
          method: "POST",
          body: {
            permission_module,
            permission_action,
            filters: { in_hand_inventory: true },
            page,
            limit,
          },
        });
        const rows = Array.isArray(res?.data) ? res.data : [];
        return {
          data: rows.map((item) => ({ ...item, id: item.itemdcode ?? item.id })),
          total: res?.total ?? rows.length,
        };
      },
      1000,
      50000
    );
    cache.itemsInHand = data;
    return data;
  })();

  try {
    return await itemsInHandInflight;
  } finally {
    itemsInHandInflight = null;
  }
}

/** FY + packing IMS `pack` — same key = one network round-trip per session. */
const packByFyDocCache = new Map();
const packByFyInflight = new Map();

function packByFyCacheKey(params) {
  const fy = String(params?.financial_year ?? "").trim();
  const doc = String(params?.doc_no ?? params?.packing_number ?? "").trim();
  return fy && doc ? `${fy}::${doc}` : "";
}

/**
 * Helper to perform local search/pagination on cached data
 */
const getFilteredFromCache = (data, params = {}) => {
  const { search = "", page = 1, limit = 50 } = params;

  let filtered = [...data];
  if (search) {
    filtered = applyClientSearch(filtered, search, {
      tieBreaker: (a, b) =>
        compareAscStrings(resolveRowSortLabel(a), resolveRowSortLabel(b)),
    });
  } else {
    filtered = sortSelectRowsAsc(filtered);
  }

  const start = (page - 1) * limit;
  return {
    success: true,
    data: filtered.slice(start, start + limit),
    total: filtered.length,
    fromCache: true
  };
};

export const masterService = {
  // Clear cache manually if needed
  clearCache: (key) => {
    if (key) cache[key] = null;
    else {
      cache.items = null;
      cache.itemsInHand = null;
      cache.ledgers = null;
      cache.partyRates = null;
      cache.dailyProd = null;
      packByFyDocCache.clear();
      packByFyInflight.clear();
    }
  },

  // Items — `MASTER.ITEMS.LIST` requires Product Master view (see `accessControl` on route).
  getItems: async (params = {}) => {
    const body = {
      permission_module: "product_master",
      permission_action: "view",
      ...params,
    };
    const res = await api(ENDPOINTS.MASTER.ITEMS.LIST, { method: "POST", body });
    if (res?.success && Array.isArray(res.data)) {
      const mapped = res.data.map((item) => ({ ...item, id: item.itemdcode }));
      cache.items = mapped;
      res.data = mapped;
    }
    return res;
  },
  getItemById: (id, perms = {}) =>
    api(ENDPOINTS.MASTER.ITEMS.GET, {
      method: "POST",
      body: {
        id,
        permission_module: perms.permission_module ?? "product_master",
        permission_action: perms.permission_action ?? "view",
      },
    }),

  // Ledger — `MASTER.LEDGERS.LIST` requires Customer Master view.
  getLedgers: async (params = {}) => {
    const body = {
      permission_module: "customer_master",
      permission_action: "view",
      ...params,
    };
    const res = await api(ENDPOINTS.MASTER.LEDGERS.LIST, { method: "POST", body });
    if (res?.success) {
      if (!Array.isArray(res.data) && Array.isArray(res.records)) {
        res.data = res.records.map((r) => ({
          acc_code: r.Acc_Code ?? r.acc_code,
          acc_name: r.Acc_Name ?? r.acc_name,
          city: r.City ?? r.city,
          group_code: r.GrpCode ?? r.group_code,
        }));
      }
      if (Array.isArray(res.data)) {
        const mapped = res.data.map((l) => ({ ...l, id: l.acc_code }));
        cache.ledgers = mapped;
        res.data = mapped;
      }
    }
    return res;
  },
  getLedgerById: (id, perms = {}) =>
    api(ENDPOINTS.MASTER.LEDGERS.GET, {
      method: "POST",
      body: {
        id,
        permission_module: perms.permission_module ?? "customer_master",
        permission_action: perms.permission_action ?? "view",
      },
    }),

  // Helper Views (Optimized with Cache for Dropdowns)
  getItemsViews: async (params = {}) => {
    const {
      permission_module = "product_master",
      permission_action = "view",
      ...rest
    } = params;
    const inHandOnly = wantsInHandInventoryFilter(rest);
    const mustUseServerFilter =
      rest?.filters?.sticker_generated === true ||
      String(rest?.filters?.sticker_generated || "").toLowerCase() === "true" ||
      inHandOnly;

    if (!mustUseServerFilter && cache.items) {
      return getFilteredFromCache(cache.items, rest);
    }

    if (inHandOnly) {
      await warmItemsInHandCache(permission_module, permission_action);
      return getFilteredFromCache(cache.itemsInHand, rest);
    }

    const warmBody = {
      permission_module,
      permission_action,
      ...(mustUseServerFilter && rest.filters ? { filters: rest.filters } : {}),
    };
    const res = await api(ENDPOINTS.MASTER.ITEMS.VIEWS, {
      method: "POST",
      body: mustUseServerFilter ? { permission_module, permission_action, ...rest } : warmBody,
    });
    if (res?.success && Array.isArray(res.data)) {
      const mapped = res.data.map((item) => ({ ...item, id: item.itemdcode }));
      if (!mustUseServerFilter) {
        cache.items = mapped;
        return getFilteredFromCache(cache.items, rest);
      }
      return withSortedViewsData({ ...res, data: mapped }, "item_code");
    }
    return res;
  },

  /** Items that have in-hand warehouse stock (forwarding note breakdown). */
  getInHandItemsViews: async (perms = {}) => {
    const permission_module = perms.permission_module ?? "forwarding_note_master";
    const permission_action = perms.permission_action ?? "view";
    const data = await warmItemsInHandCache(permission_module, permission_action);
    return { success: true, data: data ?? [], total: data?.length ?? 0 };
  },

  getItemViewById: (id, perms = {}) => api(ENDPOINTS.MASTER.ITEMS.VIEWS, { method: "POST", body: { id, ...perms } }),

  /** Dropdowns / SearchableSelect — `/master/ledgers/helper` (field subset + resolveLedgerViewsSelectFields). Not `/ledgers/list`. */
  getLedgersViews: async (params = {}) => {
    const {
      permission_module = "customer_master",
      permission_action = "view",
      itemdcode,
      item_dcode,
      ...rest
    } = params;

    const itemFilter = itemdcode ?? item_dcode;
    const skipLedgerCache =
      (permission_module === "packing_entry" || permission_module === "stock_adjustment") &&
      itemFilter != null &&
      String(itemFilter).trim() !== "";

    if (!skipLedgerCache && !cache.ledgers) {
      try {
        const { data } = await fetchAllListPages(
          async (page, limit) => {
            const res = await api(ENDPOINTS.MASTER.LEDGERS.VIEWS, {
              method: "POST",
              body: {
                permission_module,
                permission_action,
                page,
                limit,
              },
            });
            if (!res?.success) {
              return { data: [], total: 0 };
            }
            const list = Array.isArray(res.data) ? res.data : [];
            return {
              data: list.map((l) => ({ ...l, id: l.id ?? l.acc_code })),
              total: Number(res.total ?? list.length),
            };
          },
          1000,
          50000
        );
        cache.ledgers = sortSelectRowsAsc(data, "acc_name");
      } catch {
        cache.ledgers = null;
      }
    }

    if (!skipLedgerCache && cache.ledgers) {
      return getFilteredFromCache(cache.ledgers, rest);
    }

    const res = await api(ENDPOINTS.MASTER.LEDGERS.VIEWS, {
      method: "POST",
      body: {
        permission_module,
        permission_action,
        ...(itemFilter != null && String(itemFilter).trim() !== "" ? { itemdcode: itemFilter } : {}),
        ...rest,
        page: rest.page ?? 1,
        limit: 1000,
      },
    });
    if (res?.success && Array.isArray(res.data)) {
      const mapped = res.data.map((l) => ({ ...l, id: l.id ?? l.acc_code }));
      return withSortedViewsData(
        { ...res, data: mapped, total: Number(res.total ?? mapped.length) },
        "acc_name"
      );
    }
    return res;
  },

  getLedgerViewById: (id, perms = {}) => api(ENDPOINTS.MASTER.LEDGERS.VIEWS, { method: "POST", body: { id, ...perms } }),

  /** `/master/party-rates/helper` — compact rows for pickers; not full `party-rates/list`. */
  getPartyRatesViews: async (params = {}) => {
    const body = {
      permission_module: "customer_item_code",
      permission_action: "view",
      ...params,
    };
    if (cache.partyRates) {
      return getFilteredFromCache(cache.partyRates, params);
    }
    const res = await api(ENDPOINTS.MASTER.PARTY_RATES.VIEWS, { method: "POST", body });
    if (res?.success && Array.isArray(res.data)) {
      cache.partyRates = sortSelectRowsAsc(
        res.data.map((pr) => ({
          ...pr,
          id: pr.id ?? `${pr.acc_code}_${pr.itemdcode}`,
        })),
        "item_code"
      );
      return getFilteredFromCache(cache.partyRates, params);
    }
    return res;
  },

  /** `/master/daily-prod/helper` — compact rows for pickers; not full `daily-prod/list`. */
  getDailyProdViews: async (params = {}) => {
    const body = {
      permission_module: "packing_entry",
      permission_action: "view",
      ...params,
    };
    if (cache.dailyProd) {
      return getFilteredFromCache(cache.dailyProd, params);
    }
    const res = await api(ENDPOINTS.MASTER.DAILY_PROD.VIEWS, { method: "POST", body });
    if (res?.success && Array.isArray(res.data)) {
      cache.dailyProd = sortSelectRowsAsc(
        res.data.map((dp) => ({ ...dp, id: dp.doc_no ?? dp.id })),
        "doc_no"
      );
      return getFilteredFromCache(cache.dailyProd, params);
    }
    return res;
  },

  // Party Rate
  /** Sticker cust. code (narr1) for one acc_code + itemdcode — server checks packing_entry view/add/edit. */
  resolvePartyRateCustCode: (body = {}) =>
    api(ENDPOINTS.MASTER.PARTY_RATES.RESOLVE_CUST_CODE, {
      method: "POST",
      body,
    }),

  getPartyRates: async (params) => {
    const res = await api(ENDPOINTS.MASTER.PARTY_RATES.LIST, { method: "POST", body: params });
    if (res?.success && Array.isArray(res.data)) {
      const mapped = res.data.map((pr) => ({ ...pr, id: `${pr.acc_code}_${pr.itemdcode}` }));
      cache.partyRates = mapped;
      res.data = mapped;
    }
    return res;
  },

  // Daily Prod
  getDailyProd: async (params) => {
    const res = await api(ENDPOINTS.MASTER.DAILY_PROD.LIST, { method: "POST", body: params });
    if (res?.success && Array.isArray(res.data)) {
      const mapped = res.data.map((dp) => ({ ...dp, id: dp.doc_no }));
      cache.dailyProd = mapped;
      res.data = mapped;
    }
    return res;
  },

  /** IMS `pack` for Indian FY + doc no — cached by `financial_year` + `doc_no`/`packing_number`. */
  getPackByFinancialYearDoc: async (params = {}) => {
    const key = packByFyCacheKey(params);
    if (!key) {
      return api(ENDPOINTS.MASTER.DAILY_PROD.PACK_BY_FY, { method: "POST", body: params });
    }
    if (packByFyDocCache.has(key)) {
      const hit = packByFyDocCache.get(key);
      return Promise.resolve(
        hit && typeof hit === "object"
          ? { ...hit, records: Array.isArray(hit.records) ? [...hit.records] : [] }
          : hit
      );
    }
    if (packByFyInflight.has(key)) {
      return packByFyInflight.get(key);
    }
    const promise = api(ENDPOINTS.MASTER.DAILY_PROD.PACK_BY_FY, { method: "POST", body: params })
      .then((res) => {
        if (res && typeof res === "object" && res.success) packByFyDocCache.set(key, res);
        packByFyInflight.delete(key);
        return res;
      })
      .catch((e) => {
        packByFyInflight.delete(key);
        throw e;
      });
    packByFyInflight.set(key, promise);
    return promise;
  },
};

