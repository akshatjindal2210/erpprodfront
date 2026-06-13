"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { IndianRupee, Eye } from "lucide-react";
import { masterService } from "@/features/apps/ims/services/master";
import { useViewMode } from "@/core/hooks/useViewMode";
import DataTable from "@/core/components/ui/DataTable";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ActionButton from "@/core/components/ui/ActionButton";
import GlobalDetailModal from "@/core/components/common/GlobalDetailModal";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection, MasterDetailProse, MasterDetailStatusRow } from "./MasterDetailLayout";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ListPageSearchField from "@/core/components/common/ListPageSearchField";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import { useMasterClientList } from "@/features/apps/ims/helpers/useMasterClientList";
import { MasterSelectionBanner, MasterListFooter, MasterRefreshButton } from "@/features/apps/ims/helpers/masterListUi";
import { PARTY_RATE_HEADERS, PARTY_RATE_CARD_CONFIG, partyRateRowKey, partyRateSearchParts, sortPartyList, sortItemOptionList, buildUniqueParties, buildUniqueItemOptions, filterPartyRateRows, attachPartyRateRowIds } from "./masterColumns";

export default function PartyRateMasterPage() {
  const [viewMode, handleViewMode] = useViewMode();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterAccCode, setFilterAccCode] = useState(null);
  const [filterItemdcode, setFilterItemdcode] = useState(null);

  const loadData = useCallback(async () => {
    const body = await masterService.getPartyRates();
    const list = body.data ?? [];
    return attachPartyRateRowIds(Array.isArray(list) ? list : []);
  }, []);

  const preFilter = useCallback(
    (rows) => filterPartyRateRows(rows, { accCode: filterAccCode, itemDcode: filterItemdcode }),
    [filterAccCode, filterItemdcode]
  );

  const {
    allData,
    loading,
    reload,
    tempSearch,
    setTempSearch,
    params,
    selected,
    setSelected,
    selectedRecord,
    filteredData,
    items,
    totalItems,
    handleLoadMore,
    toggleSort,
    resetDisplayLimit,
  } = useMasterClientList({
    loadData,
    errorMessage: "Failed to load party rates",
    getSearchParts: partyRateSearchParts,
    preFilter,
    getRowKey: partyRateRowKey,
  });

  const uniqueParties = useMemo(() => buildUniqueParties(allData), [allData]);

  const itemSourceRows = useMemo(() => {
    if (filterAccCode == null || filterAccCode === "") return allData;
    return allData.filter((r) => String(r.acc_code) === String(filterAccCode));
  }, [allData, filterAccCode]);

  const uniqueItemOptions = useMemo(() => buildUniqueItemOptions(itemSourceRows), [itemSourceRows]);

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
      return Promise.resolve({ data: row || { itemdcode: id, item_code: "", itemdesc: "" } });
    },
    [uniqueItemOptions]
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Party Rate Master",
    rows: filteredData,
    headers: PARTY_RATE_HEADERS,
  });

  return (
    <div className={`${IMS_LIST_PAGE_SHELL} font-sans`}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <ActionButton
                  variant="outline"
                  label="View Details"
                  icon={Eye}
                  disabled={!selected}
                  onClick={() => setIsModalOpen(true)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none"
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
                <MasterRefreshButton loading={loading} onClick={() => reload(true)} />
              </div>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || exportDisabled}
                onExport={handleExport}
              />
            }
          />

          {selected ? (
            <MasterSelectionBanner onClear={() => setSelected(null)}>
              Selected: {selectedRecord?.acc_name} · {selectedRecord?.item_code || selectedRecord?.itemdesc}
            </MasterSelectionBanner>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <div className="grid w-full min-w-0 grid-cols-2 items-end gap-2 md:gap-3 lg:grid-cols-3 lg:gap-3">
            <div className="min-w-0 w-full">
              <ListPageSearchField
                label="Search table"
                placeholder="Customer, item, narration…"
                value={tempSearch}
                onChange={(v) => {
                  setTempSearch(v);
                  resetDisplayLimit();
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
                  resetDisplayLimit();
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
                  resetDisplayLimit();
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
            headers={PARTY_RATE_HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            onSort={toggleSort}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            showSelection
            allowCopy
            getRowId={partyRateRowKey}
            selectedId={selected}
            onSelect={setSelected}
            emptyIcon={IndianRupee}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={PARTY_RATE_CARD_CONFIG}
          />
        </div>

        <MasterListFooter shown={items.length} total={totalItems} noun="customer rates" />
      </div>

      <GlobalDetailModal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Rate Master Details" icon={IndianRupee}>
        {selectedRecord ? (
          <MasterDetailBody>
            <MasterDetailHero eyebrow="Customer rate" icon={IndianRupee} title={selectedRecord.acc_name} />
            <MasterDetailSection label="Item code" tone="white"><span>{selectedRecord.item_code || "—"}</span></MasterDetailSection>
            {selectedRecord.itemdesc ? (
              <MasterDetailProse label="Item description" tone="slate">{selectedRecord.itemdesc}</MasterDetailProse>
            ) : null}
            <MasterDetailStatusRow label="Approval status">
              <span className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-tighter ${
                selectedRecord.itapv === "Approved"
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : "bg-amber-50 text-amber-600 border-amber-200"
              }`}>
                {selectedRecord.itapv ?? "—"}
              </span>
            </MasterDetailStatusRow>
            <MasterDetailProse label="Narration / remarks" tone="slate">
              {selectedRecord.narr1?.trim() ? selectedRecord.narr1 : "No remarks available for this record."}
            </MasterDetailProse>
          </MasterDetailBody>
        ) : null}
      </GlobalDetailModal>
    </div>
  );
}
