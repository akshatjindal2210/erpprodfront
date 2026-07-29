"use client";

import { useState, useCallback } from "react";
import { Package, Eye } from "lucide-react";
import { masterService } from "@/apps/ims/lib/services/master";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ActionButton from "@/ui/primitives/ActionButton";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ListPageSearchField from "@/ui/common/list/ListPageSearchField";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection, MasterDetailGrid, MasterDetailMetrics } from "./MasterDetailLayout";
import { useMasterClientList } from "@/apps/ims/lib/helpers/useMasterClientList";
import { MasterSelectionBanner, MasterListFooter, MasterRefreshButton } from "@/apps/ims/lib/helpers/masterListUi";
import { PRODUCT_MASTER_HEADERS, PRODUCT_CARD_CONFIG, productRowKey, productSearchParts } from "./masterColumns";

export default function ProductMasterPage() {
  const [viewMode, handleViewMode] = useViewMode();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    const body = await masterService.getItems();
    return body.data ?? [];
  }, []);

  const {
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
    errorMessage: "Failed to load items",
    getSearchParts: productSearchParts,
    getRowKey: productRowKey,
  });

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Product Master",
    rows: filteredData,
    headers: PRODUCT_MASTER_HEADERS,
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
              Selected Product: {selectedRecord?.item_code} | {selectedRecord?.itemdesc}
            </MasterSelectionBanner>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip className="space-y-2">
          <ListPageSearchField
            label="Product search"
            placeholder="Item Code, Prim item, description, group"
            value={tempSearch}
            onChange={(v) => {
              setTempSearch(v);
              resetDisplayLimit();
            }}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={PRODUCT_MASTER_HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            showSelection
            allowCopy
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={toggleSort}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={productRowKey}
            emptyIcon={Package}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={PRODUCT_CARD_CONFIG}
          />
        </div>

        <MasterListFooter shown={items.length} total={totalItems} noun="products" />
      </div>

      <GlobalDetailModal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Product Master Details" icon={Package}>
        {selectedRecord ? (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow="Product master"
              icon={Package}
              title={selectedRecord.itemdesc}
              badge={selectedRecord.item_code ? `Item code: ${selectedRecord.item_code}` : null}
            />
            <MasterDetailGrid columns={2}>
              <MasterDetailSection label="Group name" tone="white"><span>{selectedRecord.grpname || "N/A"}</span></MasterDetailSection>
              <MasterDetailSection label="Primary item code" tone="white"><span className="font-mono">{selectedRecord.primitem_code || "—"}</span></MasterDetailSection>
              <MasterDetailSection label="Primary item description" tone="white"><span>{selectedRecord.primitemdesc || "—"}</span></MasterDetailSection>
              <MasterDetailSection label="Weight" tone="white"><span className="tabular-nums">{selectedRecord.weight != null && selectedRecord.weight !== "" ? Number(selectedRecord.weight) : "—"}</span></MasterDetailSection>
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
        ) : null}
      </GlobalDetailModal>
    </div>
  );
}
