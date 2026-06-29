"use client";

import { useState, useCallback } from "react";
import { UserCheck } from "lucide-react";
import { masterService } from "@/features/apps/ims/services/master";
import { useViewMode } from "@/core/hooks/useViewMode";
import DataTable from "@/core/components/ui/DataTable";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import GlobalDetailModal from "@/core/components/common/GlobalDetailModal";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ListPageSearchField from "@/core/components/common/ListPageSearchField";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection } from "./MasterDetailLayout";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import { useMasterClientList } from "@/features/apps/ims/helpers/useMasterClientList";
import { MasterSelectionBanner, MasterListFooter, MasterRefreshButton } from "@/features/apps/ims/helpers/masterListUi";
import { CUSTOMER_MASTER_HEADERS, CUSTOMER_CARD_CONFIG, customerRowKey, customerSearchParts } from "./masterColumns";

export default function CustomerLedgerPage() {
  const [viewMode, handleViewMode] = useViewMode();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    const body = await masterService.getLedgers();
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
    errorMessage: "Failed to load customers",
    getSearchParts: customerSearchParts,
    getRowKey: customerRowKey,
  });

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Customer Master",
    rows: filteredData,
    headers: CUSTOMER_MASTER_HEADERS,
  });

  return (
    <div className={`${IMS_LIST_PAGE_SHELL} font-sans`}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={<MasterRefreshButton loading={loading} onClick={() => reload(true)} />}
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
              Customer: {selectedRecord?.acc_name} selected
            </MasterSelectionBanner>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip className="space-y-2">
          <ListPageSearchField
            label="Customer search"
            placeholder="Customer Name"
            value={tempSearch}
            onChange={(v) => {
              setTempSearch(v);
              resetDisplayLimit();
            }}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={CUSTOMER_MASTER_HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            onSort={toggleSort}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            allowCopy={true}
            showSelection={false}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={customerRowKey}
            emptyIcon={UserCheck}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={CUSTOMER_CARD_CONFIG}
          />
        </div>

        <MasterListFooter shown={items.length} total={totalItems} noun="customers" />
      </div>

      <GlobalDetailModal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Customer Profile" icon={UserCheck}>
        {selectedRecord ? (
          <MasterDetailBody>
            <MasterDetailHero eyebrow="Customer ledger" icon={UserCheck} title={selectedRecord.acc_name} />
            <MasterDetailSection label="Account type" tone="white"><span>Customer</span></MasterDetailSection>
          </MasterDetailBody>
        ) : null}
      </GlobalDetailModal>
    </div>
  );
}
