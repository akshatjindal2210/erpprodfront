"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import { qcHoldMaterialService } from "@/apps/ims/lib/services/qcHoldMaterial";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { formatActivityLogActionLabel, formatActivityLogValue, getActivityLogActionBadgeClass, getActivityLogEventLabel, getActivityLogMoreSections, getActivityLogSections } from "@/platform/utils/core/activityLogDisplay";

function parseLogPayload(data) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return typeof data === "object" ? data : null;
}

function parseHoldDataRaw(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.hold_data != null) return parseHoldDataRaw(raw.hold_data);
  return raw;
}

/** Hide empty noise: 0, [], {}, "", null, false. */
function isEmptyActivityValue(value) {
  if (value == null || value === "") return true;
  if (value === false) return true;
  if (typeof value === "number" && value === 0) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t || t === "[]" || t === "{}") return true;
    if (/^-?\d+(\.\d+)?$/.test(t) && Number(t) === 0) return true;
  }
  return false;
}

function activityFieldEntries(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data).filter(([, v]) => !isEmptyActivityValue(v));
}

function humanFieldLabel(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\buid\b/gi, "UID")
    .replace(/\bid\b/gi, "ID")
    .replace(/\bqty\b/gi, "Qty");
}

function isDenseDumpString(value) {
  if (typeof value !== "string") return false;
  const t = value.trim();
  if (t.length < 40) return false;
  return (t.match(/:\s/g) || []).length >= 3 || /hold_data\s*:\s*\{\.\.\.\}/i.test(t);
}

function hasCollapsedHoldData(summary) {
  if (!summary || typeof summary !== "object") return false;
  return Object.values(summary).some(
    (v) => typeof v === "string" && (/hold_data\s*:\s*\{\.\.\.\}/i.test(v) || isDenseDumpString(v))
  );
}

