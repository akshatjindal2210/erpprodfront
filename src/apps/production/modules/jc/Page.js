"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RefreshCw, ClipboardList, Loader2, Edit3, CheckCircle, CheckCircle2, Check, Shield, XCircle, MessageSquareQuote, History } from "lucide-react";
import { toast } from "react-toastify";

import { jobCardService } from "@/apps/production/lib/services/jobCard";
import { ROUTES } from "@/apps/production/lib/utils/routes";
import { shortageService } from "@/apps/production/lib/services/shortage";
import { isProductionSuperAdmin } from "@/apps/production/lib/utils/superAdmin";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_TEXT, IMS_TABLE_CELL_NUMBER } from "@/ui/common/list/listPageShellClasses";
import { FormLabel, OK_INPUT } from "@/ui/common/Constants";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import { ListPageAddButton, ListPageEditButton, ListPageViewButton, ListPageDeleteButton, LIST_PAGE_OUTLINE_ACTION } from "@/ui/common/list/listPageCrud";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import AppListFooter from "@/ui/common/list/listPageFooter";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ActionButton from "@/ui/primitives/ActionButton";
import DataTable from "@/ui/primitives/DataTable";
import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { formatDocDate } from "@/platform/utils/core/utilHelper";
import { auditHeaders, auditPair } from "@/platform/utils/list/auditListUi";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { selectUser } from "@/platform/store/slices/authSlice";
import { DrawerSection, DrawerDetailField, PrimeItemSummary, usePrimeItemList, TOOLING_BADGE, jobCardPlanToolingKey } from "@/apps/production/modules/shortage/primeItem";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { formatProductionDuration, displayDurationSeconds, sumShownTimeSeconds, useJobCardProductionEstimate } from "@/apps/production/modules/jc/jobCardProductionEstimate";
import JobCardActivityDrawer from "@/apps/production/modules/jc/JobCardActivityDrawer";
import { JOB_CARD_DRAWER_MAX_WIDTH, JOB_CARD_PLAN_RM_EMPTY_EDIT, JOB_CARD_PLAN_RM_EMPTY_VIEW, JOB_CARD_PLAN_TH, JOB_CARD_PLAN_TD, jobCardPlanColgroupWidths, jobCardPlanTableMinWidthClass } from "@/apps/production/modules/jc/jobCardUi.config";
import { PROCESS_STATUS_VALUES, PROCESS_STATUS_LABELS, PROCESS_STATUS_BADGE, ProcessStatusChips, machineStatusRows, parseProcessPlan } from "@/apps/production/lib/constants/processStatus";
import { fetchMaintainJobcardToolingRequired, toolingBlocksMaintainJobCardSave } from "@/apps/production/lib/helpers/maintainJobCardToolingConfig";
/**
 * Production → Maintain Job Card — 2 tabs.
 *   Pending Shortage — Accept → New (rows with JC already created are hidden)
 *   Register         — created job cards → Edit / View / Delete
 */

const MODULE = "production_job_card";
const SHORTAGE_MODULE = "production_shortage"; // same authorize key as Shortage → Prime Item
const TABS = [
  { id: "register", label: "Register", icon: CheckCircle2 },
  { id: "pending", label: "Pending Shortage", icon: ClipboardList },
];
const btn = LIST_PAGE_ACTION_CLASS;
const NOT_APPROVED_TIP = "Shortage not accepted yet — Accept first, then click New";
const EMPTY = { rows: [], headers: [] };
const JOB_CARD_STATUSES = ["Pending", "Planning", "Running", "Hold", "Complete"];
const PAGE_CHUNK = 100;

const yesNoLabel = (v) => (v == null ? "—" : v ? "Yes" : "No");

