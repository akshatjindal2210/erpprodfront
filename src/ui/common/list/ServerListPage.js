"use client";

import { useMemo } from "react";

import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
import { ListPageDetailGrid, ListPageToolbarBlock } from "@/ui/common/list/listPageToolbarBlock";
import { ListPageServerFooter, ListPageShell, ListPageTableArea } from "@/ui/common/list/listPageUi";
import { buildAllFieldHeaders } from "@/ui/common/list/buildAllFieldHeaders";
import { useServerList } from "@/ui/common/list/useServerList";
import { applyClientSearch } from "@/ui/common/list/clientListSearch";

/**
 * Reusable server-paginated list page (IMS-style).
 * Pass toolbarActions / detailModal / children for future add-edit modules.
 * clientQuickSearch: type-to-filter loaded rows in the browser; date/extras still hit API on Search.
 */
export default function ServerListPage({
  emptyIcon: EmptyIcon,
  fetchList,
  headers: fixedHeaders,
  headerConfig,
  getRowId,
  pageSize = 100,
  searchPlaceholder = "Code, name, status...",
  defaultToday = true,
  clientQuickSearch = false,
  applyExtrasOnChange = false,
  toolbarActions,
  selectionLabel,
  extraFilters = [],
  extraFilterKeys,
  moreFilters = [],
  detailModal,
  children,
}) {
  const resolvedExtraKeys = extraFilterKeys ?? (Array.isArray(extraFilters) ? extraFilters.map((f) => f.key).filter(Boolean) : []);
  const moreKeys = Array.isArray(moreFilters) ? moreFilters.map((f) => f.key).filter(Boolean) : [];
  const allFilterKeys = [...resolvedExtraKeys, ...moreKeys.filter((k) => !resolvedExtraKeys.includes(k))];

  const {
    loading,
    rows,
    total,
    page,
    setPage,
    tempSearch,
    setTempSearch,
    params,
    setParams,
    selected,
    setSelected,
    selectedRecord,
    load,
    applyFilters,
    resetFilters,
  } = useServerList({
    fetchList,
    getRowId,
    pageSize,
    defaultToday,
    extraFilterKeys: allFilterKeys,
    clientQuickSearch,
  });

  const filterDefs = typeof extraFilters === "function" ? extraFilters(params) : extraFilters;
  const moreFilterDefs = typeof moreFilters === "function" ? moreFilters(params) : moreFilters;

  const displayRows = useMemo(() => {
    if (!clientQuickSearch) return rows;
    return applyClientSearch(rows, tempSearch, { skipSort: true });
  }, [clientQuickSearch, rows, tempSearch]);

  const headers = useMemo(() => {
    if (fixedHeaders?.length) return fixedHeaders;
    return buildAllFieldHeaders(displayRows, headerConfig ?? {});
  }, [fixedHeaders, displayRows, headerConfig]);

  const showSelection = !!(toolbarActions || detailModal);
  const listApi = {
    selected,
    selectedRecord,
    setSelected,
    reload: load,
    loading,
    rows: displayRows,
    total,
    page,
  };
  const extraActions = typeof toolbarActions === "function"
    ? toolbarActions(listApi)
    : toolbarActions;

  const quickActive = clientQuickSearch && Boolean(String(tempSearch || "").trim());
  const bindFilterValues = (defs = []) =>
    (defs || []).map((filter) => ({
      ...filter,
      value: filter.value ?? params[filter.key] ?? "",
    }));

  return (
    <ListPageShell>
      <ListPageToolbarBlock
        actions={extraActions}
        loading={loading}
        onRefresh={load}
        selected={selected}
        selectedRecord={selectedRecord}
        selectionLabel={selectionLabel}
        onClearSelection={() => setSelected(null)}
      />

      <ListPageFilterStrip>
        <DateRangeFilter
          fromDate={params.fromDate}
          toDate={params.toDate}
          extraFilters={bindFilterValues(filterDefs)}
          moreFilters={bindFilterValues(moreFilterDefs)}
          applyExtrasOnChange={applyExtrasOnChange}
          onApply={(data) => {
            setParams((prev) => {
              const next = {
                ...prev,
                fromDate: data.fromDate ?? prev.fromDate,
                toDate: data.toDate ?? prev.toDate,
              };
              allFilterKeys.forEach((key) => {
                if (key in data) next[key] = data[key] ?? "";
              });
              return next;
            });
            applyFilters();
          }}
          onReset={resetFilters}
          searchValue={tempSearch}
          onSearchChange={setTempSearch}
          searchPlaceholder={searchPlaceholder}
          searchLabel={clientQuickSearch ? "Quick Search" : "Search Database"}
          searchVariant={clientQuickSearch ? "quick" : "server"}
          applyOnSearchEnter={!clientQuickSearch}
        />
      </ListPageFilterStrip>

      <ListPageTableArea>
        <DataTable
          headers={headers}
          data={displayRows}
          loading={loading}
          viewMode="table"
          showSelection={showSelection}
          allowCopy
          selectedId={selected}
          onSelect={setSelected}
          emptyIcon={EmptyIcon}
          getRowId={getRowId}
          totalItems={quickActive ? displayRows.length : total}
        />
      </ListPageTableArea>

      <ListPageServerFooter
        shown={displayRows.length}
        total={quickActive ? displayRows.length : total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />

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
