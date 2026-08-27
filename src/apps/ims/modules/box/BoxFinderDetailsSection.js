"use client";

import { useEffect, useState } from "react";
import { ChevronDown, History, Loader2 } from "lucide-react";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { boxJourneyKey, fetchBoxFinderData } from "@/apps/ims/lib/finder/boxFinderData";
import { getBoxKindStickerChipClass } from "@/apps/ims/lib/utils/boxTransactionVisuals";

function Panel({ title, sub, count, children }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History size={14} className="text-indigo-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-800">{title}</p>
            {sub ? <p className="text-[10px] text-slate-500">{sub}</p> : null}
          </div>
        </div>
        {count != null ? (
          <span className="text-[10px] font-bold text-slate-500 uppercase">{count}</span>
        ) : null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function StickersCollapse({ label, stickers, focusUid }) {
  const [open, setOpen] = useState(false);
  const focus = stickers.find((e) => String(e.box_no_uid ?? "").trim() === focusUid);

  return (
    <div className="col-span-2 text-[10px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 text-left text-slate-500 hover:text-slate-700"
      >
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
        <span>
          {label} ({stickers.length})
          {!open && focus ? (
            <span className="ml-1 font-semibold text-slate-800">· {focus.box_no_uid}</span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div className="mt-1 max-h-64 overflow-y-auto flex flex-wrap gap-x-1 gap-y-0.5 content-start border border-slate-100 px-1.5 py-1">
          {stickers.map((e) => (
            <span
              key={e.box_no_uid}
              className={`inline-flex max-w-full shrink-0 font-mono text-[9px] leading-tight whitespace-nowrap rounded px-2 py-1 ${getBoxKindStickerChipClass(e)}`}
              title={e.is_loose ? `${e.box_no_uid} (loose)` : e.box_no_uid}
            >
              {e.box_no_uid}
              {Number.isFinite(Number(e.qty)) ? ` · qty ${e.qty}` : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function JourneyTimeline({ events }) {
  if (!events.length) {
    return <p className="text-[11px] text-slate-400 italic">No journey events found.</p>;
  }

  return (
    <ol className="space-y-0 max-h-[400px] overflow-y-auto divide-y divide-slate-100">
      {events.map((ev, index) => {
        const lines = (ev.lines || []).filter(
          (l) => (l.stickers?.length) || (l.value && l.value !== "—")
        );
        return (
          <li key={ev.id} className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-col items-center shrink-0 w-6">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {index + 1}
              </span>
              {index < events.length - 1 ? <span className="w-px flex-1 bg-slate-200 mt-1" aria-hidden /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                <span className={`px-1.5 py-0.5 border text-[9px] font-bold uppercase leading-none ${ev.badgeClass}`}>
                  {ev.title}
                </span>
                <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                  {ev.at ? formatDateTime(ev.at) : "—"}
                </span>
              </div>
              {lines.length ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  {lines.map(({ label, value, stickers, focusUid }) =>
                    stickers?.length ? (
                      <StickersCollapse
                        key={label}
                        label={label}
                        stickers={stickers}
                        focusUid={focusUid}
                      />
                    ) : (
                      <div key={label} className="contents">
                        <dt className="text-[10px] text-slate-400 whitespace-nowrap">{label}</dt>
                        <dd className="text-[10px] text-slate-800 font-semibold break-all min-w-0">{value}</dd>
                      </div>
                    )
                  )}
                </dl>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** IMS Box Finder — details + journey (not Location Finder). */
export default function BoxFinderDetailsSection({ box }) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState([]);
  const [events, setEvents] = useState([]);

  const scanKey = box ? boxJourneyKey(box) : "";

  useEffect(() => {
    if (!box || !scanKey) {
      setDetails([]);
      setEvents([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchBoxFinderData(box)
      .then((data) => {
        if (!cancelled) {
          setDetails(data.details);
          setEvents(data.events);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetails([]);
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scanKey]);

  if (!box) return null;

  return (
    <div className="space-y-4 pt-4 mt-2 border-t-2 border-slate-200">
      <Panel title="Full record details" sub="Current box snapshot">
        {loading && !details.length ? (
          <Loader2 className="animate-spin text-indigo-500 mx-auto" size={22} />
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {details.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-[9px] font-bold text-slate-400 uppercase">{label}</dt>
                <dd className="text-[11px] font-semibold text-slate-800 break-all mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <Panel title="Journey" sub="Top to bottom · newest first" count={loading ? null : `${events.length} events`}>
        {loading && !events.length ? (
          <div className="py-6 text-center">
            <Loader2 className="animate-spin text-indigo-500 mx-auto mb-2" size={24} />
            <p className="text-[11px] text-slate-500">Loading journey…</p>
          </div>
        ) : (
          <JourneyTimeline events={events} />
        )}
      </Panel>
    </div>
  );
}