function FieldChip({ label, children, wide = false }) {
  return (
    <div className={`bg-slate-50 border border-slate-100 px-1.5 py-1 min-w-0 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[7px] text-slate-400 uppercase font-black tracking-wide leading-none mb-0.5">
        {humanFieldLabel(label)}
      </div>
      <div className="text-[10px] text-slate-800 font-bold break-words leading-snug">{children}</div>
    </div>
  );
}

/** Readable nested details — no raw [], {}, or JSON dumps for end users. */
function ReadableFields({ data, nestLabel = null }) {
  const entries = activityFieldEntries(data);
  if (!entries.length) return null;

  return (
    <div className="space-y-1.5">
      {nestLabel ? (
        <div className="text-[8px] font-black uppercase tracking-widest text-indigo-500">{nestLabel}</div>
      ) : null}
      <div className="grid grid-cols-2 gap-1.5">
        {entries.map(([key, value]) => {
          if (Array.isArray(value)) {
            const scalars = value.every((item) => item == null || typeof item !== "object");
            if (scalars) {
              return (
                <FieldChip key={key} label={key} wide>
                  <ul className="list-none space-y-0.5 m-0 p-0">
                    {value.map((item, i) => (
                      <li key={`${key}-${i}`} className="font-mono text-[9px] break-all">
                        {String(item)}
                      </li>
                    ))}
                  </ul>
                </FieldChip>
              );
            }
            return (
              <div key={key} className="col-span-2 space-y-1.5">
                <div className="text-[7px] text-slate-400 uppercase font-black tracking-wide">
                  {humanFieldLabel(key)}
                </div>
                {value.map((item, i) => (
                  <div key={`${key}-${i}`} className="border border-slate-200 bg-white px-1.5 py-1.5">
                    <div className="text-[8px] font-black text-indigo-500 mb-1">
                      {humanFieldLabel(key)} #{i + 1}
                    </div>
                    {item && typeof item === "object" ? (
                      <ReadableFields data={item} />
                    ) : (
                      <div className="text-[10px] font-bold">{formatActivityLogValue(item)}</div>
                    )}
                  </div>
                ))}
              </div>
            );
          }

          if (value && typeof value === "object") {
            return (
              <div key={key} className="col-span-2">
                <ReadableFields data={value} nestLabel={humanFieldLabel(key)} />
              </div>
            );
          }

          return (
            <FieldChip key={key} label={key}>
              {formatActivityLogValue(value)}
            </FieldChip>
          );
        })}
      </div>
    </div>
  );
}

/** Legacy logs: hold_data was `{...}` — show proper readable fields from current hold. */
function HoldDataExpand({ holdData }) {
  const [open, setOpen] = useState(false);
  const hasFields = useMemo(() => activityFieldEntries(holdData).length > 0, [holdData]);

  if (!hasFields) return null;

  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
      >
        {open ? "Hide details" : "Show details"}
      </button>
      {open ? (
        <div className="mt-1.5">
          <ReadableFields data={holdData} />
        </div>
      ) : null}
    </div>
  );
}

function timelineDotClass(action) {
  const key = String(action || "").toUpperCase();
  if (key === "CREATE") return "bg-indigo-500 border-indigo-200";
  if (key === "SUBMIT") return "bg-amber-500 border-amber-200";
  if (key === "APPROVE") return "bg-emerald-500 border-emerald-200";
  if (key === "UPDATE" || key === "MODIFY") return "bg-blue-500 border-blue-200";
  if (key === "DELETE") return "bg-rose-500 border-rose-200";
  return "bg-slate-400 border-slate-200";
}

function primaryTitle(row) {
  const event = getActivityLogEventLabel(row?.log_data);
  if (event) return event;
  const desc = String(row?.description || "").trim();
  if (desc) return desc;
  return formatActivityLogActionLabel(row?.action_type);
}

export default function QcHoldActivityDrawer({ open, hold, onClose }) {
  const holdId = hold?.hold_id ?? hold?.id ?? null;
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const liveHoldData = useMemo(() => parseHoldDataRaw(hold?.hold_data), [hold?.hold_data]);

  const load = useCallback(async () => {
    if (!holdId) return;
    setLoading(true);
    try {
      const res = await qcHoldMaterialService.getActivityLog(holdId, { limit: 200 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setRows(list);
      setExpandedId(null);
    } catch (err) {
      toast.error(err?.message || "Could not load QC hold history.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [holdId]);

  useEffect(() => {
    if (!open || !holdId) return;
    load();
  }, [open, holdId, load]);

  const description = useMemo(() => {
    const bits = [];
    if (holdId != null) bits.push(`Hold #${holdId}`);
    if (hold?.packing_number) bits.push(`Packing ${hold.packing_number}`);
    if (hold?.item_code || hold?.item_dcode) bits.push(String(hold.item_code || hold.item_dcode));
    if (hold?.status) bits.push(String(hold.status).replace(/_/g, " "));
    return bits.join(" · ") || "Activity timeline for this QC hold";
  }, [hold, holdId]);

  return (
    <Drawer
      isOpen={!!open}
      onClose={onClose}
      title="Activity log"
      description={description}
      maxWidth="max-w-lg"
      closeOnOutside
      footer={
        <div className="text-[10px] text-slate-500 font-medium">
          {loading
            ? "Loading…"
            : rows.length
              ? `${rows.length} event${rows.length === 1 ? "" : "s"} · newest first`
              : "No events"}
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500 text-xs font-bold uppercase">
          <Loader2 size={14} className="animate-spin" /> Loading timeline
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center px-2">
          <p className="text-xs text-slate-500 font-semibold">No activity logged for this hold yet.</p>
          <p className="text-[10px] text-slate-400 mt-1">
            Create / submit / approve actions will show here as a timeline.
          </p>
        </div>
      ) : (
        <ol className="relative ml-2 border-l-2 border-slate-200 pl-5">
          {rows.map((row, idx) => {
            const isOpen = expandedId === row.id;
            const isLast = idx === rows.length - 1;
            const summarySections = getActivityLogSections(row.log_data);
            const moreSections = getActivityLogMoreSections(row.log_data);
            const summary = summarySections[0]?.data || null;
            const payload = parseLogPayload(row.log_data);
            const title = primaryTitle(row);
            const moreHasFields = moreSections.some((section) => activityFieldEntries(section.data).length > 0);
            const showMoreBtn = moreHasFields;
            const showHoldDataExpand = hasCollapsedHoldData(summary);
            const summaryFields = activityFieldEntries(summary).filter(
              ([, value]) => !(showHoldDataExpand && isDenseDumpString(value))
            );

            return (
              <li key={row.id || idx} className={`relative ${isLast ? "pb-1" : "pb-5"}`}>
                <span
                  className={`absolute -left-[1.55rem] top-1.5 h-3 w-3 rounded-full border-2 ${timelineDotClass(row.action_type)}`}
                  aria-hidden
                />

                <div className="bg-white border border-slate-200">
                  <div className="px-3 py-2.5 border-b border-slate-100 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 border text-[8px] font-black uppercase tracking-widest ${getActivityLogActionBadgeClass(row.action_type)}`}
                        >
                          {formatActivityLogActionLabel(row.action_type)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {row.created_at ? formatDateTime(row.created_at) : "—"}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-900 font-bold leading-snug">{title}</p>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                        By {row.user_name || "—"}
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono shrink-0">#{rows.length - idx}</span>
                  </div>

                  {summaryFields.length > 0 ? (
                    <div className="px-3 py-2">
                      <ReadableFields data={Object.fromEntries(summaryFields)} />
                    </div>
                  ) : !showHoldDataExpand && payload?.summary ? (
                    <div className="px-3 py-2 text-[10px] text-slate-600 font-medium">{String(payload.summary)}</div>
                  ) : null}

                  {showHoldDataExpand && liveHoldData ? <HoldDataExpand holdData={liveHoldData} /> : null}

                  {showMoreBtn ? (
                    <div className="px-3 pb-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : row.id)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
                      >
                        {isOpen ? "Hide more" : "More details"}
                      </button>
                      {isOpen && moreSections.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {moreSections.map((section) => {
                            const fields = activityFieldEntries(section.data);
                            if (!fields.length) return null;
                            return (
                              <div key={section.title}>
                                <div className="text-[8px] font-black uppercase tracking-widest text-indigo-500 mb-1">
                                  {section.title}
                                </div>
                                <ReadableFields data={Object.fromEntries(fields)} />
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Drawer>
  );
}