const STATUS_BADGE = {
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Planning: "bg-sky-50 text-sky-700 border-sky-100",
  Running: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Hold: "bg-rose-50 text-rose-700 border-rose-100",
  Complete: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

/** Plan step machines → "NF-1, NF-2". */
const machinesText = (step) => (step.machines || []).map((m) => m.machine_name).join(", ");
/** Plan step RM → "WIRE A, WIRE B" (priority order). */
const rmText = (step) => (step.rm_items || []).map((r) => r.rm_item_code).join(", ");

function processPlanText(plan) {
  if (!Array.isArray(plan) || !plan.length) return "—";
  return plan.map((p) => [p.process_name, machinesText(p), rmText(p)].filter(Boolean).join(" / ")).join(" → ");
}

/** "HN006 (100), HN006TW (50)" */
const itemsText = (items) => (items || []).map((it) => `${it.item_code} (${Number(it.qty).toLocaleString()})`).join(", ");

/** Register — one row per job card (one job card per prime item). */
const REGISTER_HEADERS = [
  ["Job Card No", "job_card_no", (v) => <span className="font-mono text-indigo-600 font-bold text-[11px]">{v}</span>, { width: "120px" }],
  ["Doc Date", "doc_dt", (v, row) => (
    <span className="text-[10px] font-bold text-slate-700 tabular-nums">{formatDocDate(v ?? row?.job_date) || "—"}</span>
  ), { width: "100px", copyValue: (row) => formatDocDate(row.doc_dt ?? row.job_date) || "—" }],
  ["Prime Item", "prime_item_code", (v, row) => <span className="font-bold text-slate-800 uppercase text-[11px]" title={row.prime_item_desc || ""}>{v || "—"}</span>, { width: "130px" }],
  ["Items (Qty)", "items_summary", (_, row) => (
    <div className="flex flex-wrap gap-1 py-0.5">
      {(row.items || []).map((it) => (
        <span key={it.itemdcode} className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap">
          {it.item_code} <span className="text-indigo-600 tabular-nums">({Number(it.qty).toLocaleString()})</span>
        </span>
      ))}
    </div>
  ), { width: "300px", sortable: false, copyValue: (row) => itemsText(row.items) }],
  ["Total Qty", "qty", (v) => <span className="font-black text-slate-800 text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>, { width: "100px", align: "center" }],
  ["Process Plan", "process_plan", (v) => <span className="text-[10px] text-slate-600 truncate block" title={processPlanText(v)}>{processPlanText(v)}</span>, { width: "260px", sortable: false, copyValue: (row) => processPlanText(row.process_plan) }],
  /** Process status chips — Super Admin only (same gate as plan Status column). */
  ["Process", "process_chips", (_, row) => {
    const plan = row?.process_plan;
    if (!machineStatusRows(plan).length) return <span className="text-[10px] text-slate-400">—</span>;
    return <ProcessStatusChips list={plan} />;
  }, { width: "280px", sortable: false, saOnly: true, copyValue: (row) => machineStatusRows(row.process_plan).map((p) => `${p.machineName || p.processName}:${p.status}`).join(", ") || "—" }],
  ["Shortage Approved", "shortage_approved", (v) => (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {v ? "True" : "False"}
    </span>
  ), { width: "130px", copyValue: (row) => (row.shortage_approved ? "True" : "False") }],
  ["Shortage Remark", "shortage_remark", (v) => <span className="text-[10px] text-slate-600 truncate block" title={v || ""}>{v || "—"}</span>, { width: "180px", sortable: false }],
  ["Tooling Approved", "tooling_approved", (v) => (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v === true ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {v === true ? "True" : "False"}
    </span>
  ), { width: "130px", copyValue: (row) => (row.tooling_approved === true ? "True" : "False") }],
  ["Tooling Remark", "tooling_remark", (v) => <span className="text-[10px] text-slate-600 truncate block" title={v || ""}>{v || "—"}</span>, { width: "180px", sortable: false }],
  ...auditPair("Tooling", "tooling_by_name", "tooling_at", { hideUnlessNameKey: "tooling_by_name" }),
  ["Status", "status", (v) => <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${STATUS_BADGE[v] || STATUS_BADGE.Pending}`}>{v || "—"}</span>, { width: "100px" }],
  ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-600 truncate block" title={v || ""}>{v || "—"}</span>, { width: "200px", sortable: false }],
  ...auditHeaders(["created", "updated"]),
];

const registerHeaders = (isSa) => REGISTER_HEADERS.filter((h) => isSa || !h[3]?.saOnly);

const registerRowClassName = (row) => (row.status === "Pending" ? "[&_td]:bg-amber-50/70" : "");

/** Accept creates stub (docno only). Entry is New until job card no is assigned; then Edit. */
function hasJobCardNo(row) {
  return Boolean(String(row?.job_card_no || "").trim());
}

function shortageRowHasSavedJobCard(row) {
  return hasJobCardNo(row);
}

function cardFromShortageRow(row) {
  if (!row?.docno || !shortageRowHasSavedJobCard(row)) return null;
  return {
    docno: row.docno,
    job_card_no: row.job_card_no,
    prime_item_code: row.prime_item_code,
    prime_item_dcode: row.prime_key ?? row.id,
    qty: row.total_qty,
  };
}

export default function JobCardPage() {
  const canAccess = useCanAccess();
  const router = useRouter();
  const [tab, setTab] = useState("pending");
  const [opened, setOpened] = useState({ pending: true, register: false });
  const [keys, setKeys] = useState({ shortage: 0, register: 0 });
  const [exportData, setExportData] = useState({ pending: EMPTY, register: EMPTY });
  const [shortageSelected, setShortageSelected] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [createItem, setCreateItem] = useState(null);
  const [shortageApproveItem, setShortageApproveItem] = useState(null);
  const [drawerCard, setDrawerCard] = useState(null);
  const [deleteCard, setDeleteCard] = useState(null);
  const [activityCard, setActivityCard] = useState(null);
  const [viewMode, handleViewMode] = useViewMode();

  const reloadKey = (id) => setKeys((k) => ({ ...k, [id]: k[id] + 1 }));
  const setPendingExport = useCallback((d) => setExportData((e) => ({ ...e, pending: d })), []);
  const setRegisterData = useCallback((d) => setExportData((e) => ({ ...e, register: d })), []);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: tab === "pending" ? "Job Card Pending Shortage" : "Job Card Register",
    rows: exportData[tab].rows,
    headers: exportData[tab].headers,
  });

  const openCreate = useCallback((row) => {
    if (!row) return toast.info("Select an accepted prime item first.");
    if (row.status !== "accepted") return toast.info(NOT_APPROVED_TIP);
    if (shortageRowHasSavedJobCard(row)) {
      const card = cardFromShortageRow(row);
      if (!card) return toast.error("Job card link missing — refresh the list.");
      setDrawerCard({ card, mode: "edit" });
      return;
    }
    setCreateItem(row);
  }, []);

  /** Shortage → Prime Item approve (same API / permission), from a gray pending row. */
  const openShortageApprove = useCallback(
    (row) => {
      if (!canAccess(SHORTAGE_MODULE, "authorize").allowed) return;
      if (!row) return toast.info("Select a prime item first.");
      if (row.status !== "pending") return toast.info("Already accepted — click New to create the job card.");
      setShortageApproveItem(row);
    },
    [canAccess]
  );

  const openCard = useCallback((card, mode) => {
    if (!card?.docno) return toast.info("Select a job card first.");
    setDrawerCard({ card, mode });
  }, []);

  const showTab = (id) => {
    setTab(id);
    setOpened((o) => ({ ...o, [id]: true }));
    if (id === "pending") setSelectedCard(null);
    // Don't reload Register on every tab focus — Refresh button / mutations bump keys.register.
    if (id === "register") setShortageSelected(null);
  };

  // Open from Job Card Board: ?docno=1&mode=view|edit  or  ?tab=pending
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const tabParam = q.get("tab");
    const docno = q.get("docno");
    const mode = q.get("mode") || "view";
    if (!tabParam && !docno) return;

    if (tabParam === "pending" || tabParam === "register") {
      showTab(tabParam);
      if (tabParam === "pending") toast.info("Select an approved shortage, then click New.");
    } else if (docno) {
      showTab("register");
      openCard({ docno: Number(docno) }, mode);
    }
    router.replace(ROUTES.PRODUCTION_JOB_CARD, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modalOpen = Boolean(createItem || shortageApproveItem || drawerCard || deleteCard || activityCard);
  const onPending = tab === "pending";
  const onRegister = tab === "register";
  const pendingCard = cardFromShortageRow(shortageSelected);
  const registerHasJobCardNo = hasJobCardNo(selectedCard);
  const canShortageApproveSelected = Boolean(shortageSelected?.status === "pending" && !shortageSelected?.job_card_no);

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={<ImsSegmentedTabs active={tab} onChange={showTab} tabs={TABS} />}
            actions={
              <>
                {onPending ? (
                  <>
                    <ListPageAddButton
                      module={MODULE}
                      disabled={shortageSelected?.status !== "accepted" || shortageRowHasSavedJobCard(shortageSelected)}
                      onClick={() => openCreate(shortageSelected)}
                    />
                    <ListPageEditButton
                      module={MODULE}
                      icon={Edit3}
                      disabled={!pendingCard}
                      record={pendingCard}
                      onClick={() => pendingCard && openCard(pendingCard, "edit")}
                    />
                    <ListPageViewButton
                      module={MODULE}
                      disabled={!pendingCard}
                      record={pendingCard}
                      onClick={() => pendingCard && openCard(pendingCard, "view")}
                    />
                    <ActionButton
                      module={MODULE}
                      action="view"
                      variant="outline"
                      label="Activity Log"
                      icon={History}
                      disabled={!pendingCard}
                      record={pendingCard}
                      onClick={() => {
                        if (!pendingCard) return toast.info("Select a row with a job card first.");
                        setActivityCard(pendingCard);
                      }}
                      className={`${LIST_PAGE_OUTLINE_ACTION} text-slate-600`}
                    />
                    <ListPageDeleteButton
                      module={MODULE}
                      disabled={!pendingCard}
                      onClick={() => {
                        if (!pendingCard) return toast.info("Select a row with a job card first.");
                        setDeleteCard(pendingCard);
                      }}
                    />
                    <ActionButton
                      module={SHORTAGE_MODULE}
                      action="authorize"
                      variant="outline"
                      label="Accept / Reject"
                      icon={CheckCircle}
                      disabled={!canShortageApproveSelected}
                      record={shortageSelected}
                      onClick={() => openShortageApprove(shortageSelected)}
                      className={`${LIST_PAGE_OUTLINE_ACTION} text-emerald-600`}
                    />
                  </>
                ) : null}

                {onRegister ? (
                  <>
                    <ListPageAddButton
                      module={MODULE}
                      disabled={!selectedCard || registerHasJobCardNo}
                      onClick={() => {
                        if (!selectedCard) return toast.info("Select a job card first.");
                        if (registerHasJobCardNo) return toast.info("Job card already assigned — use Edit.");
                        openCard(selectedCard, "new");
                      }}
                    />
                    <ListPageEditButton
                      module={MODULE}
                      icon={Edit3}
                      disabled={!selectedCard || !registerHasJobCardNo}
                      record={selectedCard}
                      onClick={() => openCard(selectedCard, "edit")}
                    />
                    <ListPageViewButton
                      module={MODULE}
                      disabled={!selectedCard}
                      record={selectedCard}
                      onClick={() => openCard(selectedCard, "view")}
                    />
                    <ActionButton
                      module={MODULE}
                      action="view"
                      variant="outline"
                      label="Activity Log"
                      icon={History}
                      disabled={!selectedCard}
                      record={selectedCard}
                      onClick={() => {
                        if (!selectedCard) return toast.info("Select a job card first.");
                        setActivityCard(selectedCard);
                      }}
                      className={`${LIST_PAGE_OUTLINE_ACTION} text-slate-600`}
                    />
                    <ListPageDeleteButton
                      module={MODULE}
                      disabled={!selectedCard}
                      onClick={() => {
                        if (!selectedCard) return toast.info("Select a job card first.");
                        setDeleteCard(selectedCard);
                      }}
                    />
                  </>
                ) : null}

                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-0.5 shrink-0" />
                <button
                  type="button"
                  onClick={() => reloadKey(onRegister ? "register" : "shortage")}
                  aria-label="Refresh"
                  className={`${btn} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`}
                >
                  <RefreshCw size={14} />
                </button>
              </>
            }
            viewToggle={<ListPageExportToggle viewMode={viewMode} setMode={handleViewMode} exporting={exporting} disabled={exportDisabled} onExport={handleExport} />}
          />
        </ListPageToolbar>

        <div className={onPending ? "contents" : "hidden"}>
          <ShortageTab
            refreshKey={keys.shortage}
            active={onPending && !modalOpen}
            viewMode={viewMode}
            onDataChange={setPendingExport}
            onSelectionChange={setShortageSelected}
            onOpenCreate={openCreate}
            onOpenShortageApprove={openShortageApprove}
          />
        </div>

        {opened.register ? (
          <div className={onRegister ? "contents" : "hidden"}>
            <RegisterTab
              refreshKey={keys.register}
              active={onRegister && !modalOpen}
              viewMode={viewMode}
              onDataChange={setRegisterData}
              selectedCard={selectedCard}
              onSelectCard={setSelectedCard}
              onOpenCard={openCard}
              onDeleteCard={setDeleteCard}
            />
          </div>
        ) : null}
      </div>

      {createItem ? (
        <CreateDrawer
          item={createItem}
          onClose={() => setCreateItem(null)}
          onSaved={() => {
            setCreateItem(null);
            reloadKey("shortage");
            reloadKey("register");
          }}
        />
      ) : null}

      {shortageApproveItem ? (
        <ShortageApproveDrawer
          item={shortageApproveItem}
          onClose={() => setShortageApproveItem(null)}
          onSaved={() => {
            setShortageApproveItem(null);
            setShortageSelected(null);
            reloadKey("shortage");
          }}
        />
      ) : null}

      {activityCard ? (
        <JobCardActivityDrawer card={activityCard} onClose={() => setActivityCard(null)} />
      ) : null}

      {drawerCard ? (
        <JobCardDrawer
          card={drawerCard.card}
          mode={drawerCard.mode}
          onClose={() => setDrawerCard(null)}
          onSaved={() => {
            setDrawerCard(null);
            setSelectedCard(null);
            reloadKey("register");
            reloadKey("shortage");
          }}
        />
      ) : null}

      {deleteCard ? (
        <DeleteModal
          item={deleteCard}
          onClose={() => setDeleteCard(null)}
          onSuccess={() => {
            setDeleteCard(null);
            setSelectedCard(null);
            setShortageSelected(null);
            reloadKey("register");
            reloadKey("shortage");
          }}
          service={jobCardService}
          entityLabel="Job card"
          idKey="docno"
          titleKey="job_card_no"
          moduleSlug={MODULE}
          warningMessage="Deleting frees the linked shortage entries so they can be used on a new job card."
        />
      ) : null}
    </div>
  );
}

/* ───────────── Shortage tab (create source) ───────────── */

const SHORTAGE_DECISION_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
];

function ShortageTab({ refreshKey, active, viewMode, onDataChange, onSelectionChange, onOpenCreate, onOpenShortageApprove }) {
  const canAccess = useCanAccess();
  const [approval, setApproval] = useState("all");
  const list = usePrimeItemList({
    load: jobCardService.getPendingShortage,
    refreshKey,
    status: approval,
    showRemark: false,
    pendingTip: NOT_APPROVED_TIP,
    jobCard: true,
    onDataChange,
  });
  const { selectedRow } = list;

  useEffect(() => {
    onSelectionChange(selectedRow);
  }, [selectedRow, onSelectionChange]);

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: !active,
    selectedId: list.selected,
    getSelectedRow: () => selectedRow,
    openAdd: () => onOpenCreate(selectedRow),
    canOpenNew: () => selectedRow?.status === "accepted" && !shortageRowHasSavedJobCard(selectedRow),
    newBlockedMessage: NOT_APPROVED_TIP,
    openEdit: (row) => {
      const c = cardFromShortageRow(row);
      if (c) onOpenCreate(row);
    },
    canEditSelection: () => Boolean(cardFromShortageRow(selectedRow)),
    // Shortage authorize (not job-card authorize) — same power as Prime Item Approve
    openApprove: (row) => onOpenShortageApprove(row),
    getAuthorizeAccess: () => canAccess(SHORTAGE_MODULE, "authorize"),
    canApproveSelection: () => selectedRow?.status === "pending",
    approveBlockedMessage: "Select a Pending prime item first.",
  });

  return (
    <>
      <ListPageFilterStrip>
        <DateRangeFilter
          showDate={false}
          extraFilters={[{ label: "Decision", key: "approval", value: approval, options: SHORTAGE_DECISION_OPTIONS, preserveOrder: true }]}
          applyOnSearchEnter={false}
          searchVariant="quick"
          onApply={(data) => {
            setApproval(data.approval || "all");
            list.resetView();
          }}
          onReset={() => {
            list.setSearch("");
            setApproval("all");
            list.resetView();
          }}
          searchValue={list.search}
          onSearchChange={list.setSearch}
          searchPlaceholder="Search prime item, item code..."
          searchLabel="Search Shortage"
        />
      </ListPageFilterStrip>

      <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
        <DataTable
          {...list.tableProps}
          viewMode={viewMode}
          {...tableHotkeyProps}
          onRowDoubleClick={(row) => {
            list.setSelected(row.id);
            if (row.status === "pending") {
              if (canAccess(SHORTAGE_MODULE, "authorize").allowed) onOpenShortageApprove(row);
              else toast.info(NOT_APPROVED_TIP);
            } else {
              onOpenCreate(row);
            }
          }}
          getRowClassName={(row) => (row.status === "accepted" ? "" : "opacity-60 [&_td]:bg-slate-100 [&_td]:text-slate-500")}
          emptyIcon={ClipboardList}
          emptyMessage={list.error ? "Could not load pending shortage" : "No pending shortage"}
          emptySubMessage={list.error ? `${list.error} — use the refresh button to try again.` : "No rows match the filter, or accepted items already have a job card (see Register)."}
        />
      </div>

      <AppListFooter {...list.footerProps} />
    </>
  );
}

/** Same UI + APIs as Shortage → Prime Item Approve / Reject. */
const SHORTAGE_DECIDE = {
  approve: {
    label: "Accept",
    icon: CheckCircle,
    pick: "border-emerald-600 bg-emerald-50 text-emerald-700",
    idle: "border-emerald-300 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-50",
    call: shortageService.approvePrimeItems,
  },
  reject: {
    label: "Reject",
    icon: XCircle,
    pick: "border-rose-600 bg-rose-50 text-rose-700",
    idle: "border-rose-300 bg-rose-50/70 text-rose-700 hover:bg-rose-50",
    call: shortageService.rejectPrimeItems,
  },
};
const BTN_REJECT =
  "shrink-0 min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-rose-100 disabled:opacity-50";

function ShortageApproveDrawer({ item, onClose, onSaved }) {
  const [type, setType] = useState(null);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  if (!item) return null;

  // Same detail source as Shortage → Prime Item: Production RM wire list (table still uses process `rm` flag).
  const hasWireList = Array.isArray(item.rm_wire_items) && item.rm_wire_items.length > 0;
  const drawerItem = {
    ...item,
    rm: hasWireList ? true : item.production_rm != null ? item.production_rm : item.rm,
  };

  const close = () => !saving && onClose();
  const saveClass = type === "reject" ? BTN_REJECT : type ? IMS_DRAWER_BTN_APPROVE : `${IMS_DRAWER_BTN_APPROVE} opacity-50`;

  const submit = async () => {
    if (saving) return;
    if (!type) return toast.error("Please select Accept or Reject.");
    setSaving(true);
    try {
      const res = await SHORTAGE_DECIDE[type].call([item.prime_key], remark.trim() || undefined);
      if (res?.success === false) throw new Error(res?.message);
      toast.success(res?.message || "Done.");
      onSaved(item, type);
    } catch (err) {
      toast.error(err?.message || "Action failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen
      onClose={close}
      onSubmit={() => void submit()}
      title="Accept / Reject Prime Item"
      description={item.prime_item_code ? `Prime item ${item.prime_item_code}` : undefined}
      maxWidth="max-w-2xl"
      footer={
        <div className={IMS_DRAWER_FOOTER_WRAP}>
          <button type="button" onClick={close} disabled={saving} className={IMS_DRAWER_BTN_CANCEL}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !type}
            title="Ctrl+S"
            className={saveClass}
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : type === "reject" ? (
              <XCircle size={18} />
            ) : (
              <Shield size={18} />
            )}
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        <DrawerSection title="Prime Item Details" bar="bg-indigo-500">
          <PrimeItemSummary item={drawerItem} />
        </DrawerSection>

        <div className="pt-1 space-y-4">
          <div className="space-y-1.5">
            <FormLabel required>Decision</FormLabel>
            <div className="grid grid-cols-2 gap-2 w-full">
              {["approve", "reject"].map((key) => {
                const t = SHORTAGE_DECIDE[key];
                const Icon = t.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={saving}
                    onClick={() => setType(key)}
                    aria-pressed={type === key}
                    className={`w-full min-w-0 h-9 border rounded-none flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase transition-colors disabled:opacity-50 ${type === key ? t.pick : t.idle}`}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <FormTextarea
            label="Remarks"
            labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
            rows={3}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Optional notes"
            disabled={saving}
          />
        </div>
      </div>
    </Drawer>
  );
}

/* ───────────── Register (one row per job card) ───────────── */

function RegisterTab({ refreshKey, active, viewMode, onDataChange, selectedCard, onSelectCard, onOpenCard, onDeleteCard }) {
  const isSa = isProductionSuperAdmin(useSelector(selectUser));
  const headers = useMemo(() => registerHeaders(isSa), [isSa]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sort, setSort] = useState({ sortKey: "docno", sortDir: "desc" });
  const [limit, setLimit] = useState(PAGE_CHUNK);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const reqId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const res = await jobCardService.getRegister();
      if (reqId !== requestRef.current) return;
      if (res?.success === false) throw new Error(res?.message || "Failed to load");
      const data = Array.isArray(res?.data) ? res.data : [];
      setRows(data);
      onSelectCard((cur) => (cur ? data.find((c) => c.docno === cur.docno) || null : null));
    } catch (err) {
      if (reqId !== requestRef.current) return;
      setRows([]);
      setError(err?.message || "Failed to load job cards");
      toast.error(err?.message || "Failed to load job cards");
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
  }, [onSelectCard]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const setSearch = (value) => {
    setSearchValue(value);
    setLimit(PAGE_CHUNK);
  };

  const filteredRows = useMemo(() => {
    let data = rows;
    if (deferredSearch.trim()) {
      data = applyClientSearch(data, deferredSearch, {
        skipSort: true,
        getParts: (c) => [c.job_card_no, c.prime_item_code, c.prime_item_desc, c.status, ...(c.items || []).map((it) => it.item_code)],
      });
    }
    return sortRowsByKey(data, sort.sortKey, sort.sortDir);
  }, [rows, deferredSearch, sort]);

  const visibleRows = useMemo(() => filteredRows.slice(0, limit), [filteredRows, limit]);

  useEffect(() => {
    onDataChange({ rows: filteredRows, headers });
  }, [filteredRows, headers, onDataChange]);

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: !active,
    selectedId: selectedCard?.docno ?? null,
    getSelectedRow: () => selectedCard,
    openAdd: () => selectedCard && onOpenCard(selectedCard, "new"),
    canOpenNew: () => Boolean(selectedCard && !hasJobCardNo(selectedCard)),
    newBlockedMessage: "Select a row without a job card no first.",
    openEdit: (row) => onOpenCard(row, "edit"),
    canEditSelection: () => hasJobCardNo(selectedCard),
    openDelete: (row) => onDeleteCard(row),
    canDeleteSelection: () => Boolean(selectedCard),
  });

  return (
    <>
      <ListPageFilterStrip>
        <DateRangeFilter
          showDate={false}
          applyOnSearchEnter={false}
          searchVariant="quick"
          onApply={() => setLimit(PAGE_CHUNK)}
          onReset={() => {
            setSearch("");
            setLimit(PAGE_CHUNK);
          }}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search job card no, prime item, item code..."
          searchLabel="Search Register"
        />
      </ListPageFilterStrip>

      <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
        <DataTable
          headers={headers}
          data={visibleRows}
          loading={loading}
          viewMode={viewMode}
          allowCopy
          showSelection
          {...tableHotkeyProps}
          sortKey={sort.sortKey}
          sortDir={sort.sortDir}
          onSort={(key) => {
            setLimit(PAGE_CHUNK);
            setSort((p) => ({ sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc" }));
          }}
          getRowId={(c) => c.docno}
          getRowClassName={registerRowClassName}
          selectedId={selectedCard?.docno ?? null}
          onSelect={(docno) => onSelectCard(rows.find((c) => String(c.docno) === String(docno)) || null)}
          onRowDoubleClick={(c) => {
            onSelectCard(c);
            onOpenCard(c, "view");
          }}
          onLoadMore={() => setLimit((n) => n + PAGE_CHUNK)}
          hasMore={visibleRows.length < filteredRows.length}
          totalItems={filteredRows.length}
          cardConfig={{ titleKey: "job_card_no", badgeIndices: [6, 4], detailIndices: [2, 3] }}
          emptyIcon={ClipboardList}
          emptyMessage={error ? "Could not load job cards" : "No job cards yet"}
          emptySubMessage={error ? `${error} — use the refresh button to try again.` : "Create one from Pending Shortage → New."}
        />
      </div>

      <AppListFooter
        shown={visibleRows.length}
        total={filteredRows.length}
        noun="Job Cards"
        selected={selectedCard?.docno ?? null}
        selectedRecord={selectedCard}
        selectionLabel={(c) => `Selected: ${c?.job_card_no || "—"} · ${c?.prime_item_code || ""}`}
        onClearSelection={() => onSelectCard(null)}
      />
    </>
  );
}

/* ───────────── Create Job Card drawer ───────────── */

function CreateDrawer({ item, onClose, onSaved }) {
  const isSa = isProductionSuperAdmin(useSelector(selectUser));
  const showMachineStatus = isSa;
  const sopAckRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState(undefined);
  const [picks, setPicks] = useState({});
  const [remarks, setRemarks] = useState("");
  const [erpJobcardno, setErpJobcardno] = useState("");
  const [erpNoLoading, setErpNoLoading] = useState(false);
  const [toolingRequired, setToolingRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMaintainJobcardToolingRequired().then((on) => {
      if (!cancelled) setToolingRequired(on);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSa) return;
    let cancelled = false;
    setErpNoLoading(true);
    jobCardService
      .suggestErpJobcardno()
      .then((res) => {
        if (cancelled) return;
        const n = res?.data?.jobcardno;
        if (Number.isFinite(Number(n)) && Number(n) > 0) setErpJobcardno(String(n));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setErpNoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSa]);

  useEffect(() => {
    let cancelled = false;
    jobCardService
      .getPrimeProcess(item.prime_key, (item.items || []).map((it) => it.itemdcode).filter(Boolean))
      .then((res) => {
        if (cancelled) return;
        const loaded = res?.data?.stages ?? null;
        setStages(loaded);
        const auto = {};
        // Every stage starts with its first process (prime process order) + its default machines / RM
        for (const s of loaded || []) if (s.processes.length) auto[s.stage_no] = defaultsFor(s.processes[0]);
        setPicks(auto);
      })
      .catch((err) => {
        if (cancelled) return;
        // Engineering not ready (Prime / Finish Process) → don't open the form, just the message
        toast.error(err?.message || "Failed to load prime process.");
        onClose();
      });
    return () => {
      cancelled = true;
    };
  }, [item.prime_key, item.items]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPick = (stageNo, patch) => setPicks((prev) => ({ ...prev, [stageNo]: { ...prev[stageNo], ...patch } }));

  const qty = item.total_qty ?? item.qty;
  const { estimate, loading: estimateLoading, planError: missing } = useJobCardProductionEstimate({
    itemDcode: item.prime_key,
    qty,
    stages,
    picks,
    active: Boolean(stages?.length),
  });

  const close = () => !saving && onClose();

  const toolingBlock = toolingBlocksMaintainJobCardSave({
    toolingRequired,
    toolingStatus: item?.tooling,
    processTooling: item?.process_tooling,
  });

  const submit = async () => {
    if (saving) return;
    if (!stages?.length) return toast.info("Prime process is still loading.");
    if (missing) return toast.error(missing);
    if (toolingBlock) return toast.error(toolingBlock);
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setSaving(true);
    try {
      const plan = stages.map((s) => {
        const pick = picks[s.stage_no] || {};
        const machine_status = {};
        for (const mid of pick.machine_ids || []) {
          const id = Number(mid);
          if (id) machine_status[id] = pick.machine_status?.[id] || "pending";
        }
        return {
          stage_no: s.stage_no,
          process_id: pick.process_id,
          machine_ids: pick.machine_ids,
          rm_item_dcodes: pick.rm_item_dcodes,
          machine_status,
        };
      });
      const shortageIds = item.shortage_ids ?? (item.children || []).map((c) => c.id);
      const extra = {};
      if (isSa) {
        const manualNo = String(erpJobcardno ?? "").trim();
        if (manualNo) {
          const n = Number(manualNo);
          if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
            setSaving(false);
            return toast.error("Job Card No must be a whole number.");
          }
          extra.jobcardno = n;
        }
      }
      const res = await jobCardService.create(item.prime_key, shortageIds, plan, remarks.trim(), extra);
      toast.success(res?.message || "Job card created.");
      onSaved();
    } catch (err) {
      toast.error(err?.message || "Failed to create job card.");
    } finally {
      setSaving(false);
    }
  };

  // IMS sticky footer — Cancel + indigo Save (same as masters)
  const footer = (
    <RmStoreDrawerFooter
      onClose={close}
      loading={saving}
      disabled={Boolean(missing) || Boolean(toolingBlock) || !stages?.length}
      onSave={() => void submit()}
      saveLabel="Save"
      loadingLabel="Saving..."
    />
  );

  return (
    <Drawer isOpen onClose={close} onSubmit={() => void submit()} title="New Job Card" description="Prime item → process · machine · RM per stage" maxWidth={JOB_CARD_DRAWER_MAX_WIDTH} footer={footer}>
      <div className="space-y-2 pb-1">
        <DrawerSection title="Prime Item Details" bar="bg-indigo-500">
          <PrimeItemSummary
            item={item}
            jobCard
            extra={
              isSa ? (
                <DrawerDetailField
                  label="Job Card No"
                  value={
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={erpJobcardno}
                      onChange={(e) => setErpJobcardno(e.target.value)}
                      disabled={saving || erpNoLoading}
                      className={`${OK_INPUT} w-full`}
                    />
                  }
                />
              ) : null
            }
          />
        </DrawerSection>

        <DrawerSection
          title={`Process Plan · ${item.prime_item_code || "—"}`}
          badge={<PlanBadge count={stages?.length} estimate={estimate} loading={estimateLoading} qty={qty} />}
        >
          <PlanBody
            stages={stages}
            picks={picks}
            disabled={saving}
            onPick={setPick}
            estimate={estimate}
            estimateLoading={estimateLoading}
            issueQty={item.total_weight_kg}
            showMachineStatus={showMachineStatus}
            tooling={item?.tooling}
          />
        </DrawerSection>

        <FormTextarea
          label="Remarks"
          labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Optional notes"
          disabled={saving}
          maxLength={500}
        />

        <ModuleSopAcknowledgment ref={sopAckRef} key="job-card-add" moduleSlug={MODULE} permissionType="add" isOpen />
      </div>
    </Drawer>
  );
}

/* ───────────── View / Edit Job Card drawer (IMS style) ───────────── */

function JobCardDrawer({ card, mode, onClose, onSaved }) {
  const isSa = isProductionSuperAdmin(useSelector(selectUser));
  const showMachineStatus = isSa;
  const sopAckRef = useRef(null);
  const isView = mode === "view";
  const isNewEntry = mode === "new";
  const readOnly = isView;
  const [saving, setSaving] = useState(false);
  const [activeSubmit, setActiveSubmit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("Pending");
  const [remarks, setRemarks] = useState("");
  const [jobDate, setJobDate] = useState("");
  const [stages, setStages] = useState(undefined);
  const [picks, setPicks] = useState({});
  const [toolingRequired, setToolingRequired] = useState(false);
  const [erpJobcardno, setErpJobcardno] = useState("");
  const [erpNoLoading, setErpNoLoading] = useState(false);

  const primeCode = detail?.prime_item_code || card?.prime_item_code;
  const showAsNew = isNewEntry || (!isView && !hasJobCardNo(detail || card));

  useEffect(() => {
    let cancelled = false;
    fetchMaintainJobcardToolingRequired().then((on) => {
      if (!cancelled) setToolingRequired(on);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await jobCardService.getById(card.docno);
        if (cancelled) return;
        const row = res?.data || card;
        setDetail(row);
        setStatus(row.status || "Pending");
        setRemarks(row.remarks || "");
        setJobDate(String(row.doc_dt ?? row.job_date ?? "").slice(0, 10));

        const plan = parseProcessPlan(row.process_plan);
        const procRes = await jobCardService.getPrimeProcess(row.prime_item_dcode);
        if (cancelled) return;
        const loaded = procRes?.data?.stages ?? null;
        setStages(loaded);
        const nextPicks = {};
        // Saved plan first; a stage without one gets its first process + defaults
        for (const step of plan) {
          const machine_status = {};
          for (const m of step.machines || []) {
            machine_status[m.machine_id] = m.status || step.status || "pending";
          }
          nextPicks[step.stage_no] = {
            process_id: step.process_id ?? null,
            machine_ids: (step.machines || []).map((m) => m.machine_id),
            rm_item_dcodes: (step.rm_items || []).map((r) => r.rm_item_dcode),
            machine_status,
          };
        }
        for (const s of loaded || []) {
          if (!nextPicks[s.stage_no] && s.processes.length) nextPicks[s.stage_no] = defaultsFor(s.processes[0]);
        }
        setPicks(nextPicks);
      } catch (err) {
        if (cancelled) return;
        toast.error(err?.message || "Failed to load job card.");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card.docno]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Register → New: show suggested Job Card No (SA can edit; others see value). */
  useEffect(() => {
    if (readOnly || !showAsNew || loading) return;
    if (hasJobCardNo(detail)) return;
    let cancelled = false;
    setErpNoLoading(true);
    jobCardService
      .suggestErpJobcardno()
      .then((res) => {
        if (cancelled) return;
        const n = res?.data?.jobcardno;
        if (Number.isFinite(Number(n)) && Number(n) > 0) setErpJobcardno(String(n));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setErpNoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly, showAsNew, loading, detail?.job_card_no]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPick = (stageNo, patch) => {
    setPicks((prev) => {
      const cur = prev[stageNo] || {};
      const next = { ...cur, ...patch };
      // Keep machine_status in sync when machines / process change
      if (patch.machine_ids !== undefined || patch.process_id !== undefined || patch.machine_status !== undefined) {
        const ids = (next.machine_ids || []).map(Number).filter(Boolean);
        const machine_status = { ...(next.machine_status || {}) };
        for (const id of ids) {
          if (machine_status[id] == null) machine_status[id] = "pending";
        }
        for (const key of Object.keys(machine_status)) {
          if (!ids.includes(Number(key))) delete machine_status[key];
        }
        next.machine_status = machine_status;
      }
      return { ...prev, [stageNo]: next };
    });
  };

  const qty = detail?.qty ?? card?.qty;
  const itemDcode = detail?.prime_item_dcode ?? card?.prime_item_dcode;
  // Same Est. time as Create — live for Edit; View / Approve use saved plan picks (+ getById fallback)
  const { estimate: liveEstimate, loading: estimateLoading, planError: livePlanError } = useJobCardProductionEstimate({
    itemDcode,
    qty,
    stages,
    picks,
    active: Boolean(itemDcode && stages?.length),
  });
  const estimate = (liveEstimate?.valid ? liveEstimate : null) || detail?.production_time || liveEstimate;
  const missing = readOnly ? null : livePlanError;

  const close = () => !saving && onClose();

  const savedPlan = detail?.process_plan ?? card?.process_plan;
  const hasSavedPlan = Array.isArray(savedPlan) && savedPlan.length > 0;

  const toolingBlock = toolingBlocksMaintainJobCardSave({
    toolingRequired,
    toolingStatus: detail?.tooling ?? detail?.tooling_approved ?? card?.tooling_approved,
    processTooling: detail?.process_tooling ?? card?.process_tooling,
  });

  const submit = async () => {
    if (isView || saving) return;
    if (missing) return toast.error(missing);
    if (stages?.length && toolingBlock) return toast.error(toolingBlock);
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setSaving(true);
    setActiveSubmit("save");
    try {
      const body = { status, remarks, job_date: jobDate || undefined };
      if (showAsNew && isSa) {
        const manualNo = String(erpJobcardno ?? "").trim();
        if (manualNo) {
          const n = Number(manualNo);
          if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
            setSaving(false);
            setActiveSubmit(null);
            return toast.error("Job Card No must be a whole number.");
          }
          body.jobcardno = n;
        }
      }
      if (stages?.length) {
        body.process_plan = stages.map((s) => {
          const pick = picks[s.stage_no] || {};
          const row = {
            stage_no: s.stage_no,
            process_id: pick.process_id,
            machine_ids: pick.machine_ids,
            rm_item_dcodes: pick.rm_item_dcodes,
          };
          // Machine-level status — Super Admin only; others keep existing via backend withPlanStatuses
          if (showMachineStatus) {
            row.machine_status = Object.fromEntries(
              (pick.machine_ids || []).map(Number).filter(Boolean).map((id) => [id, pick.machine_status?.[id] || "pending"])
            );
          }
          return row;
        });
      }
      const res = await jobCardService.update(card.docno, body);
      toast.success(res?.message || "Job card updated.");
      onSaved();
    } catch (err) {
      toast.error(err?.message || "Failed to update job card.");
    } finally {
      setSaving(false);
      setActiveSubmit(null);
    }
  };

  const footer = (
    <RmStoreDrawerFooter
      onClose={close}
      loading={saving}
      disabled={loading || Boolean(missing) || Boolean(!readOnly && stages?.length && toolingBlock)}
      readOnly={isView}
      isEdit={!isView}
      canApprove={false}
      activeSubmit={activeSubmit}
      onSave={() => void submit()}
      saveLabel="Save"
      loadingLabel="Saving..."
    />
  );

  const cardNo = detail?.job_card_no || card.job_card_no || "Job Card";

  return (
    <Drawer
      isOpen
      onClose={close}
      onSubmit={isView ? close : () => void submit()}
      title={isView ? `View ${cardNo}` : showAsNew ? "New Job Card" : `Edit ${cardNo}`}
      description={
        showAsNew
          ? "Prime item → process · machine · RM per stage"
          : detail?.prime_item_code
            ? `Prime item ${detail.prime_item_code}`
            : undefined
      }
      maxWidth={JOB_CARD_DRAWER_MAX_WIDTH}
      footer={footer}
    >
      {loading || !detail ? (
        <div className="py-10 flex items-center justify-center text-[11px] text-slate-500 gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-2 pb-1">
          <DrawerSection
            title="Prime Item Details"
            bar="bg-indigo-500"
            badge={
              detail?.status ? (
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${STATUS_BADGE[detail.status] || STATUS_BADGE.Pending}`}>
                  {detail.status}
                </span>
              ) : null
            }
          >
            <PrimeItemSummary
              item={{
                ...detail,
                total_qty: detail.qty,
                gweight: detail.gweight,
                total_weight_kg: detail.total_weight_kg,
                weight_missing: detail.weight_missing,
                items: detail.items,
                rm: detail.rm,
                process_tooling: detail.process_tooling,
              }}
              jobCard
              extra={
                <>
                  <DrawerDetailField
                    label="Job Card No"
                    value={
                      showAsNew && !readOnly && isSa ? (
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={erpJobcardno}
                          onChange={(e) => setErpJobcardno(e.target.value)}
                          disabled={saving || erpNoLoading}
                          className={`${OK_INPUT} w-full`}
                        />
                      ) : (
                        <span className="font-mono font-bold text-indigo-700">
                          {detail.job_card_no || (showAsNew && erpJobcardno ? erpJobcardno : "—")}
                        </span>
                      )
                    }
                  />
                  <DrawerDetailField
                    label="Doc Date"
                    value={
                      readOnly ? (
                        <span className="tabular-nums">{formatDocDate(detail.doc_dt ?? detail.job_date) || "—"}</span>
                      ) : (
                        <input type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} disabled={saving} className={OK_INPUT} />
                      )
                    }
                  />
                  <DrawerDetailField
                    label="Status"
                    value={
                      readOnly ? (
                        <span className={`border px-2 py-0.5 text-[9px] font-black uppercase ${STATUS_BADGE[detail.status] || STATUS_BADGE.Pending}`}>
                          {detail.status || "—"}
                        </span>
                      ) : (
                        <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={saving} className={OK_INPUT}>
                          {JOB_CARD_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      )
                    }
                  />
                </>
              }
            />
          </DrawerSection>

          <DrawerSection
            title={`Process Plan · ${primeCode || "—"}`}
            badge={
              <PlanBadge
                count={(readOnly ? detail.process_plan : stages)?.length || 0}
                estimate={estimate}
                loading={estimateLoading && !estimate?.valid}
                qty={qty}
              />
            }
          >
            {readOnly ? (
              <SavedPlanTable
                plan={detail.process_plan}
                stages={stages}
                estimate={estimate}
                estimateLoading={estimateLoading && !estimate?.valid}
                issueQty={detail.total_weight_kg}
                showMachineStatus={showMachineStatus}
                tooling_approved={detail.tooling_approved}
                tooling={detail.tooling}
              />
            ) : (
              <PlanBody
                stages={stages}
                picks={picks}
                disabled={saving}
                onPick={setPick}
                estimate={estimate}
                estimateLoading={estimateLoading}
                issueQty={detail.total_weight_kg}
                showMachineStatus={showMachineStatus}
                tooling_approved={detail.tooling_approved}
                tooling={detail.tooling}
              />
            )}
          </DrawerSection>

          {readOnly ? (
            <div className="px-1">
              <FormLabel>Remarks</FormLabel>
              <span className={`${IMS_TABLE_CELL_TEXT} text-[12px] text-slate-800 break-words block mt-1`}>{detail.remarks || "—"}</span>
            </div>
          ) : (
            <FormTextarea
              label="Remarks"
              labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes"
              disabled={saving}
              maxLength={500}
            />
          )}

          {!isView ? (
            <ModuleSopAcknowledgment
              ref={sopAckRef}
              key={`job-card-${mode}`}
              moduleSlug={MODULE}
              permissionType="edit"
              isOpen
            />
          ) : null}
        </div>
      )}
    </Drawer>
  );
}

