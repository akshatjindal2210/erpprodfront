/** Nested widget shown inside a click-opened drawer (stored on the parent widget). */

const DRAWER_WIDGET_TYPES = new Set(["kpi", "table", "graph", "heading"]);

export function createDefaultDrawerWidget(parentId = "new") {
  const id = `drawer_${String(parentId || "new")}`;
  return {
    id,
    rawType: "table",
    type: "table",
    title: "",
    description: "",
    query: "",
    dataSource: "ims_postgresql",
    emptyText: "No data",
    tableSearchEnabled: false,
    tableSearchPlaceholder: "",
    tableSearchPosition: "right",
    tableSearchWidth: 180,
    tableColumnSortEnabled: false,
    tableExportEnabled: false,
    style: {
      bg: "#ffffff",
      color: "#475569",
      fontSize: 10,
      titleFontSize: 11,
      contentGap: 4,
      padding: 8,
      borderRadius: 6,
    },
    chart_config: {
      data_source: "ims_postgresql",
      emptyText: "No data",
    },
    previewData: null,
    previewError: null,
    linkType: "NONE",
    linkUrl: "",
    linkAppId: "",
    linkPageId: "",
  };
}

export function normalizeDrawerWidget(raw, parentId = "new") {
  const base = createDefaultDrawerWidget(parentId);
  if (!raw || typeof raw !== "object") return base;

  const rawType = DRAWER_WIDGET_TYPES.has(String(raw.rawType || "").toLowerCase())
    ? String(raw.rawType).toLowerCase()
    : "table";
  const chartConfig = raw.chart_config && typeof raw.chart_config === "object" ? raw.chart_config : {};
  const type =
    rawType === "graph"
      ? (["bar", "line", "pie", "area"].includes(String(raw.type || "").toLowerCase())
        ? String(raw.type).toLowerCase()
        : (chartConfig.chart_type || "bar"))
      : rawType;

  return {
    ...base,
    ...raw,
    id: String(raw.id || base.id),
    rawType,
    type,
    title: String(raw.title || "").trim(),
    description: String(raw.description || "").trim(),
    query: String(raw.query || ""),
    dataSource: String(raw.dataSource || chartConfig.data_source || "ims_postgresql"),
    emptyText: String(raw.emptyText || chartConfig.emptyText || "No data"),
    tableSearchEnabled: raw.tableSearchEnabled === true || chartConfig.table_search_enabled === true,
    tableSearchPlaceholder: String(raw.tableSearchPlaceholder || chartConfig.table_search_placeholder || "").trim(),
    tableSearchPosition: raw.tableSearchPosition || chartConfig.table_search_position || "right",
    tableSearchWidth: raw.tableSearchWidth ?? chartConfig.table_search_width ?? 180,
    tableColumnSortEnabled: raw.tableColumnSortEnabled === true || chartConfig.table_column_sort_enabled === true,
    tableExportEnabled: raw.tableExportEnabled === true || chartConfig.table_export_enabled === true,
    style: {
      ...base.style,
      ...(raw.style && typeof raw.style === "object" ? raw.style : {}),
    },
    chart_config: {
      ...base.chart_config,
      ...chartConfig,
      data_source: String(raw.dataSource || chartConfig.data_source || "ims_postgresql"),
    },
    linkType: "NONE",
    linkUrl: "",
    linkAppId: "",
    linkPageId: "",
  };
}

/** Compact payload persisted inside parent chart_config.drawer_widget */
export function serializeDrawerWidget(raw, parentId = "new") {
  const widget = normalizeDrawerWidget(raw, parentId);
  return {
    id: `drawer_${String(parentId || "new")}`,
    rawType: widget.rawType,
    type: widget.type,
    title: widget.title,
    description: widget.description,
    query: widget.query,
    dataSource: widget.dataSource,
    emptyText: widget.emptyText,
    tableSearchEnabled: widget.tableSearchEnabled === true,
    tableSearchPlaceholder: widget.tableSearchPlaceholder || "",
    tableSearchPosition: widget.tableSearchPosition || "right",
    tableSearchWidth: widget.tableSearchWidth ?? 180,
    tableColumnSortEnabled: widget.tableColumnSortEnabled === true,
    tableExportEnabled: widget.tableExportEnabled === true,
    style: widget.style && typeof widget.style === "object" ? widget.style : {},
    chart_config: {
      ...(widget.chart_config && typeof widget.chart_config === "object" ? widget.chart_config : {}),
      data_source: widget.dataSource || "ims_postgresql",
      emptyText: widget.emptyText || "No data",
      table_search_enabled: widget.tableSearchEnabled === true,
      table_search_placeholder: widget.tableSearchPlaceholder || "",
      table_search_position: widget.tableSearchPosition || "right",
      table_search_width: widget.tableSearchWidth ?? 180,
      table_column_sort_enabled: widget.tableColumnSortEnabled === true,
      table_export_enabled: widget.tableExportEnabled === true,
      ...(widget.rawType === "graph" ? { chart_type: widget.type || "bar" } : {}),
    },
  };
}

export function getDrawerTitle(widget = {}) {
  const explicit = String(widget?.drawerTitle || widget?.drawer_title || "").trim();
  if (explicit) return explicit;
  const nested = widget?.drawerWidget || widget?.chart_config?.drawer_widget;
  const nestedTitle = String(nested?.title || "").trim();
  if (nestedTitle) return nestedTitle;
  const parentTitle = String(widget?.title || "").trim();
  return parentTitle || "Details";
}
