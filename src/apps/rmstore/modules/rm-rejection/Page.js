"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, X, ShieldX, Database, ClipboardList, LogOut } from "lucide-react";
import { toast } from "react-toastify";

import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";
import { uniqueBillNos, parseSavedBillNos, formatBillNosForSave, fetchBillOptions, getBillByNo } from "@/apps/rmstore/lib/utils/rejectionBillOptions";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import GenerateStoreOutDrawer from "@/apps/rmstore/modules/rm-rejection/GenerateStoreOutDrawer";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ActionButton from "@/ui/primitives/ActionButton";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { LIST_PAGE_SEARCH_LABEL_CLASS } from "@/ui/common/list/ListPageSearchField";
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";

const MODULE = "rm_rejection";
const PAGE_TABS = { REGISTER: "register", PENDING: "pending" };

const PENDING_SOURCE = {
  QC_CHECK: "qc_check",
  IN_PROCESS: "in_process",
};

const PENDING_TYPE_FILTER = {
  ALL: "all",
  QC_CHECK: "qc_check",
  IN_PROCESS: "in_process",
};

function rowPendingTypeKey(row) {
  if (row?.pending_source === PENDING_SOURCE.QC_CHECK) return PENDING_TYPE_FILTER.QC_CHECK;
  if (row?.pending_source === PENDING_SOURCE.IN_PROCESS) return PENDING_TYPE_FILTER.IN_PROCESS;
  return PENDING_TYPE_FILTER.ALL;
}

function pendingTypeDisplay(row) {
  if (row?.pending_source === PENDING_SOURCE.QC_CHECK) {
    return { label: "QC Check", className: "bg-sky-50 text-sky-700 border-sky-100" };
  }
  if (row?.pending_source === PENDING_SOURCE.IN_PROCESS) {
    return { label: "In-Process", className: "bg-violet-50 text-violet-700 border-violet-100" };
  }
  return { label: "—", className: "bg-slate-50 text-slate-400 border-slate-100" };
}

function pendingCoilUids(row) {
  const coils = Array.isArray(row?.coils) ? row.coils : [];
  const fromCoils = coils.map((c) => String(c?.coil_no_uid || "").trim()).filter(Boolean);
  if (fromCoils.length) return fromCoils;

  const raw = String(row?.coil_no_uid || "").trim();
  if (!raw) return [];
  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [raw];
}

function pendingCoilCount(row) {
  const uids = pendingCoilUids(row);
  return Math.max(Number(row?.coil_count) || 0, uids.length);
}

function pendingInspectorName(row) {
  return (
    row?.inspected_by_name ||
    row?.inspected_by ||
    row?.approved_by ||
    row?.created_by ||
    null
  );
}

function pendingInspectedAt(row) {
  return row?.inspected_at || row?.approved_at || row?.created_at || null;
}

function rowKey(row) {
  if (row?.pending_source === PENDING_SOURCE.IN_PROCESS && row?.ipr_uid != null) {
    return `ipr-${row.ipr_uid}`;
  }
  if (row?.pending_source === PENDING_SOURCE.QC_CHECK && row?.qc_check_uid != null) {
    return `qc-${row.qc_check_uid}`;
  }
  if (row?.is_virtual_pending || row?.qc_reject_uid == null) {
    return `pending-${row?.qc_check_uid ?? row?.ipr_uid ?? "x"}`;
  }
  return String(row.qc_reject_uid);
}

function isApproved(row) {
  return row?.approved === true || row?.approved === "t" || row?.approved === 1;
}

function inCreatedRange(row, fromDate, toDate) {
  const raw = row?.created_at;
  if (!raw) return true;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return true;
  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`).getTime();
    if (t < from) return false;
  }
  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`).getTime();
    if (t > to) return false;
  }
  return true;
}

