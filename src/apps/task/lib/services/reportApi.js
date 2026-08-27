import api from "@/apps/task/lib/helpers/apiHelper";
import { ENDPOINTS } from "@/apps/task/lib/config/endpoints";
import { FILTER_DATE_RANGE_MAX_DAYS } from "@/platform/utils/core/utilHelper";

const R = ENDPOINTS.REPORTS;

export const reportPanelService = {
  getDaily: (params) => api.post(R.DAILY, params || {}),
  getInstance: (instanceId, opts = {}) =>
    api.post(R.INSTANCE, {
      instance_id: instanceId,
      ...(opts.fill_id != null && opts.fill_id !== "" ? { fill_id: opts.fill_id } : {}),
    }),
  saveReview: (data) => api.post(R.REVIEW, data),
};

/** IST calendar YYYY-MM-DD */
export function istYmd(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function addDaysYmd(ymd, days) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Normalize any date-like value → YYYY-MM-DD */
export function toYmdClient(val) {
  if (val == null || val === "") return "";
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }
  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  /** DD/MM/YYYY or DD-MM-YYYY (filter display) */
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }
  return "";
}

/**
 * Default CL Report window from today.
 * Change DAYS_BACK to 10 (or any N) for a longer past range.
 * Keep in sync with backend reportDateRange.config.js REPORT_DEFAULT_DAYS_*.
 */
export const REPORT_DEFAULT_DAYS_BACK = 14;
export const REPORT_DEFAULT_DAYS_FORWARD = 2;

export function defaultReportDateRange(anchorYmd = istYmd()) {
  return {
    dateFrom: addDaysYmd(anchorYmd, -REPORT_DEFAULT_DAYS_BACK),
    dateTo: addDaysYmd(anchorYmd, REPORT_DEFAULT_DAYS_FORWARD),
  };
}

/** @deprecated Prefer defaultReportDateRange */
export function reportRangeForPreset(_preset = "week", anchorYmd = istYmd()) {
  return { ...defaultReportDateRange(anchorYmd), preset: "default" };
}

/**
 * Inclusive YYYY-MM-DD columns between from and to.
 * Prefer backend `date_columns` when available.
 * Day cap comes from FILTER_DATE_RANGE_MAX_DAYS (single config).
 */
export function buildDateColumns(dateFrom, dateTo, maxDays = FILTER_DATE_RANGE_MAX_DAYS) {
  const from = toYmdClient(dateFrom);
  const to = toYmdClient(dateTo);
  if (!from || !to || from > to) return [];
  const cap = Math.max(1, Number(maxDays) || FILTER_DATE_RANGE_MAX_DAYS);
  const out = [];
  let cur = from;
  while (cur <= to && out.length < cap) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

export function buildWeekBands(dateCols = []) {
  if (!dateCols.length) return [];
  const bands = [];
  let bandStart = 0;
  for (let i = 0; i < dateCols.length; i += 1) {
    const [y, m, d] = dateCols[i].split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
    if (i > 0 && dow === 1) {
      bands.push({
        startIdx: bandStart,
        endIdx: i - 1,
        startYmd: dateCols[bandStart],
        days: i - bandStart,
      });
      bandStart = i;
    }
  }
  bands.push({
    startIdx: bandStart,
    endIdx: dateCols.length - 1,
    startYmd: dateCols[bandStart],
    days: dateCols.length - bandStart,
  });
  return bands;
}

export function formatWeekLabel(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function weekdayShort(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/** Full weekday: Monday, Tuesday, … */
export function weekdayLong(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });
}

export function isWeekendYmd(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return dow === 0 || dow === 6;
}
