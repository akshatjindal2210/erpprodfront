"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ClipboardCheck, Trash2, Loader2, Plus, Eye, FileText } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime, formatDocDate } from "@/platform/utils/core/utilHelper";
import { mrnService } from "@/apps/rmstore/lib/services/mrn";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import ActionButton from "@/ui/primitives/ActionButton";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import GlobalDetailModal from "@/ui/common/modals/GlobalDetailModal";
import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { MasterSelectionBanner, MasterRefreshButton } from "@/apps/ims/lib/helpers/masterListUi";
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection, MasterDetailGrid, MasterDetailKV, MasterDetailProse } from "@/apps/ims/modules/master/MasterDetailLayout";
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";
import MrnStickerModal from "./MrnStickerModal";
import MrnStickerRemoveConfirmModal from "./MrnStickerRemoveConfirmModal";

const MODULE = "rm_mrn_portal";

function formatDay(v) {
  return formatDocDate(v) || "—";
}

function isMrnStickerGenerated(row) {
  return row?.sticker_generated === true || row?.status === "generated";
}

function resolveUploadUrl(noteOrPath) {
  const raw = String(noteOrPath || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) return raw;
  const p = raw.replace(/^\/+/, "");
  if (p.startsWith("uploads/")) return `${String(FILE_BASE_URL || "").replace(/\/$/, "")}/${p}`;
  return "";
}

function MrnDocPreviewRow({ label, path, name }) {
  const url = resolveUploadUrl(path);
  const display = name || (path ? String(path).split(/[/\\]/).pop() : "") || "—";
  if (!url && display === "—") {
    return <MasterDetailKV label={label} value="—" />;
  }
  return (
    <MasterDetailSection label={label} tone="white">
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={14} className="text-emerald-600 shrink-0" />
        {url ? (
          <FilePreviewLink
            href={url}
            fileName={display}
            className="text-sm font-medium text-indigo-700 truncate min-w-0 hover:underline cursor-pointer"
            title={`Open ${display}`}
          >
            {display}
          </FilePreviewLink>
        ) : (
          <span className="text-sm font-medium text-slate-800 truncate min-w-0">{display}</span>
        )}
      </div>
    </MasterDetailSection>
  );
}

function formatComparePlain(v, { date = false, qty = false } = {}) {
  if (v == null || v === "") return "—";
  if (date) return formatDocDate(v) || "—";
  if (qty) return parseFloat(v || 0).toLocaleString();
  return String(v);
}

function CompareImsDbLines({ imsText, dbText, mismatch = false }) {
  const rowClass = mismatch ? "rounded border border-rose-200 bg-rose-50 px-1 py-0.5" : "";
  const labelClass = mismatch ? "text-rose-500" : "text-slate-400";
  const textClass = mismatch ? "font-bold text-rose-700" : "font-semibold text-slate-700";
  return (
    <div className="space-y-1 text-[10px] leading-snug min-w-[120px]">
      <div className={`flex flex-wrap gap-x-1 ${rowClass}`}>
        <span className={`shrink-0 font-black uppercase text-[8px] ${labelClass}`}>ERP</span>
        <span className={`${textClass} break-words`}>{imsText}</span>
      </div>
      <div className={`flex flex-wrap gap-x-1 ${rowClass}`}>
        <span className={`shrink-0 font-black uppercase text-[8px] ${labelClass}`}>DB</span>
        <span className={`${textClass} break-words`}>{dbText}</span>
      </div>
    </div>
  );
}

function renderMrnCompareCell(row, field, { date = false, qty = false } = {}) {
  if (row?.comparison?.missing_ims || row?.ims_missing) {
    const dbVal = row?.local_source?.[field] ?? row?.[field];
    return (
      <CompareImsDbLines
        imsText="—"
        dbText={formatComparePlain(dbVal, { date, qty })}
        mismatch
      />
    );
  }
  if (row?.comparison?.missing_local) {
    return (
      <CompareImsDbLines
        imsText={formatComparePlain(row?.ims_source?.[field] ?? row?.[field], { date, qty })}
        dbText="—"
        mismatch
      />
    );
  }
  const cmp = row?.comparison?.fields?.[field];
  if (!cmp) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  return (
    <CompareImsDbLines
      imsText={formatComparePlain(cmp.ims, { date, qty })}
      dbText={formatComparePlain(cmp.local, { date, qty })}
      mismatch={Boolean(cmp.mismatch)}
    />
  );
}

