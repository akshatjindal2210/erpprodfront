import { api } from "@/platform/api/apiClient";
import { sortSelectRowsAsc, sortSelectRowsDesc } from "@/platform/utils/form/sortSelectOptions";

/** Sort helper/view API rows — dropdowns only (not list/table `getAll`). Default A→Z; pass `"desc"` for Z→A. */
export function withSortedViewsData(res, labelKey, order = "asc") {
  const sortFn = String(order).toLowerCase() === "desc" ? sortSelectRowsDesc : sortSelectRowsAsc;
  if (Array.isArray(res)) {
    return sortFn(res, labelKey);
  }
  if (res && Array.isArray(res.data)) {
    return { ...res, data: sortFn(res.data, labelKey) };
  }
  return res;
}

export function imsApiViews(endpoint, body, labelKey) {
  return api(endpoint, { method: "POST", body }).then((res) => withSortedViewsData(res, labelKey));
}
