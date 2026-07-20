const LOCALE_OPTS = { sensitivity: "base", numeric: true };

/** Case-insensitive ascending string compare (A→Z, 0→9). */
export function compareAscStrings(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, LOCALE_OPTS);
}

export function resolveRowSortLabel(row, labelKey, fallbackKeys = []) {
  if (row == null || typeof row !== "object") return "";
  if (labelKey && row[labelKey] != null && String(row[labelKey]).trim() !== "") {
    return row[labelKey];
  }
  for (const key of fallbackKeys) {
    if (row[key] != null && String(row[key]).trim() !== "") return row[key];
  }
  if (row.label != null) return row.label;
  if (row.name != null) return row.name;
  if (row.id != null) return row.id;
  if (row.value != null) return row.value;
  return "";
}

const DEFAULT_ROW_KEYS = [
  "item_code",
  "acc_name",
  "location_no",
  "packing_number",
  "name",
  "label",
  "itemdesc",
  "doc_no",
  "category_name",
  "subcategory_name",
  "transporter_name",
];

/** Sort dropdown rows A→Z (SearchableSelect, SelectField, filter selects — not data tables). */
export function sortSelectRowsAsc(rows, labelKey, extraKeys = []) {
  if (!Array.isArray(rows) || rows.length < 2) return Array.isArray(rows) ? [...rows] : [];
  const keys = [...new Set([labelKey, ...extraKeys, ...DEFAULT_ROW_KEYS].filter(Boolean))];
  return [...rows].sort((a, b) =>
    compareAscStrings(resolveRowSortLabel(a, labelKey, keys), resolveRowSortLabel(b, labelKey, keys))
  );
}

/**
 * Sort plain strings or `{ label, value }` filter options (keeps empty “All” first).
 */
export function sortFilterOptionsAsc(options) {
  if (!Array.isArray(options) || options.length < 2) return Array.isArray(options) ? [...options] : [];

  const isAllOption = (opt) => {
    if (opt == null || typeof opt !== "object") return false;
    const v = opt.value;
    if (v === "" || v == null) return true;
    if (String(v).trim().toLowerCase() === "all") return true;
    const label = String(opt.label ?? "").trim().toLowerCase();
    return label === "all" || label.startsWith("all ");
  };

  const first = options[0];
  if (first && typeof first === "object" && ("label" in first || "value" in first)) {
    return [...options].sort((a, b) => {
      const aAll = isAllOption(a);
      const bAll = isAllOption(b);
      if (aAll && !bAll) return -1;
      if (!aAll && bAll) return 1;
      return compareAscStrings(a?.label ?? a?.value, b?.label ?? b?.value);
    });
  }

  return [...options].sort(compareAscStrings);
}
