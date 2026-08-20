"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { Loader2, Package, Plus, Trash2, AlertCircle } from "lucide-react";
import { notify } from "@/apps/rmstore/lib/utils/notify";

import { issueRequestService } from "@/apps/rmstore/lib/services/issueRequest";
import { productionErpHelpers } from "@/apps/rmstore/lib/services/production";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import Drawer from "@/ui/primitives/Drawer";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import ApprovalStatusToggle from "@/apps/rmstore/modules/shared/ApprovalStatusToggle";
import { OK_INPUT } from "@/ui/common/Constants";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { focusFirstError } from "@/platform/utils/form/formFocus";
import { useSelector } from "react-redux";
import { selectUser } from "@/platform/store/slices/authSlice";
import { normalizeRmItems } from "@/apps/rmstore/modules/master/production/productionRmHelpers";
import { issueRmSelectionMode } from "@/apps/rmstore/lib/utils/rmstoreSpecialPermissions";
import { ISSUE_REQUEST_MACHINE_JOB_CARD_LOCK } from "@/apps/rmstore/lib/config/app.config";

const MODULE = "rm_issue_request";
const FIELD_ORDER = ["shift", "job_cards"];
const SHIFT_OPTIONS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
];

const emptyRow = () => ({
  pjobcardno: "",
  pldt: null,
  item_code: "",
  itemdcode: "",
  itemdesc: "",
  planqty: 0,
  macname: "",
  part_weight: 0,
  rm_weight: 0,
  issue_qty: "",
  /** User-typed target while editing Dispatch Qty (FIFO runs on blur). */
  issue_target: "",
  production_id: null,
  rm_item_code: "",
  rm_item_dcode: null,
  rm_item_desc: "",
  mapped_rm_items: [],
  store_qty: 0,
  issued_qty: 0,
  issued_count: 0,
  loadingIssued: false,
  coils: [],
  fifoPool: [],
  loadingFifo: false,
  mappingError: "",
});

function buildRmOptions(mappedItems = [], mode = "mapped", allItems = []) {
  const mapped = Array.isArray(mappedItems) ? mappedItems : [];
  if (mode === "all") {
    const all = Array.isArray(allItems) ? allItems : [];
    return all.length ? all : mapped;
  }
  if (mode === "mapped") return mapped;
  return mapped.length ? [mapped[0]] : [];
}

function mapErpRmItems(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      rm_item_dcode: r.id ?? r.itemdcode ?? r.item_dcode ?? null,
      rm_item_code: r.item_code ?? r.itemcode ?? "",
      rm_item_desc: r.itemdesc ?? r.item_desc ?? "",
    }))
    .filter((r) => r.rm_item_dcode != null || r.rm_item_code);
}

function rmToSelectRow(rm) {
  if (!rm) return null;
  return {
    id: rmOptionKey(rm),
    item_code: rm.rm_item_code || "",
    itemdesc: rm.rm_item_desc || "",
    sub: rm.rm_item_desc || "",
    _rm: rm,
  };
}

function fetchRmWireOptions(rmOpts, params = {}, { mappedItems = [] } = {}) {
  const search = String(params.search || "").trim().toLowerCase();
  const mappedKeys = new Set((mappedItems || []).map((m) => rmOptionKey(m)));
  const mappedOrder = (mappedItems || []).map((m) => rmOptionKey(m));
  let rows = (rmOpts || []).map(rmToSelectRow).filter(Boolean);
  rows = rows.map((r) => ({
    ...r,
    _isMapped: mappedKeys.has(String(r.id)),
  }));
  if (search) {
    rows = rows.filter((r) =>
      [r.item_code, r.itemdesc, r.sub].some((v) => String(v || "").toLowerCase().includes(search))
    );
  }
  // Mapped RM wires first (production order), then all others.
  rows.sort((a, b) => {
    if (a._isMapped !== b._isMapped) return a._isMapped ? -1 : 1;
    if (a._isMapped && b._isMapped) {
      return mappedOrder.indexOf(String(a.id)) - mappedOrder.indexOf(String(b.id));
    }
    return 0;
  });
  return Promise.resolve({
    data: rows,
    total: rows.length,
    page: 1,
    limit: rows.length || 1,
  });
}

function getRmWireById(rmOpts, id) {
  const rm = (rmOpts || []).find((r) => rmOptionKey(r) === String(id));
  return Promise.resolve(rmToSelectRow(rm));
}

function rmListHasKey(list, key) {
  const k = String(key || "").trim();
  if (!k) return false;
  return (list || []).some((rm) => rmOptionKey(rm) === k);
}

/** Super Admin only — per-row palette so mapped RM wires link visually to their job card row. */
const SUPER_ADMIN_ROW_RM_COLORS = [
  { rowBorder: "border-l-4 border-l-indigo-500", chip: "bg-indigo-50 text-indigo-900 border border-indigo-200", dot: "bg-indigo-500", soft: "#eef2ff", accent: "#6366f1" },
  { rowBorder: "border-l-4 border-l-emerald-500", chip: "bg-emerald-50 text-emerald-900 border border-emerald-200", dot: "bg-emerald-500", soft: "#ecfdf5", accent: "#10b981" },
  { rowBorder: "border-l-4 border-l-amber-500", chip: "bg-amber-50 text-amber-900 border border-amber-200", dot: "bg-amber-500", soft: "#fffbeb", accent: "#f59e0b" },
  { rowBorder: "border-l-4 border-l-violet-500", chip: "bg-violet-50 text-violet-900 border border-violet-200", dot: "bg-violet-500", soft: "#f5f3ff", accent: "#8b5cf6" },
  { rowBorder: "border-l-4 border-l-cyan-500", chip: "bg-cyan-50 text-cyan-900 border border-cyan-200", dot: "bg-cyan-500", soft: "#ecfeff", accent: "#06b6d4" },
];

function getSuperAdminRowRmColor(idx) {
  return SUPER_ADMIN_ROW_RM_COLORS[Number(idx) % SUPER_ADMIN_ROW_RM_COLORS.length];
}

function isRmMappedForItems(rm, mappedItems = []) {
  const key = rmOptionKey(rm);
  return (mappedItems || []).some((m) => rmOptionKey(m) === key);
}

function rmOptionKey(rm) {
  return String(rm?.rm_item_dcode ?? rm?.rm_item_code ?? "");
}

/** Trim float artifacts from subtracted quantities. */
const roundQty = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

/**
 * Remaining RM that can still be issued on this JC.
 * Cap = RM weight − already issued (previous issue requests).
 */
function remainingRmMax(row) {
  const rm = Number(row?.rm_weight);
  if (!Number.isFinite(rm) || rm <= 0) return null;
  const issued = Number(row?.issued_qty || 0) || 0;
  return Math.max(0, roundQty(rm - issued));
}

/** RM weight cap reached — no further coils may be selected. */
function isRmFullyIssued(row) {
  const rm = Number(row?.rm_weight);
  if (!Number.isFinite(rm) || rm <= 0) return false;
  return remainingRmMax(row) <= 0;
}

/** Plan / RM balance for badges. When RM weight exists, Pending = remaining required RM. */
function rowBalance(row) {
  const plan = Number(row?.planqty || 0) || 0;
  const issued = Number(row?.issued_qty || 0) || 0;
  const rmWeight = Number(row?.rm_weight || 0) || 0;
  const rmMax = remainingRmMax(row);
  if (rmMax != null) {
    const overBy = rmWeight > 0 ? roundQty(issued - rmWeight) : 0;
    return {
      plan,
      issued,
      pending: overBy > 1e-9 ? overBy : rmMax,
      over: overBy > 1e-9,
      rmCap: true,
    };
  }
  const pending = roundQty(plan - issued);
  return { plan, issued, pending, over: plan > 0 && pending < 0, rmCap: false };
}

/** Coil-area / no location — used only for FIFO tie-break (stored first). */
function isUnassignedCoil(c) {
  return c?.location_id == null || String(c?.location_no || "").toLowerCase() === "unassigned";
}

/** Packing # analogue: prefer mrn_uid, fall back to mrn_no. */
function mrnGroupKey(c) {
  const uid = String(c?.mrn_uid || "").trim();
  if (uid) return uid;
  const no = c?.mrn_no;
  if (no != null && String(no).trim() !== "") return `no:${String(no).trim()}`;
  return "N/A";
}

/** Display packing label — mrn_uid is the IMS packing # equivalent. */
function mrnGroupLabel(c) {
  const uid = String(c?.mrn_uid || "").trim();
  if (uid) return uid;
  if (c?.mrn_no != null && String(c.mrn_no).trim() !== "") return String(c.mrn_no);
  return "N/A";
}

/**
 * FIFO like IMS boxes: packing (mrn_uid) → stored before unassigned → created_at → coil_uid.
 */
function sortCoilsFifo(coils = []) {
  return [...(coils || [])].sort((a, b) => {
    const keyA = mrnGroupKey(a);
    const keyB = mrnGroupKey(b);
    const rawNoA = a?.mrn_no != null && String(a.mrn_no).trim() !== "" ? Number(a.mrn_no) : NaN;
    const rawNoB = b?.mrn_no != null && String(b.mrn_no).trim() !== "" ? Number(b.mrn_no) : NaN;
    if (Number.isFinite(rawNoA) && Number.isFinite(rawNoB) && rawNoA !== rawNoB) return rawNoA - rawNoB;
    if (keyA !== keyB) return keyA.localeCompare(keyB, undefined, { numeric: true });

    const looseA = isUnassignedCoil(a) ? 1 : 0;
    const looseB = isUnassignedCoil(b) ? 1 : 0;
    if (looseA !== looseB) return looseA - looseB;

    const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return Number(a?.coil_uid || 0) - Number(b?.coil_uid || 0);
  });
}

