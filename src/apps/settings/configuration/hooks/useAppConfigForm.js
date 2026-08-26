"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { appConfigService } from "@/apps/settings/lib/services/appConfigService";
import { applyListViewSpanFromSession } from "@/platform/utils/global";

function applySavedSideEffects(row, savedValue) {
  if (row.key === "default_list_view_span_days" && savedValue != null) {
    applyListViewSpanFromSession({ default_list_view_span_days: savedValue });
  }
  if (row.key === "inward_location_validation" && savedValue != null) {
    applyListViewSpanFromSession({
      inward_location_validation: String(savedValue).trim().toLowerCase() === "true",
    });
  }
  if (row.key === "location_capacity_validation" && savedValue != null) {
    applyListViewSpanFromSession({
      location_capacity_validation: String(savedValue).trim().toLowerCase() === "true",
    });
  }
}

export function useAppConfigForm(appId) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appConfigService.list(appId);
      if (!res?.success) throw new Error(res?.message || "Failed to load");
      setItems(res.data || []);
      const next = {};
      (res.data || []).forEach((row) => {
        next[row.key] = row.config_value ?? "";
      });
      setDraft(next);
      setSaved(next);
    } catch (err) {
      toast.error(err?.message || "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    load();
  }, [load]);

  const rowsBySection = useCallback(
    (section) =>
      Object.fromEntries(
        items.filter((r) => (r.section || "application") === section).map((r) => [r.key, r])
      ),
    [items]
  );

  const dirtyRows = useMemo(
    () => items.filter((row) => String(draft[row.key] ?? "") !== String(saved[row.key] ?? "")),
    [items, draft, saved]
  );

  const handleReset = () => setDraft({ ...saved });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dirtyRows.length) {
      toast.info("No changes to save");
      return;
    }
    setSaving(true);
    try {
      for (const row of dirtyRows) {
        const res = await appConfigService.update(row.key, draft[row.key]);
        if (!res?.success) throw new Error(res?.message || `Failed to save ${row.label}`);
        applySavedSideEffects(row, res.data?.config_value);
      }
      toast.success("Configuration saved successfully");
      await load();
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    saving,
    draft,
    setDraft,
    dirtyRows,
    rowsBySection,
    handleReset,
    handleSubmit,
  };
}
