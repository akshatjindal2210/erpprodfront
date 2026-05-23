"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info, List } from "lucide-react";

const SKIP_KEYS = new Set(["updated_at", "updated_by", "approved_at", "approved_by", "success"]);

/** Show important keys first; rest alphabetical. */
const KEY_ORDER = [
  "count",
  "entry_type",
  "action",
  "qty",
  "per_box_qty",
  "packing_number",
  "packing_numbers",
  "adjustment_id",
  "in_uid",
  "out_uid",
  "location_id",
  "location_count",
  "box_uids",
  "box_no_uids",
  "filters",
];

function labelForKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeDetails(raw) {
  if (raw == null) return null;
  let d = raw?.details ?? raw;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return { _raw: d };
    }
  }
  if (Array.isArray(d)) return { _items: d };
  if (typeof d === "object") return d;
  return { _raw: String(d) };
}

function sortEntries(entries) {
  const rank = (key) => {
    const i = KEY_ORDER.indexOf(key);
    return i === -1 ? 1000 + key.localeCompare("") : i;
  };
  return [...entries].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

function ScalarValue({ value }) {
  if (value == null || value === "") return <span className="text-slate-400 italic">—</span>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  return <span className="break-words">{String(value)}</span>;
}

function ArrayValue({ fieldKey, value, expanded, onToggle }) {
  const list = Array.isArray(value) ? value : [];
  if (!list.length) return <span className="text-slate-400 italic">—</span>;

  const showAll = expanded[fieldKey];
  const visible = showAll ? list : list.slice(0, 6);
  const more = list.length - visible.length;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 tabular-nums">
          {list.length} item{list.length !== 1 ? "s" : ""}
        </span>
        {list.length > 6 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(fieldKey);
            }}
            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
          >
            {showAll ? "Show less" : `+${more} more`}
          </button>
        )}
      </div>
      <div
        className={`max-w-full border border-slate-200 bg-slate-50/80 p-1.5 font-mono text-[9px] text-slate-700 leading-relaxed ${
          showAll ? "max-h-40 overflow-y-auto" : ""
        }`}
      >
        {visible.map((item, i) => (
          <div key={`${fieldKey}-${i}`} className="truncate" title={String(item)}>
            {String(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ObjectValue({ value }) {
  const entries = Object.entries(value || {}).filter(([k]) => !SKIP_KEYS.has(k));
  if (!entries.length) return <span className="text-slate-400 italic">—</span>;
  return (
    <pre className="text-[9px] text-slate-600 bg-slate-50 border border-slate-200 p-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-all">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[minmax(5.5rem,34%)_1fr] gap-x-2 gap-y-0.5 py-1 border-b border-slate-100 last:border-0 min-w-0">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide leading-snug pt-0.5">
        {label}
      </span>
      <div className="text-[10px] text-slate-800 font-medium min-w-0">{children}</div>
    </div>
  );
}

export default function BoxTransactionDetailsCell({ value }) {
  const details = useMemo(() => normalizeDetails(value), [value]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [arrayExpanded, setArrayExpanded] = useState({});

  const toggleArray = (key) => {
    setArrayExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!details || (typeof details === "object" && Object.keys(details).length === 0)) {
    return (
      <div className="flex items-center gap-1 text-slate-400 italic text-[10px] py-1">
        <Info size={10} />
        <span>No extra details</span>
      </div>
    );
  }

  const entries = sortEntries(
    Object.entries(details).filter(([k]) => !SKIP_KEYS.has(k) && k !== "_raw" && k !== "_items")
  );

  const count = details.count;
  const summaryParts = [];
  if (count != null && count !== "") summaryParts.push(`${count} box${Number(count) !== 1 ? "es" : ""}`);
  if (details.entry_type) summaryParts.push(String(details.entry_type));
  if (details.action) summaryParts.push(String(details.action));
  const fieldCount = entries.length;

  if (details._raw != null) {
    return <span className="text-[10px] text-slate-600 break-words">{details._raw}</span>;
  }

  if (details._items) {
    return (
      <div className="flex flex-wrap gap-1 py-1">
        {details._items.map((f) => (
          <span
            key={String(f)}
            className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 border border-indigo-100 uppercase font-bold"
          >
            {String(f)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-[200px] max-w-[420px] py-0.5">
      {/* Compact summary — always visible */}
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        {summaryParts.map((part) => (
          <span
            key={part}
            className="text-[8px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 font-bold uppercase tracking-wide"
          >
            {part}
          </span>
        ))}
        {fieldCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPanelOpen((o) => !o);
            }}
            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-indigo-50/50 px-1.5 py-0.5"
          >
            <List size={10} />
            {panelOpen ? "Hide" : "View"} {fieldCount} field{fieldCount !== 1 ? "s" : ""}
            {panelOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>

      {/* Full structured panel */}
      {panelOpen && fieldCount > 0 && (
        <div className="border border-slate-200 bg-white shadow-sm max-h-52 overflow-y-auto">
          <div className="px-2 py-1 bg-slate-50 border-b border-slate-200 sticky top-0 z-[1]">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Details (JSON)</span>
          </div>
          <div className="px-2 py-1">
            {entries.map(([key, val]) => (
              <DetailRow key={key} label={labelForKey(key)}>
                {Array.isArray(val) ? (
                  <ArrayValue
                    fieldKey={key}
                    value={val}
                    expanded={arrayExpanded}
                    onToggle={toggleArray}
                  />
                ) : val !== null && typeof val === "object" ? (
                  <ObjectValue value={val} />
                ) : (
                  <ScalarValue value={val} />
                )}
              </DetailRow>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed: show top 2 scalar fields as preview */}
      {!panelOpen && fieldCount > 0 && (
        <div className="space-y-0.5 border-l-2 border-slate-200 pl-2">
          {entries
            .filter(([, val]) => !Array.isArray(val) && (val === null || typeof val !== "object"))
            .slice(0, 2)
            .map(([key, val]) => (
              <div key={key} className="text-[9px] text-slate-600 min-w-0">
                <span className="font-bold text-slate-400 uppercase">{labelForKey(key)}: </span>
                <span className="text-slate-700 break-words">{formatDetailValue(val)}</span>
              </div>
            ))}
          {entries.some(([, val]) => Array.isArray(val)) && (
            <div className="text-[9px] text-slate-500 italic">
              + lists (expand to view)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDetailValue(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return `${value.length} items`;
  return String(value);
}