/**
 * Whole-coil FIFO fill to cover targetQty.
 * May overshoot (e.g. need 751, 100kg coils → 800). Typed dispatch is capped separately.
 */
function pickCoilsFifo(pool, targetQty, excludeUids) {
  const exclude = new Set([...excludeUids].map((u) => String(u).toLowerCase()));
  const sorted = sortCoilsFifo(pool || []).filter(
    (c) => c?.coil_no_uid && !exclude.has(String(c.coil_no_uid).toLowerCase())
  );

  const storeQty = sorted.reduce((s, c) => s + (Number(c.qty) || 0), 0);
  const target = Number(targetQty);
  if (!(target > 0)) {
    return { picked: [], pickedQty: 0, storeQty, available: sorted };
  }

  const picked = [];
  let pickedQty = 0;
  for (const c of sorted) {
    if (pickedQty >= target) break;
    picked.push(c);
    pickedQty += Number(c.qty) || 0;
  }
  return { picked, pickedQty, storeQty, available: sorted };
}

/** Cap typed dispatch at remaining required RM; empty/invalid → "". */
function resolveDispatchTarget(raw, maxQty) {
  if (raw === "" || raw == null) return { target: "", capped: false };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { target: "", capped: false };
  const max = Number(maxQty);
  if (Number.isFinite(max) && max >= 0 && n > max + 1e-9) {
    return { target: max > 0 ? String(max) : "", capped: true, max };
  }
  return { target: String(n), capped: false };
}

/** First N coils in FIFO order (no RM hard ceiling — overshoot via whole coils is OK). */
function pickCoilsByCount(pool, count, excludeUids) {
  const { available, storeQty } = pickCoilsFifo(pool, 0, excludeUids);
  const n = Math.max(0, Math.min(Number(count) || 0, available.length));
  const picked = available.slice(0, n);
  const pickedQty = picked.reduce((s, c) => s + (Number(c.qty) || 0), 0);
  return { picked, pickedQty, storeQty, available };
}

/**
 * FIFO seed: default to 1 coil in FIFO order; user may add more via + or Dispatch Qty.
 */
function seedCoilsForRow(row, fifoPool, excludeUids) {
  if (!fifoPool?.length) {
    return { picked: [], pickedQty: 0, storeQty: 0 };
  }
  const remain = remainingRmMax(row);
  if (remain != null && remain <= 0) {
    const { storeQty } = pickCoilsByCount(fifoPool, 0, excludeUids);
    return { picked: [], pickedQty: 0, storeQty };
  }
  return pickCoilsByCount(fifoPool, 1, excludeUids);
}

/** IMS: FIFO at MRN — count per MRN; which coil UIDs inside an MRN do not matter. */
function mrnCoilCountMap(coils = []) {
  const counts = new Map();
  for (const c of coils || []) {
    const k = mrnGroupKey(c);
    if (!k || k === "N/A") continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

function mrnCountMapsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

/**
 * Selected coils must match FIFO MRN quotas for targetQty (cover / dispatch).
 * Within an MRN any coil is OK — totals may differ from the canonical FIFO pick.
 */
function assertMrnLevelFifo(pool, selectedCoils, targetQty, excludeUids = new Set()) {
  const exclude = new Set([...(excludeUids || [])].map((u) => String(u).toLowerCase()));
  const poolByUid = new Map(
    (pool || [])
      .filter((c) => c?.coil_no_uid && !exclude.has(String(c.coil_no_uid).toLowerCase()))
      .map((c) => [String(c.coil_no_uid).toLowerCase(), c])
  );
  const enriched = [];
  for (const c of selectedCoils || []) {
    const uid = String(c?.coil_no_uid || "").toLowerCase();
    if (!uid || !poolByUid.has(uid)) return false;
    const full = poolByUid.get(uid);
    enriched.push({
      ...full,
      ...c,
      qty: c.qty ?? full.qty,
      mrn_uid: c.mrn_uid || full.mrn_uid,
      mrn_no: c.mrn_no ?? full.mrn_no,
    });
  }
  const { picked } = pickCoilsFifo(pool, targetQty, excludeUids || new Set());
  if (enriched.length !== picked.length) return false;
  if (!mrnCountMapsEqual(mrnCoilCountMap(picked), mrnCoilCountMap(enriched))) return false;
  const selectedQty = enriched.reduce((s, c) => s + (Number(c.qty) || 0), 0);
  const target = Number(targetQty) || 0;
  // Must cover typed/required dispatch; whole-coil overshoot above target is OK
  if (target > 0 && selectedQty + 1e-9 < target) return false;
  return true;
}

/**
 * Coil + ceiling: remaining required RM (whole-coil overshoot past this is the last add).
 * Not limited by current typed dispatch — user can click + to raise qty.
 */
function coilAddCoverNeed(row) {
  const remain = remainingRmMax(row);
  if (remain != null) return remain;
  return null;
}

/**
 * FIFO / API cover target: remaining required when coil total overshot (IMS display = send qty).
 */
function dispatchCoverQty(row) {
  const issueQty = Number(row?.issue_qty) || Number(row?.issue_target) || 0;
  const remain = remainingRmMax(row);
  if (remain != null && issueQty > remain + 1e-9) return remain;
  return issueQty;
}

function mapPickedCoils(picked) {
  return (picked || []).map((c) => ({
    coil_no_uid: c.coil_no_uid,
    qty: c.qty,
    item_code: c.item_code,
    heat_no: c.heat_no,
    mrn_uid: c.mrn_uid ?? null,
    mrn_no: c.mrn_no,
    location_no: c.location_no || null,
    location_id: c.location_id ?? null,
    created_at: c.created_at,
  }));
}

function rowCoilQty(row) {
  return (row?.coils || []).reduce((s, c) => s + (Number(c.qty) || 0), 0);
}

/**
 * Group selected FIFO coils by MRN (packing analogue).
 * Order follows first appearance in the FIFO pick list.
 */
function groupSelectedCoilsByMrn(coils = []) {
  const groups = [];
  const groupMap = new Map();
  for (const c of coils || []) {
    const key = mrnGroupKey(c);
    if (!groupMap.has(key)) {
      const g = { key, label: mrnGroupLabel(c), coils: [] };
      groupMap.set(key, g);
      groups.push(g);
    }
    groupMap.get(key).coils.push(c);
  }
  return groups;
}

function sameRmItem(a, b) {
  if (!a || !b) return false;
  const da = Number(a.rm_item_dcode);
  const db = Number(b.rm_item_dcode);
  if (Number.isFinite(da) && da > 0 && Number.isFinite(db) && db > 0) {
    return da === db;
  }
  const ca = String(a.rm_item_code || "").trim().toUpperCase();
  const cb = String(b.rm_item_code || "").trim().toUpperCase();
  return Boolean(ca && cb && ca === cb);
}

function machineKey(name) {
  return String(name || "").trim().toUpperCase();
}

const MICRO_LABEL = "text-[10px] font-bold uppercase tracking-wide text-slate-600 block ml-1";

const BADGE_TONES = {
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-800",
  amber: "bg-amber-100 border-amber-300 text-amber-900",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
  rose: "bg-rose-50 border-rose-200 text-rose-700",
  slate: "bg-slate-100 border-slate-300 text-slate-600",
};

/** Keep small decimals (e.g. part_weight 0.0001) — default toLocaleString rounds to 3 dp. */
function formatExactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 20 });
}