export default function RmRejectionPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const canAddBill = useMemo(() => canAccess(MODULE, "add").allowed, [canAccess]);

  const [pageTab, setPageTab] = useState(PAGE_TABS.PENDING);
  const isPendingTab = pageTab === PAGE_TABS.PENDING;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 500,
    status: "pending",
    pendingType: PENDING_TYPE_FILTER.ALL,
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "qc_check_uid",
    sortDir: "desc",
  });

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams((prev) => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const { tempSearch, setTempSearch, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [storeOutDrawerOpen, setStoreOutDrawerOpen] = useState(false);
  const [billDraftNos, setBillDraftNos] = useState([]);
  const [billSaving, setBillSaving] = useState(false);

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setSelected(null);
    setDisplayLimit(100);
    resetSearch();
    setParams((prev) => ({
      ...prev,
      status: tab === PAGE_TABS.PENDING ? "pending" : "all",
      pendingType: PENDING_TYPE_FILTER.ALL,
      sortKey: tab === PAGE_TABS.PENDING ? "qc_check_uid" : "qc_reject_uid",
      sortDir: "desc",
    }));
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await rmRejectionService.getAll({
          filters: { status: isPendingTab ? "pending" : "all" },
          page,
          limit,
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the rejections. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, isPendingTab]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (isPendingTab) {
      if (params.pendingType !== PENDING_TYPE_FILTER.ALL) {
        data = data.filter((row) => rowPendingTypeKey(row) === params.pendingType);
      }
    } else {
      if (params.status === "approved") {
        data = data.filter((row) => isApproved(row));
      } else if (params.status === "unauthorized") {
        data = data.filter((row) => !isApproved(row));
      }
      data = data.filter((row) => inCreatedRange(row, params.fromDate, params.toDate));
    }
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [
    allRows,
    isPendingTab,
    params.pendingType,
    params.status,
    params.fromDate,
    params.toDate,
    tempSearch,
    params.sortKey,
    params.sortDir,
  ]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows,
      }),
    [tempSearch, allRows, filteredRows]
  );
  const selectedRecord = useMemo(
    () => filteredRows.find((r) => rowKey(r) === selected) || null,
    [filteredRows, selected]
  );

  const canGenerateStoreOut =
    isPendingTab &&
    selectedRecord?.is_virtual_pending &&
    (selectedRecord?.pending_source === PENDING_SOURCE.QC_CHECK ||
      selectedRecord?.pending_source === PENDING_SOURCE.IN_PROCESS);

  const canEditBill =
    !isPendingTab &&
    canAddBill &&
    selectedRecord?.qc_reject_uid != null &&
    isApproved(selectedRecord);

  useEffect(() => {
    if (selectedRecord?.qc_reject_uid != null) {
      setBillDraftNos(parseSavedBillNos(selectedRecord.bill_no));
    } else {
      setBillDraftNos([]);
    }
  }, [selectedRecord?.qc_reject_uid, selectedRecord?.bill_no]);

  const savedBillNo = useMemo(
    () => formatBillNosForSave(parseSavedBillNos(selectedRecord?.bill_no)) ?? "",
    [selectedRecord?.bill_no]
  );
  const billDraftFormatted = useMemo(
    () => formatBillNosForSave(billDraftNos) ?? "",
    [billDraftNos]
  );
  const billDirty = billDraftFormatted !== savedBillNo;

  const handleSaveBillNo = async () => {
    const id = selectedRecord?.qc_reject_uid;
    if (!id || !canEditBill) return;
    const payload = formatBillNosForSave(billDraftNos);
    setBillSaving(true);
    try {
      const res = await rmRejectionService.updateBill(id, payload);
      const saved = res?.data;
      setBillDraftNos(parseSavedBillNos(saved?.bill_no ?? payload));
      toast.success(res?.message || "Bill number saved successfully.");
      setAllRows((prev) =>
        prev.map((row) =>
          row.qc_reject_uid === id
            ? { ...row, bill_no: saved?.bill_no ?? payload }
            : row
        )
      );
      await fetchRows();
    } catch (err) {
      toast.error(err?.message || "Could not save the bill number. Please try again.");
    } finally {
      setBillSaving(false);
    }
  };

  const pendingHeaders = useMemo(
    () => [
      ["Ref #", "qc_check_uid", (v, row) => (
          <span className="font-bold text-sky-700 text-[10px]">
            {row?.ipr_uid != null ? `IPR-${row.ipr_uid}` : v != null ? `QC-${v}` : "—"}
          </span>
        ),
        { width: "90px" },
      ],
      ["Type", "pending_type", (_v, row) => {
          const t = pendingTypeDisplay(row);
          return (
            <span
              className={`inline-flex px-2 py-0.5 text-[9px] font-black uppercase rounded-full border ${t.className}`}
            >
              {t.label}
            </span>
          );
        },
        { fixed: true, width: "110px" },
      ],
      
      ["Coils", "coil_count", (_v, row) => (
          <span className="font-bold tabular-nums text-[11px] text-slate-800">
            {pendingCoilCount(row) || "—"}
          </span>
        ),
        { width: "60px" },
      ],
      ["Coil UID", "coil_no_uid", (_v, row) => {
          const uids = pendingCoilUids(row);
          const label = uids.join(", ");
          return (
            <span
              className="font-mono text-[10px] font-bold text-slate-800 truncate block"
              title={label || ""}
            >
              {label || "—"}
            </span>
          );
        },
        { width: "180px" },
      ],
      ["MRN", "mrn_no", (v, row) => <span className="font-bold text-slate-800 text-[10px]">{v ?? row?.mrn_refs ?? "—"}</span>, { width: "90px" }],
      ["Heat No.", "heat_no", (v, row) => (
          <span className="font-mono text-[10px] font-bold text-amber-700">{v || row?.heat_nos || "—"}</span>
        ),
        { width: "120px" },
      ],
      ["Item", "item_code", (v, row) => (
          <span className="text-slate-700 text-[10px] uppercase">{v || row?.item_codes || "—"}</span>
        ),
        { width: "140px" },
      ],
      ["Qty", "qty", (v, row) => (
          <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
            {Number(v ?? row?.total_qty ?? 0).toLocaleString()}
          </span>
        ),
        { width: "90px" },
      ],
      ["Failure Reason", "failure_reason", (v, row) => (
          <span className="text-rose-700 text-[10px] truncate block">{v || row?.reason || "—"}</span>
        ),
        { width: "220px" },
      ],
      ["Inspected By", "inspected_by_name", (_v, row) => (
          <span className="text-[10px] font-semibold text-slate-600 uppercase truncate block" title={pendingInspectorName(row) || ""}>
            {pendingInspectorName(row) || "—"}
          </span>
        ),
        { width: "120px" },
      ],
      ["Inspected At", "inspected_at", (_v, row) => {
          const at = pendingInspectedAt(row);
          return (
            <span className="text-[10px] text-slate-400 font-medium">
              {at ? formatDateTime(at) : "—"}
            </span>
          );
        },
        { width: "150px" },
      ],
    ],
    []
  );

  const registerHeaders = useMemo(
    () => [
      ["Reject UID", "qc_reject_uid", (v) => <span className="font-bold text-rose-600 text-[10px]">{v}</span>, { fixed: true, width: "100px" }],
      ["MRN Refs", "mrn_refs", (v) => <span className="font-bold text-slate-800 text-[10px]">{v || "—"}</span>, { width: "120px" }],
      ["Heat Nos.", "heat_nos", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "140px" }],
      ["Item Codes", "item_codes", (v) => <span className="text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "160px" }],
      ["Reason", "reason", (v) => <span className="text-rose-700 text-[10px] font-bold truncate block">{v || "—"}</span>, { width: "180px" }],
      ["Store Out", "out_uid", (v) => (
        <span className={`text-[10px] font-bold ${v ? "text-indigo-600" : "text-slate-400"}`}>
          {v != null ? `OUT-${v}` : "—"}
        </span>
      ), { width: "90px" }],
      ["Bill Number", "bill_no", (v) => (
        <span className={`text-[10px] font-bold uppercase ${v ? "text-slate-800" : "text-slate-400"}`}>
          {v || "—"}
        </span>
      ), { width: "140px" }],
      ["Total Qty", "total_qty", (v) => (
        <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
          {v != null ? Number(v).toLocaleString() : "0"}
        </span>
      ), { width: "100px" }],
      ["Coils", "coil_count", (v) => <span className="font-bold tabular-nums text-[11px]">{v ?? 0}</span>, { width: "70px" }],
      ["Status", "approved", (v) => (
        <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
          {v ? "Authorized" : "Pending"}
        </span>
      ), { width: "110px" }],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "150px" }],
    ],
    []
  );

  const headers = isPendingTab ? pendingHeaders : registerHeaders;

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isPendingTab ? "RM Rejection Pending" : "RM Rejection Register",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(() => {
    if (isPendingTab) {
      return [
        {
          label: "Type",
          key: "pendingType",
          value: params.pendingType,
          preserveOrder: true,
          options: [
            { label: "All", value: PENDING_TYPE_FILTER.ALL },
            { label: "QC Check", value: PENDING_TYPE_FILTER.QC_CHECK },
            { label: "In-Process", value: PENDING_TYPE_FILTER.IN_PROCESS },
          ],
        },
      ];
    }
    return [
      {
        label: "Status",
        key: "approvedStatus",
        value: params.status,
        options: [
          { label: "All", value: "all" },
          { label: "Authorized", value: "approved" },
          { label: "Pending", value: "unauthorized" },
        ],
      },
    ];
  }, [isPendingTab, params.pendingType, params.status]);

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                className="mr-2"
                active={pageTab}
                onChange={handleTabChange}
                tabs={[
                  { id: PAGE_TABS.REGISTER, label: "Register", icon: Database },
                  { id: PAGE_TABS.PENDING, label: "Pending", icon: ClipboardList },
                ]}
              />
            }
            actions={
              <>
                {isPendingTab && (
                  <ActionButton
                    module={MODULE}
                    action="add"
                    label="Generate Store Out"
                    icon={LogOut}
                    disabled={!canGenerateStoreOut}
                    onClick={() => setStoreOutDrawerOpen(true)}
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                  />
                )}
                <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={fetchRows}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all shrink-0"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </>
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
          {selectedRecord && (
            <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 space-y-2">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="text-[10px] font-bold text-rose-600 uppercase truncate">
                  Selected:{" "}
                  {selectedRecord.qc_reject_uid != null
                    ? `REJECT-${selectedRecord.qc_reject_uid}`
                    : selectedRecord.pending_source === PENDING_SOURCE.IN_PROCESS
                      ? `In-Process #${selectedRecord.ipr_uid}`
                      : selectedRecord.pending_source === PENDING_SOURCE.QC_CHECK
                        ? `QC Check #${selectedRecord.qc_check_uid}`
                        : "Pending"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-rose-400 hover:text-rose-600 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0"
                >
                  <X size={14} /> Clear
                </button>
              </div>

              {canEditBill ? (
                <div className="w-full min-w-0 space-y-1.5" data-compact-form-bar>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
                    <span className={`${LIST_PAGE_SEARCH_LABEL_CLASS} shrink-0 pt-1.5 sm:pt-2`}>Bill</span>
                    <div className="w-full min-w-0 flex-1" title="Search and select bill numbers">
                      <SearchableSelect
                        multiple
                        showTags
                        variant="toolbar"
                        heightClass="h-8"
                        value={billDraftNos}
                        onChange={(nos) => setBillDraftNos(uniqueBillNos(nos))}
                        fetchService={fetchBillOptions}
                        getByIdService={getBillByNo}
                        dataKey="bill_no"
                        labelKey="bill_no"
                        labelOnlyDisplay
                        placeholder="Select bill numbers"
                        emptyMessage="No bill numbers found"
                        usePortal
                        maxVisibleTags={3}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveBillNo()}
                      disabled={billSaving || !billDirty}
                      className="h-9 w-full sm:w-auto sm:shrink-0 px-3 border border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold uppercase disabled:opacity-50"
                    >
                      {billSaving ? "…" : "Save Bill"}
                    </button>
                  </div>
                </div>
              ) : !isPendingTab && selectedRecord?.bill_no ? (
                <p className="text-xs font-bold text-slate-700 uppercase break-all">
                  Bill {selectedRecord.bill_no}
                </p>
              ) : null}
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={!isPendingTab}
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={extraFilters}
            instantClientExtras={isPendingTab}
            applyExtrasOnChange={!isPendingTab}
            showSearchButton={false}
            applyOnSearchEnter={false}
            searchVariant="quick"
            onApply={(data) => {
              setSelected(null);
              setDisplayLimit(100);
              setParams((prev) => ({
                ...prev,
                fromDate: data.fromDate,
                toDate: data.toDate,
                ...(isPendingTab
                  ? { pendingType: data.pendingType || PENDING_TYPE_FILTER.ALL }
                  : { status: data.approvedStatus || prev.status }),
              }));
            }}
            onReset={() => {
              resetSearch();
              setSelected(null);
              setDisplayLimit(100);
              setParams({
                pageSize: 500,
                status: isPendingTab ? "pending" : "all",
                pendingType: PENDING_TYPE_FILTER.ALL,
                fromDate: dateFilterDefaults.from,
                toDate: dateFilterDefaults.to,
                sortKey: isPendingTab ? "qc_check_uid" : "qc_reject_uid",
                sortDir: "desc",
              });
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder={
              isPendingTab
                ? "Search by coil, MRN, heat, or reason"
                : "Search by MRN, heat, or reason"
            }
            searchLabel={isPendingTab ? "Search Pending" : "Search Register"}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={headers}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            showSelection
            emptyIcon={ShieldX}
            sortKey={params.sortKey ?? ""}
            sortDir={params.sortDir}
            onSort={(key) => {
              setDisplayLimit(100);
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }));
            }}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={(row) => rowKey(row)}
            onLoadMore={() => {
              if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={
              isPendingTab
                ? {
                    titleKey: "coil_no_uid",
                    badgeIndices: [1],
                    detailKeys: ["coil_count", "coil_no_uid", "mrn_no", "failure_reason"],
                    footerKey: "inspected_at",
                  }
                : { titleKey: "qc_reject_uid", badgeIndices: [9], detailIndices: [1, 2, 4], footerKey: "created_at" }
            }
          />
        </div>

        <RmStoreListFooter
          shown={items.length}
          total={totalItems}
          label={isPendingTab ? "Pending Rejections" : "Register Entries"}
          {...footerFilter}
        />
      </div>

      <GenerateStoreOutDrawer
        open={storeOutDrawerOpen}
        onClose={() => setStoreOutDrawerOpen(false)}
        row={selectedRecord}
        onSuccess={() => {
          setSelected(null);
          setStoreOutDrawerOpen(false);
          void fetchRows();
        }}
      />
    </div>
  );
}