const MRN_COMPARE_FIELD_LABELS = {
  mrn_dt: "Date",
  bill_no: "Bill",
  bill_dt: "Bill date",
  item_code: "Item",
  it_recp_qty: "Qty",
  it_lot_no: "Lot",
};

function renderMrnMismatchSummary(_v, row) {
  if (row?.comparison?.missing_ims || row?.ims_missing) {
    return <span className="text-[9px] font-bold uppercase text-rose-700">Not found in ERP</span>;
  }
  if (row?.comparison?.missing_local) {
    return <span className="text-[9px] font-bold uppercase text-rose-700">No local record</span>;
  }
  const fields = row?.comparison?.fields || {};
  const keys = Object.keys(fields).filter((k) => k !== "acc_code" && fields[k]?.mismatch);
  if (!keys.length) return <span className="text-[10px] text-slate-400">—</span>;
  return (
    <span className="text-[9px] font-bold uppercase text-rose-700 leading-snug">
      {keys.map((k) => MRN_COMPARE_FIELD_LABELS[k] || k).join(", ")}
    </span>
  );
}

function renderMrnQtyCell(v) {
  return (
    <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px]">
      {parseFloat(v || 0).toLocaleString()}
    </span>
  );
}

function renderMrnStickerStatus(v, row) {
  const generated = v === "generated";
  const draft = v === "draft" || row?.has_sticker_draft === true;
  if (generated) {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-emerald-50 text-emerald-600 border-emerald-100">
        ● GENERATED
      </span>
    );
  }
  if (draft) {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-sky-50 text-sky-700 border-sky-200">
        ● DRAFT
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-600 border-amber-100">
      ○ PENDING
    </span>
  );
}

