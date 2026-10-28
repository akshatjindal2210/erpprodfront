"use client";

import { useEffect, useMemo, useState } from "react";
import { jobCardService } from "@/apps/production/lib/services/jobCard";

export function formatProductionDuration(seconds) {
  const s = Math.max(0, Math.floor(+seconds || 0));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }
  return `${s}s`;
}

/** Same seconds the UI prints as h/m for one machine line (drop leftover seconds). */
export function displayDurationSeconds(seconds) {
  return Math.floor(Math.max(0, Math.floor(+seconds || 0)) / 60) * 60;
}

/** Top badge time = sum of every Time Required line (single + multi M/C). */
export function sumShownTimeSeconds(estimate) {
  let total = 0;
  for (const st of estimate?.stages || []) {
    for (const m of st.machines || []) total += displayDurationSeconds(m.seconds);
  }
  return total;
}

/** Speed (cavity) / cycle time — Machine Master columns. */
export function speedText(m) {
  if (!m.maccycletime) return "—";
  const cavity = m.cavity != null && String(m.cavity).trim() !== "" ? String(m.cavity).trim() : "—";
  return `${cavity} / ${formatProductionDuration(m.maccycletime)}`;
}

export function useJobCardProductionEstimate({ itemDcode, qty, stages, picks, active = true }) {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const pickKey = useMemo(() => JSON.stringify(picks ?? {}), [picks]);

  useEffect(() => {
    if (!active || !itemDcode || !stages?.length) {
      setEstimate(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    // Keep last estimate on screen (no flash); spinner only when nothing to show yet.
    if (estimate == null) setLoading(true);
    const plan = stages.map((s) => ({ stage_no: s.stage_no, ...(picks?.[s.stage_no] || {}) }));
    const t = setTimeout(async () => {
      try {
        const res = await jobCardService.estimateProduction(itemDcode, qty, plan);
        if (!cancelled) setEstimate(res?.data ?? null);
      } catch {
        /* keep previous estimate */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [active, itemDcode, qty, stages, pickKey]); // eslint-disable-line react-hooks/exhaustive-deps -- keep prior estimate while refetching

  return { estimate, loading, planError: estimate?.valid === false ? estimate.plan_error : null };
}
