"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, Download, Loader2, Printer, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useEscapeKey } from "@/platform/hooks/system/useEscapeKey";
import { toast } from "react-toastify";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import Drawer from "@/ui/primitives/Drawer";
import OverlayModal from "@/ui/primitives/OverlayModal";
import ActionButton from "@/ui/primitives/ActionButton";
import PrintActionButton from "@/ui/primitives/PrintActionButton";
import DataTable from "@/ui/primitives/DataTable";
import { trayService } from "@/apps/ims/lib/services/tray";
import { getTrayEffectiveStatus, getTrayStatusMeta, isTrayApproved, isTrayDeleted, isTrayHeld, isTrayInUse, isTrayPrintable, isTrayUsable, sortTraysAsc } from "@/apps/ims/lib/helpers/trayHelper";
import { runTrayLabelBulkExport } from "@/apps/ims/lib/helpers/trayQrLabel";
import { nextSortParams, sortRowsByKey } from "@/ui/common/list/clientListSearch";

const IMS_OUT = "rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border border-slate-300 shadow-none";
const IMS_DANGER = "rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none";
const CHECK = "h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600";
const badge = (text, cls) => <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${cls}`}>{text}</span>;
const countLabel = (base, n) => (n ? `${base} (${n})` : base);

function traySearchParts(row) {
  const status = getTrayEffectiveStatus(row);
  const meta = getTrayStatusMeta(status);
  return [
    row?.code,
    status,
    meta.label,
    row?.updated_by_name,
    row?.updated_by_name ? formatDateTime(row?.updated_at) : "",
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
}

function rowMatchesSearch(row, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const token = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const word = new RegExp(`(^|[^a-z0-9])${token}`);
  return traySearchParts(row).some((part) => {
    const p = part.toLowerCase();
    return p === q || p.startsWith(q) || word.test(p);
  });
}

function ConfirmDialog({ title, subtitle, body, busy, confirmLabel, busyLabel = "Saving...", confirmClass, onClose, onConfirm, icon: Icon = AlertTriangle, iconWrap = "bg-slate-50 border-slate-200", iconClass = "text-slate-600" }) {
  return (
    <OverlayModal open zIndex={1150} onBackdropClick={() => !busy && onClose()}>
      <form
        className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          void onConfirm();
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${iconWrap}`}>
              <Icon size={14} className={iconClass} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 truncate">{title}</h3>
              {subtitle ? <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="flex gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <AlertTriangle size={15} className="text-slate-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-snug">{body}</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={busy} title="Ctrl+S" className={`px-4 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-60 ${confirmClass}`}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </form>
    </OverlayModal>
  );
}

