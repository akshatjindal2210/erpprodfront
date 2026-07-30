"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Loader2, Package, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";

import { issueRequestService } from "@/apps/rmstore/lib/services/issueRequest";
import { productionService, productionErpHelpers } from "@/apps/rmstore/lib/services/production";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import Drawer from "@/ui/primitives/Drawer";
import RemarksTextarea from "@/ui/common/forms/RemarksTextarea";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import ApprovalStatusToggle from "@/apps/rmstore/modules/shared/ApprovalStatusToggle";
import { OK_INPUT } from "@/ui/common/Constants";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { focusFirstError } from "@/platform/utils/form/formFocus";

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
  issue_qty: "",
  /** User-typed target while editing Dispatch Qty (FIFO runs on blur). */
  issue_target: "",
  production_id: null,
  rm_item_code: "",
  rm_item_dcode: null,
  rm_item_desc: "",
  store_qty: 0,
  issued_qty: 0,
  issued_count: 0,
  loadingIssued: false,
  coils: [],
  fifoPool: [],
  loadingFifo: false,
  mappingError: "",
});

/** Trim float artifacts from subtracted quantities. */
const roundQty = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

/** Plan vs already-issued balance for a job card. */
function rowBalance(row) {
  const plan = Number(row?.planqty || 0) || 0;
  const issued = Number(row?.issued_qty || 0) || 0;
  const pending = roundQty(plan - issued);
  return { plan, issued, pending, over: plan > 0 && pending < 0 };
}

function pickCoilsFifo(pool, targetQty, excludeUids) {
  const exclude = new Set([...excludeUids].map((u) => String(u).toLowerCase()));
  const sorted = [...(pool || [])]
    .filter((c) => c?.coil_no_uid && !exclude.has(String(c.coil_no_uid).toLowerCase()))
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return Number(a.coil_uid || 0) - Number(b.coil_uid || 0);
    });

  const storeQty = sorted.reduce((s, c) => s + (Number(c.qty) || 0), 0);
  if (!(Number(targetQty) > 0)) {
    return { picked: [], pickedQty: 0, storeQty, available: sorted };
  }

  const picked = [];
  let pickedQty = 0;
  for (const c of sorted) {
    if (pickedQty >= Number(targetQty)) break;
    picked.push(c);
    pickedQty += Number(c.qty) || 0;
  }
  return { picked, pickedQty, storeQty, available: sorted };
}

function pickCoilsByCount(pool, count, excludeUids) {
  const { available, storeQty } = pickCoilsFifo(pool, 0, excludeUids);
  const n = Math.max(0, Math.min(Number(count) || 0, available.length));
  const picked = available.slice(0, n);
  const pickedQty = picked.reduce((s, c) => s + (Number(c.qty) || 0), 0);
  return { picked, pickedQty, storeQty, available };
}

function mapPickedCoils(picked) {
  return (picked || []).map((c) => ({
    coil_no_uid: c.coil_no_uid,
    qty: c.qty,
    item_code: c.item_code,
    heat_no: c.heat_no,
    mrn_no: c.mrn_no,
    location_no: c.location_no || null,
    location_id: c.location_id ?? null,
    created_at: c.created_at,
  }));
}

