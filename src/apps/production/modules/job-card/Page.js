"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, ClipboardList, Loader2, Edit3, CheckCircle, CheckCircle2, Check, Shield, MessageSquareQuote } from "lucide-react";
import { toast } from "react-toastify";

import { jobCardService } from "@/apps/production/lib/services/jobCard";
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
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { formatDocDate } from "@/platform/utils/core/utilHelper";
import { auditHeaders } from "@/platform/utils/list/auditListUi";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { DrawerSection, DrawerDetailField, PrimeItemSummary, usePrimeItemList } from "@/apps/production/modules/shortage/primeItem";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import FormTextarea from "@/ui/common/forms/FormTextarea";

/**
 * Production → Maintain Job Card (IMS style — 2 tabs).
 *   Pending Shortage — shortage entries → New (create job card)
 *   Register         — all job cards (filter Pending / Authorized) → Approve / Edit / View / Delete
 */

const MODULE = "production_job_card";
const TABS = [
  { id: "register", label: "Register", icon: CheckCircle2 },
  { id: "pending", label: "Pending Shortage", icon: ClipboardList },
];
const REGISTER_APPROVAL_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Authorized", value: "approved" },
];
const btn = LIST_PAGE_ACTION_CLASS;
const NOT_APPROVED_TIP = "Approve this in Production → Shortage → Prime Item first";
const EMPTY = { rows: [], headers: [] };
const JOB_CARD_STATUSES = ["Open", "Closed", "Cancelled"];
const PAGE_CHUNK = 100;

// Drawers (IMS style)
const DRAWER_WIDTH = "max-w-5xl";
const yesNoLabel = (v) => (v == null ? "—" : v ? "Yes" : "No");

