import { api } from "@/core/api/apiClient";
import { sortSelectRowsAsc } from "@/core/utils/sortSelectOptions";

/** Sort helper/view API rows A→Z — dropdowns only (not list/table `getAll`). */
export function withSortedViewsData(res, labelKey) {
  if (Array.isArray(res)) {
    return sortSelectRowsAsc(res, labelKey);
  }
  if (res && Array.isArray(res.data)) {
    return { ...res, data: sortSelectRowsAsc(res.data, labelKey) };
  }
  return res;
}

export function imsApiViews(endpoint, body, labelKey) {
  return api(endpoint, { method: "POST", body }).then((res) => withSortedViewsData(res, labelKey));
}
