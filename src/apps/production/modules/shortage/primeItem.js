"use client";

/**
 * Prime Item — shared by Shortage → Prime Item tab and Maintain Job Card → Pending Shortage.
 * Rows come from the API already grouped: one row per prime item, entries in `children`, `status` on each row.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "react-toastify";
import DataTable from "@/ui/primitives/DataTable";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { auditPair } from "@/platform/utils/list/auditListUi";
import { formatShortageMonthDate, typeBadgeClass, weightKgTitle } from "@/apps/production/modules/shortage/shortageColumns";
import { shortageService } from "@/apps/production/lib/services/shortage";
import { FormLabel, FORM_LABEL_CLASS } from "@/ui/common/Constants";
import { JOB_CARD_PRIME_DETAIL_GRID } from "@/apps/production/modules/jc/jobCardUi.config";
import { IMS_TABLE_CELL_NUMBER, IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";

const PAGE_CHUNK = 100; // IMS style: show 100 rows, load 100 more on scroll

export const PRIME_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

/** Tooling → Register filter (Pending tab is its own surface). */
export const TOOLING_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const BADGE = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-600 border-amber-100" },
  accepted: { label: "Accepted", cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  rejected: { label: "Rejected", cls: "bg-rose-50 text-rose-600 border-rose-100" },
};
/** Tooling queue — not shortage Accept/Reject labels. */
export const TOOLING_BADGE = {
  pending: BADGE.pending,
  yes: { label: "Yes", cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  no: { label: "No", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};
const toolingText = (v) => TOOLING_BADGE[v]?.label || "—";

/** Same labels as Production → Tooling (pending / yes / no) for process-plan table. */
export function jobCardPlanToolingKey({ tooling_approved, tooling } = {}) {
  if (tooling_approved === true) return "yes";
  if (tooling_approved === false) return "no";
  const t = String(tooling ?? "").toLowerCase();
  if (t === "yes") return "yes";
  if (t === "no") return "no";
  return "pending";
}

/* ───────────── columns ───────────── */

/** kg with 2 decimals; "*" = partial total (some item has no weight in item master). */
function weightText(kg, missing = false) {
  const n = Number(kg);
  if (!Number.isFinite(n) || (n === 0 && missing)) return "—";
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${missing ? "*" : ""}`;
}

/** Plain text cell with tooltip, e.g. text("text-slate-500 italic"). */
function text(cls) {
  return function TextCell(v) {
    return <span className={`text-[10px] truncate block ${cls}`} title={v || ""}>{v || "—"}</span>;
  };
}
const num = (v) => <span className="font-black text-slate-800 text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>;
const remarkCol = ["Accept Remark", "accepted_remark", text("text-slate-600"), { width: "200px" }];
const toolingRemarkCol = ["Tooling Remark", "tooling_remark", text("text-slate-600"), { width: "200px" }];

/** Yes / No badge (RM, Tooling); null = no prime process saved. */
function yesNo(v) {
  if (v == null) return <span className="text-slate-400" title="No prime process saved">—</span>;
  return <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-200"}`}>{v ? "Yes" : "No"}</span>;
}
const yesNoText = (v) => (v == null ? "—" : v ? "Yes" : "No");

/** One tag per shortage row (matches entry_count / expand rows). */
function shortageEntryTags(item) {
  const kids = item?.children;
  if (Array.isArray(kids) && kids.length) {
    return kids.map((c) => ({
      key: c.id ?? `${c.itemdcode}-${c.month}-${c.qty}`,
      code: c.item_code || c.itemcode || "—",
      qty: Number(c.qty) || 0,
      weight: c.item_weight,
    }));
  }
  return (item?.items || []).map((it) => ({
    key: it.itemdcode,
    code: it.item_code,
    qty: Number(it.qty) || 0,
    weight: it.item_weight,
  }));
}

const shortageEntryQtyText = (item) =>
  shortageEntryTags(item)
    .map((e) => `${e.code} (${e.qty.toLocaleString()})`)
    .join(", ") || "—";

const rmWireLines = (row) =>
  (row?.rm_wire_items || []).map((r) =>
    typeof r === "string" ? { code: r, desc: null } : { code: r.rm_item_code, desc: r.rm_item_desc || null }
  );

/** Skip description when it repeats the item code (common in RM master). */
function rmWireExtraDesc(code, desc) {
  if (!desc?.trim()) return null;
  const c = String(code ?? "").trim().toUpperCase();
  const d = String(desc).trim().toUpperCase();
  return c && d === c ? null : desc.trim();
}

const rmWireText = (row) => {
  if (row?.rm == null) return "—";
  if (!row.rm) return "No";
  const lines = rmWireLines(row);
  if (!lines.length) return "No";
  return lines
    .map(({ code, desc }) => {
      const extra = rmWireExtraDesc(code, desc);
      return extra ? `${code} — ${extra}` : code;
    })
    .join("; ");
};

function RmWireLineBlock({ code, desc, size = "table" }) {
  const extra = rmWireExtraDesc(code, desc);
  const codeCls = size === "drawer" ? "text-[12px] font-bold uppercase text-slate-900" : "font-bold text-slate-800 uppercase text-[10px]";
  const descCls = size === "drawer" ? "text-[11px] text-slate-500 italic block" : "text-slate-500 italic block whitespace-normal break-words text-[10px]";
  return (
    <div className="leading-snug">
      <span className={codeCls}>{code}</span>
      {extra ? <span className={descCls}>{extra}</span> : null}
    </div>
  );
}

function RmWireView({ row }) {
  if (row?.rm == null) return <span className="text-slate-400 text-[10px]">—</span>;
  if (!row.rm) return <span className="text-[10px] text-slate-500">No</span>;
  const lines = rmWireLines(row);
  if (!lines.length) return <span className="text-[10px] text-slate-500">No</span>;
  return (
    <div className="flex flex-col gap-1 py-0.5">
      {lines.map(({ code, desc }, i) => (
        <RmWireLineBlock key={`${code}-${i}`} code={code} desc={desc} size="table" />
      ))}
    </div>
  );
}

function ShortageItemChips({ item }) {
  const tags = shortageEntryTags(item);
  if (!tags.length) return "—";
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((e) => (
        <span
          key={e.key}
          title={weightKgTitle(e.weight, e.qty)}
          className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap"
        >
          {e.code} <span className="text-indigo-600 tabular-nums">({e.qty.toLocaleString()})</span>
        </span>
      ))}
    </span>
  );
}