const STATUS_BADGE = {
  Open: "bg-sky-50 text-sky-700 border-sky-100",
  Closed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-100",
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
  ["Approval", "approved", (v) => (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
      {v ? "● AUTHORIZED" : "○ PENDING"}
    </span>
  ), { width: "120px", sortable: false, copyValue: (row) => (row.approved ? "AUTHORIZED" : "PENDING") }],
  ["Status", "status", (v) => <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${STATUS_BADGE[v] || STATUS_BADGE.Open}`}>{v || "—"}</span>, { width: "100px" }],
  ["Remarks", "remarks", (v) => <span className="text-[10px] text-slate-600 truncate block" title={v || ""}>{v || "—"}</span>, { width: "200px", sortable: false }],
  ...auditHeaders(["created", "updated", "approved"]), // Created / Updated / Approved — By + At (IMS)
];

/** Pending (not yet approved) job card row → amber, like IMS pending rows. */
const registerRowClassName = (row) => (row.approved ? "" : "[&_td]:bg-amber-50/70");

export default function JobCardPage() {
  const [tab, setTab] = useState("pending");
  const [opened, setOpened] = useState({ pending: true, register: false });
  const [keys, setKeys] = useState({ shortage: 0, register: 0 });
  const [exportData, setExportData] = useState({ pending: EMPTY, register: EMPTY });
  const [shortageSelected, setShortageSelected] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [createItem, setCreateItem] = useState(null);
  const [drawerCard, setDrawerCard] = useState(null);
  const [deleteCard, setDeleteCard] = useState(null);
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
    if (!row) return toast.info("Select an approved prime item first.");
    if (row.status !== "approved") return toast.info(NOT_APPROVED_TIP);
    setCreateItem(row);
  }, []);

  const openCard = useCallback((card, mode) => {
    if (!card?.docno) return toast.info("Select a job card first.");
    setDrawerCard({ card, mode });
  }, []);

  const showTab = (id) => {
    setTab(id);
    setOpened((o) => ({ ...o, [id]: true }));
    if (id === "pending") setSelectedCard(null);
    if (id === "register") {
      setShortageSelected(null);
      reloadKey("register");
    }
  };

  /** IMS style: Approve opens the card in approve mode (details + SOP → Approve). */
  const openApprove = useCallback(
    (card) => {
      if (card?.approved === true) return toast.info("Already authorized. Edit it before approving again.");
      openCard(card, "approve");
    },
    [openCard]
  );

  const modalOpen = Boolean(createItem || drawerCard || deleteCard);
  const onPending = tab === "pending";
  const onRegister = tab === "register";
  const canApproveSelected = Boolean(selectedCard && selectedCard.approved !== true);

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={<ImsSegmentedTabs active={tab} onChange={showTab} tabs={TABS} />}
            actions={
              <>
                {onPending ? (
                  <ListPageAddButton
                    module={MODULE}
                    disabled={shortageSelected?.status !== "approved"}
                    onClick={() => openCreate(shortageSelected)}
                  />
                ) : null}

                {onRegister ? (
                  <>
                    <ListPageEditButton
                      module={MODULE}
                      icon={Edit3}
                      disabled={!selectedCard}
                      record={selectedCard}
                      onClick={() => openCard(selectedCard, "edit")}
                    />
                    <ActionButton
                      module={MODULE}
                      action="authorize"
                      variant="outline"
                      label="Approve"
                      icon={CheckCircle}
                      disabled={!canApproveSelected}
                      record={selectedCard}
                      onClick={() => openApprove(selectedCard)}
                      className={`${LIST_PAGE_OUTLINE_ACTION} text-emerald-600`}
                    />
                    <ListPageViewButton
                      module={MODULE}
                      disabled={!selectedCard}
                      record={selectedCard}
                      onClick={() => openCard(selectedCard, "view")}
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
              onApproveCard={openApprove}
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
            showTab("register");
          }}
        />
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

const APPROVAL_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Not Approved", value: "pending" },
];

function ShortageTab({ refreshKey, active, viewMode, onDataChange, onSelectionChange, onOpenCreate }) {
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
  });

  return (
    <>
      <ListPageFilterStrip>
        <DateRangeFilter
          showDate={false}
          extraFilters={[{ label: "Approval", key: "approval", value: approval, options: APPROVAL_OPTIONS, preserveOrder: true }]}
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
            onOpenCreate(row);
          }}
          getRowClassName={(row) => (row.status === "approved" ? "" : "opacity-60 [&_td]:bg-slate-100 [&_td]:text-slate-500")}
          emptyIcon={ClipboardList}
          emptyMessage={list.error ? "Could not load pending shortage" : "No pending shortage"}
          emptySubMessage={list.error ? `${list.error} — use the refresh button to try again.` : "All approved shortage entries are already on a job card."}
        />
      </div>

      <AppListFooter {...list.footerProps} />
    </>
  );
}

/* ───────────── Register (one row per job card) ───────────── */

function RegisterTab({ refreshKey, active, viewMode, onDataChange, selectedCard, onSelectCard, onOpenCard, onApproveCard, onDeleteCard }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [approval, setApproval] = useState("all");
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
    let data = approval === "all" ? rows : rows.filter((c) => Boolean(c.approved) === (approval === "approved"));
    if (deferredSearch.trim()) {
      data = applyClientSearch(data, deferredSearch, {
        skipSort: true,
        getParts: (c) => [c.job_card_no, c.prime_item_code, c.prime_item_desc, c.status, ...(c.items || []).map((it) => it.item_code)],
      });
    }
    return sortRowsByKey(data, sort.sortKey, sort.sortDir);
  }, [rows, deferredSearch, sort, approval]);

  const visibleRows = useMemo(() => filteredRows.slice(0, limit), [filteredRows, limit]);

  useEffect(() => {
    onDataChange({ rows: filteredRows, headers: REGISTER_HEADERS });
  }, [filteredRows, onDataChange]);

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: !active,
    selectedId: selectedCard?.docno ?? null,
    getSelectedRow: () => selectedCard,
    openEdit: (row) => onOpenCard(row, "edit"),
    openApprove: (row) => onApproveCard(row),
    canApproveSelection: () => Boolean(selectedCard && selectedCard.approved !== true),
    approveBlockedMessage: "Select a pending job card to approve (Ctrl+Alt+A).",
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
          extraFilters={[{ label: "Approval", key: "approval", value: approval, options: REGISTER_APPROVAL_OPTIONS, preserveOrder: true }]}
          onApply={(data) => {
            setApproval(data.approval || "all");
            setLimit(PAGE_CHUNK);
          }}
          onReset={() => {
            setSearch("");
            setApproval("all");
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
          headers={REGISTER_HEADERS}
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
  const sopAckRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState(undefined);
  const [picks, setPicks] = useState({});
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    let cancelled = false;
    jobCardService
      .getPrimeProcess(item.prime_key)
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
        setStages(null);
        toast.error(err?.message || "Failed to load prime process.");
      });
    return () => {
      cancelled = true;
    };
  }, [item.prime_key]);

  const setPick = (stageNo, patch) => setPicks((prev) => ({ ...prev, [stageNo]: { ...prev[stageNo], ...patch } }));

  const missing = useMemo(() => {
    if (!stages?.length) return "No prime process saved for this item.";
    for (const s of stages) {
      const pick = picks[s.stage_no] || {};
      const process = s.processes.find((p) => p.process_id === pick.process_id);
      if (!process) return `Stage ${s.stage_no}: select a process.`;
      if (process.machines.length && !(pick.machine_ids || []).length) return `Stage ${s.stage_no}: select a machine.`;
      if (process.rm_items.length && !(pick.rm_item_dcodes || []).length) return `Stage ${s.stage_no}: select RM.`;
    }
    return null;
  }, [stages, picks]);

  const close = () => !saving && onClose();

  const submit = async () => {
    if (saving) return;
    if (missing) return toast.error(missing);
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setSaving(true);
    try {
      const plan = stages.map((s) => ({ stage_no: s.stage_no, ...picks[s.stage_no] }));
      const shortageIds = item.shortage_ids ?? (item.children || []).map((c) => c.id);
      const res = await jobCardService.create(item.prime_key, shortageIds, plan, remarks.trim());
      toast.success(res?.message || "Job card created.");
      onSaved();
    } catch (err) {
      toast.error(err?.message || "Failed to create job card.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={close} disabled={saving} className={IMS_DRAWER_BTN_CANCEL}>
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={saving || Boolean(missing)}
        title={missing || "Ctrl+S"}
        className={IMS_DRAWER_BTN_PRIMARY}
      >
        {saving ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Saving...
          </>
        ) : (
          <>
            <Check size={18} /> Save
          </>
        )}
      </button>
    </div>
  );

  return (
    <Drawer isOpen onClose={close} onSubmit={() => void submit()} title="New Job Card" description="Prime item → process · machine · RM per stage" maxWidth={DRAWER_WIDTH} footer={footer}>
      <div className="space-y-3 pb-2">
        <DrawerSection title="Prime Item Details" bar="bg-indigo-500">
          <PrimeItemSummary item={item} jobCard />
        </DrawerSection>

        <Section title={`Process Plan · ${item.prime_item_code || "—"}`} badge={stages?.length ? <CountBadge>{stages.length} stages</CountBadge> : null}>
          <PlanBody stages={stages} picks={picks} disabled={saving} onPick={setPick} />
        </Section>

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

/* ───────────── View / Edit / Approve Job Card drawer (IMS style) ───────────── */

function JobCardDrawer({ card, mode, onClose, onSaved }) {
  const sopAckRef = useRef(null);
  const isView = mode === "view";
  const isApprove = mode === "approve"; // details read only + SOP → Approve
  const readOnly = isView || isApprove;
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("Open");
  const [remarks, setRemarks] = useState("");
  const [jobDate, setJobDate] = useState("");
  const [stages, setStages] = useState(undefined);
  const [picks, setPicks] = useState({});

  const primeCode = detail?.prime_item_code || card?.prime_item_code;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await jobCardService.getById(card.docno);
        if (cancelled) return;
        const row = res?.data || card;
        setDetail(row);
        setStatus(row.status || "Open");
        setRemarks(row.remarks || "");
        setJobDate(String(row.doc_dt ?? row.job_date ?? "").slice(0, 10));

        const plan = Array.isArray(row.process_plan) ? row.process_plan : [];
        const procRes = await jobCardService.getPrimeProcess(row.prime_item_dcode);
        if (cancelled) return;
        const loaded = procRes?.data?.stages ?? null;
        setStages(loaded);
        const nextPicks = {};
        // Saved plan first; a stage without one gets its first process + defaults
        for (const step of plan) {
          nextPicks[step.stage_no] = {
            process_id: step.process_id ?? null,
            machine_ids: (step.machines || []).map((m) => m.machine_id),
            rm_item_dcodes: (step.rm_items || []).map((r) => r.rm_item_dcode),
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

  const setPick = (stageNo, patch) => setPicks((prev) => ({ ...prev, [stageNo]: { ...prev[stageNo], ...patch } }));

  const missing = useMemo(() => {
    if (readOnly || !stages?.length) return null;
    for (const s of stages) {
      const pick = picks[s.stage_no] || {};
      const process = s.processes.find((p) => p.process_id === pick.process_id);
      if (!process) return `Stage ${s.stage_no}: select a process.`;
      if (process.machines.length && !(pick.machine_ids || []).length) return `Stage ${s.stage_no}: select a machine.`;
      if (process.rm_items.length && !(pick.rm_item_dcodes || []).length) return `Stage ${s.stage_no}: select RM.`;
    }
    return null;
  }, [readOnly, stages, picks]);

  const close = () => !saving && onClose();

  const submit = async () => {
    if (isView || saving) return;
    if (missing) return toast.error(missing);
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setSaving(true);
    try {
      let res;
      if (isApprove) {
        res = await jobCardService.approve(card.docno);
      } else {
        const body = { status, remarks, job_date: jobDate || undefined };
        if (stages?.length) body.process_plan = stages.map((s) => ({ stage_no: s.stage_no, ...picks[s.stage_no] }));
        res = await jobCardService.update(card.docno, body);
      }
      toast.success(res?.message || (isApprove ? "Job card approved." : "Job card updated."));
      onSaved();
    } catch (err) {
      toast.error(err?.message || "Failed to update job card.");
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={close} disabled={saving} className={IMS_DRAWER_BTN_CANCEL}>
        {isView ? "Close" : "Cancel"}
      </button>
      {isApprove ? (
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || loading}
          title="Ctrl+S"
          className={IMS_DRAWER_BTN_APPROVE}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
          Approve
        </button>
      ) : !isView ? (
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || loading || Boolean(missing)}
          title={missing || "Ctrl+S"}
          className={IMS_DRAWER_BTN_PRIMARY}
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Check size={18} /> Save
            </>
          )}
        </button>
      ) : null}
    </div>
  );

  const cardNo = detail?.job_card_no || card.job_card_no || "Job Card";

  return (
    <Drawer
      isOpen
      onClose={close}
      onSubmit={isView ? close : () => void submit()}
      title={isApprove ? `Approve ${cardNo}` : isView ? `View ${cardNo}` : `Edit ${cardNo}`}
      description={detail?.prime_item_code ? `Prime item ${detail.prime_item_code}` : undefined}
      maxWidth={DRAWER_WIDTH}
      footer={footer}
    >
      {loading || !detail ? (
        <div className="py-10 flex items-center justify-center text-[11px] text-slate-500 gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <DrawerSection title="Prime Item Details" bar="bg-indigo-500">
            <PrimeItemSummary
              item={{
                ...detail,
                total_qty: detail.qty,
                total_weight_kg: detail.total_weight_kg,
                weight_missing: detail.weight_missing,
                items: detail.items,
                rm: detail.rm,
                process_tooling: detail.process_tooling,
              }}
              jobCard
              extra={
                <DrawerDetailField
                  label="Job Card No"
                  value={<span className="font-mono font-bold text-indigo-700">{detail.job_card_no}</span>}
                />
              }
            />
          </DrawerSection>

          <Section title="Job Card" badge={<ApprovalBadge approved={detail.approved} />}>
            <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="min-w-0 space-y-1">
                <FormLabel>Doc Date</FormLabel>
                {readOnly ? (
                  <span className={`${IMS_TABLE_CELL_TEXT} text-[12px] text-slate-800 tabular-nums`}>{formatDocDate(detail.doc_dt ?? detail.job_date) || "—"}</span>
                ) : (
                  <input type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} disabled={saving} className={OK_INPUT} />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <FormLabel>Status</FormLabel>
                {readOnly ? (
                  <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${STATUS_BADGE[detail.status] || STATUS_BADGE.Open}`}>{detail.status || "—"}</span>
                ) : (
                  <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={saving} className={OK_INPUT}>
                    {JOB_CARD_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </Section>

          <Section title={`Process Plan · ${primeCode || "—"}`} badge={<CountBadge>{(readOnly ? detail.process_plan : stages)?.length || 0} stages</CountBadge>}>
            {readOnly ? (
              <SavedPlanTable plan={detail.process_plan} stages={stages} />
            ) : (
              <PlanBody stages={stages} picks={picks} disabled={saving} onPick={setPick} />
            )}
          </Section>

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
              permissionType={isApprove ? "authorize" : "edit"}
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
  return {
    process_id: process.process_id,
    machine_ids: process.multi_jc ? machineIds : machineIds.slice(0, 1),
    rm_item_dcodes: process.rm_items.map((r) => r.rm_item_dcode), // all RM, priority order as saved
  };
}

/* ───────────── Drawer UI pieces (IMS style) ───────────── */

/** IMS drawer card: bordered, header bar + title, optional badge on the right. */
function Section({ title, badge = null, children }) {
  return (
    <div className="border border-slate-200 bg-white shadow-sm rounded-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <div className="w-1 h-4 bg-indigo-500 rounded-full shrink-0" />
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{title}</span>
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

const ApprovalBadge = ({ approved }) => (
  <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${approved ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
    {approved ? "● Authorized" : "○ Pending"}
  </span>
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

const TH = "px-2 py-1.5 text-[10px] font-bold uppercase text-slate-700 bg-slate-100 border-b border-r border-slate-200 align-middle text-left";
const TD = "px-2 py-1.5 border-b border-r border-slate-100 align-top";

function PlanTable({ children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${TH} w-14 text-center`}>Stage</th>
            <th className={`${TH} w-[24%]`}>Process</th>
            <th className={TH}>Machine</th>
            <th className={`${TH} w-[24%]`}>RM</th>
            <th className={`${TH} w-20 text-center border-r-0`}>Tooling</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const StageNo = ({ no }) => (
  <td className={`${TD} text-center`}>
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">{no}</span>
  </td>
);

const ToolingCell = ({ on }) => (
  <td className={`${TD} text-center border-r-0`}>
    {on ? (
      <span className="px-1.5 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-100">Yes</span>
    ) : (
      <span className="text-[11px] font-semibold text-slate-500">No</span>
    )}
  </td>
);

/** New / Edit body: loading / empty / editable table. */
function PlanBody({ stages, picks, disabled, onPick }) {
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
    <PlanTable>
      {stages.map((s) => (
        <StageRow key={s.stage_no} stage={s} pick={picks[s.stage_no] || {}} disabled={disabled} onChange={(patch) => onPick(s.stage_no, patch)} />
      ))}
    </PlanTable>
  );
}

/** View / Approve — saved process_plan, read only. Tooling comes live from the prime process (`stages`). */
function SavedPlanTable({ plan, stages }) {
  if (!plan?.length) return <p className="px-4 py-4 text-[11px] text-slate-500">No process plan saved.</p>;
  const toolingOf = (step) =>
    (stages || []).find((s) => s.stage_no === step.stage_no)?.processes.find((p) => p.process_id === step.process_id)?.tooling;
  return (
    <PlanTable>
      {plan.map((step) => (
        <tr key={step.stage_no}>
          <StageNo no={step.stage_no} />
          <td className={`${TD} ${IMS_TABLE_CELL_TEXT} text-slate-800 font-semibold`}>{step.process_name || "—"}</td>
          <td className={`${TD} ${IMS_TABLE_CELL_TEXT}`}>{machinesText(step) || "—"}</td>
          <td className={`${TD} ${IMS_TABLE_CELL_TEXT}`}>{rmText(step) || "—"}</td>
          <ToolingCell on={toolingOf(step)} />
        </tr>
      ))}
    </PlanTable>
  );
}

function StageRow({ stage, pick, disabled, onChange }) {
  const process = stage.processes.find((p) => p.process_id === pick.process_id);
  const processOptions = stage.processes.map((p) => ({ id: p.process_id, label: p.process_name }));
  const machineOptions = (process?.machines || []).map((m) => ({ id: m.machine_id, label: m.number ? `${m.name} (${m.number})` : m.name }));
  const rmOptions = (process?.rm_items || []).map((r) => ({ id: r.rm_item_dcode, label: r.rm_item_code }));

  return (
    <tr>
      <StageNo no={stage.stage_no} />
      <td className={TD}>
        <ListSelect label="Process" options={processOptions} value={pick.process_id} disabled={disabled} onChange={(id) => {
          const next = stage.processes.find((p) => p.process_id === id);
          onChange(next ? defaultsFor(next) : { process_id: null, machine_ids: [], rm_item_dcodes: [] });
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
        {process?.rm_wire ? (
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
          <span className="text-[11px] text-slate-400">No RM</span>
        )}
      </td>
      <ToolingCell on={process?.tooling} />
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
