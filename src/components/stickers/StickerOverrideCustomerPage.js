"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, ScanLine, RefreshCcw, ShieldCheck, X, FileText } from "lucide-react";
import { toast } from "react-toastify";
import { boxService } from "@/services/box";
import { useViewMode } from "@/hooks/useViewMode";
import { useCanAccess } from "@/hooks/useCanAccess";

// Components
import ActionButton from "@/components/ui/ActionButton";
import ViewToggle from "@/components/ui/ViewToggle";
import DataTable from "@/components/ui/DataTable";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/components/common/ListPageFilterStrip";
import StickerOverrideModal from "@/components/stickers/StickerOverrideModal";

import { formatDateTime } from "@/helpers/utilHelper";
import dayjs from "dayjs";
import { useViewDateFilterDefaults } from "@/helpers/dateFilterDefaults";

import { STICKER_DOWNLOAD_SOURCE_KEYS } from "@/global";
import { useListDrawerHotkeys } from "@/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/helpers/clientListSearch";
import { printFromBackendHtml } from "@/utils/printHtmlDocument";

function overrideSearchParts(row) {
  const parts = [
    row?.packing_number,
    row?.itemdcode,
    row?.item_name,
    row?.from_customer,
    row?.to_customer,
    row?.from_customer_name,
    row?.to_customer_name,
    row?.requested_by_name,
    row?.approved_by_name,
    row?.remarks,
    row?.status,
    row?.request_id,
  ];
  if (Array.isArray(row?.box_no_uids)) {
    parts.push(...row.box_no_uids);
  }
  return parts.filter((p) => p != null && p !== "");
}

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? "mobile" : "desktop";
}