/** Job-card tooling_approved: yes/no → boolean; pending / null → — (Job Card RM/Tooling columns). */
export const toolingAsYesNo = (v) => (v === "yes" ? true : v === "no" ? false : null);

/**
 * One row per prime item. `pendingTip` set → pending rows show "Pending" with that tooltip.
 * `jobCard` → order Prime Item, Total Qty, Items (Qty), RM, Tooling, … (Maintain Job Card).
 */
function buildHeaders({ expandedId, onToggleExpand, showRemark, showTooling = true, showRm = false, pendingTip, jobCard, toolingModule = false }) {
  const badgeOf = (row) =>
    row.status === "pending" && pendingTip
      ? { label: "Pending", cls: BADGE.pending.cls, tip: pendingTip }
      : BADGE[row.status] || BADGE.pending;

  const jobCardNo = ["Job Card No", "job_card_no", (v) => (
    <span className={v ? "font-mono text-indigo-600 font-bold text-[11px]" : "text-slate-400 text-[10px]"}>{v || "—"}</span>
  ), { width: "120px" }];

  const [expand, prime, desc, items, qty, weight, status] = [
    ["", null, (_, row) => (
      <button type="button" onClick={(e) => { e.stopPropagation(); onToggleExpand(row.id); }} className="p-1 text-slate-400 hover:text-indigo-600" title="Show items">
        <ChevronRight size={14} className={`transition-transform ${expandedId === row.id ? "rotate-90 text-indigo-600" : ""}`} />
      </button>
    ), { width: "40px", align: "center", sortable: false, excludeCopy: true }],
    ["Prime Item", "prime_item_code", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { width: "150px" }],
    ["Description", "prime_item_desc", text("text-slate-500 italic"), { width: "220px" }],
    ["Items (Qty)", "items_summary", (_, row) => (
      <div className="flex flex-wrap gap-1 py-0.5">
        {shortageEntryTags(row).map((e) => (
          <span key={e.key} title={`${e.code} — ${weightKgTitle(e.weight, e.qty)}`} className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap cursor-help">
            {e.code} <span className="text-indigo-600 tabular-nums">({e.qty.toLocaleString()})</span>
          </span>
        ))}
      </div>
    ), { width: "340px", sortable: false, copyValue: (row) => shortageEntryQtyText(row) }],
    ["Total Qty", "total_qty", num, { width: "110px", align: "center" }],
    ["Total Weight (KG)", "total_weight_kg", (v, row) => (
      <span className="font-semibold text-slate-700 text-[11px] tabular-nums">{weightText(v, row.weight_missing)}</span>
    ), { width: "140px", align: "center", copyValue: (row) => row.total_weight_kg ?? "—" }],
    ["Status", null, (_, row) => {
      const b = badgeOf(row);
      return <span title={b.tip} className={`px-2 py-0.5 text-[9px] font-black uppercase border ${b.cls}`}>{b.label}</span>;
    }, { width: "120px", sortable: false, copyValue: (row) => badgeOf(row).label }],
  ];
  const rm = ["RM wire", "rm", (v, row) => {
    if (v == null) {
      return <span className="text-slate-400 text-[10px]" title="No Production master row for this prime item">—</span>;
    }
    if (!v) return <span className="text-[10px] font-bold text-slate-500">No</span>;
    return <RmWireView row={row} />;
  }, { width: "260px", wrap: true, sortable: false, copyValue: (row) => rmWireText(row) }];
  const rmJobCard = ["RM wire", "rm", (v) => {
    if (v == null) return <span className="text-slate-400 text-[10px]" title="No prime process saved for this item">—</span>;
    return yesNo(v);
  }, { width: "90px", align: "center", sortable: false, copyValue: (row) => yesNoText(row.rm) }];
  const toolingJobCard = ["Tooling", "tooling", (v, row) => {
    if (row.status !== "accepted") {
      return <span className="text-slate-400 text-[10px]" title="Approve shortage first">—</span>;
    }
    if (v === "yes") return yesNo(true);
    if (v === "no") return yesNo(false);
    if (v === "pending") {
      return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-600 border-amber-100" title="Decide on Production → Tooling">
          Pending
        </span>
      );
    }
    return <span className="text-slate-400 text-[10px]" title="No job card yet">—</span>;
  }, { width: "90px", align: "center", sortable: false, copyValue: (row) => {
    if (row.status !== "accepted") return "—";
    if (row.tooling === "yes") return "Yes";
    if (row.tooling === "no") return "No";
    if (row.tooling === "pending") return "Pending";
    return "—";
  } }];
  const toolingShortage = ["Tooling", "tooling", (v, row) => {
    if (row.status && row.status !== "accepted") {
      return (
        <span className="text-slate-400 text-[10px]" title="Tooling applies after shortage is accepted">
          —
        </span>
      );
    }
    const b = TOOLING_BADGE[v];
    if (!b) return <span className="text-slate-400" title="Tooling starts after the shortage is accepted">—</span>;
    return <span title={row.tooling_remark || ""} className={`px-2 py-0.5 text-[9px] font-black uppercase border ${b.cls}`}>{b.label}</span>;
  }, { width: "110px", align: "center", sortable: false, copyValue: (row) => {
    if (row.status && row.status !== "accepted") return "—";
    return toolingText(row.tooling);
  } }];

  if (toolingModule) {
    const headers = [prime, qty, weight];
    if (showTooling) {
      headers.push(toolingShortage, toolingRemarkCol);
      headers.push(...auditPair("Tooling", "tooling_by_name", "tooling_at", { hideUnlessNameKey: "tooling_by_name" }));
    }
    return headers;
  }

  const headers = jobCard
    ? [jobCardNo, prime, desc, items, qty, weight, rmJobCard, toolingJobCard, status]
    : showRm
      ? [expand, prime, desc, rm, qty, weight, status]
      : [expand, prime, desc, qty, weight, status];
  if (!jobCard && showTooling) headers.push(toolingShortage);
  if (showRemark) {
    headers.push(remarkCol);
    if (showTooling) headers.push(toolingRemarkCol);
  }
  return headers;
}

