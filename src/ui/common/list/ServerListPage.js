"use client";

import { useCallback, useEffect, useMemo } from "react";

import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageDetailGrid, ListPageExportViewToggle, ListPageToolbarBlock } from "@/ui/common/list/listPageToolbarBlock";
import { ListPageServerFooter, ListPageShell, ListPageTableArea } from "@/ui/common/list/listPageUi";
import { buildAllFieldHeaders } from "@/ui/common/list/buildAllFieldHeaders";
import { useServerList } from "@/ui/common/list/useServerList";
import { applyClientSearch } from "@/ui/common/list/clientListSearch";

function isBlankFilterValue(value) {
  if (value == null) return true;
  const s = String(value).trim();
  return !s || s.toLowerCase() === "all";
}

/** Match a client (quick) filter against a loaded row — IMS-style. */
function rowMatchesClientFilter(row, key, value) {
  if (isBlankFilterValue(value)) return true;
  const want = String(value).trim();
  const wantLower = want.toLowerCase();

  if (key === "approval_status" || key === "approval") {
    const status = String(row?.approval_status ?? "").trim().toLowerCase();
    if (wantLower === "unapproved" || wantLower === "pending") {
      return !status || status === "unapproved" || status === "pending";
    }
    return status === wantLower;
  }

  if (key === "shift") {
    return String(row?.shift ?? "").trim().toUpperCase() === want.toUpperCase();
  }

  const cell = row?.[key];
  return String(cell ?? "").trim().toLowerCase() === wantLower;
}

/**
 * Reusable server-paginated list page (IMS-style).
 *
 * Filter colors / behavior (IMS):
 * - `variant: "quick"`  → indigo — filters loaded rows in the browser
 * - `variant: "server"` → white  — sent to API (default for extras)
 * - Quick Search (`clientQuickSearch`) → indigo — client text filter
 * - Date range → always server (white)
 */
