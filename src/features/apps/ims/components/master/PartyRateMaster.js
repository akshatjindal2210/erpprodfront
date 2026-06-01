"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { IndianRupee, RefreshCcw, Eye, X } from "lucide-react";
import { toast } from "react-toastify";
import { toastDataRefreshed } from "@/core/utils/toastNotify";
import { masterService } from "@/features/apps/ims/services/master";

import { useViewMode } from "@/core/hooks/useViewMode";
import DataTable from "@/core/components/ui/DataTable";
import ViewToggle from "@/core/components/ui/ViewToggle";
import ActionButton from "@/core/components/ui/ActionButton";
import GlobalDetailModal from "@/core/components/common/GlobalDetailModal";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection, MasterDetailProse, MasterDetailStatusRow } from "./MasterDetailLayout";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ListPageSearchField from "@/core/components/common/ListPageSearchField";
import { bestTierForStrings } from "@/features/apps/ims/helpers/liveSearchRank";

function sortPartyList(list, qRaw) {
  const q = String(qRaw ?? "").trim().toLowerCase();
  if (!q) {
    return [...list].sort((a, b) =>
      String(a.acc_name ?? "").localeCompare(String(b.acc_name ?? ""), undefined, { sensitivity: "base" })
    );
  }
  return [...list].sort((a, b) => {
    const ra = bestTierForStrings(q, [a.acc_name, a.acc_code]);
    const rb = bestTierForStrings(q, [b.acc_name, b.acc_code]);
    if (ra !== rb) return ra - rb;
    return String(a.acc_name ?? "").localeCompare(String(b.acc_name ?? ""), undefined, { sensitivity: "base" });
  });
}

function sortItemOptionList(list, qRaw) {
  const q = String(qRaw ?? "").trim().toLowerCase();
  if (!q) {
    return [...list].sort((a, b) =>
      String(a.item_code ?? "").localeCompare(String(b.item_code ?? ""), undefined, { sensitivity: "base" })
    );
  }
  return [...list].sort((a, b) => {
    const ra = bestTierForStrings(q, [a.item_code, a.itemdesc, String(a.itemdcode ?? "")]);
    const rb = bestTierForStrings(q, [b.item_code, b.itemdesc, String(b.itemdcode ?? "")]);
    if (ra !== rb) return ra - rb;
    return String(a.item_code ?? "").localeCompare(String(b.item_code ?? ""), undefined, { sensitivity: "base" });
  });
}

function tableRowSearchRank(row, qRaw) {
  const q = String(qRaw ?? "").trim();
  if (!q) return 0;
  return bestTierForStrings(q, [
    row.acc_name,
    row.itemdesc,
    row.item_code,
    row.narr1,
    row.grpname,
    row.itapv
  ]);
}