function rowCoilQty(row) {
  return (row?.coils || []).reduce((s, c) => s + (Number(c.qty) || 0), 0);
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

const MICRO_LABEL = "text-[10px] font-bold uppercase tracking-wide text-slate-600 block ml-1";

const BADGE_TONES = {
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-800",
  amber: "bg-amber-100 border-amber-300 text-amber-900",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
  rose: "bg-rose-50 border-rose-200 text-rose-700",
  slate: "bg-slate-100 border-slate-300 text-slate-600",
};

/** Compact info chip — same idea as FN Sch / Balance badges (not input fields). */
function InfoBadge({ label, value, tone = "slate", loading = false, title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide tabular-nums shadow-sm ${
        BADGE_TONES[tone] || BADGE_TONES.slate
      }`}
    >
      <span className="opacity-80 font-bold">{label}</span>
      <span>{loading ? "…" : Number(value || 0).toLocaleString()}</span>
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
        next = next.map((r, j) =>
          j === i
            ? {
                ...r,
                fifoPool: r.fifoPool?.length ? r.fifoPool : next[changedIdx]?.fifoPool || [],
                issue_qty: pickedQty > 0 ? String(pickedQty) : want > 0 ? "" : r.issue_qty,
                issue_target: pickedQty > 0 ? String(pickedQty) : want > 0 ? "" : r.issue_target,
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
    (idx, nextIssueQty, currentRows = rowsRef.current) => {
      const row = currentRows[idx];
      if (!row) return currentRows;
      const { picked, pickedQty, storeQty } = pickCoilsFifo(
        row.fifoPool,
        nextIssueQty,
        excludedUidsForRow(idx, currentRows)
      );
      const updated = currentRows.map((r, i) =>
        i === idx
          ? {
              ...r,
              issue_qty:
                pickedQty > 0
                  ? String(pickedQty)
                  : nextIssueQty === "" || nextIssueQty === "0"
                    ? ""
                    : String(nextIssueQty),
              issue_target:
                pickedQty > 0
                  ? String(pickedQty)
                  : nextIssueQty === "" || nextIssueQty === "0"
                    ? ""
                    : String(nextIssueQty),
              store_qty: storeQty,
              coils: mapPickedCoils(picked),
            }
          : r
      );
      return rebalanceSharedRmRows(idx, updated);
    },
    [excludedUidsForRow, rebalanceSharedRmRows]
  );

  const applyCoilCountToRow = useCallback(
    (idx, count, currentRows = rowsRef.current) => {
      const row = currentRows[idx];
      if (!row) return currentRows;
      const { picked, pickedQty, storeQty } = pickCoilsByCount(
        row.fifoPool,
        count,
        excludedUidsForRow(idx, currentRows)
      );
      const updated = currentRows.map((r, i) =>
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

    // 1) Exact FG item_dcode (preferred) — approved first
    if (Number.isFinite(dcode) && dcode > 0) {
      const approvedRes = await productionService.getAll({
        page: 1,
        limit: 20,
        filters: { item_dcode: dcode, approved: true },
      });
      const approved = approvedRes?.data?.[0];
      if (approved) return { prod: approved, reason: null };

      const anyRes = await productionService.getAll({
        page: 1,
        limit: 5,
        filters: { item_dcode: dcode },
      });
      if (anyRes?.data?.[0]) {
        return {
          prod: null,
          reason: `A production mapping for ${code || dcode} exists but is not approved.`,
        };
      }
    }

    // 2) Fallback: match by FG item_code (approved)
    if (code) {
      const searchRes = await productionService.getAll({
        page: 1,
        limit: 50,
        search: code,
        filters: { approved: true },
      });
      const match = (searchRes?.data || []).find(
        (p) => String(p.item_code || "").trim().toUpperCase() === code.toUpperCase()
      );
      if (match) return { prod: match, reason: null };

      const anySearch = await productionService.getAll({
        page: 1,
        limit: 50,
        search: code,
      });
      const pending = (anySearch?.data || []).find(
        (p) => String(p.item_code || "").trim().toUpperCase() === code.toUpperCase()
      );
      if (pending) {
        return {
          prod: null,
          reason: `A production mapping for ${code} exists but is not approved.`,
        };
      }
    }

    return {
      prod: null,
      reason: `No production-to-RM mapping exists for item ${code || itemdcode || "—"}. Map it in the Production master first.`,
    };
  }, []);

  const resolveMappingAndFifo = useCallback(
    async (idx, baseRow) => {
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                ...baseRow,
                issued_qty: 0,
                issued_count: 0,
                loadingIssued: true,
                loadingFifo: true,
                mappingError: "",
              }
            : r
        )
      );

      const issuedPromise = fetchIssuedSummary(baseRow.pjobcardno, baseRow.planqty);

      let production_id = null;
      let rm_item_code = "";
      let rm_item_dcode = null;
      let rm_item_desc = "";
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
            production_id = prod.production_id;
            rm_item_code = prod.rm_item_code || "";
            rm_item_dcode = prod.rm_item_dcode ?? null;
            rm_item_desc = prod.rm_item_desc || "";
            if (!rm_item_code && !rm_item_dcode) {
              mappingError = "The production mapping has no RM item.";
            }
          }
        }
      } catch (err) {
        mappingError = err?.message || "Could not resolve the production mapping. Please try again.";
      }

      let fifoPool = [];
      let store_qty = 0;
      if (!mappingError && (rm_item_code || rm_item_dcode)) {
        try {
          // Reuse pool already loaded on another row for the same RM (keeps counts in sync).
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

      setRows((prev) => {
        const withRow = prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                ...baseRow,
                production_id,
                rm_item_code,
                rm_item_dcode,
                rm_item_desc,
                fifoPool,
                store_qty,
                issued_qty: issued.issued_qty,
                issued_count: issued.issued_count,
                loadingIssued: false,
                loadingFifo: false,
                mappingError,
                issue_qty: "",
                coils: [],
              }
            : // Push shared pool onto same-RM siblings
              sameRmItem(r, { rm_item_code, rm_item_dcode }) && fifoPool.length
                ? { ...r, fifoPool }
                : r
        );
        return rebalanceSharedRmRows(idx, withRow);
      });
    },
    [fetchIssuedSummary, findProductionMapping, loadFifoPool, rebalanceSharedRmRows]
  );

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
        setApproved(isApprove ? true : false);

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
                    return {
                      ...r,
                      issued_qty: Number(hit.issued_qty || 0) || 0,
                      issued_count: Number(hit.request_count || 0) || 0,
                    };
                  })
                );
              })
              .catch(() => {});
          }

          // Refresh FIFO pools in background for edit
          hydrated.forEach((row, idx) => {
            if (row.rm_item_code || row.rm_item_dcode) {
              void loadFifoPool({
                rm_item_code: row.rm_item_code,
                rm_item_dcode: row.rm_item_dcode,
              }).then(({ pool, storeQty }) => {
                if (cancelled) return;
                const byUid = new Map(
                  (pool || []).map((c) => [String(c.coil_no_uid || "").toLowerCase(), c])
                );
                setRows((prev) =>
                  prev.map((r, i) => {
                    if (i !== idx) return r;
                    return {
                      ...r,
                      fifoPool: pool,
                      store_qty: storeQty,
                      coils: (r.coils || []).map((c) => {
                        const full = byUid.get(String(c.coil_no_uid || "").toLowerCase());
                        if (!full) return c;
                        return {
                          ...c,
                          qty: c.qty ?? full.qty,
                          heat_no: c.heat_no || full.heat_no,
                          mrn_no: c.mrn_no ?? full.mrn_no,
                          item_code: c.item_code || full.item_code,
                          location_no: c.location_no || full.location_no || null,
                          created_at: c.created_at || full.created_at,
                        };
                      }),
                    };
                  })
                );
              });
            }
          });
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
  }, [open, editIssueUid, isApprove, loadFifoPool]);

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

  const handleJcChange = (idx, id, raw) => {
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
    const base = {
      pjobcardno: String(raw?.pjobcardno || id),
      pldt: raw?.pldt ?? null,
      item_code: raw?.item_code || "",
      itemdcode: raw?.itemdcode ?? raw?.item_dcode ?? "",
      itemdesc: raw?.itemdesc || raw?.item_desc || "",
      planqty: Number(raw?.planqty || 0) || 0,
      macname: raw?.macname || "",
      issue_qty: "",
      coils: [],
    };
    void resolveMappingAndFifo(idx, base);
    if (errors.job_cards) setErrors((prev) => ({ ...prev, job_cards: "" }));
  };

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
    setRows((prev) => {
      const row = prev[idx];
      if (!row) return prev;
      const raw =
        row.issue_target === "" || row.issue_target == null
          ? ""
          : String(row.issue_target);
      return applyFifoToRow(idx, raw, prev);
    });
  };

  const handleCoilChange = (idx, action) => {
    if (readOnly) return;
    setRows((prev) => {
      const row = prev[idx];
      if (!row || row.mappingError) return prev;
      const { availableCount, selectedCount } = getRowAvailability(idx, prev);
      const nextCount = action === "add" ? selectedCount + 1 : selectedCount - 1;
      if (nextCount < 0 || nextCount > availableCount) return prev;
      return applyCoilCountToRow(idx, nextCount, prev);
    });
  };

  const canAddCoil = (idx) => {
    const { availableCount, selectedCount } = getRowAvailability(idx, rows);
    return !readOnly && !rows[idx]?.mappingError && selectedCount < availableCount;
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
      for (const r of validRows) {
        if (r.mappingError) {
          next.job_cards = r.mappingError;
          break;
        }
        if (!(Number(r.issue_qty) > 0)) {
          next.job_cards = `Enter the issue quantity for job card ${r.pjobcardno}.`;
          break;
        }
        if (!r.coils?.length) {
          next.job_cards = `No FIFO coils are available for job card ${r.pjobcardno}.`;
          break;
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
      toast.error("Please fix the highlighted fields before saving.");
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
          issue_qty: Number(r.issue_qty),
          coils: (r.coils || []).map((c) => ({ coil_no_uid: c.coil_no_uid })),
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
      toast.success(res?.message || "Saved successfully.");
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

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => handleSave(isApprove ? true : undefined)}
      title={title}
      description="Select job cards and shift. Type Dispatch Qty — FIFO coils fill (same as IMS)."
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
              const displayStoreQty = live.storeQty;
              const balance = rowBalance(row);
              const overIssue =
                balance.plan > 0 && Number(row.issue_qty) > 0
                  ? roundQty(Number(row.issue_qty) - Math.max(0, balance.pending))
                  : 0;
              const pendingTone =
                balance.plan <= 0
                  ? "slate"
                  : balance.over || balance.pending <= 0
                    ? "rose"
                    : "emerald";

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
                          <InfoBadge
                            label="Plan"
                            value={balance.plan}
                            tone="indigo"
                            title="Planned qty on this job card"
                          />
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
                            title="Plan qty minus qty already issued"
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

                  {/* Input row — FN style: Job Card · Item · FG · Dispatch Qty · Coils · Std Qty */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-2 items-end">
                    <div className="col-span-2 sm:col-span-4 lg:col-span-3 min-w-0 text-[11px]">
                      <SearchableSelect
                        label="Job Card"
                        value={row.pjobcardno}
                        onChange={(id, raw) => handleJcChange(idx, id, raw)}
                        fetchService={fetchJobCards}
                        getByIdService={getJobCardById}
                        dataKey="id"
                        labelKey="label"
                        subLabelKey="sub"
                        required
                        disabled={readOnly}
                        preserveApiOrder
                        showDuplicateSubLabel
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2 lg:col-span-1 space-y-0.5 min-w-0">
                      <label className={MICRO_LABEL}>Item</label>
                      <div className="bg-slate-700 text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-[11px] px-1 truncate">
                        {row.item_code || "—"}
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-0.5 min-w-0">
                      <label
                        className={`${MICRO_LABEL} ${
                          Number(displayStoreQty) > 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        FG Stock
                      </label>
                      <div
                        title="Store-in + unassigned area (remaining for this row)"
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

                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-0.5 min-w-0">
                      <label className={MICRO_LABEL}>Dispatch Qty</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          editingIssueIdx === idx
                            ? row.issue_target ?? ""
                            : row.issue_qty ?? ""
                        }
                        onFocus={() => handleIssueQtyFocus(idx)}
                        onChange={(e) => handleIssueQtyChange(idx, e.target.value)}
                        onBlur={() => handleIssueQtyBlur(idx)}
                        disabled={readOnly || !row.pjobcardno || !!row.mappingError}
                        title="Type qty, then Tab/click away — FIFO coils fill and Std Qty updates"
                        className={`${OK_INPUT} text-center font-bold text-slate-700 h-[38px] text-[11px] rounded-lg border-slate-200`}
                        placeholder="0"
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-0.5">
                      <label className={MICRO_LABEL}>Coils</label>
                      <div className="flex items-center justify-between gap-1 h-[38px] px-1.5 border border-slate-200 rounded-lg bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => handleCoilChange(idx, "remove")}
                          disabled={readOnly || selectedCount <= 0}
                          className="w-7 h-7 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-md transition-all disabled:opacity-30 font-black text-lg border border-rose-50"
                        >
                          -
                        </button>
                        <div className="flex flex-col items-center justify-center min-w-[40px]">
                          <span className="text-[11px] font-black text-slate-700 leading-none">
                            {selectedCount}
                          </span>
                          <div className="h-[1px] w-3 bg-slate-200 my-0.5" />
                          <span className="text-[11px] font-bold text-slate-400 leading-none">
                            {availableCount}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCoilChange(idx, "add")}
                          disabled={!canAddCoil(idx)}
                          title={
                            !canAddCoil(idx)
                              ? availableCount <= 0
                                ? "No FG coils (store + unassigned) in the FIFO pool"
                                : "All available FIFO coils are already selected"
                              : "Add the next FIFO coil"
                          }
                          className="w-7 h-7 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 rounded-md transition-all disabled:opacity-30 font-black text-lg border border-indigo-50"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-0.5 min-w-0">
                      <label className={`${MICRO_LABEL} text-indigo-600`}>Std Qty</label>
                      <div
                        title="FIFO coil total after Dispatch Qty / coil + −"
                        className="bg-indigo-600 text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-xs tabular-nums"
                      >
                        {rowCoilQty(row).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {(row.itemdesc || row.macname || row.rm_item_code) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 px-0.5">
                      {row.itemdesc ? <span className="truncate max-w-full">{row.itemdesc}</span> : null}
                      {row.macname ? (
                        <span className="font-bold text-slate-600">Machine: {row.macname}</span>
                      ) : null}
                      {row.rm_item_code ? (
                        <span className="font-bold text-indigo-600">RM: {row.rm_item_code}</span>
                      ) : null}
                    </div>
                  )}

                  {overIssue > 0 && (
                    <p className="text-[10px] font-bold text-amber-600 px-0.5">
                      Issue qty exceeds pending by {overIssue.toLocaleString()} (needs{" "}
                      {Math.max(0, balance.pending).toLocaleString()} more).
                    </p>
                  )}

                  {row.mappingError && (
                    <p className="text-[10px] font-bold text-rose-500 px-0.5">{row.mappingError}</p>
                  )}

                  {selectedCount > 0 && (
                    <div className="mt-0.5 border border-slate-100 rounded-md overflow-x-auto">
                      <table className="w-full min-w-[320px] text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-2 py-1 text-left font-black text-slate-400 uppercase">#</th>
                            <th className="px-2 py-1 text-left font-black text-slate-400 uppercase">Coil</th>
                            <th className="px-2 py-1 text-left font-black text-slate-400 uppercase">Heat</th>
                            <th className="px-2 py-1 text-left font-black text-slate-400 uppercase">MRN</th>
                            <th className="px-2 py-1 text-left font-black text-slate-400 uppercase">Location</th>
                            <th className="px-2 py-1 text-right font-black text-slate-400 uppercase">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(row.coils || []).map((c, cIdx) => (
                            <tr key={c.coil_no_uid || cIdx} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-2 py-1 font-bold text-slate-400 tabular-nums">{cIdx + 1}</td>
                              <td className="px-2 py-1 font-mono font-bold text-indigo-700 break-all">
                                {c.coil_no_uid || "—"}
                              </td>
                              <td className="px-2 py-1 font-bold text-amber-700">{c.heat_no || "—"}</td>
                              <td className="px-2 py-1 font-bold text-slate-600">{c.mrn_no ?? "—"}</td>
                              <td className="px-2 py-1 font-bold text-emerald-700">
                                {c.location_no || (c.location_id == null ? "Unassigned" : "—")}
                              </td>
                              <td className="px-2 py-1 text-right font-black text-slate-700 tabular-nums">
                                {Number(c.qty || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-100">
                          <tr>
                            <td
                              colSpan={5}
                              className="px-2 py-1.5 text-right font-black uppercase text-slate-500 text-[10px]"
                            >
                              Total ({selectedCount} coil{selectedCount === 1 ? "" : "s"})
                            </td>
                            <td className="px-2 py-1.5 text-right font-black text-indigo-700 tabular-nums">
                              {rowCoilQty(row).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
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

        <RemarksTextarea
          value={remarks}
          onChange={(e) => setRemarks(e?.target?.value ?? e ?? "")}
          placeholder="Enter remarks (optional)"
          disabled={readOnly}
        />

        {!readOnly ? (
          <ApprovalStatusToggle
            show={showApproval}
            checked={approved}
            onChange={setApproved}
            pendingHint="This issue request will stay Pending until authorized."
          />
        ) : null}

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