export default function ServerListPage({
  emptyIcon: EmptyIcon,
  fetchList,
  headers: fixedHeaders,
  headerConfig,
  getRowId,
  pageSize = 100,
  moduleName,
  cardConfig,
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
  /** Spread onto DataTable (e.g. `{ hotkeysDisabled }` from useListDrawerHotkeys). */
  tableHotkeyProps,
  /** Notify parent when row selection changes (for list hotkeys). */
  onSelectionChange,
}) {
  const allFilterKeys = useMemo(() => {
    const resolvedExtraKeys =
      extraFilterKeys ?? (Array.isArray(extraFilters) ? extraFilters.map((f) => f.key).filter(Boolean) : []);
    const moreKeys = Array.isArray(moreFilters) ? moreFilters.map((f) => f.key).filter(Boolean) : [];
    return [...resolvedExtraKeys, ...moreKeys.filter((k) => !resolvedExtraKeys.includes(k))];
  }, [extraFilterKeys, extraFilters, moreFilters]);

  const clientFilterKeys = useMemo(() => {
    const fromArr = (defs) =>
      Array.isArray(defs) ? defs.filter((f) => f?.variant === "quick" && f?.key).map((f) => f.key) : [];
    return [...new Set([...fromArr(extraFilters), ...fromArr(moreFilters)])];
  }, [extraFilters, moreFilters]);

  const serverFilterKeys = useMemo(
    () => allFilterKeys.filter((k) => !clientFilterKeys.includes(k)),
    [allFilterKeys, clientFilterKeys]
  );

  const [viewMode, handleViewMode] = useViewMode();

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
    load,
    applyFilters,
    resetFilters,
  } = useServerList({
    fetchList,
    getRowId,
    pageSize,
    defaultToday,
    extraFilterKeys: allFilterKeys,
    serverExtraFilterKeys: serverFilterKeys,
    clientQuickSearch,
  });

  const resolvedFilterDefs = typeof extraFilters === "function" ? extraFilters(params) : extraFilters;
  const resolvedMoreFilterDefs = typeof moreFilters === "function" ? moreFilters(params) : moreFilters;

  const displayRows = useMemo(() => {
    let next = rows;
    if (clientQuickSearch) {
      next = applyClientSearch(next, tempSearch, { skipSort: true });
    }
    clientFilterKeys.forEach((key) => {
      const value = params[key];
      if (isBlankFilterValue(value)) return;
      next = next.filter((row) => rowMatchesClientFilter(row, key, value));
    });
    return next;
  }, [rows, tempSearch, clientQuickSearch, clientFilterKeys, params]);

  const selectedRecord = useMemo(() => {
    if (selected == null) return null;
    const match = (row) => String(getRowId ? getRowId(row) : row.id) === String(selected);
    return displayRows.find(match) ?? rows.find(match) ?? null;
  }, [displayRows, rows, selected, getRowId]);

  useEffect(() => {
    onSelectionChange?.(selected, selectedRecord ?? null);
  }, [selected, selectedRecord, onSelectionChange]);

  const headers = useMemo(() => {
    if (fixedHeaders?.length) return fixedHeaders;
    return buildAllFieldHeaders(displayRows, headerConfig ?? {});
  }, [fixedHeaders, displayRows, headerConfig]);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: moduleName || "Export",
    rows: displayRows,
    headers,
  });

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
    params,
  };
  const extraActions = typeof toolbarActions === "function"
    ? toolbarActions(listApi)
    : toolbarActions;

  const clientFilterActive = clientFilterKeys.some((key) => !isBlankFilterValue(params[key]));
  const quickActive =
    (clientQuickSearch && Boolean(String(tempSearch || "").trim())) || clientFilterActive;

  const bindFilterValues = useCallback(
    (defs = []) =>
      (defs || []).map((filter) => ({
        ...filter,
        // Explicit variant wins; otherwise API extras = server (white)
        variant: filter.variant === "quick" || filter.variant === "server" ? filter.variant : "server",
        value: filter.value ?? params[filter.key] ?? "",
      })),
    [params]
  );

  const handleApply = useCallback(
    (data) => {
      const prev = params;
      const next = {
        ...prev,
        fromDate: data.fromDate ?? prev.fromDate,
        toDate: data.toDate ?? prev.toDate,
      };
      allFilterKeys.forEach((key) => {
        if (key in data) next[key] = data[key] ?? "";
      });
      setParams(next);

      const dateChanged =
        String(next.fromDate || "") !== String(prev.fromDate || "") ||
        String(next.toDate || "") !== String(prev.toDate || "");
      const serverChanged = serverFilterKeys.some(
        (key) => String(next[key] ?? "") !== String(prev[key] ?? "")
      );
      // Client-only filter changes stay in-browser; server/date changes reload API
      if (dateChanged || serverChanged || data.searchSubmit) {
        applyFilters();
      }
    },
    [params, allFilterKeys, serverFilterKeys, setParams, applyFilters]
  );

  return (
    <ListPageShell>
      <ListPageToolbarBlock
        actions={extraActions}
        loading={loading}
        onRefresh={load}
        viewToggle={
          moduleName ? (
            <ListPageExportViewToggle
              viewMode={viewMode}
              setMode={handleViewMode}
              exporting={exporting}
              disabled={loading || exportDisabled}
              onExport={handleExport}
            />
          ) : null
        }
        selected={selected}
        selectedRecord={selectedRecord}
        selectionLabel={selectionLabel}
        onClearSelection={() => setSelected(null)}
      />

      <ListPageFilterStrip>
        <DateRangeFilter
          fromDate={params.fromDate}
          toDate={params.toDate}
          extraFilters={bindFilterValues(resolvedFilterDefs)}
          moreFilters={bindFilterValues(resolvedMoreFilterDefs)}
          applyExtrasOnChange={applyExtrasOnChange}
          onApply={handleApply}
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
          viewMode={viewMode}
          showSelection={showSelection}
          allowCopy
          selectedId={selected}
          onSelect={setSelected}
          emptyIcon={EmptyIcon}
          getRowId={getRowId}
          totalItems={quickActive ? displayRows.length : total}
          cardConfig={cardConfig}
          {...(tableHotkeyProps || {})}
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
