"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, X, ShieldX, Database, ClipboardList, LogOut } from "lucide-react";
import { toast } from "react-toastify";

import { qcRejectionService } from "@/apps/rmstore/lib/services/qcRejection";
import { uniqueBillNos, parseSavedBillNos, formatBillNosForSave, fetchBillOptions, getBillByNo } from "@/apps/rmstore/lib/utils/rejectionBillOptions";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import GenerateStoreOutDrawer from "@/apps/rmstore/modules/qc-rejection/GenerateStoreOutDrawer";
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

const MODULE = "rm_qc_rejection";
const PAGE_TABS = { REGISTER: "register", PENDING: "pending" };

function rowKey(row) {
  if (row?.is_virtual_pending || row?.qc_reject_uid == null) {
    return `pending-${row?.qc_check_uid}`;
  }
  return String(row.qc_reject_uid);
}

function isApproved(row) {
  return row?.approved === true || row?.approved === "t" || row?.approved === 1;
}

export default function QcRejectionPage() {
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

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } =
    useAppliedListSearch();
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
      sortKey: tab === PAGE_TABS.PENDING ? "qc_check_uid" : "qc_reject_uid",
      sortDir: "desc",
    }));
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const listStatus = isPendingTab ? "pending" : params.status === "pending" ? "all" : params.status;
      const base = {
        filters: {
          ...(!isPendingTab && params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(!isPendingTab && params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          status: listStatus,
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await qcRejectionService.getAll({
          ...base,
          page,
          limit,
          ...(appliedSearch && { search: appliedSearch }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the QC rejections. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, appliedSearch, isPendingTab]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(allRows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const selectedRecord = useMemo(
    () => filteredRows.find((r) => rowKey(r) === selected) || null,
    [filteredRows, selected]
  );

  const canGenerateStoreOut =
    isPendingTab && selectedRecord?.is_virtual_pending && selectedRecord?.qc_check_uid != null;

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
      const res = await qcRejectionService.updateBill(id, payload);
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
      [
        "QC #",
        "qc_check_uid",
        (v) => <span className="font-bold text-sky-700 text-[10px]">{v != null ? v : "—"}</span>,
        { fixed: true, width: "80px" },
      ],
      [
        "Coil UID",
        "coil_no_uid",
        (v) => <span className="font-mono text-[10px] font-bold text-slate-800">{v || "—"}</span>,
        { width: "160px" },
      ],
      ["MRN", "mrn_no", (v) => <span className="font-bold text-slate-800 text-[10px]">{v ?? "—"}</span>, { width: "90px" }],
      [
        "Heat No.",
        "heat_no",
        (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>,
        { width: "120px" },
      ],
      ["Item", "item_code", (v) => <span className="text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "140px" }],
      [
        "Qty",
        "qty",
        (v) => (
          <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
            {v != null ? Number(v).toLocaleString() : "0"}
          </span>
        ),
        { width: "90px" },
      ],
      [
        "Failure Reason",
        "failure_reason",
        (v, row) => (
          <span className="text-rose-700 text-[10px] truncate block">{v || row?.reason || "—"}</span>
        ),
        { width: "220px" },
      ],
      [
        "Inspected By",
        "inspected_by_name",
        (v, row) => <span className="text-[10px] text-slate-500">{v || row?.inspected_by || "—"}</span>,
        { width: "110px" },
      ],
      [
        "Inspected At",
        "inspected_at",
        (v) => <span className="text-[10px] text-slate-400">{v ? formatDateTime(v) : "—"}</span>,
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
    moduleName: isPendingTab ? "RM QC Rejection Pending" : "RM QC Rejection Register",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(() => {
    if (isPendingTab) return [];
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
  }, [isPendingTab, params.status]);

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
                    : `QC Check #${selectedRecord.qc_check_uid}`}
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
            onApply={(data) => {
              applySearchFromInput();
              setParams((prev) => ({
                ...prev,
                fromDate: data.fromDate,
                toDate: data.toDate,
                ...(!isPendingTab && { status: data.approvedStatus || prev.status }),
              }));
            }}
            onReset={() => {
              resetSearch();
              setParams({
                pageSize: 500,
                status: isPendingTab ? "pending" : "all",
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
                ? { titleKey: "coil_no_uid", badgeIndices: [6], detailIndices: [2, 3, 4], footerKey: "inspected_at" }
                : { titleKey: "qc_reject_uid", badgeIndices: [9], detailIndices: [1, 2, 4], footerKey: "created_at" }
            }
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems}
          </span>
        </div>
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