export default function StickerOverrideCustomerPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("change_override_customer", "view"), [canAccess]);

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "request_id",
    sortDir: "desc",
  });

  // Update params if dateFilterDefaults change
  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams(prev => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const [tempSearch, setTempSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [editItem, setEditItem] = useState(null);
  const [printing, setPrinting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey,
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { status: params.status }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await boxService.getOverrideRequests({ ...base, page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load override requests");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate, params.status]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) {
      return applyClientSearch(allRows, tempSearch, { getParts: overrideSearchParts });
    }
    return sortRowsByKey(allRows, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.approvedStatus || prev.status,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      pageSize: 1000,
      status: "all",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "request_id",
      sortDir: "desc",
    });
  };

  const statusFilters = useMemo(() => [
    { 
      label: "Status", key: "approvedStatus", value: params.status, 
      options: [
        { label: "All Status", value: "all" },
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ] 
    },
  ], [params.status]);

  const selectedRecord = useMemo(
    () => allRows.find((u) => u.request_id === selected),
    [allRows, selected]
  );
  const selectedStatus = useMemo(() => {
    if (!selectedRecord) return "pending";
    if (selectedRecord.status === "approved" || selectedRecord.approved === true) return "approved";
    if (selectedRecord.status === "rejected") return "rejected";
    return "pending";
  }, [selectedRecord]);

  const getSelectedRow = useCallback(
    () => allRows.find((u) => u.request_id === selected),
    [allRows, selected]
  );

  const handlePrintApproved = useCallback(async () => {
    if (!selectedRecord) return;
    if (selectedStatus !== "approved") {
      toast.info("Print is available only after request approval.");
      return;
    }

    const boxUids = Array.isArray(selectedRecord.box_uids)
      ? selectedRecord.box_uids.map((id) => Number(id)).filter((n) => Number.isFinite(n))
      : [];
    if (!boxUids.length) {
      toast.error("No boxes found in selected request.");
      return;
    }

    setPrinting(true);
    try {
      const res = await boxService.renderBulkStickers({
        packing_number: String(selectedRecord.packing_number || ""),
        box_uids: boxUids,
        device_type: getDeviceType(),
        download_source: STICKER_DOWNLOAD_SOURCE_KEYS.customer_override,
        sticker_meta: {
          itemdcode: selectedRecord.itemdcode || selectedRecord.item_name || "",
          acc_name: selectedRecord.to_customer_name || selectedRecord.to_customer || "",
        },
      });

      const ok = printFromBackendHtml(res?.html, { title: res?.print_title });
      if (!ok) {
        toast.error("Could not open print preview. Try again.");
      } else {
        toast.success("Print opened.");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to print stickers.");
    } finally {
      setPrinting(false);
    }
  }, [selectedRecord, selectedStatus]);

  const { openNewModal, openPrintModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "change_override_customer",
    modalOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    onPrint: useCallback(() => {
      handlePrintApproved();
    }, [handlePrintApproved]),
    canPrintSelection: useCallback(
      () => Boolean(selected) && selectedStatus === "approved" && !printing,
      [selected, selectedStatus, printing]
    ),
    onPrintBlocked: useCallback(() => {
      if (!selected) {
        toast.info("Select a row to print stickers (Ctrl+Alt+P).");
        return;
      }
      if (selectedStatus !== "approved") {
        toast.info("Print is available only after request approval.");
      }
    }, [selected, selectedStatus]),
    printModule: "change_override_customer",
    printAction: "view",
    openApprove: useCallback((row) => {
      setEditItem(row);
      setModalMode("approve");
      setModalOpen(true);
    }, []),
    canApproveSelection: useCallback(() => Boolean(selected && selectedRecord), [selected, selectedRecord]),
    onApproveBlocked: useCallback(() => {
      toast.info("Select a row to open approve (Ctrl+A).");
    }, []),
  });

  const HEADERS = [
    // ["#", "request_id", (v, row, i) => (params.page - 1) * params.pageSize + i + 1, { fixed: true, width: "50px", align: "center" }],
    ["Packing No", "packing_number", (v) => (
      <div className="flex items-center gap-2">
        <ScanLine size={12} className="text-indigo-500" />
        <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v}</span>
      </div>
    ), { fixed: true, width: "140px" }],

    [
      "Item Code",
      "itemdcode",
      (v, row) => (
        <span className="text-[10px] font-bold text-slate-600 uppercase max-w-[150px]">
          {row.item_name || "—"}
        </span>
      ),
      {
        width: "120px",
        copyValue: (row) => row.item_name || row.itemdcode || "—",
      },
    ],

    [ "Box No UIDs", "box_no_uids", (v) => (
        <div className="flex flex-wrap gap-1 max-w-[300px]">
          {v && Array.isArray(v) ? (
            v.map((code, idx) => (
              <span key={idx} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 text-[9px] font-mono">
                {code}
              </span>
            ))
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ), 
      { width: "250px", sortable: false }
    ],

    [
      "Transfer Flow",
      "from_customer",
      (v, row) => (
        <div
          className="flex items-center gap-2 text-[10px] py-1 select-text"
          title={`${row.from_customer_name || "—"} → ${row.to_customer_name || "—"}`}
        >
          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-medium">
            {row.from_customer_name || "—"}
          </span>
          <span className="text-indigo-400 font-bold" aria-hidden>
            →
          </span>
          <span className="px-1.5 py-0.5 bg-indigo-50 rounded text-indigo-700 font-bold">
            {row.to_customer_name || "—"}
          </span>
        </div>
      ),
      {
        width: "340px",
        copyValue: (row) => `${row.from_customer_name || "—"} → ${row.to_customer_name || "—"}`,
      },
    ],

    ["Status", "status", (v, row) => {
        const status =
          row?.status === "rejected" || row?.status === "approved" || row?.status === "pending"
            ? row.status
            : row?.approved === true
              ? "approved"
              : "pending";

        const colors = {
            approved: "bg-emerald-50 text-emerald-600 border-emerald-100",
            rejected: "bg-rose-50 text-rose-600 border-rose-100",
            pending: "bg-amber-50 text-amber-600 border-amber-100"
        };

        const labels = {
            approved: "Approved",
            pending: "Pending",
            rejected: "Rejected",
        };

        return (
            <span className={`px-2 py-0.5 rounded-full text-[9px] border font-black uppercase flex items-center gap-1 w-fit ${colors[status] || colors.pending}`}>
                <span className="text-[12px]">●</span> {labels[status] || labels.pending}
            </span>
        );
      },
      {
        width: "160px",
        copyValue: (row) => {
          const status =
            row?.status === "rejected" || row?.status === "approved" || row?.status === "pending"
              ? row.status
              : row?.approved === true
                ? "approved"
                : "pending";
          const labels = { approved: "Approved", pending: "Pending", rejected: "Rejected" };
          return labels[status] || labels.pending;
        },
      }
    ],

    ["Requested By", "requested_by_name", (v) => <span className="text-[10px] font-bold text-slate-500 uppercase">{v || "—"}</span>, { width: "130px" }],
    ["Requested At", "requested_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "140px" }],
    
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400">{v ? dayjs(v).format("DD/MM/YY hh:mm A") : "—"}</span>, { width: "130px" }],
    
    [
      "Remarks",
      "remarks",
      (v) => (
        <span
          className="block text-[10px] text-slate-500 line-clamp-4 whitespace-pre-wrap break-words min-w-0 max-w-full"
          title={v ? String(v) : ""}
        >
          {v || "—"}
        </span>
      ),
      { width: "220px", wrap: true },
    ],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* --- TOP ACTION BAR --- */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            <div className="flex items-center gap-2 flex-wrap">
              
              <ActionButton 
                module="change_override_customer" action="add" label="New Request" icon={Plus} 
                onClick={openNewModal} 
                className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" 
              />
              
              <ActionButton 
                module="change_override_customer" action="authorize" variant="outline" label="Approve" icon={ShieldCheck} 
                disabled={!selected} 
                // disabled={!selected || selectedRecord?.status !== "pending"} 
                onClick={() => { setEditItem(selectedRecord); setModalMode("approve"); setModalOpen(true); }} 
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none text-indigo-600" 
              />  

              <button
                type="button"
                onClick={openPrintModal}
                disabled={!selected || selectedStatus !== "approved" || printing}
                className="rounded-none h-9 px-4 border border-slate-300 bg-white text-[11px] font-bold uppercase shadow-none text-emerald-600 disabled:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                title={selectedStatus !== "approved" ? "Print available after approval" : "Print stickers (Ctrl+Alt+P / Ctrl+P in app)"}
              >
                {printing ? "Printing..." : "Print Stickers"}
              </button>

              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              
              <button onClick={fetchRequests} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                Selected Request: #{selectedRecord?.request_id} ({selectedRecord?.packing_number})
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear Selection
              </button>
            </div>
          )}
        </div>

        {/* --- FILTER BAR --- */}
        <ListPageFilterStrip>
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            extraFilters={statusFilters} 
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Type to filter — packing, item, box UID..."
            searchLabel="Quick Search"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        {/* --- DATA TABLE AREA --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              headers={HEADERS} data={items} loading={loading}
              getRowId={(item) => item.request_id}
              viewMode={viewMode} allowCopy={true} {...tableHotkeyProps} showSelection={true} skeletonCount={params.pageSize}
              emptyIcon={FileText} sortKey={params.sortKey} sortDir={params.sortDir}
              onSort={(key) => {
                setDisplayLimit(100);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              selectedId={selected} onSelect={setSelected}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{
                titleKey: "packing_number", badgeIndices: [4], detailIndices: [1, 2, 3], footerKey: "requested_at",
                className: "rounded-none border border-slate-200 shadow-none" 
              }}
            />
          </div>
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Override Requests
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <StickerOverrideModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditItem(null); }}
          onSuccess={() => { fetchRequests(); setSelected(null); }}
          editData={editItem}
          mode={modalMode}
        />
      )}
    </div>
  );
}