export default function TrayBatchDrawer({
  isOpen,
  onClose,
  batch,
  formatTypeLabel,
  trays,
  loading = false,
  viewMode,
  selectedTrayId,
  onSelectTray,
  onUpdated,
  hotkeysDisabled = false,
}) {
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [checkedTrayIds, setCheckedTrayIds] = useState(() => new Set());
  const [printBusy, setPrintBusy] = useState(false);
  const [traySearch, setTraySearch] = useState("");
  const [sort, setSort] = useState({ sortKey: "", sortDir: "asc" });
  const selectAllRef = useRef(null);

  const selectedTray = useMemo(() => trays.find((row) => row.id === selectedTrayId), [trays, selectedTrayId]);
  const visibleTrays = useMemo(() => {
    const q = String(traySearch || "").trim();
    const filtered = q ? trays.filter((row) => rowMatchesSearch(row, q)) : trays;
    if (!sort.sortKey) return filtered;
    const rows = sort.sortKey === "status"
      ? filtered.map((row) => ({ ...row, status: getTrayEffectiveStatus(row) }))
      : filtered;
    return sortRowsByKey(rows, sort.sortKey, sort.sortDir);
  }, [trays, traySearch, sort.sortDir, sort.sortKey]);
  const selectableTrays = useMemo(() => trays.filter((row) => !isTrayDeleted(row)), [trays]);
  const visibleSelectable = useMemo(() => visibleTrays.filter((row) => !isTrayDeleted(row)), [visibleTrays]);
  const checkedRows = useMemo(() => selectableTrays.filter((row) => checkedTrayIds.has(row.id)), [selectableTrays, checkedTrayIds]);
  const checkedHeldRows = useMemo(() => checkedRows.filter(isTrayHeld), [checkedRows]);
  const checkedActiveRows = useMemo(() => checkedRows.filter(isTrayUsable), [checkedRows]);
  const checkedPrintRows = useMemo(() => sortTraysAsc(checkedRows.filter(isTrayPrintable)), [checkedRows]);
  const allChecked = visibleSelectable.length > 0 && visibleSelectable.every((row) => checkedTrayIds.has(row.id));
  const someChecked = visibleSelectable.some((row) => checkedTrayIds.has(row.id));
  const deleteRows = checkedRows.length ? checkedRows : selectedTray ? [selectedTray] : [];
  const inactiveTargets = checkedActiveRows.length ? checkedActiveRows : selectedTray && isTrayUsable(selectedTray) ? [selectedTray] : [];
  const inUseBlocked = (rows) => rows.filter(isTrayInUse);
  const batchApproved = isTrayApproved(batch);
  const canActivate = batchApproved && (checkedHeldRows.length > 0 || (selectedTray && isTrayHeld(selectedTray)));
  const canInactive = batchApproved && inactiveTargets.length > 0 && inUseBlocked(inactiveTargets).length === 0;
  const canDelete = deleteRows.length > 0 && inUseBlocked(deleteRows).length === 0;

  useEffect(() => {
    if (isOpen) return;
    setCheckedTrayIds(new Set());
    setPrintBusy(false);
    setStatusTarget(null);
    setDeleteTarget(null);
    setTraySearch("");
    setSort({ sortKey: "", sortDir: "asc" });
  }, [isOpen]);

  useEffect(() => {
    setCheckedTrayIds((prev) => new Set([...prev].filter((id) => selectableTrays.some((row) => row.id === id))));
  }, [selectableTrays]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  const pickStatusTarget = useCallback(
    (status) => {
      if (!isTrayApproved(batch)) {
        toast.info("Approve this batch first. Trays become active after authorization.");
        return null;
      }
      const toActive = status === "active";
      const checked = toActive ? checkedHeldRows : checkedActiveRows;
      const blocked = toActive ? [] : inUseBlocked(checked.length ? checked : selectedTray ? [selectedTray] : []);
      if (blocked.length) {
        toast.error(`Cannot deactivate. Tray ${blocked.map((row) => row.code).filter(Boolean).join(", ")} is already in use.`);
        return null;
      }
      if (checked.length) {
        return { scope: "ids", ids: checked.map((row) => row.id), title: `${checked.length} tray(s)`, status, count: checked.length };
      }
      if (selectedTray && (toActive ? isTrayHeld(selectedTray) : isTrayUsable(selectedTray))) {
        return { scope: "tray", id: selectedTray.id, title: selectedTray.code, status };
      }
      toast.info(toActive ? "Select an inactive tray to activate." : "Select an active tray to mark it inactive.");
      return null;
    },
    [batch, checkedActiveRows, checkedHeldRows, selectedTray]
  );

  const confirmStatus = useCallback(async () => {
    if (!statusTarget || statusBusy) return;
    setStatusBusy(true);
    try {
      if (statusTarget.scope === "ids") await trayService.updateStatusByIds(statusTarget.ids, statusTarget.status);
      else await trayService.updateStatus(statusTarget.id, statusTarget.status);
      toast.success(statusTarget.count > 1 ? `${statusTarget.count} trays updated` : "Tray status updated");
      setStatusTarget(null);
      setCheckedTrayIds(new Set());
      onUpdated?.();
    } catch (err) {
      toast.error(err?.message || "Status update failed");
    } finally {
      setStatusBusy(false);
    }
  }, [onUpdated, statusBusy, statusTarget]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.ids?.length || statusBusy) return;
    setStatusBusy(true);
    try {
      const res = await trayService.deleteByIds(deleteTarget.ids);
      toast.success(res?.message || (deleteTarget.count > 1 ? `Deleted ${deleteTarget.count} tray(s)` : "Tray deleted"));
      setDeleteTarget(null);
      setCheckedTrayIds(new Set());
      onUpdated?.();
    } catch (err) {
      toast.error(err?.message || "Delete failed");
    } finally {
      setStatusBusy(false);
    }
  }, [deleteTarget, onUpdated, statusBusy]);

  const handleTraySelect = useCallback(
    (item, id) => {
      if (isTrayDeleted(item)) return;
      onSelectTray?.(id);
      setCheckedTrayIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [onSelectTray]
  );

  const runCheckedExport = useCallback(
    async (mode) => {
      if (!checkedPrintRows.length) return;
      setPrintBusy(true);
      try {
        const result = await runTrayLabelBulkExport(mode, checkedPrintRows);
        if (result.ok) toast.success(mode === "print" ? `Printing ${result.count} label(s)...` : `Downloaded ${result.count} label(s).`);
        else if (result.reason === "popup") toast.error("Allow pop-ups for this site.");
      } catch (err) {
        toast.error(err?.message || `${mode === "print" ? "Print" : "Download"} failed`);
      } finally {
        setPrintBusy(false);
      }
    },
    [checkedPrintRows]
  );

  useEffect(() => {
    if ((!statusTarget && !deleteTarget) || statusBusy) return undefined;
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      if (deleteTarget) void confirmDelete();
      else void confirmStatus();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [confirmDelete, confirmStatus, deleteTarget, statusBusy, statusTarget]);

  const headers = useMemo(
    () => [
      [
        <span className="flex w-full min-w-0 items-center justify-center">
          <input
            key="all"
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            disabled={!visibleSelectable.length || printBusy || statusBusy}
            onClick={(e) => e.stopPropagation()}
            onChange={() => {
              setCheckedTrayIds((prev) => {
                const next = new Set(prev);
                if (allChecked) visibleSelectable.forEach((row) => next.delete(row.id));
                else visibleSelectable.forEach((row) => next.add(row.id));
                return next;
              });
            }}
            className={CHECK}
          />
        </span>,
        "_select",
        (_v, row) => (
          <span className="flex w-full min-w-0 items-center justify-center">
            <input
              type="checkbox"
              readOnly
              checked={checkedTrayIds.has(row.id)}
              disabled={isTrayDeleted(row) || printBusy || statusBusy}
              className={`${CHECK} pointer-events-none disabled:opacity-40`}
            />
          </span>
        ),
        { width: "44px", align: "center", sortable: false, cellClass: "align-middle" },
      ],
      ["Code", "code", (v) => <span className="font-mono font-black text-indigo-600 text-[11px] uppercase">{v || "—"}</span>, { fixed: true, width: "120px" }],
      ["Tray Status", "status", (_v, row) => {
        const meta = getTrayStatusMeta(getTrayEffectiveStatus(row));
        return badge(meta.label, meta.badgeClass);
      }, { width: "110px" }],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v, row) => <span className="text-[10px] text-slate-400">{row?.updated_by_name ? formatDateTime(v) : "—"}</span>, { width: "140px" }],
    ],
    [allChecked, visibleSelectable, checkedTrayIds, printBusy, statusBusy]
  );

  useEscapeKey(() => {
    if (deleteTarget) setDeleteTarget(null);
    else setStatusTarget(null);
  }, (!!statusTarget || !!deleteTarget) && !statusBusy);

  if (!isOpen) return null;
  const statusMeta = statusTarget ? getTrayStatusMeta(statusTarget.status) : null;
  const searching = String(traySearch || "").trim();

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        closeOnOutside
        title={`Batch ${batch?.batch_id || ""}`}
        description={`${formatTypeLabel ? formatTypeLabel(batch?.type) : batch?.type || "—"} | ${searching ? `${visibleTrays.length} of ${trays.length}` : trays.length} trays`}
        maxWidth="max-w-6xl"
        bodyScrollable={false}
      >
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative h-9 w-[200px] shrink-0">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-indigo-400" />
              <input
                type="text"
                value={traySearch}
                onChange={(e) => setTraySearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search tray..."
                className="h-9 w-full rounded-none border border-indigo-300 bg-indigo-50 pl-8 pr-8 text-[11px] font-semibold text-slate-700 placeholder:font-medium placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
              />
              {traySearch ? (
                <button type="button" onClick={() => setTraySearch("")} className="absolute right-2 top-1/2 z-[1] -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <ActionButton module="tray_master" action="edit" variant="outline" label={countLabel("Activate", checkedHeldRows.length)} icon={RotateCcw} disabled={!canActivate || statusBusy} onClick={() => { const t = pickStatusTarget("active"); if (t) setStatusTarget(t); }} className={`${IMS_OUT} text-emerald-700`} />
              <ActionButton module="tray_master" action="edit" variant="outline" label={countLabel("Inactive", checkedActiveRows.length)} icon={Ban} disabled={!canInactive || statusBusy} onClick={() => { const t = pickStatusTarget("inactive"); if (t) setStatusTarget(t); }} className={IMS_OUT} />
              <ActionButton module="tray_master" action="delete" variant="danger" label={countLabel("Delete", deleteRows.length)} icon={Trash2} disabled={!canDelete || statusBusy} onClick={() => setDeleteTarget({ ids: deleteRows.map((row) => row.id), count: deleteRows.length, title: deleteRows.length === 1 ? deleteRows[0].code : `${deleteRows.length} tray(s)` })} className={IMS_DANGER} />
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              <PrintActionButton module="tray_master" variant="outline" label={countLabel("Print", checkedPrintRows.length)} icon={printBusy ? Loader2 : Printer} disabled={!checkedPrintRows.length || printBusy} onClick={() => void runCheckedExport("print")} className={IMS_OUT} />
              <PrintActionButton module="tray_master" variant="outline" label={countLabel("Download", checkedPrintRows.length)} icon={printBusy ? Loader2 : Download} disabled={!checkedPrintRows.length || printBusy} onClick={() => void runCheckedExport("download")} className={IMS_OUT} />
            </div>
          </div>
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <DataTable
              headers={headers}
              data={visibleTrays}
              loading={loading}
              viewMode={viewMode}
              allowCopy
              emptyMessage={searching ? "No trays match search" : "No records found"}
              sortKey={sort.sortKey}
              sortDir={sort.sortDir}
              onSort={(key) => setSort((prev) => nextSortParams(prev, key))}
              hotkeysDisabled={hotkeysDisabled || printBusy || !!statusTarget || !!deleteTarget}
              showSelection={false}
              selectedId={selectedTrayId}
              onRowClick={handleTraySelect}
              getRowId={(item) => item.id}
              cardConfig={{ titleKey: "code", badgeIndices: [2], detailIndices: [], className: "rounded-none border border-slate-200 shadow-none" }}
            />
          </div>
        </div>
      </Drawer>

      {statusTarget && statusMeta ? (
        <ConfirmDialog
          title={`${statusMeta.actionLabel}${statusTarget.scope === "ids" ? ` (${statusTarget.count})` : ""}`}
          subtitle={`Mark as ${statusMeta.label} · ${statusTarget.title}`}
          body={<>Confirm to mark <span className="font-semibold text-slate-800">{statusTarget.title}</span> as {statusMeta.label}.</>}
          busy={statusBusy}
          confirmLabel={statusMeta.actionLabel}
          confirmClass={statusMeta.buttonClass}
          onClose={() => setStatusTarget(null)}
          onConfirm={confirmStatus}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title={`Delete Tray${deleteTarget.count > 1 ? "s" : ""}`}
          subtitle={deleteTarget.title}
          body={<>Delete <span className="font-semibold text-slate-800">{deleteTarget.title}</span>?</>}
          busy={statusBusy}
          confirmLabel="Delete"
          busyLabel="Deleting..."
          confirmClass="bg-rose-600 hover:bg-rose-700"
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          icon={Trash2}
          iconWrap="bg-rose-50 border-rose-100"
          iconClass="text-rose-600"
        />
      ) : null}
    </>
  );
}