export default function MrnPortalPage() {
  const canAccess = useCanAccess();
  const canNewSticker = useMemo(() => canAccess(MODULE, "add").allowed, [canAccess]);
  const canRemoveGeneratedStickers = useMemo(() => canAccess(MODULE, "delete").allowed, [canAccess]);
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [params, setParams] = useState({
    status: "pending",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "mrn_dt",
    sortDir: "desc",
  });
  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [removeStickersLoading, setRemoveStickersLoading] = useState(false);
  const [removeStickersConfirmOpen, setRemoveStickersConfirmOpen] = useState(false);
  const [stickerModalOpen, setStickerModalOpen] = useState(false);
  const [stickerMrnId, setStickerMrnId] = useState(null);
  const [stickerSourceRow, setStickerSourceRow] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    setParams((prev) => {
      if (prev.fromDate === dateFilterDefaults.from && prev.toDate === dateFilterDefaults.to) return prev;
      return { ...prev, fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to };
    });
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const fetchMrns = useCallback(async () => {
    setLoading(true);
    try {
      const body = await mrnService.getAll({
        page: 1,
        limit: 5000,
        search: "",
        filters: {
          status: params.status,
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
        },
      });
      setAllRows(body.data ?? []);
      setDisplayLimit(100);
      setSelected(null);
    } catch (err) {
      toast.error(err?.message || "Could not load the MRN list. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.status, params.fromDate, params.toDate]);

  useEffect(() => {
    fetchMrns();
  }, [fetchMrns]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(allRows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

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

  const selectedRecord = useMemo(() => {
    if (selected == null) return null;
    return filteredRows.find((r) => String(r.uid ?? r.id) === String(selected)) || null;
  }, [filteredRows, selected]);

  const openView = useCallback(() => {
    if (!selectedRecord) {
      toast.info("Select a row first to view details.");
      return;
    }
    setDetailOpen(true);
  }, [selectedRecord]);

  /** Open sticker drawer — DB write only happens on GENERATE (IMS-style). */
  const openNewSticker = useCallback(() => {
    if (!selectedRecord) {
      toast.info("Select a row in the list first. New Sticker opens only after a row is selected.");
      return;
    }

    if (isMrnStickerGenerated(selectedRecord)) {
      const uid = selectedRecord.uid;
      if (!uid) {
        toast.error("Could not open the stickers because the MRN ID is missing.");
        return;
      }
      setStickerMrnId(uid);
      setStickerSourceRow(selectedRecord);
    } else {
      setStickerMrnId(selectedRecord.uid || null);
      setStickerSourceRow(selectedRecord);
    }
    setStickerModalOpen(true);
  }, [selectedRecord]);

  const openRemoveConfirm = useCallback(() => setRemoveStickersConfirmOpen(true), []);

  const handleRemoveGeneratedStickers = async () => {
    if (!canRemoveGeneratedStickers) {
      toast.error("You do not have permission to remove stickers. Delete permission is required.");
      return;
    }
    if (!selectedRecord || !isMrnStickerGenerated(selectedRecord)) return;
    const uid = selectedRecord.uid;
    if (!uid) {
      toast.error("Could not cancel the stickers because the MRN ID is missing.");
      return;
    }

    setRemoveStickersLoading(true);
    try {
      const res = await mrnService.delete(uid);
      if (res?.success === false)
        throw new Error(res?.message || "Could not remove the stickers. Please try again.");
      toast.success(res?.message || "Stickers removed.");
      setRemoveStickersConfirmOpen(false);
      setSelected(null);
      await fetchMrns();
    } catch (err) {
      toast.error(
        err?.message || err?.payload?.message || "Could not remove the stickers. Please try again."
      );
    } finally {
      setRemoveStickersLoading(false);
    }
  };

  const isComparisonView = params.status === "comparison";

  const HEADERS = useMemo(
    () => {
      if (isComparisonView) {
        return [
          ["MRN UID", "uid", (v) => <span className="font-mono font-bold text-slate-700 text-[10px] uppercase">{v ?? "—"}</span>, { width: "100px", fixed: true }],
          // ["MRN No", "mrn_no", (v) => <span className="font-mono font-bold text-slate-700 text-[10px] uppercase">{v ?? "—"}</span>, { width: "100px", fixed: true }],
          ["Date", "mrn_dt", (_v, row) => renderMrnCompareCell(row, "mrn_dt", { date: true }), { width: "140px", wrap: true }],
          ["Lot No", "it_lot_no", (_v, row) => renderMrnCompareCell(row, "it_lot_no"), { width: "140px", wrap: true }],
          ["Quantity", "it_recp_qty", (_v, row) => renderMrnCompareCell(row, "it_recp_qty", { qty: true }), { width: "140px", wrap: true }],
          ["Item Code", "item_code", (_v, row) => renderMrnCompareCell(row, "item_code"), { width: "140px", wrap: true }],
          ["Item Description", "item_desc", (_v, row) => renderMrnCompareCell(row, "item_desc"), { width: "140px", wrap: true }],
          ["Vendor", "acc_name", (_v, row) => {
            const name = row?.ims_source?.acc_name ?? row?.acc_name;
            return (
              <span className="text-slate-800 font-bold text-[10px] uppercase whitespace-normal break-words leading-snug" title={name || ""}>
                {name || (row?.ims_missing ? "—" : "Unknown")}
              </span>
            );
          }, { width: "200px", wrap: true }],
          ["Bill No", "bill_no", (_v, row) => renderMrnCompareCell(row, "bill_no"), { width: "150px", wrap: true }],
          ["Bill Date", "bill_dt", (_v, row) => renderMrnCompareCell(row, "bill_dt", { date: true }), { width: "140px", wrap: true }],
          ["Mismatch", "has_comparison_mismatch", renderMrnMismatchSummary, { width: "130px", wrap: true }],
        ];
      }
      return [
      ["MRN UID", "uid", (v) => <span className="font-mono font-bold text-slate-700 text-[10px] uppercase">{v ?? "—"}</span>, { width: "100px", fixed: true }],
      // ["MRN No", "mrn_no", (v) => <span className="font-mono font-bold text-slate-700 text-[10px] uppercase">{v ?? "—"}</span>, { width: "100px", fixed: true }],
      ["Date", "mrn_dt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatDay(v)}</span>, { width: "100px" }],
      ["Lot No", "it_lot_no", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v || "—"}</span>, { width: "140px" }],
      ["Quantity", "it_recp_qty", renderMrnQtyCell, { width: "100px", cardRender: renderMrnQtyCell }],
      // ["Unit", "it_unit", (v) => <span className="text-[10px] font-bold text-slate-600 tabular-nums">{v ?? "—"}</span>, { width: "70px" }],
      ["Vendor", "acc_name", (v) => (
        <span className="text-slate-800 font-bold text-[10px] uppercase whitespace-normal break-words leading-snug" title={v || ""}>
          {v || "Unknown"}
        </span>
      ), { width: "220px", wrap: true }],
      ["Item Code", "item_code", (v) => (
        <span className="text-slate-700 font-bold text-[10px] uppercase truncate" title={v || ""}>{v || "—"}</span>
      ), { width: "180px" }],
      ["Item Description", "item_desc", (v) => (
        <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v || ""}>{v || "—"}</span>
      ), { width: "180px" }],
      ["Sticker Status", "status", renderMrnStickerStatus, { width: "150px" }],
      ["Bill No", "bill_no", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v || "—"}</span>, { width: "140px" }],
      ["Bill Date", "bill_dt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatDay(v)}</span>, { width: "100px" }],
      ["Created By", "userc", (v) => <span className="text-[10px] text-slate-500 uppercase font-bold">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "datec", (v) => <span className="text-[10px] text-slate-400 font-bold">{v ? formatDateTime(v) : "—"}</span>, { width: "150px" }],
      ["Generated By", "created_by_name", (v, row) => (
        <span className="text-[10px] text-slate-500 uppercase font-bold">
          {isMrnStickerGenerated(row) ? (v || "—") : "—"}
        </span>
      ), { width: "120px" }],
      ["Generated At", "created_at", (v, row) => (
        <span className="text-[10px] text-slate-400 font-bold">
          {isMrnStickerGenerated(row) && v ? formatDateTime(v) : "—"}
        </span>
      ), { width: "150px" }],
    ];
    },
    [isComparisonView]
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "MRN Portal",
    rows: filteredRows,
    headers: HEADERS,
  });

  const extraFilters = useMemo(
    () => [{
      label: "Sticker Status",
      key: "mrnStatus",
      value: params.status,
      options: [
        { label: "All Status", value: "all" },
        { label: "Pending", value: "pending" },
        { label: "Generated", value: "generated" },
        { label: "Comparison", value: "comparison" },
      ],
    }],
    [params.status]
  );

  const handleFilterApply = (data) => {
    setParams((p) => ({
      ...p,
      status: data.mrnStatus || p.status,
      fromDate: data.fromDate ?? p.fromDate,
      toDate: data.toDate ?? p.toDate,
    }));
  };

  const handleFilterReset = () => {
    setTempSearch("");
    setParams({
      status: "pending",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "mrn_dt",
      sortDir: "desc",
    });
  };

  return (
    <div className={`${IMS_LIST_PAGE_SHELL} font-sans`}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <div className="flex items-center gap-2">
                {canNewSticker ? (
                  <button
                    type="button"
                    disabled={!selected}
                    onClick={openNewSticker}
                    title="Select a row in the list first to open New Sticker."
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={16} strokeWidth={2} />
                    <span>New Sticker</span>
                  </button>
                ) : null}

                <ActionButton
                  variant="outline"
                  label="View Profile"
                  icon={Eye}
                  disabled={!selected}
                  onClick={openView}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none"
                />

                {canRemoveGeneratedStickers && selected && isMrnStickerGenerated(selectedRecord) ? (
                  <button
                    type="button"
                    onClick={openRemoveConfirm}
                    disabled={removeStickersLoading || loading}
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 flex items-center justify-center gap-2 shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Delete the coil stickers for this MRN. Coils that are already stored in prevent cancellation."
                  >
                    {removeStickersLoading ? (
                      <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
                    ) : (
                      <Trash2 size={14} className="shrink-0" aria-hidden />
                    )}
                    Cancel stickers
                  </button>
                ) : null}

                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
                <MasterRefreshButton loading={loading} onClick={() => fetchMrns()} />
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
          {selected && isComparisonView ? (
            <MasterSelectionBanner onClear={() => setSelected(null)}>
              Mismatch · MRN {selectedRecord?.mrn_no ?? "—"} · ERP data compared with the record saved in RM Store. Red indicates a mismatch.
            </MasterSelectionBanner>
          ) : selected ? (
            <MasterSelectionBanner onClear={() => setSelected(null)}>
              Selected MRN: {selectedRecord?.mrn_no ?? "—"} | {selectedRecord?.item_code || "—"} | Qty {selectedRecord?.it_recp_qty ?? "—"}
            </MasterSelectionBanner>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${params.fromDate}-${params.toDate}-${params.status}`}
            showDate
            fromDate={params.fromDate}
            toDate={params.toDate}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleFilterReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search by document, lot, or MRN"
            searchLabel="MRN Search"
            searchVariant="quick"
            showSearchButton
            applyOnSearchEnter
            applyExtrasOnChange={false}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            showSelection
            emptyIcon={ClipboardCheck}
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
            onRowDoubleClick={() => {
              if (selectedRecord) openNewSticker();
            }}
            getRowId={(row) => String(row.uid ?? row.id ?? "")}
            onLoadMore={() => {
              if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            emptyMessage={
              params.status === "pending"
                ? "No pending MRNs for this date range"
                : params.status === "comparison"
                  ? "No ERP and database mismatches for this date range"
                  : "No MRN records for this date range"
            }
            emptySubMessage={
              params.status === "comparison"
                ? "This view shows differences between live ERP MRN data and the record saved in RM Store when stickers were generated."
                : "Set the from and to dates and search, then select a row to view its profile or create a sticker."
            }
            cardConfig={{ titleKey: "mrn_no", badgeIndices: [7], detailIndices: [2, 3, 6], footerKey: "mrn_dt" }}
            getRowClassName={
              isComparisonView
                ? () => "bg-rose-50 group-hover:bg-rose-50 [&_td]:!bg-rose-50"
                : undefined
            }
          />
        </div>

        <RmStoreListFooter
          shown={items.length}
          total={totalItems}
          label="MRN Entries"
          {...footerFilter}
        />
      </div>

      <GlobalDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="MRN Details"
        icon={ClipboardCheck}
      >
        {selectedRecord ? (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow={isMrnStickerGenerated(selectedRecord) ? "Saved in RM Store" : "Pending from ERP"}
              icon={ClipboardCheck}
              title={selectedRecord.acc_name}
              badge={`MRN ${selectedRecord.mrn_no ?? "—"} · ${formatDay(selectedRecord.mrn_dt)}`}
            />

            {isMrnStickerGenerated(selectedRecord) ? (
              <MasterDetailProse label="About this record" tone="indigo">
                The values below were saved in RM Store when the coil stickers were generated. They are not live ERP MRN data.
              </MasterDetailProse>
            ) : null}

            <MasterDetailGrid columns={2}>
              <MasterDetailSection label="MRN no." tone="indigo">
                <span>{selectedRecord.mrn_no ?? "—"}</span>
              </MasterDetailSection>
              <MasterDetailSection label="MRN date" tone="white">
                <span>{formatDay(selectedRecord.mrn_dt)}</span>
              </MasterDetailSection>
            </MasterDetailGrid>

            <MasterDetailGrid columns={2}>
              <MasterDetailSection label="UID" tone="white">
                <span>{selectedRecord.uid || "—"}</span>
              </MasterDetailSection>
              <MasterDetailSection label="Serial" tone="white">
                <span>{selectedRecord.serial_no ?? "—"}</span>
              </MasterDetailSection>
            </MasterDetailGrid>

            <MasterDetailGrid columns={2}>
              <MasterDetailKV label="Bill no." value={selectedRecord.bill_no || "—"} />
              <MasterDetailKV label="Bill date" value={formatDay(selectedRecord.bill_dt)} />
            </MasterDetailGrid>

            <MasterDetailGrid columns={2}>
              <MasterDetailKV label="Acc. code" value={selectedRecord.acc_code ?? "—"} />
              <MasterDetailKV label="FY" value={selectedRecord.fyid ?? "—"} />
            </MasterDetailGrid>

            <MasterDetailSection label="Item code" tone="white">
              <span>{selectedRecord.item_code || "—"}</span>
            </MasterDetailSection>

            <MasterDetailKV label="ERP item code" value={selectedRecord.item_dcode ?? "—"} />

            {selectedRecord.item_desc ? (
              <MasterDetailProse label="Item description" tone="slate">
                {selectedRecord.item_desc}
              </MasterDetailProse>
            ) : null}

            <MasterDetailKV
              label="Total quantity"
              value={`${parseFloat(selectedRecord.it_recp_qty || 0).toLocaleString()} ${selectedRecord.it_unit || ""}`.trim()}
              valueClassName="text-emerald-700 text-base tabular-nums"
            />

            <MasterDetailKV label="Lot no." value={selectedRecord.it_lot_no || "—"} />

            <MasterDetailKV
              label="Sticker status"
              value={isMrnStickerGenerated(selectedRecord) ? "Generated" : "Pending"}
              valueClassName={isMrnStickerGenerated(selectedRecord) ? "text-emerald-700" : "text-amber-700"}
            />

            {isMrnStickerGenerated(selectedRecord) ? (
              <MasterDetailGrid columns={2}>
                <MasterDetailKV
                  label="Sticker generated by system"
                  value={selectedRecord.created_by_name || "—"}
                  valueClassName="text-indigo-700 font-bold"
                />
                <MasterDetailKV
                  label="Generated at"
                  value={formatDateTime(selectedRecord.created_at) || "—"}
                  valueClassName="text-indigo-700 font-bold"
                />
              </MasterDetailGrid>
            ) : null}

            {isMrnStickerGenerated(selectedRecord) ? (
              <MasterDetailGrid columns={1}>
                <MrnDocPreviewRow
                  label="TC Document"
                  path={selectedRecord.tc_file_path}
                  name={selectedRecord.tc_file_name}
                />
                <MrnDocPreviewRow
                  label="RMTC Document"
                  path={selectedRecord.rmtc_file_path}
                  name={selectedRecord.rmtc_file_name}
                />
              </MasterDetailGrid>
            ) : null}
          </MasterDetailBody>
        ) : null}
      </GlobalDetailModal>

      <MrnStickerRemoveConfirmModal
        open={removeStickersConfirmOpen}
        mrnNo={selectedRecord?.mrn_no}
        loading={removeStickersLoading}
        moduleSlug={MODULE}
        onClose={() => {
          if (!removeStickersLoading) setRemoveStickersConfirmOpen(false);
        }}
        onConfirm={handleRemoveGeneratedStickers}
      />

      <MrnStickerModal
        open={stickerModalOpen}
        mrnId={stickerMrnId}
        sourceRow={stickerSourceRow}
        onClose={() => {
          setStickerModalOpen(false);
          setStickerMrnId(null);
          setStickerSourceRow(null);
        }}
        onSuccess={() => fetchMrns()}
      />
    </div>
  );
}