export default function PartyRateMasterPage() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [viewMode, handleViewMode] = useViewMode();

  const [filterAccCode, setFilterAccCode] = useState(null);
  const [filterItemdcode, setFilterItemdcode] = useState(null);
  const [tempSearch, setTempSearch] = useState("");

  const [params, setParams] = useState({
    sortKey: "",
    sortDir: "asc"
  });

  // Selection + Modals
  const [selected, setSelected] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Fetch Data ────────────────────────────────────────────────
  const fetchItems = useCallback(async (isManualRefresh = false) => {
    setLoading(true);
    try {
      const body = await masterService.getPartyRates();
      const list = body.data ?? [];
      const newItems = (Array.isArray(list) ? list : []).map((row, index) => ({ 
        ...row, 
        row_id: `${row.acc_code}-${row.itemdcode}-${index}`
      }));
      setAllData(newItems);
      if (isManualRefresh) toastDataRefreshed();
    } catch (err) {
      toast.error(err?.message || "Failed to load party rates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchItems(); 
  }, [fetchItems]);

  const uniqueParties = useMemo(() => {
    const map = new Map();
    for (const r of allData) {
      const code = r.acc_code;
      if (code == null || code === "") continue;
      const key = String(code);
      if (map.has(key)) continue;
      map.set(key, {
        acc_code: code,
        acc_name: r.acc_name || `Customer ${code}`
      });
    }
    return [...map.values()].sort((a, b) =>
      String(a.acc_name || "").localeCompare(String(b.acc_name || ""), undefined, { sensitivity: "base" })
    );
  }, [allData]);

  const itemSourceRows = useMemo(() => {
    if (filterAccCode == null || filterAccCode === "") return allData;
    return allData.filter((r) => String(r.acc_code) === String(filterAccCode));
  }, [allData, filterAccCode]);

  const uniqueItemOptions = useMemo(() => {
    const map = new Map();
    for (const r of itemSourceRows) {
      if (r.itemdcode == null || r.itemdcode === "") continue;
      const key = String(r.itemdcode);
      if (map.has(key)) continue;
      map.set(key, {
        itemdcode: r.itemdcode,
        item_code: r.item_code || key,
        itemdesc: r.itemdesc || ""
      });
    }
    return [...map.values()].sort((a, b) =>
      String(a.item_code ?? "").localeCompare(String(b.item_code ?? ""), undefined, { sensitivity: "base" })
    );
  }, [itemSourceRows]);

  useEffect(() => {
    if (filterItemdcode == null) return;
    const ok = uniqueItemOptions.some((o) => String(o.itemdcode) === String(filterItemdcode));
    if (!ok) setFilterItemdcode(null);
  }, [uniqueItemOptions, filterItemdcode]);

  const partyFetchService = useMemo(
    () => async ({ search, page, limit }) => {
      const q = String(search || "").toLowerCase().trim();
      let list = uniqueParties;
      if (q) {
        list = list.filter(
          (p) =>
            String(p.acc_name || "").toLowerCase().includes(q) ||
            String(p.acc_code || "").toLowerCase().includes(q)
        );
      }
      list = sortPartyList(list, search || "");
      const lim = Math.min(100, Math.max(1, Number(limit) || 50));
      const pg = Math.max(1, Number(page) || 1);
      const start = (pg - 1) * lim;
      return { data: list.slice(start, start + lim) };
    },
    [uniqueParties]
  );

  const partyGetById = useMemo(
    () => (id) => {
      const row = uniqueParties.find((p) => String(p.acc_code) === String(id));
      return Promise.resolve({ data: row || { acc_code: id, acc_name: String(id ?? "") } });
    },
    [uniqueParties]
  );

  const itemFetchService = useMemo(
    () => async ({ search, page, limit }) => {
      const q = String(search || "").toLowerCase().trim();
      let list = uniqueItemOptions;
      if (q) {
        list = list.filter(
          (it) =>
            String(it.item_code || "").toLowerCase().includes(q) ||
            String(it.itemdesc || "").toLowerCase().includes(q) ||
            String(it.itemdcode || "").includes(q)
        );
      }
      list = sortItemOptionList(list, search || "");
      const lim = Math.min(100, Math.max(1, Number(limit) || 50));
      const pg = Math.max(1, Number(page) || 1);
      const start = (pg - 1) * lim;
      return { data: list.slice(start, start + lim) };
    },
    [uniqueItemOptions]
  );

  const itemGetById = useMemo(
    () => (id) => {
      const row = uniqueItemOptions.find((it) => String(it.itemdcode) === String(id));
      return Promise.resolve({
        data: row || { itemdcode: id, item_code: "", itemdesc: "" }
      });
    },
    [uniqueItemOptions]
  );

  const filteredData = useMemo(() => {
    let data = [...allData];
    if (filterAccCode != null && filterAccCode !== "") {
      data = data.filter((r) => String(r.acc_code) === String(filterAccCode));
    }
    if (filterItemdcode != null && filterItemdcode !== "") {
      data = data.filter((r) => String(r.itemdcode) === String(filterItemdcode));
    }
    if (tempSearch.trim()) {
      const s = tempSearch.toLowerCase();
      data = data.filter((r) =>
        [
          r.acc_name,
          r.itemdesc,
          r.item_code,
          r.narr1,
          r.grpname,
          r.itapv
        ].some((v) => v != null && String(v).toLowerCase().includes(s))
      );
      const q = tempSearch.trim();
      data.sort((a, b) => {
        const ra = tableRowSearchRank(a, q);
        const rb = tableRowSearchRank(b, q);
        if (ra !== rb) return ra - rb;
        const n = String(a.acc_name ?? "").localeCompare(String(b.acc_name ?? ""), undefined, {
          sensitivity: "base"
        });
        if (n !== 0) return n;
        return String(a.item_code ?? "").localeCompare(String(b.item_code ?? ""), undefined, {
          sensitivity: "base"
        });
      });
    } else if (params.sortKey) {
      data.sort((a, b) => {
        let valA = a[params.sortKey];
        let valB = b[params.sortKey];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return params.sortDir === "asc" ? -1 : 1;
        if (valA > valB) return params.sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [allData, filterAccCode, filterItemdcode, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredData.slice(0, displayLimit), [filteredData, displayLimit]);
  const totalItems = filteredData.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit(prev => prev + 100);
    }
  }, [loading, items.length, totalItems]);

  const toggleSort = (key) => {
    setParams(p => ({
      ...p,
      sortKey: key,
      sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc"
    }));
    setDisplayLimit(100);
  };

  const selectedRecord = useMemo(() => allData.find(u => u.row_id === selected), [allData, selected]);

  // ── Headers Configuration ─────────────────────────────────────
  const HEADERS = [
  // 1. Party Details (Name + Code)
  ["Customer Name", "acc_name", (v, row) => (
    <div className="flex flex-col min-w-0">
      <span
        className="font-semibold text-slate-800 text-[11px] uppercase leading-snug whitespace-normal break-words hyphens-auto"
        title={v && String(v).length > 80 ? v : undefined}
      >
        {v || "N/A"}
      </span>
    </div>
  ), { wrap: true, width: "180px" }],

  // 2. Item code (own column)
  [
    "Item Code",
    "item_code",
    (v) => (
      <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight font-mono">
        {v || "—"}
      </span>
    ),
    { width: "120px" }
  ],

  // 3. Item description (+ group hint)
  [
    "Item Description",
    "itemdesc",
    (v, row) => (
      <div className="flex flex-col min-w-0 max-w-full gap-0.5">
        <span className="font-medium text-slate-700 text-[11px] leading-snug whitespace-normal break-words hyphens-auto">
          {v || "—"}
        </span>
      </div>
    ),
    { wrap: true, width: "250px" }
  ],

  [
    "Group Name",
    "grpname",
    (v, row) => (
      <div className="flex flex-col min-w-0 max-w-full gap-0.5">
        <span className="font-medium text-slate-700 text-[11px] leading-snug whitespace-normal break-words hyphens-auto">
          {v || "—"}
        </span>
      </div>
    ),
    { wrap: true }
  ],

  // 4. Narration
  ["Customer Code", "narr1", (v) => (
    <span className="text-slate-500 italic text-[11px] block max-w-[180px] truncate leading-tight">
      {v || "—"}
    </span>
  )],

  // 5. Status
  ["Status", "itapv", (v) => (
    <span className={`px-2 py-0.5 rounded-none text-[9px] font-bold border uppercase tracking-widest ${
      v?.toUpperCase() === 'APPROVED' 
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
        : 'bg-amber-50 text-amber-600 border-amber-200'
    }`}>
      {v || 'PENDING'}
    </span>
  )]
];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            <div className="flex items-center gap-2">
              <ActionButton 
                variant="outline" label="View Details" icon={Eye}
                disabled={!selected} 
                onClick={() => setIsModalOpen(true)}
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none"
              />

              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />

              <button onClick={() => fetchItems(true)} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>

            <div className="flex items-center">
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
            </div>
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic whitespace-normal break-words text-left leading-snug">
                Selected: {selectedRecord?.acc_name} · {selectedRecord?.item_code || selectedRecord?.itemdesc}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        <ListPageFilterStrip>
          <div className="grid w-full min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
            <div className="min-w-0 w-full">
            <ListPageSearchField
              label="Search table"
              placeholder="Customer, item, narration…"
              value={tempSearch}
              onChange={(v) => {
                setTempSearch(v);
                setDisplayLimit(100);
              }}
              containerClassName="w-full min-w-0 space-y-1"
            />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                variant="toolbar"
                className="w-full min-w-0"
                label="Customer"
                value={filterAccCode}
                onChange={(id) => {
                  setFilterAccCode(id);
                  setFilterItemdcode(null);
                  setDisplayLimit(100);
                }}
                fetchService={partyFetchService}
                getByIdService={partyGetById}
                dataKey="acc_code"
                labelKey="acc_name"
                placeholder="Search customer..."
                disabled={loading && allData.length === 0}
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                variant="toolbar"
                className="w-full min-w-0"
                label="Item"
                value={filterItemdcode}
                onChange={(id) => {
                  setFilterItemdcode(id);
                  setDisplayLimit(100);
                }}
                fetchService={itemFetchService}
                getByIdService={itemGetById}
                dataKey="itemdcode"
                labelKey="item_code"
                subLabelKey="itemdesc"
                placeholder="Search item..."
                disabled={loading && allData.length === 0}
              />
            </div>
          </div>
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS} data={items} loading={loading} viewMode={viewMode}
            onSort={toggleSort} sortKey={params.sortKey} sortDir={params.sortDir}
            showSelection={true} allowCopy={true} 
            getRowId={(row) => row.row_id}
            selectedId={selected} onSelect={setSelected}
            emptyIcon={IndianRupee}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ 
              titleKey: "acc_name",
              tagsKeys: ["itapv"],
              detailKeys: ["item_code", "itemdesc", "narr1"],
              className: "rounded-none border border-slate-200 shadow-none"
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Customer Rates
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {/* Rate Detail Modal */}
      <GlobalDetailModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Rate Master Details"
        icon={IndianRupee}
      >
        {selectedRecord && (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow="Customer rate"
              icon={IndianRupee}
              title={selectedRecord.acc_name}
            />
            <MasterDetailSection label="Item code" tone="white">
              <span>{selectedRecord.item_code || "—"}</span>
            </MasterDetailSection>
            {selectedRecord.itemdesc ? (
              <MasterDetailProse label="Item description" tone="slate">
                {selectedRecord.itemdesc}
              </MasterDetailProse>
            ) : null}
            <MasterDetailStatusRow label="Approval status">
              <span
                className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-tighter ${
                  selectedRecord.itapv === "Approved"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-amber-50 text-amber-600 border-amber-200"
                }`}
              >
                {selectedRecord.itapv ?? "—"}
              </span>
            </MasterDetailStatusRow>
            <MasterDetailProse label="Narration / remarks" tone="slate">
              {selectedRecord.narr1?.trim()
                ? selectedRecord.narr1
                : "No remarks available for this record."}
            </MasterDetailProse>
          </MasterDetailBody>
        )}
      </GlobalDetailModal>
    </div>
  );
}

