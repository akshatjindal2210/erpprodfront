"use client";

import { useCallback, useMemo, useRef } from "react";
import { fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";

const ALL = { value: "", rawValue: "", label: "All Users" };

function toRow(row) {
  const code = String(row?.emp_code ?? "").trim();
  const name = String(row?.emp_name ?? "").trim();
  const dcode = row?.emp_dcode != null ? String(row.emp_dcode) : "";
  return { value: dcode, rawValue: dcode, label: code && name ? `${code} — ${name}` : code || name };
}

/**
 * User filter — Attendance + OT Approval.
 * variant: "quick" (instant client) | "server" (API + Search)
 */
export function useHrmsUserQuickFilter(pageModule, variant = "quick") {
  const cache = useRef(new Map());

  const fetchService = useCallback(async ({ search = "", page = 1, limit = 50 } = {}) => {
    const res = await fetchEmployeeViews({ pageModule, pageAction: "view", search, page, limit, sortBy: "emp_code", order: "ASC" });
    const rows = (res.data ?? []).map(toRow);
    rows.forEach((r) => r.value && cache.current.set(r.value, r));
    return { data: page === 1 && !search.trim() ? [ALL, ...rows] : rows, total: res.total ?? rows.length };
  }, [pageModule]);

  const getByIdService = useCallback(async (dcode) => {
    const key = String(dcode ?? "").trim();
    if (!key) return ALL;
    if (cache.current.has(key)) return cache.current.get(key);
    const item = await fetchEmployeeByDcode({ pageModule, pageAction: "view", emp_dcode: key });
    const row = item ? toRow(item) : null;
    if (row?.value) cache.current.set(row.value, row);
    return row;
  }, [pageModule]);

  return useMemo(() => ({
    label: "User", key: "emp_dcode", variant, searchable: true,
    fetchService, getByIdService, dataKey: "value", labelKey: "label", preserveOrder: true,
  }), [fetchService, getByIdService, variant]);
}
