"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, CheckCircle, Download, Layers, Loader2, Printer, RotateCcw, Trash2, X } from "lucide-react";
import { useEscapeKey } from "@/platform/hooks/system/useEscapeKey";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import OverlayModal from "@/ui/primitives/OverlayModal";
import ActionButton from "@/ui/primitives/ActionButton";
import PrintActionButton from "@/ui/primitives/PrintActionButton";
import DataTable from "@/ui/primitives/DataTable";
import TrayAuthorizeModal from "./TrayAuthorizeModal";
import { trayService } from "@/apps/ims/lib/services/tray";
import { getBatchHeldCount, getBatchPendingCount, getTrayStatusMeta, isTrayApproved, isTrayDeleted, isTrayHeld, isTrayPrintable, isTrayUsable } from "@/apps/ims/lib/helpers/trayHelper";
import { runTrayLabelBulkExport } from "@/apps/ims/lib/helpers/trayQrLabel";

const IMS_OUT = "rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border border-slate-300 shadow-none";
const IMS_DANGER = "rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none";
const badge = (text, cls) => <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${cls}`}>{text}</span>;

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
  onApproveBatch,
  onDeleteTray,
  onPrintQr,
  hotkeysDisabled = false,
}) {
  const [approveTray, setApproveTray] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [remark, setRemark] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [checkedTrayIds, setCheckedTrayIds] = useState(() => new Set());
  const [printBusy, setPrintBusy] = useState(false);
  const selectAllRef = useRef(null);

  const selectedTray = useMemo(() => trays.find((row) => row.id === selectedTrayId), [trays, selectedTrayId]);
  const pendingCount = useMemo(() => getBatchPendingCount(batch, trays), [batch, trays]);
  const heldCount = useMemo(() => getBatchHeldCount(batch, trays), [batch, trays]);
  const activeCount = useMemo(() => trays.filter(isTrayUsable).length, [trays]);
  const selectableTrays = useMemo(() => trays.filter((row) => !isTrayDeleted(row)), [trays]);
  const printableTrays = useMemo(() => trays.filter(isTrayPrintable), [trays]);
  const checkedRows = useMemo(() => selectableTrays.filter((row) => checkedTrayIds.has(row.id)), [selectableTrays, checkedTrayIds]);
  const checkedHeldRows = useMemo(() => checkedRows.filter(isTrayHeld), [checkedRows]);
  const checkedActiveRows = useMemo(() => checkedRows.filter(isTrayUsable), [checkedRows]);
  const checkedPrintRows = useMemo(() => checkedRows.filter(isTrayPrintable), [checkedRows]);
  const allChecked = selectableTrays.length > 0 && selectableTrays.every((row) => checkedTrayIds.has(row.id));
  const someChecked = selectableTrays.some((row) => checkedTrayIds.has(row.id));

  useEffect(() => {
    if (!isOpen) {
      setCheckedTrayIds(new Set());
      setPrintBusy(false);
      setStatusTarget(null);
      setRemark("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!statusTarget) setRemark("");
  }, [statusTarget]);

  useEffect(() => {
    setCheckedTrayIds((prev) => new Set([...prev].filter((id) => selectableTrays.some((row) => row.id === id))));
  }, [selectableTrays]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  const pickStatusTarget = useCallback(
    (status) => {
      if (status === "active") {
        if (checkedHeldRows.length) {
          return {
            scope: "ids",
            ids: checkedHeldRows.map((row) => row.id),
            title: `${checkedHeldRows.length} tray(s)`,
            status,
            count: checkedHeldRows.length,
          };
        }
        if (selectedTray && isTrayHeld(selectedTray)) {
          return { scope: "tray", id: selectedTray.id, title: selectedTray.code, status };
        }
        if (heldCount) {
          return { scope: "batch", batch_id: batch?.batch_id, title: batch?.batch_id, status, count: heldCount };
        }
        toast.info("No inactive trays.");
        return null;
      }
      if (status === "inactive") {
        if (checkedActiveRows.length) {
          return {
            scope: "ids",
            ids: checkedActiveRows.map((row) => row.id),
            title: `${checkedActiveRows.length} tray(s)`,
            status,
            count: checkedActiveRows.length,
          };
        }
        if (selectedTray && isTrayUsable(selectedTray)) {
          return { scope: "tray", id: selectedTray.id, title: selectedTray.code, status };
        }
        if (activeCount) {
          return { scope: "batch", batch_id: batch?.batch_id, title: batch?.batch_id, status, count: activeCount };
        }
        toast.info("No active trays.");
        return null;
      }
      return null;
    },
    [activeCount, batch?.batch_id, checkedActiveRows, checkedHeldRows, heldCount, selectedTray]
  );

  const confirmStatus = useCallback(async () => {
    if (!statusTarget || statusBusy) return;
    const trimmedRemark = String(remark).trim();
    if (statusTarget.status === "inactive" && !trimmedRemark) {
      toast.error("Please enter a remark.");
      return;
    }
    setStatusBusy(true);
    try {
      if (statusTarget.scope === "batch") await trayService.updateBatchStatus(statusTarget.batch_id, statusTarget.status, trimmedRemark || undefined);
      else if (statusTarget.scope === "ids") await trayService.updateStatusByIds(statusTarget.ids, statusTarget.status, trimmedRemark || undefined);
      else await trayService.updateStatus(statusTarget.id, statusTarget.status, trimmedRemark || undefined);
      toast.success(statusTarget.count > 1 ? `${statusTarget.count} trays updated` : "Tray status updated");
      setStatusTarget(null);
      setRemark("");
      setCheckedTrayIds(new Set());
      onUpdated?.();
    } catch (err) {
      toast.error(err?.message || "Status update failed");
    } finally {
      setStatusBusy(false);
    }
  }, [onUpdated, remark, statusBusy, statusTarget]);

  useEffect(() => {
    if (!statusTarget || statusBusy) return undefined;
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      void confirmStatus();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [confirmStatus, statusBusy, statusTarget]);

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
        if (result.ok) {
          toast.success(mode === "print" ? `Printing ${result.count} label(s)...` : `Downloaded ${result.count} label(s).`);
        } else if (result.reason === "popup") {
          toast.error("Allow pop-ups for this site.");
        }
      } catch (err) {
        toast.error(err?.message || `${mode === "print" ? "Print" : "Download"} failed`);
      } finally {
        setPrintBusy(false);
      }
    },
    [checkedPrintRows]
  );

  const centerCheckbox = (node) => (
    <span className="flex w-full min-w-0 items-center justify-center">{node}</span>
  );

  const headers = useMemo(
    () => [
      [
        centerCheckbox(
          <input
            key="all"
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            disabled={!selectableTrays.length || printBusy || statusBusy}
            onClick={(e) => e.stopPropagation()}
            onChange={() => setCheckedTrayIds(allChecked ? new Set() : new Set(selectableTrays.map((r) => r.id)))}
            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600"
          />
        ),
        "_select",
        (_v, row) =>
          centerCheckbox(
            <input
              type="checkbox"
              readOnly
              checked={checkedTrayIds.has(row.id)}
              disabled={isTrayDeleted(row) || printBusy || statusBusy}
              className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600 pointer-events-none disabled:opacity-40"
            />
          ),
        { width: "44px", align: "center", sortable: false, cellClass: "align-middle" },
      ],
      ["Code", "code", (v) => <span className="font-mono font-black text-indigo-600 text-[11px] uppercase">{v || "—"}</span>, { fixed: true, width: "120px" }],
      ["Tray Status", "status", (_v, row) => badge(getTrayStatusMeta(row.status).label, getTrayStatusMeta(row.status).badgeClass), { width: "110px" }],
      ["Status", "approved", (_v, row) => badge(isTrayApproved(row) ? "● AUTHORIZED" : "○ PENDING", isTrayApproved(row) ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"), { width: "120px" }],
      ["Remark", "remark", (v) => <span className="text-[10px] text-slate-500 italic">{v || "—"}</span>, { width: "160px", wrap: true }],
    ],
    [allChecked, selectableTrays, checkedTrayIds, printBusy, statusBusy]
  );

  const activateLabel = checkedHeldRows.length ? `Activate (${checkedHeldRows.length})` : "Activate";
  const inactiveLabel = checkedActiveRows.length ? `Inactive (${checkedActiveRows.length})` : "Inactive";
  const printLabel = checkedPrintRows.length ? `Print (${checkedPrintRows.length})` : "Print";
  const downloadLabel = checkedPrintRows.length ? `Download (${checkedPrintRows.length})` : "Download";
  const canActivate = checkedHeldRows.length > 0 || (selectedTray && isTrayHeld(selectedTray)) || heldCount > 0;
  const canInactive = checkedActiveRows.length > 0 || (selectedTray && isTrayUsable(selectedTray)) || activeCount > 0;

  useEscapeKey(() => setStatusTarget(null), !!statusTarget && !statusBusy);

  if (!isOpen) return null;
  const statusMeta = statusTarget ? getTrayStatusMeta(statusTarget.status) : null;

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        closeOnOutside
        title={`Batch ${batch?.batch_id || ""}`}
        description={`${formatTypeLabel ? formatTypeLabel(batch?.type) : batch?.type || "—"} | ${trays.length} trays`}
        maxWidth="max-w-6xl"
        bodyScrollable={false}
      >
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ActionButton module="tray_master" action="authorize" variant="outline" label={pendingCount ? `Approve All (${pendingCount})` : "Approve All"} icon={Layers} disabled={!pendingCount} onClick={() => onApproveBatch?.(batch)} className={`${IMS_OUT} text-emerald-600`} />
            <ActionButton module="tray_master" action="authorize" variant="outline" label="Approve Tray" icon={CheckCircle} disabled={!selectedTray || !isTrayUsable(selectedTray) || isTrayApproved(selectedTray)} onClick={() => setApproveTray(selectedTray)} className={`${IMS_OUT} text-emerald-600`} />
            <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
            <ActionButton module="tray_master" action="edit" variant="outline" label={activateLabel} icon={RotateCcw} disabled={!canActivate || statusBusy} onClick={() => { const t = pickStatusTarget("active"); if (t) setStatusTarget(t); }} className={`${IMS_OUT} text-emerald-700`} />
            <ActionButton module="tray_master" action="edit" variant="outline" label={inactiveLabel} icon={Ban} disabled={!canInactive || statusBusy} onClick={() => { const t = pickStatusTarget("inactive"); if (t) setStatusTarget(t); }} className={IMS_OUT} />
            <ActionButton module="tray_master" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selectedTray || isTrayDeleted(selectedTray)} onClick={() => onDeleteTray?.(selectedTray)} className={IMS_DANGER} />
            <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
            <PrintActionButton module="tray_master" variant="outline" label={printLabel} icon={printBusy ? Loader2 : Printer} disabled={!checkedPrintRows.length || printBusy} onClick={() => void runCheckedExport("print")} className={IMS_OUT} />
            <PrintActionButton module="tray_master" variant="outline" label={downloadLabel} icon={printBusy ? Loader2 : Download} disabled={!checkedPrintRows.length || printBusy} onClick={() => void runCheckedExport("download")} className={IMS_OUT} />
            <PrintActionButton module="tray_master" variant="outline" label="Preview QR" icon={Printer} disabled={!selectedTray || !isTrayPrintable(selectedTray)} onClick={() => onPrintQr?.(selectedTray)} className={IMS_OUT} />
          </div>
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <DataTable
              headers={headers}
              data={trays}
              loading={loading}
              viewMode={viewMode}
              allowCopy
              hotkeysDisabled={hotkeysDisabled || !!approveTray || printBusy || !!statusTarget}
              showSelection={false}
              selectedId={selectedTrayId}
              onRowClick={handleTraySelect}
              getRowId={(item) => item.id}
              cardConfig={{ titleKey: "code", badgeIndices: [2, 3], detailIndices: [], className: "rounded-none border border-slate-200 shadow-none" }}
            />
          </div>
        </div>
      </Drawer>

      {approveTray ? <TrayAuthorizeModal open onClose={() => setApproveTray(null)} onSuccess={onUpdated} data={approveTray} stackLevel={1} /> : null}

      {statusTarget && statusMeta ? (
        <OverlayModal open zIndex={1150} onBackdropClick={() => !statusBusy && setStatusTarget(null)}>
          <form
            className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmStatus();
            }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                  <AlertTriangle size={14} className="text-slate-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 truncate">
                    {statusMeta.actionLabel}
                    {statusTarget.scope === "batch" ? " Batch" : statusTarget.scope === "ids" ? ` (${statusTarget.count})` : ""}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mark as {statusMeta.label}
                    {statusTarget.scope === "batch" || statusTarget.scope === "ids"
                      ? ` · ${statusTarget.count || 1} tray(s)`
                      : ` · ${statusTarget.title}`}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setStatusTarget(null)} disabled={statusBusy} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {statusTarget.status === "inactive" ? (
                <div>
                  <label htmlFor="tray-status-remark" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Remark <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="tray-status-remark"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={4}
                    autoFocus
                    disabled={statusBusy}
                    placeholder="Why are you marking inactive?"
                    className="w-full resize-y min-h-[96px] rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                  />
                </div>
              ) : (
                <div className="flex gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <AlertTriangle size={15} className="text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 leading-snug">
                    Confirm to mark{" "}
                    <span className="font-semibold text-slate-800">{statusTarget.title}</span> as {statusMeta.label}.
                  </p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setStatusTarget(null)} disabled={statusBusy} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={statusBusy || (statusTarget.status === "inactive" && !String(remark).trim())}
                title="Ctrl+S"
                className={`px-4 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-60 ${statusMeta.buttonClass}`}
              >
                {statusBusy ? "Saving..." : statusMeta.actionLabel}
              </button>
            </div>
          </form>
        </OverlayModal>
      ) : null}
    </>
  );
}
