/** Case-insensitive A→Z sort for task dropdown labels. */
export function compareLabelAsc(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

/** Sort `{ id, name }` options alphabetically by name (ascending). */
export function sortOptionsByNameAsc(options = []) {
  return [...options].sort((x, y) => compareLabelAsc(x?.name, y?.name));
}

/** Sort plain string option lists alphabetically (ascending). */
export function sortStringsAsc(items = []) {
  return [...items].sort(compareLabelAsc);
}
