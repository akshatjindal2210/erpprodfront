"use client";

import { useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { useCanAccess } from "@/core/hooks/useCanAccess";

export function editTimeBlockedByAccess(record, access) {
  if (!record || !access || access.days <= 0) return false;
  const createdAt = new Date(record.created_at || record.timestamp);
  if (Number.isNaN(createdAt.getTime())) return false;
  const diffDays = Math.ceil(Math.abs(Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > access.days;
}

/**
 Ctrl+Alt+N / Ctrl+Alt+E / Ctrl+Alt+P (DataTable) — same flows as New / Edit / Print toolbar actions.
 Plain Ctrl+N / Ctrl+E / Ctrl+P work in installed PWA where the browser does not reserve those keys.
 Ctrl+A — open authorize / approve drawer for the selected row (when `openApprove` is provided).
 
 Special pages (e.g. “New Sticker” instead of “New”) can pass:
 - `canOpenNew` when opening needs extra rules (e.g. row must be selected first)
 - `newBlockedMessage` — short copy when that shortcut runs but the gate fails (per-page wording)
 - or `onNewBlocked` instead of `newBlockedMessage` for fully custom behavior (if both set, `onNewBlocked` wins)
*/
export function useListDrawerHotkeys({
  module,
  addAction = "add",
  editAction = "edit",
  authorizeAction = "authorize",
  modalOpen,
  selectedId,
  getSelectedRow,
  openAdd,
  openEdit,
  /** Opens approve / authorize drawer for the selected row (Ctrl+A). */
  openApprove,
  /** When `openApprove` fails: toast or custom handler (e.g. no row selected). Approved rows may still open the drawer. */
  canApproveSelection,
  onApproveBlocked,
  approveBlockedMessage,
  /** Optional extra check before “New” (e.g. row must be selected first). */
  canOpenNew,
  /** When set and `canOpenNew` fails: `toast.info(newBlockedMessage)` (skipped if `onNewBlocked` is set). */
  newBlockedMessage,
  /** Full override when `canOpenNew` fails; takes precedence over `newBlockedMessage`. */
  onNewBlocked,
  canEditSelection,
  /** When `canEditSelection` fails: toast or custom handler (e.g. approved row). */
  onEditBlocked,
  editBlockedMessage,
  /** When set, Ctrl+Alt+P / Ctrl+P runs this for the selected row (list pages with Print). */
  onPrint,
  canPrintSelection,
  printBlockedMessage,
  onPrintBlocked,
  printModule,
  printAction = "view",
}) {
  const canAccess = useCanAccess();

  const openNewModal = useCallback(() => {
    if (!canAccess(module, addAction).allowed) return;
    if (typeof canOpenNew === "function" && !canOpenNew()) {
      if (typeof onNewBlocked === "function") {
        onNewBlocked();
      } else if (newBlockedMessage && String(newBlockedMessage).trim()) {
        toast.info(String(newBlockedMessage).trim());
      }
      return;
    }
    openAdd();
  }, [canAccess, module, addAction, canOpenNew, newBlockedMessage, onNewBlocked, openAdd]);

  const openEditModal = useCallback(() => {
    if (typeof openEdit !== "function") return;
    if (selectedId == null || selectedId === "") return;
    if (typeof canEditSelection === "function" && !canEditSelection()) {
      if (typeof onEditBlocked === "function") {
        onEditBlocked();
      } else if (editBlockedMessage && String(editBlockedMessage).trim()) {
        toast.info(String(editBlockedMessage).trim());
      }
      return;
    }
    const row = typeof getSelectedRow === "function" ? getSelectedRow() : null;
    if (!row) return;
    const access = canAccess(module, editAction);
    if (!access.allowed) return;
    if (editTimeBlockedByAccess(row, access)) return;
    openEdit(row);
  }, [canAccess, module, editAction, selectedId, getSelectedRow, openEdit, canEditSelection, onEditBlocked, editBlockedMessage]);

  const openApproveModal = useCallback(() => {
    if (typeof openApprove !== "function") return;
    if (selectedId == null || selectedId === "") return;
    const access = canAccess(module, authorizeAction);
    if (!access.allowed) return;
    if (typeof canApproveSelection === "function" && !canApproveSelection()) {
      if (typeof onApproveBlocked === "function") {
        onApproveBlocked();
      } else if (approveBlockedMessage && String(approveBlockedMessage).trim()) {
        toast.info(String(approveBlockedMessage).trim());
      }
      return;
    }
    const row = typeof getSelectedRow === "function" ? getSelectedRow() : null;
    if (!row) return;
    openApprove(row);
  }, [
    openApprove,
    selectedId,
    canAccess,
    module,
    authorizeAction,
    canApproveSelection,
    onApproveBlocked,
    approveBlockedMessage,
    getSelectedRow,
  ]);

  const openPrintModal = useCallback(() => {
    if (typeof onPrint !== "function") return;
    if (selectedId == null || selectedId === "") return;
    if (typeof canPrintSelection === "function" && !canPrintSelection()) {
      if (typeof onPrintBlocked === "function") {
        onPrintBlocked();
      } else if (printBlockedMessage && String(printBlockedMessage).trim()) {
        toast.info(String(printBlockedMessage).trim());
      }
      return;
    }
    const row = typeof getSelectedRow === "function" ? getSelectedRow() : null;
    if (!row) return;
    if (printModule) {
      const access = canAccess(printModule, printAction);
      if (!access.allowed) return;
    }
    onPrint(row);
  }, [ onPrint, selectedId, canPrintSelection, printBlockedMessage, onPrintBlocked, getSelectedRow, printModule, printAction, canAccess ]);

  const tableHotkeyProps = useMemo(() => {
    const base = { hotkeysDisabled: modalOpen, hotkeyNew: openNewModal };
    if (typeof openEdit === "function") base.hotkeyEdit = openEditModal;
    if (typeof onPrint === "function") base.hotkeyPrint = openPrintModal;
    if (typeof openApprove === "function") base.hotkeyApprove = openApproveModal;
    return base;
  }, [modalOpen, openNewModal, openEditModal, openEdit, onPrint, openPrintModal, openApprove, openApproveModal]);

  return { openNewModal, openEditModal, openApproveModal, openPrintModal, tableHotkeyProps };
}