/**
 * Default pick for a process (prime process order from DB):
 *   machines — "Multiple Job Card" (multi_jc) ON → all its machines, else the first one
 *   RM       — the first one
 */
function defaultsFor(process) {
  const machineIds = process.machines.map((m) => m.machine_id);
  const ids = process.multi_jc ? machineIds : machineIds.slice(0, 1);
  const machine_status = {};
  for (const id of ids) machine_status[id] = "pending";
  return {
    process_id: process.process_id,
    machine_ids: ids,
    rm_item_dcodes: process.rm_items.map((r) => r.rm_item_dcode), // all RM, priority order as saved
    machine_status,
  };
}

/* ───────────── Drawer UI pieces (IMS style) ───────────── */

/** IMS drawer card: bordered, header bar + title, optional badge on the right. */
function Section({ title, badge = null, children }) {
  return (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <div className="h-3.5 w-1 shrink-0 rounded-full bg-indigo-500" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{title}</span>
        {badge ? <span className="ml-auto">{badge}</span> : null}
      </div>
      {children}
    </div>
  );
}

function DetailField({ label, value, wide = false }) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2 space-y-1" : "min-w-0 space-y-1"}>
      <FormLabel>{label}</FormLabel>
      <span className={`${IMS_TABLE_CELL_TEXT} text-[12px] text-slate-800 break-words leading-snug block`}>{value ?? "—"}</span>
    </div>
  );
}

