export const CL_FORM_FIELD_TYPES = [
  { value: "short_text", label: "Short Text", group: "Basic" },
  { value: "text", label: "Long Text", group: "Basic" },
  { value: "numeric", label: "Number", group: "Basic" },
  { value: "email", label: "Email", group: "Basic" },
  { value: "phone", label: "Phone", group: "Basic" },
  { value: "date", label: "Date", group: "Basic" },
  { value: "time", label: "Time", group: "Basic" },
  { value: "checkbox", label: "Checkbox", group: "Choice" },
  { value: "radio", label: "Radio", group: "Choice" },
  { value: "dropdown", label: "Dropdown", group: "Choice" },
  { value: "multiselect", label: "Multi Select", group: "Choice" },
  { value: "query_dropdown", label: "Search Dropdown", group: "Choice" },
  { value: "attachment", label: "File Upload", group: "Media" },
  { value: "section", label: "Section Title", group: "Layout" },
];

export const FIELDS_WITH_OPTIONS = ["dropdown", "radio", "multiselect"];
export const INPUT_FIELD_TYPES = CL_FORM_FIELD_TYPES.map((t) => t.value).filter((t) => t !== "section");

export function getFieldTypeMeta(type) {
  return CL_FORM_FIELD_TYPES.find((t) => t.value === type) || { value: type, label: type, group: "Other" };
}

/** Default layout width in the 2-col form grid. */
export const FULL_WIDTH_FIELD_TYPES = [
  "text",
  "radio",
  "multiselect",
  "query_dropdown",
  "attachment",
  "section",
];

export function getDefaultFieldWidth(type) {
  return FULL_WIDTH_FIELD_TYPES.includes(type) ? "full" : "half";
}

export function getFieldGridClass(field) {
  const width = field?.width || getDefaultFieldWidth(field?.type);
  // Mobile: always 1 column. Desktop: half = 1 col, full = span 2.
  return width === "full" ? "col-span-1 sm:col-span-2" : "col-span-1";
}

export function newFormField(type = "short_text") {
  const field = {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: "",
    type,
    required: false,
    placeholder: "",
    help_text: "",
    options: [],
    queryOptions: "",
    min: null,
    max: null,
    width: getDefaultFieldWidth(type),
  };
  if (FIELDS_WITH_OPTIONS.includes(type)) {
    field.options = ["Option 1", "Option 2"];
  }
  return field;
}

export function parseOptionsText(text) {
  if (!text?.trim()) return [];
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function optionsToText(options) {
  return Array.isArray(options) ? options.join("\n") : "";
}

export function cleanFieldOptions(options = []) {
  return options.map((o) => String(o).trim()).filter(Boolean);
}

export function parseFormSchema(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseFormResponses(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function newFormEntry(responses = {}) {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    filled_at: new Date().toISOString(),
    responses,
  };
}

export function normalizeToEntries(raw) {
  const parsed = parseFormResponses(raw);
  if (Array.isArray(parsed.entries)) return parsed.entries;
  const keys = Object.keys(parsed);
  if (keys.length === 0) return [];
  if (keys.every((k) => k === "fills" || k === "entries")) return [];
  const { fills, entries, ...rest } = parsed;
  if (Object.keys(rest).length === 0) return [];
  return [{ id: "legacy", filled_at: null, responses: rest }];
}

/** Archived open-task fills on the same instance. */
export function getOpenFills(raw) {
  const parsed = parseFormResponses(raw);
  return Array.isArray(parsed.fills) ? parsed.fills : [];
}

function isEmptyValue(field, val) {
  if (field.type === "section") return true;
  if (field.type === "checkbox") return val !== true && val !== false;
  if (field.type === "multiselect") return !Array.isArray(val) || val.length === 0;
  if (field.type === "attachment") {
    if (Array.isArray(val)) {
      return !val.some((v) => v instanceof File || v?.file_path);
    }
    return !(val instanceof File) && !val?.file_path;
  }
  return val === undefined || val === null || val === "";
}

export function validateEntryValues(schema, values) {
  for (const field of schema) {
    if (field.type === "section") continue;
    const val = values[field.id];
    if (field.required && isEmptyValue(field, val)) {
      return `${field.label || field.id} is required`;
    }
    if (field.type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
      return `${field.label || "Email"} must be a valid email`;
    }
    if (field.type === "numeric" && val !== undefined && val !== null && val !== "") {
      const num = Number(val);
      if (Number.isNaN(num)) return `${field.label || "Number"} must be a number`;
      if (field.min != null && num < Number(field.min)) return `${field.label} must be at least ${field.min}`;
      if (field.max != null && num > Number(field.max)) return `${field.label} must be at most ${field.max}`;
    }
  }
  return null;
}

export function getFormFieldsSummary(raw) {
  const fields = parseFormSchema(raw).filter((f) => f.type !== "section");
  const required = fields.filter((f) => f.required);
  return {
    total: fields.length,
    requiredCount: required.length,
    requiredLabels: required.map((f) => f.label?.trim() || getFieldTypeMeta(f.type).label),
    optionalCount: fields.length - required.length,
  };
}

export function stripHtml(html) {
  if (!html) return "";
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function validateFormSchemaFields(fields) {
  for (const field of fields) {
    if (!field.label?.trim()) {
      return field.type === "section"
        ? "Section needs a title"
        : "All fields need a label";
    }
    if (FIELDS_WITH_OPTIONS.includes(field.type)) {
      const opts = cleanFieldOptions(field.options);
      if (!opts.length) return `${field.label || "Dropdown"} needs at least one value`;
    }
    if (field.type === "query_dropdown" && !field.queryOptions?.trim()) {
      return `${field.label || "Search dropdown"} needs suggestion values`;
    }
  }
  return null;
}
