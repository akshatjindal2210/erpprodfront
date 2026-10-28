"use client";

/**
 * Job Card Board + Calendar (authorized cards only).
 * Board = machine columns · Calendar = CL Task Report matrix (Process → Machine × Date → Shift).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, closestCorners, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LayoutGrid, CalendarDays, RefreshCw, ZoomIn, ZoomOut, Maximize2, Minimize2, Loader2, ChevronLeft, ChevronRight, GripVertical, Play, Pause, Square, Inbox, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import EmptyState from "@/ui/common/table/EmptyState";
import { UNASSIGNED, RANGE_MODES, STATUS_FILTER_OPTIONS, PLANNING_MODULE, SHIFTS_PER_DAY, isValidShift, updateJobCardStatus, updateJobCardPosition, updateJobCardSchedule, machineBusyStatus, startOfWeek,
  startOfMonth, rangeDateKeys, rangeLabel, stepAnchor, toDateKey, collectProcessOptions, cardMatchesProcessFilter, cardMatchesMachineFilter, machineIdsForProcesses, resolveBoardColumnId, resolveJobCardDocno } from "@/apps/production/modules/job-card-board/board";
import { setPlanLineStatus } from "@/apps/production/modules/plan/planTable";
import JobCardViewDrawer from "@/apps/production/modules/job-card-board/ViewDrawer";
import JobCardReportCalendar, { parseCalSlot } from "@/apps/production/modules/job-card-board/JobCardReportCalendar";
import ProductionFilters, { useProductionFilterIds } from "@/apps/production/modules/job-card-board/ProductionFilters";
import { useJobCardBoard } from "@/apps/production/modules/job-card-board/useJobCardBoard";
import { useJobCardBoardRealtime } from "@/apps/production/modules/job-card-board/useJobCardBoardRealtime";

const MODULE = PLANNING_MODULE;
const ZOOM_KEY = "production.jobCardBoard.zoom";
const RANGE_KEY = "production.jobCardBoard.calRange";
const MODE_KEY = "production.jobCardBoard.mode"; // comfort | quick
const COL_W = { comfort: 288, quick: 240 };
const btn = `${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`;
const modeBtn = (on) => `${LIST_PAGE_ACTION_CLASS} px-3 border flex items-center justify-center ${on ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`;

const STATUS_BADGE = {
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Planning: "bg-sky-50 text-sky-700 border-sky-100",
  Running: "bg-indigo-50 text-indigo-700 border-indigo-100",
  Hold: "bg-rose-50 text-rose-700 border-rose-100",
  Complete: "bg-emerald-50 text-emerald-700 border-emerald-100",
};
const STATUS_BAR = {
  Pending: "bg-amber-400",
  Planning: "bg-sky-400",
  Running: "bg-indigo-500",
  Hold: "bg-rose-500",
  Complete: "bg-emerald-500",
};
const MACHINE_DOT = { running: "bg-emerald-500", idle: "bg-slate-400", down: "bg-rose-500" };
const ACTIONS = [
  { key: "start", label: "Start", status: "Running", Icon: Play, cls: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { key: "hold", label: "Hold", status: "Hold", Icon: Pause, cls: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { key: "complete", label: "Complete", status: "Complete", Icon: Square, cls: "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100" },
];

function canAction(status, key) {
  if (status === "Complete") return false;
  if (key === "start") return status !== "Running";
  if (key === "hold") return status === "Running";
  if (key === "complete") return status !== "Complete";
  return false;
}

function colId(m) {
  return m == null || m === "" ? UNASSIGNED : String(m);
}

function moveCard(cards, cardId, toMachineId, newIndex) {
  const moving = cards.find((c) => String(c.id) === String(cardId));
  if (!moving) return cards;
  const machine_id = toMachineId === UNASSIGNED || toMachineId == null ? null : Number(toMachineId) || toMachineId;
  const without = cards.filter((c) => String(c.id) !== String(cardId));
  const inCol = without.filter((c) => colId(c.machine_id) === colId(machine_id)).sort((a, b) => a.position - b.position);
  inCol.splice(Math.max(0, Math.min(newIndex, inCol.length)), 0, { ...moving, machine_id });
  const moved = inCol.map((c, i) => ({ ...c, machine_id, position: i }));
  const ids = new Set(moved.map((c) => String(c.id)));
  return [...without.filter((c) => !ids.has(String(c.id))), ...moved];
}

function DetailRow({ label, value, mono = false, empty = false }) {
  if (!empty && (value == null || value === "")) return null;
  const text = value == null || value === "" ? "—" : value;
  return (
    <div className="flex items-baseline gap-1.5 text-[10px] leading-snug">
      <span className="w-11 shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`min-w-0 flex-1 break-words font-semibold text-slate-700 ${mono ? "font-mono text-indigo-700" : ""}`} title={text}>
        {text}
      </span>
    </div>
  );
}

/** Advance calendar by N production shifts (SHIFTS_PER_DAY from jobCard.config). Date only. */
function estimateDateFromShifts(startDate, shiftNo, shiftCount) {
  const n = Math.max(0, Math.floor(Number(shiftCount) || 0));
  const perDay = Math.max(1, SHIFTS_PER_DAY);
  if (!startDate || !n) return null;
  const startShift = isValidShift(shiftNo) ? Number(shiftNo) : 1;
  const endIndex = startShift - 1 + n - 1;
  const dayOffset = Math.floor(endIndex / perDay);
  const d = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cardEstimateLabel(card) {
  if (card.estimate_date) return card.estimate_date;
  return estimateDateFromShifts(card.date, card.shift, card.est_shifts);
}

/** Board card body: JC · item · Planning · qty · start + stage-1 machine shifts required · est. */
function CardBody({ card, dense }) {
  const qtyLabel = Number(card.qty || 0).toLocaleString();
  const nShifts = Number(card.est_shifts);
  const shiftsReq = Number.isFinite(nShifts) && nShifts > 0 ? `${nShifts} shift${nShifts === 1 ? "" : "s"}` : null;
  // Start date + Stage 1 machine-level shifts required (e.g. 2026-10-23 · 8 shifts)
  const startLabel = [card.date || null, shiftsReq].filter(Boolean).join(" · ") || null;
  const estLabel = cardEstimateLabel(card);

  if (dense) {
    return (
      <>
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-[9px] font-bold text-indigo-600">{card.job_card_no}</span>
          {card.status ? (
            <span className={`border px-1 py-0.5 text-[7px] font-black uppercase ${STATUS_BADGE[card.status] || ""}`}>{card.status}</span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[9px] font-bold uppercase text-slate-800">{card.prime_item_code || "—"}</p>
        {card.title ? <p className="truncate text-[8px] font-medium text-slate-500">{card.title}</p> : null}
        <p className="mt-0.5 truncate text-[8px] font-semibold text-slate-600" title={`Qty ${qtyLabel} · Start ${startLabel || "—"}`}>
          {qtyLabel}
          {startLabel ? ` · ${startLabel}` : ""}
        </p>
      </>
    );
  }
  return (
    <>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] font-bold text-indigo-600">{card.job_card_no}</span>
        {card.status ? (
          <span className={`border px-1.5 py-0.5 text-[9px] font-black uppercase ${STATUS_BADGE[card.status] || ""}`}>{card.status}</span>
        ) : null}
      </div>
      <p className="mt-1 truncate text-[11px] font-bold uppercase text-slate-800">{card.prime_item_code || "—"}</p>
      {card.title ? <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-slate-600">{card.title}</p> : null}
      <div className="mt-2 space-y-1 border-t border-slate-100 pt-1.5">
        <DetailRow label="Qty" value={qtyLabel} mono />
        <DetailRow label="Start" value={startLabel} empty />
        <DetailRow label="Est" value={estLabel} empty />
      </div>
    </>
  );
}

function BoardCard({ card, canEdit, busyId, onOpen, onAction, dense }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(card.id), disabled: !canEdit });
  const busy = busyId === String(card.id);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className={`group relative border border-slate-200 bg-white hover:border-indigo-300 ${dense ? "p-1.5 pl-2.5" : "p-2.5 pl-3.5"}`}
      {...attributes}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${STATUS_BAR[card.status] || "bg-slate-300"}`} />
      <div className="flex gap-1.5">
        {canEdit ? (
          <button type="button" className="mt-0.5 cursor-grab touch-none text-slate-300 hover:text-slate-500" {...listeners}>
            <GripVertical size={dense ? 12 : 14} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <button type="button" className="w-full text-left" onClick={() => onOpen(card)}>
            <CardBody card={card} dense={dense} />
          </button>
          <div className={`${dense ? "mt-1.5" : "mt-2"} grid grid-cols-3 gap-1 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {ACTIONS.map(({ key, label, status, Icon, cls }) => {
              const enabled = canEdit && canAction(card.status, key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!enabled || busy}
                  className={`inline-flex items-center justify-center gap-0.5 border px-1 py-1 font-black uppercase tracking-wide disabled:opacity-40 ${dense ? "text-[8px]" : "text-[9px]"} ${cls}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (enabled) onAction?.(card, status, label);
                  }}
                >
                  <Icon size={dense ? 9 : 10} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MachineCol({ id, title, code, status, cards, canEdit, busyId, onOpen, onAction, dense }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
  const w = dense ? COL_W.quick : COL_W.comfort;
  return (
    <div className={`flex shrink-0 flex-col border bg-slate-50 ${isOver ? "border-indigo-400" : "border-slate-300"}`} style={{ width: w, minWidth: w }}>
      <div className={`border-b border-slate-200 bg-white ${dense ? "px-2 py-1.5" : "px-2.5 py-2"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {status ? <span className={`h-2 w-2 rounded-full ${MACHINE_DOT[status] || MACHINE_DOT.idle}`} /> : null}
              <span className={`truncate font-bold uppercase text-slate-800 ${dense ? "text-[10px]" : "text-[11px]"}`}>{title}</span>
            </div>
            {code ? (
              <p className={`mt-0.5 font-mono font-bold text-indigo-600 ${dense ? "text-[9px]" : "text-[10px]"}`}>
                {code} <span className="font-semibold uppercase text-slate-500">· {status}</span>
              </p>
            ) : null}
          </div>
          <span className={`border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-black text-slate-600 ${dense ? "text-[9px]" : "text-[10px]"}`}>{cards.length}</span>
        </div>
      </div>
      <div ref={setNodeRef} className={`flex flex-1 flex-col p-2 ${dense ? "gap-1.5" : "gap-2"} ${isOver ? "bg-indigo-50/40" : ""}`} style={{ minHeight: dense ? 96 : 120 }}>
        <SortableContext items={cards.map((c) => String(c.id))} strategy={verticalListSortingStrategy}>
          {cards.length === 0 ? (
            <div className={`flex flex-1 items-center justify-center border border-dashed border-slate-200 bg-white font-semibold text-slate-400 ${dense ? "py-6 text-[10px]" : "py-8 text-[11px]"}`}>—</div>
          ) : (
            cards.map((card) => <BoardCard key={card.id} card={card} canEdit={canEdit} busyId={busyId} onOpen={onOpen} onAction={onAction} dense={dense} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export default function JobCardBoardPage({ initialView = "board" }) {
  const canAccess = useCanAccess();
  const canView = canAccess(MODULE, "view").allowed;
  const canEdit = canAccess(MODULE, "edit").allowed;

  const { machines, setMachines, cards, setCards, loading, error, load, isBoard } = useJobCardBoard(initialView);
  useJobCardBoardRealtime({ enabled: canView });
  const { processIds, machineIds, shiftIds, statusFromUrl } = useProductionFilterIds();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(statusFromUrl || "all");
  const [range, setRange] = useState("week");
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [mode, setMode] = useState("comfort"); // comfort | quick
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const dense = mode === "quick";
  const [activeId, setActiveId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [viewCard, setViewCard] = useState(null);
  const boardRef = useRef(null);
  const scrollRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setStatusFilter(statusFromUrl || "all");
  }, [statusFromUrl]);

  useEffect(() => {
    try {
      const z = Number(localStorage.getItem(ZOOM_KEY));
      if (z >= 0.5 && z <= 1.5) setZoom(z);
      const r = localStorage.getItem(RANGE_KEY);
      if (r === "week" || r === "month" || r === "2months") setRange(r);
      const m = localStorage.getItem(MODE_KEY);
      if (m === "comfort" || m === "quick") setMode(m);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullScreen(document.fullscreenElement === boardRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => {
        const next = Math.min(1.5, Math.max(0.5, Math.round((z + (e.deltaY > 0 ? -0.1 : 0.1)) * 10) / 10));
        try {
          localStorage.setItem(ZOOM_KEY, String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [loading, isBoard]);

  function setZoomPersist(next) {
    const z = Math.min(1.5, Math.max(0.5, Math.round(next * 10) / 10));
    setZoom(z);
    try {
      localStorage.setItem(ZOOM_KEY, String(z));
    } catch {
      /* ignore */
    }
  }

  function setModePersist(next) {
    if (next !== "comfort" && next !== "quick") return;
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function setRangePersist(next) {
    setRange(next);
    setAnchor(next === "week" ? startOfWeek(new Date()) : startOfMonth(new Date()));
    try {
      localStorage.setItem(RANGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const q = search.trim().toLowerCase();
  const calendarDateKeys = useMemo(
    () => (isBoard ? [] : rangeDateKeys(anchor, range).sort()),
    [anchor, range, isBoard]
  );
  const visibleKeys = useMemo(() => new Set(calendarDateKeys), [calendarDateKeys]);

  const processOptions = useMemo(() => collectProcessOptions(cards), [cards]);
  const machineOptions = useMemo(() => {
    const list = [
      { label: "Unassigned", value: UNASSIGNED },
      ...machines.map((m) => ({ label: `${m.code} — ${m.name}`, value: String(m.id) })),
    ];
    // Calendar: still offer machines seen on cards
    if (!isBoard) {
      const seen = new Set(list.map((o) => o.value));
      for (const c of cards) {
        if (c.machine_id == null) continue;
        const id = String(c.machine_id);
        if (seen.has(id)) continue;
        seen.add(id);
        list.push({ label: c.machine || `Machine ${id}`, value: id });
      }
    }
    return list;
  }, [machines, cards, isBoard]);

  const visible = cards.filter((c) => {
    if (!isBoard && (!c.date || !visibleKeys.has(c.date))) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (!cardMatchesProcessFilter(c, processIds)) return false;
    if (!cardMatchesMachineFilter(c, machineIds, { fromPlan: isBoard })) return false;
    if (!isBoard && shiftIds.length) {
      if (shiftIds.length === 1 && shiftIds[0] === "__none__") return false;
      if (!shiftIds.includes(String(c.shift))) return false;
    }
    if (!q) return true;
    return [c.job_card_no, c.prime_item_code, c.title, c.process, c.machine, c.status].join(" ").toLowerCase().includes(q);
  });

  /** Board columns allowed by Process ∩ Machine filters. */
  const boardColIdSet = useMemo(() => {
    if (!isBoard) return null;
    const noneMachine = machineIds.length === 1 && machineIds[0] === "__none__";
    const noneProcess = processIds.length === 1 && processIds[0] === "__none__";
    if (noneMachine || noneProcess) return new Set();

    let allowed = null;
    const fromProcess = machineIdsForProcesses(cards, processIds);
    if (fromProcess) allowed = fromProcess;

    if (machineIds.length) {
      const mid = new Set(machineIds.map(String));
      allowed = allowed ? new Set([...allowed].filter((id) => mid.has(id))) : mid;
    }
    return allowed; // null = all columns
  }, [isBoard, cards, processIds, machineIds]);

  const columns = isBoard
    ? [
        {
          id: UNASSIGNED,
          title: "Unassigned",
          code: "",
          status: null,
        },
        ...machines.map((m) => ({
          id: String(m.id),
          title: m.name,
          code: m.code,
          status: m.status,
        })),
      ]
        .filter((col) => {
          if (!boardColIdSet) {
            if (col.id === UNASSIGNED) {
              return visible.some((c) => resolveBoardColumnId(c, null) === UNASSIGNED);
            }
            return true;
          }
          return boardColIdSet.has(String(col.id));
        })
        .map((col) => ({
          ...col,
          cards: visible
            .filter((c) => resolveBoardColumnId(c, boardColIdSet) === String(col.id))
            .sort((a, b) => a.position - b.position),
        }))
    : [];

  const openCard = (c) => setViewCard(c);

  async function onBoardDragEnd(event) {
    setActiveId(null);
    if (!canEdit || !event.over) return;
    const cardId = String(event.active.id);
    const overId = String(event.over.id);
    const moving = cards.find((c) => String(c.id) === cardId);
    if (!moving) return;

    let toCol = overId.startsWith("col-") ? overId.slice(4) : null;
    let newIndex = 0;
    if (!toCol) {
      const overCard = cards.find((c) => String(c.id) === overId);
      if (!overCard) return;
      toCol = colId(overCard.machine_id);
      const list = columns.find((c) => c.id === toCol)?.cards || [];
      newIndex = list.findIndex((c) => String(c.id) === overId);
      if (newIndex < 0) newIndex = list.length;
      if (colId(moving.machine_id) === toCol) {
        const oldIndex = list.findIndex((c) => String(c.id) === cardId);
        if (oldIndex >= 0 && oldIndex < newIndex) newIndex -= 1;
      }
    } else {
      newIndex = (columns.find((c) => c.id === toCol)?.cards || []).length;
    }

    const fromCol = colId(moving.machine_id);
    if (toCol === UNASSIGNED && fromCol !== UNASSIGNED) {
      toast.info("A job card needs a machine — drop it on a machine column.");
      return;
    }
    const prev = cards;
    setCards(moveCard(cards, cardId, toCol, newIndex));
    if (toCol === fromCol) return; // reorder inside a column — nothing to save
    try {
      await updateJobCardPosition(moving, toCol === UNASSIGNED ? null : toCol, moving.machine_id);
    } catch (e) {
      setCards(prev);
      toast.error(e?.message || "Move failed — reverted.");
    }
  }

  async function onCalDragEnd(event) {
    setActiveId(null);
    if (!canEdit || !event.over) return;
    const cardId = String(event.active.id);
    const moving = cards.find((c) => String(c.id) === cardId);
    if (!moving) return;
    let target = parseCalSlot(String(event.over.id));
    if (!target) {
      const overCard = cards.find((c) => String(c.id) === String(event.over.id));
      if (overCard?.date) target = { date: overCard.date, shift: Number(overCard.shift) || 1 };
    }
    if (!target?.date || !isValidShift(target.shift)) return;
    if (moving.date === target.date && Number(moving.shift) === target.shift) return;
    const prev = cards;
    setCards((list) => list.map((c) => (String(c.id) === cardId ? { ...c, date: target.date, shift: target.shift } : c)));
    try {
      await updateJobCardSchedule(moving, target.date, target.shift);
      toast.success(`${moving.job_card_no} → ${target.date} · Shift ${target.shift}`);
    } catch (e) {
      setCards(prev);
      toast.error(e?.message || "Schedule move failed — reverted.");
    }
  }

  async function onBoardAction(card, status, label) {
    if (!canEdit || busyId) return;
    const jcDocno = resolveJobCardDocno(card);
    if (!jcDocno) return toast.error("Job card not found.");
    const id = String(card.id);
    const prevCards = cards;
    const prevMachines = machines;
    const nextCards = cards.map((c) => (String(c.id) === id ? { ...c, status } : c));
    setBusyId(id);
    setCards(nextCards);
    setMachines((ms) => ms.map((m) => ({ ...m, status: machineBusyStatus(m.id, nextCards) })));
    const statusApi = { Running: "running", Hold: "hold", Complete: "complete" }[status];
    try {
      if (statusApi && card.processId != null) {
        await setPlanLineStatus(jcDocno, card.processId, card.machine_id, statusApi);
      } else {
        await updateJobCardStatus(jcDocno, status);
      }
      toast.success(`${card.job_card_no}: ${label}`);
      await load();
    } catch (e) {
      setCards(prevCards);
      setMachines(prevMachines);
      toast.error(e?.message || `${label} failed.`);
    } finally {
      setBusyId(null);
    }
  }

  if (!canView) {
    return <div className="p-8 text-sm text-slate-500">You do not have permission to view Production Planning.</div>;
  }

  const activeCard = cards.find((c) => String(c.id) === String(activeId));

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      {viewCard ? <JobCardViewDrawer card={viewCard} onClose={() => setViewCard(null)} /> : null}
      <div
        ref={boardRef}
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-slate-300 bg-white shadow-sm ${isFullScreen ? "h-screen w-screen" : ""}`}
      >
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <div className="flex items-center gap-2 px-1">
                {isBoard ? <LayoutGrid size={14} className="text-indigo-600" /> : <CalendarDays size={14} className="text-indigo-600" />}
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">Job Card {isBoard ? "Board" : "Calendar"}</span>
              </div>
            }
            actions={
              <>
                {!isBoard ? (
                  <>
                    <div className="mx-0.5 hidden h-6 w-px bg-slate-300 sm:block" />
                    {RANGE_MODES.map((m) => (
                      <button key={m.id} type="button" className={modeBtn(range === m.id)} onClick={() => setRangePersist(m.id)}>{m.label}</button>
                    ))}
                    <div className="mx-0.5 hidden h-6 w-px bg-slate-300 sm:block" />
                    <button type="button" className={btn} onClick={() => setAnchor((a) => stepAnchor(a, range, -1))}><ChevronLeft size={14} /></button>
                    <button
                      type="button"
                      className={`${btn} min-w-[10rem] px-2 text-[11px] font-bold text-slate-700`}
                      onClick={() => setAnchor(range === "week" ? startOfWeek(new Date()) : startOfMonth(new Date()))}
                    >
                      {rangeLabel(anchor, range)}
                    </button>
                    <button type="button" className={btn} onClick={() => setAnchor((a) => stepAnchor(a, range, 1))}><ChevronRight size={14} /></button>
                  </>
                ) : null}
                {isBoard ? (
                  <>
                    <div className="mx-0.5 hidden h-6 w-px bg-slate-300 sm:block" />
                    <button type="button" className={modeBtn(mode === "comfort")} onClick={() => setModePersist("comfort")}>Comfort</button>
                    <button type="button" className={modeBtn(mode === "quick")} onClick={() => setModePersist("quick")}>Quick</button>
                    <div className="mx-0.5 hidden h-6 w-px bg-slate-300 sm:block" />
                    <button type="button" className={btn} onClick={() => setZoomPersist(zoom - 0.1)}><ZoomOut size={14} /></button>
                    <span className="min-w-[2.5rem] text-center text-[11px] font-bold tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
                    <button type="button" className={btn} onClick={() => setZoomPersist(zoom + 0.1)}><ZoomIn size={14} /></button>
                  </>
                ) : null}
                <button type="button" className={btn} onClick={() => (isFullScreen ? document.exitFullscreen?.() : boardRef.current?.requestFullscreen?.())}>
                  {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button type="button" className={btn} onClick={load} aria-label="Refresh">
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </>
            }
          />
        </ListPageToolbar>

        <ProductionFilters
          processOptions={processOptions}
          machineOptions={machineOptions}
          search={search}
          onSearchChange={setSearch}
          searchLabel={isBoard ? "Search Board" : "Search Calendar"}
          searchPlaceholder={isBoard ? "Search job card, item, process…" : "Search JC no, item, machine…"}
          statusFilter={statusFilter}
          statusOptions={STATUS_FILTER_OPTIONS}
          onStatusChange={setStatusFilter}
          showShiftFilter={!isBoard}
        />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          {loading ? (
            <div className="absolute inset-0 z-[90] flex items-center justify-center bg-white/85">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-lg">
                <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
                <span className="text-sm font-semibold text-slate-800">Loading…</span>
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
              <EmptyState
                isTable={false}
                icon={AlertCircle}
                message="Could not load job cards"
                subMessage={`${error} — use Try again to reload.`}
              />
              <button type="button" className={`${btn} -mt-8`} onClick={load}>
                <RefreshCw size={12} className="mr-1.5" />
                Try again
              </button>
            </div>
          ) : null}

          {!loading && !error && isBoard && machines.length === 0 && cards.length === 0 ? (
            <EmptyState
              isTable={false}
              icon={Inbox}
              message="No authorized job cards"
              subMessage="Authorize a job card in Maintain Job Card, then it will appear here."
            />
          ) : null}

          {!loading && !error && !isBoard && cards.length === 0 ? (
            <EmptyState
              isTable={false}
              icon={Inbox}
              message="No authorized job cards"
              subMessage="Authorize a job card in Maintain Job Card, then it will appear here."
            />
          ) : null}

          {!loading && !error && (isBoard ? machines.length > 0 || cards.length > 0 : cards.length > 0 && calendarDateKeys.length > 0) ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={(e) => canEdit && setActiveId(String(e.active.id))}
              onDragCancel={() => setActiveId(null)}
              onDragEnd={isBoard ? onBoardDragEnd : onCalDragEnd}
            >
              {isBoard ? (
                <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
                  <div className="origin-top-left" style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%`, height: `${100 / zoom}%` }}>
                    <div className="flex gap-3 p-3" style={{ width: "max-content" }}>
                      {columns.map((col) => (
                        <MachineCol key={col.id} {...col} canEdit={canEdit} busyId={busyId} onOpen={openCard} onAction={onBoardAction} dense={dense} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <JobCardReportCalendar
                    dateKeys={calendarDateKeys}
                    cards={visible}
                    machines={machines}
                    processIds={processIds}
                    machineIds={machineIds}
                    processOptions={processOptions}
                    canEdit={canEdit}
                    onOpen={openCard}
                  />
                </div>
              )}
              <DragOverlay dropAnimation={null}>
                {activeCard ? (
                  isBoard ? (
                    <div className="w-[220px] border border-indigo-400 bg-white p-2.5 shadow-md">
                      <span className="font-mono text-[11px] font-bold text-indigo-600">{activeCard.job_card_no}</span>
                      <p className="text-[11px] font-bold text-slate-800">{activeCard.prime_item_code}</p>
                    </div>
                  ) : (
                    <div className="flex h-5 min-w-[4.5rem] items-center rounded-sm border border-indigo-400 bg-indigo-50 px-1.5 shadow-md">
                      <span className="font-mono text-[9px] font-bold tabular-nums text-indigo-800">{activeCard.job_card_no}</span>
                    </div>
                  )
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : null}
        </div>
      </div>
    </div>
  );
}
