import { applyClientSearch, buildTableSearchParts } from "@/ui/common/list/clientListSearch";

/** Fallback fields when table headers are not available (e.g. sidebar list). */
export function taskListQuickSearchParts(row) {
  const t = row || {};
  return [
    t.title,
    t.description,
    t.task_id,
    t.category_name,
    t.assigned_to_name,
    t.assigned_by_name,
    t.created_by_name,
    t.status,
    t.priority,
    t.last_remark,
  ];
}

/** Client quick search on already-loaded task rows (title, description, ids, names, etc.). */
export function applyTaskListQuickSearch(rows, queryRaw, headers) {
  const list = Array.isArray(rows) ? rows : [];
  const getParts = headers?.length
    ? (row) => buildTableSearchParts(row, headers)
    : taskListQuickSearchParts;
  return applyClientSearch(list, queryRaw, { getParts, skipSort: true });
}
