"use client";

/**
 * Job Card Board + Calendar (authorized cards only).
 * Board = machines · Calendar = day × shift (week / month / 2 months).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, closestCorners, useSensor, useSensors, useDroppable, useDraggable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LayoutGrid, CalendarDays, RefreshCw, ZoomIn, ZoomOut, Maximize2, Minimize2, Loader2, ChevronLeft, ChevronRight, GripVertical, Play, Pause, Square } from "lucide-react";
import { toast } from "react-toastify";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { ROUTES } from "@/apps/production/lib/utils/routes";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import { ListPageAddButton } from "@/ui/common/list/listPageCrud";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import { UNASSIGNED, SHIFTS, RANGE_MODES, WEEKDAYS, STATUS_OPTS, fetchBoard, fetchCalendar, updateJobCardStatus, updateJobCardPosition, updateJobCardSchedule, machineBusyStatus, startOfWeek,
  startOfMonth, weekDays, monthGrid, rangeDateKeys, rangeLabel, stepAnchor, toDateKey, addMonths } from "@/apps/production/modules/job-card-board/board";
import JobCardViewDrawer from "@/apps/production/modules/job-card-board/ViewDrawer";

const MODULE = "production_job_card";
const ZOOM_KEY = "production.jobCardBoard.zoom";
const RANGE_KEY = "production.jobCardBoard.calRange";
const COL_W = 280;
const DAY_W = 248;
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
  { key: "pause", label: "Pause", status: "Hold", Icon: Pause, cls: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { key: "close", label: "Close", status: "Complete", Icon: Square, cls: "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100" },
];

function canAction(status, key) {
  if (status === "Complete") return false;
  if (key === "start") return status !== "Running";
  if (key === "pause") return status === "Running";
  return status !== "Complete";
}

function colId(m) {
  return m == null || m === "" ? UNASSIGNED : String(m);
}

function slotId(date, shift) {
  return `slot:${date}:${shift}`;
}

function parseSlot(id) {
  if (!String(id).startsWith("slot:")) return null;
  const [, date, shift] = String(id).split(":");
  return { date, shift: Number(shift) };
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

function DetailRow({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-1.5 text-[10px] leading-snug">
      <span className="w-10 shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`min-w-0 flex-1 break-words font-semibold text-slate-700 ${mono ? "font-mono text-indigo-700" : ""}`} title={value}>
        {value}
      </span>
    </div>
  );
}

/** Board card summary (compact). */
function CardBody({ card, dense }) {
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
        <p className="truncate text-[8px] font-semibold text-slate-500" title={[card.process, card.machine, card.qty].filter(Boolean).join(" · ")}>
          {[card.process, card.machine].filter(Boolean).join(" · ") || "—"} · {Number(card.qty || 0).toLocaleString()}
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
        <DetailRow label="Proc" value={card.process} />
        <DetailRow label="Mach" value={card.machine || "—"} />
        <DetailRow label="Qty" value={Number(card.qty || 0).toLocaleString()} mono />
        {card.date ? <DetailRow label="Date" value={`${card.date}${card.shift ? ` · S${card.shift}` : ""}`} /> : null}
      </div>
    </>
  );
}

function BoardCard({ card, canEdit, busyId, onOpen, onAction }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(card.id), disabled: !canEdit });
  const busy = busyId === String(card.id);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="group relative border border-slate-200 bg-white p-2.5 pl-3.5 hover:border-indigo-300"
      {...attributes}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${STATUS_BAR[card.status] || "bg-slate-300"}`} />
      <div className="flex gap-1.5">
        {canEdit ? (
          <button type="button" className="mt-0.5 cursor-grab touch-none text-slate-300 hover:text-slate-500" {...listeners}>
            <GripVertical size={14} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <button type="button" className="w-full text-left" onClick={() => onOpen(card)}>
            <CardBody card={card} />
          </button>
          <div className={`mt-2 grid grid-cols-3 gap-1 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {ACTIONS.map(({ key, label, status, Icon, cls }) => {
              const enabled = canEdit && canAction(card.status, key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!enabled || busy}
                  className={`inline-flex items-center justify-center gap-0.5 border px-1 py-1 text-[9px] font-black uppercase tracking-wide disabled:opacity-40 ${cls}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (enabled) onAction?.(card, status, label);
                  }}
                >
                  <Icon size={10} />
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

function CalCard({ card, canEdit, onOpen, dense }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(card.id), disabled: !canEdit, data: { card } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }}
      className={`group relative border border-slate-200 bg-white shadow-sm hover:border-indigo-400 hover:shadow ${dense ? "p-1.5 pl-2.5" : "p-2.5 pl-3.5"}`}
      {...attributes}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${STATUS_BAR[card.status] || "bg-slate-300"}`} />
      <div className="flex gap-1">
        {canEdit ? (
          <button type="button" className="mt-0.5 cursor-grab touch-none text-slate-300 hover:text-slate-500" {...listeners}>
            <GripVertical size={dense ? 11 : 13} />
          </button>
        ) : null}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(card)}>
          <CardBody card={card} dense={dense} />
        </button>
      </div>
    </div>
  );
}