/** Compact info chip — same idea as FN Sch / Balance badges (not input fields). */
function InfoBadge({ label, value, tone = "slate", loading = false, title, numeric = true }) {
  const display = loading
    ? "…"
    : numeric
      ? formatExactNumber(value || 0)
      : value || "—";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide shadow-sm ${
        numeric ? "tabular-nums" : ""
      } ${BADGE_TONES[tone] || BADGE_TONES.slate}`}
    >
      <span className="opacity-80 font-bold">{label}</span>
      <span>{display}</span>
    </span>
  );
}

export default function IssueRequestModal({
  open,
  onClose,
  onSuccess,
  editData = null,
  mode = "add",
}) {
  const canAccess = useCanAccess();
  const canApprove = canAccess(MODULE, "authorize").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const editIssueUid = editData?.issue_uid ?? null;
  const isView = mode === "view";
  const readOnly = isView;
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  const showApproval = canApprove && (mode === "add" || mode === "approve");

  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [shift, setShift] = useState("A");
  const [remarks, setRemarks] = useState("");
  const [approved, setApproved] = useState(false);
  const [rows, setRows] = useState([emptyRow()]);
  const [errors, setErrors] = useState({});
  /** Which row is actively typing Dispatch Qty (show target, not FIFO result). */
  const [editingIssueIdx, setEditingIssueIdx] = useState(null);
  const sopAckRef = useRef(null);
  const formRef = useRef(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const helperPerms = useMemo(
    () => ({ permission_module: MODULE, permission_action: "view" }),
    []
  );

  const user = useSelector(selectUser);
  const rmSelectionMode = issueRmSelectionMode(user);
  const [allRmWireItems, setAllRmWireItems] = useState([]);
  const [loadingAllRmWire, setLoadingAllRmWire] = useState(false);

  useEffect(() => {
    if (!open || rmSelectionMode !== "all") {
      setAllRmWireItems([]);
      setLoadingAllRmWire(false);
      return;
    }
    let cancelled = false;
    setLoadingAllRmWire(true);
    (async () => {
      try {
        const res = await productionErpHelpers.getRmItemsViews({
          ...helperPerms,
          page: 1,
          limit: 5000,
        });
        if (!cancelled) {
          setAllRmWireItems(mapErpRmItems(res?.data));
        }
      } catch {
        if (!cancelled) setAllRmWireItems([]);
      } finally {
        if (!cancelled) setLoadingAllRmWire(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, rmSelectionMode, helperPerms]);

  const totals = useMemo(() => {
    const issueQty = rows.reduce((s, r) => s + (Number(r.issue_qty) || 0), 0);
    const coilQty = rows.reduce((s, r) => s + rowCoilQty(r), 0);
    const coilCount = rows.reduce((s, r) => s + (r.coils?.length || 0), 0);
    return { issueQty, coilQty, coilCount };
  }, [rows]);

  const excludedUidsForRow = useCallback((idx, currentRows = rowsRef.current) => {
    const set = new Set();
    currentRows.forEach((r, i) => {
      if (i === idx) return;
      (r.coils || []).forEach((c) => {
        const uid = String(c?.coil_no_uid || "").trim().toLowerCase();
        if (uid) set.add(uid);
      });
    });
    return set;
  }, []);

  /** Live remaining FG qty + available coils for a row (after other rows took coils). */
  const getRowAvailability = useCallback(
    (idx, currentRows = rowsRef.current) => {
      const row = currentRows[idx];
      if (!row) return { available: [], storeQty: 0, availableCount: 0, selectedCount: 0 };
      const { available, storeQty } = pickCoilsByCount(
        row.fifoPool,
        0,
        excludedUidsForRow(idx, currentRows)
      );
      return {
        available,
        storeQty,
        availableCount: available.length,
        selectedCount: row.coils?.length || 0,
      };
    },
    [excludedUidsForRow]
  );

  /**
   * After one row changes coil selection, refresh sibling rows that share the same RM item:
   * - keep their coil count if still possible
   * - update store_qty live
   */
  const rebalanceSharedRmRows = useCallback(
    (changedIdx, currentRows) => {
      let next = currentRows;

      // Share one fifo pool across same-RM rows (keep largest / first loaded).
      const changed = next[changedIdx];
      if (changed?.fifoPool?.length) {
        next = next.map((r, i) => {
          if (i === changedIdx || !sameRmItem(r, changed)) return r;
          if (r.fifoPool?.length === changed.fifoPool.length) {
            return { ...r, fifoPool: changed.fifoPool };
          }
          // Prefer the richer pool
          const pool =
            (changed.fifoPool?.length || 0) >= (r.fifoPool?.length || 0)
              ? changed.fifoPool
              : r.fifoPool;
          return { ...r, fifoPool: pool || r.fifoPool };
        });
      }

      // Re-apply each sibling's coil count against updated exclusions (order: left → right).
      next.forEach((row, i) => {
        if (i === changedIdx) return;
        if (!sameRmItem(row, next[changedIdx])) return;
        const want = row.coils?.length || 0;
        const { available } = pickCoilsByCount(
          row.fifoPool || next[changedIdx]?.fifoPool || [],
          0,
          excludedUidsForRow(i, next)
        );
        const count = Math.min(want, available.length);
        const { picked, pickedQty, storeQty } = pickCoilsByCount(
          row.fifoPool || next[changedIdx]?.fifoPool || [],
          count,
          excludedUidsForRow(i, next)
        );
        const sendQty = pickedQty > 0 ? String(pickedQty) : want > 0 ? "" : null;
        next = next.map((r, j) =>
          j === i
            ? {
                ...r,
                fifoPool: r.fifoPool?.length ? r.fifoPool : next[changedIdx]?.fifoPool || [],
                issue_qty: sendQty != null ? sendQty : r.issue_qty,
                issue_target: sendQty != null ? sendQty : r.issue_target,
                store_qty: storeQty,
                coils: mapPickedCoils(picked),
              }
            : r
        );
      });

      // Refresh store_qty for every row (live remaining after exclusions).
      next = next.map((row, i) => {
        if (!row.fifoPool?.length) return row;
        const { storeQty } = pickCoilsByCount(
          row.fifoPool,
          0,
          excludedUidsForRow(i, next)
        );
        return { ...row, store_qty: storeQty };
      });

      return next;
    },
    [excludedUidsForRow]
  );

  const applyFifoToRow = useCallback(
    (idx, nextIssueQty, currentRows = rowsRef.current, { silent } = {}) => {
      const notices = [];
      const row = currentRows[idx];
      if (!row) return { rows: currentRows, notices };

      const rmMax = remainingRmMax(row);
      const typed = Number(nextIssueQty);
      const prevIssue = Number(row.issue_qty) || 0;
      const { target, capped, max } = resolveDispatchTarget(nextIssueQty, rmMax);
      // Don't warn when re-blurring an already-applied whole-coil overshoot (e.g. 609 on max 575)
      if (
        !silent &&
        capped &&
        !(Number.isFinite(typed) && Math.abs(typed - prevIssue) <= 1e-9 && prevIssue > 0)
      ) {
        notices.push({
          type: "warning",
          message:
            `Dispatch qty cannot exceed required RM (${formatExactNumber(max)}).` +
            (Number(row.issued_qty) > 0
              ? ` Already issued ${formatExactNumber(row.issued_qty)} of ${formatExactNumber(row.rm_weight)}.`
              : ""),
        });
      }

      // Cover target ≤ remaining required; whole coils may overshoot
      const { picked, pickedQty, storeQty } = pickCoilsFifo(
        row.fifoPool,
        target,
        excludedUidsForRow(idx, currentRows)
      );

      const want = Number(target);
      if (!silent && want > 0 && pickedQty > 0 && pickedQty + 1e-9 < want) {
        notices.push({
          type: "info",
          message: `Only ${pickedQty.toLocaleString()} qty available in FIFO coils.`,
        });
      }

      const sendQty =
        pickedQty > 0
          ? String(pickedQty)
          : target === "" || target === "0"
            ? ""
            : String(target);

      // IMS-style: after apply, field shows what we are actually sending
      const updated = currentRows.map((r, i) =>
        i === idx
          ? {
              ...r,
              issue_qty: sendQty,
              issue_target: sendQty,
              store_qty: storeQty,
              coils: mapPickedCoils(picked),
            }
          : r
      );
      return { rows: rebalanceSharedRmRows(idx, updated), notices };
    },
    [excludedUidsForRow, rebalanceSharedRmRows]
  );

  const flushNotices = useCallback((notices) => {
    for (const n of notices || []) {
      if (n.type === "warning") toast.warning(n.message);
      else if (n.type === "info") toast.info(n.message);
      else toast(n.message);
    }
  }, []);

  const applyCoilCountToRow = useCallback(
    (idx, count, currentRows = rowsRef.current) => {
      const row = currentRows[idx];
      if (!row) return currentRows;
      const { picked, pickedQty, storeQty } = pickCoilsByCount(
        row.fifoPool,
        count,
        excludedUidsForRow(idx, currentRows)
      );
      // IMS-style: coil +/− sets the qty we are sending
      const sendQty = pickedQty > 0 ? String(pickedQty) : "";
      const updated = currentRows.map((r, i) =>
        i === idx
          ? {
              ...r,
              issue_qty: sendQty,
              issue_target: sendQty,
              store_qty: storeQty,
              coils: mapPickedCoils(picked),
            }
          : r
      );
      return rebalanceSharedRmRows(idx, updated);
    },
    [excludedUidsForRow, rebalanceSharedRmRows]
  );

  const loadFifoPool = useCallback(async ({ rm_item_code, rm_item_dcode } = {}) => {
    const code = String(rm_item_code || "").trim();
    const dcode = Number(rm_item_dcode);
    if (!code && !Number.isFinite(dcode)) return { pool: [], storeQty: 0 };

    try {
      const res = await issueRequestService.availableCoils({
        rm_item_code: code || undefined,
        rm_item_dcode: Number.isFinite(dcode) && dcode > 0 ? dcode : undefined,
        exclude_issue_uid: editIssueUid,
      });
      const pool = Array.isArray(res?.data) ? res.data : [];
      const storeQty = Number(res?.store_qty) || pool.reduce((s, c) => s + (Number(c.qty) || 0), 0);
      return { pool, storeQty, reservedQty: Number(res?.reserved_qty) || 0 };
    } catch {
      return { pool: [], storeQty: 0, reservedQty: 0 };
    }
  }, [editIssueUid]);

  /** Qty already requested for this job card in earlier issue requests. */
  const fetchIssuedSummary = useCallback(
    async (pjobcardno, planqty) => {
      const jc = String(pjobcardno || "").trim();
      if (!jc) return { issued_qty: 0, issued_count: 0 };
      try {
        const res = await issueRequestService.jobCardSummary(
          [{ pjobcardno: jc, planqty: Number(planqty || 0) || 0 }],
          editIssueUid
        );
        const hit = res?.data?.[0];
        return {
          issued_qty: Number(hit?.issued_qty || 0) || 0,
          issued_count: Number(hit?.request_count || 0) || 0,
        };
      } catch {
        return { issued_qty: 0, issued_count: 0 };
      }
    },
    [editIssueUid]
  );

  const findProductionMapping = useCallback(async (itemdcode, itemCode) => {
    const dcode = Number(itemdcode);
    const code = String(itemCode || "").trim();

    try {
      const res = await issueRequestService.productionMapping({
        itemdcode: Number.isFinite(dcode) && dcode > 0 ? dcode : undefined,
        item_code: code || undefined,
      });
      if (res?.data) return { prod: res.data, reason: null };
    } catch (err) {
      const msg = err?.message || "";
      if (/not approved/i.test(msg)) {
        return { prod: null, reason: msg };
      }
      if (err?.status === 404 || /no production/i.test(msg)) {
        return {
          prod: null,
          reason: msg || `No production-to-RM mapping exists for item ${code || itemdcode || "—"}. Map it in the Production master first.`,
        };
      }
    }

    return {
      prod: null,
      reason: `No production-to-RM mapping exists for item ${code || itemdcode || "—"}. Map it in the Production master first.`,
    };
  }, []);

  const applyProductionMapping = useCallback(
    async (idx, baseRow, { resetIssue = true } = {}) => {
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                ...baseRow,
                issued_qty: resetIssue ? 0 : r.issued_qty,
                issued_count: resetIssue ? 0 : r.issued_count,
                loadingIssued: resetIssue,
                loadingFifo: true,
                mappingError: "",
              }
            : r
        )
      );

      const issuedPromise = resetIssue
        ? fetchIssuedSummary(baseRow.pjobcardno, baseRow.planqty)
        : Promise.resolve({
            issued_qty: rowsRef.current[idx]?.issued_qty || 0,
            issued_count: rowsRef.current[idx]?.issued_count || 0,
          });

      let production_id = baseRow.production_id ?? null;
      let rm_item_code = baseRow.rm_item_code || "";
      let rm_item_dcode = baseRow.rm_item_dcode ?? null;
      let rm_item_desc = baseRow.rm_item_desc || "";
      let mapped_rm_items = [];
      let mappingError = "";

      try {
        if (!baseRow.itemdcode && !baseRow.item_code) {
          mappingError = "This job card has no item.";
        } else {
          const { prod, reason } = await findProductionMapping(
            baseRow.itemdcode,
            baseRow.item_code
          );
          if (!prod) {
            mappingError = reason || "No approved production-to-RM mapping exists for this item.";
          } else {
            mapped_rm_items = normalizeRmItems(prod);
            production_id = prod.production_id;
            const rmOpts = buildRmOptions(mapped_rm_items, rmSelectionMode, allRmWireItems);
            const presetKey = rmOptionKey({
              rm_item_dcode: resetIssue ? null : baseRow.rm_item_dcode,
              rm_item_code: resetIssue ? "" : baseRow.rm_item_code,
            });
            if (rmSelectionMode === "all") {
              const mappedFirst = mapped_rm_items[0] || null;
              if (
                !resetIssue &&
                presetKey &&
                (rmListHasKey(rmOpts, presetKey) || baseRow.rm_item_code || baseRow.rm_item_dcode)
              ) {
                const picked = rmListHasKey(rmOpts, presetKey)
                  ? rmOpts.find((r) => rmOptionKey(r) === presetKey)
                  : {
                      rm_item_code: baseRow.rm_item_code || "",
                      rm_item_dcode: baseRow.rm_item_dcode ?? null,
                      rm_item_desc: baseRow.rm_item_desc || "",
                    };
                rm_item_code = picked?.rm_item_code || "";
                rm_item_dcode = picked?.rm_item_dcode ?? null;
                rm_item_desc = picked?.rm_item_desc || "";
              } else if (mappedFirst) {
                // Super Admin: pre-select first production-mapped RM (same default as normal users).
                rm_item_code = mappedFirst.rm_item_code || "";
                rm_item_dcode = mappedFirst.rm_item_dcode ?? null;
                rm_item_desc = mappedFirst.rm_item_desc || "";
              } else {
                rm_item_code = "";
                rm_item_dcode = null;
                rm_item_desc = "";
              }
            } else {
              const picked =
                (!resetIssue && presetKey && rmListHasKey(rmOpts, presetKey)
                  ? rmOpts.find((r) => rmOptionKey(r) === presetKey)
                  : null) ||
                rmOpts[0] ||
                {};
              rm_item_code = picked.rm_item_code || "";
              rm_item_dcode = picked.rm_item_dcode ?? null;
              rm_item_desc = picked.rm_item_desc || "";
              if (!rm_item_code && !rm_item_dcode) {
                mappingError = "The production mapping has no RM item.";
              }
            }
          }
        }
      } catch (err) {
        mappingError = err?.message || "Could not resolve the production mapping. Please try again.";
      }

      let fifoPool = resetIssue ? [] : rowsRef.current[idx]?.fifoPool || [];
      let store_qty = resetIssue ? 0 : rowsRef.current[idx]?.store_qty || 0;
      if (!mappingError && (rm_item_code || rm_item_dcode)) {
        try {
          const sibling = rowsRef.current.find(
            (r, i) =>
              i !== idx &&
              sameRmItem(r, { rm_item_code, rm_item_dcode }) &&
              Array.isArray(r.fifoPool) &&
              r.fifoPool.length > 0
          );
          if (sibling) {
            fifoPool = sibling.fifoPool;
            store_qty = fifoPool.reduce((s, c) => s + (Number(c.qty) || 0), 0);
          } else {
            const loaded = await loadFifoPool({ rm_item_code, rm_item_dcode });
            fifoPool = loaded.pool;
            store_qty = loaded.storeQty;
          }
        } catch (err) {
          mappingError = err?.message || "Could not load FG coils (store + unassigned). Please try again.";
        }
      }

      const issued = await issuedPromise;
      const priorCoils = resetIssue ? [] : rowsRef.current[idx]?.coils || [];

      setRows((prev) => {
        const enrichedCoils =
          !resetIssue && priorCoils.length && fifoPool.length
            ? (() => {
                const byUid = new Map(
                  fifoPool.map((c) => [String(c.coil_no_uid || "").toLowerCase(), c])
                );
                return priorCoils.map((c) => {
                  const full = byUid.get(String(c.coil_no_uid || "").toLowerCase());
                  if (!full) return c;
                  return {
                    ...c,
                    qty: c.qty ?? full.qty,
                    heat_no: c.heat_no || full.heat_no,
                    mrn_uid: c.mrn_uid ?? full.mrn_uid ?? null,
                    mrn_no: c.mrn_no ?? full.mrn_no,
                    item_code: c.item_code || full.item_code,
                    location_no: c.location_no || full.location_no || null,
                    location_id: c.location_id ?? full.location_id ?? null,
                    created_at: c.created_at || full.created_at,
                  };
                });
              })()
            : resetIssue
              ? []
              : priorCoils;

        const withRow = prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                ...baseRow,
                production_id,
                rm_item_code,
                rm_item_dcode,
                rm_item_desc,
                mapped_rm_items,
                fifoPool,
                store_qty,
                issued_qty: resetIssue ? issued.issued_qty : (r.issued_qty ?? issued.issued_qty),
                issued_count: resetIssue ? issued.issued_count : (r.issued_count ?? issued.issued_count),
                loadingIssued: false,
                loadingFifo: false,
                mappingError,
                ...(resetIssue
                  ? { issue_qty: "", issue_target: "", coils: [] }
                  : { coils: enrichedCoils }),
              }
            : sameRmItem(r, { rm_item_code, rm_item_dcode }) && fifoPool.length
              ? { ...r, fifoPool }
              : r
        );

        if (resetIssue && !mappingError && fifoPool.length > 0) {
          const rowForSeed = withRow[idx];
          const { picked, pickedQty, storeQty } = seedCoilsForRow(
            rowForSeed,
            fifoPool,
            excludedUidsForRow(idx, withRow)
          );
          const seeded = withRow.map((r, i) =>
            i === idx
              ? {
                  ...r,
                  issue_qty: pickedQty > 0 ? String(pickedQty) : "",
                  issue_target: pickedQty > 0 ? String(pickedQty) : "",
                  store_qty: storeQty,
                  coils: mapPickedCoils(picked),
                }
              : r
          );
          return rebalanceSharedRmRows(idx, seeded);
        }

        return rebalanceSharedRmRows(idx, withRow);
      });
    },
    [
      excludedUidsForRow,
      fetchIssuedSummary,
      findProductionMapping,
      loadFifoPool,
      rebalanceSharedRmRows,
      rmSelectionMode,
      allRmWireItems,
    ]
  );

  const resolveMappingAndFifo = useCallback(
    (idx, baseRow) => applyProductionMapping(idx, baseRow, { resetIssue: true }),
    [applyProductionMapping]
  );

  const applyRmSelection = useCallback(
    async (idx, picked) => {
      if (!picked || readOnly) return;

      setRows((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                rm_item_dcode: picked.rm_item_dcode ?? null,
                rm_item_code: picked.rm_item_code || "",
                rm_item_desc: picked.rm_item_desc || "",
                loadingFifo: true,
                mappingError: "",
                coils: [],
                issue_qty: "",
                issue_target: "",
              }
            : r
        )
      );

      let fifoPool = [];
      let store_qty = 0;
      let mappingError = "";
      try {
        const loaded = await loadFifoPool({
          rm_item_code: picked.rm_item_code,
          rm_item_dcode: picked.rm_item_dcode,
        });
        fifoPool = loaded.pool;
        store_qty = loaded.storeQty;
      } catch (err) {
        mappingError = err?.message || "Could not load coils for the selected RM.";
      }

      setRows((prev) => {
        const withRow = prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                fifoPool,
                store_qty,
                loadingFifo: false,
                mappingError,
              }
            : sameRmItem(r, {
                  rm_item_code: picked.rm_item_code,
                  rm_item_dcode: picked.rm_item_dcode,
                }) && fifoPool.length
              ? { ...r, fifoPool }
              : r
        );
        if (!mappingError && fifoPool.length > 0) {
          const rowForSeed = withRow[idx];
          const { picked, pickedQty, storeQty } = seedCoilsForRow(
            rowForSeed,
            fifoPool,
            excludedUidsForRow(idx, withRow)
          );
          const seeded = withRow.map((r, i) =>
            i === idx
              ? {
                  ...r,
                  coils: mapPickedCoils(picked),
                  store_qty: storeQty,
                  issue_qty: pickedQty > 0 ? String(pickedQty) : "",
                  issue_target: pickedQty > 0 ? String(pickedQty) : "",
                }
              : r
          );
          return rebalanceSharedRmRows(idx, seeded);
        }
        return rebalanceSharedRmRows(idx, withRow);
      });
    },
    [excludedUidsForRow, loadFifoPool, readOnly, rebalanceSharedRmRows]
  );

  const handleRmChange = useCallback(
    (idx, rmKey) => {
      const row = rowsRef.current[idx];
      if (!row || readOnly || rmSelectionMode === "first" || !rmKey) return;
      const opts = buildRmOptions(row.mapped_rm_items, rmSelectionMode, allRmWireItems);
      const picked = opts.find((r) => rmOptionKey(r) === String(rmKey));
      if (!picked) return;
      void applyRmSelection(idx, picked);
    },
    [applyRmSelection, readOnly, rmSelectionMode, allRmWireItems]
  );

  const applyProductionMappingRef = useRef(applyProductionMapping);
  useEffect(() => {
    applyProductionMappingRef.current = applyProductionMapping;
  }, [applyProductionMapping]);

  useEffect(() => {
    let cancelled = false;
    if (!open) {
      setShift("A");
      setRemarks("");
      setApproved(false);
      setRows([emptyRow()]);
      setErrors({});
      setEditingIssueIdx(null);
      setSaving(false);
      setLoadingDetail(false);
      return;
    }

    setErrors({});

    const hydrate = async () => {
      if (!editIssueUid) {
        setShift("A");
        setRemarks("");
        setApproved(false);
        setRows([emptyRow()]);
        return;
      }
      setLoadingDetail(true);
      try {
        const res = await issueRequestService.getById(editData.issue_uid);
        if (cancelled) return;
        const d = res?.data || editData;
        setShift(String(d.shift || "A").toUpperCase() === "B" ? "B" : "A");
        setRemarks(d.remarks || "");
        // Approve drawer defaults ON; view/edit show the saved status
        setApproved(isApprove ? true : Boolean(d.approved));

        const cards = Array.isArray(d.job_cards) ? d.job_cards : [];
        if (cards.length) {
          const hydrated = cards.map((jc) => ({
            ...emptyRow(),
            pjobcardno: jc.pjobcardno || "",
            pldt: jc.pldt ?? null,
            item_code: jc.item_code || "",
            itemdcode: jc.itemdcode ?? jc.item_dcode ?? "",
            itemdesc: jc.itemdesc || jc.item_desc || "",
            planqty: Number(jc.planqty || 0) || 0,
            macname: jc.macname || "",
            part_weight: Number(jc.part_weight || 0) || 0,
            rm_weight: Number(jc.rm_weight || 0) || 0,
            issue_qty: jc.issue_qty != null ? String(jc.issue_qty) : "",
            issue_target: jc.issue_qty != null ? String(jc.issue_qty) : "",
            production_id: jc.production_id ?? null,
            rm_item_code: jc.rm_item_code || "",
            rm_item_dcode: jc.rm_item_dcode ?? null,
            rm_item_desc: jc.rm_item_desc || "",
            coils: Array.isArray(jc.coils) ? jc.coils : [],
          }));
          setRows(hydrated);

          // Qty already requested for these job cards by *other* issue requests
          const summaryInput = hydrated
            .filter((r) => r.pjobcardno)
            .map((r) => ({ pjobcardno: r.pjobcardno, planqty: r.planqty }));
          if (summaryInput.length) {
            void issueRequestService
              .jobCardSummary(summaryInput, editIssueUid)
              .then((res) => {
                if (cancelled) return;
                const byJc = new Map(
                  (res?.data || []).map((s) => [String(s.pjobcardno || "").toUpperCase(), s])
                );
                setRows((prev) =>
                  prev.map((r) => {
                    const hit = byJc.get(String(r.pjobcardno || "").toUpperCase());
                    if (!hit) return r;
                    const issued_qty = Number(hit.issued_qty || 0) || 0;
                    // View: keep saved issue_qty as-is (no rewrite). Edit: restore typed cover ≤ remaining.
                    let issue_target = r.issue_target || r.issue_qty || "";
                    if (!isView) {
                      const rm = Number(r.rm_weight) || 0;
                      const remain = rm > 0 ? Math.max(0, roundQty(rm - issued_qty)) : null;
                      const coilQty = Number(r.issue_qty) || 0;
                      if (remain != null && coilQty > remain + 1e-9) {
                        issue_target = String(remain);
                      }
                    }
                    return {
                      ...r,
                      issued_qty,
                      issued_count: Number(hit.request_count || 0) || 0,
                      issue_target,
                    };
                  })
                );
              })
              .catch(() => {});
          }

          // Edit/approve: reload production master mappings + FIFO pool (keep saved coils/qty)
          if (!isView) {
            hydrated.forEach((row, idx) => {
              if (row.pjobcardno) {
                void applyProductionMappingRef.current(idx, row, { resetIssue: false }); // ✅ ref use karo
              }
            });
          }
        } else {
          // Legacy single mapping → one row
          setRows([
            {
              ...emptyRow(),
              pjobcardno: d.pjobcardno || (d.production_id ? `PROD-${d.production_id}` : ""),
              item_code: d.item_code || "",
              itemdcode: d.item_dcode || "",
              itemdesc: d.item_desc || "",
              planqty: Number(d.requested_qty || 0) || 0,
              part_weight: Number(d.part_weight || 0) || 0,
              rm_weight: Number(d.rm_weight || 0) || 0,
              issue_qty: d.requested_qty != null ? String(d.requested_qty) : "",
              issue_target: d.requested_qty != null ? String(d.requested_qty) : "",
              production_id: d.production_id ?? null,
              rm_item_code: d.rm_item_code || "",
              rm_item_dcode: d.rm_item_dcode ?? null,
              rm_item_desc: d.rm_item_desc || "",
              coils: Array.isArray(d.coils) ? d.coils : [],
            },
          ]);
        }
      } catch (err) {
        toast.error(err?.message || "Could not load the issue request. Please try again.");
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [open, editIssueUid, isApprove, isView]);

  const fetchJobCards = useCallback(
    async (params = {}) =>
      productionErpHelpers.getPrdRunJcViews({
        ...helperPerms,
        page: params.page || 1,
        limit: params.limit || 50,
        search: params.search || "",
      }),
    [helperPerms]
  );

  const getJobCardById = useCallback(
    (id) => productionErpHelpers.getPrdRunJcViewById(id, helperPerms),
    [helperPerms]
  );

  const handleJcChange = async (idx, id, raw) => {
    if (readOnly) return;
    if (!id) {
      setRows((prev) => {
        const cleared = prev.map((r, i) => (i === idx ? emptyRow() : r));
        // Free coils back to siblings with same RM
        const siblingIdx = cleared.findIndex(
          (r, i) => i !== idx && (r.rm_item_code || r.rm_item_dcode)
        );
        if (siblingIdx >= 0) return rebalanceSharedRmRows(siblingIdx, cleared);
        return cleared.map((row, i) => {
          if (!row.fifoPool?.length) return row;
          const { storeQty } = pickCoilsByCount(
            row.fifoPool,
            0,
            excludedUidsForRow(i, cleared)
          );
          return { ...row, store_qty: storeQty };
        });
      });
      return;
    }
    const used = rowsRef.current.some(
      (r, i) => i !== idx && String(r.pjobcardno).toUpperCase() === String(id).toUpperCase()
    );
    if (used) {
      toast.error(`Job card ${id} has already been selected.`);
      return;
    }

    let detail = raw && typeof raw === "object" ? raw : null;
    if (!detail?.item_code || !detail?.macname || !(Number(detail?.rm_weight) > 0)) {
      try {
        const full = await getJobCardById(id);
        if (full) detail = { ...full, ...(detail || {}) };
      } catch {
        // keep whatever we already have from the picker
      }
    }

    const machine = String(detail?.macname || "").trim();
    if (ISSUE_REQUEST_MACHINE_JOB_CARD_LOCK && machine) {
      const mk = machineKey(machine);
      const jk = machineKey(id);
      const hit = rowsRef.current.find(
        (r, i) =>
          i !== idx &&
          machineKey(r.macname) === mk &&
          machineKey(r.pjobcardno) &&
          machineKey(r.pjobcardno) !== jk
      );
      if (hit) {
        toast.error(
          `Machine ${machine} can only run one job card at a time. It is already assigned to job card ${hit.pjobcardno} on this request.`
        );
        return;
      }
    }

    const base = {
      pjobcardno: String(detail?.pjobcardno || id),
      pldt: detail?.pldt ?? null,
      item_code: detail?.item_code || "",
      itemdcode: detail?.itemdcode ?? detail?.item_dcode ?? "",
      itemdesc: detail?.itemdesc || detail?.item_desc || "",
      planqty: Number(detail?.planqty || 0) || 0,
      macname: machine,
      part_weight: Number(detail?.part_weight || 0) || 0,
      rm_weight: Number(detail?.rm_weight || 0) || 0,
      issue_qty: "",
      coils: [],
    };
    void resolveMappingAndFifo(idx, base);
    if (errors.job_cards) setErrors((prev) => ({ ...prev, job_cards: "" }));
  };

  // FUTURE (Dispatch Qty UI): keep these handlers — uncomment the Dispatch Qty input in the row grid.
  const handleIssueQtyFocus = (idx) => {
    if (readOnly) return;
    setEditingIssueIdx(idx);
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const target =
          r.issue_target !== "" && r.issue_target != null
            ? String(r.issue_target)
            : r.issue_qty != null
              ? String(r.issue_qty)
              : "";
        return { ...r, issue_target: target };
      })
    );
  };

  const handleIssueQtyChange = (idx, value) => {
    if (readOnly) return;
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, issue_target: value } : r))
    );
  };

  const handleIssueQtyBlur = (idx) => {
    setEditingIssueIdx((cur) => (cur === idx ? null : cur));
    if (readOnly) return;
    const prev = rowsRef.current;
    const row = prev[idx];
    if (!row) return;
    const raw =
      row.issue_target === "" || row.issue_target == null ? "" : String(row.issue_target);
    const { rows: next, notices } = applyFifoToRow(idx, raw, prev);
    setRows(next);
    flushNotices(notices);
  };

  const handleCoilChange = (idx, action) => {
    if (readOnly) return;
    const prev = rowsRef.current;
    const row = prev[idx];
    if (!row || row.mappingError || isRmFullyIssued(row)) return;
    const { availableCount, selectedCount } = getRowAvailability(idx, prev);
    const nextCount = action === "add" ? selectedCount + 1 : selectedCount - 1;
    const remain = remainingRmMax(row);
    const minCount = remain != null && remain > 0 ? 1 : 0;
    if (nextCount < minCount || nextCount > availableCount) return;
    if (action === "add") {
      const need = coilAddCoverNeed(row);
      if (need != null && rowCoilQty(row) >= need - 1e-9) {
        toast.warning(
          `Required RM is already covered (${formatExactNumber(need)} remaining max).`
        );
        return;
      }
    }
    setRows(applyCoilCountToRow(idx, nextCount, prev));
  };

  const canAddCoil = (idx) => {
    const row = rows[idx];
    const { availableCount, selectedCount } = getRowAvailability(idx, rows);
    if (readOnly || row?.mappingError || isRmFullyIssued(row) || selectedCount >= availableCount) {
      return false;
    }
    const need = coilAddCoverNeed(row);
    if (need != null && rowCoilQty(row) >= need - 1e-9) return false;
    return true;
  };

  const addRow = () => {
    if (readOnly) return;
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (idx) => {
    if (readOnly) return;
    setRows((prev) => {
      if (prev.length <= 1) return [emptyRow()];
      const next = prev.filter((_, i) => i !== idx);
      if (!next.length) return [emptyRow()];
      // Rebalance from first remaining row that has RM coils
      const pivot = next.findIndex((r) => r.rm_item_code || r.rm_item_dcode);
      if (pivot < 0) return next;
      return rebalanceSharedRmRows(pivot, next);
    });
  };

  const validate = () => {
    const next = {};
    if (!SHIFT_OPTIONS.some((o) => o.value === shift)) next.shift = "Select a shift.";
    const validRows = rows.filter((r) => r.pjobcardno);
    if (!validRows.length) next.job_cards = "Add at least one job card.";
    else {
      const machineToJc = new Map();
      for (const r of validRows) {
        if (ISSUE_REQUEST_MACHINE_JOB_CARD_LOCK) {
          const mk = machineKey(r.macname);
          if (mk) {
            const jk = machineKey(r.pjobcardno);
            const prev = machineToJc.get(mk);
            if (prev && prev !== jk) {
              next.job_cards = `Machine ${r.macname} can only run one job card at a time.`;
              break;
            }
            if (!prev) machineToJc.set(mk, jk);
          }
        }
        if (r.mappingError) {
          next.job_cards = r.mappingError;
          break;
        }
        if (isRmFullyIssued(r)) {
          next.job_cards = `Required RM weight already issued for job card ${r.pjobcardno}. No further coils can be selected.`;
          break;
        }
        if (!(r.rm_item_code || r.rm_item_dcode)) {
          next.job_cards = `Select RM wire for job card ${r.pjobcardno}.`;
          break;
        }
        const issueQty = Number(r.issue_qty);
        if (!(issueQty > 0)) {
          next.job_cards = `Enter issue quantity for job card ${r.pjobcardno}.`;
          break;
        }
        if (!r.coils?.length) {
          next.job_cards = `Select coils for job card ${r.pjobcardno}.`;
          break;
        }
        const coilQty = rowCoilQty(r);
        if (Math.abs(coilQty - issueQty) > 0.001) {
          next.job_cards = `Issue quantity must match coil total for job card ${r.pjobcardno}.`;
          break;
        }
        // FIFO quotas for cover/dispatch; issue_qty (coil total) may overshoot
        const coverQty = dispatchCoverQty(r);
        if (r.fifoPool?.length) {
          const idx = rows.indexOf(r);
          const fifoOk = assertMrnLevelFifo(
            r.fifoPool,
            r.coils,
            coverQty > 0 ? coverQty : issueQty,
            excludedUidsForRow(idx, rows)
          );
          if (!fifoOk) {
            next.job_cards = `Coils for job card ${r.pjobcardno} must follow MRN FIFO. Please refresh and try again.`;
            break;
          }
        }
      }
    }
    return next;
  };

  const handleSave = async (statusOverride = null) => {
    if (readOnly) {
      onClose?.();
      return;
    }
    const next = validate();
    if (Object.keys(next).length) {
      setErrors(next);
      toast.error("Please fix the highlighted fields.");
      focusFirstError(next, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;

    const approvedFlag =
      statusOverride === true
        ? true
        : statusOverride === false
          ? false
          : showApproval
            ? Boolean(approved)
            : undefined;

    const payload = {
      shift,
      remarks: remarks || null,
      job_cards: rows
        .filter((r) => r.pjobcardno)
        .map((r) => ({
          pjobcardno: r.pjobcardno,
          pldt: r.pldt,
          item_code: r.item_code,
          itemdcode: r.itemdcode,
          itemdesc: r.itemdesc,
          planqty: r.planqty,
          macname: r.macname,
          part_weight: r.part_weight,
          rm_weight: r.rm_weight,
          production_id: r.production_id ?? null,
          rm_item_dcode: r.rm_item_dcode ?? null,
          rm_item_code: r.rm_item_code || null,
          rm_item_desc: r.rm_item_desc || null,
          dispatch_qty: dispatchCoverQty(r),
          issue_qty: Number(r.issue_qty),
          coils: (r.coils || []).map((c) => ({
            coil_no_uid: c.coil_no_uid,
            qty: c.qty,
            mrn_uid: c.mrn_uid ?? null,
            mrn_no: c.mrn_no ?? null,
          })),
        })),
      ...(approvedFlag !== undefined ? { approved: approvedFlag } : {}),
    };

    setSaving(true);
    try {
      let res;
      if (isApprove && editData?.issue_uid) {
        if (statusOverride === false) {
          res = await issueRequestService.update(editData.issue_uid, { ...payload, approved: false });
        } else {
          res = await issueRequestService.approve(editData.issue_uid, payload);
        }
      } else if (isEdit && editData?.issue_uid) {
        res = await issueRequestService.update(editData.issue_uid, payload);
      } else {
        res = await issueRequestService.create(payload);
      }
      notify(res, "Saved successfully.");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not save the issue request. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const title = isView
    ? "View Issue Request"
    : isApprove
      ? "Approve Issue Request"
      : isEdit
        ? "Edit Issue Request"
        : "New Issue Request";

  const footerContent = (
    <RmStoreDrawerFooter
      onClose={onClose}
      loading={saving}
      disabled={loadingDetail}
      readOnly={readOnly}
      isApprove={isApprove}
      onSave={handleSave}
      approveLabel="Authorize"
    />
  );

  const drawerDescription = isView
    ? "View job cards, FIFO coils, and approval status."
    : isApprove
      ? "Review details, then Keep Pending or Authorize. Coils stay reserved either way."
      : isEdit
        ? "Edit job cards and Dispatch Qty. Saving an authorized request resets it to Pending."
        : ISSUE_REQUEST_MACHINE_JOB_CARD_LOCK
          ? "Each machine can run one job card at a time until Store Out is authorized. Coil qty is reserved now; Store Out can scan any coil from the same MRN."
          : "Coil qty is reserved now; Store Out can scan any coil from the same MRN.";

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={
        readOnly || saving || loadingDetail
          ? undefined
          : () => handleSave(isApprove ? true : undefined)
      }
      title={title}
      description={drawerDescription}
      footer={footerContent}
      maxWidth="max-w-6xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        {loadingDetail && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        )}

        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized request will reset its status to{" "}
              <span className="font-bold text-amber-900 uppercase">Pending</span>.
            </p>
          </div>
        )}

        <div
          data-field="job_cards"
          className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 shadow-inner"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Package size={14} className="text-indigo-600 shrink-0" />
              <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                Job Card Breakdown
              </h3>
              <label
                data-field="shift"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"
              >
                Shift
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value === "B" ? "B" : "A")}
                  disabled={readOnly}
                  className={`h-7 min-w-[52px] px-1.5 rounded-md border text-[11px] font-black ${
                    errors.shift ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-white"
                  }`}
                >
                  {SHIFT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="text-[10px] font-bold tabular-nums text-indigo-700">
              {totals.issueQty.toLocaleString()} issue · {totals.coilCount} coils ·{" "}
              {totals.coilQty.toLocaleString()} qty
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row, idx) => {
              const live = getRowAvailability(idx, rows);
              const availableCount = live.availableCount;
              const selectedCount = live.selectedCount;
              const displayStoreQty = Math.max(0, roundQty((Number(live.storeQty) || 0) - rowCoilQty(row)));
              const balance = rowBalance(row);
              // Whole-coil overshoot above remaining RM is allowed — don't warn on that.
              // Only warn when there is no RM cap and issue exceeds plan pending.
              const overIssue =
                !balance.rmCap && balance.plan > 0 && Number(row.issue_qty) > 0
                  ? roundQty(Number(row.issue_qty) - Math.max(0, balance.pending))
                  : 0;
              const pendingTone =
                balance.rmCap
                  ? balance.over || balance.pending <= 0
                    ? "rose"
                    : "emerald"
                  : balance.plan <= 0
                    ? "slate"
                    : balance.over || balance.pending <= 0
                      ? "rose"
                      : "emerald";
              const remainRm = remainingRmMax(row);
              const rmComplete = isRmFullyIssued(row);
              const hasJobCard = Boolean(row.pjobcardno);
              const rmOpts = buildRmOptions(row.mapped_rm_items, rmSelectionMode, allRmWireItems);
              const selectedRmKey = rmOptionKey(row);
              const rmValue = rmListHasKey(rmOpts, selectedRmKey) ? selectedRmKey : "";
              const rowRmColor = rmSelectionMode === "all" ? getSuperAdminRowRmColor(idx) : null;
              const selectedRmIsMapped = isRmMappedForItems(
                { rm_item_code: row.rm_item_code, rm_item_dcode: row.rm_item_dcode },
                row.mapped_rm_items
              );
              const rmDisabled =
                readOnly ||
                !hasJobCard ||
                row.loadingFifo ||
                (rmSelectionMode === "all" && loadingAllRmWire) ||
                (rmSelectionMode !== "all" && !rmOpts.length) ||
                rmSelectionMode === "first";

              return (
                <div
                  key={`jc-row-${idx}`}
                  className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2.5 relative group/row shadow-sm"
                >
                  {/* Info row — badges only (FN Sch / Balance style) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Row #{idx + 1}
                      </span>
                      {row.pjobcardno ? (
                        <>
                          {row.macname ? (
                            <InfoBadge
                              label="Machine"
                              value={row.macname}
                              tone="slate"
                              numeric={false}
                              title="Production machine for this job card"
                            />
                          ) : null}
                          <InfoBadge
                            label="Plan"
                            value={balance.plan}
                            tone="indigo"
                            title="Planned qty on this job card"
                          />
                          {row.part_weight > 0 ? (
                            <InfoBadge
                              label="Part Wt"
                              value={row.part_weight}
                              tone="slate"
                              title="Part weight from ERP"
                            />
                          ) : null}
                          {row.rm_weight > 0 ? (
                            <InfoBadge
                              label="RM Wt"
                              value={row.rm_weight}
                              tone="slate"
                              title="RM weight from ERP"
                            />
                          ) : null}
                          <InfoBadge
                            label="Issued"
                            value={balance.issued}
                            tone={balance.issued > 0 ? "amber" : "slate"}
                            loading={row.loadingIssued}
                            title={
                              row.issued_count
                                ? `Already requested in ${row.issued_count} earlier issue request${
                                    row.issued_count === 1 ? "" : "s"
                                  }`
                                : "No earlier issue request for this job card"
                            }
                          />
                          <InfoBadge
                            label={balance.over ? "Over" : "Pending"}
                            value={balance.over ? -balance.pending : Math.max(0, balance.pending)}
                            tone={pendingTone}
                            loading={row.loadingIssued}
                            title={
                              balance.rmCap
                                ? "Remaining RM weight (RM Wt − already issued)"
                                : "Plan qty minus qty already issued"
                            }
                          />
                        </>
                      ) : null}
                    </div>
                    {rows.length > 1 && !readOnly && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="p-1 text-rose-400 hover:bg-rose-50 rounded-md transition-colors shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Job Card → RM item (Production Master mapping, permission-based) */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:gap-2 items-end w-full">
                    <div className="min-w-0 text-[11px] sm:col-span-4">
                      <SearchableSelect
                        label="Job Card"
                        value={row.pjobcardno}
                        onChange={(id, raw) => handleJcChange(idx, id, raw)}
                        fetchService={fetchJobCards}
                        getByIdService={getJobCardById}
                        dataKey="id"
                        labelKey="label"
                        selectedLabelKey="label"
                        subLabelKey="sub"
                        required
                        disabled={readOnly}
                        preserveApiOrder
                        showDuplicateSubLabel
                      />
                    </div>

                    <div className="min-w-0 text-[11px] sm:col-span-4">
                        <SearchableSelect
                          label={rmSelectionMode === "all" && rmValue ? "" : "RM Wire"}
                          value={rmValue}
                          onChange={(id) => handleRmChange(idx, id)}
                          fetchService={(params) =>
                            fetchRmWireOptions(rmOpts, params, { mappedItems: row.mapped_rm_items })
                          }
                          getByIdService={(id) => getRmWireById(rmOpts, id)}
                          dataKey="id"
                          labelKey="item_code"
                          subLabelKey="sub"
                          disabled={rmDisabled}
                          getOptionStyle={
                            rmSelectionMode === "all"
                              ? (item) =>
                                  item._isMapped
                                    ? {
                                        backgroundColor: rowRmColor.soft,
                                        borderLeft: `3px solid ${rowRmColor.accent}`,
                                      }
                                    : undefined
                              : undefined
                          }
                          getOptionClassName={
                            rmSelectionMode === "all"
                              ? (item) => (item._isMapped ? "font-semibold" : "opacity-80")
                              : undefined
                          }
                          placeholder={
                          !hasJobCard
                            ? "Select job card first"
                            : row.loadingFifo || loadingAllRmWire
                              ? "Loading…"
                              : rmSelectionMode === "all"
                                ? "Search RM wire…"
                                : rmOpts.length
                                  ? "Search RM wire…"
                                  : "No RM mapping"
                        }
                        preserveApiOrder
                        showDuplicateSubLabel
                        selectedLabelKey="sub"
                        emptyMessage={
                          !hasJobCard
                            ? "Select a job card first"
                            : loadingAllRmWire
                              ? "Loading RM wires…"
                              : row.mappingError ||
                                (rmSelectionMode === "all"
                                  ? "No RM wires found"
                                  : "No RM items in production mapping")
                        }
                        />
                    </div>

                    {/* Left / Coils / Qty — always 3-up; on desktop sit in remaining 4 cols */}
                    <div className="grid grid-cols-3 gap-2 min-w-0 sm:col-span-4">
                    <div className="space-y-0.5 min-w-0">
                      <label className={`${MICRO_LABEL} ${Number(displayStoreQty) > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        Left
                      </label>
                      <div
                        title="Stock left after coils selected on this row (and other rows on the same RM)"
                        className={`text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-xs tabular-nums ${
                          Number(displayStoreQty) > 0 ? "bg-emerald-600" : "bg-rose-500"
                        }`}
                      >
                        {row.loadingFifo ? (
                          <Loader2 size={14} className="animate-spin opacity-80" />
                        ) : (
                          Number(displayStoreQty || 0).toLocaleString()
                        )}
                      </div>
                    </div>

                  {/* FUTURE: uncomment Dispatch Qty — also set Job Card wrapper to col-span-3 (now col-span-5).
                    <div className="col-span-2 space-y-0.5 min-w-0">
                      <label className={MICRO_LABEL}>Dispatch Qty</label>
                      <input
                        type="number"
                        min="0"
                        max={remainingRmMax(row) != null ? remainingRmMax(row) : undefined}
                        step="any"
                        value={
                          readOnly
                            ? row.issue_qty || ""
                            : editingIssueIdx === idx
                              ? row.issue_target ?? ""
                              : row.issue_target || row.issue_qty || ""
                        }
                        onFocus={() => handleIssueQtyFocus(idx)}
                        onChange={(e) => handleIssueQtyChange(idx, e.target.value)}
                        onBlur={() => handleIssueQtyBlur(idx)}
                        disabled={readOnly || !row.pjobcardno || !!row.mappingError}
                        title={
                          remainingRmMax(row) != null
                            ? `Type up to ${formatExactNumber(remainingRmMax(row))} required. After apply, field shows actual send qty (whole coils may overshoot).`
                            : "Enter quantity, then leave the field to apply FIFO"
                        }
                        className={`${OK_INPUT} text-center font-bold text-slate-700 h-[38px] text-[11px] rounded-lg border-slate-200`}
                        placeholder="0"
                      />
                    </div>
                  */}

                    <div className="space-y-0.5 min-w-0">
                      <label className={MICRO_LABEL}>Coils</label>
                      <div className="flex items-center justify-between gap-0.5 h-[38px] px-1 border border-slate-200 rounded-lg bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => handleCoilChange(idx, "remove")}
                          disabled={
                            readOnly ||
                            rmComplete ||
                            selectedCount <= 0 ||
                            (selectedCount <= 1 && remainRm != null && remainRm > 0)
                          }
                          title={
                            rmComplete
                              ? "Required RM already issued"
                              : selectedCount <= 0
                                ? "No coils selected"
                                : selectedCount <= 1 && remainRm > 0
                                  ? "Minimum 1 coil while RM is pending"
                                  : "Remove last FIFO coil"
                          }
                          className="w-6 h-6 shrink-0 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-md transition-all disabled:opacity-30 font-black text-base border border-rose-50"
                        >
                          -
                        </button>
                        <div className="flex flex-col items-center justify-center min-w-0 flex-1">
                          <span className="text-[10px] font-black text-slate-700 leading-none">
                            {selectedCount}
                          </span>
                          <div className="h-[1px] w-2 bg-slate-200 my-0.5" />
                          <span className="text-[10px] font-bold text-slate-400 leading-none">
                            {availableCount}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCoilChange(idx, "add")}
                          disabled={!canAddCoil(idx)}
                          title={
                            rmComplete
                              ? "Required RM already issued"
                              : !canAddCoil(idx)
                                ? availableCount <= 0
                                  ? "No coils available"
                                  : remainRm != null && rowCoilQty(row) >= remainRm - 1e-9
                                    ? "Required RM already covered"
                                    : "All available coils are selected"
                                : "Add next FIFO coil"
                          }
                          className="w-6 h-6 shrink-0 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 rounded-md transition-all disabled:opacity-30 font-black text-base border border-indigo-50"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <label className={`${MICRO_LABEL} text-indigo-600`}>Qty</label>
                      <div
                        title="Reserved coil total — Store Out may scan any coil from the same MRN"
                        className="bg-indigo-600 text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-xs tabular-nums"
                      >
                        {rowCoilQty(row).toLocaleString()}
                      </div>
                    </div>
                    </div>
                    </div>

                  {/* {(row.itemdesc || row.macname || row.rm_item_code) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 px-0.5">
                      {row.itemdesc ? <span className="truncate max-w-full">{row.itemdesc}</span> : null}
                      {row.macname ? (
                        <span className="font-bold text-slate-600">Machine: {row.macname}</span>
                      ) : null}
                      {row.rm_item_code ? (
                        <span className="font-bold text-indigo-600">RM: {row.rm_item_code}</span>
                      ) : null}
                    </div>
                  )} */}

                  {overIssue > 0 && (
                    <p className="text-[10px] font-bold text-amber-600 px-0.5">
                      Issue qty exceeds pending by {overIssue.toLocaleString()} (needs{" "}
                      {Math.max(0, balance.pending).toLocaleString()} more).
                    </p>
                  )}

                  {row.mappingError && (
                    <p className="text-[10px] font-bold text-rose-500 px-0.5">{row.mappingError}</p>
                  )}

                  {rmComplete && !row.mappingError && (
                    <p className="text-[10px] font-bold text-rose-600 px-0.5">
                      Required RM weight ({formatExactNumber(row.rm_weight)}) is already issued
                      {balance.over
                        ? ` — over by ${formatExactNumber(balance.pending)}`
                        : ""}
                      . No coils can be selected.
                    </p>
                  )}

                  {/* Reserved coils by MRN — Store Out scans these same coil UIDs. */}
                  {selectedCount > 0 && (() => {
                    const mrnGroups = groupSelectedCoilsByMrn(row.coils || []);
                    return (
                      <div className="mt-1.5 border border-slate-100 rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-2 py-1 text-left font-black text-slate-400 uppercase">
                                MRN UID
                              </th>
                              <th className="px-2 py-1 text-center font-black text-slate-400 uppercase">
                                Coils
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {mrnGroups.map(({ key, label, coils }) => (
                              <tr key={key} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-2 py-1 font-bold text-slate-600">#{label}</td>
                                <td className="px-2 py-1 text-center text-indigo-600 font-black tabular-nums">
                                  {coils.length}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* FUTURE: old breakdown with coil qty + ERP stock qty (replace active table above if needed).
                  {selectedCount > 0 && (() => {
                    const mrnGroups = groupSelectedCoilsByMrn(row.coils || []);
                    const showErpStock = !readOnly && Array.isArray(row.fifoPool) && row.fifoPool.length > 0;
                    const poolQtyForMrn = (pool, mrnKey) =>
                      (pool || [])
                        .filter((c) => mrnGroupKey(c) === mrnKey)
                        .reduce((s, c) => s + (Number(c.qty) || 0), 0);
                    return (
                      <div className="mt-1.5 border border-slate-100 rounded-md overflow-x-auto">
                        <table className="w-full min-w-[280px] text-xs">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-2 py-1 text-left font-black text-slate-400 uppercase">MRN UID</th>
                              <th className="px-2 py-1 text-center font-black text-slate-400 uppercase">Coils</th>
                              <th className="px-2 py-1 text-right font-black text-slate-400 uppercase">Total</th>
                              {showErpStock ? (
                                <th className="px-2 py-1 text-right font-black text-yellow-500 uppercase">ERP Stock</th>
                              ) : null}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {mrnGroups.map(({ key, label, coils }) => {
                              const totalQty = coils.reduce((s, c) => s + (Number(c.qty) || 0), 0);
                              const n = coils.length;
                              return (
                                <tr key={key}>
                                  <td className="px-2 py-1 font-bold text-slate-600">#{label}</td>
                                  <td className="px-2 py-1 text-center text-indigo-600 font-bold">
                                    {n} coil{n === 1 ? "" : "s"} · {totalQty.toLocaleString()} qty
                                  </td>
                                  <td className="px-2 py-1 text-right font-black tabular-nums">{totalQty.toLocaleString()}</td>
                                  {showErpStock ? (
                                    <td className="px-2 py-1 text-right font-bold tabular-nums">
                                      {poolQtyForMrn(row.fifoPool, key).toLocaleString()}
                                    </td>
                                  ) : null}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                  */}
                </div>
              );
            })}
          </div>

          {!readOnly && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={addRow}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={14} /> Add Row
              </button>
            </div>
          )}

          {errors.shift && (
            <p className="text-[10px] font-bold text-rose-500">{errors.shift}</p>
          )}
          {errors.job_cards && (
            <p className="text-[10px] font-bold text-rose-500">{errors.job_cards}</p>
          )}
        </div>

        <FormTextarea
          label="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
          placeholder="Enter remarks (optional)"
          disabled={readOnly}
        />

        {/* Add: draft/authorize toggle. Approve: footer Keep Pending / Authorize. View: status only. */}
        {isView ? (
          <div
            className={`p-3 rounded-xl border flex items-center gap-3 ${
              approved
                ? "bg-emerald-50 border-emerald-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <AlertCircle
              size={16}
              className={approved ? "text-emerald-600 shrink-0" : "text-slate-400 shrink-0"}
            />
            <div>
              <p className="text-xs font-bold text-slate-700">Approval Status</p>
              <p
                className={`text-[9px] uppercase font-bold tracking-tight ${
                  approved ? "text-emerald-700" : "text-slate-400"
                }`}
              >
                {approved ? "Authorized" : "Draft / Pending"}
              </p>
            </div>
          </div>
        ) : isApprove ? (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400 shrink-0" />
            <p className="text-[10px] text-slate-500 italic">
              Use Keep Pending to save as draft, or Authorize to approve for Store Out.
            </p>
          </div>
        ) : (
          <ApprovalStatusToggle
            show={showApproval}
            checked={approved}
            onChange={setApproved}
            pendingHint="This issue request will stay Pending until authorized."
          />
        )}

        {!readOnly && (
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={`${open}-${sopPermissionType}`}
            moduleSlug={MODULE}
            permissionType={sopPermissionType}
            isOpen={open}
          />
        )}
      </div>
    </Drawer>
  );
}
