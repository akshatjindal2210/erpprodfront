"use client";

import React, { useEffect, useState } from "react";
import Drawer from "@/ui/primitives/Drawer";
import WidgetRenderer from "./WidgetRenderer";
import { getDashboardWidgets } from "../services/dashboardApi";
import { normalizeDrawerWidget } from "../utils/drawerWidgetConfig";

function requiresDataQuery(rawType) {
  return rawType === "kpi" || rawType === "table" || rawType === "graph";
}

export default function WidgetClickDrawer({ open = false, drawer = null, onClose }) {
  const [liveWidget, setLiveWidget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPhoneMode, setIsPhoneMode] = useState(false);
  const title = drawer?.title || "Details";
  const widgetConfig = drawer?.widget || null;
  const parentWidgetId = drawer?.parentWidgetId || null;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsPhoneMode(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (!open || !widgetConfig || !parentWidgetId) {
      setLiveWidget(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const base = normalizeDrawerWidget(widgetConfig, widgetConfig.id || "drawer");

    (async () => {
      setLoading(true);
      setError("");
      setLiveWidget({ ...base, previewData: [], previewError: null });
      if (!requiresDataQuery(base.rawType)) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const response = await getDashboardWidgets(
          drawer.appKey || "ims",
          drawer.pageKey || "dashboard",
          drawer.filters || {},
          drawer.dashboardKey || "default",
          parentWidgetId,
        );
        if (cancelled) return;
        const rows = response?.data || [];
        setLiveWidget({ ...base, previewData: rows, data: rows, previewError: null });
      } catch (err) {
        if (cancelled) return;
        const message = String(err?.message || err?.payload?.message || "Failed to load drawer widget.").trim();
        setError(message);
        setLiveWidget({ ...base, previewData: [], data: [], previewError: message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, widgetConfig, parentWidgetId, drawer?.appKey, drawer?.pageKey, drawer?.dashboardKey, JSON.stringify(drawer?.filters || {})]);

  const isTable = liveWidget?.rawType === "table";

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={title}
      maxWidth={isPhoneMode ? "max-w-full" : "max-w-[min(90vw,110rem)]"}
      closeOnOutside
      noPadding
      bodyScrollable={false}
    >
      <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col" data-no-widget-link>
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-6 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Loading…
          </div>
        ) : error && !liveWidget?.previewData?.length ? (
          <div className="m-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
            {error}
          </div>
        ) : liveWidget ? (
          <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden p-2 sm:p-4">
            <div
              className={
                isTable
                  ? "min-h-0 min-w-0 max-w-full flex-1 overflow-hidden rounded-md border border-slate-200 bg-white"
                  : "min-h-[280px] h-[min(70vh,640px)] w-full min-w-0 max-w-full overflow-hidden rounded-md border border-slate-200 bg-white"
              }
            >
              <WidgetRenderer
                widget={liveWidget}
                readOnly
                nested={false}
                designParity
                pureSavedStyle
                suppressChrome
                isPhoneMode={isPhoneMode}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