/** Entries of one prime item (shown when the row is expanded). */
const CHILD_HEADERS = [
  ["Shortage No", "id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { width: "90px" }],
  ["Item Code", "item_code", (v, row) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || row.itemcode || "—"}</span>, { width: "140px" }],
  ["Description", "item_desc", text("text-slate-500 italic"), { width: "200px" }],
  ["Month", "month", (v) => <span className="text-[10px] font-bold text-indigo-700 tabular-nums">{formatShortageMonthDate(v)}</span>, { width: "110px", copyValue: (row) => formatShortageMonthDate(row.month) }],
  ["Type", "type", (v) => <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${typeBadgeClass(v)}`}>{v}</span>, { width: "110px" }],
  ["Qty", "qty", num, { width: "80px", align: "center" }],
  ["Weight (KG)", "weight_kg", (v, row) => <span className="font-semibold text-slate-700 text-[11px] tabular-nums cursor-help" title={weightKgTitle(row.item_weight, row.qty)}>{weightText(v)}</span>, { width: "110px", align: "center" }],
  ["Remarks", "remarks", text("text-slate-500"), { width: "160px" }],
  remarkCol,
  ["Created By", "created_by", text("text-slate-500"), { width: "110px" }],
  ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "150px", copyValue: (row) => formatDateTime(row.created_at) }],
];

const searchParts = (row) => [
  row.job_card_no,
  row.prime_item_code,
  row.prime_item_desc,
  row.accepted_remark,
  row.tooling_remark,
  ...(row.item_codes || []),
];

const toolingSearchParts = (row) => [row.prime_item_code, row.prime_item_desc, row.tooling_remark];

/* ───────────── list hook ───────────── */

/**
 * List state + props for <DataTable /> and <AppListFooter />.
 *   load       — stable service fn (called on mount + when refreshKey changes)
 *   status     — browser filter on row.status ("all" = no filter)
 *   tooling    — browser filter on row.tooling ("all" = no filter)
 *   showRemark / pendingTip / jobCard — column options
 *   onDataChange — gets { rows, headers } for the page Export button
 */
export function usePrimeItemList({ load, refreshKey, status = "all", tooling = "all", showRemark = false, showTooling = true, showRm = false, pendingTip = null, jobCard = false, toolingModule = false, onDataChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sort, setSort] = useState({ sortKey: "prime_item_code", sortDir: "asc" });
  const [selected, setSelected] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [childRows, setChildRows] = useState({});
  const [childLoading, setChildLoading] = useState(null);
  const [limit, setLimit] = useState(PAGE_CHUNK);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const reqId = ++requestRef.current; // only the latest request may update state
    setLoading(true);
    setError("");
    try {
      const res = await load();
      if (reqId !== requestRef.current) return;
      if (res?.success === false) throw new Error(res?.message || "Failed to load");
      const data = Array.isArray(res?.data) ? res.data : [];
      setRows(data);
      setChildRows({});
      setExpandedId(null);
      setSelected((cur) => (data.some((r) => r.id === cur) ? cur : null));
    } catch (err) {
      if (reqId !== requestRef.current) return;
      setRows([]);
      setError(err?.message || "Failed to load");
      toast.error(err?.message || "Failed to load");
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  /** Filter changed → first 100 rows, nothing selected / expanded. */
  const resetView = useCallback(() => {
    setLimit(PAGE_CHUNK);
    setSelected(null);
    setExpandedId(null);
  }, []);

  const setSearch = useCallback((value) => {
    setSearchValue(value);
    setLimit(PAGE_CHUNK);
  }, []);

  const toggleExpand = useCallback((id) => setExpandedId((cur) => (cur === id ? null : id)), []);

  useEffect(() => {
    if (!expandedId || jobCard || toolingModule) return;
    if (childRows[expandedId]) return;
    const row = rows.find((r) => r.id === expandedId);
    if (!row?.prime_key) return;
    let cancelled = false;
    setChildLoading(expandedId);
    shortageService
      .getPrimeItemEntries(row.prime_key, row.status)
      .then((res) => {
        if (cancelled || res?.success === false) return;
        setChildRows((prev) => ({ ...prev, [expandedId]: Array.isArray(res?.data) ? res.data : [] }));
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load shortage entries");
      })
      .finally(() => {
        if (!cancelled) setChildLoading(null);
      });
    return () => {
      cancelled = true;
    };
  }, [expandedId, rows, jobCard, toolingModule, childRows]);

  const filteredRows = useMemo(() => {
    let data = toolingModule
      ? tooling !== "all"
        ? rows.filter((r) => r.tooling === tooling)
        : rows
      : tooling !== "all"
        ? rows.filter((r) => r.status === "accepted" && r.tooling === tooling)
        : status === "all"
          ? rows
          : rows.filter((r) => r.status === (status === "approved" ? "accepted" : status));
    if (deferredSearch.trim()) {
      data = applyClientSearch(data, deferredSearch, {
        getParts: toolingModule ? toolingSearchParts : searchParts,
        skipSort: true,
      });
    }
    return sortRowsByKey(data, sort.sortKey, sort.sortDir);
  }, [rows, status, tooling, toolingModule, deferredSearch, sort]);

  const visibleRows = useMemo(() => filteredRows.slice(0, limit), [filteredRows, limit]);
  const selectedRow = useMemo(() => rows.find((r) => r.id === selected) || null, [rows, selected]);
  const headers = useMemo(
    () => buildHeaders({ expandedId, onToggleExpand: toggleExpand, showRemark, showTooling, showRm, pendingTip, jobCard, toolingModule }),
    [expandedId, toggleExpand, showRemark, showTooling, showRm, pendingTip, jobCard, toolingModule]
  );

  useEffect(() => {
    onDataChange?.({ rows: filteredRows, headers: headers.filter((h) => !h[3]?.excludeCopy) });
  }, [filteredRows, headers, onDataChange]);

  const colIndex = (label) => headers.findIndex((h) => h[0] === label);

  const tableProps = {
    headers,
    data: visibleRows,
    loading,
    allowCopy: true,
    sortKey: sort.sortKey,
    sortDir: sort.sortDir,
    onSort: (key) => {
      setLimit(PAGE_CHUNK);
      setSort((p) => ({ sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc" }));
    },
    selectedId: selected,
    onSelect: setSelected,
    getRowId: (row) => row.id,
    ...(jobCard
      ? {}
      : {
          expandedRowId: expandedId,
          renderExpandedRow: (row) => (
            <div className="h-[min(280px,35vh)] min-h-[120px] flex flex-col overflow-hidden border-l-4 border-indigo-400 bg-slate-50/90">
              <DataTable
                headers={CHILD_HEADERS}
                data={childRows[row.id] || []}
                loading={childLoading === row.id}
                viewMode="table"
                allowCopy
                showSelection={false}
                getRowId={(r) => r.id}
                suppressLoadingFooterRow
                centerLoadingOverlay={false}
                hotkeysDisabled
              />
            </div>
          ),
        }),
    onLoadMore: () => setLimit((n) => n + PAGE_CHUNK),
    hasMore: visibleRows.length < filteredRows.length,
    totalItems: filteredRows.length,
    // card view: badges = Status + Total Qty, details = Items + Description (found by label, works for both column orders)
    cardConfig: { titleKey: "prime_item_code", badgeIndices: ["Status", "Total Qty"].map(colIndex), detailIndices: ["Description"].map(colIndex) },
  };

  const footerProps = {
    shown: visibleRows.length,
    total: filteredRows.length,
    noun: "Prime Items",
    selected,
    selectedRecord: selectedRow,
    selectionLabel: (r) =>
      jobCard || toolingModule
        ? `Selected: ${r?.prime_item_code || "—"}`
        : `Selected: ${r?.prime_item_code || "—"} · ${r?.entry_count ?? 0} entries`,
    onClearSelection: () => setSelected(null),
  };

  return { error, search, setSearch, selected, setSelected, selectedRow, toggleExpand, reload, resetView, tableProps, footerProps };
}

/* ───────────── drawer pieces ───────────── */

/** Alias — IMS form label class (drawer field labels). */
export const LABEL = FORM_LABEL_CLASS;
export const BTN = "h-8 px-3 text-[11px] font-bold uppercase border border-slate-300 rounded-none hover:bg-slate-50 disabled:opacity-40 text-slate-700";

/** Bordered drawer section with a colored bar + title (IMS drawer look). */
export function DrawerSection({ title, bar = "bg-indigo-500", badge = null, children }) {
  return (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <div className={`h-3.5 w-1 shrink-0 rounded-full ${bar}`} />
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{title}</span>
        {badge ? <span className="ml-auto">{badge}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** Compact tooling drawer — micro label + value. */
const IMS_MICRO_LABEL =
  "text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-none mb-1";

function ImsDrawerField({ label, value, wide = false, layout = "drawer" }) {
  const wideCls = layout === "compact" ? "col-span-2" : "sm:col-span-2 lg:col-span-4";
  return (
    <div className={wide ? `min-w-0 ${wideCls}` : "min-w-0"}>
      <p className={IMS_MICRO_LABEL}>{label}</p>
      <div className={`${IMS_TABLE_CELL_TEXT} text-[12px] font-semibold text-slate-800 leading-snug break-words`}>{value ?? "—"}</div>
    </div>
  );
}

/** Full prime-item drawer — flush labels, tight label → value stack. */
const DRAWER_DETAIL_LABEL =
  "text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-none mb-0.5";

function DrawerDetailField({ label, value, wide = false }) {
  return (
    <div className={wide ? "min-w-0 w-full" : "min-w-0"}>
      <p className={DRAWER_DETAIL_LABEL}>{label}</p>
      <span className={`${IMS_TABLE_CELL_TEXT} text-[12px] text-slate-800 break-words leading-snug block`}>{value ?? "—"}</span>
    </div>
  );
}

const Field = ({ label, wide, children }) => (
  <ImsDrawerField label={label} value={children} wide={wide} layout="compact" />
);

function rmWireDetailBody(lines) {
  if (!lines.length) return "No";
  return (
    <div className="space-y-1">
      {lines.map(({ code, desc }, i) => (
        <RmWireLineBlock key={`${code}-${i}`} code={code} desc={desc} size="drawer" />
      ))}
    </div>
  );
}

function rmWireDetailValue(row) {
  if (row?.rm == null) return "—";
  if (!row.rm) return "No";
  return rmWireDetailBody(rmWireLines(row));
}

/** Job card summary — process flags as plain Yes/No (matches pending table RM / Tooling columns). */
function jobCardProcessYesNo(flag) {
  if (flag == null) return "—";
  return flag ? "Yes" : "No";
}

/** Prime item details block (both drawers). `compact` = Tooling · `jobCard` = New / View / Edit (includes G Weight). */
export function PrimeItemSummary({ item, extra = null, compact = false, jobCard = false }) {
  if (jobCard) {
    return (
      <div className="space-y-2 px-3 py-2.5">
        <div className={JOB_CARD_PRIME_DETAIL_GRID}>
          {extra}
          <DrawerDetailField label="Item Code" value={<span className="font-bold uppercase text-slate-900">{item.prime_item_code || "—"}</span>} />
          <DrawerDetailField label="Item Description" value={item.prime_item_desc || "—"} />
          <DrawerDetailField
            label="Weight"
            value={
              <span className={`${IMS_TABLE_CELL_NUMBER} font-bold`}>
                {item.gweight != null && Number(item.gweight) > 0 ? Number(item.gweight).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}
              </span>
            }
          />
          <DrawerDetailField label="Shortage Qty" value={<span className={`${IMS_TABLE_CELL_NUMBER} font-bold`}>{Number(item.total_qty ?? item.qty ?? 0).toLocaleString()}</span>} />
        </div>
        <DrawerDetailField label="Item-wise Qty" value={<ShortageItemChips item={item} />} wide />
        {/* This is Futture point so dont delete */}
        {/* <DrawerDetailField label="Total" value={<span className={`${IMS_TABLE_CELL_NUMBER} font-bold`}>{weightText(item.total_weight_kg, item.weight_missing)}</span>} />
        <DrawerDetailField label="RM wire" value={jobCardProcessYesNo(item.rm)} />
        <DrawerDetailField label="Tooling" value={jobCardProcessYesNo(item.process_tooling)} /> */}
      </div>
    );
  }
  if (compact) {
    return (
      <div className="px-4 py-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
        <DrawerDetailField label="Prime Item" value={<span className="font-bold uppercase text-slate-900">{item.prime_item_code || "—"}</span>} wide />
        <DrawerDetailField label="Description" value={item.prime_item_desc || "—"} wide />
        <DrawerDetailField label="Total Qty" value={<span className={`${IMS_TABLE_CELL_NUMBER} font-bold`}>{Number(item.total_qty ?? 0).toLocaleString()}</span>} />
        <DrawerDetailField label="Total Weight (KG)" value={<span className={`${IMS_TABLE_CELL_NUMBER} font-bold`}>{weightText(item.total_weight_kg, item.weight_missing)}</span>} />
        {item.tooling && item.tooling !== "pending" ? (
          <>
            <DrawerDetailField label="Tooling" value={toolingText(item.tooling)} />
            <DrawerDetailField label="Tooling Remark" value={item.tooling_remark || "—"} wide />
          </>
        ) : null}
        {extra}
      </div>
    );
  }
  return (
    <div className="px-4 py-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
      <DrawerDetailField label="Prime Item" value={<span className="font-bold uppercase text-slate-900">{item.prime_item_code || "—"}</span>} wide />
      <DrawerDetailField label="Description" value={item.prime_item_desc || "—"} wide />
      <DrawerDetailField label="Total Qty" value={<span className={`${IMS_TABLE_CELL_NUMBER} font-bold`}>{Number(item.total_qty ?? 0).toLocaleString()}</span>} />
      <DrawerDetailField label="Total Weight (KG)" value={<span className={`${IMS_TABLE_CELL_NUMBER} font-bold`}>{weightText(item.total_weight_kg, item.weight_missing)}</span>} />
      <DrawerDetailField label="Items (Qty)" value={<ShortageItemChips item={item} />} wide />
      <DrawerDetailField label="RM wire" value={rmWireDetailValue(item)} wide />
      {item.tooling ? <DrawerDetailField label="Tooling" value={toolingText(item.tooling)} /> : null}
      {item.tooling ? <DrawerDetailField label="Tooling Remark" value={item.tooling_remark || "—"} wide /> : null}
      {extra}
    </div>
  );
}

export { Field as SummaryField, DrawerDetailField };
