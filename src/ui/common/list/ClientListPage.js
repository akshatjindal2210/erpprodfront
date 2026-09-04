"use client";

import DataTable from "@/ui/primitives/DataTable";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ListPageSearchField from "@/ui/common/list/ListPageSearchField";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useClientList } from "@/ui/common/list/useClientList";
import { ListPageDetailGrid, ListPageExportViewToggle, ListPageToolbarBlock } from "@/ui/common/list/listPageToolbarBlock";
import { ListPageFooter, ListPageShell, ListPageTableArea } from "@/ui/common/list/listPageUi";

/**
 * Reusable client-side list page (IMS-style shell).
 * toolbarActions receives { selected, selectedRecord, setSelected, reload, loading, rows }.
 * Pass children for add/edit modals or drawers.
 */
export default function ClientListPage({
  emptyIcon: EmptyIcon,
  headers,
  loadData,
  getRowId,
  getSearchParts,
  initialSort,
  moduleName = "Export",
  noun = "Records",
  searchPlaceholder = "Search...",
  pageSize,
  toolbarActions,
  selectionLabel,
  detailModal,
  children,
}) {
  const [viewMode, handleViewMode] = useViewMode();

  const {
    loading, reload, tempSearch, setTempSearch, params, selected, setSelected,
    selectedRecord, filteredData, items, totalItems, handleLoadMore, toggleSort, resetDisplayLimit,
  } = useClientList({
    loadData,
    getSearchParts,
    getRowKey: getRowId,
    initialSort,
    pageSize,
  });

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName,
    rows: filteredData,
    headers,
  });

  const listApi = {
    selected,
    selectedRecord,
    setSelected,
    reload: () => reload(true),
    loading,
    rows: filteredData,
    total: totalItems,
  };
  const extraActions = typeof toolbarActions === "function"
    ? toolbarActions(listApi)
    : toolbarActions;

  return (
    <ListPageShell>
      <ListPageToolbarBlock
        actions={extraActions}
        loading={loading}
        onRefresh={() => reload(true)}
        viewToggle={
          <ListPageExportViewToggle
            viewMode={viewMode}
            setMode={handleViewMode}
            exporting={exporting}
            disabled={loading || exportDisabled}
            onExport={handleExport}
          />
        }
        selected={selected}
        selectedRecord={selectedRecord}
        selectionLabel={selectionLabel}
        onClearSelection={() => setSelected(null)}
      />

      <ListPageFilterStrip>
        <ListPageSearchField
          label="Search Database"
          placeholder={searchPlaceholder}
          value={tempSearch}
          onChange={(v) => { setTempSearch(v); resetDisplayLimit(); }}
          variant="quick"
        />
      </ListPageFilterStrip>

      <ListPageTableArea>
        <DataTable
          headers={headers}
          data={items}
          loading={loading}
          viewMode={viewMode}
          showSelection={!!detailModal || !!toolbarActions}
          allowCopy
          sortKey={params.sortKey}
          sortDir={params.sortDir}
          onSort={toggleSort}
          selectedId={selected}
          onSelect={setSelected}
          getRowId={getRowId}
          emptyIcon={EmptyIcon}
          onLoadMore={handleLoadMore}
          hasMore={items.length < totalItems}
          totalItems={totalItems}
        />
      </ListPageTableArea>

      <ListPageFooter shown={items.length} total={totalItems} noun={noun} />

      {detailModal?.open ? (
        <GlobalDetailModal
          open={detailModal.open}
          onClose={detailModal.onClose}
          title={detailModal.title}
          icon={detailModal.icon}
        >
          {detailModal.renderBody && selectedRecord ? detailModal.renderBody(selectedRecord) : null}
          {!detailModal.renderBody && selectedRecord && detailModal.fields?.length ? (
            <ListPageDetailGrid record={selectedRecord} fields={detailModal.fields} />
          ) : null}
        </GlobalDetailModal>
      ) : null}

      {children}
    </ListPageShell>
  );
}
