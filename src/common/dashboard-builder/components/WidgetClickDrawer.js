"use client";

import React, { useEffect, useState } from "react";
import Drawer from "@/ui/primitives/Drawer";
import WidgetRenderer from "./WidgetRenderer";
import { hybridPreviewWidget, previewWidget } from "../services/dashboardApi";
import { buildHybridPreviewRequest, isWidgetHybridMode } from "../utils/dashboardDbSources";
import { normalizeDrawerWidget } from "../utils/drawerWidgetConfig";

function requiresDataQuery(rawType) {
  return rawType === "kpi" || rawType === "table" || rawType === "graph";
}

function isConfiguredWidgetQuery(query) {
  return Boolean(String(query || "").trim());
}

/**
 * Published-dashboard side panel that renders a nested drawer widget config.
 */
export default function WidgetClickDrawer({
  open = false,
  title = "Details",
  widgetConfig = null,
  filters = {},
  onClose,
}) {
  const [liveWidget, setLiveWidget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !widgetConfig) {
      setLiveWidget(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const base = normalizeDrawerWidget(widgetConfig, widgetConfig.id || "drawer");
    const filtersKey = JSON.stringify(filters || {});

    const run = async () => {
      setLoading(true);
      setError("");
      setLiveWidget({ ...base, previewData: [], previewError: null });

      if (!requiresDataQuery(base.rawType) || !isConfiguredWidgetQuery(base.query)) {
        if (!cancelled) {
          setLiveWidget({ ...base, previewData: [], previewError: null });
          setLoading(false);
        }
        return;
      }

      try {
        const runtimeFilters = filtersKey ? JSON.parse(filtersKey) : {};
        let response;
        if (isWidgetHybridMode(base)) {
          response = await hybridPreviewWidget(
            buildHybridPreviewRequest(base, {
              pgQuery: base.query || "",
              filters: runtimeFilters,
            }),
          );
        } else {
          response = await previewWidget(base.query, {
            dbSource: base.dataSource || "ims_postgresql",
            filters: runtimeFilters,
            chartConfig: base.chart_config || {},
          });
        }
        if (cancelled) return;
        setLiveWidget({
          ...base,
          previewData: response?.data || [],
          data: response?.data || [],
          previewError: null,
        });
      } catch (err) {
        if (cancelled) return;
        const message = String(err?.message || err?.payload?.message || "Failed to load drawer widget.").trim();
        setError(message || "Failed to load drawer widget.");
        setLiveWidget({
          ...base,
          previewData: [],
          data: [],
          previewError: message,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- filters compared via JSON key
  }, [open, widgetConfig, JSON.stringify(filters || {})]);

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={title || "Details"}
      maxWidth="max-w-4xl"
      closeOnOutside
      noPadding
      bodyScrollable={false}
    >
      <div className="flex h-full min-h-0 flex-col" data-no-widget-link>
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-6 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Loading…
          </div>
        ) : error && !liveWidget?.previewData?.length ? (
          <div className="m-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
            {error}
          </div>
        ) : liveWidget ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
            {/* Full-height only for drawer content — dashboard canvas widgets are unchanged. */}
            <div
              className={
                liveWidget.rawType === "table"
                  ? "min-h-0 flex-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white"
                  : "min-h-[280px] h-[min(70vh,640px)] w-full overflow-hidden rounded-md border border-slate-200 bg-white"
              }
            >
              <WidgetRenderer
                widget={liveWidget}
                readOnly
                nested={false}
                designParity
                pureSavedStyle
                suppressChrome
              />
            </div>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
