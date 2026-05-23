"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Package, RefreshCcw, Eye, X } from "lucide-react";
import { toast } from "react-toastify";
import { toastDataRefreshed } from "@/helpers/toastNotify";
import { masterService } from "@/services/master";

import { useViewMode } from "@/hooks/useViewMode";
import DataTable from "../ui/DataTable";
import ViewToggle from "../ui/ViewToggle";
import ActionButton from "../ui/ActionButton";
import GlobalDetailModal from "../common/GlobalDetailModal";
import ListPageFilterStrip from "@/components/common/ListPageFilterStrip";
import ListPageSearchField from "@/components/common/ListPageSearchField";
import {
  MasterDetailBody,
  MasterDetailHero,
  MasterDetailSection,
  MasterDetailGrid,
  MasterDetailMetrics,
} from "./MasterDetailLayout";
import { bestTierForStrings } from "@/helpers/liveSearchRank";

export default function ProductMasterPage() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [viewMode, handleViewMode] = useViewMode();

  // Filters
  const [tempSearch, setTempSearch] = useState("");
  const [params, setParams] = useState({
    sortKey: "",
    sortDir: "asc"
  });

  // Selection
  const [selected, setSelected] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchItems = useCallback(async (isManualRefresh = false) => {
    setLoading(true);
    try {
      const body = await masterService.getItems();
      const list = body.data ?? [];
      setAllData(Array.isArray(list) ? list : []);
      if (isManualRefresh) toastDataRefreshed();
    } catch (err) {
      toast.error(err?.message || "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchItems(); 
  }, [fetchItems]);

  const filteredData = useMemo(() => {
    let data = [...allData];
    if (tempSearch.trim()) {
      const s = tempSearch.toLowerCase();
      const q = tempSearch.trim();
      data = data.filter(
        (r) =>
          String(r.item_code || "").toLowerCase().includes(s) ||
          String(r.itemdesc || "").toLowerCase().includes(s) ||
          String(r.grpname || "").toLowerCase().includes(s)
      );
      data.sort((a, b) => {
        const ra = bestTierForStrings(q, [a.item_code, a.itemdesc, a.grpname]);
        const rb = bestTierForStrings(q, [b.item_code, b.itemdesc, b.grpname]);
        if (ra !== rb) return ra - rb;
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
  }, [allData, tempSearch, params.sortKey, params.sortDir]);

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

  const selectedRecord = useMemo(() => allData.find(u => u.itemdcode === selected), [allData, selected]);

  // Headers Configuration
  const HEADERS = [
    ["Item Code", "item_code", (v) => (
      <span className="font-mono text-[10px] font-bold tracking-tighter">
        {v}
      </span>
    ), { width: "150px" }],
    ["Description", "itemdesc", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>, { width: "180px" }],
    ["Group", "grpname", (v) => (
      <span className="px-2 py-0.5 rounded-none text-[9px] font-bold border bg-slate-50 text-slate-600 border-slate-200 uppercase tracking-tighter">
        {v}
      </span>
    )],
    ["Min/Max", "minqty", (v, row) => (
        <span className="text-slate-500 font-medium text-[10px]">{v} / {row.maxqty}</span>
    )],
    ["Reorder", "reorderqty", (v) => <span className="font-bold text-amber-600 text-[11px]">{v}</span>],
    ["Status", "apvitem", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
        {v ? "Active" : "Inactive"}
      </span>
    ), { width: "110px" }],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            <div className="flex items-center gap-2">
              <ActionButton 
                variant="outline" label="View Details" icon={Eye} 
                disabled={!selected} onClick={() => setIsModalOpen(true)}
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
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic">
                Selected Product: {selectedRecord?.item_code} | {selectedRecord?.itemdesc}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        <ListPageFilterStrip className="space-y-2">
          <ListPageSearchField
            label="Product search"
            placeholder="Item Code, Item description, group"
            value={tempSearch}
            onChange={(v) => {
              setTempSearch(v);
              setDisplayLimit(100);
            }}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS} data={items} loading={loading} viewMode={viewMode}
            showSelection={true} allowCopy={true} sortKey={params.sortKey} sortDir={params.sortDir} onSort={toggleSort}
            selectedId={selected} onSelect={setSelected} getRowId={(r) => r.itemdcode}
            emptyIcon={Package}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "itemdesc",
              tagsKeys: ["grpname"],
              detailKeys: ["item_code", "reorderqty", "minqty"],
              className: "rounded-none border border-slate-200 shadow-none"
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Products
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <GlobalDetailModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Product Master Details"
        icon={Package}
      >
        {selectedRecord && (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow="Product master"
              icon={Package}
              title={selectedRecord.itemdesc}
              badge={selectedRecord.item_code ? `Item code: ${selectedRecord.item_code}` : null}
            />
            <MasterDetailGrid columns={2}>
              <MasterDetailSection label="Group name" tone="white">
                <span>{selectedRecord.grpname || "N/A"}</span>
              </MasterDetailSection>
              <MasterDetailSection label="Primary item" tone="white">
                <span>{selectedRecord.primitemdesc || "—"}</span>
              </MasterDetailSection>
            </MasterDetailGrid>
            <MasterDetailMetrics
              columns={3}
              items={[
                { label: "Min qty", value: selectedRecord.minqty ?? 0 },
                { label: "Max qty", value: selectedRecord.maxqty ?? 0 },
                { label: "Reorder", value: selectedRecord.reorderqty ?? 0, emphasis: true },
              ]}
            />
          </MasterDetailBody>
        )}
      </GlobalDetailModal>
    </div>
  );
}