const CountBadge = ({ children }) => (
  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 uppercase">{children}</span>
);


/** HN006 (293,080) · HN006TW (75,930) as chips */
function ItemChips({ items }) {
  if (!items?.length) return "—";
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((it) => (
        <span key={it.itemdcode} className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap">
          {it.item_code} <span className="text-indigo-600 tabular-nums">({Number(it.qty).toLocaleString()})</span>
        </span>
      ))}
    </span>
  );
}

/* ───────────── Process plan table (IMS style: one row per stage) ───────────── */

const TH = JOB_CARD_PLAN_TH;
const TD = JOB_CARD_PLAN_TD;

function PlanTable({ children, showMachineStatus = false }) {
  const colWidths = jobCardPlanColgroupWidths(showMachineStatus);
  return (
    <div className="overflow-x-auto">
      <table className={`w-full table-fixed border-collapse text-left ${jobCardPlanTableMinWidthClass(showMachineStatus)}`}>
        <colgroup>
          {colWidths.map((width, i) => (
            <col key={i} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className={`${TH} text-center`}>Stage</th>
            <th className={TH}>Process</th>
            <th className={TH}>M/C</th>
            <th className={TH}>RM</th>
            <th className={`${TH} text-right`} title="(gweight × Total Qty) + extra % — same as RM Store">
              RM Required
            </th>
            <th className={`${TH} text-right`} title="RM stock available (KG)">
              RM Available
            </th>
            <th className={`${TH} text-center`}>Tooling</th>
            {showMachineStatus ? <th className={TH}>Status</th> : null}
            <th className={`${TH} text-right`}>Time Required</th>
            <th className={`${TH} text-right border-r-0`}>Shift Required</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** RM-wire stages: show RM Required (KG). Else empty label (— edit, -- view). */
function IssueQtyCell({ show, issueQty, empty = "—" }) {
  const kg = Number(issueQty);
  const hasKg = Number.isFinite(kg) && kg > 0;
  return (
    <td className={`${TD} ${IMS_TABLE_CELL_TEXT} text-right tabular-nums text-[11px] font-semibold text-slate-800`}>
      {show && hasKg ? kg.toLocaleString(undefined, { maximumFractionDigits: 3 }) : empty}
    </td>
  );
}

/** RM Available (KG) — issuable store qty for selected RM (Issue Request pool). */
function RmAvailableCell({ show, availableQty, requiredQty, loading, empty = "—" }) {
  if (!show) {
    return <td className={`${TD} ${IMS_TABLE_CELL_TEXT} text-right text-[11px] text-slate-400`}>{empty}</td>;
  }
  if (loading) {
    return (
      <td className={`${TD} text-right`}>
        <Loader2 size={12} className="inline animate-spin text-slate-400" />
      </td>
    );
  }
  const kg = Number(availableQty);
  const hasKg = Number.isFinite(kg) && kg >= 0;
  const req = Number(requiredQty);
  const short = hasKg && Number.isFinite(req) && req > 0 && kg < req;
  return (
    <td
      className={`${TD} ${IMS_TABLE_CELL_TEXT} text-right tabular-nums text-[11px] font-semibold ${
        short ? "text-rose-600" : "text-slate-800"
      }`}
      title={short ? `Available ${kg.toLocaleString(undefined, { maximumFractionDigits: 3 })} KG is less than RM Required` : undefined}
    >
      {hasKg ? kg.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "—"}
    </td>
  );
}

/** Section badge: time = sum of shown Time Required lines (matches table). */
function PlanBadge({ count, estimate, loading, qty }) {
  const shownSec = sumShownTimeSeconds(estimate);
  const hasTime = estimate?.valid && (shownSec > 0 || estimate.total_seconds != null);
  return (
    <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
      {loading ? (
        <span className="text-[10px] text-slate-500 flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" /> Est. time…
        </span>
      ) : hasTime ? (
        <span className={`${IMS_TABLE_CELL_TEXT} text-[11px] font-semibold text-slate-700 tabular-nums`}>
          {formatProductionDuration(shownSec || estimate.total_seconds)}
          <span className="text-slate-300 mx-1.5">·</span>
          {estimate.shifts} shift{estimate.shifts === 1 ? "" : "s"} ({estimate.shift_hours}h)
          <span className="text-slate-300 mx-1.5">·</span>
          {Number(estimate.qty ?? qty ?? 0).toLocaleString()} pcs
        </span>
      ) : null}
      {count ? <CountBadge>{count} stages</CountBadge> : null}
    </div>
  );
}

const timeTd = `${TD} ${IMS_TABLE_CELL_TEXT} text-right tabular-nums text-[11px] whitespace-nowrap`;

function stageEstimateRow(estimate, stageNo) {
  if (!estimate?.valid) return null;
  return (estimate.stages || []).find((s) => Number(s.stage_no) === Number(stageNo)) || null;
}

/** Hover: same minute values as cells; multi → header Total = sum of machine Totals. */
function machineTimeTitle(machines) {
  if (!machines?.length) return "";
  const totalSec = machines.reduce((s, m) => s + displayDurationSeconds(m.seconds), 0);
  const totalShifts = machines.reduce((s, m) => s + (Number(m.shifts) || 0), 0);
  const head =
    machines.length > 1
      ? `Multiple machines (${machines.length}) · Total ${formatProductionDuration(totalSec)} · ${totalShifts} shift${totalShifts === 1 ? "" : "s"}`
      : "";
  const lines = machines.map((m) => {
    const name = [m.machine_name, m.machine_number ? `(${m.machine_number})` : null].filter(Boolean).join(" ");
    const setup = displayDurationSeconds(m.setup_seconds);
    const run = displayDurationSeconds(m.run_seconds);
    const total = displayDurationSeconds(m.seconds);
    return `${name || "—"}: Setup ${formatProductionDuration(setup)} · Run ${formatProductionDuration(run)} · Total ${formatProductionDuration(total)} · ${m.shifts ?? 0} shift${m.shifts === 1 ? "" : "s"}`;
  });
  return [head, ...lines].filter(Boolean).join("\n");
}

/**
 * Single M/C → one line. Multiple → stage sum in cell; hover = machine-wise (totals add up to cell).
 */
function TimeShiftCells({ estimate, stageNo, loading }) {
  if (loading) {
    return (
      <td colSpan={2} className={`${TD} border-r-0 text-right`}>
        <Loader2 size={12} className="inline animate-spin text-slate-400" />
      </td>
    );
  }
  const stageRow = stageEstimateRow(estimate, stageNo);
  const machines = stageRow?.machines || [];
  // Fallback: stage total (same as board View drawer Est. time) when machine lines are empty
  if (!machines.length) {
    const secs = displayDurationSeconds(stageRow?.seconds);
    if (secs > 0 || stageRow?.seconds != null) {
      return (
        <>
          <td className={timeTd}>
            <div className="leading-6 font-semibold text-slate-800">{formatProductionDuration(secs)}</div>
          </td>
          <td className={`${timeTd} border-r-0`}>
            <div className="leading-6 font-semibold text-indigo-700">{stageRow?.shifts ?? "—"}</div>
          </td>
        </>
      );
    }
    return (
      <>
        <td className={timeTd}>—</td>
        <td className={`${timeTd} border-r-0`}>—</td>
      </>
    );
  }
  const multi = machines.length > 1;
  const totalSec = machines.reduce((s, m) => s + displayDurationSeconds(m.seconds), 0);
  const totalShifts = machines.reduce((s, m) => s + (Number(m.shifts) || 0), 0);
  const title = machineTimeTitle(machines);
  return (
    <>
      <td className={timeTd} title={title}>
        {multi ? (
          <div className="leading-6 font-semibold text-slate-800">{formatProductionDuration(totalSec)}</div>
        ) : (
          <div className="leading-6 font-semibold text-slate-800">{formatProductionDuration(displayDurationSeconds(machines[0].seconds))}</div>
        )}
      </td>
      <td className={`${timeTd} border-r-0`} title={title}>
        {multi ? (
          <div className="leading-6 font-semibold text-indigo-700">{totalShifts}</div>
        ) : (
          <div className="leading-6 font-semibold text-indigo-700">{machines[0].shifts ?? "—"}</div>
        )}
      </td>
    </>
  );
}

const StageNo = ({ no }) => (
  <td className={`${TD} text-center`}>
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">{no}</span>
  </td>
);

/** Process.tooling → prime/JC tooling status (Pending / Yes / No, same as Tooling module); else —. */
function PlanToolingStatusCell({ processHasTooling, tooling_approved, tooling }) {
  if (!processHasTooling) {
    return <td className={`${TD} text-center text-[11px] text-slate-400`}>{JOB_CARD_PLAN_RM_EMPTY_VIEW}</td>;
  }
  const key = jobCardPlanToolingKey({ tooling_approved, tooling });
  const b = TOOLING_BADGE[key] || TOOLING_BADGE.pending;
  return (
    <td className={`${TD} text-center`}>
      <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase border ${b.cls}`}>{b.label}</span>
    </td>
  );
}

function ViewRmCell({ hasRm, label }) {
  return (
    <td className={`${TD} ${IMS_TABLE_CELL_TEXT} text-[11px] ${hasRm ? "text-slate-800" : "text-slate-400"}`}>
      {hasRm ? label || "—" : JOB_CARD_PLAN_RM_EMPTY_VIEW}
    </td>
  );
}

/**
 * Status column — one control per selected machine (machine-level).
 * Multi M/C: short name + status stacked; single M/C: status only.
 */
function MachineStatusCell({
  machines = [],
  machineIds = [],
  machineStatus = {},
  onChange,
  disabled = false,
  readOnly = false,
}) {
  const ids = (machineIds || []).map(Number).filter(Boolean);
  const byId = new Map((machines || []).map((m) => [Number(m.machine_id), m]));

  if (!ids.length) {
    return <td className={`${TD} text-[11px] text-slate-400`}>—</td>;
  }

  const setOne = (mid, st) => {
    if (!onChange) return;
    onChange({ ...(machineStatus || {}), [mid]: st });
  };

  return (
    <td className={TD}>
      <div className="flex flex-col gap-1">
        {ids.map((mid) => {
          const m = byId.get(mid);
          const name = m?.machine_name || m?.macname || m?.name || m?.macno || `M/C ${mid}`;
          const status = machineStatus?.[mid] || m?.status || "pending";
          return (
            <div key={mid} className="flex items-center gap-1.5 min-w-0">
              {ids.length > 1 ? (
                <span className="w-10 shrink-0 truncate text-[9px] font-bold uppercase text-slate-500" title={name}>
                  {name}
                </span>
              ) : null}
              {readOnly || !onChange ? (
                <span className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-black uppercase ${PROCESS_STATUS_BADGE[status] || ""}`}>
                  {PROCESS_STATUS_LABELS[status] || status}
                </span>
              ) : (
                <select
                  value={status}
                  disabled={disabled}
                  className={`${OK_INPUT} min-w-0 flex-1 text-[10px]`}
                  onChange={(e) => setOne(mid, e.target.value)}
                >
                  {PROCESS_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>{PROCESS_STATUS_LABELS[s] || s}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </td>
  );
}

/** New / Edit body: loading / empty / editable table. RM Available from estimate (backend). */
function PlanBody({ stages, picks, disabled, onPick, estimate, estimateLoading, issueQty, showMachineStatus = false, tooling_approved, tooling }) {
  if (stages === undefined) {
    return (
      <div className="px-4 py-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
        <Loader2 size={14} className="animate-spin" /> Loading prime process…
      </div>
    );
  }
  if (!stages?.length) {
    return <p className="px-4 py-4 text-[11px] text-amber-700">No prime process saved for this item in Engineering → Prime Process Master.</p>;
  }
  return (
    <PlanTable showMachineStatus={showMachineStatus}>
      {stages.map((s) => (
        <StageRow
          key={s.stage_no}
          stage={s}
          pick={picks[s.stage_no] || {}}
          disabled={disabled}
          onChange={(patch) => onPick(s.stage_no, patch)}
          estimate={estimate}
          estimateLoading={estimateLoading}
          issueQty={issueQty}
          showMachineStatus={showMachineStatus}
          tooling_approved={tooling_approved}
          tooling={tooling}
        />
      ))}
    </PlanTable>
  );
}

/** View / Approve — saved process_plan, read only. Tooling comes live from the prime process (`stages`). */
function SavedPlanTable({ plan, stages, estimate, estimateLoading = false, issueQty, showMachineStatus = false, tooling_approved, tooling }) {
  if (!plan?.length) return <p className="px-4 py-4 text-[11px] text-slate-500">No process plan saved.</p>;
  const processOf = (step) =>
    (stages || []).find((s) => s.stage_no === step.stage_no)?.processes.find((p) => p.process_id === step.process_id);
  return (
    <PlanTable showMachineStatus={showMachineStatus}>
      {plan.map((step) => {
        const process = processOf(step);
        const hasRmWire = Boolean(process?.rm_wire);
        const processHasTooling = Boolean(process?.tooling ?? step.tooling);
        const parsed = parseProcessPlan([step])[0] || step;
        return (
          <tr key={step.stage_no}>
            <StageNo no={step.stage_no} />
            <td className={`${TD} ${IMS_TABLE_CELL_TEXT} text-slate-800 font-semibold`}>{step.process_name || "—"}</td>
            <td className={`${TD} ${IMS_TABLE_CELL_TEXT}`}>{machinesText(step) || "—"}</td>
            <ViewRmCell hasRm={hasRmWire} label={rmText(step)} />
            <IssueQtyCell show={hasRmWire} issueQty={issueQty} empty={JOB_CARD_PLAN_RM_EMPTY_VIEW} />
            <RmAvailableCell
              show={hasRmWire}
              availableQty={estimate?.rm_available_by_stage?.[step.stage_no] ?? estimate?.rm_available_by_stage?.[String(step.stage_no)]}
              requiredQty={issueQty}
              loading={estimateLoading}
              empty={JOB_CARD_PLAN_RM_EMPTY_VIEW}
            />
            <PlanToolingStatusCell processHasTooling={processHasTooling} tooling_approved={tooling_approved} tooling={tooling} />
            {showMachineStatus ? (
              <MachineStatusCell
                machines={parsed.machines}
                machineIds={(parsed.machines || []).map((m) => m.machine_id)}
                machineStatus={Object.fromEntries((parsed.machines || []).map((m) => [m.machine_id, m.status || "pending"]))}
                readOnly
              />
            ) : null}
            <TimeShiftCells estimate={estimate} stageNo={step.stage_no} loading={estimateLoading} />
          </tr>
        );
      })}
    </PlanTable>
  );
}

function StageRow({ stage, pick, disabled, onChange, estimate, estimateLoading, issueQty, showMachineStatus = false, tooling_approved, tooling }) {
  const process = stage.processes.find((p) => p.process_id === pick.process_id);
  const processOptions = stage.processes.map((p) => ({ id: p.process_id, label: p.process_name }));
  const machineOptions = (process?.machines || []).map((m) => ({
    id: m.machine_id,
    label: m.macno ? `${m.macname || m.name} (${m.macno})` : (m.macname || m.name),
  }));
  const rmOptions = (process?.rm_items || []).map((r) => ({ id: r.rm_item_dcode, label: r.rm_item_code }));
  const hasRm = Boolean(process?.rm_wire);
  const selectedMachines = (process?.machines || []).filter((m) =>
    (pick.machine_ids || []).map(Number).includes(Number(m.machine_id))
  );

  return (
    <tr>
      <StageNo no={stage.stage_no} />
      <td className={TD}>
        <ListSelect label="Process" options={processOptions} value={pick.process_id} disabled={disabled} onChange={(id) => {
          const next = stage.processes.find((p) => p.process_id === id);
          onChange(next ? defaultsFor(next) : { process_id: null, machine_ids: [], rm_item_dcodes: [], machine_status: {} });
        }} />
      </td>
      <td className={TD}>
        {/* Multiple Job Card ON → many machines, else one */}
        <ListSelect
          key={`m-${pick.process_id}`}
          label="Machine"
          multiple={Boolean(process?.multi_jc)}
          options={machineOptions}
          value={process?.multi_jc ? pick.machine_ids || [] : (pick.machine_ids || [])[0]}
          disabled={disabled || !process}
          onChange={(v) => onChange({ machine_ids: Array.isArray(v) ? v : v == null ? [] : [v] })}
        />
        {process?.multi_jc ? <span className="mt-1 block text-[9px] font-bold uppercase text-indigo-600">Multiple job card</span> : null}
      </td>
      <td className={TD}>
        {hasRm ? (
          // More than one RM → multi-select (all pre-selected, priority order), else single
          <ListSelect
            key={`r-${pick.process_id}`}
            label="RM"
            multiple={rmOptions.length > 1}
            options={rmOptions}
            value={rmOptions.length > 1 ? pick.rm_item_dcodes || [] : (pick.rm_item_dcodes || [])[0]}
            disabled={disabled}
            onChange={(v) => onChange({ rm_item_dcodes: Array.isArray(v) ? v : v == null ? [] : [v] })}
          />
        ) : (
          <span className="text-[11px] text-slate-400">{JOB_CARD_PLAN_RM_EMPTY_EDIT}</span>
        )}
      </td>
      <IssueQtyCell show={hasRm} issueQty={issueQty} />
      <RmAvailableCell
        show={hasRm}
        availableQty={estimate?.rm_available_by_stage?.[stage.stage_no] ?? estimate?.rm_available_by_stage?.[String(stage.stage_no)]}
        requiredQty={issueQty}
        loading={estimateLoading}
      />
      <PlanToolingStatusCell
        processHasTooling={Boolean(process?.tooling)}
        tooling_approved={tooling_approved}
        tooling={tooling}
      />
      {showMachineStatus ? (
        <MachineStatusCell
          machines={selectedMachines}
          machineIds={pick.machine_ids}
          machineStatus={pick.machine_status}
          disabled={disabled}
          onChange={(machine_status) => onChange({ machine_status })}
        />
      ) : null}
      <TimeShiftCells estimate={estimate} stageNo={stage.stage_no} loading={estimateLoading} />
    </tr>
  );
}

/** Select from a fixed list (label = placeholder; the table header names the column). `multiple` → arrays of ids. */
function ListSelect({ label, options, value, disabled, onChange, multiple = false }) {
  return (
    <div className="min-w-0">
      <SearchableSelect
        {...(multiple ? { multiple: true, showTags: true, maxVisibleTags: 6 } : {})}
        value={multiple ? value || [] : value ?? ""}
        onChange={(v) =>
          multiple
            ? onChange((Array.isArray(v) ? v : []).map(Number))
            : onChange(v == null || v === "" ? null : Number(v))
        }
        fetchService={async ({ search = "" }) => {
          const q = String(search).trim().toLowerCase();
          const data = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
          return { data, total: data.length };
        }}
        getByIdService={async (id) => options.find((o) => String(o.id) === String(id)) || null}
        dataKey="id"
        labelKey="label"
        placeholder={`Select ${label.toLowerCase()}…`}
        disabled={disabled}
        heightClass={multiple ? "h-auto min-h-8" : "h-8"}
        preserveApiOrder
        usePortal
        labelOnlyDisplay
      />
    </div>
  );
}