function MachineCol({ id, title, code, status, cards, canEdit, busyId, onOpen, onAction }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
  return (
    <div className={`flex shrink-0 flex-col border bg-slate-50 ${isOver ? "border-indigo-400" : "border-slate-300"}`} style={{ width: COL_W, minWidth: COL_W }}>
      <div className="border-b border-slate-200 bg-white px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {status ? <span className={`h-2 w-2 rounded-full ${MACHINE_DOT[status] || MACHINE_DOT.idle}`} /> : null}
              <span className="truncate text-[11px] font-bold uppercase text-slate-800">{title}</span>
            </div>
            {code ? (
              <p className="mt-0.5 font-mono text-[10px] font-bold text-indigo-600">
                {code} <span className="font-semibold uppercase text-slate-500">· {status}</span>
              </p>
            ) : null}
          </div>
          <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-black text-slate-600">{cards.length}</span>
        </div>
      </div>
      <div ref={setNodeRef} className={`flex flex-1 flex-col gap-2 p-2 ${isOver ? "bg-indigo-50/40" : ""}`} style={{ minHeight: 120 }}>
        <SortableContext items={cards.map((c) => String(c.id))} strategy={verticalListSortingStrategy}>
          {cards.length === 0 ? (
            <div className="flex flex-1 items-center justify-center border border-dashed border-slate-200 bg-white py-8 text-[11px] font-semibold text-slate-400">—</div>
          ) : (
            cards.map((card) => <BoardCard key={card.id} card={card} canEdit={canEdit} busyId={busyId} onOpen={onOpen} onAction={onAction} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function ShiftLane({ dateKey, shift, label, cards, canEdit, onOpen, dense }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(dateKey, shift), disabled: !dateKey });
  const hasCards = cards.length > 0;
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-1.5 border-t border-slate-200 ${dense ? "p-1" : "p-2"} ${
        isOver ? "bg-indigo-50" : hasCards ? "bg-white" : "bg-slate-50/60"
      } ${dense ? (hasCards ? "min-h-[64px]" : "min-h-[36px]") : hasCards ? "min-h-[120px] flex-1" : "min-h-[44px]"}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`font-black uppercase tracking-wide text-slate-500 ${dense ? "text-[8px]" : "text-[10px]"}`}>{dense ? `S${shift}` : label}</span>
        <span className={`tabular-nums font-black ${hasCards ? "text-indigo-600" : "text-slate-300"} ${dense ? "text-[8px]" : "text-[10px]"}`}>{cards.length}</span>
      </div>
      {hasCards ? (
        <div className="flex flex-col gap-1.5">
          {cards.map((c) => (
            <CalCard key={c.id} card={c} canEdit={canEdit} onOpen={onOpen} dense={dense} />
          ))}
        </div>
      ) : (
        <div
          className={`flex items-center justify-center border border-dashed font-semibold ${
            isOver ? "border-indigo-400 bg-white text-indigo-600" : "border-slate-200 text-slate-300"
          } ${dense ? "py-1 text-[8px]" : "py-2 text-[10px]"}`}
        >
          {isOver ? "Drop" : "—"}
        </div>
      )}
    </div>
  );
}

function WeekCol({ day, cards, canEdit, todayKey, onOpen }) {
  const isToday = day.key === todayKey;
  return (
    <div className={`flex shrink-0 flex-col border bg-slate-50 ${isToday ? "border-indigo-400 shadow-sm" : "border-slate-300"}`} style={{ width: DAY_W, minWidth: DAY_W }}>
      <div className={`border-b px-3 py-2.5 ${isToday ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className={`text-[10px] font-black uppercase tracking-wider ${isToday ? "text-indigo-700" : "text-slate-500"}`}>{day.label}</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className={`text-[20px] font-black tabular-nums leading-none ${isToday ? "text-indigo-800" : "text-slate-800"}`}>{day.dayNum}</span>
              <span className="text-[11px] font-semibold text-slate-400">{day.month}</span>
            </div>
          </div>
          <span className={`border px-2 py-0.5 text-[11px] font-black tabular-nums ${isToday ? "border-indigo-200 bg-white text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
            {cards.length}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        {SHIFTS.map((s) => (
          <ShiftLane key={s.id} dateKey={day.key} shift={s.id} label={s.label} cards={cards.filter((c) => Number(c.shift) === s.id)} canEdit={canEdit} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function MonthGrid({ grid, cardsByDate, canEdit, todayKey, onOpen }) {
  return (
    <div className="min-w-[960px] border border-slate-300 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-slate-800">{grid.title}</span>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WEEKDAYS.map((lab) => (
          <div key={lab} className="border-r border-slate-200 px-2 py-1.5 text-center text-[10px] font-black uppercase text-slate-500 last:border-r-0">
            {lab}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.weeks.flatMap((week, wi) =>
          week.map((day) => (
            <div
              key={`${grid.monthKey}-${wi}-${day.key}`}
              className={`flex min-h-[128px] flex-col border border-slate-200 ${!day.inMonth ? "bg-slate-50/80" : day.key === todayKey ? "bg-indigo-50/40" : "bg-white"}`}
            >
              <div className={`flex items-center justify-between border-b px-1.5 py-1 ${day.key === todayKey ? "border-indigo-200" : "border-slate-100"}`}>
                <span className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center px-1 text-[11px] font-black tabular-nums ${!day.inMonth ? "text-slate-300" : day.key === todayKey ? "bg-indigo-600 text-white" : "text-slate-700"}`}>
                  {day.dayNum}
                </span>
              </div>
              {day.inMonth
                ? SHIFTS.map((s) => (
                    <ShiftLane
                      key={s.id}
                      dateKey={day.key}
                      shift={s.id}
                      label={s.label}
                      cards={(cardsByDate.get(day.key) || []).filter((c) => Number(c.shift) === s.id)}
                      canEdit={canEdit}
                      onOpen={onOpen}
                      dense
                    />
                  ))
                : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function JobCardBoardPage({ initialView = "board" }) {
  const router = useRouter();
  const canAccess = useCanAccess();
  const canView = canAccess(MODULE, "view").allowed;
  const canEdit = canAccess(MODULE, "edit").allowed;

  const [view, setView] = useState(initialView === "calendar" ? "calendar" : "board");
  const [machines, setMachines] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [machineFilter, setMachineFilter] = useState("all");
  const [range, setRange] = useState("week");
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
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

  const todayKey = toDateKey(new Date());
  const isBoard = view === "board";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (view === "board") {
        const data = await fetchBoard();
        setMachines(data.machines || []);
        setCards(data.cards || []);
      } else {
        const data = await fetchCalendar();
        setMachines([]);
        setCards(data.cards || []);
      }
    } catch (e) {
      setError(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    load();
    try {
      const z = Number(localStorage.getItem(ZOOM_KEY));
      if (z >= 0.5 && z <= 1.5) setZoom(z);
      const r = localStorage.getItem(RANGE_KEY);
      if (r === "week" || r === "month" || r === "2months") setRange(r);
    } catch {
      /* ignore */
    }
  }, [load]);

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
  }, [loading]);

  function setViewMode(next) {
    setView(next);
    router.replace(next === "calendar" ? `${ROUTES.PRODUCTION_JOB_CARD_BOARD}?view=calendar` : ROUTES.PRODUCTION_JOB_CARD_BOARD);
  }

  function setZoomPersist(next) {
    const z = Math.min(1.5, Math.max(0.5, Math.round(next * 10) / 10));
    setZoom(z);
    try {
      localStorage.setItem(ZOOM_KEY, String(z));
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
  const weekCols = useMemo(() => (range === "week" ? weekDays(startOfWeek(anchor)) : []), [anchor, range]);
  const monthGrids = useMemo(() => {
    if (isBoard || range === "week") return [];
    const first = startOfMonth(anchor);
    return range === "month" ? [monthGrid(first)] : [monthGrid(first), monthGrid(addMonths(first, 1))];
  }, [anchor, range, isBoard]);
  const visibleKeys = useMemo(() => new Set(isBoard ? [] : rangeDateKeys(anchor, range)), [anchor, range, isBoard]);

  const visible = cards.filter((c) => {
    if (!isBoard && (!c.date || !visibleKeys.has(c.date))) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (isBoard && machineFilter !== "all" && colId(c.machine_id) !== machineFilter) return false;
    if (!q) return true;
    return [c.job_card_no, c.prime_item_code, c.title, c.process, c.machine, c.status].join(" ").toLowerCase().includes(q);
  });

  const cardsByDate = useMemo(() => {
    const map = new Map();
    for (const c of visible) {
      if (!c.date) continue;
      if (!map.has(c.date)) map.set(c.date, []);
      map.get(c.date).push(c);
    }
    return map;
  }, [visible]);

  const columns = isBoard
    ? [
        {
          id: UNASSIGNED,
          title: "Unassigned",
          code: "",
          status: null,
          cards: visible.filter((c) => colId(c.machine_id) === UNASSIGNED).sort((a, b) => a.position - b.position),
        },
        ...machines.map((m) => ({
          id: String(m.id),
          title: m.name,
          code: m.code,
          status: m.status,
          cards: visible.filter((c) => colId(c.machine_id) === String(m.id)).sort((a, b) => a.position - b.position),
        })),
      ]
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
      await updateJobCardPosition(cardId, toCol === UNASSIGNED ? null : toCol, moving.machine_id);
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
    let target = parseSlot(String(event.over.id));
    if (!target) {
      const overCard = cards.find((c) => String(c.id) === String(event.over.id));
      if (overCard?.date) target = { date: overCard.date, shift: Number(overCard.shift) || 1 };
    }
    if (!target?.date || ![1, 2, 3].includes(target.shift)) return;
    if (moving.date === target.date && Number(moving.shift) === target.shift) return;
    const prev = cards;
    setCards((list) => list.map((c) => (String(c.id) === cardId ? { ...c, date: target.date, shift: target.shift } : c)));
    try {
      await updateJobCardSchedule(moving.docno || moving.id, target.date, target.shift);
      toast.success(`${moving.job_card_no} → ${target.date} · Shift ${target.shift}`);
    } catch (e) {
      setCards(prev);
      toast.error(e?.message || "Schedule move failed — reverted.");
    }
  }

  async function onBoardAction(card, status, label) {
    if (!canEdit || busyId) return;
    const id = String(card.id);
    const prevCards = cards;
    const prevMachines = machines;
    const nextCards = cards.map((c) => (String(c.id) === id ? { ...c, status } : c));
    setBusyId(id);
    setCards(nextCards);
    setMachines((ms) => ms.map((m) => ({ ...m, status: machineBusyStatus(m.id, nextCards) })));
    try {
      await updateJobCardStatus(card.docno || card.id, status);
      toast.success(`${card.job_card_no}: ${label}`);
    } catch (e) {
      setCards(prevCards);
      setMachines(prevMachines);
      toast.error(e?.message || `${label} failed.`);
    } finally {
      setBusyId(null);
    }
  }

  if (!canView) {
    return <div className="p-8 text-sm text-slate-500">You do not have permission to view Maintain Job Card.</div>;
  }

  const activeCard = cards.find((c) => String(c.id) === String(activeId));
  const emptyAuth = !loading && !error && cards.length === 0;

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
                <ListPageAddButton module={MODULE} label="New" onClick={() => router.push(`${ROUTES.PRODUCTION_JOB_CARD}?tab=pending`)} />
                <div className="mx-0.5 hidden h-6 w-px bg-slate-300 sm:block" />
                <button type="button" className={modeBtn(isBoard)} onClick={() => setViewMode("board")}>Board</button>
                <button type="button" className={modeBtn(!isBoard)} onClick={() => setViewMode("calendar")}>Calendar</button>
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
                <div className="mx-0.5 hidden h-6 w-px bg-slate-300 sm:block" />
                <button type="button" className={btn} onClick={() => setZoomPersist(zoom - 0.1)}><ZoomOut size={14} /></button>
                <span className="min-w-[2.5rem] text-center text-[11px] font-bold tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
                <button type="button" className={btn} onClick={() => setZoomPersist(zoom + 0.1)}><ZoomIn size={14} /></button>
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

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={false}
            instantClientExtras
            showSearchButton={false}
            applyOnSearchEnter={false}
            searchVariant="quick"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search job card, item, process…"
            searchLabel={isBoard ? "Search Board" : "Search Calendar"}
            extraFilters={[
              {
                label: "Status",
                key: "status",
                value: statusFilter,
                options: [{ label: "All", value: "all" }, ...STATUS_OPTS.map((s) => ({ label: s, value: s }))],
                preserveOrder: true,
              },
              ...(isBoard
                ? [
                    {
                      label: "Machine",
                      key: "machine",
                      value: machineFilter,
                      options: [
                        { label: "All", value: "all" },
                        { label: "Unassigned", value: UNASSIGNED },
                        ...machines.map((m) => ({ label: `${m.code} — ${m.name}`, value: String(m.id) })),
                      ],
                      preserveOrder: true,
                    },
                  ]
                : []),
            ]}
            onApply={(data) => {
              setStatusFilter(data.status || "all");
              if (isBoard) setMachineFilter(data.machine || "all");
            }}
            onReset={() => {
              setSearch("");
              setStatusFilter("all");
              setMachineFilter("all");
            }}
          />
        </ListPageFilterStrip>

        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="absolute inset-0 z-[90] flex items-center justify-center bg-white/85">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-lg">
                <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
                <span className="text-sm font-semibold text-slate-800">Loading…</span>
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8">
              <p className="text-[12px] font-bold text-rose-600">{error}</p>
              <button type="button" className={btn} onClick={load}>Try again</button>
            </div>
          ) : null}

          {emptyAuth ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-[12px] font-bold text-slate-600">No authorized job cards</p>
              <button type="button" className={btn} onClick={() => router.push(ROUTES.PRODUCTION_JOB_CARD)}>Maintain Job Card</button>
            </div>
          ) : null}

          {!loading && !error && cards.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={(e) => canEdit && setActiveId(String(e.active.id))}
              onDragCancel={() => setActiveId(null)}
              onDragEnd={isBoard ? onBoardDragEnd : onCalDragEnd}
            >
              <div className="origin-top-left p-3" style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}>
                {isBoard ? (
                  <div className="flex gap-3" style={{ width: "max-content" }}>
                    {columns.map((col) => (
                      <MachineCol key={col.id} {...col} canEdit={canEdit} busyId={busyId} onOpen={openCard} onAction={onBoardAction} />
                    ))}
                  </div>
                ) : range === "week" ? (
                  <div className="flex gap-3" style={{ width: "max-content" }}>
                    {weekCols.map((day) => (
                      <WeekCol key={day.key} day={day} cards={cardsByDate.get(day.key) || []} canEdit={canEdit} todayKey={todayKey} onOpen={openCard} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4" style={{ width: "max-content", minWidth: "100%" }}>
                    {monthGrids.map((grid) => (
                      <MonthGrid key={grid.monthKey} grid={grid} cardsByDate={cardsByDate} canEdit={canEdit} todayKey={todayKey} onOpen={openCard} />
                    ))}
                  </div>
                )}
              </div>
              <DragOverlay>
                {activeCard ? (
                  <div className="w-[220px] border border-indigo-400 bg-white p-2.5 shadow-md">
                    <span className="font-mono text-[11px] font-bold text-indigo-600">{activeCard.job_card_no}</span>
                    <p className="text-[11px] font-bold text-slate-800">{activeCard.prime_item_code}</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : null}
        </div>
      </div>
    </div>
  );
}
